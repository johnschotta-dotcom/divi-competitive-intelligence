/**
 * FIXED - Handles extended thinking
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export default async function handler(req, res) {
  const logs = [];
  
  try {
    logs.push('STEP 1: Get competitors');
    const { data: competitors } = await supabase
      .from('competitors')
      .select('*')
      .eq('status', 'active')
      .limit(1);
    
    logs.push(`Found ${competitors?.length} competitors`);
    
    if (!competitors || competitors.length === 0) {
      return res.status(200).json({ logs, error: 'no competitors' });
    }

    const comp = competitors[0];
    logs.push(`Competitor: ${comp.name} (ID: ${comp.id})`);

    // STEP 2: Fetch webpage
    logs.push('STEP 2: Fetching webpage...');
    const response = await fetch(comp.website, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    
    const html = await response.text();
    const content = html.substring(0, 1000);
    logs.push(`Content fetched: ${html.length} chars`);

    // STEP 3: Call Claude
    logs.push('STEP 3: Calling Claude...');
    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `${comp.name}: ${content}

Return only JSON: {"risk":50}`,
      }],
    });

    logs.push(`Claude response received with ${message.content.length} content blocks`);
    
    // FIX: Find the text block (skip thinking blocks)
    let text = null;
    for (const block of message.content) {
      logs.push(`Block type: ${block.type}`);
      if (block.type === 'text') {
        text = block.text;
        break;
      }
    }
    
    if (!text) {
      throw new Error('No text block found in response');
    }

    logs.push(`Text received: "${text.substring(0, 200)}"`);

    // STEP 4: Parse JSON
    logs.push('STEP 4: Parsing JSON...');
    const jsonMatch = text.match(/\{[^{}]*\}/);
    if (!jsonMatch) {
      logs.push(`No JSON in: "${text}"`);
      return res.status(200).json({ logs, error: 'no json' });
    }

    const data = JSON.parse(jsonMatch[0]);
    logs.push(`Parsed: ${JSON.stringify(data)}`);

    // STEP 5: Store in DB
    logs.push('STEP 5: Storing...');
    const { error } = await supabase.from('competitor_profiles').upsert({
      competitor_id: comp.id,
      overall_summary: 'Analyzed',
      target_audience: 'Investors',
      risk_score: data.risk || 50,
      threat_to_divi: 'medium',
      analyzed_at: new Date(),
    }, { onConflict: 'competitor_id' });

    if (error) {
      logs.push(`Store error: ${error.message}`);
      return res.status(200).json({ logs, error: error.message });
    }

    logs.push('✅ SUCCESS');
    res.status(200).json({ success: true, logs, competitor: comp.name });

  } catch (error) {
    logs.push(`ERROR: ${error.message}`);
    res.status(200).json({ success: false, logs, error: error.message });
  }
}
