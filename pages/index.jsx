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
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', website: '' });

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
    }
  };

  const getTierColor = (tier) => {
    if (!tier) return '#888';
    if (tier.toLowerCase() === 'critical') return '#e74c3c';
    if (tier.toLowerCase() === 'high') return '#f39c12';
    if (tier.toLowerCase() === 'medium') return '#f1c40f';
    return '#3498db';
  };

  if (selected) {
    return (
      <div style={styles.container}>
        <nav style={styles.nav}>
          <div style={styles.navContent}>
            <h1 style={styles.logo}>Divi Intelligence</h1>
            <button onClick={() => setSelected(null)} style={styles.navButton}>
              ← Back to Dashboard
            </button>
          </div>
        </nav>

        <div style={styles.mainContent}>
          {/* Header */}
          <div style={styles.profileHeader}>
            <div>
              <h1 style={styles.compName}>{selected.name}</h1>
              <a href={selected.website} target="_blank" rel="noopener noreferrer" style={styles.link}>
                {selected.website}
              </a>
            </div>
            <div style={styles.headerStats}>
              <div style={styles.stat}>
                <div style={styles.statLabel}>Risk Score</div>
                <div style={{ ...styles.statValue, color: getTierColor(selected.tier) }}>
                  {profile?.risk_score || '—'}/100
                </div>
              </div>
              <div style={styles.stat}>
                <div style={styles.statLabel}>Threat Level</div>
                <div style={{ ...styles.threatBadge, background: getTierColor(selected.tier) }}>
                  {selected.tier?.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {profile && (
            <>
              {/* Overview Card */}
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>Overview</h2>
                <p style={styles.overview}>{profile.overall_summary}</p>
                <div style={styles.metaGrid}>
                  <div>
                    <div style={styles.metaLabel}>Target Audience</div>
                    <div style={styles.metaValue}>{profile.target_audience}</div>
                  </div>
                  <div>
                    <div style={styles.metaLabel}>Funding</div>
                    <div style={styles.metaValue}>{profile.funding_status || 'Unknown'}</div>
                  </div>
                  <div>
                    <div style={styles.metaLabel}>Team Size</div>
                    <div style={styles.metaValue}>~{profile.team_size_estimate}</div>
                  </div>
                </div>
              </div>

              {/* Strengths */}
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>💪 What They Do Well</h2>
                {strengths.length === 0 ? (
                  <p style={styles.empty}>No data available</p>
                ) : (
                  <div style={styles.itemsGrid}>
                    {strengths.map(s => (
                      <div key={s.id} style={styles.item}>
                        <div style={styles.itemTitle}>{s.strength_title}</div>
                        <div style={styles.itemDesc}>{s.why_its_strong}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Weaknesses */}
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>🎯 Divi Opportunities</h2>
                {weaknesses.length === 0 ? (
                  <p style={styles.empty}>No data available</p>
                ) : (
                  <div style={styles.itemsGrid}>
                    {weaknesses.map(w => (
                      <div key={w.id} style={{ ...styles.item, borderLeft: '4px solid #e74c3c' }}>
                        <div style={styles.itemTitle}>{w.weakness_title}</div>
                        <div style={styles.itemDesc}>{w.divi_advantage}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Risks */}
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>⚠️ Risk Assessment</h2>
                {risks.length === 0 ? (
                  <p style={styles.empty}>No risks assessed</p>
                ) : (
                  <div style={styles.itemsGrid}>
                    {risks.map(r => (
                      <div key={r.id} style={{ ...styles.item, borderLeft: `4px solid ${getTierColor(r.risk_level)}` }}>
                        <div style={styles.itemTitle}>{r.risk_category}</div>
                        <div style={styles.itemDesc}>{r.description}</div>
                        <div style={styles.riskMitigation}>💡 {r.mitigation_strategy}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <nav style={styles.nav}>
        <div style={styles.navContent}>
          <h1 style={styles.logo}>🎯 Divi Intelligence</h1>
          <button onClick={() => setShowAddForm(true)} style={styles.addBtn}>
            + Add Competitor
          </button>
        </div>
      </nav>

      <div style={styles.mainContent}>
        <div style={styles.dashboardHeader}>
          <h2>Competitive Landscape</h2>
          <p>Monitoring {competitors.length} competitors in real-time</p>
        </div>

        {showAddForm && (
          <div style={styles.formCard}>
            <h3 style={{ margin: '0 0 20px 0' }}>Add New Competitor</h3>
            <input
              placeholder="Company Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={styles.input}
            />
            <input
              placeholder="Website (e.g., https://example.com)"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              style={styles.input}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={addCompetitor} style={{ ...styles.addBtn, flex: 1 }}>
                Add Competitor
              </button>
              <button 
                onClick={() => setShowAddForm(false)} 
                style={{ ...styles.addBtn, background: '#555', flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && <p style={{ textAlign: 'center', padding: '60px 20px' }}>Loading...</p>}

        {!loading && (
          <div style={styles.grid}>
            {competitors.map(comp => (
              <div
                key={comp.id}
                onClick={() => fetchDetails(comp)}
                style={{ ...styles.compCard, borderTopColor: getTierColor(comp.tier), cursor: 'pointer' }}
              >
                <div style={styles.compCardHeader}>
                  <h3 style={styles.compCardName}>{comp.name}</h3>
                  <span style={{ ...styles.badge, background: getTierColor(comp.tier) }}>
                    {comp.tier?.toUpperCase()}
                  </span>
                </div>

                <div style={styles.compCardBody}>
                  <div style={styles.riskScore}>
                    <div style={styles.riskScoreValue} style={{ color: getTierColor(comp.tier) }}>
                      {comp.threat_score}
                    </div>
                    <div style={styles.riskScoreLabel}>Risk</div>
                  </div>
                </div>

                <div style={styles.compCardFooter}>
                  View profile →
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { background: '#0f0f0f', color: '#f5f5f5', minHeight: '100vh', fontFamily: "'Segoe UI', -apple-system, sans-serif" },
  nav: { background: 'linear-gradient(90deg, #1a1a1a 0%, #252525 100%)', borderBottom: '1px solid #3d2d52', padding: '20px 0', position: 'sticky', top: 0, zIndex: 100 },
  navContent: { maxWidth: '1400px', margin: '0 auto', padding: '0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { margin: 0, fontSize: '1.5em', fontWeight: '700', color: '#C523A1' },
  addBtn: { background: '#C523A1', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.95em' },
  navButton: { background: 'transparent', color: '#C523A1', border: '1px solid #C523A1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' },
  mainContent: { maxWidth: '1400px', margin: '0 auto', padding: '40px' },
  dashboardHeader: { marginBottom: '40px', textAlign: 'center' },
  formCard: { background: '#1a1a1a', border: '1px solid #3d2d52', borderRadius: '12px', padding: '30px', marginBottom: '40px' },
  input: { width: '100%', padding: '12px 16px', background: '#0f0f0f', border: '1px solid #3d2d52', borderRadius: '8px', color: '#fff', marginBottom: '15px', fontSize: '1em', boxSizing: 'border-box' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' },
  compCard: { background: '#1a1a1a', border: '1px solid #3d2d52', borderTop: '4px solid', borderRadius: '12px', overflow: 'hidden', transition: 'all 0.3s ease' },
  compCardHeader: { padding: '20px', borderBottom: '1px solid #3d2d52', display: 'flex', justifyContent: 'space-between', alignItems: 'start' },
  compCardName: { margin: 0, fontSize: '1.2em', fontWeight: '700' },
  badge: { color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75em', fontWeight: '700' },
  compCardBody: { padding: '20px', display: 'flex', justifyContent: 'center' },
  riskScore: { textAlign: 'center' },
  riskScoreValue: { fontSize: '2.5em', fontWeight: '700' },
  riskScoreLabel: { fontSize: '0.9em', opacity: 0.7, marginTop: '4px' },
  compCardFooter: { padding: '15px 20px', background: 'rgba(197, 35, 161, 0.1)', fontSize: '0.9em', color: '#C523A1', fontWeight: '600' },
  profileHeader: { background: '#1a1a1a', border: '1px solid #3d2d52', borderRadius: '12px', padding: '40px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'start' },
  compName: { margin: '0 0 8px 0', fontSize: '2.5em', fontWeight: '700' },
  link: { color: '#C523A1', textDecoration: 'none', fontSize: '1em' },
  headerStats: { display: 'flex', gap: '40px' },
  stat: { textAlign: 'center' },
  statLabel: { fontSize: '0.9em', opacity: 0.7, marginBottom: '8px' },
  statValue: { fontSize: '2em', fontWeight: '700' },
  threatBadge: { color: '#fff', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', display: 'inline-block' },
  card: { background: '#1a1a1a', border: '1px solid #3d2d52', borderRadius: '12px', padding: '30px', marginBottom: '24px' },
  cardTitle: { margin: '0 0 20px 0', fontSize: '1.3em', fontWeight: '700' },
  overview: { fontSize: '1.05em', lineHeight: '1.6', margin: '0 0 20px 0', opacity: 0.95 },
  metaGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '20px' },
  metaLabel: { fontSize: '0.85em', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '8px' },
  metaValue: { fontSize: '1em', fontWeight: '500' },
  itemsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' },
  item: { background: '#0f0f0f', border: '1px solid #3d2d52', borderLeft: '4px solid #C523A1', borderRadius: '8px', padding: '16px' },
  itemTitle: { fontWeight: '600', marginBottom: '8px', fontSize: '1em' },
  itemDesc: { fontSize: '0.95em', opacity: 0.85, lineHeight: '1.5' },
  riskMitigation: { fontSize: '0.9em', opacity: 0.75, marginTop: '12px', fontStyle: 'italic' },
  empty: { opacity: 0.7, fontStyle: 'italic' },
};
