/**
 * FULL VERSION - With strengths and weaknesses
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
    const content = html.substring(0, 800);

    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `${comp.name}: ${content}

Return ONLY this JSON format:
{"summary":"one sentence","risk":50,"strengths":["strength 1","strength 2"],"weaknesses":["weakness 1","weakness 2"]}`,
      }],
    });

    let text = '';
    for (const block of message.content) {
      if (block.type === 'text') {
        text = block.text;
        break;
      }
    }
    
    if (!text) return null;

    // Remove all backticks and markdown
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}') + 1;
    
    if (start === -1 || end === 0) return null;
    
    const jsonStr = text.substring(start, end);
    return JSON.parse(jsonStr);
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const { data: allCompetitors } = await supabase
      .from('competitors')
      .select('*')
      .eq('status', 'active');

    const { data: analyzedIds } = await supabase
      .from('competitor_profiles')
      .select('competitor_id');

    const analyzedSet = new Set(analyzedIds?.map(a => a.competitor_id) || []);
    const toAnalyze = allCompetitors?.filter(c => !analyzedSet.has(c.id)).slice(0, 3) || [];

    let analyzed = 0;

    for (const comp of toAnalyze) {
      const data = await analyzeCompetitor(comp);
      if (!data) continue;

      // Delete old data
      await supabase.from('competitor_profiles').delete().eq('competitor_id', comp.id);
      await supabase.from('competitor_strengths').delete().eq('competitor_id', comp.id);
      await supabase.from('competitor_weaknesses').delete().eq('competitor_id', comp.id);

      // Insert profile
      await supabase.from('competitor_profiles').insert({
        competitor_id: comp.id,
        overall_summary: data.summary || 'Competitor analyzed',
        target_audience: 'Investors',
        primary_value_prop: data.summary || 'Investment platform',
        business_model: 'N/A',
        risk_score: Math.min(100, Math.max(0, data.risk || 50)),
        threat_to_divi: data.risk > 70 ? 'critical' : data.risk > 50 ? 'high' : 'medium',
        analyzed_at: new Date(),
      });

      // Insert strengths
      if (data.strengths && Array.isArray(data.strengths) && data.strengths.length > 0) {
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

      // Insert weaknesses
      if (data.weaknesses && Array.isArray(data.weaknesses) && data.weaknesses.length > 0) {
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

    res.status(200).json({ success: true, analyzed, total: allCompetitors?.length });
  } catch (error) {
    res.status(200).json({ success: false, error: error.message });
  }
}
