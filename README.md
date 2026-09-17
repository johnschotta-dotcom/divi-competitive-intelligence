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
ANTHROPIC_MODEL=claude-opus-5
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

## Research pipeline (robust mode)

For each competitor the agent:

1. Scrapes multiple free pages (`/`, `/about`, `/pricing`, `/product`, …)
2. Pulls Google News RSS headlines
3. Runs a **Claude research brief** framed against the Divi gold standard
4. Converts that brief into a **structured dossier** (overview, strengths/weaknesses, founders, funding, sentiment, Divi comparison matrix)
5. Runs a **repair pass** if required sections are thin

**Divi** is stored as the **reference / gold standard** profile (tier `reference`), not scored as a peer threat. Update [`lib/diviBaseline.js`](lib/diviBaseline.js) whenever product positioning changes, then re-run analysis.

Tip: if a full batch times out on Vercel, re-analyze one company at a time from the profile **Re-analyze** button (`/api/intelligence?id=…`). Concurrency defaults to 2 (`ANALYSIS_CONCURRENCY`).

## Notes

- Financial and sentiment fields are **estimates** from free public signals, not licensed data vendors.
- Full batch analysis can take a while (one Claude call per competitor); Vercel Pro timeouts are safer for large batches.
