import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://znusgttwjfuuzhycuvhs.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_uBx9cLk0PYHlOz5-kE3nLA_W8I2jQlq'
);

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
  const [section, setSection] = useState('overview');

  useEffect(() => {
    fetchCompetitors();
  }, []);

  const fetchCompetitors = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('competitors')
      .select('*')
      .eq('status', 'active')
      .order('threat_score', { ascending: false });
    setCompetitors(data || []);
    setLoading(false);
  };

  const fetchDetails = async (comp) => {
    setSelected(comp);
    setSection('overview');
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
    const { error } = await supabase.from('competitors').insert({
      name: formData.name,
      website: formData.website,
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
      const json = await res.json();
      if (!res.ok || json.success === false) {
        alert(json.error || 'Analysis failed');
      } else {
        alert(`Analyzed ${json.analyzed}/${json.total} competitors`);
        await fetchCompetitors();
        if (selected) {
          const refreshed = (await supabase.from('competitors').select('*').eq('id', selected.id).single()).data;
          if (refreshed) await fetchDetails(refreshed);
        }
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const getTierColor = (tier) => {
    if (!tier) return '#3498db';
    const t = tier.toLowerCase();
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
    const tabs = [
      { id: 'overview', label: 'Overview' },
      { id: 'comparison', label: 'Divi vs Them' },
      { id: 'founders', label: 'Founders' },
      { id: 'funding', label: 'Funding' },
      { id: 'sentiment', label: 'Sentiment' },
      { id: 'press', label: 'Press' },
      { id: 'tech', label: 'Tech Stack' },
      { id: 'history', label: 'History' },
    ];
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
    const diviWins = Array.isArray(comparison?.divi_wins) ? comparison.divi_wins : [];
    const competitorWins = Array.isArray(comparison?.competitor_wins)
      ? comparison.competitor_wins
      : [];

    return (
      <div style={styles.container}>
        <nav style={styles.nav}>
          <div style={styles.navContent}>
            <div style={styles.navBrand}>
              <div style={styles.navLogo}>DI</div>
              <span>Divi Intelligence</span>
            </div>
            <div style={styles.navActions}>
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
              {selected.logo_url && (
                <img
                  src={selected.logo_url}
                  alt={selected.name}
                  style={styles.companyLogo}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
              <div>
                <div style={styles.breadcrumb}>COMPETITIVE PROFILE</div>
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
                  <div style={styles.statLabel}>Risk</div>
                  <div style={{ fontSize: '2.6em', fontWeight: 900, color: getTierColor(selected.tier) }}>
                    {profile?.risk_score ?? selected.threat_score ?? '—'}
                  </div>
                </div>
                <div style={styles.statBlock}>
                  <div style={styles.statLabel}>Sentiment</div>
                  <div
                    style={{
                      fontSize: '2.6em',
                      fontWeight: 900,
                      color: sentimentColor(selected.sentiment_score ?? sentiment?.score),
                    }}
                  >
                    {selected.sentiment_score ?? sentiment?.score ?? '—'}
                  </div>
                </div>
              </div>
              <div style={{ ...styles.threatBadgeLarge, background: getTierColor(selected.tier) }}>
                {(selected.tier || 'monitor').toUpperCase()}
              </div>
              <div style={styles.estimateNote}>
                Funding / revenue / sentiment may include free-source estimates
              </div>
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
                  <div style={styles.kpiLabel}>Revenue (est.)</div>
                  <div style={styles.kpiValue}>
                    {selected.revenue_estimate || profile?.revenue_estimate || '—'}
                  </div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Total funding (est.)</div>
                  <div style={styles.kpiValue}>{selected.total_funding_display || '—'}</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Business model</div>
                  <div style={styles.kpiValueSmall}>{profile?.business_model || '—'}</div>
                </div>
                <div style={styles.kpiCard}>
                  <div style={styles.kpiLabel}>Target audience</div>
                  <div style={styles.kpiValueSmall}>{profile?.target_audience || '—'}</div>
                </div>
              </div>

              {profile && (
                <div style={styles.card}>
                  <h2 style={styles.cardTitle}>Company overview</h2>
                  <p style={styles.overviewText}>{profile.overall_summary}</p>
                  {profile.primary_value_prop && (
                    <p style={styles.valueProp}>
                      <strong>Value prop:</strong> {profile.primary_value_prop}
                    </p>
                  )}
                </div>
              )}

              {riskBreakdown && (
                <div style={styles.card}>
                  <h2 style={styles.cardTitle}>Risk breakdown (0–100)</h2>
                  <p style={styles.scoreExplainer}>
                    Team 25% · Features 35% · Funding 15% · Market fit 15% · Growth 10%
                  </p>
                  <RiskBar label="Team & execution" value={riskBreakdown.team_risk} notes={riskBreakdown.team_notes} />
                  <RiskBar label="Product features" value={riskBreakdown.feature_risk} notes={riskBreakdown.feature_notes} />
                  <RiskBar label="Funding status" value={riskBreakdown.funding_risk} notes={riskBreakdown.funding_notes} />
                  <RiskBar label="Market fit" value={riskBreakdown.market_fit_risk} notes={riskBreakdown.market_notes} />
                  <RiskBar label="Growth momentum" value={riskBreakdown.growth_risk} notes={riskBreakdown.growth_notes} />
                </div>
              )}

              <div style={styles.twoColumnGrid}>
                <div style={styles.card}>
                  <h2 style={styles.cardTitle}>Strengths</h2>
                  {strengths.length === 0 ? (
                    <p style={styles.emptyState}>No data yet — run Re-analyze</p>
                  ) : (
                    <div style={styles.itemList}>
                      {strengths.map((s) => (
                        <div key={s.id} style={styles.listItem}>
                          <div style={styles.listItemIcon}>+</div>
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
                  <h2 style={styles.cardTitle}>Divi opportunities</h2>
                  {weaknesses.length === 0 ? (
                    <p style={styles.emptyState}>No data yet — run Re-analyze</p>
                  ) : (
                    <div style={styles.itemList}>
                      {weaknesses.map((w) => (
                        <div key={w.id} style={{ ...styles.listItem, borderLeft: '3px solid #e74c3c' }}>
                          <div style={{ ...styles.listItemIcon, color: '#e74c3c' }}>→</div>
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
            </>
          )}

          {!detailLoading && section === 'comparison' && (
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Divi vs {selected.name}</h2>
              {!comparison ? (
                <p style={styles.emptyState}>No comparison yet — run Re-analyze after deploying the deep-profile schema.</p>
              ) : (
                <>
                  <p style={styles.overviewText}>{comparison.overall_verdict}</p>
                  <div style={styles.twoColumnGrid}>
                    <div style={styles.winBox}>
                      <h3 style={styles.winTitle}>Where Divi wins</h3>
                      <ul style={styles.winList}>
                        {diviWins.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                    <div style={{ ...styles.winBox, borderColor: '#f39c12' }}>
                      <h3 style={styles.winTitle}>{selected.name} advantages</h3>
                      <ul style={styles.winList}>
                        {competitorWins.map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <h3 style={{ ...styles.cardTitle, marginTop: 32 }}>Feature matrix</h3>
                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Capability</th>
                          <th style={styles.th}>Divi</th>
                          <th style={styles.th}>{selected.name}</th>
                          <th style={styles.th}>Edge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.map((row, i) => (
                          <tr key={i}>
                            <td style={styles.td}>{row.label || row.feature}</td>
                            <td style={styles.td}>{row.divi}</td>
                            <td style={styles.td}>{row.competitor}</td>
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
                      <div style={styles.kpiLabel}>Strategic recommendation</div>
                      <p style={{ margin: '8px 0 0' }}>{comparison.strategic_recommendation}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!detailLoading && section === 'founders' && (
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Founders & leadership</h2>
              {founders.length === 0 ? (
                <p style={styles.emptyState}>No founder data yet</p>
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
              <h2 style={styles.cardTitle}>Social / market sentiment</h2>
              {!sentiment ? (
                <p style={styles.emptyState}>No sentiment score yet</p>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 16 }}>
                    <div
                      style={{
                        fontSize: '3.5em',
                        fontWeight: 900,
                        color: sentimentColor(sentiment.score),
                      }}
                    >
                      {sentiment.score}
                    </div>
                    <div style={{ opacity: 0.7 }}>/ 100</div>
                  </div>
                  <p style={styles.overviewText}>{sentiment.summary}</p>
                  <div style={styles.twoColumnGrid}>
                    <div>
                      <div style={styles.kpiLabel}>Positive themes</div>
                      <p>{sentiment.positive_themes || '—'}</p>
                    </div>
                    <div>
                      <div style={styles.kpiLabel}>Negative themes</div>
                      <p>{sentiment.negative_themes || '—'}</p>
                    </div>
                  </div>
                  <p style={styles.estimateNote}>Source: {sentiment.sample_sources}</p>
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
            <div style={styles.navLogo}>DI</div>
            <span>Divi Intelligence</span>
          </div>
          <div style={styles.navActions}>
            <button onClick={() => runAnalysis()} style={styles.ghostBtn} disabled={analyzing}>
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
          <h1 style={styles.dashTitle}>Competitive landscape</h1>
          <p style={styles.dashSubtitle}>
            Deep profiles, sentiment, press, tech stack, and Divi head-to-heads across{' '}
            {competitors.length} competitors
          </p>
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

        {!loading && (
          <div style={styles.grid}>
            {competitors.map((comp) => (
              <div
                key={comp.id}
                onClick={() => fetchDetails(comp)}
                style={{ ...styles.compCard, borderTopColor: getTierColor(comp.tier) }}
              >
                {comp.logo_url && (
                  <div style={styles.cardLogoContainer}>
                    <img
                      src={comp.logo_url}
                      alt={comp.name}
                      style={styles.cardLogo}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div style={styles.compCardTop}>
                  <h3 style={styles.compCardTitle}>{comp.name}</h3>
                  <span style={{ ...styles.compBadge, background: getTierColor(comp.tier) }}>
                    {(comp.tier || 'monitor').toUpperCase()}
                  </span>
                </div>
                {comp.tagline && <p style={styles.cardTagline}>{comp.tagline}</p>}
                <div style={styles.scorePair}>
                  <div style={styles.compCardScore}>
                    <div style={{ fontSize: '2.2em', fontWeight: 900, color: getTierColor(comp.tier) }}>
                      {comp.threat_score}
                    </div>
                    <div style={styles.scoreLabel}>Risk</div>
                  </div>
                  <div style={styles.compCardScore}>
                    <div
                      style={{
                        fontSize: '2.2em',
                        fontWeight: 900,
                        color: sentimentColor(comp.sentiment_score),
                      }}
                    >
                      {comp.sentiment_score ?? '—'}
                    </div>
                    <div style={styles.scoreLabel}>Sentiment</div>
                  </div>
                </div>
                <div style={styles.cardMeta}>
                  {comp.total_funding_display || comp.revenue_estimate || 'Open profile for deep intel'}
                </div>
                <div style={styles.compCardFooter}>View deep profile →</div>
              </div>
            ))}
          </div>
        )}
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
  dashSubtitle: { margin: '12px 0 0', fontSize: '1.05em', opacity: 0.7, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' },
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
