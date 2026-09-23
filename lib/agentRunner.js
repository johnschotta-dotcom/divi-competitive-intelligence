/**
 * Divi Competitive Intelligence — website-grounded positioning agent
 *
 * Evidence policy: competitor website pages (primary). LinkedIn is attempted when a
 * company URL is found on-site, but login walls usually block usable copy.
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
  deriveSiteTone,
  detectTechStack,
  fetchPresenceBundle,
  companySocialEntries,
  logoUrlFor,
  extractLogoFromHtml,
  parseJsonFromModel,
  scoreProfileCompleteness,
  threatTierFromScore,
} from './freeData.js';
import { formatFounderForPrompt, isPersonalLinkedIn, sanitizeTeamMember } from './peopleEnrich.js';
import {
  resolveOverlap,
  labelFromOverlapLevel,
  tierFromCompetitorLabel,
} from './overlap.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const MODEL_FALLBACK = process.env.ANTHROPIC_MODEL_FALLBACK || 'claude-haiku-4-5';
const CONCURRENCY = Number(process.env.ANALYSIS_CONCURRENCY || 1);

async function claudeText(prompt, maxTokens = 2500, model = MODEL) {
  const message = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  for (const block of message.content) {
    if (block.type === 'text') return block.text;
  }
  return '';
}

async function claudeJson(prompt, maxTokens = 2500) {
  let lastError = null;
  for (const model of [...new Set([MODEL, MODEL_FALLBACK])]) {
    try {
      const text = await claudeText(prompt, maxTokens, model);
      const parsed = parseJsonFromModel(text);
      if (parsed) return { parsed, model, rawLength: text.length };
      lastError = `Model ${model} returned non-JSON (${text.slice(0, 120).replace(/\s+/g, ' ')})`;
    } catch (err) {
      lastError = `${model}: ${err.message}`;
      console.error('Claude call failed:', lastError);
    }
  }
  return { parsed: null, error: lastError };
}

function compactPresence(presence, maxChars = 5000) {
  const facts = presence?.websiteFacts?.factsBlock || '';
  const people = (presence?.people || [])
    .slice(0, 12)
    .map((p) => formatFounderForPrompt(p).replace(/^- /, ''))
    .join('; ');
  const pages = (presence?.pagesFetched || []).slice(0, 10).join(', ');
  const body = String(presence?.presenceText || presence?.text || '').slice(0, maxChars);
  return [
    facts ? `FACTS:\n${facts}` : null,
    people ? `TEAM: ${people}` : null,
    pages ? `PAGES: ${pages}` : null,
    body ? `COPY:\n${body}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, maxChars + 1500);
}

function ensureComparisonShape(data, { isReference = false } = {}) {
  const cmp = data.comparison || {};
  const matrixSrc = Array.isArray(cmp.feature_matrix) ? cmp.feature_matrix : [];
  const byKey = new Map(matrixSrc.map((r) => [r.feature || r.key, r]));

  const aligned = resolveOverlap({
    level: cmp.overlap_level,
    score: cmp.market_overlap_score,
    label: cmp.true_competitor_label,
    isReference,
  });

  data.comparison = {
    overall_verdict: cmp.overall_verdict || '',
    where_we_win: cmp.where_we_win || cmp.divi_wins || [],
    where_we_fall_short: cmp.where_we_fall_short || cmp.competitor_wins || [],
    where_same: cmp.where_same || [],
    where_they_differentiate: cmp.where_they_differentiate || [],
    overlap_level: aligned.level,
    market_overlap_score: aligned.score,
    true_competitor_label: aligned.label || 'adjacent',
    strategic_recommendation: cmp.strategic_recommendation || '',
    evidence_basis: cmp.evidence_basis || 'company websites',
    divi_wins: cmp.where_we_win || cmp.divi_wins || [],
    competitor_wins: cmp.where_we_fall_short || cmp.competitor_wins || [],
    feature_matrix: DIVI_BASELINE.comparisonDimensions.map((d) => {
      const prev = byKey.get(d.key) || {};
      return {
        feature: d.key,
        label: d.label,
        divi: prev.divi || d.divi,
        competitor: prev.competitor || 'Not clearly claimed on their website',
        winner: prev.winner || 'tie',
        evidence: prev.evidence || null,
      };
    }),
  };
  return data;
}

function gapsInProfile(data) {
  const gaps = [];
  const cmp = data?.comparison || {};
  if (!data?.summary || data.summary.length < 100) gaps.push('summary must be 4+ sentences from website language');
  if (!Array.isArray(data?.strengths) || data.strengths.length < 3) gaps.push('need >=3 website-evidenced strengths');
  if (!Array.isArray(data?.weaknesses) || data.weaknesses.length < 3) {
    gaps.push('need >=3 gaps vs Divi website claims, each with divi_advantage');
  }
  if (!cmp.overall_verdict) gaps.push('missing positioning verdict');
  if (!Array.isArray(cmp.where_we_win) || cmp.where_we_win.length < 2) gaps.push('need where_we_win');
  if (!Array.isArray(cmp.where_same) || cmp.where_same.length < 1) gaps.push('need where_same');
  if (!Array.isArray(cmp.where_they_differentiate) || cmp.where_they_differentiate.length < 1) {
    gaps.push('need where_they_differentiate');
  }
  if (cmp.overlap_level == null && cmp.market_overlap_score == null) {
    gaps.push('need overlap_level high|medium|low|none');
  }
  if (!cmp.true_competitor_label && !cmp.overlap_level) gaps.push('need true_competitor_label');
  return gaps;
}

async function analyzeFromWebPresence(comp, competitorPresence, diviPresence) {
  const detectedTech = detectTechStack(competitorPresence.html || '');
  const social = competitorPresence.social || {};
  const facts = competitorPresence.websiteFacts || {};
  let claudeError = null;

  const diviPack = [
    'Authoritative Divi product copy (use this even if live HTML is a JS shell):',
    diviGoldStandardBrief(),
    '',
    'Live Divi site crawl (may be thin — SPA):',
    compactPresence(diviPresence, 2500),
  ].join('\n');
  const compPack = compactPresence(competitorPresence, 6500);
  const dims = DIVI_BASELINE.comparisonDimensions
    .map((d) => `- ${d.key}: Divi = ${d.divi}`)
    .join('\n');

  // PASS 1: positioning only (small JSON — this powers the Positioning vs Divi tab)
  const positioningPrompt = `You are Divi's competitive positioning analyst.
Compare the competitor's website evidence against Divi's authoritative product baseline.
Divi's live marketing site is a JS app shell — treat Divi gold standard / authoritative Divi product copy as Divi's real positioning, not "missing evidence".
Do not invent funding or press for the competitor. Use competitor title/meta/body/nav (and LinkedIn only if real public copy appears below).

Divi gold standard:
${diviGoldStandardBrief()}

=== Divi evidence ===
${diviPack}

=== COMPETITOR: ${comp.name} (${comp.website}) ===
${compPack}

Return ONLY valid JSON (no markdown):
{
  "overall_verdict": "5-7 sentences on market overlap with Divi and how Divi should think about them",
  "where_we_win": ["3-5 Divi advantages vs their website claims"],
  "where_we_fall_short": ["2-4 places their site looks stronger/clearer than Divi's"],
  "where_same": ["2-4 shared jobs/language/claims"],
  "where_they_differentiate": ["2-4 ways they position differently"],
  "overlap_level": "high|medium|low|none",
  "true_competitor_label": "direct|adjacent|tangential|not_a_competitor",
  "strategic_recommendation": "specific Divi product/messaging next step",
  "summary": "3-5 sentences: what their website says they do and for whom",
  "tagline": "from their site if possible",
  "target_audience": "who their site says they serve",
  "primary_value_prop": "one sentence from their site",
  "strengths": [{"title": "", "why": "from their site"}],
  "weaknesses": [{"title": "gap vs Divi site claims", "divi_advantage": ""}],
  "feature_matrix": [
    {"feature": "portfolio_tracking", "label": "Portfolio / cap table tracking", "divi": "", "competitor": "", "winner": "divi|competitor|tie", "evidence": ""}
  ],
  "site_tone": {
    "score": 0,
    "summary": "2-3 sentences on how clear/confident their website messaging is",
    "positive_themes": ["only real messaging themes from the site"],
    "negative_themes": ["only real messaging gaps; omit if none"]
  }
}

Overlap is qualitative — pick ONE overlap_level, then set true_competitor_label to match exactly:
- high → direct: same primary buyer job as Divi — especially angel/individual-investor portfolio tracking, monitoring, and reporting. If that is their core product, choose high/direct even when they lack AI, syndicates, or education. Missing pillars means Divi wins those matrix rows; it does NOT push them to medium/adjacent.
- medium → adjacent: investor software with a different primary job (GP fund admin, LP portals, CRM-only, banking, back-office).
- low → tangential: shared audience only (deal marketplaces, content, communities) without portfolio-ops as the core offer.
- none → not_a_competitor: clearly outside angel/portfolio operating software, or tracked for context only. Prefer none over low when they are not a real alternative to Divi’s buyer job.
Do not invent a 0–100 score. Never mismatch level and label (e.g. high cannot be adjacent).
Rule: judge by primary job-to-be-done, not by how many Divi pillars they copy. One shared core job (portfolio ops for angels) is enough for high/direct.
site_tone.score is website messaging clarity/confidence (not social media sentiment): 80-100 strong, 60-79 solid, 40-59 mixed, 0-39 weak/thin.
If competitor crawl is thin, still score from title/meta/nav/name+category — note low evidence confidence in overall_verdict; do NOT claim Divi evidence is missing.
feature_matrix must include: ${DIVI_BASELINE.comparisonDimensions.map((d) => d.key).join(', ')}
Divi dimension reference:
${dims}`;

  let positioning = null;
  {
    const first = await claudeJson(positioningPrompt, 2800);
    positioning = first.parsed;
    if (!positioning) {
      claudeError = first.error;
      const retryPrompt = `Return ONLY JSON for Divi vs ${comp.name} website comparison.
Divi: AI-native angel portfolio tracking, syndicate tools (~$99/mo), investor education, AI intelligence dashboard.
Competitor site facts:
${facts.factsBlock || compPack.slice(0, 2500)}

JSON shape:
{"overall_verdict":"","where_we_win":["",""],"where_we_fall_short":[""],"where_same":[""],"where_they_differentiate":[""],"overlap_level":"medium","true_competitor_label":"adjacent","strategic_recommendation":"","summary":"","tagline":"","target_audience":"","primary_value_prop":"","strengths":[{"title":"","why":""}],"weaknesses":[{"title":"","divi_advantage":""}],"feature_matrix":[]}`;
      const second = await claudeJson(retryPrompt, 2000);
      positioning = second.parsed;
      if (!positioning) claudeError = second.error || claudeError;
    }
  }

  // Normalize positioning object whether nested under comparison or flat
  const cmpFromModel = positioning?.comparison
    ? positioning.comparison
    : positioning
      ? {
          overall_verdict: positioning.overall_verdict,
          where_we_win: positioning.where_we_win,
          where_we_fall_short: positioning.where_we_fall_short,
          where_same: positioning.where_same,
          where_they_differentiate: positioning.where_they_differentiate,
          overlap_level: positioning.overlap_level,
          market_overlap_score: positioning.market_overlap_score,
          true_competitor_label: positioning.true_competitor_label,
          strategic_recommendation: positioning.strategic_recommendation,
          feature_matrix: positioning.feature_matrix,
          evidence_basis: 'company websites',
        }
      : null;

  if (!cmpFromModel?.overall_verdict && !cmpFromModel?.where_we_win?.length) {
    const fallback = ensureComparisonShape({
      summary: [
        facts.h1 ? `${comp.name} leads with: “${facts.h1}”.` : `${comp.name}: crawl succeeded.`,
        facts.metaDescription || null,
        facts.people?.length
          ? `Team on site: ${facts.people.map((p) => p.name).join(', ')}.`
          : null,
        claudeError ? `Positioning model error: ${claudeError}` : null,
      ]
        .filter(Boolean)
        .join(' '),
      tagline: facts.tagline || comp.name,
      target_audience: facts.metaDescription || 'See website',
      primary_value_prop: facts.metaDescription || facts.h1 || 'Not clearly stated',
      business_model: 'Not stated on website',
      company_history_summary: 'Not stated on website',
      strengths:
        facts.navOffers?.slice(0, 3).map((n) => ({
          title: `Site highlights: ${n.label}`,
          why: `Linked from their website (${n.url})`,
        })) || [{ title: 'Has a web presence', why: 'Site was reachable' }],
      weaknesses: [
        {
          title: 'Positioning LLM pass did not return usable JSON',
          divi_advantage: 'Re-run after deploy; Divi baseline still available for manual compare',
        },
      ],
      founders: facts.people || [],
      tech_stack: facts.tech || detectedTech,
      comparison: {
        overall_verdict: `Automated positioning pass failed${claudeError ? `: ${claudeError}` : ''}. Crawl facts are shown; click Re-analyze once more. If this persists, check ANTHROPIC_API_KEY / model name on Vercel.`,
        where_we_win: DIVI_BASELINE.strengths.slice(0, 4).map((s) => s.title),
        where_we_fall_short: [
          'Could not auto-score their site advantages — open their website manually meanwhile',
        ],
        where_same: [
          facts.navOffers?.length
            ? `Both discuss: ${facts.navOffers
                .slice(0, 4)
                .map((n) => n.label)
                .join(', ')}`
            : 'Both maintain public investor/market websites',
        ],
        where_they_differentiate: [
          facts.h1 ? `They lead with “${facts.h1}” vs Divi’s AI angel OS framing` : 'Unclear until LLM pass succeeds',
        ],
        overlap_level: 'low',
        market_overlap_score: 35,
        true_competitor_label: 'tangential',
        strategic_recommendation: 'Re-analyze this competitor; verify Anthropic model env on Vercel.',
        feature_matrix: [],
      },
      _detectedTech: detectedTech,
      _social: social,
      _websiteFacts: facts,
      _blogHeadlines: facts.blogHeadlines || [],
      _navOffers: facts.navOffers || [],
      _pagesFetched: facts.pagesFetched || [],
      _homeHtml: competitorPresence.homeHtml || competitorPresence.html || null,
      _claudeError: claudeError,
      _completeness: 40,
    });
    const fallbackTone = deriveSiteTone({
      facts,
      presenceText: competitorPresence.presenceText || competitorPresence.text || '',
      strengths: fallback.strengths,
      weaknesses: fallback.weaknesses,
    });
    fallback.sentiment_score = fallbackTone.sentiment_score;
    fallback.sentiment_summary = fallbackTone.sentiment_summary;
    fallback.positive_themes = fallbackTone.positive_themes;
    fallback.negative_themes = fallbackTone.negative_themes;
    return fallback;
  }

  let data = ensureComparisonShape({
    summary: positioning.summary || '',
    tagline: positioning.tagline || facts.tagline || comp.name,
    target_audience: positioning.target_audience || '',
    primary_value_prop: positioning.primary_value_prop || facts.metaDescription || '',
    business_model: positioning.business_model || 'Not stated on website',
    company_history_summary: positioning.company_history_summary || 'Not stated on website',
    strengths: positioning.strengths || [],
    weaknesses: positioning.weaknesses || [],
    founders: facts.people || positioning.founders || [],
    tech_stack: facts.tech || detectedTech,
    comparison: cmpFromModel,
    _detectedTech: detectedTech,
    _social: social,
  });

  const tone = deriveSiteTone({
    facts,
    presenceText: competitorPresence.presenceText || competitorPresence.text || '',
    strengths: data.strengths,
    weaknesses: data.weaknesses,
    modelTone: positioning.site_tone || null,
  });
  data.sentiment_score = tone.sentiment_score;
  data.sentiment_summary = tone.sentiment_summary;
  data.positive_themes = tone.positive_themes;
  data.negative_themes = tone.negative_themes;

  if (!data.tagline && facts.tagline) data.tagline = facts.tagline;
  if (!data.primary_value_prop && facts.metaDescription) data.primary_value_prop = facts.metaDescription;
  if (!data.summary || data.summary.length < 60) {
    data.summary = [
      facts.h1 ? `${comp.name} leads with: “${facts.h1}”.` : null,
      facts.metaDescription ? facts.metaDescription : null,
      facts.navOffers?.length
        ? `Their site emphasizes: ${facts.navOffers
            .slice(0, 6)
            .map((n) => n.label)
            .join(', ')}.`
        : null,
      facts.people?.length
        ? `Team listed on site: ${facts.people
            .slice(0, 8)
            .map((p) => p.name)
            .join(', ')}.`
        : null,
    ]
      .filter(Boolean)
      .join(' ');
  }

  data._websiteFacts = facts;
  data._blogHeadlines = facts.blogHeadlines || [];
  data._navOffers = facts.navOffers || [];
  data._pagesFetched = facts.pagesFetched || competitorPresence.pagesFetched || [];
  data._homeHtml = competitorPresence.homeHtml || competitorPresence.html || null;

  // Website-extracted team only — do not keep Claude-invented names
  const extracted = competitorPresence.people || [];
  const byName = new Map();
  for (const p of extracted) {
    const clean = sanitizeTeamMember(p, {
      companyName: comp.name,
      companySocial: social,
    });
    if (!clean) continue;
    byName.set(clean.name.toLowerCase(), clean);
  }
  for (const f of data.founders || []) {
    const key = String(f?.name || '').toLowerCase();
    if (!byName.has(key)) continue;
    const prev = byName.get(key);
    byName.set(key, {
      ...prev,
      title: prev.title || f.title || null,
      linkedin_url:
        prev.linkedin_url || (isPersonalLinkedIn(f.linkedin_url) ? f.linkedin_url : null),
      twitter_url: prev.twitter_url || f.twitter_url || null,
    });
  }
  data.founders = Array.from(byName.values());

  data._completeness = scoreProfileCompleteness(data);
  return data;
}

function diviReferenceFromPresence(diviPresence) {
  return ensureComparisonShape({
    summary: `${DIVI_BASELINE.company_overview} Vision: ${DIVI_BASELINE.vision} Live website corpus pages: ${(diviPresence.pagesFetched || []).length}. This card is the gold-standard reference — competitors are judged by overlap with Divi’s stated jobs (intelligence layer / system of record for private-market investors).`,
    tagline: DIVI_BASELINE.tagline,
    target_audience: DIVI_BASELINE.audience,
    primary_value_prop: DIVI_BASELINE.primary_value_prop,
    business_model: DIVI_BASELINE.businessModel,
    company_history_summary: DIVI_BASELINE.company_history_summary,
    headquarters: DIVI_BASELINE.headquarters,
    employee_estimate: DIVI_BASELINE.employee_estimate,
    revenue_estimate: DIVI_BASELINE.revenue_estimate,
    total_funding_display: DIVI_BASELINE.total_funding_display,
    founded_year: DIVI_BASELINE.founded_year,
    history: [
      {
        event_date: 'Ongoing',
        title: 'Divi company overview',
        description: DIVI_BASELINE.company_overview,
        event_type: 'product',
      },
      {
        event_date: 'Ongoing',
        title: 'Who we serve & vision',
        description: `Who we serve: ${DIVI_BASELINE.audience}. Vision: ${DIVI_BASELINE.vision}`,
        event_type: 'product',
      },
      {
        event_date: 'Ongoing',
        title: 'Product pillars',
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
    funding_notes: 'Reference',
    team_notes: 'Reference',
    feature_notes: 'Gold standard',
    market_notes: 'Gold standard ICP',
    growth_notes: 'Reference',
    strengths: DIVI_BASELINE.strengths,
    weaknesses: [
      {
        title: 'Must keep public messaging as sharp as the product narrative',
        divi_advantage:
          'Own the intelligence-layer / Investment Health Score™ story on divi.fund',
      },
    ],
    sentiment_score: 85,
    sentiment_summary:
      'Divi reference tone: strong one-pager narrative (intelligence layer, system of record, Investment Health Score™, broader private-market ICP). Live divi.fund HTML is a JS shell, so messaging strength is anchored to the product baseline.',
    positive_themes:
      'Intelligence layer · System of record · Investment Health Score™ · Founder communications · Co-investor context · Accessible beyond SV',
    negative_themes:
      'Public site copy is thinner than the one-pager — keep marketing pages aligned with this narrative',
    media: [],
    tech_stack: detectTechStack(diviPresence.html || ''),
    comparison: {
      overall_verdict:
        'Divi is the reference intelligence layer for private-market investors. Use competitor overlap_level and true_competitor_label to see who is actually chasing the same jobs (portfolio system of record + investor intelligence), not only shared audience.',
      where_we_win: DIVI_BASELINE.strengths.map((s) => s.title),
      where_we_fall_short: ['N/A — reference profile'],
      where_same: ['N/A — reference profile'],
      where_they_differentiate: ['N/A — reference profile'],
      overlap_level: 'high',
      market_overlap_score: 100,
      true_competitor_label: 'reference',
      strategic_recommendation:
        'Keep divi.fund messaging aligned with lib/diviBaseline.js (one-pager overview, ICP, vision, Investment Health Score™).',
      feature_matrix: [],
    },
    _social: diviPresence.social || {},
    _detectedTech: detectTechStack(diviPresence.html || ''),
    _homeHtml: diviPresence.homeHtml || diviPresence.html || null,
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
  const aligned = resolveOverlap({
    level: data.comparison?.overlap_level,
    score: data.comparison?.market_overlap_score,
    label: data.comparison?.true_competitor_label,
    isReference,
  });
  if (data.comparison) {
    data.comparison.overlap_level = aligned.level;
    data.comparison.market_overlap_score = aligned.score;
    data.comparison.true_competitor_label = aligned.label;
  }

  const overlap = aligned.score;
  const overallRisk = isReference
    ? 0
    : overlap != null
      ? overlap
      : calculateOverallRisk(
          data.funding_risk,
          data.team_risk,
          data.feature_risk,
          data.market_risk,
          data.growth_risk
        );

  const label = isReference
    ? 'reference'
    : aligned.label || labelFromOverlapLevel(aligned.level) || 'adjacent';

  const tier = isReference
    ? 'reference'
    : tierFromCompetitorLabel(label) || threatTierFromScore(overallRisk);

  const logoFinal =
    extractLogoFromHtml(data._homeHtml || data._presenceHtml || data.html || '', comp.website) ||
    logoUrlFor(comp.website || DIVI_BASELINE.website);
  await clearDeepTables(comp.id);

  await supabase
    .from('competitors')
    .update({
      threat_score: overallRisk,
      tier,
      logo_url: logoFinal,
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

  const socialLinks = data._social || {};
  await supabase
    .from('competitors')
    .update({
      linkedin_url: socialLinks.linkedin || null,
      twitter_url: socialLinks.twitter || null,
      facebook_url: socialLinks.facebook || null,
      instagram_url: socialLinks.instagram || null,
      youtube_url: socialLinks.youtube || null,
    })
    .eq('id', comp.id);

  // Best-effort — requires supabase/03_positioning.sql
  await supabase
    .from('competitors')
    .update({
      market_overlap_score: overlap != null ? Number(overlap) : null,
      true_competitor_label: label,
    })
    .eq('id', comp.id);

  await supabase.from('competitor_profiles').insert({
    competitor_id: comp.id,
    overall_summary: data.summary,
    target_audience: data.target_audience,
    primary_value_prop: data.primary_value_prop,
    business_model: data.business_model,
    funding_status: data.total_funding_display,
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
        opportunity_level: 'high',
        divi_advantage: w.divi_advantage || `Divi website advantage vs ${comp.name}`,
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
        // Never fall back to company LinkedIn/X — only person profile URLs
        linkedin_url: f.linkedin_url || null,
        twitter_url: f.twitter_url || null,
        bio: f.bio || null,
        prior_companies: Array.isArray(f.prior_companies)
          ? f.prior_companies.join('; ')
          : f.prior_companies || null,
        education: Array.isArray(f.education) ? f.education.join('; ') : f.education || null,
        location: f.location || null,
        enrichment_source: f.enrichment_source || null,
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
      sample_sources: 'Website messaging clarity (not social listening)',
      analyzed_at: new Date().toISOString(),
    },
    { onConflict: 'competitor_id' }
  );

  const techMap = new Map();
  [...(data._detectedTech || []), ...(data.tech_stack || [])].forEach((t) => {
    if (!t?.technology) return;
    if (!techMap.has(t.technology.toLowerCase())) techMap.set(t.technology.toLowerCase(), t);
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

  const crawlMedia = [
    ...companySocialEntries(data._social || social || {}).map((s) => ({
      title: s.label,
      source_name: 'company_social',
      url: s.url,
      published_at: null,
      sentiment: 'info',
      summary: 'Company social profile linked from their website',
    })),
    ...(data._pagesFetched || []).map((url) => ({
      title: url,
      source_name: 'crawled_page',
      url,
      published_at: null,
      sentiment: 'info',
      summary: 'Page included in website crawl',
    })),
    ...(data._blogHeadlines || []).map((title) => ({
      title,
      source_name: 'website_heading',
      url: null,
      published_at: null,
      sentiment: 'neutral',
      summary: 'Heading found on crawled website pages',
    })),
    ...(data.media || []).filter((m) => m?.title),
  ];
  if (crawlMedia.length) {
    await supabase.from('media_mentions').insert(
      crawlMedia.slice(0, 40).map((m) => ({
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

  const cmp = data.comparison || {};
  const comparisonPayload = {
    competitor_id: comp.id,
    overall_verdict: cmp.overall_verdict || '',
    divi_wins: cmp.where_we_win || cmp.divi_wins || [],
    competitor_wins: cmp.where_we_fall_short || cmp.competitor_wins || [],
    feature_matrix: cmp.feature_matrix || [],
    strategic_recommendation: cmp.strategic_recommendation || '',
    where_same: cmp.where_same || [],
    where_differentiate: cmp.where_they_differentiate || [],
    market_overlap_score: cmp.market_overlap_score ?? null,
    true_competitor_label: cmp.true_competitor_label || null,
    evidence_basis: cmp.evidence_basis || 'company websites',
    analyzed_at: new Date().toISOString(),
  };

  let { error: cmpError } = await supabase
    .from('divi_comparisons')
    .upsert(comparisonPayload, { onConflict: 'competitor_id' });

  if (cmpError) {
    console.warn('divi_comparisons upsert failed, retrying lean payload:', cmpError.message);
    const lean = {
      competitor_id: comp.id,
      overall_verdict: comparisonPayload.overall_verdict,
      divi_wins: comparisonPayload.divi_wins,
      competitor_wins: comparisonPayload.competitor_wins,
      feature_matrix: comparisonPayload.feature_matrix,
      strategic_recommendation: comparisonPayload.strategic_recommendation,
      analyzed_at: comparisonPayload.analyzed_at,
    };
    ({ error: cmpError } = await supabase
      .from('divi_comparisons')
      .upsert(lean, { onConflict: 'competitor_id' }));
    if (cmpError) console.error('divi_comparisons lean upsert failed:', cmpError.message);
  }

  return {
    overallRisk,
    tier,
    market_overlap_score: cmp.market_overlap_score ?? null,
    true_competitor_label: label,
    completeness: data._completeness ?? scoreProfileCompleteness(data),
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
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

/** Heal score/label mismatches for all active competitors (level ↔ label). */
export async function alignExistingOverlapLabels() {
  const { data: rows, error } = await supabase
    .from('competitors')
    .select('id, name, market_overlap_score, true_competitor_label, threat_score, tier')
    .eq('status', 'active');
  if (error) throw error;

  const fixed = [];
  for (const row of rows || []) {
    if (row.tier === 'reference' || row.true_competitor_label === 'reference') continue;
    const aligned = resolveOverlap({
      score: row.market_overlap_score ?? row.threat_score,
      label: row.true_competitor_label,
    });
    if (!aligned.label || aligned.score == null) continue;

    const needsUpdate =
      Number(row.market_overlap_score) !== aligned.score ||
      row.true_competitor_label !== aligned.label ||
      Number(row.threat_score) !== aligned.score ||
      row.tier !== tierFromCompetitorLabel(aligned.label);

    if (!needsUpdate) continue;

    await supabase
      .from('competitors')
      .update({
        market_overlap_score: aligned.score,
        true_competitor_label: aligned.label,
        threat_score: aligned.score,
        tier: tierFromCompetitorLabel(aligned.label),
      })
      .eq('id', row.id);

    await supabase
      .from('divi_comparisons')
      .update({
        market_overlap_score: aligned.score,
        true_competitor_label: aligned.label,
      })
      .eq('competitor_id', row.id);

    fixed.push({
      id: row.id,
      name: row.name,
      from: { score: row.market_overlap_score, label: row.true_competitor_label },
      to: aligned,
    });
  }
  return fixed;
}

