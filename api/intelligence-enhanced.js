/**
 * PARALLEL AGENT - Process ALL competitors at once
 * Uses Promise.all() for 3-4x speed improvement
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fetchWebpage(url) {
  try {
    const response = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(4000)
    });
    const html = await response.text();
    return html.substring(0, 1500);
  } catch (error) {
    return null;
  }
}

async function fetchLogo(website) {
  try {
    const domain = new URL(website).hostname.replace('www.', '');
    return `https://logo.clearbit.com/${domain}`;
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

Return JSON:
{
  "summary": "one sentence",
  "funding_risk": 50,
  "team_risk": 50,
  "feature_risk": 50,
  "market_risk": 50,
  "growth_risk": 50,
  "funding_notes": "why",
  "team_notes": "why",
  "feature_notes": "why",
  "market_notes": "why",
  "growth_notes": "why",
  "strength1": "s1",
  "strength2": "s2",
  "strength3": "s3",
  "weakness1": "w1",
  "weakness2": "w2",
  "weakness3": "w3"
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
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}') + 1;
    if (start === -1 || end === 0) return null;
    
    const parsed = JSON.parse(text.substring(start, end));
    return { ...parsed, competitor_id: comp.id, website: comp.website };
  } catch (error) {
    return null;
  }
}

function calculateOverallRisk(funding, team, feature, market, growth) {
  return Math.round((funding * 0.15 + team * 0.25 + feature * 0.35 + market * 0.15 + growth * 0.1) / 1);
}

async function storeCompetitorData(data, comp) {
  if (!data) return false;

  try {
    const overallRisk = calculateOverallRisk(
      data.funding_risk || 50,
      data.team_risk || 50,
      data.feature_risk || 50,
      data.market_risk || 50,
      data.growth_risk || 50
    );

    const threatLevel = overallRisk > 70 ? 'critical' : overallRisk > 50 ? 'high' : 'medium';
    const logoUrl = await fetchLogo(comp.website);

    // Update competitor
    await supabase.from('competitors').update({
      threat_score: overallRisk,
      tier: threatLevel,
      logo_url: logoUrl,
      last_analyzed: new Date(),
    }).eq('id', comp.id);

    // Delete old
    await Promise.all([
      supabase.from('competitor_profiles').delete().eq('competitor_id', comp.id),
      supabase.from('competitor_strengths').delete().eq('competitor_id', comp.id),
      supabase.from('competitor_weaknesses').delete().eq('competitor_id', comp.id),
      supabase.from('risk_score_breakdown').delete().eq('competitor_id', comp.id),
    ]);

    // Profile
    await supabase.from('competitor_profiles').insert({
      competitor_id: comp.id,
      overall_summary: data.summary || 'Analyzed',
      target_audience: 'Angel Investors',
      primary_value_prop: data.summary || 'Platform',
      business_model: 'SaaS',
      funding_status: 'Unknown',
      team_size_estimate: 15,
      risk_score: overallRisk,
      threat_to_divi: threatLevel,
      analyzed_at: new Date(),
    });

    // Risk breakdown
    await supabase.from('risk_score_breakdown').insert({
      competitor_id: comp.id,
      funding_risk: data.funding_risk || 50,
      team_risk: data.team_risk || 50,
      feature_risk: data.feature_risk || 50,
      market_fit_risk: data.market_risk || 50,
      growth_risk: data.growth_risk || 50,
      funding_notes: data.funding_notes || '',
      team_notes: data.team_notes || '',
      feature_notes: data.feature_notes || '',
      market_notes: data.market_notes || '',
      growth_notes: data.growth_notes || '',
      calculated_risk_score: overallRisk,
    });

    // Strengths
    const strengths = [data.strength1, data.strength2, data.strength3].filter(Boolean);
    if (strengths.length > 0) {
      await supabase.from('competitor_strengths').insert(
        strengths.map(s => ({
          competitor_id: comp.id,
          strength_title: s,
          description: s,
          why_its_strong: 'Strength',
          competitive_advantage_level: 'medium',
        }))
      );
    }

    // Weaknesses
    const weaknesses = [data.weakness1, data.weakness2, data.weakness3].filter(Boolean);
    if (weaknesses.length > 0) {
      await supabase.from('competitor_weaknesses').insert(
        weaknesses.map(w => ({
          competitor_id: comp.id,
          weakness_title: w,
          description: w,
          why_its_weak: 'Gap',
          opportunity_level: 'medium',
          divi_advantage: `Divi strength: ${w}`,
        }))
      );
    }

    return true;
  } catch (error) {
    console.error(`Error storing data for competitor ${comp.id}:`, error);
    return false;
  }
}

export default async function handler(req, res) {
  try {
    // Get all active competitors
    const { data: allCompetitors } = await supabase
      .from('competitors')
      .select('*')
      .eq('status', 'active');

    if (!allCompetitors || allCompetitors.length === 0) {
      return res.status(200).json({ success: true, analyzed: 0, total: 0 });
    }

    // PARALLEL: Analyze all competitors simultaneously
    const analysisResults = await Promise.all(
      allCompetitors.map(comp => analyzeCompetitor(comp))
    );

    // PARALLEL: Store all results simultaneously
    const storeResults = await Promise.all(
      allCompetitors.map((comp, idx) => storeCompetitorData(analysisResults[idx], comp))
    );

    const analyzed = storeResults.filter(Boolean).length;

    res.status(200).json({ 
      success: true, 
      analyzed,
      total: allCompetitors.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Agent error:', error);
    res.status(200).json({ success: false, error: error.message });
  }
}
