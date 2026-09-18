-- Enrichment fields for website-extracted team members
ALTER TABLE competitor_founders ADD COLUMN IF NOT EXISTS prior_companies TEXT;
ALTER TABLE competitor_founders ADD COLUMN IF NOT EXISTS education TEXT;
ALTER TABLE competitor_founders ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE competitor_founders ADD COLUMN IF NOT EXISTS enrichment_source VARCHAR(100);
