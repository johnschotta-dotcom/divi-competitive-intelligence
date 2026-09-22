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
  { id: 'portfolio', title: 'Portfolio / system of record', re: /portfolio|system of record|cap table|holdings|tracker|tracking/i },
  { id: 'ai', title: 'AI investor intelligence', re: /\bai\b|intelligence layer|health score|longitudinal|signal/i },
  { id: 'founder_comms', title: 'Founder communications', re: /founder|update|inbox|communication/i },
  { id: 'coinvestor', title: 'Co-investor & market context', re: /co-?investor|network effect|lp\b|fund admin|market context/i },
  { id: 'syndicate', title: 'Syndicate / SPV tools', re: /syndicate|spv|carry|deal.?vehicle/i },
  { id: 'deal_flow', title: 'Deal flow & discovery', re: /deal flow|marketplace|discovery|sourcing|deal.?sourc/i },
  { id: 'education', title: 'Investor skill-building', re: /educat|skill|learn|community|partner value|become a better/i },
  { id: 'pricing', title: 'Pricing & accessibility', re: /pric|afford|accessible|\b99\b|angel.?friendly|individual angel/i },
  { id: 'workflow', title: 'Day-to-day workflow', re: /workflow|operating system|\bos\b|day-to-day|one place|system of/i },
  { id: 'positioning', title: 'Category / positioning', re: /position|category|gold standard|not a (true )?competitor|adjacent|tangential|direct/i },
];

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

function splitProse(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 24);
}

function cleanInsight(text, companyName) {
  let next = String(text || '').replace(/\s+/g, ' ').trim();
  if (companyName) {
    const escaped = companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    next = next.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), 'they');
  }
  return next
    .replace(/\bthey they\b/gi, 'they')
    .replace(/^[-•\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text) {
  const stop = new Set([
    'the', 'a', 'an', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'with', 'vs',
    'versus', 'divi', 'their', 'they', 'them', 'this', 'that', 'from', 'into',
    'over', 'than', 'more', 'less', 'not', 'company', 'site', 'website', 'should',
    'could', 'would', 'also', 'across', 'while', 'where', 'what', 'how',
  ]);
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stop.has(word));
}

function jaccard(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  let inter = 0;
  left.forEach((word) => {
    if (right.has(word)) inter += 1;
  });
  const union = left.size + right.size - inter;
  return union ? inter / union : 0;
}

