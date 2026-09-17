/**
 * ENHANCED AGENT - Rich data from multiple sources
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
    return html.substring(0, 2000);
  } catch (error) {
    return null;
  }
}

async function searchCompetitor(name) {
  try {
    const response = await fetch(
      `https://www.google.com/search?q=${encodeURIComponent(name + ' funding OR news OR announcement')}`
    );
    return await response.text();
  } catch (error) {
    return null;
  }
}

async function analyzeCompetitor(comp) {
  try {
    const websiteContent = await fetchWebpage(comp.website);
    if (!websiteContent) return null;

    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `${comp.name}: ${websiteContent}

Return JSON:
{"summary":"one sentence","risk":50,"funding":"Series A or unfunded?","team_size":"estimate?","strengths":["s1","s2"],"weaknesses":["w1","w2"],"recent_news":"any major announcements?","key_risks":["funding threat","feature threat","market threat"]}`,
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
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}') + 1;
    
    if (start === -1 || end === 0) return null;
    
    return JSON.parse(text.substring(start, end));
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

    // Also re-analyze existing for richer data
    const toReanalyze = allCompetitors?.filter(c => analyzedSet.has(c.id)).slice(0, 2) || [];
    const targets = [...toAnalyze, ...toReanalyze];

    let analyzed = 0;

    for (const comp of targets) {
      const data = await analyzeCompetitor(comp);
      if (!data) continue;

      // Delete old
      await supabase.from('competitor_profiles').delete().eq('competitor_id', comp.id);
      await supabase.from('competitor_strengths').delete().eq('competitor_id', comp.id);
      await supabase.from('competitor_weaknesses').delete().eq('competitor_id', comp.id);
      await supabase.from('risk_assessment').delete().eq('competitor_id', comp.id);
      await supabase.from('research_links').delete().eq('competitor_id', comp.id);

      // Profile
      await supabase.from('competitor_profiles').insert({
        competitor_id: comp.id,
        overall_summary: data.summary || 'Analyzed',
        target_audience: 'Investors',
        primary_value_prop: data.summary || 'Platform',
        business_model: 'SaaS',
        funding_status: data.funding || 'Unknown',
        team_size_estimate: data.team_size ? parseInt(data.team_size) || 10 : 10,
        risk_score: Math.min(100, Math.max(0, data.risk || 50)),
        threat_to_divi: data.risk > 70 ? 'critical' : data.risk > 50 ? 'high' : 'medium',
        analyzed_at: new Date(),
      });

      // Strengths
      if (data.strengths?.length > 0) {
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
      if (data.weaknesses?.length > 0) {
        await supabase.from('competitor_weaknesses').insert(
          data.weaknesses.map(w => ({
            competitor_id: comp.id,
            weakness_title: w,
            description: w,
            why_its_weak: 'Gap in offering',
            opportunity_level: 'medium',
            divi_advantage: `Divi advantage: ${w}`,
          }))
        );
      }

      // Risks
      if (data.key_risks?.length > 0) {
        await supabase.from('risk_assessment').insert(
          data.key_risks.map(risk => ({
            competitor_id: comp.id,
            risk_category: risk.includes('fund') ? 'funding' : risk.includes('feature') ? 'features' : 'market',
            risk_level: data.risk > 70 ? 'critical' : 'high',
            description: risk,
            potential_impact: 'Threat to Divi market position',
            mitigation_strategy: 'Monitor and respond with feature development',
          }))
        );
      }

      // Research link
      await supabase.from('research_links').insert({
        competitor_id: comp.id,
        link_type: 'website',
        url: comp.website,
        title: comp.name,
        description: data.recent_news || 'Company website',
      });

      analyzed++;
    }

    res.status(200).json({ success: true, analyzed, total: allCompetitors?.length });
  } catch (error) {
    res.status(200).json({ success: false, error: error.message });
  }
}
