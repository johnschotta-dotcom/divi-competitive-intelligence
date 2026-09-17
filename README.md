# Divi Competitive Intelligence

AI-powered competitive intelligence dashboard for [Divi](https://divi.fund) — deep competitor profiles, free-source enrichment, and Divi head-to-head comparisons.

**Live:** https://divi-competitive-intelligence.vercel.app/

## Stack

- Next.js 14 (pages router) on Vercel
- Supabase (Postgres)
- Anthropic Claude (structured analysis)
- Free enrichment: website HTML, Google News RSS, Clearbit logos, HTML tech signatures

## Setup

### 1. Environment variables (Vercel + local)

```bash
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# optional
ANTHROPIC_MODEL=claude-sonnet-5
ANTHROPIC_MODEL_FALLBACK=claude-haiku-4-5
```

### 2. Database

1. If you have not already, run the base schema (`01_DATABASE_SCHEMA.sql` or your existing tables).
2. Run the deep-profile migration in the Supabase SQL Editor:

[`supabase/02_deep_profiles.sql`](supabase/02_deep_profiles.sql)

This adds founders, funding rounds, history, sentiment, media, tech stack, and Divi comparison tables, plus extra competitor columns.

### 3. Local

```bash
npm install
npm run dev
```

### 4. Run analysis

- Dashboard buttons: **Run full analysis** or profile **Re-analyze**
- Cron (daily 09:00 UTC): `vercel.json` → `GET /api/intelligence`
- Single competitor: `GET /api/intelligence?id=<competitor_id>`

## Research pipeline (website + LinkedIn positioning)

For each competitor the agent:

1. Crawls **Divi’s** website from the homepage (follows About / Product / Blog / Updates links on-site) + LinkedIn if linked
2. Crawls each **competitor** the same way — discovers internal nav links, prioritizes about/product/pricing/blog/news/updates, and pulls a few latest blog posts
3. Asks Claude to compare **only those page corpora**
4. Outputs market overlap, true-competitor label, wins / gaps / sameness / differentiation

Also run [`supabase/03_positioning.sql`](supabase/03_positioning.sql) once for new overlap columns.

Tip: re-analyze one company at a time if a full batch times out (`ANALYSIS_CONCURRENCY` defaults to 2).

## Notes

- Financial and sentiment fields are **estimates** from free public signals, not licensed data vendors.
- Full batch analysis can take a while (one Claude call per competitor); Vercel Pro timeouts are safer for large batches.