export default async function handler(req, res) {
  try {
    // Always realign any score/label drift before (or instead of) analysis
    const alignedRows = await alignExistingOverlapLabels();

    if (req.query?.alignOnly === '1' || req.query?.alignOnly === 'true') {
      return res.status(200).json({
        success: true,
        aligned: alignedRows.length,
        fixes: alignedRows,
        message: 'Overlap levels and labels realigned (high/medium/low/none)',
      });
    }

    const competitorId = req.query?.id || req.body?.competitorId;
    const staleOnly = req.query?.stale === '1' || req.query?.stale === 'true';
    const limitRaw = req.query?.limit ?? req.body?.limit;
    const limit = limitRaw != null && limitRaw !== '' ? Math.max(1, Number(limitRaw)) : null;

    let query = supabase.from('competitors').select('*').eq('status', 'active');
    if (competitorId) query = query.eq('id', competitorId);
    // Oldest / never-analyzed first when refreshing a few at a time (cron-safe)
    if (staleOnly || limit) {
      query = query.order('last_analyzed', { ascending: true, nullsFirst: true });
    }
    if (limit) query = query.limit(limit);

    const { data: competitors, error } = await query;
    if (error) throw error;
    if (!competitors?.length) {
      return res.status(200).json({
        success: true,
        analyzed: 0,
        aligned: alignedRows.length,
        message: 'No competitors to analyze',
      });
    }

    // Always load Divi's live website as the comparison baseline
    const diviPresence = await fetchPresenceBundle(DIVI_BASELINE.website, {
      companyName: 'Divi',
    });

    const diviRows = competitors.filter((c) => isDiviCompany(c));
    const others = competitors.filter((c) => !isDiviCompany(c));

    const processOne = async (comp) => {
      if (isDiviCompany(comp)) {
        const analysis = diviReferenceFromPresence(diviPresence);
        const result = await storeDeepProfile(comp, analysis, { isReference: true });
        return { id: comp.id, name: comp.name, reference: true, ...result };
      }
      const presence = await fetchPresenceBundle(comp.website, { companyName: comp.name });
      const analysis = await analyzeFromWebPresence(comp, presence, diviPresence);
      const result = await storeDeepProfile(comp, analysis);
      return {
        id: comp.id,
        name: comp.name,
        pages_fetched: presence.pagesFetched?.length || 0,
        pages: presence.pagesFetched || [],
        crawl_text_chars: presence.crawl_text_chars ?? null,
        crawl_thin: !!presence.crawl_thin,
        people_extracted: presence.people?.length || 0,
        linkedin: presence.linkedin?.url || null,
        linkedin_fetched: !!presence.linkedin?.fetched,
        claude_error: analysis._claudeError || null,
        ...result,
      };
    };

    const ordered = [...diviRows, ...others];
    const settled = await mapPool(ordered, CONCURRENCY, processOne);
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
      divi_pages_fetched: diviPresence.pagesFetched?.length || 0,
      divi_linkedin: diviPresence.linkedin?.url || null,
      timestamp: new Date().toISOString(),
      note: 'Website-grounded positioning vs Divi. Run supabase/03_positioning.sql if new columns error.',
      labels_aligned: alignedRows.length,
    });
  } catch (error) {
    console.error('Agent error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
