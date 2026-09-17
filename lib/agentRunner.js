/**
 * Divi Competitive Intelligence Agent — deep profiles
 * Cron: vercel.json → /api/intelligence daily
 *
 * Free sources: website HTML, Google News RSS, Clearbit logos, HTML tech signatures
 * Enrichment: Anthropic Claude structured analysis
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { DIVI_BASELINE } from './diviBaseline.js';
import {
  calculateOverallRisk,
  detectTechStack,
  extractSocialLinks,
  fetchGoogleNews,
  fetchWebpage,
  htmlToText,
  logoUrlFor,
  parseJsonFromModel,
  threatTierFromScore,
} from './freeData.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';

async function deepAnalyze(comp, html, newsItems) {
  const pageText = htmlToText(html, 4500);
  const social = extractSocialLinks(html, comp.website);
  const detectedTech = detectTechStack(html);
  const newsBrief = (newsItems || [])
    .slice(0, 5)
    .map((n, i) => `${i + 1}. ${n.title} (${n.source_name}, ${n.published_at})`)
    .join('\n');

  const dims = DIVI_BASELINE.comparisonDimensions
    .map((d) => `- ${d.key}: Divi has "${d.divi}"`)
    .join('\n');

  const prompt = `You are a competitive intelligence analyst for Divi (divi.fund), an AI-native angel investor platform:
- Portfolio tracking from cap tables
- AI Intelligence Dashboard
- Syndicate creation tools (~$99/mo)
- Investor education

Analyze this competitor. Use website content + press headlines + your knowledge of public information.
Mark uncertain financial figures as estimates. Never invent specific dollar amounts you are not reasonably confident about — use ranges or "Unknown" instead.

Competitor: ${comp.name}
Website: ${comp.website}
Company LinkedIn (if found): ${social.linkedin || 'unknown'}
Twitter/X (if found): ${social.twitter || 'unknown'}

Website text excerpt:
${pageText || 'Unavailable — rely on public knowledge carefully and mark confidence low.'}

Recent Google News headlines (free RSS):
${newsBrief || 'None fetched'}

Detected tech signals from HTML: ${detectedTech.map((t) => t.technology).join(', ') || 'none'}

Divi comparison dimensions:
${dims}

Return ONLY valid JSON (no markdown):
{
  "summary": "2-3 sentence company overview",
  "tagline": "short positioning line",
  "founded_year": 2020,
  "headquarters": "City, Country or Unknown",
  "employee_estimate": "e.g. 11-50 or Unknown",
  "revenue_estimate": "e.g. <$1M ARR (estimate) or Unknown",
  "total_funding_display": "e.g. $12M (estimate) or Unknown",
  "target_audience": "who they sell to",
  "primary_value_prop": "one sentence",
  "business_model": "how they make money",
  "company_history_summary": "brief narrative arc",
  "history": [
    {"event_date": "2021", "title": "Founded", "description": "...", "event_type": "founded"}
  ],
  "founders": [
    {"name": "", "title": "CEO", "linkedin_url": null, "twitter_url": null, "bio": "1 sentence"}
  ],
  "funding_rounds": [
    {"round_name": "Seed", "amount_display": "$3M (estimate)", "announced_date": "2022", "lead_investors": "Unknown", "is_estimate": true, "source": "public reports / inference"}
  ],
  "funding_risk": 50,
  "team_risk": 50,
  "feature_risk": 50,
  "market_risk": 50,
  "growth_risk": 50,
  "funding_notes": "short note",
  "team_notes": "short note",
  "feature_notes": "short note",
  "market_notes": "short note",
  "growth_notes": "short note",
  "strengths": [{"title": "", "why": ""}],
  "weaknesses": [{"title": "", "divi_advantage": ""}],
  "sentiment_score": 55,
  "sentiment_summary": "1-2 sentences on market perception",
  "positive_themes": "comma-separated",
  "negative_themes": "comma-separated",
  "media": [
    {"title": "headline", "source_name": "Outlet", "url": null, "published_at": null, "sentiment": "neutral", "summary": "one line"}
  ],
  "tech_stack": [
    {"technology": "React", "category": "frontend", "confidence": "medium", "evidence": "inferred"}
  ],
  "comparison": {
    "overall_verdict": "2 sentences: how they threaten or differ from Divi",
    "divi_wins": ["..."],
    "competitor_wins": ["..."],
    "feature_matrix": [
      {"feature": "portfolio_tracking", "label": "Portfolio / cap table tracking", "divi": "Native AI-assisted tracking", "competitor": "what they offer or lack", "winner": "divi|competitor|tie"}
    ],
    "strategic_recommendation": "what Divi should do in response"
  }
}`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3500,
      messages: [{ role: 'user', content: prompt }],
    });

    let text = '';
    for (const block of message.content) {
      if (block.type === 'text') {
        text = block.text;
        break;
      }
    }
    const parsed = parseJsonFromModel(text);
    if (!parsed) return defaultAnalysis(comp, detectedTech, newsItems, social);
    return {
      ...parsed,
      _detectedTech: detectedTech,
      _news: newsItems,
      _social: social,
    };
  } catch (err) {
    console.error(`Claude analysis failed for ${comp.name}:`, err.message);
    return defaultAnalysis(comp, detectedTech, newsItems, social);
  }
}

function defaultAnalysis(comp, detectedTech, newsItems, social) {
  return {
    summary: `${comp.name} operates in the angel / investor tooling space.`,
    tagline: 'Angel investing platform',
    founded_year: null,
    headquarters: 'Unknown',
    employee_estimate: 'Unknown',
    revenue_estimate: 'Unknown',
    total_funding_display: 'Unknown',
    target_audience: 'Angel investors',
    primary_value_prop: 'Investor platform',
    business_model: 'SaaS / marketplace',
    company_history_summary: 'Limited public history available from free sources.',
    history: [],
    founders: social?.linkedin
      ? [{ name: 'Leadership team', title: 'Company', linkedin_url: social.linkedin, twitter_url: social.twitter, bio: 'See company LinkedIn' }]
      : [],
    funding_rounds: [],
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
    strengths: [{ title: 'Active in market', why: 'Has a live product presence' }],
    weaknesses: [{ title: 'Limited open data', divi_advantage: 'Divi can out-communicate with clearer AI differentiation' }],
    sentiment_score: 50,
    sentiment_summary: 'Neutral — insufficient public signal from free sources.',
    positive_themes: 'Unknown',
    negative_themes: 'Unknown',
    media: (newsItems || []).slice(0, 5).map((n) => ({
      ...n,
      sentiment: 'neutral',
      summary: n.title,
    })),
    tech_stack: detectedTech || [],
    comparison: {
      overall_verdict: `${comp.name} overlaps with Divi's angel-investor audience; deeper data needed for a sharp read.`,
      divi_wins: ['AI-native investor intelligence positioning', 'Accessible syndicate tooling'],
      competitor_wins: ['Established brand or niche focus (verify)'],
      feature_matrix: DIVI_BASELINE.comparisonDimensions.map((d) => ({
        feature: d.key,
        label: d.label,
        divi: d.divi,
        competitor: 'Unknown / not clearly marketed',
        winner: 'tie',
      })),
      strategic_recommendation: 'Re-run analysis after collecting founder and funding signals; emphasize Divi AI + education wedge in messaging.',
    },
    _detectedTech: detectedTech,
    _news: newsItems,
    _social: social,
  };
}

async function clearDeepTables(competitorId) {
  await Promise.all([
    supabase.from('competitor_profiles').delete().eq('competitor_id', competitorId),
    supabase.from('competitor_strengths').delete().eq('competitor_id', competitorId),
    supabase.from('competitor_weaknesses').delete().eq('competitor_id', competitorId),
    supabase.from('risk_score_breakdown').delete().eq('competitor_id', competitorId),
    supabase.from('competitor_founders').delete().eq('competitor_id', competitorId),
    supabase.from('funding_rounds').delete().eq('competitor_id', competitorId),
    supabase.from('company_history').delete().eq('competitor_id', competitorId),
    supabase.from('social_sentiment').delete().eq('competitor_id', competitorId),
    supabase.from('media_mentions').delete().eq('competitor_id', competitorId),
    supabase.from('tech_stack').delete().eq('competitor_id', competitorId),
    supabase.from('divi_comparisons').delete().eq('competitor_id', competitorId),
  ]);
}

async function storeDeepProfile(comp, data) {
  const overallRisk = calculateOverallRisk(
    data.funding_risk,
    data.team_risk,
    data.feature_risk,
    data.market_risk,
    data.growth_risk
  );
  const tier = threatTierFromScore(overallRisk);
  const logo = logoUrlFor(comp.website);

  await clearDeepTables(comp.id);

  await supabase
    .from('competitors')
    .update({
      threat_score: overallRisk,
      tier,
      logo_url: logo,
      headquarters: data.headquarters || null,
      employee_estimate: data.employee_estimate || null,
      revenue_estimate: data.revenue_estimate || null,
      total_funding_display: data.total_funding_display || null,
      sentiment_score: data.sentiment_score ?? null,
      tagline: data.tagline || null,
      last_analyzed: new Date().toISOString(),
      last_checked: new Date().toISOString(),
    })
    .eq('id', comp.id);

  await supabase.from('competitor_profiles').insert({
    competitor_id: comp.id,
    overall_summary: data.summary,
    target_audience: data.target_audience,
    primary_value_prop: data.primary_value_prop,
    business_model: data.business_model,
    funding_status: data.total_funding_display,
    team_size_estimate: null,
    risk_score: overallRisk,
    threat_to_divi: tier,
    company_history_summary: data.company_history_summary,
    revenue_estimate: data.revenue_estimate,
    founded_year: data.founded_year,
    headquarters: data.headquarters,
    analyzed_at: new Date().toISOString(),
  });

  await supabase.from('risk_score_breakdown').insert({
    competitor_id: comp.id,
    funding_risk: data.funding_risk ?? 50,
    team_risk: data.team_risk ?? 50,
    feature_risk: data.feature_risk ?? 50,
    market_fit_risk: data.market_risk ?? 50,
    growth_risk: data.growth_risk ?? 50,
    funding_notes: data.funding_notes || '',
    team_notes: data.team_notes || '',
    feature_notes: data.feature_notes || '',
    market_notes: data.market_notes || '',
    growth_notes: data.growth_notes || '',
    calculated_risk_score: overallRisk,
  });

  const strengths = (data.strengths || []).filter((s) => s?.title);
  if (strengths.length) {
    await supabase.from('competitor_strengths').insert(
      strengths.map((s) => ({
        competitor_id: comp.id,
        strength_title: s.title,
        description: s.why || s.title,
        why_its_strong: s.why || s.title,
        competitive_advantage_level: 'medium',
      }))
    );
  }

  const weaknesses = (data.weaknesses || []).filter((w) => w?.title);
  if (weaknesses.length) {
    await supabase.from('competitor_weaknesses').insert(
      weaknesses.map((w) => ({
        competitor_id: comp.id,
        weakness_title: w.title,
        description: w.title,
        why_its_weak: w.title,
        opportunity_level: 'medium',
        divi_advantage: w.divi_advantage || `Divi opportunity vs ${comp.name}`,
      }))
    );
  }

  const founders = (data.founders || []).filter((f) => f?.name);
  if (founders.length) {
    await supabase.from('competitor_founders').insert(
      founders.map((f) => ({
        competitor_id: comp.id,
        name: f.name,
        title: f.title || null,
        linkedin_url: f.linkedin_url || data._social?.linkedin || null,
        twitter_url: f.twitter_url || data._social?.twitter || null,
        bio: f.bio || null,
      }))
    );
  }

  const rounds = (data.funding_rounds || []).filter((r) => r?.round_name);
  if (rounds.length) {
    await supabase.from('funding_rounds').insert(
      rounds.map((r) => ({
        competitor_id: comp.id,
        round_name: r.round_name,
        amount_display: r.amount_display || null,
        announced_date: r.announced_date || null,
        lead_investors: r.lead_investors || null,
        is_estimate: r.is_estimate !== false,
        source: r.source || 'Claude + public web',
      }))
    );
  }

  const history = (data.history || []).filter((h) => h?.title);
  if (history.length) {
    await supabase.from('company_history').insert(
      history.map((h) => ({
        competitor_id: comp.id,
        event_date: h.event_date || null,
        title: h.title,
        description: h.description || null,
        event_type: h.event_type || 'other',
      }))
    );
  }

  await supabase.from('social_sentiment').upsert(
    {
      competitor_id: comp.id,
      score: Math.min(100, Math.max(0, data.sentiment_score ?? 50)),
      summary: data.sentiment_summary || '',
      positive_themes: data.positive_themes || '',
      negative_themes: data.negative_themes || '',
      sample_sources: 'Google News RSS + public web + model synthesis',
      analyzed_at: new Date().toISOString(),
    },
    { onConflict: 'competitor_id' }
  );

  const mediaFromModel = (data.media || []).filter((m) => m?.title);
  const mediaFromRss = (data._news || []).map((n) => ({
    title: n.title,
    source_name: n.source_name,
    url: n.url,
    published_at: n.published_at,
    sentiment: 'neutral',
    summary: n.title,
  }));
  const mediaMap = new Map();
  [...mediaFromRss, ...mediaFromModel].forEach((m) => {
    const key = (m.title || '').toLowerCase();
    if (key && !mediaMap.has(key)) mediaMap.set(key, m);
  });
  const media = Array.from(mediaMap.values()).slice(0, 8);
  if (media.length) {
    await supabase.from('media_mentions').insert(
      media.map((m) => ({
        competitor_id: comp.id,
        title: m.title,
        source_name: m.source_name || null,
        url: m.url || null,
        published_at: m.published_at || null,
        sentiment: m.sentiment || 'neutral',
        summary: m.summary || null,
      }))
    );
  }

  const techMap = new Map();
  [...(data._detectedTech || []), ...(data.tech_stack || [])].forEach((t) => {
    if (!t?.technology) return;
    const key = t.technology.toLowerCase();
    if (!techMap.has(key)) techMap.set(key, t);
  });
  const tech = Array.from(techMap.values());
  if (tech.length) {
    await supabase.from('tech_stack').insert(
      tech.map((t) => ({
        competitor_id: comp.id,
        category: t.category || 'other',
        technology: t.technology,
        confidence: t.confidence || 'medium',
        evidence: t.evidence || null,
      }))
    );
  }

  const cmp = data.comparison || {};
  await supabase.from('divi_comparisons').upsert(
    {
      competitor_id: comp.id,
      overall_verdict: cmp.overall_verdict || '',
      divi_wins: cmp.divi_wins || [],
      competitor_wins: cmp.competitor_wins || [],
      feature_matrix: cmp.feature_matrix || [],
      strategic_recommendation: cmp.strategic_recommendation || '',
      analyzed_at: new Date().toISOString(),
    },
    { onConflict: 'competitor_id' }
  );

  return { overallRisk, tier };
}

async function processCompetitor(comp) {
  // Skip analyzing Divi against itself for comparison noise, but still enrich profile lightly
  const html = await fetchWebpage(comp.website);
  const news = await fetchGoogleNews(comp.name, 6);
  const analysis = await deepAnalyze(comp, html, news);
  const result = await storeDeepProfile(comp, analysis);
  return { id: comp.id, name: comp.name, ...result };
}

export default async function handler(req, res) {
  try {
    const competitorId = req.query?.id || req.body?.competitorId;

    let query = supabase.from('competitors').select('*').eq('status', 'active');
    if (competitorId) query = query.eq('id', competitorId);

    const { data: competitors, error } = await query;
    if (error) throw error;

    if (!competitors?.length) {
      return res.status(200).json({ success: true, analyzed: 0, message: 'No competitors to analyze' });
    }

    // Skip self-comparison target named exactly DIVI/Divi when batching comparisons is desired —
    // still analyze so Divi appears as a profile card.
    const results = await Promise.allSettled(competitors.map((c) => processCompetitor(c)));
    const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const failed = results
      .filter((r) => r.status === 'rejected')
      .map((r) => r.reason?.message || 'error');

    return res.status(200).json({
      success: true,
      analyzed: ok.length,
      total: competitors.length,
      results: ok,
      failures: failed,
      timestamp: new Date().toISOString(),
      note: 'Financials/sentiment may include estimates from free public sources + Claude',
    });
  } catch (error) {
    console.error('Agent error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