function assignTheme(text) {
  for (const theme of THEMES) {
    if (theme.re.test(text)) return theme;
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

function shorten(text, max = 140) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean.replace(/[.]+$/, '');
  const cut = clean.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return `${(at > 60 ? cut.slice(0, at) : cut).trim()}…`;
}

function condenseTexts(texts) {
  const cleaned = [...new Set((texts || []).map((t) => String(t).trim()).filter((t) => t.length >= 12))];
  if (!cleaned.length) return { summary: '', extras: [] };

  const ranked = cleaned
    .map((text) => ({
      text,
      score: Math.abs(text.length - 110) + (tokens(text).length < 4 ? 40 : 0),
    }))
    .sort((a, b) => a.score - b.score);

  const summary = shorten(ranked[0].text, 180);
  const base = new Set(tokens(summary));
  const extras = [];
  const extraSeen = new Set();
  for (const text of cleaned) {
    if (text === ranked[0].text) continue;
    const novel = tokens(text).filter((word) => !base.has(word));
    if (novel.length < 3) continue;
    const line = shorten(text, 110);
    const key = tokens(line).slice(0, 5).join(' ');
    if (extraSeen.has(key)) continue;
    extraSeen.add(key);
    extras.push(line);
    if (extras.length >= 3) break;
  }
  return { summary, extras };
}

function toInsight(partial) {
  const sources = uniqueSources(partial.sources);
  return {
    id: partial.id,
    title: partial.title,
    summary: partial.summary,
    extras: partial.extras || [],
    sources,
    count: sources.length,
    weight: sourceWeight(sources),
    crossover: sources.length >= 2,
  };
}

function mergeBucket(entries, title, id) {
  const { summary, extras } = condenseTexts(entries.map((entry) => entry.text));
  return toInsight({
    id,
    title,
    summary,
    extras,
    sources: entries.map((entry) => entry.source),
  });
}

function clusterUnthemed(entries, { minSimilarity = 0.34 } = {}) {
  const clusters = [];
  for (const entry of entries) {
    const words = tokens(entry.text);
    if (words.length < 2) continue;
    let matched = null;
    let best = minSimilarity;
    for (const cluster of clusters) {
      const score = jaccard(words, cluster.words);
      if (score > best) {
        best = score;
        matched = cluster;
      }
    }
    if (matched) {
      matched.entries.push(entry);
      if (entry.text.length < matched.words.join(' ').length + 40) {
        matched.words = words;
      }
    } else {
      clusters.push({ entries: [entry], words });
    }
  }

  return clusters.map((cluster, index) => {
    const { summary, extras } = condenseTexts(cluster.entries.map((entry) => entry.text));
    const title = shorten(summary, 72);
    return toInsight({
      id: `loose-${index}-${title}`,
      title,
      summary,
      extras,
      sources: cluster.entries.map((entry) => entry.source),
    });
  });
}

function clusterEntries(entries) {
  const byTheme = new Map();
  const unthemed = [];
  for (const entry of entries) {
    const text = cleanInsight(entry.text, entry.company);
    if (text.length < 12) continue;
    const theme = assignTheme(text);
    const next = { ...entry, text };
    if (theme) {
      const list = byTheme.get(theme.id) || [];
      list.push(next);
      byTheme.set(theme.id, list);
    } else {
      unthemed.push(next);
    }
  }

  const themed = Array.from(byTheme.entries()).map(([id, list]) => {
    const title = THEMES.find((theme) => theme.id === id)?.title || id;
    return mergeBucket(list, title, id);
  });

  return [...themed, ...clusterUnthemed(unthemed)]
    .filter((item) => item.summary)
    .sort((a, b) => Number(b.crossover) - Number(a.crossover) || b.weight - a.weight || b.count - a.count);
}

function tokenSet(insight) {
  return new Set(tokens(`${insight.title} ${insight.summary} ${(insight.extras || []).join(' ')}`));
}

function tooSimilar(a, b) {
  return jaccard([...tokenSet(a)], [...tokenSet(b)]) >= 0.5;
}

function dedupeAgainst(items, against) {
  return (items || []).filter((item) => !(against || []).some((other) => tooSimilar(item, other)));
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
  };
}

function matrixRows(comparison) {
  const matrix = comparison?.feature_matrix;
  return Array.isArray(matrix) ? matrix : [];
}

function joinTitles(items, fallback) {
  const titles = (items || []).slice(0, 3).map((item) => item.title.replace(/[.]+$/, ''));
  if (!titles.length) return fallback;
  if (titles.length === 1) return titles[0];
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
  return `${titles[0]}, ${titles[1]}, and ${titles[2]}`;
}

