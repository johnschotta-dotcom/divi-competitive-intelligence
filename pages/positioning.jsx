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

function splitCrossover(items) {
  const list = items || [];
  return {
    shared: list.filter((item) => item.crossover),
    unique: list.filter((item) => !item.crossover),
  };
}

function ThemeRows({ items }) {
  if (!items?.length) return null;
  return (
    <div style={styles.insightList}>
      {items.map((item) => (
        <div key={item.id || item.title} style={styles.insightCard}>
          <div style={styles.insightTitle}>{item.title}</div>
          <div style={styles.insightText}>{item.summary}</div>
          {item.extras?.length ? (
            <ul style={styles.extraList}>
              {item.extras.map((extra) => (
                <li key={extra}>{extra}</li>
              ))}
            </ul>
          ) : null}
          <SourceChips sources={item.sources} />
        </div>
      ))}
    </div>
  );
}

function UniqueRows({ items }) {
  if (!items?.length) return null;
  return (
    <div style={styles.uniqueWrap}>
      <div style={styles.uniqueLabel}>Only in one analysis</div>
      <div style={styles.uniqueList}>
        {items.map((item) => (
          <div key={item.id || item.summary} style={styles.uniqueRow}>
            <span style={styles.uniqueText}>{item.summary}</span>
            <SourceChips sources={item.sources} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ThemeSection({ title, hint, items, empty, color }) {
  const { shared, unique } = splitCrossover(items);
  return (
    <section style={{ ...styles.panel, borderColor: color || '#2d2d2d' }}>
      <h2 style={styles.panelTitle}>{title}</h2>
      <p style={styles.panelHint}>{hint}</p>
      {!shared.length && !unique.length ? <p style={styles.empty}>{empty}</p> : null}
      <ThemeRows items={shared} />
      <UniqueRows items={unique} />
    </section>
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
  const visibleCompanies = insights?.companies || [];

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
              One condensed brief from overlapping analyses. Company names are source
              tags, not separate recaps. No-overlap profiles are excluded.
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
            <section style={styles.overview}>
              <h2 style={styles.panelTitle}>Crossover summary</h2>
              <p style={styles.overviewText}>{insights.overview}</p>
              <SourceChips sources={visibleCompanies} />
            </section>

            <div style={styles.grid}>
              <ThemeSection
                title="What Divi does well"
                color="#22c55e"
                hint="Repeated Divi edges. Shared themes first; one-off points stay tagged below."
                items={insights.whatWeDoWell}
                empty="No Divi strengths in the selected designations."
              />
              <ThemeSection
                title="Where we’re behind"
                color="#f39c12"
                hint="Places overlapping companies out-claim Divi. Shared gaps first."
                items={insights.whereWeLag}
                empty="No gaps in the selected designations."
              />
            </div>

            <div style={{ ...styles.grid, marginTop: 22 }}>
              <ThemeSection
                title="How to separate ourselves"
                color="#9b59b6"
                hint="Counter Direct plays; borrow useful Adjacent and Tangential ones."
                items={insights.howToSeparate}
                empty="No separation themes in the selected designations."
              />
              <ThemeSection
                title="Notes from the market"
                hint="Strengths and shared ground not already covered above."
                items={insights.notesToTake}
                empty="No additional market notes in the selected designations."
              />
            </div>

            {insights.capabilities.length ? (
              <section style={{ ...styles.panel, marginTop: 22 }}>
                <h2 style={styles.panelTitle}>Capability edges</h2>
                <p style={styles.panelHint}>
                  Where website claims split. Ties are omitted.
                </p>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Capability</th>
                        <th style={styles.th}>Divi</th>
                        <th style={styles.th}>Them</th>
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
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
  overview: {
    background: '#1a1a1a',
    border: '1px solid rgba(197,35,161,0.35)',
    borderRadius: 14,
    padding: 22,
    marginBottom: 22,
  },
  overviewText: { margin: '8px 0 14px', lineHeight: 1.65, fontSize: '1.05em' },
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
  insightTitle: {
    fontWeight: 700,
    marginBottom: 6,
    color: '#C523A1',
    fontSize: '0.92em',
  },
  insightText: { lineHeight: 1.5, marginBottom: 8 },
  extraList: {
    margin: '0 0 10px',
    paddingLeft: 18,
    color: '#b0b0b0',
    fontSize: '0.9em',
    lineHeight: 1.45,
  },
  uniqueWrap: { marginTop: 16 },
  uniqueLabel: {
    fontSize: '0.75em',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#888',
    fontWeight: 700,
    marginBottom: 8,
  },
  uniqueList: { display: 'flex', flexDirection: 'column', gap: 8 },
  uniqueRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    background: '#0a0a0a',
    borderRadius: 8,
    padding: '10px 12px',
    border: '1px solid #1f1f1f',
  },
  uniqueText: { flex: '1 1 220px', lineHeight: 1.45, fontSize: '0.92em', color: '#d0d0d0' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: {
    border: '1px solid #444',
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: '0.72em',
    fontWeight: 700,
  },
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
