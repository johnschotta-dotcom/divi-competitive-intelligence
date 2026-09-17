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
  const [links, setLinks] = useState([]);
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

    const [p, s, w, r, l] = await Promise.all([
      supabase.from('competitor_profiles').select('*').eq('competitor_id', comp.id).single(),
      supabase.from('competitor_strengths').select('*').eq('competitor_id', comp.id),
      supabase.from('competitor_weaknesses').select('*').eq('competitor_id', comp.id),
      supabase.from('risk_assessment').select('*').eq('competitor_id', comp.id),
      supabase.from('research_links').select('*').eq('competitor_id', comp.id),
    ]);

    setProfile(p.data);
    setStrengths(s.data || []);
    setWeaknesses(w.data || []);
    setRisks(r.data || []);
    setLinks(l.data || []);
    setLoading(false);
  };

  const getTierColor = (tier) => {
    const colors = { critical: '#ff4d6d', high: '#ff9f1c', medium: '#ffc107', emerging: '#17a2b8' };
    return colors[tier] || '#888';
  };

  if (selected && !loading) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <button onClick={() => { setSelected(null); fetchCompetitors(); }} style={styles.backBtn}>
            ← Back
          </button>
          <h1 style={{ color: '#C523A1', margin: 0 }}>{selected.name}</h1>
        </header>

        <div style={styles.profileContainer}>
          {/* Summary Card */}
          <div style={styles.summaryCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <p><strong>Website:</strong> <a href={selected.website} target="_blank" rel="noopener noreferrer" style={{ color: '#C523A1' }}>{selected.website}</a></p>
                <p><strong>Threat Level:</strong> <span style={{ background: getTierColor(selected.tier), padding: '4px 12px', borderRadius: '20px', color: '#fff', fontSize: '0.9em' }}>{selected.tier.toUpperCase()}</span></p>
              </div>
              {profile && (
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '2em', color: getTierColor(selected.tier), fontWeight: 'bold' }}>{profile.risk_score}</p>
                  <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9em' }}>Risk Score</p>
                </div>
              )}
            </div>
          </div>

          {profile && (
            <>
              {/* Overview */}
              <section style={styles.section}>
                <h2>📋 Overview</h2>
                <div style={styles.grid}>
                  <div>
                    <p><strong>What They Do:</strong></p>
                    <p>{profile.overall_summary}</p>
                  </div>
                  <div>
                    <p><strong>Target Audience:</strong> {profile.target_audience}</p>
                    <p><strong>Funding:</strong> {profile.funding_status || 'Unknown'}</p>
                    <p><strong>Team Size:</strong> ~{profile.team_size_estimate} people</p>
                  </div>
                </div>
              </section>

              {/* Strengths */}
              <section style={styles.section}>
                <h2 style={{ color: '#00d4ff' }}>✅ What They Do Well</h2>
                <div style={styles.itemGrid}>
                  {strengths.length === 0 ? (
                    <p>No data yet</p>
                  ) : (
                    strengths.map(s => (
                      <div key={s.id} style={styles.itemCard}>
                        <h3 style={{ margin: '0 0 8px 0', color: '#00d4ff' }}>{s.strength_title}</h3>
                        <p style={{ margin: 0, fontSize: '0.9em', opacity: 0.9 }}>{s.why_its_strong}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Weaknesses - What Divi Can Win On */}
              <section style={styles.section}>
                <h2 style={{ color: '#ff4d6d' }}>🎯 Where Divi Can Win</h2>
                <div style={styles.itemGrid}>
                  {weaknesses.length === 0 ? (
                    <p>No data yet</p>
                  ) : (
                    weaknesses.map(w => (
                      <div key={w.id} style={styles.itemCard}>
                        <h3 style={{ margin: '0 0 8px 0', color: '#ff4d6d' }}>{w.weakness_title}</h3>
                        <p style={{ margin: 0, fontSize: '0.9em', opacity: 0.9 }}>{w.divi_advantage}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Risk Assessment */}
              <section style={styles.section}>
                <h2 style={{ color: '#ff9f1c' }}>⚠️ Risk Assessment</h2>
                <div style={styles.itemGrid}>
                  {risks.length === 0 ? (
                    <p>No risks assessed yet</p>
                  ) : (
                    risks.map(r => (
                      <div key={r.id} style={{ ...styles.itemCard, borderLeft: `4px solid ${getTierColor(r.risk_level)}` }}>
                        <h3 style={{ margin: '0 0 8px 0' }}>{r.risk_category.charAt(0).toUpperCase() + r.risk_category.slice(1)}</h3>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.9em' }}>{r.description}</p>
                        <p style={{ margin: 0, fontSize: '0.85em', opacity: 0.8 }}>💡 {r.mitigation_strategy}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Research Sources */}
              <section style={styles.section}>
                <h2>🔗 Research Sources</h2>
                <div style={styles.linksList}>
                  {links.length === 0 ? (
                    <p>No sources yet</p>
                  ) : (
                    links.map(l => (
                      <div key={l.id} style={styles.linkItem}>
                        <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: '#C523A1', textDecoration: 'none', fontSize: '1em' }}>
                          🔗 {l.title}
                        </a>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85em', opacity: 0.7 }}>{l.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={{ color: '#C523A1', margin: 0 }}>🎯 Divi Competitive Intelligence</h1>
        <p style={{ opacity: 0.8, margin: '8px 0 0 0' }}>Analyzing {competitors.length} competitors</p>
      </header>

      {loading && <p style={{ textAlign: 'center', padding: '40px' }}>Loading...</p>}

      {!loading && (
        <div style={styles.competitorGrid}>
          {competitors.map(comp => (
            <div
              key={comp.id}
              onClick={() => fetchDetails(comp)}
              style={{ ...styles.competitorCard, borderLeftColor: getTierColor(comp.tier), cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, color: '#fff' }}>{comp.name}</h3>
                <span style={{ background: getTierColor(comp.tier), color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8em', fontWeight: '600' }}>
                  {comp.tier.toUpperCase()}
                </span>
              </div>
              <p style={{ margin: '8px 0', fontSize: '0.95em', opacity: 0.9 }}>
                <strong>Threat:</strong> <strong style={{ color: getTierColor(comp.tier) }}>{comp.threat_score}/100</strong>
              </p>
              <p style={{ margin: 0, fontSize: '0.85em', opacity: 0.7 }}>Click to view full profile →</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { background: '#0a0806', color: '#f5f5f5', minHeight: '100vh', padding: '40px', fontFamily: 'system-ui' },
  header: { textAlign: 'center', marginBottom: '40px', borderBottom: '3px solid #C523A1', paddingBottom: '20px' },
  backBtn: { padding: '10px 20px', background: '#C523A1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1em', marginBottom: '20px' },
  competitorGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px', maxWidth: '1400px', margin: '0 auto' },
  competitorCard: { background: '#2d1f42', border: '1px solid #3d2d52', borderLeft: '5px solid', borderRadius: '8px', padding: '20px', transition: 'all 0.2s', cursor: 'pointer' },
  profileContainer: { maxWidth: '1200px', margin: '0 auto' },
  summaryCard: { background: '#2d1f42', border: '1px solid #3d2d52', borderRadius: '8px', padding: '30px', marginBottom: '30px' },
  section: { background: '#2d1f42', border: '1px solid #3d2d52', borderRadius: '8px', padding: '30px', marginBottom: '20px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '15px' },
  itemGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px', marginTop: '15px' },
  itemCard: { background: '#1D1529', border: '1px solid #3d2d52', borderRadius: '6px', padding: '15px', borderLeft: '4px solid #C523A1' },
  linksList: { marginTop: '15px' },
  linkItem: { background: '#1D1529', padding: '12px', borderRadius: '6px', marginBottom: '10px', borderLeft: '3px solid #C523A1' },
};
