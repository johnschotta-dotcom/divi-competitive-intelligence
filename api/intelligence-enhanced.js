/**
 * ENHANCED AGENT - Includes LinkedIn company data
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
    // Try to fetch LinkedIn company page
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

async function analyzeCompetitor(comp) {
  try {
    const websiteContent = await fetchWebpage(comp.website);
    const linkedinContent = await fetchLinkedIn(comp.name);
    
    if (!websiteContent && !linkedinContent) return null;

    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1200,
      messages: [{
        role: 'user',
        content: `Analyze ${comp.name}:

WEBSITE:
${websiteContent || 'Not available'}

LINKEDIN:
${linkedinContent || 'Not available'}

Return JSON:
{
  "summary": "one sentence",
  "risk": 50,
  "funding": "Series A or unknown",
  "team": 15,
  "linkedin_employees": "estimate from LinkedIn or null",
  "linkedin_stage": "Series A, Funded, Startup, etc or null",
  "strength1": "first",
  "strength2": "second", 
  "strength3": "third",
  "weakness1": "first",
  "weakness2": "second",
  "weakness3": "third",
  "risk1": "one",
  "risk2": "two",
  "risk3": "three"
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

    if (!allCompetitors || allCompetitors.length === 0) {
      return res.status(200).json({ success: true, analyzed: 0, total: 0 });
    }

    let analyzed = 0;

    for (const comp of allCompetitors) {
      const data = await analyzeCompetitor(comp);
      if (!data) continue;

      const riskScore = Math.min(100, Math.max(0, data.risk || 50));
      const threatLevel = riskScore > 70 ? 'critical' : riskScore > 50 ? 'high' : riskScore > 30 ? 'medium' : 'low';

      // Update competitors table
      await supabase.from('competitors').update({
        threat_score: riskScore,
        tier: threatLevel,
        last_analyzed: new Date(),
      }).eq('id', comp.id);

      // Delete old data
      await supabase.from('competitor_profiles').delete().eq('competitor_id', comp.id);
      await supabase.from('competitor_strengths').delete().eq('competitor_id', comp.id);
      await supabase.from('competitor_weaknesses').delete().eq('competitor_id', comp.id);
      await supabase.from('risk_assessment').delete().eq('competitor_id', comp.id);

      // Store profile with LinkedIn data
      await supabase.from('competitor_profiles').insert({
        competitor_id: comp.id,
        overall_summary: data.summary || 'Analyzed',
        target_audience: 'Angel Investors',
        primary_value_prop: data.summary || 'Platform',
        business_model: 'SaaS',
        funding_status: data.funding || (data.linkedin_stage || 'Unknown'),
        team_size_estimate: data.team || (data.linkedin_employees ? parseInt(data.linkedin_employees) : 15),
        risk_score: riskScore,
        threat_to_divi: threatLevel,
        analyzed_at: new Date(),
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

      // Risks
      const risks = [data.risk1, data.risk2, data.risk3].filter(Boolean);
      if (risks.length > 0) {
        await supabase.from('risk_assessment').insert(
          risks.map(r => ({
            competitor_id: comp.id,
            risk_category: r.includes('fund') ? 'funding' : r.includes('product') ? 'product' : 'market',
            risk_level: threatLevel,
            description: r,
            potential_impact: 'Competitive threat',
            mitigation_strategy: 'Monitor and respond',
          }))
        );
      }

      // Add LinkedIn research link
      await supabase.from('research_links').insert({
        competitor_id: comp.id,
        link_type: 'linkedin',
        url: `https://www.linkedin.com/company/${comp.name.toLowerCase().replace(/\s+/g, '-')}`,
        title: `${comp.name} on LinkedIn`,
        description: 'LinkedIn company page',
      });

      analyzed++;
    }

    res.status(200).json({ success: true, analyzed, total: allCompetitors.length });
  } catch (error) {
    res.status(200).json({ success: false, error: error.message });
  }
}
