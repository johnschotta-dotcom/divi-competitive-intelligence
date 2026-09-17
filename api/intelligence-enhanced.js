/**
 * IMPROVED VERSION - Skips already analyzed competitors
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function analyzeCompetitor(comp) {
  try {
    const response = await fetch(comp.website, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    const html = await response.text();
    const content = html.substring(0, 1000);

    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `${comp.name}: ${content}\n\nReturn only JSON: {"summary":"what they do","risk":50,"strengths":["s1"],"weaknesses":["w1"]}`,
      }],
    });

    let text = null;
    for (const block of message.content) {
      if (block.type === 'text') {
        text = block.text;
        break;
      }
    }
    
    if (!text) return null;
    const jsonMatch = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (!jsonMatch) return null;
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    // Get competitors WITHOUT existing profiles
    const { data: allCompetitors } = await supabase
      .from('competitors')
      .select('*')
      .eq('status', 'active');

    const { data: analyzedIds } = await supabase
      .from('competitor_profiles')
      .select('competitor_id');

    const analyzedSet = new Set(analyzedIds?.map(a => a.competitor_id) || []);
    const toAnalyze = allCompetitors?.filter(c => !analyzedSet.has(c.id)).slice(0, 3) || [];

    console.log(`Total competitors: ${allCompetitors?.length}, Already analyzed: ${analyzedIds?.length}, To analyze: ${toAnalyze.length}`);

    let analyzed = 0;

    for (const comp of toAnalyze) {
      const data = await analyzeCompetitor(comp);
      if (!data) continue;

      // Delete existing
      await supabase.from('competitor_profiles').delete().eq('competitor_id', comp.id);
      
      // Insert new
      await supabase.from('competitor_profiles').insert({
        competitor_id: comp.id,
        overall_summary: data.summary || 'N/A',
        target_audience: 'Investors',
        primary_value_prop: data.summary || 'N/A',
        business_model: 'N/A',
        risk_score: data.risk || 50,
        threat_to_divi: data.risk > 70 ? 'critical' : data.risk > 50 ? 'high' : 'medium',
        analyzed_at: new Date(),
      });

      // Strengths
      if (data.strengths && data.strengths.length > 0) {
        await supabase.from('competitor_strengths').delete().eq('competitor_id', comp.id);
        await supabase.from('competitor_strengths').insert(
          data.strengths.map(s => ({
            competitor_id: comp.id,
            strength_title: s,
            description: s,
            why_its_strong: 'Competitive advantage',
            competitive_advantage_level: 'medium',
          }))
        );
      }

      // Weaknesses
      if (data.weaknesses && data.weaknesses.length > 0) {
        await supabase.from('competitor_weaknesses').delete().eq('competitor_id', comp.id);
        await supabase.from('competitor_weaknesses').insert(
          data.weaknesses.map(w => ({
            competitor_id: comp.id,
            weakness_title: w,
            description: w,
            why_its_weak: 'Gap in offering',
            opportunity_level: 'medium',
            divi_advantage: `Divi can win on ${w}`,
          }))
        );
      }

      analyzed++;
    }

    res.status(200).json({ 
      success: true, 
      analyzed, 
      total_competitors: allCompetitors?.length,
      already_analyzed: analyzedIds?.length,
      remaining: toAnalyze.length
    });
  } catch (error) {
    res.status(200).json({ success: false, error: error.message });
  }
}
