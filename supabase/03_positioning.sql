-- Positioning fields for website/LinkedIn-grounded Divi comparisons
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS market_overlap_score INT;
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS true_competitor_label VARCHAR(50);

ALTER TABLE divi_comparisons ADD COLUMN IF NOT EXISTS where_same JSONB DEFAULT '[]'::jsonb;
ALTER TABLE divi_comparisons ADD COLUMN IF NOT EXISTS where_differentiate JSONB DEFAULT '[]'::jsonb;
ALTER TABLE divi_comparisons ADD COLUMN IF NOT EXISTS market_overlap_score INT;
ALTER TABLE divi_comparisons ADD COLUMN IF NOT EXISTS true_competitor_label VARCHAR(50);
ALTER TABLE divi_comparisons ADD COLUMN IF NOT EXISTS evidence_basis TEXT;
