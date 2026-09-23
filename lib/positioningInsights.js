import { isDiviCompany } from './diviBaseline';
import {
  formatCompetitorLabel,
  formatOverlapLevel,
  resolveOverlap,
} from './overlap';

const OVERLAP_ORDER = { high: 0, medium: 1, low: 2 };

export const DESIGNATION_COLORS = {
  direct: '#e74c3c',
  adjacent: '#f39c12',
  tangential: '#3498db',
};

const THEMES = [
  {
    id: 'portfolio',
    title: 'Portfolio / system of record',
    re: /portfolio|system of record|cap table|holdings|tracker|tracking/i,
    keys: ['portfolio_tracking'],
    best: 'Divi is consistently the stronger post-investment system of record: holdings, ownership context, and ongoing visibility in one operating layer instead of a tracker attached to something else.',
    behind: 'Competitors more often win the first impression of “I can see and manage everything I own” — simpler reporting, broader holdings coverage, or a more familiar tracking surface.',
    actionTitle: 'Make the system of record obvious in session one',
    action:
      'Tighten first-run holdings setup and the core reporting views so new users feel Divi is the place their portfolio lives — not an intelligence layer they have to grow into.',
  },
  {
    id: 'ai',
    title: 'AI investor intelligence',
    re: /\bai\b|intelligence layer|health score|longitudinal|signal/i,
    keys: ['ai_intelligence', 'ai_differentiation'],
    best: 'Divi’s repeated edge is true investor intelligence — Investment Health Score™ and longitudinal signals that show what changed and where to act, not an AI label on a tracker.',
    behind: 'When Divi looks behind, it is usually because competitors make a simpler insight moment immediately visible. The depth of Health Score is not always obvious fast enough.',
    actionTitle: 'Put Health Score on the front door',
    action:
      'Lead website and first-run product with a concrete “what changed / what to do” moment so the AI edge is felt in minutes, not after a full portfolio is loaded.',
  },
  {
    id: 'founder_comms',
    title: 'Founder communications',
    re: /founder|update|inbox|communication/i,
    keys: ['founder_comms'],
    best: 'Divi more often wins on keeping founder updates with the portfolio instead of leaving them in inboxes and side channels.',
    behind: 'Competitors consistently look stronger when they make founder updates a primary, easy-to-scan surface. Divi’s comms advantage is not always the headline.',
    actionTitle: 'Treat founder updates as a daily habit, not a feature',
    action:
      'Make update capture and a simple “what founders said / what changed” view a default weekly workflow so Divi owns the comms job as clearly as it owns scoring.',
  },
  {
    id: 'coinvestor',
    title: 'Co-investor & market context',
    re: /co-?investor|network effect|lp\b|fund admin|market context/i,
    keys: ['coinvestor_context'],
    best: 'Divi is stronger when the job is context for decisions — co-investor activity and market signal next to holdings, not a standalone network.',
    behind: 'Competitors often out-claim Divi on network density, social proof, and “who else is in this deal.” That reads as context even when it is really distribution.',
    actionTitle: 'Show context without chasing a social network',
    action:
      'Ship a tighter co-investor / market-context view on each holding so operators see who is around a company and what moved — without turning Divi into a deal marketplace.',
  },
  {
    id: 'syndicate',
    title: 'Syndicate / SPV tools',
    re: /syndicate|spv|carry|deal.?vehicle/i,
    keys: ['syndicate_tools'],
    best: 'Divi’s syndicate/SPV workflows are a consistent advantage when the buyer is an angel or emerging manager who needs to act, not only to watch.',
    behind: 'Where Divi is behind, competitors usually look more complete on vehicle mechanics, fees, or the path from interest to close.',
    actionTitle: 'Close the gap from insight to vehicle',
    action:
      'Shorten the path from a Health Score or update to starting or managing a syndicate, and make the mechanics as clear as the intelligence.',
  },
  {
    id: 'deal_flow',
    title: 'Deal flow & discovery',
    re: /deal flow|marketplace|discovery|sourcing|deal.?sourc/i,
    keys: ['deal_flow'],
    best: 'Divi is not trying to win deal marketplaces. Analyses that favor Divi here treat discovery as secondary to post-investment operating quality.',
    behind: 'Competitors consistently win attention with deal flow, marketplaces, and sourcing. That is a real acquisition surface even when it is not Divi’s core job.',
    actionTitle: 'Borrow discovery heat without becoming a marketplace',
    action:
      'Do not rebuild a deal exchange. Add a lightweight way to park, share, or revisit opportunities inside the same system of record so sourcing does not pull users off Divi.',
  },
  {
    id: 'education',
    title: 'Investor skill-building',
    re: /educat|skill|learn|community|partner value|become a better/i,
    keys: ['education'],
    best: 'Divi more often wins on making investors more useful to founders — better decisions from the portfolio, not a content library.',
    behind: 'Competitors look ahead when they package education, community, or “how to invest” as a visible product. Divi’s partner-value story can read abstract next to that.',
    actionTitle: 'Turn intelligence into a coaching loop',
    action:
      'Attach a simple next action to each Health Score and update — where the investor can help the founder — so skill-building is in the product, not a separate curriculum.',
  },
  {
    id: 'pricing',
    title: 'Pricing & accessibility',
    re: /pric|afford|accessible|\b99\b|angel.?friendly|individual angel/i,
    keys: ['pricing_accessibility'],
    best: 'Divi is consistently better aligned to individual angels and small syndicates rather than institutional fund-admin pricing.',
    behind: 'Competitors sometimes look easier to buy — clearer packaging, free entry points, or a cheaper-looking first step.',
    actionTitle: 'Make the buy path as clear as the product story',
    action:
      'Spell out who Divi is for, what $99-style packaging includes, and the first value moment before a full rollout so accessibility is obvious on the site.',
  },
  {
    id: 'workflow',
    title: 'Day-to-day workflow',
    re: /workflow|operating system|\bos\b|day-to-day|one place|system of/i,
    keys: ['workflow_depth'],
    best: 'Divi repeatedly wins as the operating system: track, communicate, score health, then act — one workflow instead of a pile of tools.',
    behind: 'Competitors look stronger when they nail one daily habit (check deals, scan a feed, update a cap table). Divi’s end-to-end story can feel heavier.',
    actionTitle: 'Pick one daily habit and own it',
    action:
      'Choose a single weekly loop (updates in, health out, one action) and make that the default home experience so Divi is a habit, not a suite.',
  },
  {
    id: 'positioning',
    title: 'Category / positioning',
    re: /position|category|gold standard|not a (true )?competitor|adjacent|tangential|direct/i,
    keys: [],
    best: 'When analyses favor Divi, they treat it as the intelligence layer / system of record for private-market operators — not a generic investing app.',
    behind: 'Competitors often occupy a clearer public category (marketplace, tracker, network). Divi’s “intelligence layer” story still needs a sharper one-line job.',
    actionTitle: 'Lock a one-line job-to-be-done',
    action:
      'Lead with a single job: the system of record that tells angels what changed in their portfolio and what to do next. Park adjacent categories as “also,” not the headline.',
  },
];

