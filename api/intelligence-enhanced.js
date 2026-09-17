/**
 * ROBUST AGENT - Better data extraction
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
    const html = await response.text();
    return html.substring(0, 1500);
  } catch (error) {
    return null;
  }
}

async function analyzeCompetitor(comp) {
  try {
    const content = await fetchWebpage(comp.website);
    if (!content) return null;

    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `${comp.name}: ${content}

Return JSON with these exact fields:
{
  "summary": "one sentence",
  "risk": 50,
  "funding": "Series A or unknown",
  "team": 15,
  "strength1": "first strength",
  "strength2": "second strength", 
  "strength3": "third strength",
  "weakness1": "first weakness",
  "weakness2": "second weakness",
  "weakness3": "third weakness",
  "risk1": "risk one",
  "risk2": "risk two",
  "risk3": "risk three"
}`,
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
    
    // Extract JSON
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}') + 1;
    if (start === -1 || end === 0) return null;
    
    const data = JSON.parse(text.substring(start, end));
    return data;
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const { data: allCompetitors } = await supabase
      .from('competitors')
      .select('*')
      .eq('status', 'active')
      .limit(4);

    let analyzed = 0;

    for (const comp of allCompetitors || []) {
      const data = await analyzeCompetitor(comp);
      if (!data) continue;

      // Store profile
      await supabase.from('competitor_profiles').delete().eq('competitor_id', comp.id);
      await supabase.from('competitor_profiles').insert({
        competitor_id: comp.id,
        overall_summary: data.summary || 'Analyzed',
        target_audience: 'Angel Investors',
        primary_value_prop: data.summary || 'Platform',
        business_model: 'SaaS',
        funding_status: data.funding || 'Unknown',
        team_size_estimate: data.team || 15,
        risk_score: Math.min(100, Math.max(0, data.risk || 50)),
        threat_to_divi: data.risk > 70 ? 'critical' : data.risk > 50 ? 'high' : data.risk > 30 ? 'medium' : 'low',
        analyzed_at: new Date(),
      });

      // Strengths
      await supabase.from('competitor_strengths').delete().eq('competitor_id', comp.id);
      const strengths = [];
      if (data.strength1) strengths.push(data.strength1);
      if (data.strength2) strengths.push(data.strength2);
      if (data.strength3) strengths.push(data.strength3);
      
      if (strengths.length > 0) {
        await supabase.from('competitor_strengths').insert(
          strengths.map(s => ({
            competitor_id: comp.id,
            strength_title: s,
            description: s,
            why_its_strong: 'Key competitive strength',
            competitive_advantage_level: 'medium',
          }))
        );
      }

      // Weaknesses
      await supabase.from('competitor_weaknesses').delete().eq('competitor_id', comp.id);
      const weaknesses = [];
      if (data.weakness1) weaknesses.push(data.weakness1);
      if (data.weakness2) weaknesses.push(data.weakness2);
      if (data.weakness3) weaknesses.push(data.weakness3);
      
      if (weaknesses.length > 0) {
        await supabase.from('competitor_weaknesses').insert(
          weaknesses.map(w => ({
            competitor_id: comp.id,
            weakness_title: w,
            description: w,
            why_its_weak: 'Gap or limitation',
            opportunity_level: 'medium',
            divi_advantage: `Divi advantage: ${w}`,
          }))
        );
      }

      // Risks
      await supabase.from('risk_assessment').delete().eq('competitor_id', comp.id);
      const risks = [];
      if (data.risk1) risks.push(data.risk1);
      if (data.risk2) risks.push(data.risk2);
      if (data.risk3) risks.push(data.risk3);
      
      if (risks.length > 0) {
        await supabase.from('risk_assessment').insert(
          risks.map(r => ({
            competitor_id: comp.id,
            risk_category: r.includes('fund') ? 'funding' : r.includes('product') ? 'product' : 'market',
            risk_level: data.risk > 70 ? 'critical' : data.risk > 50 ? 'high' : 'medium',
            description: r,
            potential_impact: 'Competitive threat',
            mitigation_strategy: 'Monitor and respond',
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
