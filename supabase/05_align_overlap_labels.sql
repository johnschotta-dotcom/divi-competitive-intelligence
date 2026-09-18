-- Map legacy numeric scores into qualitative overlap bands.
-- high(90)/direct · medium(65)/adjacent · low(35)/tangential · none(10)/not_a_competitor

UPDATE competitors
SET
  true_competitor_label = CASE
    WHEN true_competitor_label = 'reference' OR tier = 'reference' THEN 'reference'
    WHEN true_competitor_label = 'not_a_competitor' THEN 'not_a_competitor'
    WHEN COALESCE(market_overlap_score, threat_score) >= 80 THEN 'direct'
    WHEN COALESCE(market_overlap_score, threat_score) >= 50 THEN 'adjacent'
    WHEN COALESCE(market_overlap_score, threat_score) >= 20 THEN 'tangential'
    WHEN COALESCE(market_overlap_score, threat_score) IS NOT NULL THEN 'not_a_competitor'
    ELSE true_competitor_label
  END,
  market_overlap_score = CASE
    WHEN true_competitor_label = 'reference' OR tier = 'reference' THEN 100
    WHEN true_competitor_label = 'not_a_competitor'
      OR (true_competitor_label IS DISTINCT FROM 'direct'
          AND true_competitor_label IS DISTINCT FROM 'adjacent'
          AND true_competitor_label IS DISTINCT FROM 'tangential'
          AND COALESCE(market_overlap_score, threat_score) < 20)
      THEN 10
    WHEN COALESCE(market_overlap_score, threat_score) >= 80 OR true_competitor_label = 'direct' THEN 90
    WHEN COALESCE(market_overlap_score, threat_score) >= 50 OR true_competitor_label = 'adjacent' THEN 65
    WHEN COALESCE(market_overlap_score, threat_score) >= 20 OR true_competitor_label = 'tangential' THEN 35
    ELSE 10
  END,
  threat_score = CASE
    WHEN true_competitor_label = 'reference' OR tier = 'reference' THEN 100
    WHEN true_competitor_label = 'not_a_competitor' THEN 10
    WHEN true_competitor_label = 'direct' OR COALESCE(market_overlap_score, threat_score) >= 80 THEN 90
    WHEN true_competitor_label = 'adjacent' OR COALESCE(market_overlap_score, threat_score) >= 50 THEN 65
    WHEN true_competitor_label = 'tangential' OR COALESCE(market_overlap_score, threat_score) >= 20 THEN 35
    ELSE 10
  END,
  tier = CASE
    WHEN true_competitor_label = 'reference' OR tier = 'reference' THEN 'reference'
    WHEN true_competitor_label = 'not_a_competitor' THEN 'monitor'
    WHEN true_competitor_label = 'direct' THEN 'critical'
    WHEN true_competitor_label = 'adjacent' THEN 'high'
    WHEN true_competitor_label = 'tangential' THEN 'medium'
    ELSE 'monitor'
  END
WHERE COALESCE(tier, '') <> 'reference';

-- Second pass: set scores from the now-normalized labels
UPDATE competitors
SET
  market_overlap_score = CASE true_competitor_label
    WHEN 'reference' THEN 100
    WHEN 'direct' THEN 90
    WHEN 'adjacent' THEN 65
    WHEN 'tangential' THEN 35
    WHEN 'not_a_competitor' THEN 10
    ELSE market_overlap_score
  END,
  threat_score = CASE true_competitor_label
    WHEN 'reference' THEN 100
    WHEN 'direct' THEN 90
    WHEN 'adjacent' THEN 65
    WHEN 'tangential' THEN 35
    WHEN 'not_a_competitor' THEN 10
    ELSE threat_score
  END
WHERE COALESCE(true_competitor_label, '') <> '';

UPDATE divi_comparisons
SET
  true_competitor_label = CASE
    WHEN true_competitor_label = 'not_a_competitor' THEN 'not_a_competitor'
    WHEN market_overlap_score >= 80 THEN 'direct'
    WHEN market_overlap_score >= 50 THEN 'adjacent'
    WHEN market_overlap_score >= 20 THEN 'tangential'
    WHEN market_overlap_score IS NOT NULL THEN 'not_a_competitor'
    ELSE true_competitor_label
  END
WHERE COALESCE(true_competitor_label, '') <> 'reference';

UPDATE divi_comparisons
SET market_overlap_score = CASE true_competitor_label
  WHEN 'direct' THEN 90
  WHEN 'adjacent' THEN 65
  WHEN 'tangential' THEN 35
  WHEN 'not_a_competitor' THEN 10
  ELSE market_overlap_score
END
WHERE COALESCE(true_competitor_label, '') <> 'reference';