const THEME_BY_ID = new Map(THEMES.map((theme) => [theme.id, theme]));
const KEY_TO_THEME = new Map();
for (const theme of THEMES) {
  for (const key of theme.keys || []) KEY_TO_THEME.set(key, theme.id);
}

function asList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (!item || typeof item !== 'object') return '';
        return String(item.title || item.text || item.why || item.summary || '').trim();
      })
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      return asList(JSON.parse(trimmed));
    } catch {
      return [trimmed];
    }
  }
  return [];
}

function assignTheme(text, featureKey = '') {
  const fromKey = KEY_TO_THEME.get(String(featureKey || '').trim());
  if (fromKey) return THEME_BY_ID.get(fromKey);
  const hay = String(text || '');
  for (const theme of THEMES) {
    if (theme.re.test(hay)) return theme;
  }
  return null;
}

function uniqueSources(list) {
  const unique = [];
  const seen = new Set();
  for (const source of list || []) {
    if (!source || seen.has(source.id)) continue;
    seen.add(source.id);
    unique.push(source);
  }
  unique.sort((a, b) => (OVERLAP_ORDER[a.level] ?? 9) - (OVERLAP_ORDER[b.level] ?? 9));
  return unique;
}

function sourceWeight(sources) {
  return uniqueSources(sources).reduce((sum, source) => {
    if (source.level === 'high') return sum + 3;
    if (source.level === 'medium') return sum + 2;
    return sum + 1;
  }, 0);
}

function emptyTheme(def) {
  return {
    id: def.id,
    title: def.title,
    winSources: [],
    lagSources: [],
    actionSources: [],
    capDivi: 0,
    capCompetitor: 0,
    capTie: 0,
  };
}

function overlapMeta(comp, comparison) {
  return resolveOverlap({
    score: comparison?.market_overlap_score ?? comp?.market_overlap_score ?? comp?.threat_score,
    label: comparison?.true_competitor_label || comp?.true_competitor_label,
  });
}

