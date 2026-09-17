/**
 * ROBUST VERSION - Better JSON handling + faster
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fetchWebpage(url) {
  try {
    const response = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;
    const html = await response.text();
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.substring(0, 1500);
  } catch (error) {
    return null;
  }
}

async function analyzeCompetitor(competitor) {
  try {
    const content = await fetchWebpage(competitor.website);
    if (!content) return null;

    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Analyze: ${competitor.name}
${content}

Return ONLY this exact JSON format, no extra text:
{"summary":"what they do","audience":"target","risk":50,"strengths":["strength1"],"weaknesses":["weakness1"],"mitigation":"what divi should do"}`,
      }],
    });

    let text = message.content[0].text || '';
    text = text.trim();
    
    // Remove markdown code blocks if present
    if (text.startsWith('```')) {
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    // Extract JSON
    const jsonMatch = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (!jsonMatch) return null;

    const data = JSON.parse(jsonMatch[0]);
    
    return {
      overall_summary: data.summary || 'N/A',
      target_audience: data.audience || 'N/A',
      primary_value_prop: data.audience || 'N/A',
      business_model: 'N/A',
      team_credibility: 50,
      strengths: (data.strengths || []).map(s => ({
        title: s,
        description: s,
        why_its_strong: 'Competitive advantage',
        competitive_advantage: 'medium'
      })),
      weaknesses: (data.weaknesses || []).map(w => ({
        title: w,
        description: w,
        why_its_weak: 'Gap in offering',
        opportunity: 'medium'
      })),
      risk_to_divi: {
        overall_risk: data.risk > 70 ? 'high' : data.risk > 40 ? 'medium' : 'low',
        risk_score: data.risk || 50,
        reasoning: data.mitigation || 'Competitive threat',
        key_risks: [data.mitigation || 'Monitor'],
        mitigation: data.mitigation || 'Differentiate offerings'
      }
    };
  } catch (error) {
    console.error(`Analysis failed for ${competitor.name}: ${error.message}`);
    return null;
  }
}

async function storeProfile(competitor, analysis) {
  if (!analysis) return false;

  try {
    // Store profile
    await supabase.from('competitor_profiles').upsert({
      competitor_id: competitor.id,
      overall_summary: analysis.overall_summary,
      target_audience: analysis.target_audience,
      primary_value_prop: analysis.primary_value_prop,
      business_model: analysis.business_model,
      credibility_score: 50,
      risk_score: analysis.risk_to_divi.risk_score,
      threat_to_divi: analysis.risk_to_divi.overall_risk,
      analyzed_at: new Date(),
    }, { onConflict: 'competitor_id' });

    // Store strengths
    if (analysis.strengths.length > 0) {
      await supabase.from('competitor_strengths').delete().eq('competitor_id', competitor.id);
      await supabase.from('competitor_strengths').insert(
        analysis.strengths.map(s => ({
          competitor_id: competitor.id,
          strength_title: s.title,
          description: s.description,
          why_its_strong: s.why_its_strong,
          competitive_advantage_level: 'medium',
        }))
      );
    }

    // Store weaknesses
    if (analysis.weaknesses.length > 0) {
      await supabase.from('competitor_weaknesses').delete().eq('competitor_id', competitor.id);
      await supabase.from('competitor_weaknesses').insert(
        analysis.weaknesses.map(w => ({
          competitor_id: competitor.id,
          weakness_title: w.title,
          description: w.description,
          why_its_weak: w.why_its_weak,
          opportunity_level: 'medium',
          divi_advantage: `Divi can win on ${w.title}`,
        }))
      );
    }

    // Update competitor
    await supabase.from('competitors').update({
      threat_score: analysis.risk_to_divi.risk_score,
      tier: analysis.risk_to_divi.overall_risk,
    }).eq('id', competitor.id);

    return true;
  } catch (error) {
    console.error(`Store failed: ${error.message}`);
    return false;
  }
}

export default async function handler(req, res) {
  try {
    console.log('Starting analysis...');

    const { data: competitors } = await supabase
      .from('competitors')
      .select('*')
      .eq('status', 'active')
      .limit(3);

    let count = 0;
    for (const comp of competitors || []) {
      const analysis = await analyzeCompetitor(comp);
      if (analysis && await storeProfile(comp, analysis)) {
        count++;
        console.log(`✅ ${comp.name}`);
      } else {
        console.log(`❌ ${comp.name}`);
      }
    }

    res.status(200).json({ success: true, analyzed: count, total: competitors?.length });
  } catch (error) {
    res.status(200).json({ success: false, error: error.message });
  }
}
