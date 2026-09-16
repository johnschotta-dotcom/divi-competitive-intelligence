/**
 * Divi Competitive Intelligence Agent
 * Deploy to: Vercel Functions (api/intelligence.js)
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Fetch webpage content
async function fetchWebpage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.substring(0, 5000);
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

// Analyze competitor using Claude
async function analyzeCompetitor(competitor) {
  const website = competitor.website;
  const pageContent = await fetchWebpage(website);

  if (!pageContent) {
    return {
      competitor_id: competitor.id,
      error: 'Could not fetch website',
    };
  }

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-20250805',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `You are a competitive intelligence analyst. Analyze this competitor website and extract:
1. Main features (list)
2. Pricing tiers (list with prices)
3. Target market
4. Recent updates

Competitor: ${competitor.name}
Website: ${website}

Content:
${pageContent}

Return ONLY valid JSON (no markdown, no extra text):
{
  "features": ["feature1", "feature2"],
  "pricing": [{"tier": "name", "price": "amount"}],
  "target_market": "description",
  "recent_updates": "updates or none"
}`,
      },
    ],
  });

  try {
    const jsonMatch = message.content[0].text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
  } catch (error) {
    console.error('Error parsing response:', error);
    return { error: 'Could not parse' };
  }
}

// Detect changes
async function detectChanges(competitor, newAnalysis) {
  const changes = [];

  const { data: existingFeatures } = await supabase
    .from('features')
    .select('*')
    .eq('competitor_id', competitor.id)
    .eq('is_current', true);

  const { data: existingPricing } = await supabase
    .from('pricing')
    .select('*')
    .eq('competitor_id', competitor.id)
    .eq('is_current', true);

  // Check for new features
  if (newAnalysis.features) {
    const existingFeatureNames = (existingFeatures || []).map(f => f.feature_name.toLowerCase());
    for (const feature of newAnalysis.features) {
      if (!existingFeatureNames.includes(feature.toLowerCase())) {
        changes.push({
          competitor_id: competitor.id,
          change_type: 'feature',
          old_value: 'not present',
          new_value: feature,
          manual_review_required: false,
        });
        
        await supabase.from('features').insert({
          competitor_id: competitor.id,
          feature_name: feature,
          verified: false,
        });
      }
    }
  }

  // Check for pricing changes
  if (newAnalysis.pricing) {
    for (const newPrice of newAnalysis.pricing) {
      const existing = (existingPricing || []).find(p => p.tier_name?.toLowerCase() === newPrice.tier?.toLowerCase());
      
      if (!existing) {
        changes.push({
          competitor_id: competitor.id,
          change_type: 'pricing',
          old_value: 'tier not present',
          new_value: `${newPrice.tier} - ${newPrice.price}`,
        });
        
        await supabase
          .from('pricing')
          .update({ is_current: false })
          .eq('competitor_id', competitor.id)
          .eq('tier_name', newPrice.tier);
        
        await supabase.from('pricing').insert({
          competitor_id: competitor.id,
          tier_name: newPrice.tier,
          price: parseFloat(newPrice.price) || null,
        });
      }
    }
  }

  return changes;
}

// Score threat level
async function scoreThreat(competitor, analysis) {
  const message = await anthropic.messages.create({
    model: 'claude-opus-4-20250805',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `You are evaluating threats to Divi (divi.fund), an AI-native angel investor platform with:
- Portfolio tracking from cap tables
- AI Intelligence Dashboard
- Syndicate creation tools ($99/mo)
- Investor education

Evaluate this competitor on 0-100 scale:
Name: ${competitor.name}
Website: ${competitor.website}
Features: ${analysis.features?.join(', ') || 'unknown'}
Pricing: ${analysis.pricing?.map(p => p.tier + ' - ' + p.price).join(', ') || 'unknown'}

Return ONLY valid JSON (no markdown):
{
  "threat_score": 50,
  "reasoning": "brief explanation",
  "recommended_tier": "critical/high/medium/emerging/monitor"
}`,
      },
    ],
  });

  try {
    const jsonMatch = message.content[0].text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : {});
  } catch (error) {
    console.error('Error scoring:', error);
    return { threat_score: 50 };
  }
}

// Main handler
export default async function handler(req, res) {
  try {
    console.log('🤖 Starting Competitive Intelligence Agent...');

    // Phase 1: Monitor existing competitors
    console.log('\n📊 Monitoring competitors...');
    const { data: competitors, error: competitorError } = await supabase
      .from('competitors')
      .select('*')
      .eq('status', 'active');

    if (competitorError) throw competitorError;

    for (const competitor of competitors || []) {
      console.log(`Analyzing ${competitor.name}...`);
      
      const analysis = await analyzeCompetitor(competitor);
      
      if (!analysis.error) {
        // Detect changes
        const changes = await detectChanges(competitor, analysis);
        
        // Generate alerts
        for (const change of changes) {
          if (change.change_type === 'feature') {
            await supabase.from('alerts').insert({
              competitor_id: competitor.id,
              alert_type: 'new_feature',
              severity: 'high',
              message: `🆕 ${competitor.name} launched: ${change.new_value}`,
            });
          } else if (change.change_type === 'pricing') {
            await supabase.from('alerts').insert({
              competitor_id: competitor.id,
              alert_type: 'price_change',
              severity: 'medium',
              message: `💰 ${competitor.name}: ${change.new_value}`,
            });
          }
        }
        
        // Score threat
        const threatScore = await scoreThreat(competitor, analysis);
        
        if (threatScore.threat_score && Math.abs(threatScore.threat_score - competitor.threat_score) > 10) {
          await supabase
            .from('competitors')
            .update({
              threat_score: threatScore.threat_score,
              tier: threatScore.recommended_tier,
              last_analyzed: new Date(),
            })
            .eq('id', competitor.id);
          
          if (threatScore.threat_score > competitor.threat_score) {
            await supabase.from('alerts').insert({
              competitor_id: competitor.id,
              alert_type: 'threat_escalation',
              severity: 'critical',
              message: `⚠️ ${competitor.name} threat level: ${threatScore.recommended_tier}`,
            });
          }
        }
      }
      
      await supabase
        .from('competitors')
        .update({ last_checked: new Date() })
        .eq('id', competitor.id);
    }

    console.log('\n✅ Agent run completed!');
    
    res.status(200).json({
      success: true,
      message: 'Intelligence agent executed',
      timestamp: new Date(),
      competitors_analyzed: (competitors || []).length,
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
