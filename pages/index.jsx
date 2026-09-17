import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://znusgttwjfuuzhycuvhs.supabase.co',
  'sb_publishable_uBx9cLk0PYHlOz5-kE3nLA_W8I2jQlq'
);

export default function Dashboard() {
  const [competitors, setCompetitors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [profile, setProfile] = useState(null);
  const [strengths, setStrengths] = useState([]);
  const [weaknesses, setWeaknesses] = useState([]);
  const [risks, setRisks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompetitors();
  }, []);

  const fetchCompetitors = async () => {
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
    setLoading(true);

    const [p, s, w, r] = await Promise.all([
      supabase.from('competitor_profiles').select('*').eq('competitor_id', comp.id).single(),
      supabase.from('competitor_strengths').select('*').eq('competitor_id', comp.id),
      supabase.from('competitor_weaknesses').select('*').eq('competitor_id', comp.id),
      supabase.from('risk_assessment').select('*').eq('competitor_id', comp.id),
    ]);

    setProfile(p.data);
    setStrengths(s.data || []);
    setWeaknesses(w.data || []);
    setRisks(r.data || []);
    setLoading(false);
  };

  const getTierColor = (tier) => {
    if (!tier) return '#888';
    if (tier.toLowerCase() === 'critical') return '#ff4d6d';
    if (tier.toLowerCase() === 'high') return '#ff9f1c';
    if (tier.toLowerCase() === 'medium') return '#ffc107';
    return '#17a2b8';
  };

  if (selected) {
    return (
      <div style={styles.pageContainer}>
        {/* Header */}
        <header style={styles.pageHeader}>
          <button onClick={() => setSelected(null)} style={styles.backButton}>
            ← Back to List
          </button>
          <div style={{ textAlign: 'center' }}>
            <h1 style={styles.pageTitle}>{selected.name}</h1>
            <a href={selected.website} target="_blank" rel="noopener noreferrer" style={styles.websiteLink}>
              {selected.website}
            </a>
          </div>
        </header>

        <div style={styles.contentWrapper}>
          {/* Summary Card */}
          <div style={styles.summaryCard}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '40px' }}>
              <div>
                <div style={styles.metricLabel}>Threat Level</div>
                <div style={{ ...styles.threatBadge, background: getTierColor(selected.tier) }}>
                  {selected.tier?.toUpperCase() || 'UNKNOWN'}
                </div>
              </div>
              <div>
                <div style={styles.metricLabel}>Risk Score</div>
                <div style={{ fontSize: '2.5em', fontWeight: 'bold', color: getTierColor(selected.tier) }}>
                  {profile?.risk_score || '—'}/100
                </div>
              </div>
              <div>
                <div style={styles.metricLabel}>Last Updated</div>
                <div style={{ fontSize: '1.1em', color: '#d0d0d0' }}>
                  {profile?.analyzed_at ? new Date(profile.analyzed_at).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>
          </div>

          {profile && (
            <>
              {/* Overview Section */}
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Overview</h2>
                <div style={{ background: '#1D1529', padding: '20px', borderRadius: '8px', borderLeft: '4px solid #C523A1' }}>
                  <p style={{ margin: '0 0 15px 0', fontSize: '1.1em', lineHeight: '1.6' }}>
                    {profile.overall_summary}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '20px' }}>
                    <div>
                      <div style={styles.metricLabel}>Target Audience</div>
                      <p style={{ margin: '8px 0 0 0', fontSize: '1em' }}>{profile.target_audience || 'Unknown'}</p>
                    </div>
                    <div>
                      <div style={styles.metricLabel}>Funding Status</div>
                      <p style={{ margin: '8px 0 0 0', fontSize: '1em' }}>{profile.funding_status || 'Unknown'}</p>
                    </div>
                    <div>
                      <div style={styles.metricLabel}>Team Size</div>
                      <p style={{ margin: '8px 0 0 0', fontSize: '1em' }}>~{profile.team_size_estimate || 'Unknown'}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Strengths */}
              <section style={styles.section}>
                <h2 style={{ ...styles.sectionTitle, color: '#00d4ff' }}>💪 Strengths</h2>
                {strengths.length === 0 ? (
                  <p style={{ opacity: 0.7 }}>No data available</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
                    {strengths.map(s => (
                      <div key={s.id} style={styles.card}>
                        <div style={{ color: '#00d4ff', fontWeight: '600', marginBottom: '8px' }}>
                          {s.strength_title}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.95em', opacity: 0.85 }}>
                          {s.why_its_strong}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Weaknesses - Divi Opportunities */}
              <section style={styles.section}>
                <h2 style={{ ...styles.sectionTitle, color: '#ff4d6d' }}>🎯 Divi Opportunities</h2>
                <p style={{ opacity: 0.8, marginTop: 0 }}>Where Divi has competitive advantages:</p>
                {weaknesses.length === 0 ? (
                  <p style={{ opacity: 0.7 }}>No data available</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px' }}>
                    {weaknesses.map(w => (
                      <div key={w.id} style={{ ...styles.card, borderLeft: '4px solid #ff4d6d' }}>
                        <div style={{ color: '#ff4d6d', fontWeight: '600', marginBottom: '8px' }}>
                          {w.weakness_title}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.95em', opacity: 0.85 }}>
                          {w.divi_advantage}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Risk Assessment */}
              <section style={styles.section}>
                <h2 style={{ ...styles.sectionTitle, color: '#ff9f1c' }}>⚠️ Risk Assessment</h2>
                {risks.length === 0 ? (
                  <p style={{ opacity: 0.7 }}>No risks assessed</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '15px' }}>
                    {risks.map(r => (
                      <div key={r.id} style={{ ...styles.card, borderLeft: `4px solid ${getTierColor(r.risk_level)}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                          <div style={{ color: getTierColor(r.risk_level), fontWeight: '600' }}>
                            {r.risk_category.charAt(0).toUpperCase() + r.risk_category.slice(1)}
                          </div>
                          <span style={{ background: getTierColor(r.risk_level), color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75em', fontWeight: '600' }}>
                            {r.risk_level.toUpperCase()}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.95em', opacity: 0.85 }}>
                          {r.description}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.9em', opacity: 0.7, fontStyle: 'italic' }}>
                          💡 {r.mitigation_strategy}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      {/* Header */}
      <header style={styles.homeHeader}>
        <div style={styles.headerContent}>
          <h1 style={styles.homeTitle}>Competitive Intelligence Dashboard</h1>
          <p style={styles.homeSubtitle}>Real-time analysis of {competitors.length} competitors</p>
        </div>
      </header>

      <div style={styles.contentWrapper}>
        {loading && <p style={{ textAlign: 'center', padding: '60px 20px', fontSize: '1.1em' }}>Loading competitors...</p>}

        {!loading && (
          <div style={styles.competitorGrid}>
            {competitors.map(comp => (
              <div
                key={comp.id}
                onClick={() => fetchDetails(comp)}
                style={styles.competitorCardHome}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                  <h3 style={styles.competitorName}>{comp.name}</h3>
                  <div style={{ ...styles.threatLabel, background: getTierColor(comp.tier) }}>
                    {comp.tier?.toUpperCase()}
                  </div>
                </div>

                <div style={styles.riskMeter}>
                  <div style={styles.riskMeterLabel}>Risk Score</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <div style={{ fontSize: '1.8em', fontWeight: 'bold', color: getTierColor(comp.tier) }}>
                      {comp.threat_score}
                    </div>
                    <div style={{ fontSize: '0.9em', opacity: 0.7 }}>/100</div>
                  </div>
                </div>

                <p style={{ margin: '16px 0 0 0', fontSize: '0.85em', opacity: 0.7 }}>
                  View details →
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  pageContainer: { background: '#0a0806', color: '#f5f5f5', minHeight: '100vh', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  pageHeader: { background: 'linear-gradient(135deg, #1D1529 0%, #2d1f42 100%)', borderBottom: '1px solid #3d2d52', padding: '40px 20px', textAlign: 'center' },
  homeHeader: { background: 'linear-gradient(135deg, #C523A1 0%, #1D1529 100%)', padding: '80px 20px', textAlign: 'center' },
  headerContent: { maxWidth: '1200px', margin: '0 auto' },
  backButton: { background: '#C523A1', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.95em', fontWeight: '500', marginBottom: '20px' },
  pageTitle: { margin: '0 0 12px 0', fontSize: '2.5em', fontWeight: '700', color: '#C523A1' },
  homeTitle: { margin: 0, fontSize: '3em', fontWeight: '800', color: '#fff' },
  homeSubtitle: { margin: '12px 0 0 0', fontSize: '1.2em', opacity: 0.9, color: '#fff' },
  websiteLink: { color: '#00d4ff', textDecoration: 'none', fontSize: '0.95em' },
  contentWrapper: { maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' },
  summaryCard: { background: 'linear-gradient(135deg, #2d1f42 0%, #1D1529 100%)', border: '1px solid #3d2d52', borderRadius: '12px', padding: '40px', marginBottom: '40px', boxShadow: '0 4px 20px rgba(197, 35, 161, 0.1)' },
  metricLabel: { fontSize: '0.85em', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '8px' },
  threatBadge: { display: 'inline-block', color: '#fff', padding: '12px 20px', borderRadius: '8px', fontSize: '1em', fontWeight: '700' },
  section: { marginBottom: '40px' },
  sectionTitle: { margin: '0 0 24px 0', fontSize: '1.5em', fontWeight: '700', color: '#fff' },
  card: { background: '#1D1529', border: '1px solid #3d2d52', borderRadius: '8px', padding: '16px', borderLeft: '4px solid #C523A1', transition: 'all 0.3s ease' },
  competitorGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' },
  competitorCardHome: { background: '#2d1f42', border: '1px solid #3d2d52', borderRadius: '12px', padding: '24px', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' },
  competitorName: { margin: 0, fontSize: '1.3em', fontWeight: '700', color: '#fff' },
  threatLabel: { color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8em', fontWeight: '700' },
  riskMeter: { background: '#1D1529', padding: '16px', borderRadius: '8px', marginTop: '16px' },
  riskMeterLabel: { fontSize: '0.8em', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '8px' },
};
