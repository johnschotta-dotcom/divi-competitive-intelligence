-- Keep score/label bands consistent WITHOUT promoting intentional not-a-competitor
-- rows into tangential when their score sat in 20–49.
--
-- 1) If labeled not_a_competitor, clamp score into 0–19
-- 2) Else derive label from score (80+ direct · 50–79 adjacent · 20–49 tangential · 0–19 not_a_competitor)

UPDATE competitors
SET
  market_overlap_score = CASE
    WHEN true_competitor_label = 'not_a_competitor' THEN LEAST(COALESCE(market_overlap_score, threat_score, 10), 19)
    ELSE COALESCE(market_overlap_score, threat_score)
  END,
  threat_score = CASE
    WHEN true_competitor_label = 'not_a_competitor' THEN LEAST(COALESCE(market_overlap_score, threat_score, 10), 19)
    ELSE COALESCE(market_overlap_score, threat_score)
  END,
  true_competitor_label = CASE
    WHEN true_competitor_label = 'reference' THEN 'reference'
    WHEN true_competitor_label = 'not_a_competitor' THEN 'not_a_competitor'
    WHEN COALESCE(market_overlap_score, threat_score) >= 80 THEN 'direct'
    WHEN COALESCE(market_overlap_score, threat_score) >= 50 THEN 'adjacent'
    WHEN COALESCE(market_overlap_score, threat_score) >= 20 THEN 'tangential'
    WHEN COALESCE(market_overlap_score, threat_score) IS NOT NULL THEN 'not_a_competitor'
    ELSE true_competitor_label
  END,
  tier = CASE
    WHEN true_competitor_label = 'reference' OR tier = 'reference' THEN 'reference'
    WHEN true_competitor_label = 'not_a_competitor' THEN 'monitor'
    WHEN COALESCE(market_overlap_score, threat_score) >= 80 THEN 'critical'
    WHEN COALESCE(market_overlap_score, threat_score) >= 50 THEN 'high'
    WHEN COALESCE(market_overlap_score, threat_score) >= 20 THEN 'medium'
    ELSE 'monitor'
  END
WHERE COALESCE(true_competitor_label, '') <> 'reference'
  AND COALESCE(tier, '') <> 'reference';

UPDATE divi_comparisons dc
SET
  market_overlap_score = CASE
    WHEN true_competitor_label = 'not_a_competitor' THEN LEAST(COALESCE(market_overlap_score, 10), 19)
    ELSE market_overlap_score
  END,
  true_competitor_label = CASE
    WHEN true_competitor_label = 'not_a_competitor' THEN 'not_a_competitor'
    WHEN market_overlap_score >= 80 THEN 'direct'
    WHEN market_overlap_score >= 50 THEN 'adjacent'
    WHEN market_overlap_score >= 20 THEN 'tangential'
    WHEN market_overlap_score IS NOT NULL THEN 'not_a_competitor'
    ELSE true_competitor_label
  END
WHERE COALESCE(true_competitor_label, '') <> 'reference';
