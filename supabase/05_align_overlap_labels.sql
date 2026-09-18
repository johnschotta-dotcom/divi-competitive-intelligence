-- Realign true_competitor_label to market_overlap_score bands:
-- 80–100 direct · 50–79 adjacent · 20–49 tangential · 0–19 not_a_competitor

UPDATE competitors
SET true_competitor_label = CASE
  WHEN market_overlap_score IS NULL THEN true_competitor_label
  WHEN market_overlap_score >= 80 THEN 'direct'
  WHEN market_overlap_score >= 50 THEN 'adjacent'
  WHEN market_overlap_score >= 20 THEN 'tangential'
  ELSE 'not_a_competitor'
END,
tier = CASE
  WHEN market_overlap_score IS NULL THEN tier
  WHEN market_overlap_score >= 80 THEN 'critical'
  WHEN market_overlap_score >= 50 THEN 'high'
  WHEN market_overlap_score >= 20 THEN 'medium'
  ELSE 'monitor'
END,
threat_score = COALESCE(market_overlap_score, threat_score)
WHERE COALESCE(true_competitor_label, '') <> 'reference'
  AND market_overlap_score IS NOT NULL;

UPDATE divi_comparisons dc
SET true_competitor_label = CASE
  WHEN market_overlap_score IS NULL THEN true_competitor_label
  WHEN market_overlap_score >= 80 THEN 'direct'
  WHEN market_overlap_score >= 50 THEN 'adjacent'
  WHEN market_overlap_score >= 20 THEN 'tangential'
  ELSE 'not_a_competitor'
END
WHERE COALESCE(true_competitor_label, '') <> 'reference'
  AND market_overlap_score IS NOT NULL;