function sourceFrom(comp, comparison) {
  const overlap = overlapMeta(comp, comparison);
  return {
    id: comp.id,
    name: comp.name,
    website: comp.website,
    logo_url: comp.logo_url,
    tagline: comp.tagline,
    level: overlap.level,
    label: overlap.label,
    levelDisplay: formatOverlapLevel(overlap.level),
    labelDisplay: formatCompetitorLabel(overlap.label),
    last_analyzed: comp.last_analyzed || comparison?.analyzed_at || null,
  };
}

function matrixRows(comparison) {
  const matrix = comparison?.feature_matrix;
  return Array.isArray(matrix) ? matrix : [];
}

function addSource(bucket, source) {
  if (!source) return;
  bucket.push(source);
}

function isConsistent(sources, totalCompanies) {
  const n = uniqueSources(sources).length;
  if (!n) return false;
  if (totalCompanies <= 1) return n >= 1;
  return n >= 2;
}

function latestAnalyzedAt(companies) {
  let latest = 0;
  for (const company of companies || []) {
    const time = Date.parse(company.last_analyzed || '');
    if (!Number.isNaN(time) && time > latest) latest = time;
  }
  return latest || null;
}

function joinTitles(items, fallback) {
  const titles = (items || []).slice(0, 3).map((item) => item.title.replace(/[.]+$/, ''));
  if (!titles.length) return fallback;
  if (titles.length === 1) return titles[0];
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
  return `${titles[0]}, ${titles[1]}, and ${titles[2]}`;
}

function toCard(theme, kind, sources) {
  const def = THEME_BY_ID.get(theme.id);
  const list = uniqueSources(sources);
  const copy =
    kind === 'best' ? def.best : kind === 'behind' ? def.behind : def.action;
  const title = kind === 'action' ? def.actionTitle : def.title;
  const direct = list.filter((source) => source.label === 'direct').length;
  return {
    id: `${theme.id}-${kind}`,
    themeId: theme.id,
    title,
    summary: copy,
    sources: list,
    count: list.length,
    weight: sourceWeight(list),
    crossover: list.length >= 2,
    priority: direct > 0 ? 'now' : 'next',
  };
}

function synthesizeBrief({ companies = [], themes = [], counts }) {
  const total = companies.length;
  const ranked = [...themes].sort(
    (a, b) =>
      sourceWeight([...b.winSources, ...b.lagSources]) -
      sourceWeight([...a.winSources, ...a.lagSources])
  );

  const best = ranked
    .filter((theme) => isConsistent(theme.winSources, total))
    .map((theme) => toCard(theme, 'best', theme.winSources))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  const behind = ranked
    .filter((theme) => isConsistent(theme.lagSources, total))
    .map((theme) => toCard(theme, 'behind', theme.lagSources))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  const actionThemes = ranked.filter(
    (theme) =>
      isConsistent(theme.lagSources, total) || isConsistent(theme.actionSources, total)
  );
  const nextSteps = actionThemes
    .map((theme) =>
      toCard(theme, 'action', [...theme.lagSources, ...theme.actionSources])
    )
    .sort((a, b) => (a.priority === 'now' ? 0 : 1) - (b.priority === 'now' ? 0 : 1) || b.weight - a.weight)
    .slice(0, 6);

  const parts = [];
  if (total) {
    parts.push(
      `This brief summarizes ${total} overlapping ${total === 1 ? 'analysis' : 'analyses'} — original takeaways, not copied profile language. Companies with no overlap are excluded.`
    );
  }
  if (best.length) {
    parts.push(`Divi is most consistently strongest on ${joinTitles(best, 'its core workflow')}.`);
  }
  if (behind.length) {
    parts.push(`Competitors most often outpace Divi on ${joinTitles(behind, 'a few visible jobs')}.`);
  }
  if (nextSteps.length) {
    parts.push(`Next moves start with ${joinTitles(nextSteps, 'a tighter first-run')}.`);
  }

  return {
    counts: counts || {
      total,
      direct: companies.filter((row) => row.label === 'direct').length,
      adjacent: companies.filter((row) => row.label === 'adjacent').length,
      tangential: companies.filter((row) => row.label === 'tangential').length,
    },
    companies,
    themes,
    latestAnalyzedAt: latestAnalyzedAt(companies),
    overview: parts.join(' '),
    whatWeDoWell: best,
    whereWeLag: behind,
    nextSteps,
  };
}

/**
 * Build a market-level positioning brief from analyzed companies.
 * Excludes Divi, unanalyzed rows, and anyone with no overlap.
 */
