import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import {
  resolveOverlap,
  formatOverlapLevel,
  formatCompetitorLabel,
  tierFromCompetitorLabel,
} from '../lib/overlap';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://znusgttwjfuuzhycuvhs.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_uBx9cLk0PYHlOz5-kE3nLA_W8I2jQlq'
);

function domainFromWebsite(website) {
  try {
    return new URL(website.includes('://') ? website : `https://${website}`).hostname.replace(
      /^www\./,
      ''
    );
  } catch {
    return null;
  }
}

function isDiviSite(website, name) {
  const site = String(website || '').toLowerCase();
  const n = String(name || '').trim().toLowerCase();
  return n === 'divi' || n === 'divi.fund' || site.includes('divi.fund');
}

function logoCandidates(website, preferred, name) {
  const domain = domainFromWebsite(website);
  const list = [];

  // Divi: always use our bundled high-res mark (avoid blurry Google/icon.horse copies)
  if (isDiviSite(website, name)) {
    list.push('/divi-logo.png');
    list.push('https://divi.fund/apple-touch-icon.png');
    list.push('https://divi.fund/icon-192.png');
    return [...new Set(list)];
  }

  const badPreferred =
    !preferred ||
    /logo\.clearbit\.com|gstatic\.com\/favicon|google\.com\/s2\/favicons/i.test(preferred) ||
    /\/og(\.|$|\/)|opengraph|open-graph|og-image|ogimage|twitter-card|social[-_]?card/i.test(
      preferred
    );

  // Site icons first — never lead with OG homepage screenshots (e.g. signed.com/og.png)
  if (domain) {
    list.push(`https://${domain}/apple-touch-icon.png`);
    list.push(`https://${domain}/favicon.svg`);
    list.push(`https://www.${domain}/apple-touch-icon.png`);
    list.push(`https://${domain}/icon-192.png`);
  }
  if (!badPreferred) list.push(preferred);
  if (domain) {
    list.push(`https://icon.horse/icon/${domain}`);
    list.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`);
    list.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
  }
  return [...new Set(list.filter(Boolean))];
}

function CompanyLogo({ name, website, logoUrl, size = 56, style }) {
  const [idx, setIdx] = useState(0);
  const candidates = logoCandidates(website, logoUrl, name);
  const src = candidates[idx];
  const initials = String(name || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const divi = isDiviSite(website, name);

  if (!src || idx >= candidates.length) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: Math.max(8, size * 0.18),
          background: 'linear-gradient(135deg, #C523A1, #5b2c6f)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: size * 0.36,
          flexShrink: 0,
          ...style,
        }}
        aria-label={`${name} logo`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} logo`}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        borderRadius: Math.max(8, size * 0.18),
        // Gradient logos (Divi) look wrong on a white pad
        background: divi ? 'transparent' : 'rgba(255,255,255,0.92)',
        padding: divi ? 0 : 4,
        flexShrink: 0,
        ...style,
      }}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}

