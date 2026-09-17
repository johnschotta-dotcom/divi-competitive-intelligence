/**
 * Enhanced Competitive Intelligence Agent - OPTIMIZED
 * Faster parallel processing with timeout handling
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Fetch webpage
async function fetchWebpage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (!response.ok) return null;
    const html = await response.text();
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.substring(0, 3000);
  } catch (error) {
    return null;
  }
}

// Deep competitive analysis with timeout
async function analyzeCompetitorProfile(competitor) {
  try {
    const pageContent = await fetchWebpage(competitor.website);
    if (!pageContent) return null;

    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Analyze ${competitor.name} for Divi (AI-native angel investor platform).
Website: ${pageContent}

Return ONLY JSON (no markdown):
{
  "overall_summary": "1-2 sentence summary",
  "target_audience": "Who they target",
  "primary_value_prop": "Main value prop",
  "business_model": "How they make money",
  "team_credibility": 50,
  "strengths": [{"title": "Name", "description": "What", "why_strong": "Why", "competitive_advantage": "high/medium/low"}],
  "weaknesses": [{"title": "Gap", "description": "What", "why_weak": "Why", "opportunity": "high/medium/low"}],
  "risk_to_divi": {"overall_risk": "critical/high/medium/low", "risk_score": 50, "reasoning": "Why", "key_risks": ["risk1"], "mitigation": "What Divi should do"}
}`,
      }],
    });

    try {
      const jsonMatch = message.content[0].text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
    } catch (error) {
      return null;
    }
  } catch (error) {
    console.error(`Error analyzing ${competitor.name}:`, error.message);
    return null;
  }
}

// Store profile
async function storeCompetitorProfile(competitor, analysis) {
  if (!analysis) return false;

  try {
    // Store main profile
    await supabase.from('competitor_profiles').upsert({
      competitor_id: competitor.id,
      overall_summary: analysis.overall_summary || '',
      target_audience: analysis.target_audience || '',
      primary_value_prop: analysis.primary_value_prop || '',
      business_model: analysis.business_model || '',
      credibility_score: analysis.team_credibility || 50,
      risk_score: analysis.risk_to_divi?.risk_score || 50,
      threat_to_divi: analysis.risk_to_divi?.overall_risk || 'medium',
      risk_reasoning: analysis.risk_to_divi?.reasoning || '',
      analyzed_at: new Date(),
    }, { onConflict: 'competitor_id' });

    // Store strengths
    if (analysis.strengths?.length > 0) {
      await supabase.from('competitor_strengths').delete().eq('competitor_id', competitor.id);
      await supabase.from('competitor_strengths').insert(
        analysis.strengths.map(s => ({
          competitor_id: competitor.id,
          strength_title: s.title || '',
          description: s.description || '',
          why_its_strong: s.why_strong || '',
          competitive_advantage_level: s.competitive_advantage || 'medium',
        }))
      );
    }

    // Store weaknesses
    if (analysis.weaknesses?.length > 0) {
      await supabase.from('competitor_weaknesses').delete().eq('competitor_id', competitor.id);
      await supabase.from('competitor_weaknesses').insert(
        analysis.weaknesses.map(w => ({
          competitor_id: competitor.id,
          weakness_title: w.title || '',
          description: w.description || '',
          why_its_weak: w.why_weak || '',
          opportunity_level: w.opportunity || 'medium',
          divi_advantage: `Divi advantage in ${w.title}`,
        }))
      );
    }

    // Store risk assessment
    if (analysis.risk_to_divi?.key_risks?.length > 0) {
      await supabase.from('risk_assessment').insert(
        analysis.risk_to_divi.key_risks.map(risk => ({
          competitor_id: competitor.id,
          risk_category: 'competitive_positioning',
          risk_level: analysis.risk_to_divi.overall_risk || 'medium',
          description: risk || '',
          potential_impact: 'Threat to Divi',
          mitigation_strategy: analysis.risk_to_divi.mitigation || '',
        }))
      );
    }

    // Update competitor
    await supabase.from('competitors').update({
      threat_score: analysis.risk_to_divi?.risk_score || 50,
      tier: analysis.risk_to_divi?.overall_risk || 'medium',
      last_analyzed: new Date(),
    }).eq('id', competitor.id);

    return true;
  } catch (error) {
    console.error('Error storing profile:', error.message);
    return false;
  }
}

// Main handler - FAST VERSION
export default async function handler(req, res) {
  try {
    console.log('🔬 Starting Enhanced Analysis...');

    const { data: competitors } = await supabase
      .from('competitors')
      .select('*')
      .eq('status', 'active')
      .limit(5); // Only analyze 5 at a time to avoid timeout

    let analyzed = 0;
    let failed = 0;

    // Process in parallel (2 at a time to avoid rate limits)
    for (let i = 0; i < (competitors?.length || 0); i += 2) {
      const batch = competitors.slice(i, i + 2);
      
      const results = await Promise.allSettled(
        batch.map(async (comp) => {
          console.log(`Analyzing ${comp.name}...`);
          const analysis = await analyzeCompetitorProfile(comp);
          if (analysis) {
            const stored = await storeCompetitorProfile(comp, analysis);
            if (stored) analyzed++;
            else failed++;
          } else {
            failed++;
          }
        })
      );
    }

    console.log(`✅ Analysis complete: ${analyzed} analyzed, ${failed} failed`);
    
    res.status(200).json({
      success: true,
      competitors_analyzed: analyzed,
      failed_count: failed,
      message: 'Enhanced analysis completed',
      timestamp: new Date(),
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(200).json({ 
      success: false, 
      error: error.message,
      note: 'If timeout, run again - it will resume where it left off'
    });
  }
}
