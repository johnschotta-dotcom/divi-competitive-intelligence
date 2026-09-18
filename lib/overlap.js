/**
 * Overlap model (qualitative):
 *   high   → Direct competitor
 *   medium → Adjacent
 *   low    → Tangential
 *   none   → Not a competitor
 *
 * Numeric scores are kept only as a stable sort key / legacy DB field.
 */

export const OVERLAP_LEVELS = ['high', 'medium', 'low', 'none'];

const LEVEL_TO_LABEL = {
  high: 'direct',
  medium: 'adjacent',
  low: 'tangential',
  none: 'not_a_competitor',
  reference: 'reference',
};

const LABEL_TO_LEVEL = {
  direct: 'high',
  adjacent: 'medium',
  tangential: 'low',
  not_a_competitor: 'none',
  reference: 'reference',
};

/** Representative scores for sorting / legacy columns */
export const LEVEL_TO_SCORE = {
  high: 90,
  medium: 65,
  low: 35,
  none: 10,
  reference: 100,
};

const VALID_LABELS = new Set(Object.keys(LABEL_TO_LEVEL));

export function normalizeOverlapLevel(level) {
  if (level == null || level === '') return null;
  const raw = String(level).trim().toLowerCase();
  if (raw === 'no' || raw === 'none' || raw === 'zero' || raw === 'n/a') return 'none';
  if (raw === 'med') return 'medium';
  if (OVERLAP_LEVELS.includes(raw) || raw === 'reference') return raw;
  return null;
}

export function normalizeCompetitorLabel(label) {
  if (!label) return null;
  const raw = String(label).trim().toLowerCase().replace(/\s+/g, '_');
  if (raw === 'not_competitor' || raw === 'non_competitor' || raw === 'none') {
    return 'not_a_competitor';
  }
  if (VALID_LABELS.has(raw)) return raw;
  return null;
}

export function clampOverlapScore(score) {
  if (score == null || score === '') return null;
  const n = Number(score);
  if (Number.isNaN(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Legacy: map old 0–100 score into a level. */
export function levelFromOverlapScore(score) {
  const n = clampOverlapScore(score);
  if (n == null) return null;
  if (n >= 80) return 'high';
  if (n >= 50) return 'medium';
  if (n >= 20) return 'low';
  return 'none';
}

export function labelFromOverlapLevel(level) {
  const lv = normalizeOverlapLevel(level);
  return lv ? LEVEL_TO_LABEL[lv] : null;
}

export function levelFromCompetitorLabel(label) {
  const lb = normalizeCompetitorLabel(label);
  return lb ? LABEL_TO_LEVEL[lb] : null;
}

/** @deprecated use levelFromOverlapScore + labelFromOverlapLevel */
export function labelFromOverlapScore(score) {
  return labelFromOverlapLevel(levelFromOverlapScore(score));
}

export function formatOverlapLevel(level) {
  const lv = normalizeOverlapLevel(level);
  if (!lv) return '—';
  if (lv === 'none') return 'None';
  return lv.charAt(0).toUpperCase() + lv.slice(1);
}

export function formatCompetitorLabel(label) {
  const lb = normalizeCompetitorLabel(label);
  if (!lb) return '—';
  if (lb === 'not_a_competitor') return 'Not a competitor';
  if (lb === 'reference') return 'Gold standard';
  return lb.charAt(0).toUpperCase() + lb.slice(1);
}

/**
 * Resolve a single coherent overlap object.
 * Preference: explicit level → competitor label → legacy numeric score.
 * not_a_competitor / none always stick together.
 */
export function resolveOverlap({
  level = null,
  score = null,
  label = null,
  isReference = false,
} = {}) {
  if (isReference) {
    return {
      level: 'reference',
      label: 'reference',
      score: LEVEL_TO_SCORE.reference,
    };
  }

  const fromLevel = normalizeOverlapLevel(level);
  const fromLabel = normalizeCompetitorLabel(label);
  const fromScore = levelFromOverlapScore(score);

  // Explicit none / not-a-competitor wins
  if (fromLevel === 'none' || fromLabel === 'not_a_competitor') {
    return {
      level: 'none',
      label: 'not_a_competitor',
      score: LEVEL_TO_SCORE.none,
    };
  }

  const resolvedLevel =
    fromLevel || levelFromCompetitorLabel(fromLabel) || fromScore || null;

  if (!resolvedLevel) {
    return { level: null, label: fromLabel, score: clampOverlapScore(score) };
  }

  return {
    level: resolvedLevel,
    label: labelFromOverlapLevel(resolvedLevel),
    score: LEVEL_TO_SCORE[resolvedLevel],
  };
}

/** @deprecated prefer resolveOverlap */
export function alignedOverlap(score, label, { isReference = false, level = null } = {}) {
  return resolveOverlap({ score, label, level, isReference });
}

export function tierFromCompetitorLabel(label) {
  switch (normalizeCompetitorLabel(label) || label) {
    case 'direct':
      return 'critical';
    case 'adjacent':
      return 'high';
    case 'tangential':
      return 'medium';
    case 'not_a_competitor':
      return 'monitor';
    case 'reference':
      return 'reference';
    default:
      return 'monitor';
  }
}

export function tierFromOverlapLevel(level) {
  return tierFromCompetitorLabel(labelFromOverlapLevel(level));
}

export function displayCompetitorLabel(comp, { isReference = false } = {}) {
  if (isReference || comp?.tier === 'reference') return 'reference';
  const resolved = resolveOverlap({
    level: comp?.overlap_level,
    score: comp?.market_overlap_score ?? comp?.threat_score,
    label: comp?.true_competitor_label,
  });
  return resolved.label || '—';
}

export function displayOverlapLevel(comp, { isReference = false } = {}) {
  if (isReference || comp?.tier === 'reference') return 'reference';
  const resolved = resolveOverlap({
    level: comp?.overlap_level,
    score: comp?.market_overlap_score ?? comp?.threat_score,
    label: comp?.true_competitor_label,
  });
  return resolved.level || null;
}
