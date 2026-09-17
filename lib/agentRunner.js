/**
 * Divi Competitive Intelligence Agent — robust deep research
 *
 * Pipeline per competitor:
 * 1) Multi-page website corpus + Google News RSS (free)
 * 2) Claude research brief (prose)
 * 3) Claude structured profile JSON vs DIVI gold standard
 * 4) Completeness repair pass if thin
 *
 * Divi itself is stored as the reference profile (not scored as a peer threat).
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import {
  DIVI_BASELINE,
  diviGoldStandardBrief,
  isDiviCompany,
} from './diviBaseline.js';
import {
  calculateOverallRisk,
  detectTechStack,
  fetchCompanyCorpus,
  fetchGoogleNews,
  logoUrlFor,
  parseJsonFromModel,
  scoreProfileCompleteness,
  threatTierFromScore,
} from './freeData.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5';
const CONCURRENCY = Number(process.env.ANALYSIS_CONCURRENCY || 2);

async function claudeText(prompt, maxTokens = 4000) {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  for (const block of message.content) {
    if (block.type === 'text') return block.text;
  }
  return '';
}

function newsBrief(newsItems) {
  return (newsItems || [])
    .slice(0, 8)
    .map((n, i) => `${i + 1}. ${n.title} (${n.source_name || 'press'}, ${n.published_at || 'n/d'})`)
    .join('\n');
}

function jsonSchemaHint() {
  return `{
  "summary": "4-6 sentence analyst overview: what they do, who for, how they make money, why they matter vs Divi",
  "tagline": "short positioning",
  "founded_year": 2018,
  "headquarters": "City, Country",
  "employee_estimate": "range like 11-50",
  "revenue_estimate": "best public estimate with (estimate) label, or Unknown",
  "total_funding_display": "best public estimate with (estimate) label, or Unknown",
  "target_audience": "ICP in one sentence",
  "primary_value_prop": "one clear sentence",
  "business_model": "pricing/monetization in one sentence",
  "company_history_summary": "narrative arc in 2-4 sentences",
  "history": [
    {"event_date": "YYYY or YYYY-MM", "title": "event", "description": "why it matters", "event_type": "founded|funding|product|partnership|other"}
  ],
  "founders": [
    {"name": "Full Name", "title": "CEO/Co-founder", "linkedin_url": null, "twitter_url": null, "bio": "2 sentences on relevant background"}
  ],
  "funding_rounds": [
    {"round_name": "Seed|Series A|...", "amount_display": "$Xm (estimate)", "announced_date": "YYYY", "lead_investors": "names or Unknown", "is_estimate": true, "source": "public knowledge / press"}
  ],
  "funding_risk": 0,
  "team_risk": 0,
  "feature_risk": 0,
  "market_risk": 0,
  "growth_risk": 0,
  "funding_notes": "why this score vs Divi",
  "team_notes": "why this score vs Divi",
  "feature_notes": "why this score vs Divi",
  "market_notes": "why this score vs Divi",
  "growth_notes": "why this score vs Divi",
  "strengths": [
    {"title": "specific strength", "why": "evidence-based explanation"}
  ],
  "weaknesses": [
    {"title": "specific gap vs Divi gold standard", "divi_advantage": "how Divi wins or should message"}
  ],
  "sentiment_score": 0,
  "sentiment_summary": "2-3 sentences on market perception",
  "positive_themes": "theme1, theme2",
  "negative_themes": "theme1, theme2",
  "media": [
    {"title": "headline", "source_name": "Outlet", "url": null, "published_at": null, "sentiment": "positive|neutral|negative", "summary": "why it matters"}
  ],
  "tech_stack": [
    {"technology": "Name", "category": "frontend|backend|analytics|payments|infrastructure|other", "confidence": "high|medium|low", "evidence": "why"}
  ],
  "comparison": {
    "overall_verdict": "3-5 sentences: competitive posture vs Divi gold standard",
    "divi_wins": ["concrete Divi advantages"],
    "competitor_wins": ["concrete competitor advantages"],
    "feature_matrix": [
      {"feature": "portfolio_tracking", "label": "Portfolio / cap table tracking", "divi": "Divi capability", "competitor": "their capability or gap", "winner": "divi|competitor|tie"}
    ],
    "strategic_recommendation": "specific actions for Divi product/marketing/sales"
  },
  "data_confidence": "high|medium|low",
  "research_notes": "what was thin or inferred"
}`;
}

async function researchBrief(comp, corpusText, newsItems) {
  const prompt = `You are a senior competitive intelligence researcher for Divi (divi.fund).

${diviGoldStandardBrief()}

Research this competitor thoroughly using:
1) Multi-page website corpus (may be incomplete)
2) Press headlines
3) Your trained knowledge of public information about this company

Rules:
- Prefer specific, evidence-backed claims over vague filler.
- If unknown, say unknown and explain what would confirm it — do not invent fake founders or fake round sizes.
- Always frame implications relative to the DIVI GOLD STANDARD.
- Cover: company overview, product/features, ICP, pricing/business model, founders/leadership if known, funding history if known, go-to-market, strengths, weaknesses/gaps vs Divi, threats to Divi, opportunities for Divi.

Competitor: ${comp.name}
Website: ${comp.website}

Website corpus:
${corpusText || '(no pages fetched — rely carefully on public knowledge and mark low confidence)'}

Press headlines:
${newsBrief(newsItems) || '(none)'}

Write a dense research brief (not JSON) with clear section headings. Be concrete.`;

  try {
    return await claudeText(prompt, 2500);
  } catch (err) {
    console.error(`Research brief failed for ${comp.name}:`, err.message);
    return '';
  }
}

async function structureProfile(comp, corpusText, newsItems, brief, detectedTech, social, repairNote = '') {
  const dims = DIVI_BASELINE.comparisonDimensions
    .map((d) => `- ${d.key} (${d.label}): Divi = "${d.divi}"`)
    .join('\n');

  const prompt = `You are structuring a competitive intelligence dossier for Divi.

${diviGoldStandardBrief()}

Convert the research into COMPLETE JSON. Divi is the gold standard — every weakness and comparison must reference Divi advantages where relevant.

Hard requirements:
- summary: 4-6 substantive sentences
- strengths: at least 4 specific items with "why"
- weaknesses: at least 4 items; each must include divi_advantage tied to Divi gold standard
- founders: at least 1 if publicly knowable; otherwise empty array (do not invent names)
- history: at least 3 timeline events when possible
- comparison.feature_matrix: MUST include ALL of these keys: ${DIVI_BASELINE.comparisonDimensions.map((d) => d.key).join(', ')}
- comparison.divi_wins: at least 3
- comparison.competitor_wins: at least 2 (or honest "limited clear advantages")
- Risk scores 0-100 relative to threat Divi should feel (feature overlap + execution matter most)
- Label uncertain finances with (estimate) or Unknown
${repairNote ? `\nREPAIR PASS: Previous output was incomplete. Fix these gaps:\n${repairNote}\n` : ''}

Competitor: ${comp.name}
Website: ${comp.website}
LinkedIn: ${social?.linkedin || 'unknown'}
Twitter/X: ${social?.twitter || 'unknown'}
Detected tech from HTML: ${detectedTech.map((t) => t.technology).join(', ') || 'none'}

Comparison dimensions to fill:
${dims}

Research brief:
${brief || '(brief unavailable)'}

Website corpus (excerpt):
${(corpusText || '').slice(0, 9000)}

Press:
${newsBrief(newsItems)}

Return ONLY valid JSON matching:
${jsonSchemaHint()}`;

  const text = await claudeText(prompt, 4500);
  return parseJsonFromModel(text);
}

function gapsInProfile(data) {
  const gaps = [];
  if (!data?.summary || data.summary.length < 80) gaps.push('summary too short');
  if (!Array.isArray(data?.strengths) || data.strengths.filter((s) => s?.title).length < 3) {
    gaps.push('need >=3 strengths with why');
  }
  if (!Array.isArray(data?.weaknesses) || data.weaknesses.filter((w) => w?.title && w?.divi_advantage).length < 3) {
    gaps.push('need >=3 weaknesses each with divi_advantage');
  }
  if (!data?.comparison?.overall_verdict) gaps.push('missing comparison.overall_verdict');
  if (!Array.isArray(data?.comparison?.feature_matrix) || data.comparison.feature_matrix.length < 6) {
    gaps.push('feature_matrix incomplete vs Divi dimensions');
  }
  if (!Array.isArray(data?.comparison?.divi_wins) || data.comparison.divi_wins.length < 2) {
    gaps.push('need more divi_wins');
  }
  if (!data?.company_history_summary) gaps.push('missing company_history_summary');
  return gaps;
}

function ensureMatrix(data) {
  const existing = Array.isArray(data?.comparison?.feature_matrix)
    ? data.comparison.feature_matrix
    : [];
  const byKey = new Map(existing.map((r) => [r.feature || r.key, r]));
  data.comparison = data.comparison || {};
  data.comparison.feature_matrix = DIVI_BASELINE.comparisonDimensions.map((d) => {
    const prev = byKey.get(d.key) || {};
    return {
      feature: d.key,
      label: d.label,
      divi: prev.divi || d.divi,
      competitor: prev.competitor || 'Not clearly evidenced from public materials',
      winner: prev.winner || 'tie',
    };
  });
  return data;
}

function defaultAnalysis(comp, detectedTech, newsItems, social) {
  return ensureMatrix({
    summary: `${comp.name} appears to operate in or adjacent to angel / investor tooling. Public free-source coverage was thin during this run; treat details as provisional and re-run after deploy/timeout improvements.`,
    tagline: `${comp.name} — investor platform`,
    founded_year: null,
    headquarters: 'Unknown',
    employee_estimate: 'Unknown',
    revenue_estimate: 'Unknown',
    total_funding_display: 'Unknown',
    target_audience: 'Investors / angels (verify)',
    primary_value_prop: 'Investor-facing software (verify from product pages)',
    business_model: 'Likely SaaS or marketplace (verify)',
    company_history_summary: 'History not fully established from free sources in this run.',
    history: [],
    founders: [],
    funding_rounds: [],
    funding_risk: 45,
    team_risk: 45,
    feature_risk: 50,
    market_risk: 50,
    growth_risk: 45,
    funding_notes: 'Insufficient public funding signal',
    team_notes: 'Insufficient public team signal',
    feature_notes: 'Needs deeper product teardown vs Divi pillars',
    market_notes: 'Audience overlap with Divi is possible but unverified',
    growth_notes: 'Growth signal unclear',
    strengths: [
      { title: 'Live market presence', why: 'Has an active website/product footprint' },
      { title: 'Category adjacency', why: 'Operates near angel/investor workflows Divi serves' },
      { title: 'Brand recognition potential', why: 'May have existing audience Divi must account for' },
    ],
    weaknesses: [
      {
        title: 'Unclear AI-native investor intelligence',
        divi_advantage: 'Divi’s AI Intelligence Dashboard is a first-class surface, not a marketing veneer',
      },
      {
        title: 'Incomplete public product narrative vs Divi OS',
        divi_advantage: 'Divi combines portfolio + syndicate + education as one angel OS',
      },
      {
        title: 'Syndicate accessibility not evidenced',
        divi_advantage: 'Divi prices syndicate tooling for individual angels (~$99/mo)',
      },
    ],
    sentiment_score: 50,
    sentiment_summary: 'Neutral pending richer press/social signal.',
    positive_themes: 'Unknown',
    negative_themes: 'Unknown',
    media: (newsItems || []).slice(0, 5).map((n) => ({
      ...n,
      sentiment: 'neutral',
      summary: n.title,
    })),
    tech_stack: detectedTech || [],
    comparison: {
      overall_verdict: `${comp.name} requires a richer evidence pass; provisional view is category adjacency to Divi’s angel OS without proven parity on AI + education + syndicate accessibility.`,
      divi_wins: DIVI_BASELINE.strengths.slice(0, 3).map((s) => s.title),
      competitor_wins: ['Possible niche focus or brand (verify)'],
      feature_matrix: [],
      strategic_recommendation:
        'Re-run deep analysis; meanwhile emphasize Divi’s AI + cap-table portfolio + education wedge in competitive conversations.',
    },
    data_confidence: 'low',
    research_notes: 'Fallback profile used',
    _detectedTech: detectedTech,
    _news: newsItems,
    _social: social,
  });
}

async function deepAnalyze(comp, corpus, newsItems) {
  const social = corpus.social || {};
  const detectedTech = detectTechStack(corpus.html || '');
  const brief = await researchBrief(comp, corpus.text, newsItems);

  let parsed = null;
  try {
    parsed = await structureProfile(comp, corpus.text, newsItems, brief, detectedTech, social);
  } catch (err) {
    console.error(`Structure pass failed for ${comp.name}:`, err.message);
  }

  if (!parsed) {
    return defaultAnalysis(comp, detectedTech, newsItems, social);
  }

  let data = ensureMatrix({
    ...parsed,
    _detectedTech: detectedTech,
    _news: newsItems,
    _social: social,
    _brief: brief,
  });

  const gaps = gapsInProfile(data);
  if (gaps.length) {
    try {
      const repaired = await structureProfile(
        comp,
        corpus.text,
        newsItems,
        brief,
        detectedTech,
        social,
        gaps.map((g) => `- ${g}`).join('\n')
      );
      if (repaired) {
        data = ensureMatrix({
          ...data,
          ...repaired,
          strengths: repaired.strengths?.length ? repaired.strengths : data.strengths,
          weaknesses: repaired.weaknesses?.length ? repaired.weaknesses : data.weaknesses,
          comparison: { ...data.comparison, ...repaired.comparison },
          _detectedTech: detectedTech,
          _news: newsItems,
          _social: social,
          _brief: brief,
        });
      }
    } catch (err) {
      console.error(`Repair pass failed for ${comp.name}:`, err.message);
    }
  }

  data._completeness = scoreProfileCompleteness(data);
  return data;
}

function diviReferenceAnalysis(newsItems) {
  return ensureMatrix({
    summary: `${DIVI_BASELINE.company_history_summary} ${DIVI_BASELINE.primary_value_prop}. This profile is the gold standard reference used to evaluate every competitor in the landscape.`,
    tagline: DIVI_BASELINE.tagline,
    founded_year: DIVI_BASELINE.founded_year,
    headquarters: DIVI_BASELINE.headquarters,
    employee_estimate: DIVI_BASELINE.employee_estimate,
    revenue_estimate: DIVI_BASELINE.revenue_estimate,
    total_funding_display: DIVI_BASELINE.total_funding_display,
    target_audience: DIVI_BASELINE.audience,
    primary_value_prop: DIVI_BASELINE.primary_value_prop,
    business_model: DIVI_BASELINE.businessModel,
    company_history_summary: DIVI_BASELINE.company_history_summary,
    history: [
      {
        event_date: 'Ongoing',
        title: 'Building AI-native angel OS',
        description: DIVI_BASELINE.pillars.join('; '),
        event_type: 'product',
      },
    ],
    founders: [],
    funding_rounds: [],
    funding_risk: 0,
    team_risk: 0,
    feature_risk: 0,
    market_risk: 0,
    growth_risk: 0,
    funding_notes: 'Reference company — not scored as a competitor threat',
    team_notes: 'Reference company',
    feature_notes: 'Gold standard feature set for comparisons',
    market_notes: 'Reference ICP and positioning',
    growth_notes: 'Reference company',
    strengths: DIVI_BASELINE.strengths,
    weaknesses: [
      {
        title: 'Must keep AI + education differentiation sharp',
        divi_advantage: 'Continuous product focus on the gold-standard pillars',
      },
    ],
    sentiment_score: 75,
    sentiment_summary: 'Internal reference profile — sentiment reflects intended market positioning strength, not an external survey.',
    positive_themes: 'AI-native, angel OS, accessible syndicates, education',
    negative_themes: 'Must out-execute category specialists',
    media: (newsItems || []).slice(0, 5).map((n) => ({
      ...n,
      sentiment: 'neutral',
      summary: n.title,
    })),
    tech_stack: [],
    comparison: {
      overall_verdict:
        'This is Divi — the gold standard. Competitor profiles should be read as gaps/advantages relative to this reference, not the other way around.',
      divi_wins: DIVI_BASELINE.strengths.map((s) => s.title),
      competitor_wins: ['N/A — reference profile'],
      feature_matrix: DIVI_BASELINE.comparisonDimensions.map((d) => ({
        feature: d.key,
        label: d.label,
        divi: d.divi,
        competitor: 'Divi (reference)',
        winner: 'divi',
      })),
      strategic_recommendation:
        'Keep lib/diviBaseline.js updated as product ships; re-run competitor analyses after material Divi releases.',
    },
    data_confidence: 'high',
    research_notes: 'Loaded from DIVI_BASELINE gold standard',
    _news: newsItems,
    _social: {},
    _detectedTech: [],
    _completeness: 100,
  });
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

async function storeDeepProfile(comp, data, { isReference = false } = {}) {
  const overallRisk = isReference
    ? 0
    : calculateOverallRisk(
        data.funding_risk,
        data.team_risk,
        data.feature_risk,
        data.market_risk,
        data.growth_risk
      );
  const tier = isReference ? 'reference' : threatTierFromScore(overallRisk);
  const logo = logoUrlFor(comp.website || DIVI_BASELINE.website);

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
    funding_risk: data.funding_risk ?? 0,
    team_risk: data.team_risk ?? 0,
    feature_risk: data.feature_risk ?? 0,
    market_fit_risk: data.market_risk ?? 0,
    growth_risk: data.growth_risk ?? 0,
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
        competitive_advantage_level: 'high',
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
        opportunity_level: 'high',
        divi_advantage: w.divi_advantage || `Divi gold-standard advantage vs ${comp.name}`,
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
        source: r.source || 'Claude research + public web',
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
      sample_sources: `Claude multi-pass research + Google News RSS${data.data_confidence ? ` · confidence ${data.data_confidence}` : ''}`,
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
  const media = Array.from(mediaMap.values()).slice(0, 10);
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

  if (!isReference) {
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
  } else {
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
  }

  return {
    overallRisk,
    tier,
    completeness: data._completeness ?? scoreProfileCompleteness(data),
    data_confidence: data.data_confidence || null,
  };
}

async function processCompetitor(comp) {
  const news = await fetchGoogleNews(comp.name, 8);

  if (isDiviCompany(comp)) {
    const analysis = diviReferenceAnalysis(news);
    const result = await storeDeepProfile(comp, analysis, { isReference: true });
    return { id: comp.id, name: comp.name, reference: true, ...result };
  }

  const corpus = await fetchCompanyCorpus(comp.website);
  const analysis = await deepAnalyze(comp, corpus, news);
  const result = await storeDeepProfile(comp, analysis);
  return {
    id: comp.id,
    name: comp.name,
    pages_fetched: corpus.pagesFetched?.length || 0,
    ...result,
  };
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const idx = next++;
      try {
        results[idx] = { status: 'fulfilled', value: await fn(items[idx]) };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
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

    // Analyze Divi reference first so gold standard is fresh, then others
    const divi = competitors.filter((c) => isDiviCompany(c));
    const others = competitors.filter((c) => !isDiviCompany(c));
    const ordered = [...divi, ...others];

    const settled = await mapPool(ordered, CONCURRENCY, processCompetitor);
    const ok = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const failed = settled
      .filter((r) => r.status === 'rejected')
      .map((r) => r.reason?.message || String(r.reason) || 'error');

    return res.status(200).json({
      success: true,
      analyzed: ok.length,
      total: ordered.length,
      results: ok,
      failures: failed,
      timestamp: new Date().toISOString(),
      note: 'Two-pass Claude research vs Divi gold standard. Financials may be estimates. Prefer re-analyzing one competitor at a time if batch times out.',
    });
  } catch (error) {
    console.error('Agent error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