export default function Dashboard() {
  const [competitors, setCompetitors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [profile, setProfile] = useState(null);
  const [strengths, setStrengths] = useState([]);
  const [weaknesses, setWeaknesses] = useState([]);
  const [riskBreakdown, setRiskBreakdown] = useState(null);
  const [founders, setFounders] = useState([]);
  const [fundingRounds, setFundingRounds] = useState([]);
  const [history, setHistory] = useState([]);
  const [sentiment, setSentiment] = useState(null);
  const [media, setMedia] = useState([]);
  const [techStack, setTechStack] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showScoringGuide, setShowScoringGuide] = useState(false);
  const [formData, setFormData] = useState({ name: '', website: '' });
  const [section, setSection] = useState('comparison');
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [labelFilter, setLabelFilter] = useState('all');

  useEffect(() => {
    fetchCompetitors();
  }, []);

  const isDivi = (comp) => {
    const n = String(comp?.name || '').toLowerCase();
    const w = String(comp?.website || '').toLowerCase();
    return n === 'divi' || w.includes('divi.fund');
  };

  const isNewCompetitor = (comp) => {
    if (!comp || isDivi(comp) || comp.tier === 'reference') return false;
    return !comp.last_analyzed;
  };

  const NEW_COLOR = '#22c55e';

  /** High/medium/low/none → direct/adjacent/tangential/not a competitor */
  const overlapMeta = (comp) => {
    if (isDivi(comp) || comp?.tier === 'reference') {
      return {
        level: 'reference',
        label: 'reference',
        score: 100,
        tier: 'reference',
        levelDisplay: 'High',
        labelDisplay: 'Gold standard',
      };
    }
    const aligned = resolveOverlap({
      score: comp?.market_overlap_score ?? comp?.threat_score,
      label: comp?.true_competitor_label,
    });
    return {
      level: aligned.level,
      label: aligned.label || comp?.true_competitor_label || null,
      score: aligned.score ?? comp?.market_overlap_score ?? comp?.threat_score ?? null,
      tier: tierFromCompetitorLabel(aligned.label) || comp?.tier || 'monitor',
      levelDisplay: formatOverlapLevel(aligned.level),
      labelDisplay: formatCompetitorLabel(aligned.label || comp?.true_competitor_label),
    };
  };

  const fetchCompetitors = async () => {
    setLoading(true);
    try {
      // Heal any score/label mismatches in Supabase (fast; no Claude crawl)
      await fetch('/api/intelligence?alignOnly=1').catch(() => null);
    } catch {
      /* non-blocking */
    }
    const { data } = await supabase
      .from('competitors')
      .select('*')
      .eq('status', 'active')
      .order('threat_score', { ascending: false });
    const list = data || [];
    list.sort((a, b) => {
      const aRef = isDivi(a) || a.tier === 'reference' ? 1 : 0;
      const bRef = isDivi(b) || b.tier === 'reference' ? 1 : 0;
      if (aRef !== bRef) return bRef - aRef;
      const aNew = isNewCompetitor(a) ? 1 : 0;
      const bNew = isNewCompetitor(b) ? 1 : 0;
      if (aNew !== bNew) return bNew - aNew;
      const aO = a.market_overlap_score ?? a.threat_score ?? 0;
      const bO = b.market_overlap_score ?? b.threat_score ?? 0;
      return bO - aO;
    });
    setCompetitors(list);
    setLoading(false);
  };

  const fetchDetails = async (comp) => {
    setSelected(comp);
    setSection(isDivi(comp) || comp.tier === 'reference' ? 'overview' : 'comparison');
    setDetailLoading(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    const [p, s, w, rb, f, fr, h, sent, m, tech, cmp] = await Promise.all([
      supabase.from('competitor_profiles').select('*').eq('competitor_id', comp.id).maybeSingle(),
      supabase.from('competitor_strengths').select('*').eq('competitor_id', comp.id),
      supabase.from('competitor_weaknesses').select('*').eq('competitor_id', comp.id),
      supabase.from('risk_score_breakdown').select('*').eq('competitor_id', comp.id).maybeSingle(),
      supabase.from('competitor_founders').select('*').eq('competitor_id', comp.id),
      supabase.from('funding_rounds').select('*').eq('competitor_id', comp.id),
      supabase.from('company_history').select('*').eq('competitor_id', comp.id),
      supabase.from('social_sentiment').select('*').eq('competitor_id', comp.id).maybeSingle(),
      supabase.from('media_mentions').select('*').eq('competitor_id', comp.id).order('id', { ascending: false }),
      supabase.from('tech_stack').select('*').eq('competitor_id', comp.id),
      supabase.from('divi_comparisons').select('*').eq('competitor_id', comp.id).maybeSingle(),
    ]);

    setProfile(p.data);
    setStrengths(s.data || []);
    setWeaknesses(w.data || []);
    setRiskBreakdown(rb.data);
    setFounders(f.data || []);
    setFundingRounds(fr.data || []);
    setHistory(h.data || []);
    setSentiment(sent.data);
    setMedia(m.data || []);
    setTechStack(tech.data || []);
    setComparison(cmp.data);
    setDetailLoading(false);
  };

  const openCompetitor = async (comp) => {
    await fetchDetails(comp);
    if (!isNewCompetitor(comp) || analyzing) return;
    const shouldAnalyze = window.confirm(
      `${comp.name} hasn’t been analyzed yet. Analyze now?`
    );
    if (shouldAnalyze) {
      await runAnalysis(comp.id);
    }
  };

  const addCompetitor = async () => {
    if (!formData.name || !formData.website) return alert('Please fill in all fields');
    const domain = domainFromWebsite(formData.website);
    const logo_url = domain
      ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
      : null;
    const { error } = await supabase.from('competitors').insert({
      name: formData.name,
      website: formData.website,
      logo_url,
      status: 'active',
      tier: 'monitor',
      threat_score: 50,
    });
    if (!error) {
      setFormData({ name: '', website: '' });
      setShowAddForm(false);
      fetchCompetitors();
    } else {
      alert(error.message);
    }
  };

  const deleteCompetitor = async (compId) => {
    if (!confirm('Delete this competitor?')) return;
    await supabase.from('competitors').update({ status: 'deleted' }).eq('id', compId);
    setSelected(null);
    fetchCompetitors();
  };

  const markAsNotCompetitor = async (comp) => {
    if (!comp?.id) return;
    if (
      !confirm(
        `Mark ${comp.name} as not a competitor? This sets overlap to None and designation to “Not a competitor”.`
      )
    ) {
      return;
    }
    const aligned = resolveOverlap({ level: 'none', label: 'not_a_competitor' });
    await supabase
      .from('competitors')
      .update({
        market_overlap_score: aligned.score,
        true_competitor_label: aligned.label,
        threat_score: aligned.score,
        tier: tierFromCompetitorLabel(aligned.label),
      })
      .eq('id', comp.id);
    await supabase
      .from('divi_comparisons')
      .update({
        market_overlap_score: aligned.score,
        true_competitor_label: aligned.label,
      })
      .eq('competitor_id', comp.id);

    const updated = {
      ...comp,
      market_overlap_score: aligned.score,
      true_competitor_label: aligned.label,
      threat_score: aligned.score,
      tier: tierFromCompetitorLabel(aligned.label),
    };
    setSelected(updated);
    setCompetitors((prev) => prev.map((c) => (c.id === comp.id ? { ...c, ...updated } : c)));
    if (comparison) {
      setComparison({
        ...comparison,
        market_overlap_score: aligned.score,
        true_competitor_label: aligned.label,
      });
    }
  };

  const runAnalysis = async (competitorId) => {
    setAnalyzing(true);
    setAnalysisProgress(null);
    try {
      // Single company — one Vercel invocation
      if (competitorId) {
        const res = await fetch(`/api/intelligence?id=${competitorId}`);
        const raw = await res.text();
        let json;
        try {
          json = JSON.parse(raw);
        } catch {
          const snippet = (raw || '').slice(0, 240).replace(/\s+/g, ' ');
          throw new Error(
            res.status === 504 || /timed out|timeout|An error occurred/i.test(raw)
              ? `Analysis timed out (HTTP ${res.status}). Try again for this company. Details: ${snippet || 'empty response'}`
              : `Server returned non-JSON (HTTP ${res.status}): ${snippet || 'empty response'}`
          );
        }
        if (!res.ok || json.success === false) {
          throw new Error(json.error || json.message || 'Analysis failed');
        }
        if (json.failures?.length) {
          console.warn('Analysis completed with failures:', json.failures);
        }
        await fetchCompetitors();
        const focusId = selected?.id || competitorId;
        if (focusId) {
          const { data: refreshed } = await supabase
            .from('competitors')
            .select('*')
            .eq('id', focusId)
            .single();
          if (refreshed) {
            setSelected(refreshed);
            await fetchDetails(refreshed);
          }
        }
        return;
      }

      // Full run — one company per request so each gets its own 300s Vercel budget
      const queue = [...competitors];
      if (!queue.length) {
        throw new Error('No competitors to analyze');
      }
      const failures = [];
      for (let i = 0; i < queue.length; i++) {
        const comp = queue[i];
        setAnalysisProgress({
          current: i + 1,
          total: queue.length,
          name: comp.name,
        });
        try {
          const res = await fetch(`/api/intelligence?id=${comp.id}`);
          const raw = await res.text();
          let json;
          try {
            json = JSON.parse(raw);
          } catch {
            failures.push(`${comp.name}: timed out or bad response`);
            continue;
          }
          if (!res.ok || json.success === false) {
            failures.push(`${comp.name}: ${json.error || json.message || 'failed'}`);
            continue;
          }
          if (json.failures?.length) {
            failures.push(...json.failures.map((f) => `${comp.name}: ${f}`));
          }
        } catch (err) {
          failures.push(`${comp.name}: ${err.message || 'failed'}`);
        }
        // Refresh list between companies so scores update live
        await fetchCompetitors();
      }
      if (failures.length) {
        console.warn('Full analysis finished with failures:', failures);
        alert(
          `Finished ${queue.length} companies with ${failures.length} issue(s). Check the console for details.`
        );
      }
    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  const exportProfile = async (format) => {
    if (!selected) return;
    setExporting(true);
    try {
      const { buildExportModel, downloadProfilePdf, downloadProfileDocx } = await import(
        '../lib/exportProfile'
      );
      const model = buildExportModel({
        competitor: selected,
        profile,
        comparison,
        strengths,
        weaknesses,
        founders,
        sentiment,
        isDivi: isDivi(selected) || selected.tier === 'reference',
      });
      if (format === 'pdf') await downloadProfilePdf(model);
      else await downloadProfileDocx(model);
    } catch (e) {
      console.error(e);
      alert(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const getTierColor = (tier) => {
    if (!tier) return '#3498db';
    const t = tier.toLowerCase();
    if (t === 'reference') return '#C523A1';
    if (t === 'critical') return '#e74c3c';
    if (t === 'high') return '#f39c12';
    if (t === 'medium') return '#f1c40f';
    return '#3498db';
  };

  const sentimentColor = (score) => {
    if (score == null) return '#888';
    if (score >= 70) return '#2ecc71';
    if (score >= 45) return '#f1c40f';
    return '#e74c3c';
  };

  const RiskBar = ({ label, value, notes }) => (
    <div style={styles.riskBarContainer}>
      <div style={styles.riskBarLabel}>
        <span>{label}</span>
        <span style={styles.riskBarValue}>{value ?? '—'}/100</span>
      </div>
      <div style={styles.riskBarTrack}>
        <div
          style={{
            ...styles.riskBarFill,
            width: `${value || 0}%`,
            background: value > 70 ? '#e74c3c' : value > 50 ? '#f39c12' : '#f1c40f',
          }}
        />
      </div>
      {notes && <p style={styles.riskBarNotes}>{notes}</p>}
    </div>
  );

  const SectionNav = () => {
    const hasFunding = fundingRounds.length > 0 ||
      (selected.revenue_estimate && !/not stated/i.test(selected.revenue_estimate));
    const hasHistory = history.length > 0;
    const hasTone =
      sentiment &&
      (sentiment.score != null ||
        (sentiment.summary &&
          !/pending|insufficient/i.test(sentiment.summary)));
    const hasPress = media.some((m) => m.source_name && !['crawled_page', 'website_heading'].includes(m.source_name));
    const tabs = [
      { id: 'comparison', label: 'Positioning vs Divi' },
      { id: 'overview', label: 'Website snapshot' },
      founders.length ? { id: 'founders', label: `Team (${founders.length})` } : null,
      techStack.length ? { id: 'tech', label: 'Tech signals' } : null,
      hasHistory ? { id: 'history', label: 'History' } : null,
      hasFunding ? { id: 'funding', label: 'On-site commercial' } : null,
      hasTone ? { id: 'sentiment', label: 'Site tone' } : null,
      hasPress ? { id: 'press', label: 'Press' } : null,
    ].filter(Boolean);
    return (
      <div style={styles.sectionNav}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            style={{
              ...styles.sectionTab,
              ...(section === t.id ? styles.sectionTabActive : {}),
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  };

  if (selected) {
    const matrix = Array.isArray(comparison?.feature_matrix) ? comparison.feature_matrix : [];
    const whereWeWin = Array.isArray(comparison?.divi_wins) ? comparison.divi_wins : [];
    const whereWeFallShort = Array.isArray(comparison?.competitor_wins)
      ? comparison.competitor_wins
      : [];
    const whereSame = Array.isArray(comparison?.where_same) ? comparison.where_same : [];
    const whereDiff = Array.isArray(comparison?.where_differentiate)
      ? comparison.where_differentiate
      : [];
    const overlap =
      selected.market_overlap_score ?? comparison?.market_overlap_score ?? selected.threat_score;
    const meta = overlapMeta({
      ...selected,
      market_overlap_score: overlap,
      true_competitor_label:
        selected.true_competitor_label || comparison?.true_competitor_label || selected.tier,
    });
    const trueLabel = meta.label;
    const tierForColor = meta.tier;
    const isNew = isNewCompetitor(selected);
    const canExport = !!(
      comparison?.overall_verdict ||
      profile?.overall_summary ||
      selected.last_analyzed
    );

    return (
      <div style={styles.container}>
        <nav style={styles.nav}>
          <div style={styles.navContent}>
            <div style={styles.navBrand}>
              <img src="/divi-logo.png" alt="Divi" style={styles.navLogoImg} />
              <span>Divi Intelligence</span>
            </div>
            <div style={styles.navActions}>
              <Link href="/positioning" style={styles.ghostBtn}>
                Market positioning
              </Link>
              <button
                onClick={() => exportProfile('pdf')}
                style={styles.ghostBtn}
                disabled={!canExport || exporting || detailLoading}
                title={canExport ? 'Download PDF' : 'Analyze this company first'}
              >
                {exporting ? 'Exporting…' : 'PDF'}
              </button>
              <button
                onClick={() => exportProfile('docx')}
                style={styles.ghostBtn}
                disabled={!canExport || exporting || detailLoading}
                title={canExport ? 'Download Word doc' : 'Analyze this company first'}
              >
                DOCX
              </button>
              <button
                onClick={() => runAnalysis(selected.id)}
                style={
                  isNew
                    ? {
                        ...styles.ghostBtn,
                        borderColor: NEW_COLOR,
                        color: NEW_COLOR,
                      }
                    : styles.ghostBtn
                }
                disabled={analyzing}
              >
                {analyzing ? 'Analyzing…' : isNew ? 'Analyze' : 'Re-analyze'}
              </button>
              <button
                onClick={() => {
                  setSelected(null);
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
                  }
                }}
                style={styles.navButton}
              >
                ← Dashboard
              </button>
            </div>
          </div>
        </nav>

        <div style={styles.mainContent}>
          <div style={styles.profileHeader}>
            <div style={styles.profileHeaderLeft}>
              <CompanyLogo
                name={selected.name}
                website={selected.website}
                logoUrl={selected.logo_url}
                size={72}
              />
              <div>
                <div style={styles.breadcrumb}>
                  {isDivi(selected) || selected.tier === 'reference'
                    ? 'Divi gold standard'
                    : isNew
                      ? 'New — not analyzed yet'
                      : 'Competitive profile'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h1 style={{ ...styles.profileTitle, margin: 0 }}>{selected.name}</h1>
                  {isNew ? (
                    <span
                      style={{
                        ...styles.compBadge,
                        background: NEW_COLOR,
                        fontSize: '0.7em',
                      }}
                    >
                      NEW
                    </span>
                  ) : null}
                </div>
                {selected.tagline && <p style={styles.tagline}>{selected.tagline}</p>}
                <a
                  href={selected.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.profileLink}
                >
                  {selected.website}
                </a>
                <div style={styles.metaRow}>
                  {selected.headquarters && <span>{selected.headquarters}</span>}
                  {selected.employee_estimate && <span>{selected.employee_estimate} employees</span>}
                  {profile?.founded_year && <span>Founded {profile.founded_year}</span>}
                </div>
              </div>
            </div>
            <div style={styles.profileHeaderRight}>
              <div style={styles.overlapBlock}>
                <div style={styles.overlapLabel}>
                  {isDivi(selected) || selected.tier === 'reference'
                    ? 'Reference overlap'
                    : isNew
                      ? 'Status'
                      : 'Market overlap vs Divi'}
                </div>
                <div
                  style={{
                    ...styles.overlapLevel,
                    color: isNew ? NEW_COLOR : getTierColor(tierForColor),
                  }}
                >
                  {isNew ? 'NEW' : meta.levelDisplay}
                </div>
                <div
                  style={{
                    ...styles.overlapBand,
                    color: isNew ? NEW_COLOR : getTierColor(tierForColor),
                  }}
                >
                  {isNew ? 'Not analyzed' : meta.labelDisplay}
                </div>
              </div>

              {isNew ? (
                <div style={styles.profileActions}>
                  <button
                    onClick={() => runAnalysis(selected.id)}
                    style={{
                      ...styles.addBtn,
                      background: NEW_COLOR,
                    }}
                    disabled={analyzing}
                  >
                    {analyzing ? 'Analyzing…' : 'Analyze now'}
                  </button>
                </div>
              ) : canExport ? (
                <div style={styles.profileActions}>
                  <button
                    onClick={() => exportProfile('pdf')}
                    style={styles.ghostBtn}
                    disabled={exporting}
                  >
                    {exporting ? 'Exporting…' : 'Download PDF'}
                  </button>
                  <button
                    onClick={() => exportProfile('docx')}
                    style={styles.ghostBtn}
                    disabled={exporting}
                  >
                    Download DOCX
                  </button>
                </div>
              ) : null}
              {!isNew &&
              !isDivi(selected) &&
              selected.tier !== 'reference' &&
              trueLabel !== 'not_a_competitor' ? (
                <button
                  type="button"
                  onClick={() => markAsNotCompetitor(selected)}
                  style={styles.ghostBtn}
                >
                  Mark as not a competitor
                </button>
              ) : null}
              <button onClick={() => deleteCompetitor(selected.id)} style={styles.deleteBtn}>
                Delete
              </button>
            </div>
          </div>

          {isNew && !detailLoading ? (
            <div
              style={{
                marginBottom: 20,
                padding: '14px 18px',
                borderRadius: 10,
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <span>
                <strong style={{ color: NEW_COLOR }}>NEW</strong> — {selected.name} hasn’t been
                analyzed yet. Run analysis to build its competitive profile.
              </span>
              <button
                onClick={() => runAnalysis(selected.id)}
                style={{
                  ...styles.addBtn,
                  background: NEW_COLOR,
                  whiteSpace: 'nowrap',
                }}
                disabled={analyzing}
              >
                {analyzing ? 'Analyzing…' : 'Analyze now'}
              </button>
            </div>
          ) : null}

          <SectionNav />

          {detailLoading && <p style={styles.loadingText}>Loading profile…</p>}

          {!detailLoading && section === 'overview' && (
            <div style={styles.card}>
              <div style={styles.snapLayout}>
                <h2 style={styles.cardTitle}>Website snapshot</h2>

                <div style={styles.snapStats}>
                  <div style={styles.snapStat}>
                    <div style={styles.snapStatLabel}>What they lead with</div>
                    <div style={styles.snapStatText}>
                      {selected.tagline || profile?.primary_value_prop || '—'}
                    </div>
                  </div>
                  <div style={styles.snapStat}>
                    <div style={styles.snapStatLabel}>Audience</div>
                    <div style={styles.snapStatText}>{profile?.target_audience || '—'}</div>
                  </div>
                  <div style={styles.snapStat}>
                    <div style={styles.snapStatLabel}>Team on site</div>
                    <div style={styles.snapStatNum}>{founders.length || '—'}</div>
                  </div>
                  <div style={styles.snapStat}>
                    <div style={styles.snapStatLabel}>Pages crawled</div>
                    <div style={styles.snapStatNum}>
                      {media.filter((m) => m.source_name === 'crawled_page').length || '—'}
                    </div>
                  </div>
                </div>

                <div style={styles.snapSection}>
                  <div style={styles.snapSectionLabel}>Summary</div>
                  <p style={styles.snapBody}>
                    {profile?.overall_summary || '—'}
                  </p>
                </div>

                {profile?.primary_value_prop ? (
                  <div style={styles.snapSection}>
                    <div style={styles.snapSectionLabel}>Value prop / meta</div>
                    <p style={styles.snapBody}>{profile.primary_value_prop}</p>
                  </div>
                ) : null}

                {media.filter((m) => m.source_name === 'website_heading').length > 0 ? (
                  <div style={styles.snapSection}>
                    <div style={styles.snapSectionLabel}>Headlines / sections on site</div>
                    <ul style={styles.snapBulletList}>
                      {media
                        .filter((m) => m.source_name === 'website_heading')
                        .map((m) => (
                          <li key={m.id || m.title}>{m.title}</li>
                        ))}
                    </ul>
                  </div>
                ) : null}

                {(strengths.length > 0 || weaknesses.length > 0) && (
                  <div style={styles.snapThemes}>
                    <div style={styles.snapThemeCol}>
                      <div style={styles.snapSectionLabel}>What their site sells well</div>
                      {strengths.length === 0 ? (
                        <p style={styles.snapEmpty}>—</p>
                      ) : (
                        <div style={styles.snapItemList}>
                          {strengths.map((s) => (
                            <div key={s.id} style={styles.snapItemPositive}>
                              <div style={styles.snapItemTitle}>{s.strength_title}</div>
                              {s.why_its_strong ? (
                                <div style={styles.snapItemDesc}>{s.why_its_strong}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={styles.snapThemeCol}>
                      <div style={styles.snapSectionLabel}>Gaps vs Divi’s site claims</div>
                      {weaknesses.length === 0 ? (
                        <p style={styles.snapEmpty}>—</p>
                      ) : (
                        <div style={styles.snapItemList}>
                          {weaknesses.map((w) => (
                            <div key={w.id} style={styles.snapItemGap}>
                              <div style={styles.snapItemTitle}>{w.weakness_title}</div>
                              {w.divi_advantage ? (
                                <div style={styles.snapItemDesc}>{w.divi_advantage}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {media.filter((m) => m.source_name === 'crawled_page').length > 0 ? (
                  <div style={styles.snapSection}>
                    <div style={styles.snapSectionLabel}>Pages we read</div>
                    <div style={styles.snapLinkList}>
                      {media
                        .filter((m) => m.source_name === 'crawled_page')
                        .map((m) => (
                          <a
                            key={m.id || m.title}
                            href={m.url || m.title}
                            target="_blank"
                            rel="noreferrer"
                            style={styles.snapLink}
                          >
                            {m.title}
                          </a>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {!detailLoading && section === 'comparison' && (
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>
                {isDivi(selected) ? 'Divi reference positioning' : `Website positioning: Divi vs ${selected.name}`}
              </h2>
              {!comparison ? (
                <p style={styles.emptyState}>
                  No positioning yet — run Re-analyze.
                </p>
              ) : (
                <>
                  <p style={styles.overviewText}>{comparison.overall_verdict}</p>

                  <div style={styles.twoColumnGrid}>
                    <div style={styles.winBox}>
                      <h3 style={styles.winTitle}>Where Divi wins</h3>
                      <ul style={styles.winList}>
                        {whereWeWin.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                    <div style={{ ...styles.winBox, borderColor: '#f39c12' }}>
                      <h3 style={styles.winTitle}>Where Divi falls short</h3>
                      <ul style={styles.winList}>
                        {whereWeFallShort.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                    <div style={{ ...styles.winBox, borderColor: '#3498db' }}>
                      <h3 style={styles.winTitle}>Where we look the same</h3>
                      <ul style={styles.winList}>
                        {(whereSame.length ? whereSame : ['—']).map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                    <div style={{ ...styles.winBox, borderColor: '#9b59b6' }}>
                      <h3 style={styles.winTitle}>How they differentiate</h3>
                      <ul style={styles.winList}>
                        {(whereDiff.length ? whereDiff : ['—']).map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <h3 style={{ ...styles.cardTitle, marginTop: 32 }}>Capability claims (from websites)</h3>
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Capability</th>
                          <th style={styles.th}>Divi site</th>
                          <th style={styles.th}>{selected.name} site</th>
                          <th style={styles.th}>Edge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.map((row, i) => (
                          <tr key={i}>
                            <td style={styles.td}>{row.label || row.feature}</td>
                            <td style={styles.td}>{row.divi}</td>
                            <td style={styles.td}>
                              {row.competitor}
                              {row.evidence ? (
                                <div style={{ ...styles.listItemDesc, marginTop: 6 }}>{row.evidence}</div>
                              ) : null}
                            </td>
                            <td style={styles.td}>
                              <span
                                style={{
                                  ...styles.edgePill,
                                  background:
                                    row.winner === 'divi'
                                      ? '#C523A1'
                                      : row.winner === 'competitor'
                                        ? '#f39c12'
                                        : '#444',
                                }}
                              >
                                {(row.winner || 'tie').toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {comparison.strategic_recommendation && (
                    <div style={styles.recoBox}>
                      <div style={styles.kpiLabel}>What Divi should do</div>
                      <p style={{ margin: '8px 0 0' }}>{comparison.strategic_recommendation}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!detailLoading && section === 'founders' && (
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Team</h2>
              {founders.length === 0 ? (
                <p style={styles.emptyState}>No team members listed yet.</p>
              ) : (
                <div style={styles.founderGrid}>
                  {founders.map((f) => (
                    <div key={f.id} style={styles.founderCard}>
                      <div style={styles.founderName}>{f.name}</div>
                      <div style={styles.founderTitle}>{f.title}</div>
                      {f.location && (
                        <div style={{ ...styles.founderTitle, opacity: 0.75 }}>{f.location}</div>
                      )}
                      {f.prior_companies && (
                        <p style={styles.listItemDesc}>
                          <span style={{ fontWeight: 600 }}>Prior: </span>
                          {f.prior_companies}
                        </p>
                      )}
                      {f.education && (
                        <p style={styles.listItemDesc}>
                          <span style={{ fontWeight: 600 }}>Education: </span>
                          {f.education}
                        </p>
                      )}
                      {f.bio && <p style={styles.listItemDesc}>{f.bio}</p>}
                      <div style={styles.socialRow}>
                        {f.linkedin_url && (
                          <a href={f.linkedin_url} target="_blank" rel="noreferrer" style={styles.profileLink}>
                            LinkedIn
                          </a>
                        )}
                        {f.twitter_url && (
                          <a href={f.twitter_url} target="_blank" rel="noreferrer" style={styles.profileLink}>
                            X / Twitter
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!detailLoading && section === 'funding' && (
            <>
              <div style={styles.kpiGrid}>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Revenue estimate</div>
                  <div style={styles.kpiValue}>
                    {selected.revenue_estimate || profile?.revenue_estimate || '—'}
                  </div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Total funding</div>
                  <div style={styles.kpiValue}>{selected.total_funding_display || '—'}</div>
                </div>
              </div>
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>Funding rounds</h2>
                {fundingRounds.length === 0 ? (
                  <p style={styles.emptyState}>No funding rounds captured</p>
                ) : (
                  <div style={styles.itemList}>
                    {fundingRounds.map((r) => (
                      <div key={r.id} style={styles.listItem}>
                        <div>
                          <div style={styles.listItemTitle}>
                            {r.round_name} · {r.amount_display || 'Amount unknown'}
                            {r.is_estimate ? ' (estimate)' : ''}
                          </div>
                          <div style={styles.listItemDesc}>
                            {[r.announced_date, r.lead_investors, r.source].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {!detailLoading && section === 'sentiment' && (
            <div style={styles.card}>
              {!sentiment ? (
                <>
                  <h2 style={styles.cardTitle}>Site tone</h2>
                  <p style={styles.emptyState}>No site tone yet.</p>
                </>
              ) : (
                <div style={styles.toneLayout}>
                  <div style={styles.toneHeader}>
                    <h2 style={{ ...styles.cardTitle, marginBottom: 0 }}>Site tone</h2>
                    <div style={styles.toneScoreBlock}>
                      <div style={styles.toneScoreRow}>
                        <span
                          style={{
                            ...styles.toneScoreNum,
                            color: sentimentColor(sentiment.score),
                          }}
                        >
                          {sentiment.score ?? '—'}
                        </span>
                        <span style={styles.toneScoreDenom}>/100</span>
                      </div>
                      <div style={styles.toneBand}>
                        {(sentiment.score ?? 0) >= 80
                          ? 'Strong'
                          : (sentiment.score ?? 0) >= 60
                            ? 'Solid'
                            : (sentiment.score ?? 0) >= 40
                              ? 'Mixed'
                              : 'Weak / thin'}
                      </div>
                    </div>
                  </div>

                  {sentiment.summary ? (
                    <p style={styles.toneSummary}>{sentiment.summary}</p>
                  ) : null}

                  {(sentiment.positive_themes || sentiment.negative_themes) && (
                    <div style={styles.toneThemes}>
                      {sentiment.positive_themes ? (
                        <div style={styles.toneThemeCol}>
                          <div style={styles.toneThemeLabel}>What reads clearly</div>
                          <p style={styles.toneThemeText}>{sentiment.positive_themes}</p>
                        </div>
                      ) : null}
                      {sentiment.negative_themes ? (
                        <div style={styles.toneThemeCol}>
                          <div style={styles.toneThemeLabel}>Messaging gaps</div>
                          <p style={styles.toneThemeText}>{sentiment.negative_themes}</p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!detailLoading && section === 'press' && (
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Media coverage</h2>
              {media.length === 0 ? (
                <p style={styles.emptyState}>No press mentions</p>
              ) : (
                <div style={styles.itemList}>
                  {media.map((m) => (
                    <div key={m.id} style={styles.listItem}>
                      <div>
                        <div style={styles.listItemTitle}>
                          {m.url ? (
                            <a href={m.url} target="_blank" rel="noreferrer" style={styles.profileLink}>
                              {m.title}
                            </a>
                          ) : (
                            m.title
                          )}
                        </div>
                        <div style={styles.listItemDesc}>
                          {[m.source_name, m.published_at, m.sentiment].filter(Boolean).join(' · ')}
                        </div>
                        {m.summary && m.summary !== m.title && (
                          <div style={{ ...styles.listItemDesc, marginTop: 6 }}>{m.summary}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!detailLoading && section === 'tech' && (
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Tech stack</h2>
              {techStack.length === 0 ? (
                <p style={styles.emptyState}>No tech signals detected</p>
              ) : (
                <div style={styles.techGrid}>
                  {techStack.map((t) => (
                    <div key={t.id} style={styles.techChip}>
                      <div style={styles.listItemTitle}>{t.technology}</div>
                      <div style={styles.listItemDesc}>
                        {t.category} · {t.confidence}
                        {t.evidence ? ` · ${t.evidence}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!detailLoading && section === 'history' && (
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Company history</h2>
              {profile?.company_history_summary && (
                <p style={styles.overviewText}>{profile.company_history_summary}</p>
              )}
              {history.length === 0 ? (
                <p style={styles.emptyState}>No timeline events yet</p>
              ) : (
                <div style={styles.timeline}>
                  {history.map((h) => (
                    <div key={h.id} style={styles.timelineItem}>
                      <div style={styles.timelineDate}>{h.event_date || '—'}</div>
                      <div>
                        <div style={styles.listItemTitle}>
                          {h.title}
                          {h.event_type ? ` · ${h.event_type}` : ''}
                        </div>
                        {h.description && <div style={styles.listItemDesc}>{h.description}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <nav style={styles.nav}>
        <div style={styles.navContent}>
          <div style={styles.navBrand}>
            <img src="/divi-logo.png" alt="Divi" style={styles.navLogoImg} />
            <span>Divi Intelligence</span>
          </div>
          <div style={styles.navActions}>
            <Link href="/positioning" style={styles.ghostBtn}>
              Market positioning
            </Link>
            <button
              onClick={() => {
                setShowScoringGuide((v) => !v);
                setShowAddForm(false);
              }}
              style={{
                ...styles.ghostBtn,
                ...(showScoringGuide
                  ? { background: 'rgba(197, 35, 161, 0.15)', borderColor: '#C523A1' }
                  : {}),
              }}
            >
              Scoring
            </button>
            <button
              onClick={async () => {
                const password = window.prompt('Enter password to run full analysis:');
                if (password == null) return; // cancelled
                if (!String(password).trim()) {
                  alert('Password required.');
                  return;
                }
                try {
                  const authRes = await fetch('/api/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password }),
                  });
                  const authJson = await authRes.json().catch(() => ({}));
                  if (!authRes.ok || authJson.success === false) {
                    alert(authJson.error || 'Incorrect password');
                    return;
                  }
                } catch (e) {
                  alert(e.message || 'Could not verify password');
                  return;
                }
                if (
                  !confirm(
                    `Run full analysis one company at a time (${competitors.length} total)? Keep this tab open — each company uses its own Vercel timeout, so the batch will not hit the 5‑minute server limit.`
                  )
                ) {
                  return;
                }
                runAnalysis();
              }}
              style={styles.ghostBtn}
              disabled={analyzing || !competitors.length}
              title={
                analysisProgress
                  ? `${analysisProgress.current}/${analysisProgress.total}: ${analysisProgress.name}`
                  : 'Analyzes each company in its own request'
              }
            >
              {analyzing
                ? analysisProgress
                  ? `${analysisProgress.current}/${analysisProgress.total}: ${analysisProgress.name}`
                  : 'Analyzing…'
                : 'Run full analysis'}
            </button>
            <button
              onClick={() => {
                setShowAddForm(true);
                setShowScoringGuide(false);
              }}
              style={styles.addBtn}
            >
              + Add competitor
            </button>
          </div>
        </div>
      </nav>

      <div style={styles.mainContent}>
        <div style={styles.dashHeader}>
          <div style={styles.dashHeaderTop}>
            <div style={styles.dashHeaderCopy}>
              <h1 style={styles.dashTitle}>Competitive Landscape</h1>
              <h2 style={styles.dashKicker}>Competitors vs. Divi</h2>
              <p style={styles.dashSubtitle}>
                <Link href="/positioning" style={{ color: '#C523A1' }}>
                  Market positioning
                </Link>{' '}
                rolls overlapping analyses into what we do well, where we lag, and how to
                separate.
              </p>
            </div>
            <div style={styles.dashCount}>
              <div style={styles.dashCountValue}>{competitors.length}</div>
              <div style={styles.dashCountLabel}>
                {competitors.length === 1 ? 'company' : 'companies'}
              </div>
            </div>
          </div>
          <div style={styles.filterRow}>
            <input
              type="search"
              placeholder="Search companies…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
              aria-label="Search by company name"
            />
            <select
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              style={styles.filterSelect}
              aria-label="Filter by competitor type"
            >
              <option value="all">All competitor types</option>
              <option value="direct">Direct</option>
              <option value="adjacent">Adjacent</option>
              <option value="tangential">Tangential</option>
              <option value="not_a_competitor">Not a competitor</option>
            </select>
          </div>
        </div>

        {showScoringGuide && (
          <div style={styles.formCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16 }}>
              <h3 style={styles.formTitle}>Scoring guide</h3>
              <button
                type="button"
                onClick={() => setShowScoringGuide(false)}
                style={{ ...styles.ghostBtn, padding: '6px 12px', fontSize: 13 }}
              >
                Close
              </button>
            </div>

            <h4 style={styles.scoringH}>Market overlap</h4>
            <div style={styles.scoringTable}>
              <div style={styles.scoringRow}>
                <span style={styles.scoringRange}>High → Direct</span>
                <span style={styles.scoringDesc}>
                  Same primary job as Divi (portfolio ops for angels / individual investors).
                </span>
              </div>
              <div style={styles.scoringRow}>
                <span style={styles.scoringRange}>Medium → Adjacent</span>
                <span style={styles.scoringDesc}>
                  Investor software with a different primary job (GP fund admin, LP portals, CRM-only,
                  banking, back-office).
                </span>
              </div>
              <div style={styles.scoringRow}>
                <span style={styles.scoringRange}>Low → Tangential</span>
                <span style={styles.scoringDesc}>
                  Shared audience only (deal marketplaces, content, communities).
                </span>
              </div>
              <div style={styles.scoringRow}>
                <span style={styles.scoringRange}>None → Not a competitor</span>
                <span style={styles.scoringDesc}>
                  Outside angel / portfolio operating software.
                </span>
              </div>
            </div>

            <h4 style={styles.scoringH}>Site tone (0–100)</h4>
            <div style={styles.scoringTable}>
              <div style={styles.scoringRow}>
                <span style={styles.scoringRange}>80–100</span>
                <span style={styles.scoringDesc}>Strong messaging</span>
              </div>
              <div style={styles.scoringRow}>
                <span style={styles.scoringRange}>60–79</span>
                <span style={styles.scoringDesc}>Solid</span>
              </div>
              <div style={styles.scoringRow}>
                <span style={styles.scoringRange}>40–59</span>
                <span style={styles.scoringDesc}>Mixed</span>
              </div>
              <div style={styles.scoringRow}>
                <span style={styles.scoringRange}>0–39</span>
                <span style={styles.scoringDesc}>Weak / thin</span>
              </div>
            </div>
          </div>
        )}

        {showAddForm && (
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>Add new competitor</h3>
            <input
              placeholder="Company name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={styles.input}
            />
            <input
              placeholder="Website (https://…)"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              style={styles.input}
            />
            <div style={styles.formButtons}>
              <button onClick={addCompetitor} style={styles.addBtn}>
                Add competitor
              </button>
              <button onClick={() => setShowAddForm(false)} style={{ ...styles.addBtn, background: '#555' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && <p style={styles.loadingText}>Loading…</p>}

        {!loading && (() => {
          const q = searchQuery.trim().toLowerCase();
          const filtered = competitors.filter((comp) => {
            const label = String(overlapMeta(comp).label || '').toLowerCase();
            if (labelFilter !== 'all' && label !== labelFilter) return false;
            if (!q) return true;
            return String(comp.name || '')
              .toLowerCase()
              .includes(q);
          });
          return (
            <>
              {(searchQuery || labelFilter !== 'all') && (
                <p style={styles.filterMeta}>
                  Showing {filtered.length} of {competitors.length}
                  {searchQuery ? ` matching “${searchQuery.trim()}”` : ''}
                  {labelFilter !== 'all' ? ` · ${labelFilter.replace(/_/g, ' ')}` : ''}
                </p>
              )}
              {filtered.length === 0 ? (
                <p style={styles.loadingText}>No companies match these filters.</p>
              ) : (
                <div style={styles.grid}>
                  {filtered.map((comp) => {
                    const meta = overlapMeta(comp);
                    const isNew = isNewCompetitor(comp);
                    const accent = isNew ? NEW_COLOR : getTierColor(meta.tier);
                    return (
                    <div
                      key={comp.id}
                      onClick={() => openCompetitor(comp)}
                      style={{
                        ...styles.compCard,
                        borderTopColor: accent,
                        ...(isNew
                          ? {
                              borderColor: 'rgba(34, 197, 94, 0.45)',
                              boxShadow: '0 0 0 1px rgba(34, 197, 94, 0.2)',
                            }
                          : {}),
                      }}
                    >
                      <div style={styles.compCardTop}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <CompanyLogo
                            name={comp.name}
                            website={comp.website}
                            logoUrl={comp.logo_url}
                            size={40}
                          />
                          <h3 style={{ ...styles.compCardTitle, margin: 0 }}>{comp.name}</h3>
                        </div>
                        <span style={{ ...styles.compBadge, background: accent }}>
                          {isDivi(comp) || comp.tier === 'reference'
                            ? 'OUR COMPANY'
                            : isNew
                              ? 'NEW'
                              : meta.levelDisplay.toUpperCase()}
                        </span>
                      </div>
                      {comp.tagline && <p style={styles.cardTagline}>{comp.tagline}</p>}
                      <div style={styles.scorePair}>
                        <div style={styles.compCardScore}>
                          <div
                            style={{
                              fontSize: '1.55em',
                              fontWeight: 800,
                              color: accent,
                              letterSpacing: '-0.02em',
                            }}
                          >
                            {isNew ? '—' : meta.levelDisplay}
                          </div>
                          <div style={styles.scoreLabel}>Overlap</div>
                        </div>
                        <div style={styles.compCardScore}>
                          <div
                            style={{
                              fontSize: '1.05em',
                              fontWeight: 700,
                              marginTop: 8,
                              textTransform: 'none',
                              color: isNew ? NEW_COLOR : undefined,
                            }}
                          >
                            {isNew ? 'New' : meta.labelDisplay}
                          </div>
                          <div style={styles.scoreLabel}>Designation</div>
                        </div>
                      </div>
                      <div
                        style={{
                          ...styles.compCardFooter,
                          ...(isNew
                            ? {
                                background: 'rgba(34, 197, 94, 0.14)',
                                color: NEW_COLOR,
                              }
                            : {}),
                        }}
                      >
                        {isNew ? 'Analyze →' : 'View positioning →'}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </>
          );
        })()}
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
    maxWidth: '1400px',
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
  },
  navLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: '#C523A1',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 800,
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
    cursor: 'pointer',
    fontWeight: 600,
  },
  ghostBtn: {
    background: 'transparent',
    color: '#f5f5f5',
    border: '1px solid #444',
    padding: '10px 18px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  addBtn: {
    background: '#C523A1',
    color: '#fff',
    border: 'none',
    padding: '12px 22px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
  },
  deleteBtn: {
    background: '#e74c3c',
    color: '#fff',
    border: 'none',
    padding: '10px 16px',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
    marginTop: 12,
  },
  mainContent: { maxWidth: '1400px', margin: '0 auto', padding: '40px' },
  dashHeader: {
    marginBottom: 32,
    paddingBottom: 28,
    borderBottom: '1px solid #2d2d2d',
  },
  dashHeaderTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 24,
    flexWrap: 'wrap',
    marginBottom: 22,
  },
  dashHeaderCopy: {
    flex: '1 1 320px',
    minWidth: 0,
    maxWidth: 720,
  },
  dashTitle: {
    margin: '0 0 8px',
    fontSize: '2.75em',
    fontWeight: 800,
    letterSpacing: '-0.03em',
    lineHeight: 1.1,
  },
  dashKicker: {
    margin: '0 0 12px',
    fontSize: '1.15em',
    fontWeight: 650,
    color: '#C523A1',
    letterSpacing: '-0.01em',
  },
  dashSubtitle: {
    margin: 0,
    fontSize: '0.98em',
    lineHeight: 1.55,
    color: '#a8a8a8',
    maxWidth: 560,
  },
  dashCount: {
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: 12,
    padding: '14px 20px',
    minWidth: 110,
    textAlign: 'center',
  },
  dashCountValue: {
    fontSize: '1.8em',
    fontWeight: 800,
    color: '#C523A1',
    lineHeight: 1,
  },
  dashCountLabel: {
    marginTop: 6,
    fontSize: '0.75em',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#888',
    fontWeight: 600,
  },
  filterRow: {
    display: 'flex',
    gap: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  searchInput: {
    flex: '1 1 280px',
    minWidth: 200,
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#f5f5f5',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: '0.95em',
  },
  filterSelect: {
    flex: '0 1 200px',
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#f5f5f5',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: '0.95em',
    cursor: 'pointer',
  },
  filterMeta: {
    textAlign: 'left',
    color: '#888',
    margin: '0 0 16px',
    fontSize: '0.88em',
  },
  formCard: {
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: 12,
    padding: 28,
    marginBottom: 32,
  },
  formTitle: { margin: '0 0 16px', fontSize: '1.15em', fontWeight: 700 },
  scoringLead: {
    margin: '0 0 20px',
    color: '#b0b0b0',
    fontSize: '0.95em',
    lineHeight: 1.5,
  },
  scoringH: {
    margin: '0 0 8px',
    fontSize: '1em',
    fontWeight: 700,
    color: '#f5f5f5',
  },
  scoringBody: {
    margin: '0 0 14px',
    color: '#b0b0b0',
    fontSize: '0.92em',
    lineHeight: 1.55,
  },
  scoringTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 28,
  },
  scoringRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(140px, 200px) 1fr',
    gap: 12,
    alignItems: 'start',
    padding: '10px 12px',
    background: '#141414',
    borderRadius: 8,
    border: '1px solid #2a2a2a',
  },
  scoringRange: {
    fontWeight: 650,
    color: '#C523A1',
    fontSize: '0.9em',
  },
  scoringDesc: {
    color: '#c8c8c8',
    fontSize: '0.9em',
    lineHeight: 1.45,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    background: '#0a0a0a',
    border: '1px solid #2d2d2d',
    borderRadius: 8,
    color: '#fff',
    marginBottom: 12,
    fontSize: '1em',
    boxSizing: 'border-box',
  },
  formButtons: { display: 'flex', gap: 12 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 22,
  },
  compCard: {
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderTop: '4px solid',
    borderRadius: 12,
    cursor: 'pointer',
    padding: 22,
  },
  cardLogoContainer: {
    textAlign: 'center',
    marginBottom: 14,
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLogo: { maxHeight: 64, maxWidth: '100%', objectFit: 'contain' },
  compCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8, marginBottom: 8 },
  compCardTitle: { margin: 0, fontSize: '1.15em', fontWeight: 700 },
  compBadge: { color: '#fff', padding: '5px 10px', borderRadius: 6, fontSize: '0.7em', fontWeight: 700 },
  cardTagline: { margin: '0 0 12px', opacity: 0.65, fontSize: '0.9em' },
  scorePair: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '8px 0 12px' },
  compCardScore: { textAlign: 'center', padding: '8px 0' },
  scoreLabel: { fontSize: '0.8em', opacity: 0.6 },
  cardMeta: { fontSize: '0.85em', opacity: 0.65, minHeight: 20, marginBottom: 10 },
  compCardFooter: {
    textAlign: 'center',
    padding: 10,
    background: 'rgba(197, 35, 161, 0.12)',
    borderRadius: 6,
    color: '#C523A1',
    fontWeight: 600,
    fontSize: '0.9em',
  },
  profileHeader: {
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: 12,
    padding: 32,
    marginBottom: 24,
    display: 'flex',
    justifyContent: 'space-between',
    gap: 32,
    flexWrap: 'wrap',
  },
  profileHeaderLeft: { display: 'flex', gap: 20, alignItems: 'flex-start', flex: 1 },
  profileHeaderRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 14,
    minWidth: 200,
    textAlign: 'right',
  },
  overlapBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  overlapLabel: {
    fontSize: '0.72em',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#888',
  },
  overlapLevel: {
    fontSize: '2.6em',
    fontWeight: 800,
    lineHeight: 1.05,
    letterSpacing: '-0.03em',
  },
  overlapBand: {
    marginTop: 2,
    fontSize: '1.05em',
    fontWeight: 700,
  },
  overlapNote: {
    margin: '6px 0 0',
    maxWidth: 260,
    fontSize: '0.78em',
    lineHeight: 1.4,
    color: '#777',
  },
  profileActions: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  companyLogo: { height: 88, objectFit: 'contain' },
  breadcrumb: {
    fontSize: '0.8em',
    opacity: 0.6,
    letterSpacing: '0.06em',
    fontWeight: 600,
    marginBottom: 6,
  },
  profileTitle: { margin: '0 0 6px', fontSize: '2.2em', fontWeight: 800 },
  tagline: { margin: '0 0 8px', opacity: 0.75 },
  profileLink: { color: '#C523A1', textDecoration: 'none' },
  metaRow: { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12, opacity: 0.7, fontSize: '0.9em' },
  sectionNav: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 24,
    borderBottom: '1px solid #2d2d2d',
    paddingBottom: 12,
  },
  sectionTab: {
    background: 'transparent',
    border: '1px solid #333',
    color: '#ccc',
    padding: '8px 14px',
    borderRadius: 999,
    cursor: 'pointer',
    fontSize: '0.85em',
  },
  sectionTabActive: {
    background: '#C523A1',
    borderColor: '#C523A1',
    color: '#fff',
    fontWeight: 700,
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 14,
    marginBottom: 20,
  },
  kpiCard: {
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: 10,
    padding: 16,
  },
  kpiLabel: { fontSize: '0.75em', opacity: 0.6, textTransform: 'uppercase', fontWeight: 700 },
  kpiValue: { fontSize: '1.35em', fontWeight: 800, marginTop: 8 },
  kpiValueSmall: { fontSize: '1em', fontWeight: 600, marginTop: 8, lineHeight: 1.4 },
  card: {
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: 12,
    padding: 28,
    marginBottom: 20,
  },
  cardTitle: { margin: '0 0 18px', fontSize: '1.2em', fontWeight: 700 },
  snapLayout: {
    display: 'flex',
    flexDirection: 'column',
    gap: 26,
  },
  snapIntro: {
    margin: 0,
    maxWidth: 560,
    color: '#9a9a9a',
    fontSize: '0.92em',
    lineHeight: 1.45,
  },
  snapStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
  },
  snapStat: {
    background: '#141414',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    padding: '14px 16px',
    minHeight: 88,
  },
  snapStatLabel: {
    fontSize: '0.72em',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#888',
    marginBottom: 10,
  },
  snapStatText: {
    margin: 0,
    fontSize: '0.95em',
    fontWeight: 600,
    lineHeight: 1.45,
    color: '#e4e4e4',
  },
  snapStatNum: {
    margin: 0,
    fontSize: '1.65em',
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
    color: '#f0f0f0',
  },
  snapSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  snapSectionLabel: {
    fontSize: '0.72em',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#888',
  },
  snapBody: {
    margin: 0,
    fontSize: '1.02em',
    lineHeight: 1.6,
    color: '#d8d8d8',
    maxWidth: 760,
  },
  snapLinkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  snapLink: {
    color: '#C523A1',
    textDecoration: 'none',
    fontSize: '0.92em',
    lineHeight: 1.4,
    wordBreak: 'break-all',
  },
  snapBulletList: {
    margin: 0,
    paddingLeft: 18,
    color: '#d0d0d0',
    fontSize: '0.95em',
    lineHeight: 1.55,
  },
  snapThemes: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
  },
  snapThemeCol: {
    background: '#141414',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    padding: '16px 18px',
  },
  snapItemList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 10,
  },
  snapItemPositive: {
    background: '#0a0a0a',
    padding: '14px 16px',
    borderRadius: 8,
    borderLeft: '3px solid #C523A1',
  },
  snapItemGap: {
    background: '#0a0a0a',
    padding: '14px 16px',
    borderRadius: 8,
    borderLeft: '3px solid #e74c3c',
  },
  snapItemTitle: {
    fontSize: '0.95em',
    fontWeight: 650,
    color: '#ececec',
    marginBottom: 4,
    lineHeight: 1.35,
  },
  snapItemDesc: {
    fontSize: '0.88em',
    lineHeight: 1.5,
    color: '#9a9a9a',
  },
  snapEmpty: {
    margin: '10px 0 0',
    color: '#666',
    fontSize: '0.92em',
  },
  toneLayout: {
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
  },
  toneHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 28,
    flexWrap: 'wrap',
  },
  toneIntro: {
    margin: 0,
    maxWidth: 420,
    color: '#9a9a9a',
    fontSize: '0.92em',
    lineHeight: 1.45,
  },
  toneScoreBlock: {
    textAlign: 'right',
    minWidth: 160,
  },
  toneScoreRow: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 6,
  },
  toneScoreNum: {
    fontSize: '3.25em',
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: '-0.03em',
  },
  toneScoreDenom: {
    fontSize: '1em',
    color: '#777',
    fontWeight: 500,
  },
  toneBand: {
    marginTop: 6,
    fontSize: '0.95em',
    fontWeight: 650,
    color: '#e8e8e8',
  },
  toneScale: {
    marginTop: 4,
    fontSize: '0.75em',
    color: '#777',
    lineHeight: 1.35,
  },
  toneSummary: {
    margin: 0,
    fontSize: '1.05em',
    lineHeight: 1.6,
    color: '#d8d8d8',
    maxWidth: 720,
  },
  toneThemes: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
  },
  toneThemeCol: {
    background: '#141414',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    padding: '16px 18px',
  },
  toneThemeLabel: {
    fontSize: '0.72em',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#888',
    marginBottom: 10,
  },
  toneThemeText: {
    margin: 0,
    fontSize: '0.95em',
    lineHeight: 1.55,
    color: '#cfcfcf',
  },
  toneSource: {
    margin: 0,
    paddingTop: 4,
    borderTop: '1px solid #2a2a2a',
    fontSize: '0.78em',
    color: '#666',
  },
  overviewText: { fontSize: '1.02em', lineHeight: 1.6, margin: '0 0 12px' },
  valueProp: { margin: 0, opacity: 0.85 },
  scoreExplainer: { fontSize: '0.9em', opacity: 0.75, marginBottom: 18, fontStyle: 'italic' },
  riskBarContainer: { marginBottom: 18 },
  riskBarLabel: { display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontWeight: 600, fontSize: '0.92em' },
  riskBarValue: { color: '#C523A1' },
  riskBarTrack: { background: '#0a0a0a', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: 6 },
  riskBarFill: { height: '100%' },
  riskBarNotes: { fontSize: '0.82em', opacity: 0.65, margin: 0, fontStyle: 'italic' },
  twoColumnGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 },
  itemList: { display: 'flex', flexDirection: 'column', gap: 12 },
  listItem: {
    background: '#0a0a0a',
    padding: 14,
    borderRadius: 8,
    display: 'flex',
    gap: 12,
    borderLeft: '3px solid #C523A1',
  },
  listItemIcon: { color: '#C523A1', fontWeight: 800, minWidth: 18 },
  listItemTitle: { fontWeight: 600, marginBottom: 4 },
  listItemDesc: { fontSize: '0.92em', opacity: 0.7 },
  emptyState: { opacity: 0.6, fontStyle: 'italic' },
  loadingText: { textAlign: 'center', padding: 48, opacity: 0.7 },
  winBox: {
    background: '#0a0a0a',
    border: '1px solid #C523A1',
    borderRadius: 10,
    padding: 18,
  },
  winTitle: { margin: '0 0 10px', fontSize: '1em' },
  winList: { margin: 0, paddingLeft: 18, lineHeight: 1.55 },
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
  edgePill: { color: '#fff', padding: '4px 8px', borderRadius: 999, fontSize: '0.7em', fontWeight: 700 },
  recoBox: {
    marginTop: 24,
    padding: 16,
    background: 'rgba(197,35,161,0.1)',
    borderRadius: 10,
    border: '1px solid rgba(197,35,161,0.35)',
  },
  founderGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 },
  founderCard: { background: '#0a0a0a', borderRadius: 10, padding: 16, border: '1px solid #2d2d2d' },
  founderName: { fontWeight: 700, fontSize: '1.05em' },
  founderTitle: { opacity: 0.7, marginBottom: 8, fontSize: '0.9em' },
  socialRow: { display: 'flex', gap: 14, marginTop: 10 },
  techGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 },
  techChip: { background: '#0a0a0a', border: '1px solid #2d2d2d', borderRadius: 10, padding: 14 },
  timeline: { display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 },
  timelineItem: { display: 'grid', gridTemplateColumns: '90px 1fr', gap: 14 },
  timelineDate: { color: '#C523A1', fontWeight: 700, fontSize: '0.9em' },
};
