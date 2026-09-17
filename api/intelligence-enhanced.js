/**
 * Enhanced Competitive Intelligence Agent
 * Performs deep analysis: strengths, weaknesses, risk assessment
 * Deploy to: Vercel Functions (api/intelligence-enhanced.js)
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Fetch webpage
async function fetchWebpage(url) {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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
    return null;
  }
}

// Deep competitive analysis
async function analyzeCompetitorProfile(competitor) {
  const pageContent = await fetchWebpage(competitor.website);
  if (!pageContent) return null;

  const message = await anthropic.messages.create({
    model: 'claude-opus-5',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are a competitive intelligence expert analyzing ${competitor.name} for Divi (divi.fund), an AI-native angel investor platform with:
- Portfolio tracking from cap tables (Carta, AngelList, Cake, Sydecar)
- AI Intelligence Dashboard for analyzing founder updates
- Syndicate creation tools at $99/mo
- Investor education content
- Hustle Fund partnership for deal flow

Analyze this competitor deeply:

Website Content:
${pageContent}

Return ONLY valid JSON (no markdown, no extra text):
{
  "overall_summary": "1-2 sentence summary of what they do",
  "target_audience": "Who they target",
  "primary_value_prop": "Main value proposition",
  "business_model": "How they make money",
  "team_credibility": "Assessment of founding team credibility (0-100)",
  "strengths": [
    {
      "title": "Feature/capability name",
      "description": "What it is",
      "why_strong": "Why it's strong",
      "competitive_advantage": "high/medium/low - how much of an advantage vs Divi"
    }
  ],
  "weaknesses": [
    {
      "title": "Gap or weak area",
      "description": "What it is",
      "why_weak": "Why it's weak",
      "opportunity": "high/medium/low - how much Divi can exploit this"
    }
  ],
  "risk_to_divi": {
    "overall_risk": "critical/high/medium/low",
    "risk_score": 0-100,
    "reasoning": "Why they are/aren't a threat",
    "key_risks": ["risk1", "risk2"],
    "mitigation": "What Divi should do"
  }
}`,
    }],
  });

  try {
    const jsonMatch = message.content[0].text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
  } catch (error) {
    return null;
  }
}

// Store profile and analysis in database
async function storeCompetitorProfile(competitor, analysis) {
  if (!analysis) return;

  try {
    // Store main profile
    const { data: profile, error: profileError } = await supabase
      .from('competitor_profiles')
      .upsert({
        competitor_id: competitor.id,
        overall_summary: analysis.overall_summary,
        target_audience: analysis.target_audience,
        primary_value_prop: analysis.primary_value_prop,
        business_model: analysis.business_model,
        credibility_score: analysis.team_credibility,
        risk_score: analysis.risk_to_divi?.risk_score || 50,
        threat_to_divi: analysis.risk_to_divi?.overall_risk || 'medium',
        risk_reasoning: analysis.risk_to_divi?.reasoning,
        analyzed_at: new Date(),
      }, { onConflict: 'competitor_id' });

    if (profileError) console.error('Error storing profile:', profileError);

    // Store strengths
    if (analysis.strengths && analysis.strengths.length > 0) {
      const strengthsData = analysis.strengths.map(s => ({
        competitor_id: competitor.id,
        strength_title: s.title,
        description: s.description,
        why_its_strong: s.why_strong,
        competitive_advantage_level: s.competitive_advantage,
      }));

      // Delete old strengths first
      await supabase.from('competitor_strengths').delete().eq('competitor_id', competitor.id);

      const { error: strengthsError } = await supabase.from('competitor_strengths').insert(strengthsData);
      if (strengthsError) console.error('Error storing strengths:', strengthsError);
    }

    // Store weaknesses
    if (analysis.weaknesses && analysis.weaknesses.length > 0) {
      const weaknessesData = analysis.weaknesses.map(w => ({
        competitor_id: competitor.id,
        weakness_title: w.title,
        description: w.description,
        why_its_weak: w.why_weak,
        opportunity_level: w.opportunity,
        divi_advantage: `Divi can exploit this by being stronger in ${w.title}`,
      }));

      // Delete old weaknesses first
      await supabase.from('competitor_weaknesses').delete().eq('competitor_id', competitor.id);

      const { error: weaknessesError } = await supabase.from('competitor_weaknesses').insert(weaknessesData);
      if (weaknessesError) console.error('Error storing weaknesses:', weaknessesError);
    }

    // Store risk assessment
    if (analysis.risk_to_divi?.key_risks) {
      const riskData = analysis.risk_to_divi.key_risks.map(risk => ({
        competitor_id: competitor.id,
        risk_category: 'competitive_positioning',
        risk_level: analysis.risk_to_divi.overall_risk,
        description: risk,
        potential_impact: 'Threat to Divi market share',
        mitigation_strategy: analysis.risk_to_divi.mitigation,
      }));

      const { error: riskError } = await supabase.from('risk_assessment').insert(riskData);
      if (riskError) console.error('Error storing risk:', riskError);
    }

    // Update competitor threat score
    await supabase
      .from('competitors')
      .update({
        threat_score: analysis.risk_to_divi?.risk_score || 50,
        tier: analysis.risk_to_divi?.overall_risk || 'medium',
        last_analyzed: new Date(),
      })
      .eq('id', competitor.id);

  } catch (error) {
    console.error('Error in storeCompetitorProfile:', error);
  }
}

// Main handler
export default async function handler(req, res) {
  try {
    console.log('🔬 Starting Enhanced Competitive Analysis...');

    const { data: competitors } = await supabase
      .from('competitors')
      .select('*')
      .eq('status', 'active');

    let analyzed = 0;
    for (const competitor of competitors || []) {
      console.log(`Analyzing ${competitor.name}...`);
      
      const analysis = await analyzeCompetitorProfile(competitor);
      if (analysis) {
        await storeCompetitorProfile(competitor, analysis);
        analyzed++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log('✅ Enhanced analysis complete!');
    
    res.status(200).json({
      success: true,
      message: 'Enhanced competitive analysis completed',
      competitors_analyzed: analyzed,
      timestamp: new Date(),
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
