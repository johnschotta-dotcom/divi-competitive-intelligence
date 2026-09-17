/**
 * DEBUG VERSION - Track JSON extraction
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function extractJSON(text) {
  console.log(`Raw text (first 200): "${text.substring(0, 200)}"`);
  
  // Remove markdown code blocks
  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  console.log(`After removing markdown: "${text.substring(0, 200)}"`);
  
  // Find the first { and last }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  console.log(`Start: ${start}, End: ${end}`);
  
  if (start === -1 || end === -1 || end <= start) {
    console.log('ERROR: No valid { } found');
    return null;
  }
  
  try {
    const jsonStr = text.substring(start, end + 1);
    console.log(`Extracted JSON string (first 200): "${jsonStr.substring(0, 200)}"`);
    const parsed = JSON.parse(jsonStr);
    console.log(`Successfully parsed JSON`);
    return parsed;
  } catch (e) {
    console.log(`JSON parse error: ${e.message}`);
    return null;
  }
}

async function analyzeCompetitor(comp) {
  try {
    console.log(`\n=== Analyzing ${comp.name} ===`);
    
    const response = await fetch(comp.website, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    const html = await response.text();
    const content = html.substring(0, 1000);
    console.log(`Fetched: ${html.length} chars`);

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
    
    if (!text) {
      console.log('No text block');
      return null;
    }
    
    console.log(`Text received: ${text.length} chars`);
    const data = extractJSON(text);
    console.log(`Extraction result: ${data ? 'SUCCESS' : 'FAILED'}`);
    return data;
  } catch (error) {
    console.error(`Exception: ${error.message}`);
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
    const toAnalyze = allCompetitors?.filter(c => !analyzedSet.has(c.id)).slice(0, 1) || [];

    console.log(`To analyze: ${toAnalyze.map(c => c.name).join(', ')}`);

    let analyzed = 0;

    for (const comp of toAnalyze) {
      const data = await analyzeCompetitor(comp);
      if (!data) {
        console.log(`Skipping ${comp.name} - no data`);
        continue;
      }

      console.log(`Storing ${comp.name}...`);

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
            strength_title: typeof s === 'string' ? s : s.title || 'Strength',
            description: typeof s === 'string' ? s : s.description || '',
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
            weakness_title: typeof w === 'string' ? w : w.title || 'Weakness',
            description: typeof w === 'string' ? w : w.description || '',
            why_its_weak: 'Gap in offering',
            opportunity_level: 'medium',
            divi_advantage: `Divi can win on ${typeof w === 'string' ? w : w.title}`,
          }))
        );
      }

      analyzed++;
    }

    res.status(200).json({ 
      success: true, 
      analyzed
    });
  } catch (error) {
    res.status(200).json({ success: false, error: error.message });
  }
}
