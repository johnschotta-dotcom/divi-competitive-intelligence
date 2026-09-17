/**
 * WORKING VERSION - Simple insert approach
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function analyzeCompetitor(comp) {
  try {
    // Fetch webpage
    const response = await fetch(comp.website, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    const html = await response.text();
    const content = html.substring(0, 1000);

    // Call Claude
    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `${comp.name}: ${content}\n\nReturn only JSON: {"summary":"what they do","risk":50,"strengths":["s1"],"weaknesses":["w1"]}`,
      }],
    });

    // Extract text (skip thinking blocks)
    let text = null;
    for (const block of message.content) {
      if (block.type === 'text') {
        text = block.text;
        break;
      }
    }
    
    if (!text) return null;

    // Parse JSON
    const jsonMatch = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (!jsonMatch) return null;
    
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error(`Error analyzing ${comp.name}: ${error.message}`);
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const { data: competitors } = await supabase
      .from('competitors')
      .select('*')
      .eq('status', 'active')
      .limit(3); // Process 3 at a time

    let analyzed = 0;

    for (const comp of competitors || []) {
      const data = await analyzeCompetitor(comp);
      if (!data) continue;

      // Delete existing profile
      await supabase.from('competitor_profiles').delete().eq('competitor_id', comp.id);
      
      // Insert new profile
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

      // Store strengths
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

      // Store weaknesses
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

    res.status(200).json({ success: true, analyzed, total: competitors?.length });
  } catch (error) {
    res.status(200).json({ success: false, error: error.message });
  }
}