export function buildOverview(insights) {
  const companies = insights?.companies || [];
  const n = companies.length;
  if (!n) return '';

  const well = (insights.whatWeDoWell || []).filter((item) => item.crossover);
  const lag = (insights.whereWeLag || []).filter((item) => item.crossover);
  const sep = (insights.howToSeparate || []).filter((item) => item.crossover);
  const parts = [
    `Across ${n} overlapping ${n === 1 ? 'analysis' : 'analyses'}, themes that show up in more than one profile are treated as market signal — one-off points stay attached as source tags.`,
  ];
  if (well.length) {
    parts.push(`Divi’s repeated edge is ${joinTitles(well, 'unclear')}.`);
  }
  if (lag.length) {
    parts.push(`The market most often out-claims Divi on ${joinTitles(lag, 'unclear')}.`);
  }
  if (sep.length) {
    parts.push(`The strongest separation plays are ${joinTitles(sep, 'unclear')}.`);
  }
  return parts.join(' ');
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

  const winEntries = [];
  const gapEntries = [];
  const separateEntries = [];
  const notesEntries = [];
  const capabilityRows = [];

  for (const row of included) {
    const source = {
      id: row.id,
      name: row.name,
      level: row.level,
      label: row.label,
      labelDisplay: row.labelDisplay,
    };
    const cmp = row.comparison || {};

    for (const text of asList(cmp.divi_wins || cmp.where_we_win)) {
      winEntries.push({ text, company: row.name, source });
    }
    for (const weakness of row.weaknesses) {
      const text = weakness.divi_advantage || weakness.weakness_title;
      if (text) winEntries.push({ text, company: row.name, source });
    }

    for (const text of asList(cmp.competitor_wins || cmp.where_we_fall_short)) {
      gapEntries.push({ text, company: row.name, source });
    }

    for (const text of asList(cmp.where_differentiate || cmp.where_they_differentiate)) {
      separateEntries.push({ text, company: row.name, source });
    }
    for (const sentence of splitProse(cmp.strategic_recommendation)) {
      separateEntries.push({ text: sentence, company: row.name, source });
    }

    for (const strength of row.strengths) {
      const text = strength.strength_title
        ? `${strength.strength_title}${strength.why_its_strong ? `: ${strength.why_its_strong}` : ''}`
        : strength.why_its_strong;
      if (text) notesEntries.push({ text, company: row.name, source });
    }
    for (const text of asList(cmp.where_same)) {
      notesEntries.push({ text, company: row.name, source });
    }

    for (const cell of matrixRows(cmp)) {
      const key = cell.label || cell.feature;
      if (!key) continue;
      const winner = String(cell.winner || 'tie').toLowerCase();
      capabilityRows.push({
        label: key,
        winner: winner === 'divi' || winner === 'competitor' ? winner : 'tie',
        designation: source.label,
      });
    }
  }

  const whatWeDoWell = clusterEntries(winEntries);
  const whereWeLag = clusterEntries(gapEntries);
  const howToSeparate = dedupeAgainst(clusterEntries(separateEntries), [...whatWeDoWell, ...whereWeLag]);
  const notesToTake = dedupeAgainst(clusterEntries(notesEntries), [
    ...whatWeDoWell,
    ...whereWeLag,
    ...howToSeparate,
  ]);

  const counts = {
    total: included.length,
    direct: included.filter((row) => row.label === 'direct').length,
    adjacent: included.filter((row) => row.label === 'adjacent').length,
    tangential: included.filter((row) => row.label === 'tangential').length,
  };

  const companies = included.map(({ comparison, strengths: _s, weaknesses: _w, ...rest }) => rest);
  const insights = {
    counts,
    companies,
    whatWeDoWell,
    whereWeLag,
    howToSeparate,
    notesToTake,
    capabilityRows,
    capabilities: rollupCapabilities(capabilityRows),
  };
  insights.overview = buildOverview(insights);
  return insights;
}

function rollupCapabilities(rows) {
  const capability = new Map();
  for (const row of rows || []) {
    const prev = capability.get(row.label) || { label: row.label, divi: 0, competitor: 0, tie: 0 };
    if (row.winner === 'divi') prev.divi += 1;
    else if (row.winner === 'competitor') prev.competitor += 1;
    else prev.tie += 1;
    capability.set(row.label, prev);
  }
  return Array.from(capability.values())
    .filter((row) => row.divi + row.competitor > 0)
    .sort((a, b) => b.competitor - a.competitor || b.divi - a.divi);
}

function pruneList(list, allow) {
  return (list || [])
    .map((item) => {
      const sources = uniqueSources((item.sources || []).filter((source) => allow.has(source.label)));
      return {
        ...item,
        sources,
        count: sources.length,
        weight: sourceWeight(sources),
        crossover: sources.length >= 2,
      };
    })
    .filter((item) => item.sources.length)
    .sort((a, b) => Number(b.crossover) - Number(a.crossover) || b.weight - a.weight || b.count - a.count);
}

export function filterInsights(insights, labels) {
  if (!insights) return insights;
  const allow = new Set(labels);
  const next = {
    ...insights,
    companies: (insights.companies || []).filter((row) => allow.has(row.label)),
    whatWeDoWell: pruneList(insights.whatWeDoWell, allow),
    whereWeLag: pruneList(insights.whereWeLag, allow),
    howToSeparate: pruneList(insights.howToSeparate, allow),
    notesToTake: pruneList(insights.notesToTake, allow),
    capabilities: rollupCapabilities(
      (insights.capabilityRows || []).filter((row) => allow.has(row.designation))
    ),
  };
  next.overview = buildOverview(next);
  return next;
}
