import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import {
  DESIGNATION_COLORS,
  buildPositioningInsights,
  filterInsights,
} from '../lib/positioningInsights';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://znusgttwjfuuzhycuvhs.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_uBx9cLk0PYHlOz5-kE3nLA_W8I2jQlq'
);

const FILTERS = [
  { id: 'direct', label: 'Direct' },
  { id: 'adjacent', label: 'Adjacent' },
  { id: 'tangential', label: 'Tangential' },
];

function SourceChips({ sources }) {
  return (
    <div style={styles.chipRow}>
      {(sources || []).map((source) => (
        <span
          key={`${source.id}-${source.name}`}
          style={{
            ...styles.chip,
            borderColor: DESIGNATION_COLORS[source.label] || '#444',
            color: DESIGNATION_COLORS[source.label] || '#ccc',
          }}
          title={source.labelDisplay}
        >
          {source.name}
        </span>
      ))}
    </div>
  );
}

function InsightList({ items, empty }) {
  if (!items?.length) {
    return <p style={styles.empty}>{empty}</p>;
  }
  return (
    <div style={styles.insightList}>
      {items.map((item) => (
        <div key={item.text} style={styles.insightCard}>
          <div style={styles.insightText}>{item.text}</div>
          <div style={styles.insightMeta}>
            Mentioned in {item.sources.length}{' '}
            {item.sources.length === 1 ? 'analysis' : 'analyses'}
          </div>
          <SourceChips sources={item.sources} />
        </div>
      ))}
    </div>
  );
}

