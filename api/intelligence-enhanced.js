/**
 * FIXED VERSION - Better error handling
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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
    return text.substring(0, 3000);
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error.message);
    return null;
  }
}

async function analyzeCompetitorProfile(competitor) {
  try {
    const pageContent = await fetchWebpage(competitor.website);
    console.log(`Fetched ${competitor.name}: ${pageContent ? pageContent.length + ' chars' : 'NULL'}`);
    
    if (!pageContent) return null;

    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Analyze ${competitor.name} for Divi.

Website content:
${pageContent}

Respond ONLY with valid JSON (no markdown, no preamble):
{
  "overall_summary": "1 sentence summary",
  "target_audience": "who they target",
  "primary_value_prop": "main value proposition",
  "business_model": "how they make money",
  "team_credibility": 50,
  "strengths": [{"title": "Strength 1", "description": "Description", "why_strong": "Why it's strong", "competitive_advantage": "high"}],
  "weaknesses": [{"title": "Weakness 1", "description": "Description", "why_weak": "Why it's weak", "opportunity": "high"}],
  "risk_to_divi": {"overall_risk": "high", "risk_score": 50, "reasoning": "Why", "key_risks": ["risk1"], "mitigation": "What Divi should do"}
}`,
      }],
    });

    console.log(`Claude response type:`, message.content[0].type);
    console.log(`Claude response content keys:`, Object.keys(message.content[0]));
    
    // Get the text from Claude's response
    let responseText = '';
    if (message.content[0].type === 'text') {
      responseText = message.content[0].text;
    } else {
      console.error(`Unexpected content type: ${message.content[0].type}`);
      return null;
    }

    if (!responseText) {
      console.error(`No response text from Claude`);
      return null;
    }

    console.log(`Raw response (first 200 chars): ${responseText.substring(0, 200)}`);

    // Try to extract JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`No JSON found in response`);
      console.log(`Full response: ${responseText}`);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log(`✅ Parsed ${competitor.name}: strengths=${parsed.strengths?.length}, weaknesses=${parsed.weaknesses?.length}`);
    return parsed;
  } catch (error) {
    console.error(`❌ Analysis error for ${competitor.name}:`, error.message);
    console.error(`Stack:`, error.stack);
    return null;
  }
}

async function storeCompetitorProfile(competitor, analysis) {
  if (!analysis) {
    console.log(`Skipping ${competitor.name} - no analysis`);
    return false;
  }

  try {
    // 1. Store profile
    console.log(`Storing profile for ${competitor.name}...`);
    const { error: profileError } = await supabase.from('competitor_profiles').upsert({
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

    if (profileError) {
      console.error(`Profile error for ${competitor.name}:`, profileError);
      return false;
    }
    console.log(`✅ Profile stored for ${competitor.name}`);

    // 2. Store strengths
    if (analysis.strengths && analysis.strengths.length > 0) {
      console.log(`Storing ${analysis.strengths.length} strengths for ${competitor.name}...`);
      await supabase.from('competitor_strengths').delete().eq('competitor_id', competitor.id);
      
      const { error: strengthsError } = await supabase.from('competitor_strengths').insert(
        analysis.strengths.map(s => ({
          competitor_id: competitor.id,
          strength_title: s.title || 'Unknown',
          description: s.description || '',
          why_its_strong: s.why_strong || '',
          competitive_advantage_level: s.competitive_advantage || 'medium',
        }))
      );
      
      if (strengthsError) {
        console.error(`Strengths error for ${competitor.name}:`, strengthsError);
      } else {
        console.log(`✅ ${analysis.strengths.length} strengths stored`);
      }
    }

    // 3. Store weaknesses
    if (analysis.weaknesses && analysis.weaknesses.length > 0) {
      console.log(`Storing ${analysis.weaknesses.length} weaknesses for ${competitor.name}...`);
      await supabase.from('competitor_weaknesses').delete().eq('competitor_id', competitor.id);
      
      const { error: weaknessesError } = await supabase.from('competitor_weaknesses').insert(
        analysis.weaknesses.map(w => ({
          competitor_id: competitor.id,
          weakness_title: w.title || 'Unknown',
          description: w.description || '',
          why_its_weak: w.why_weak || '',
          opportunity_level: w.opportunity || 'medium',
          divi_advantage: `Divi advantage in ${w.title}`,
        }))
      );
      
      if (weaknessesError) {
        console.error(`Weaknesses error for ${competitor.name}:`, weaknessesError);
      } else {
        console.log(`✅ ${analysis.weaknesses.length} weaknesses stored`);
      }
    }

    // 4. Store risks
    if (analysis.risk_to_divi && analysis.risk_to_divi.key_risks && analysis.risk_to_divi.key_risks.length > 0) {
      console.log(`Storing ${analysis.risk_to_divi.key_risks.length} risks for ${competitor.name}...`);
      
      const { error: riskError } = await supabase.from('risk_assessment').insert(
        analysis.risk_to_divi.key_risks.map(risk => ({
          competitor_id: competitor.id,
          risk_category: 'competitive_positioning',
          risk_level: analysis.risk_to_divi.overall_risk || 'medium',
          description: risk || '',
          potential_impact: 'Threat to Divi market share',
          mitigation_strategy: analysis.risk_to_divi.mitigation || '',
        }))
      );
      
      if (riskError) {
        console.error(`Risk error for ${competitor.name}:`, riskError);
      } else {
        console.log(`✅ ${analysis.risk_to_divi.key_risks.length} risks stored`);
      }
    }

    return true;
  } catch (error) {
    console.error(`Store error for ${competitor.name}:`, error.message);
    return false;
  }
}

export default async function handler(req, res) {
  console.log('🔬 Starting Enhanced Analysis TEST...');

  try {
    const { data: competitors, error: fetchError } = await supabase
      .from('competitors')
      .select('*')
      .eq('status', 'active')
      .limit(1);

    if (fetchError) {
      console.error('Fetch competitors error:', fetchError);
      return res.status(500).json({ error: fetchError.message });
    }

    console.log(`Found ${competitors?.length} competitors`);

    let analyzed = 0;
    for (const competitor of competitors || []) {
      console.log(`\n--- Analyzing ${competitor.name} (ID: ${competitor.id}) ---`);
      const analysis = await analyzeCompetitorProfile(competitor);
      if (analysis) {
        const stored = await storeCompetitorProfile(competitor, analysis);
        if (stored) analyzed++;
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`\n✅ Complete: ${analyzed}/${competitors?.length} analyzed`);
    
    res.status(200).json({
      success: true,
      analyzed,
      total: competitors?.length,
    });

  } catch (error) {
    console.error('Top-level error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
