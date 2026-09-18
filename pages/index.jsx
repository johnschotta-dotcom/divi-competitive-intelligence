import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

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
  const [showAddForm, setShowAddForm] = useState(false);
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

  const fetchCompetitors = async () => {
    setLoading(true);
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

  const runAnalysis = async (competitorId) => {
    setAnalyzing(true);
    try {
      const url = competitorId ? `/api/intelligence?id=${competitorId}` : '/api/intelligence';
      const res = await fetch(url);
      const raw = await res.text();
      let json;
      try {
        json = JSON.parse(raw);
      } catch {
        const snippet = (raw || '').slice(0, 240).replace(/\s+/g, ' ');
        throw new Error(
          res.status === 504 || /timed out|timeout|An error occurred/i.test(raw)
            ? `Analysis timed out or crashed on the server (HTTP ${res.status}). Re-analyze one competitor at a time, and ensure Vercel function duration is high enough. Details: ${snippet || 'empty response'}`
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
    } catch (e) {
      console.error(e);
      alert(e.message);
    } finally {
      setAnalyzing(false);
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
    const trueLabel =
      selected.true_competitor_label || comparison?.true_competitor_label || selected.tier;
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
                style={styles.ghostBtn}
                disabled={analyzing}
              >
                {analyzing ? 'Analyzing…' : 'Re-analyze'}
              </button>
              <button onClick={() => setSelected(null)} style={styles.navButton}>
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
                    ? 'DIVI GOLD STANDARD (OUR COMPANY)'
                    : 'COMPETITIVE PROFILE · SCORED VS DIVI'}
                </div>
                <h1 style={styles.profileTitle}>{selected.name}</h1>
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
              <div style={styles.statRow}>
                <div style={styles.statBlock}>
                  <div style={styles.statLabel}>Market overlap</div>
                  <div style={{ fontSize: '2.6em', fontWeight: 900, color: getTierColor(selected.tier) }}>
                    {overlap ?? '—'}
                  </div>
                </div>
                <div style={styles.statBlock}>
                  <div style={styles.statLabel}>True competitor?</div>
                  <div style={{ fontSize: '1.1em', fontWeight: 800, marginTop: 10, textTransform: 'uppercase' }}>
                    {(trueLabel || '—').replace(/_/g, ' ')}
                  </div>
                </div>
              </div>
              <div style={{ ...styles.threatBadgeLarge, background: getTierColor(selected.tier) }}>
                {isDivi(selected) || selected.tier === 'reference'
                  ? 'GOLD STANDARD'
                  : (trueLabel || selected.tier || 'monitor').replace(/_/g, ' ').toUpperCase()}
              </div>
              <div style={styles.estimateNote}>
                Evidence: websites + LinkedIn only (not funding databases or press scrapes)
              </div>
              {canExport ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
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
              ) : (
                <p style={{ ...styles.estimateNote, marginTop: 12 }}>
                  Re-analyze to enable PDF / DOCX download.
                </p>
              )}
              <button onClick={() => deleteCompetitor(selected.id)} style={styles.deleteBtn}>
                Delete
              </button>
            </div>
          </div>

          <SectionNav />

          {detailLoading && <p style={styles.loadingText}>Loading profile…</p>}

          {!detailLoading && section === 'overview' && (
            <>
              <div style={styles.kpiGrid}>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>What they lead with</div>
                  <div style={styles.kpiValueSmall}>{selected.tagline || profile?.primary_value_prop || '—'}</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Audience (from site)</div>
                  <div style={styles.kpiValueSmall}>{profile?.target_audience || '—'}</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Team on site</div>
                  <div style={styles.kpiValue}>{founders.length || '—'}</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Pages crawled</div>
                  <div style={styles.kpiValue}>
                    {media.filter((m) => m.source_name === 'crawled_page').length || '—'}
                  </div>
                </div>
              </div>

              <div style={styles.card}>
                <h2 style={styles.cardTitle}>Website snapshot</h2>
                <p style={styles.overviewText}>
                  {profile?.overall_summary || 'Re-analyze to populate from their live website.'}
                </p>
                {profile?.primary_value_prop && (
                  <p style={styles.valueProp}>
                    <strong>Value prop / meta:</strong> {profile.primary_value_prop}
                  </p>
                )}
              </div>

              {media.filter((m) => m.source_name === 'crawled_page').length > 0 && (
                <div style={styles.card}>
                  <h2 style={styles.cardTitle}>Pages we read</h2>
                  <div style={styles.itemList}>
                    {media
                      .filter((m) => m.source_name === 'crawled_page')
                      .map((m) => (
                        <div key={m.id || m.title} style={styles.listItem}>
                          <div>
                            <a href={m.url || m.title} target="_blank" rel="noreferrer" style={styles.profileLink}>
                              {m.title}
                            </a>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {media.filter((m) => m.source_name === 'website_heading').length > 0 && (
                <div style={styles.card}>
                  <h2 style={styles.cardTitle}>Headlines / sections on site</h2>
                  <ul style={styles.winList}>
                    {media
                      .filter((m) => m.source_name === 'website_heading')
                      .map((m) => (
                        <li key={m.id || m.title}>{m.title}</li>
                      ))}
                  </ul>
                </div>
              )}

              {(strengths.length > 0 || weaknesses.length > 0) && (
                <div style={styles.twoColumnGrid}>
                  <div style={styles.card}>
                    <h2 style={styles.cardTitle}>What their site sells well</h2>
                    {strengths.length === 0 ? (
                      <p style={styles.emptyState}>—</p>
                    ) : (
                      <div style={styles.itemList}>
                        {strengths.map((s) => (
                          <div key={s.id} style={styles.listItem}>
                            <div>
                              <div style={styles.listItemTitle}>{s.strength_title}</div>
                              <div style={styles.listItemDesc}>{s.why_its_strong}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={styles.card}>
                    <h2 style={styles.cardTitle}>Gaps vs Divi’s site claims</h2>
                    {weaknesses.length === 0 ? (
                      <p style={styles.emptyState}>—</p>
                    ) : (
                      <div style={styles.itemList}>
                        {weaknesses.map((w) => (
                          <div key={w.id} style={{ ...styles.listItem, borderLeft: '3px solid #e74c3c' }}>
                            <div>
                              <div style={styles.listItemTitle}>{w.weakness_title}</div>
                              <div style={styles.listItemDesc}>{w.divi_advantage}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {!detailLoading && section === 'comparison' && (
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>
                {isDivi(selected) ? 'Divi reference positioning' : `Website/LinkedIn: Divi vs ${selected.name}`}
              </h2>
              {!comparison ? (
                <p style={styles.emptyState}>
                  No positioning yet — run Re-analyze (after supabase/03_positioning.sql if columns are missing).
                </p>
              ) : (
                <>
                  <div style={styles.kpiGrid}>
                    <div style={styles.kpiCard}>
                      <div style={styles.kpiLabel}>Market overlap w/ Divi</div>
                      <div style={styles.kpiValue}>{overlap ?? '—'}/100</div>
                    </div>
                    <div style={styles.kpiCard}>
                      <div style={styles.kpiLabel}>True competitor label</div>
                      <div style={styles.kpiValueSmall}>
                        {(trueLabel || '—').replace(/_/g, ' ')}
                      </div>
                    </div>
                    <div style={styles.kpiCard}>
                      <div style={styles.kpiLabel}>Evidence</div>
                      <div style={styles.kpiValueSmall}>
                        {comparison.evidence_basis || 'website + LinkedIn only'}
                      </div>
                    </div>
                  </div>

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
              <h2 style={styles.cardTitle}>Team listed on website</h2>
              {founders.length === 0 ? (
                <p style={styles.emptyState}>
                  No team members extracted yet — re-analyze after deploy (team pages like /team are now crawled with full roster extraction).
                </p>
              ) : (
                <div style={styles.founderGrid}>
                  {founders.map((f) => (
                    <div key={f.id} style={styles.founderCard}>
                      <div style={styles.founderName}>{f.name}</div>
                      <div style={styles.founderTitle}>{f.title}</div>
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
              <h2 style={styles.cardTitle}>Site tone</h2>
              {!sentiment ? (
                <p style={styles.emptyState}>No site tone yet — re-analyze this competitor.</p>
              ) : (
                <>
                  <p style={{ ...styles.estimateNote, marginBottom: 16 }}>
                    Scores how clear and confident their <strong>website messaging</strong> is (value
                    prop, specificity, crawlable depth) — not Twitter/social listening.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
                    <div
                      style={{
                        fontSize: '3.5em',
                        fontWeight: 900,
                        color: sentimentColor(sentiment.score),
                      }}
                    >
                      {sentiment.score ?? '—'}
                    </div>
                    <div style={{ opacity: 0.7 }}>/ 100</div>
                    <div style={{ ...styles.kpiValueSmall, marginLeft: 8 }}>
                      {(sentiment.score ?? 0) >= 80
                        ? 'Strong'
                        : (sentiment.score ?? 0) >= 60
                          ? 'Solid'
                          : (sentiment.score ?? 0) >= 40
                            ? 'Mixed'
                            : 'Weak / thin'}
                    </div>
                  </div>
                  <p style={{ ...styles.estimateNote, marginBottom: 16 }}>
                    80–100 strong · 60–79 solid · 40–59 mixed · 0–39 weak/thin
                  </p>
                  {sentiment.summary ? (
                    <p style={styles.overviewText}>{sentiment.summary}</p>
                  ) : null}
                  {(sentiment.positive_themes || sentiment.negative_themes) && (
                    <div style={styles.twoColumnGrid}>
                      {sentiment.positive_themes ? (
                        <div>
                          <div style={styles.kpiLabel}>What reads clearly</div>
                          <p>{sentiment.positive_themes}</p>
                        </div>
                      ) : null}
                      {sentiment.negative_themes ? (
                        <div>
                          <div style={styles.kpiLabel}>Messaging gaps</div>
                          <p>{sentiment.negative_themes}</p>
                        </div>
                      ) : null}
                    </div>
                  )}
                  {sentiment.sample_sources ? (
                    <p style={styles.estimateNote}>Source: {sentiment.sample_sources}</p>
                  ) : null}
                </>
              )}
            </div>
          )}

          {!detailLoading && section === 'press' && (
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Media coverage</h2>
              {media.length === 0 ? (
                <p style={styles.emptyState}>No press mentions from Google News RSS / analysis</p>
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
            <button
              onClick={() => {
                if (
                  !confirm(
                    'Full analysis can take several minutes and may time out on Vercel. Prefer opening one competitor and clicking Re-analyze. Continue with full run?'
                  )
                ) {
                  return;
                }
                runAnalysis();
              }}
              style={styles.ghostBtn}
              disabled={analyzing}
            >
              {analyzing ? 'Analyzing…' : 'Run full analysis'}
            </button>
            <button onClick={() => setShowAddForm(true)} style={styles.addBtn}>
              + Add competitor
            </button>
          </div>
        </div>
      </nav>

      <div style={styles.mainContent}>
        <div style={styles.dashHeader}>
          <h1 style={styles.dashTitle}>Competitive Landscape</h1>
          <p style={styles.dashSubtitle}>
            Website + LinkedIn positioning vs DIVI — who overlaps our market, where we win, where we
            fall short, and who is truly chasing the same customers ({competitors.length} companies)
          </p>
          <div style={styles.filterRow}>
            <input
              type="search"
              placeholder="Search by company name…"
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
              <option value="all">All types</option>
              <option value="direct">Direct</option>
              <option value="adjacent">Adjacent</option>
              <option value="tangential">Tangential</option>
              <option value="not_a_competitor">Not a competitor</option>
            </select>
          </div>
        </div>

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
            const label = String(
              isDivi(comp) || comp.tier === 'reference'
                ? 'reference'
                : comp.true_competitor_label || ''
            ).toLowerCase();
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
                  {searchQuery ? ` named “${searchQuery.trim()}”` : ''}
                  {labelFilter !== 'all'
                    ? ` · ${labelFilter.replace(/_/g, ' ')}`
                    : ''}
                </p>
              )}
              {filtered.length === 0 ? (
                <p style={styles.loadingText}>No companies match these filters.</p>
              ) : (
                <div style={styles.grid}>
                  {filtered.map((comp) => (
                    <div
                      key={comp.id}
                      onClick={() => fetchDetails(comp)}
                      style={{ ...styles.compCard, borderTopColor: getTierColor(comp.tier) }}
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
                        <span style={{ ...styles.compBadge, background: getTierColor(comp.tier) }}>
                          {isDivi(comp) || comp.tier === 'reference'
                            ? 'OUR COMPANY'
                            : (comp.true_competitor_label || comp.tier || 'monitor')
                                .replace(/_/g, ' ')
                                .toUpperCase()}
                        </span>
                      </div>
                      {comp.tagline && <p style={styles.cardTagline}>{comp.tagline}</p>}
                      <div style={styles.scorePair}>
                        <div style={styles.compCardScore}>
                          <div
                            style={{
                              fontSize: '2.2em',
                              fontWeight: 900,
                              color: getTierColor(comp.tier),
                            }}
                          >
                            {comp.market_overlap_score ?? comp.threat_score ?? '—'}
                          </div>
                          <div style={styles.scoreLabel}>Overlap w/ Divi</div>
                        </div>
                        <div style={styles.compCardScore}>
                          <div
                            style={{
                              fontSize: '1.05em',
                              fontWeight: 800,
                              marginTop: 18,
                              textTransform: 'uppercase',
                            }}
                          >
                            {(comp.true_competitor_label || '—').replace(/_/g, ' ')}
                          </div>
                          <div style={styles.scoreLabel}>True competitor?</div>
                        </div>
                      </div>
                      <div style={styles.cardMeta}>Grounded in website + LinkedIn claims</div>
                      <div style={styles.compCardFooter}>View positioning →</div>
                    </div>
                  ))}
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
  dashHeader: { marginBottom: 40, textAlign: 'center' },
  dashTitle: { margin: 0, fontSize: '2.4em', fontWeight: 800 },
  dashSubtitle: {
    margin: '12px 0 0',
    fontSize: '1.05em',
    opacity: 0.7,
    maxWidth: 720,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  filterRow: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 22,
    maxWidth: 720,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  searchInput: {
    flex: '1 1 260px',
    minWidth: 200,
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#f5f5f5',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: '1em',
  },
  filterSelect: {
    flex: '0 1 220px',
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#f5f5f5',
    borderRadius: 8,
    padding: '12px 14px',
    fontSize: '1em',
    cursor: 'pointer',
  },
  filterMeta: {
    textAlign: 'center',
    opacity: 0.65,
    margin: '0 0 18px',
    fontSize: '0.95em',
  },
  formCard: {
    background: '#1a1a1a',
    border: '1px solid #2d2d2d',
    borderRadius: 12,
    padding: 28,
    marginBottom: 32,
  },
  formTitle: { margin: '0 0 16px', fontSize: '1.15em', fontWeight: 700 },
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
  profileHeaderRight: { textAlign: 'right', minWidth: 200 },
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
  statRow: { display: 'flex', gap: 24, justifyContent: 'flex-end', marginBottom: 12 },
  statBlock: {},
  statLabel: { fontSize: '0.8em', opacity: 0.6, textTransform: 'uppercase', fontWeight: 600 },
  threatBadgeLarge: {
    display: 'inline-block',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: 8,
    fontWeight: 700,
  },
  estimateNote: { fontSize: '0.75em', opacity: 0.55, marginTop: 10, maxWidth: 260, marginLeft: 'auto' },
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