export default function PositioningPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [raw, setRaw] = useState(null);
  const [active, setActive] = useState(['direct', 'adjacent', 'tangential']);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [comps, comparisons, strengths, weaknesses] = await Promise.all([
          supabase.from('competitors').select('*').eq('status', 'active'),
          supabase.from('divi_comparisons').select('*'),
          supabase.from('competitor_strengths').select('*'),
          supabase.from('competitor_weaknesses').select('*'),
        ]);
        const firstError =
          comps.error || comparisons.error || strengths.error || weaknesses.error;
        if (firstError) throw firstError;
        if (cancelled) return;
        setRaw(
          buildPositioningInsights({
            competitors: comps.data || [],
            comparisons: comparisons.data || [],
            strengths: strengths.data || [],
            weaknesses: weaknesses.data || [],
          })
        );
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load positioning');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const insights = useMemo(() => {
    if (!raw) return null;
    return filterInsights(raw, active);
  }, [raw, active]);

  const toggle = (id) => {
    setActive((prev) => {
      if (prev.includes(id) && prev.length === 1) return prev;
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };

  const counts = raw?.counts || { total: 0, direct: 0, adjacent: 0, tangential: 0 };

  return (
    <div style={styles.container}>
      <nav style={styles.nav}>
        <div style={styles.navContent}>
          <Link href="/" style={styles.navBrand}>
            <img src="/divi-logo.png" alt="Divi" style={styles.navLogoImg} />
            <span>Divi Intelligence</span>
          </Link>
          <div style={styles.navActions}>
            <Link href="/" style={styles.navButton}>
              ← Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div style={styles.main}>
        <div style={styles.header}>
          <div>
            <div style={styles.kicker}>Market brief</div>
            <h1 style={styles.title}>Where Divi stands</h1>
            <p style={styles.lede}>
              Synthesized from analyzed Direct, Adjacent, and Tangential companies.
              Profiles with no overlap are left out.
            </p>
          </div>
          <div style={styles.countCard}>
            <div style={styles.countValue}>{counts.total}</div>
            <div style={styles.countLabel}>Companies in brief</div>
          </div>
        </div>

        <div style={styles.statRow}>
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => toggle(filter.id)}
              style={{
                ...styles.statPill,
                borderColor: DESIGNATION_COLORS[filter.id],
                opacity: active.includes(filter.id) ? 1 : 0.4,
              }}
            >
              <span style={{ color: DESIGNATION_COLORS[filter.id], fontWeight: 800 }}>
                {counts[filter.id] || 0}
              </span>
              <span>{filter.label}</span>
            </button>
          ))}
        </div>

        {loading ? <p style={styles.empty}>Building the market brief…</p> : null}
        {error ? <p style={styles.error}>{error}</p> : null}

        {!loading && !error && counts.total === 0 ? (
          <div style={styles.emptyCard}>
            No overlapping analyses yet. Analyze Direct, Adjacent, or Tangential companies
            from the dashboard — “Not a competitor” profiles stay out of this brief.
          </div>
        ) : null}

        {!loading && insights && counts.total > 0 ? (
          <>
            <div style={styles.grid}>
              <section style={{ ...styles.panel, borderColor: '#22c55e' }}>
                <h2 style={styles.panelTitle}>What Divi does well</h2>
                <p style={styles.panelHint}>
                  Repeated Divi wins and competitor gaps across overlapping analyses.
                </p>
                <InsightList
                  items={insights.whatWeDoWell}
                  empty="No repeated Divi strengths in the selected designations."
                />
              </section>

              <section style={{ ...styles.panel, borderColor: '#f39c12' }}>
                <h2 style={styles.panelTitle}>Where we’re behind</h2>
                <p style={styles.panelHint}>
                  Places overlapping companies out-claim or out-deliver Divi on their sites.
                </p>
                <InsightList
                  items={insights.whereWeLag}
                  empty="No repeated gaps in the selected designations."
                />
              </section>
            </div>

            <section style={{ ...styles.panel, borderColor: '#9b59b6', marginTop: 22 }}>
              <h2 style={styles.panelTitle}>How to separate ourselves</h2>
              <p style={styles.panelHint}>
                Differentiators others lead with — counter them for Direct competitors, and
                borrow the useful ones from Adjacent and Tangential companies.
              </p>
              <InsightList
                items={insights.howToSeparate}
                empty="No differentiation themes in the selected designations."
              />
              {insights.recommendations.length ? (
                <div style={styles.recoWrap}>
                  <h3 style={styles.subhead}>What analyses recommended</h3>
                  <div style={styles.recoList}>
                    {insights.recommendations.map((row) => (
                      <div key={`${row.source.id}-${row.text.slice(0, 40)}`} style={styles.recoCard}>
                        <div style={styles.recoCompany}>
                          <span
                            style={{
                              ...styles.chip,
                              borderColor: DESIGNATION_COLORS[row.source.label],
                              color: DESIGNATION_COLORS[row.source.label],
                            }}
                          >
                            {row.source.name} · {row.source.labelDisplay}
                          </span>
                        </div>
                        <p style={styles.recoText}>{row.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            {insights.capabilities.length ? (
              <section style={{ ...styles.panel, marginTop: 22 }}>
                <h2 style={styles.panelTitle}>Capability scoreboard</h2>
                <p style={styles.panelHint}>
                  Website claim edges across the selected overlapping companies.
                </p>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Capability</th>
                        <th style={styles.th}>Divi edge</th>
                        <th style={styles.th}>They edge</th>
                        <th style={styles.th}>Tie / unclear</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.capabilities.map((row) => (
                        <tr key={row.label}>
                          <td style={styles.td}>{row.label}</td>
                          <td style={{ ...styles.td, color: '#22c55e', fontWeight: 700 }}>{row.divi}</td>
                          <td style={{ ...styles.td, color: '#f39c12', fontWeight: 700 }}>
                            {row.competitor}
                          </td>
                          <td style={styles.td}>{row.tie}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <section style={{ ...styles.panel, marginTop: 22 }}>
              <h2 style={styles.panelTitle}>Notes to take from the market</h2>
              <p style={styles.panelHint}>
                Strengths and unique plays from overlapping companies. Direct is what we must
                answer; Adjacent and Tangential are ideas worth stealing.
              </p>
              <InsightList
                items={insights.notesToTake}
                empty="No market notes in the selected designations."
              />
            </section>

            <section style={{ marginTop: 22 }}>
              <h2 style={styles.panelTitle}>Companies in this brief</h2>
              <div style={styles.companyGrid}>
                {insights.companies.map((comp) => (
                  <div key={comp.id} style={styles.companyCard}>
                    <div style={styles.companyTop}>
                      <strong>{comp.name}</strong>
                      <span
                        style={{
                          ...styles.badge,
                          background: DESIGNATION_COLORS[comp.label] || '#444',
                        }}
                      >
                        {comp.labelDisplay}
                      </span>
                    </div>
                    {comp.tagline ? <p style={styles.companyTagline}>{comp.tagline}</p> : null}
                    {comp.website ? (
                      <a
                        href={comp.website}
                        target="_blank"
                        rel="noreferrer"
                        style={styles.companyLink}
                      >
                        {comp.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  container: {
    background: '#0a0a0a',
    color: '#f5f5f5',
    minHeight: '100vh',
    fontFamily: "'Segoe UI', -apple-system, sans-serif",
  },
  nav: {
    background: '#1a1a1a',
    borderBottom: '1px solid #2d2d2d',
    padding: '18px 0',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  navContent: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '0 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: '1.25em',
    fontWeight: 700,
    color: '#C523A1',
    textDecoration: 'none',
  },
  navLogoImg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    objectFit: 'cover',
    display: 'block',
  },
  navActions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  navButton: {
    background: 'transparent',
    color: '#C523A1',
    border: '1px solid #C523A1',
    padding: '10px 18px',
    borderRadius: 8,
    fontWeight: 600,
    textDecoration: 'none',
  },
  main: { maxWidth: 1400, margin: '0 auto', padding: 40 },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 24,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginBottom: 22,
  },
  kicker: {
    color: '#C523A1',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    fontSize: '0.78em',
    marginBottom: 8,
  },
  title: { margin: '0 0 10px', fontSize: '2.1em', letterSpacing: '-0.03em' },
  lede: { margin: 0, color: '#a8a8a8', maxWidth: 640, lineHeight: 1.55 },
  countCard: {
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: 12,
    padding: '14px 20px',
    minWidth: 130,
    textAlign: 'center',
  },
  countValue: { fontSize: '1.8em', fontWeight: 800, color: '#C523A1', lineHeight: 1 },
  countLabel: {
    marginTop: 6,
    fontSize: '0.75em',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#888',
    fontWeight: 600,
  },
  statRow: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 28 },
  statPill: {
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#f5f5f5',
    borderRadius: 999,
    padding: '10px 16px',
    cursor: 'pointer',
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    fontWeight: 600,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 22,
  },
  panel: {
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: 14,
    padding: 22,
  },
  panelTitle: { margin: '0 0 6px', fontSize: '1.2em' },
  panelHint: { margin: '0 0 16px', color: '#888', fontSize: '0.92em', lineHeight: 1.5 },
  insightList: { display: 'flex', flexDirection: 'column', gap: 12 },
  insightCard: {
    background: '#0a0a0a',
    borderRadius: 10,
    padding: 14,
    border: '1px solid #222',
  },
  insightText: { lineHeight: 1.5, marginBottom: 8 },
  insightMeta: { fontSize: '0.78em', color: '#888', marginBottom: 8 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    border: '1px solid #444',
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: '0.72em',
    fontWeight: 700,
  },
  recoWrap: { marginTop: 22 },
  subhead: { margin: '0 0 12px', fontSize: '1em', color: '#C523A1' },
  recoList: { display: 'flex', flexDirection: 'column', gap: 12 },
  recoCard: {
    background: 'rgba(197,35,161,0.08)',
    border: '1px solid rgba(197,35,161,0.28)',
    borderRadius: 10,
    padding: 14,
  },
  recoCompany: { marginBottom: 8 },
  recoText: { margin: 0, lineHeight: 1.55 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.92em' },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: '1px solid #333',
    color: '#C523A1',
    fontSize: '0.8em',
    textTransform: 'uppercase',
  },
  td: { padding: '12px 8px', borderBottom: '1px solid #222', verticalAlign: 'top' },
  companyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
    marginTop: 12,
  },
  companyCard: {
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: 12,
    padding: 16,
  },
  companyTop: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },
  badge: {
    color: '#fff',
    borderRadius: 999,
    padding: '4px 8px',
    fontSize: '0.68em',
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  companyTagline: { margin: '8px 0 0', color: '#a8a8a8', fontSize: '0.9em', lineHeight: 1.4 },
  companyLink: { display: 'inline-block', marginTop: 8, color: '#C523A1', fontSize: '0.82em' },
  empty: { opacity: 0.65, fontStyle: 'italic' },
  emptyCard: {
    background: '#1a1a1a',
    border: '1px dashed #333',
    borderRadius: 12,
    padding: 28,
    color: '#aaa',
    lineHeight: 1.55,
  },
  error: { color: '#e74c3c' },
};
