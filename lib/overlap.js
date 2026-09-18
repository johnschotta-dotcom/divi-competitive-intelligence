/**
 * Market overlap score ↔ true-competitor label bands (single source of truth).
 * 80–100 direct · 50–79 adjacent · 20–49 tangential · 0–19 not_a_competitor
 */

export const OVERLAP_BANDS = [
  { min: 80, max: 100, label: 'direct' },
  { min: 50, max: 79, label: 'adjacent' },
  { min: 20, max: 49, label: 'tangential' },
  { min: 0, max: 19, label: 'not_a_competitor' },
];

const VALID_LABELS = new Set([
  'direct',
  'adjacent',
  'tangential',
  'not_a_competitor',
  'reference',
]);

export function clampOverlapScore(score) {
  if (score == null || score === '') return null;
  const n = Number(score);
  if (Number.isNaN(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Derive label strictly from overlap score. */
export function labelFromOverlapScore(score) {
  const n = clampOverlapScore(score);
  if (n == null) return null;
  if (n >= 80) return 'direct';
  if (n >= 50) return 'adjacent';
  if (n >= 20) return 'tangential';
  return 'not_a_competitor';
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

/**
 * Prefer score → label. If only a label exists, keep it when valid.
 * Reference profiles stay "reference".
 */
export function alignedOverlap(score, label, { isReference = false } = {}) {
  if (isReference) {
    return { score: clampOverlapScore(score) ?? 100, label: 'reference' };
  }
  const n = clampOverlapScore(score);
  if (n != null) {
    return { score: n, label: labelFromOverlapScore(n) };
  }
  const normalized = normalizeCompetitorLabel(label);
  return { score: null, label: normalized };
}

/** Map competitor label → dashboard tier color key. */
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

/** Display label for UI — always score-driven when a score exists. */
export function displayCompetitorLabel(comp, { isReference = false } = {}) {
  if (isReference || comp?.tier === 'reference') return 'reference';
  const score = comp?.market_overlap_score ?? comp?.threat_score;
  const aligned = alignedOverlap(score, comp?.true_competitor_label);
  return aligned.label || '—';
}
