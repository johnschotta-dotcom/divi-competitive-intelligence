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
