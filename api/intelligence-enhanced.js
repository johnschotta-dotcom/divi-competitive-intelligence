/**
 * DEBUG VERSION - Shows what's failing
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function analyzeCompetitor(comp) {
  const logs = [];
  try {
    logs.push(`Analyzing ${comp.name}...`);
    
    const response = await fetch(comp.website, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    logs.push(`Fetch status: ${response.status}`);
    
    const html = await response.text();
    const content = html.substring(0, 1000);
    logs.push(`Content: ${content.length} chars`);

    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `${comp.name}: ${content}\n\nReturn only JSON: {"summary":"what they do","risk":50,"strengths":["s1"],"weaknesses":["w1"]}`,
      }],
    });

    logs.push(`Claude response blocks: ${message.content.length}`);

    let text = null;
    for (const block of message.content) {
      logs.push(`Block type: ${block.type}`);
      if (block.type === 'text') {
        text = block.text;
        break;
      }
    }
    
    if (!text) {
      logs.push('ERROR: No text block found');
      return { success: false, logs };
    }

    logs.push(`Text: "${text.substring(0, 100)}"`);

    const jsonMatch = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (!jsonMatch) {
      logs.push(`ERROR: No JSON in response`);
      return { success: false, logs };
    }
    
    const data = JSON.parse(jsonMatch[0]);
    logs.push(`Parsed JSON: risk=${data.risk}`);
    return { success: true, data, logs };

  } catch (error) {
    logs.push(`EXCEPTION: ${error.message}`);
    return { success: false, logs, error: error.message };
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
    const debugLogs = [];

    for (const comp of toAnalyze) {
      const result = await analyzeCompetitor(comp);
      debugLogs.push({ competitor: comp.name, ...result });

      if (!result.success || !result.data) continue;

      const data = result.data;

      await supabase.from('competitor_profiles').delete().eq('competitor_id', comp.id);
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
      total: allCompetitors?.length,
      already_analyzed: analyzedIds?.length,
      remaining: toAnalyze.length,
      debug: debugLogs
    });
  } catch (error) {
    res.status(200).json({ success: false, error: error.message });
  }
}
