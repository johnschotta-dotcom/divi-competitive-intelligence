/**
 * NEXT LEVEL AGENT - Risk breakdown + Logos + DIVI comparison
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function fetchWebpage(url) {
  try {
    const response = await fetch(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(5000)
    });
    const html = await response.text();
    return html.substring(0, 2000);
  } catch (error) {
    return null;
  }
}

async function fetchLinkedIn(companyName) {
  try {
    const linkedinUrl = `https://www.linkedin.com/company/${companyName.toLowerCase().replace(/\s+/g, '-')}`;
    const response = await fetch(linkedinUrl, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(5000)
    });
    const html = await response.text();
    return html.substring(0, 2000);
  } catch (error) {
    return null;
  }
}

async function fetchLogo(companyName, website) {
  try {
    // Try common logo CDN
    const domain = new URL(website).hostname.replace('www.', '');
    const logoUrls = [
      `https://logo.clearbit.com/${domain}`,
      `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
    ];
    return logoUrls[0]; // Return Clearbit URL (most reliable)
  } catch (error) {
    return null;
  }
}

async function analyzeCompetitor(comp) {
  try {
    const websiteContent = await fetchWebpage(comp.website);
    const linkedinContent = await fetchLinkedIn(comp.name);
    const logoUrl = await fetchLogo(comp.name, comp.website);
    
    if (!websiteContent && !linkedinContent) return null;

    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Analyze ${comp.name}:

WEBSITE:
${websiteContent || 'Not available'}

LINKEDIN:
${linkedinContent || 'Not available'}

Return JSON with DETAILED risk breakdown (each 0-100):
{
  "summary": "one sentence",
  
  "funding_risk": 50,
  "funding_notes": "Why this risk level (seed/unfunded/series A etc)",
  
  "team_risk": 50,
  "team_notes": "Team size, experience, credibility risk",
  
  "feature_risk": 50,
  "feature_notes": "How complete are their features vs market needs",
  
  "market_fit_risk": 50,
  "market_notes": "How well positioned in market",
  
  "growth_risk": 50,
  "growth_notes": "Growth trajectory and momentum",
  
  "strength1": "strength",
  "strength2": "strength", 
  "strength3": "strength",
  
  "weakness1": "weakness",
  "weakness2": "weakness",
  "weakness3": "weakness"
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
    
    const data = JSON.parse(text.substring(start, end));
    data.logo_url = logoUrl;
    return data;
  } catch (error) {
    return null;
  }
}

function calculateOverallRisk(funding, team, feature, market, growth) {
  // Weighted average: team and features most important
  return Math.round(
    (funding * 0.15 + team * 0.25 + feature * 0.35 + market * 0.15 + growth * 0.1) / 1
  );
}

export default async function handler(req, res) {
  try {
    const { data: allCompetitors } = await supabase
      .from('competitors')
      .select('*')
      .eq('status', 'active');

    if (!allCompetitors || allCompetitors.length === 0) {
      return res.status(200).json({ success: true, analyzed: 0, total: 0 });
    }

    let analyzed = 0;

    for (const comp of allCompetitors) {
      const data = await analyzeCompetitor(comp);
      if (!data) continue;

      // Calculate overall risk
      const overallRisk = calculateOverallRisk(
        data.funding_risk,
        data.team_risk,
        data.feature_risk,
        data.market_fit_risk,
        data.growth_risk
      );

      const threatLevel = overallRisk > 70 ? 'critical' : overallRisk > 50 ? 'high' : overallRisk > 30 ? 'medium' : 'low';

      // Update competitors table
      await supabase.from('competitors').update({
        threat_score: overallRisk,
        tier: threatLevel,
        logo_url: data.logo_url,
        last_analyzed: new Date(),
      }).eq('id', comp.id);

      // Delete old data
      await supabase.from('competitor_profiles').delete().eq('competitor_id', comp.id);
      await supabase.from('competitor_strengths').delete().eq('competitor_id', comp.id);
      await supabase.from('competitor_weaknesses').delete().eq('competitor_id', comp.id);
      await supabase.from('risk_assessment').delete().eq('competitor_id', comp.id);
      await supabase.from('risk_score_breakdown').delete().eq('competitor_id', comp.id);

      // Store profile
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

      // Store risk breakdown
      await supabase.from('risk_score_breakdown').insert({
        competitor_id: comp.id,
        funding_risk: data.funding_risk,
        team_risk: data.team_risk,
        feature_risk: data.feature_risk,
        market_fit_risk: data.market_fit_risk,
        growth_risk: data.growth_risk,
        funding_notes: data.funding_notes,
        team_notes: data.team_notes,
        feature_notes: data.feature_notes,
        market_notes: data.market_notes,
        growth_notes: data.growth_notes,
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
            why_its_strong: 'Key competitive strength',
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
            why_its_weak: 'Gap or limitation',
            opportunity_level: 'medium',
            divi_advantage: `Divi advantage: ${w}`,
          }))
        );
      }

      analyzed++;
    }

    res.status(200).json({ success: true, analyzed, total: allCompetitors.length });
  } catch (error) {
    res.status(200).json({ success: false, error: error.message });
  }
}