export function buildPositioningInsights({
  competitors = [],
  comparisons = [],
  strengths = [],
  weaknesses = [],
} = {}) {
  const comparisonById = new Map(
    (comparisons || []).map((row) => [row.competitor_id, row])
  );
  const strengthsById = new Map();
  for (const row of strengths || []) {
    const list = strengthsById.get(row.competitor_id) || [];
    list.push(row);
    strengthsById.set(row.competitor_id, list);
  }
  const weaknessesById = new Map();
  for (const row of weaknesses || []) {
    const list = weaknessesById.get(row.competitor_id) || [];
    list.push(row);
    weaknessesById.set(row.competitor_id, list);
  }

  const included = [];
  for (const comp of competitors || []) {
    if (!comp || isDiviCompany(comp) || comp.tier === 'reference') continue;
    const comparison = comparisonById.get(comp.id);
    const analyzed = !!(comp.last_analyzed || comparison?.overall_verdict || comparison?.analyzed_at);
    if (!analyzed) continue;
    const overlap = overlapMeta(comp, comparison);
    if (!overlap.level || overlap.level === 'none') continue;
    included.push({
      ...sourceFrom(comp, comparison),
      comparison: comparison || {},
      strengths: strengthsById.get(comp.id) || [],
      weaknesses: weaknessesById.get(comp.id) || [],
    });
  }

  included.sort((a, b) => (OVERLAP_ORDER[a.level] ?? 9) - (OVERLAP_ORDER[b.level] ?? 9));

  const themeMap = new Map(THEMES.map((def) => [def.id, emptyTheme(def)]));

  const pushTheme = (themeId, field, source) => {
    if (!themeId || !themeMap.has(themeId)) return;
    addSource(themeMap.get(themeId)[field], source);
  };

  for (const row of included) {
    const source = {
      id: row.id,
      name: row.name,
      level: row.level,
      label: row.label,
      labelDisplay: row.labelDisplay,
      last_analyzed: row.last_analyzed,
    };
    const cmp = row.comparison || {};

    for (const text of asList(cmp.divi_wins || cmp.where_we_win)) {
      pushTheme(assignTheme(text)?.id, 'winSources', source);
    }
    for (const weakness of row.weaknesses) {
      const text = `${weakness.divi_advantage || ''} ${weakness.weakness_title || ''}`;
      pushTheme(assignTheme(text)?.id, 'winSources', source);
    }

    for (const text of asList(cmp.competitor_wins || cmp.where_we_fall_short)) {
      pushTheme(assignTheme(text)?.id, 'lagSources', source);
    }

    for (const text of asList(cmp.where_differentiate || cmp.where_they_differentiate)) {
      pushTheme(assignTheme(text)?.id, 'actionSources', source);
    }

    for (const text of asList(cmp.strategic_recommendation)) {
      pushTheme(assignTheme(text)?.id, 'actionSources', source);
    }

    for (const cell of matrixRows(cmp)) {
      const theme = assignTheme(cell.label || cell.feature, cell.feature || cell.key);
      if (!theme) continue;
      const bucket = themeMap.get(theme.id);
      const winner = String(cell.winner || 'tie').toLowerCase();
      if (winner === 'divi') {
        bucket.capDivi += 1;
        pushTheme(theme.id, 'winSources', source);
      } else if (winner === 'competitor') {
        bucket.capCompetitor += 1;
        pushTheme(theme.id, 'lagSources', source);
      } else {
        bucket.capTie += 1;
      }
    }
  }

  const companies = included.map(({ comparison, strengths: _s, weaknesses: _w, ...rest }) => rest);
  return synthesizeBrief({
    companies,
    themes: Array.from(themeMap.values()),
    counts: {
      total: included.length,
      direct: included.filter((row) => row.label === 'direct').length,
      adjacent: included.filter((row) => row.label === 'adjacent').length,
      tangential: included.filter((row) => row.label === 'tangential').length,
    },
  });
}

function filterTheme(theme, allow) {
  const keep = (list) => uniqueSources((list || []).filter((source) => allow.has(source.label)));
  return {
    ...theme,
    winSources: keep(theme.winSources),
    lagSources: keep(theme.lagSources),
    actionSources: keep(theme.actionSources),
  };
}

export function filterInsights(insights, labels) {
  if (!insights) return insights;
  const allow = new Set(labels);
  const companies = (insights.companies || []).filter((row) => allow.has(row.label));
  const themes = (insights.themes || []).map((theme) => filterTheme(theme, allow));
  return synthesizeBrief({
    companies,
    themes,
    counts: insights.counts,
  });
}
