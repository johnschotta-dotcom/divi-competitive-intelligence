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

function cleanInsight(text, companyName) {
  let next = String(text || '').replace(/\s+/g, ' ').trim();
  if (companyName) {
    const escaped = companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    next = next.replace(new RegExp(escaped, 'gi'), 'this company');
  }
  return next.replace(/^[-•\s]+/, '').replace(/\s+/g, ' ').trim();
}

function tokens(text) {
  const stop = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'of',
    'to',
    'for',
    'in',
    'on',
    'with',
    'vs',
    'versus',
    'divi',
    'their',
    'they',
    'them',
    'this',
    'that',
    'from',
    'into',
    'over',
    'than',
    'more',
    'less',
    'not',
    'company',
    'site',
    'website',
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

function clusterInsights(entries, { minSimilarity = 0.42, limit = 10 } = {}) {
  const clusters = [];
  for (const entry of entries) {
    const text = cleanInsight(entry.text, entry.company);
    if (text.length < 12) continue;
    const words = tokens(text);
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
      matched.sources.push(entry.source);
      if (text.length > matched.text.length) {
        matched.text = text;
        matched.words = words;
      }
    } else {
      clusters.push({ text, words, sources: [entry.source] });
    }
  }

  return clusters
    .map((cluster) => {
      const unique = [];
      const seen = new Set();
      for (const source of cluster.sources) {
        if (seen.has(source.id)) continue;
        seen.add(source.id);
        unique.push(source);
      }
      unique.sort((a, b) => (OVERLAP_ORDER[a.level] ?? 9) - (OVERLAP_ORDER[b.level] ?? 9));
      const weight = unique.reduce((sum, source) => {
        if (source.level === 'high') return sum + 3;
        if (source.level === 'medium') return sum + 2;
        return sum + 1;
      }, 0);
      return {
        text: cluster.text,
        sources: unique,
        count: unique.length,
        weight,
      };
    })
    .sort((a, b) => b.weight - a.weight || b.count - a.count)
    .slice(0, limit);
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
  const recos = [];
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
      notesEntries.push({ text, company: row.name, source });
    }
    for (const strength of row.strengths) {
      const text = strength.strength_title
        ? `${strength.strength_title}${strength.why_its_strong ? `: ${strength.why_its_strong}` : ''}`
        : strength.why_its_strong;
      if (text) notesEntries.push({ text, company: row.name, source });
    }

    if (cmp.strategic_recommendation) {
      recos.push({
        text: String(cmp.strategic_recommendation).trim(),
        source,
      });
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

  const counts = {
    total: included.length,
    direct: included.filter((row) => row.label === 'direct').length,
    adjacent: included.filter((row) => row.label === 'adjacent').length,
    tangential: included.filter((row) => row.label === 'tangential').length,
  };

  recos.sort((a, b) => (OVERLAP_ORDER[a.source.level] ?? 9) - (OVERLAP_ORDER[b.source.level] ?? 9));

  return {
    counts,
    companies: included.map(({ comparison, strengths: _s, weaknesses: _w, ...rest }) => rest),
    whatWeDoWell: clusterInsights(winEntries, { limit: 8 }),
    whereWeLag: clusterInsights(gapEntries, { limit: 8 }),
    howToSeparate: clusterInsights(separateEntries, { limit: 8 }),
    notesToTake: clusterInsights(notesEntries, { limit: 12 }),
    recommendations: recos.slice(0, 10),
    capabilityRows,
    capabilities: rollupCapabilities(capabilityRows),
  };
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
  return Array.from(capability.values()).sort(
    (a, b) => b.competitor - a.competitor || b.divi - a.divi
  );
}

export function filterInsights(insights, labels) {
  if (!insights) return insights;
  const allow = new Set(labels);
  const keepSource = (item) => ({
    ...item,
    sources: (item.sources || []).filter((source) => allow.has(source.label)),
  });
  const prune = (list) =>
    (list || [])
      .map(keepSource)
      .filter((item) => item.sources.length)
      .map((item) => ({ ...item, count: item.sources.length }))
      .sort((a, b) => b.sources.length - a.sources.length);

  return {
    ...insights,
    companies: insights.companies.filter((row) => allow.has(row.label)),
    whatWeDoWell: prune(insights.whatWeDoWell),
    whereWeLag: prune(insights.whereWeLag),
    howToSeparate: prune(insights.howToSeparate),
    notesToTake: prune(insights.notesToTake),
    recommendations: insights.recommendations.filter((row) => allow.has(row.source.label)),
    capabilities: rollupCapabilities(
      (insights.capabilityRows || []).filter((row) => allow.has(row.designation))
    ),
  };
}
