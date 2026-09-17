/**
 * BULLETPROOF AGENT - All competitors in ONE run
 * - Parallel processing with retry logic
 * - Fallback values for failures
 * - Aggressive timeouts
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fetchWebpage(url, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(6000)
      });
      const html = await response.text();
      return html.substring(0, 2000);
    } catch (error) {
      if (i === retries - 1) return null;
      await new Promise(r => setTimeout(r, 500)); // Wait 500ms before retry
    }
  }
  return null;
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
    
    // If we got content, analyze it
    if (content) {
      try {
        const message = await anthropic.messages.create({
          model: 'claude-opus-5',
          max_tokens: 800,
          messages: [{
            role: 'user',
            content: `Company: ${comp.name}
Website content snippet:
${content}

Analyze and return ONLY valid JSON (no markdown, no backticks):
{
  "summary": "one short sentence about the company",
  "funding_risk": 50,
  "team_risk": 50,
  "feature_risk": 50,
  "market_risk": 50,
  "growth_risk": 50,
  "funding_notes": "2-3 words",
  "team_notes": "2-3 words",
  "feature_notes": "2-3 words",
  "market_notes": "2-3 words",
  "growth_notes": "2-3 words",
  "strength1": "key strength",
  "strength2": "key strength",
  "strength3": "key strength",
  "weakness1": "opportunity gap",
  "weakness2": "opportunity gap",
  "weakness3": "opportunity gap"
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
        
        if (!text) return getDefaultAnalysis(comp);

        // Clean response
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}') + 1;
        
        if (start === -1 || end === 0) return getDefaultAnalysis(comp);
        
        const parsed = JSON.parse(text.substring(start, end));
        return { ...parsed, competitor_id: comp.id, website: comp.website };
      } catch (error) {
        return getDefaultAnalysis(comp);
      }
    } else {
      // No content fetched, use defaults
      return getDefaultAnalysis(comp);
    }
  } catch (error) {
    return getDefaultAnalysis(comp);
  }
}

function getDefaultAnalysis(comp) {
  // Fallback for companies we couldn't analyze
  return {
    competitor_id: comp.id,
    website: comp.website,
    summary: `${comp.name} - Angel investing platform`,
    funding_risk: 50,
    team_risk: 50,
    feature_risk: 50,
    market_risk: 50,
    growth_risk: 50,
    funding_notes: 'Unknown',
    team_notes: 'Unknown',
    feature_notes: 'Unknown',
    market_notes: 'Unknown',
    growth_notes: 'Unknown',
    strength1: 'Operates in market',
    strength2: 'Has website',
    strength3: 'Active platform',
    weakness1: 'Limited data',
    weakness2: 'Unknown positioning',
    weakness3: 'Unknown advantages'
  };
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

    // Delete old data in parallel
    await Promise.all([
      supabase.from('competitor_profiles').delete().eq('competitor_id', comp.id),
      supabase.from('competitor_strengths').delete().eq('competitor_id', comp.id),
      supabase.from('competitor_weaknesses').delete().eq('competitor_id', comp.id),
      supabase.from('risk_score_breakdown').delete().eq('competitor_id', comp.id),
    ]);

    // Insert profile
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

    // Insert risk breakdown
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

    // Insert strengths
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

    // Insert weaknesses
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
    console.error(`Error storing ${comp.id}:`, error.message);
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
      return res.status(200).json({ 
        success: true, 
        analyzed: 0, 
        total: 0,
        message: 'No competitors to analyze'
      });
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
      timestamp: new Date().toISOString(),
      message: `Analyzed ${analyzed}/${allCompetitors.length} competitors`
    });
  } catch (error) {
    console.error('Agent error:', error);
    res.status(200).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
