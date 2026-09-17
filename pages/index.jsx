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

  const deleteCompetitor = async (compId) => {
    if (!confirm('Delete this competitor?')) return;
    
    await supabase.from('competitors').update({ status: 'deleted' }).eq('id', compId);
    setSelected(null);
    fetchCompetitors();
  };

  const getTierColor = (tier) => {
    if (!tier) return '#3498db';
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
            <div style={styles.navBrand}>
              <div style={styles.navLogo}>🎯</div>
              <span>Divi Intelligence</span>
            </div>
            <button onClick={() => setSelected(null)} style={styles.navButton}>
              ← Back to Dashboard
            </button>
          </div>
        </nav>

        <div style={styles.mainContent}>
          <div style={styles.profileHeader}>
            <div style={styles.profileLeft}>
              <div style={styles.breadcrumb}>COMPETITIVE PROFILE</div>
              <h1 style={styles.profileTitle}>{selected.name}</h1>
              <a href={selected.website} target="_blank" rel="noopener noreferrer" style={styles.profileLink}>
                {selected.website}
              </a>
            </div>
            <div style={styles.profileRight}>
              <div style={styles.statBlock}>
                <div style={styles.statLabel}>Risk Score</div>
                <div style={{ fontSize: '3em', fontWeight: '900', color: getTierColor(selected.tier) }}>
                  {profile?.risk_score || '—'}
                </div>
              </div>
              <div style={styles.statBlock}>
                <div style={styles.statLabel}>Threat Level</div>
                <div style={{ ...styles.threatBadgeLarge, background: getTierColor(selected.tier) }}>
                  {selected.tier?.toUpperCase()}
                </div>
              </div>
              <button 
                onClick={() => deleteCompetitor(selected.id)} 
                style={styles.deleteBtn}
              >
                🗑️ Delete
              </button>
            </div>
          </div>

          {profile && (
            <>
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>📋 Company Overview</h2>
                <p style={styles.overviewText}>{profile.overall_summary}</p>
                <div style={styles.metaGrid}>
                  <div style={styles.metaItem}>
                    <div style={styles.metaLabel}>Target Audience</div>
                    <div style={styles.metaValue}>{profile.target_audience}</div>
                  </div>
                  <div style={styles.metaItem}>
                    <div style={styles.metaLabel}>Funding Status</div>
                    <div style={styles.metaValue}>{profile.funding_status || 'Unknown'}</div>
                  </div>
                  <div style={styles.metaItem}>
                    <div style={styles.metaLabel}>Team Size</div>
                    <div style={styles.metaValue}>~{profile.team_size_estimate} people</div>
                  </div>
                  <div style={styles.metaItem}>
                    <div style={styles.metaLabel}>Last Updated</div>
                    <div style={styles.metaValue}>{new Date(profile.analyzed_at).toLocaleDateString()}</div>
                  </div>
                </div>
              </div>

              <div style={styles.twoColumnGrid}>
                <div style={styles.card}>
                  <h2 style={styles.cardTitle}>💪 Strengths</h2>
                  {strengths.length === 0 ? (
                    <p style={styles.emptyState}>No data available</p>
                  ) : (
                    <div style={styles.itemList}>
                      {strengths.map(s => (
                        <div key={s.id} style={styles.listItem}>
                          <div style={styles.listItemIcon}>✓</div>
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
                  <h2 style={styles.cardTitle}>🎯 Divi Opportunities</h2>
                  {weaknesses.length === 0 ? (
                    <p style={styles.emptyState}>No data available</p>
                  ) : (
                    <div style={styles.itemList}>
                      {weaknesses.map(w => (
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

              <div style={styles.card}>
                <h2 style={styles.cardTitle}>⚠️ Risk Assessment</h2>
                {risks.length === 0 ? (
                  <p style={styles.emptyState}>No risks assessed</p>
                ) : (
                  <div style={styles.riskGrid}>
                    {risks.map(r => (
                      <div key={r.id} style={{ ...styles.riskCard, borderLeft: `4px solid ${getTierColor(r.risk_level)}` }}>
                        <div style={styles.riskCategory}>{r.risk_category.toUpperCase()}</div>
                        <p style={styles.riskDesc}>{r.description}</p>
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
          <div style={styles.navBrand}>
            <div style={styles.navLogo}>🎯</div>
            <span>Divi Intelligence</span>
          </div>
          <button onClick={() => setShowAddForm(true)} style={styles.addBtn}>
            + Add Competitor
          </button>
        </div>
      </nav>

      <div style={styles.mainContent}>
        <div style={styles.dashHeader}>
          <h1 style={styles.dashTitle}>Competitive Landscape</h1>
          <p style={styles.dashSubtitle}>Real-time intelligence on {competitors.length} competitors</p>
        </div>

        {showAddForm && (
          <div style={styles.formCard}>
            <h3 style={styles.formTitle}>Add New Competitor</h3>
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
            <div style={styles.formButtons}>
              <button onClick={addCompetitor} style={styles.addBtn}>
                Add Competitor
              </button>
              <button 
                onClick={() => setShowAddForm(false)} 
                style={{ ...styles.addBtn, background: '#555' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading && <p style={{ textAlign: 'center', padding: '60px', fontSize: '1.1em' }}>Loading...</p>}

        {!loading && (
          <div style={styles.grid}>
            {competitors.map(comp => (
              <div
                key={comp.id}
                onClick={() => fetchDetails(comp)}
                style={{ ...styles.compCard, borderTopColor: getTierColor(comp.tier) }}
              >
                <div style={styles.compCardTop}>
                  <h3 style={styles.compCardTitle}>{comp.name}</h3>
                  <span style={{ ...styles.compBadge, background: getTierColor(comp.tier) }}>
                    {comp.tier?.toUpperCase()}
                  </span>
                </div>
                <div style={styles.compCardScore}>
                  <div style={{ fontSize: '2.5em', fontWeight: '900', color: getTierColor(comp.tier) }}>
                    {comp.threat_score}
                  </div>
                  <div style={styles.scoreLabel}>Risk Score</div>
                </div>
                <div style={styles.compCardFooter}>
                  View Details →
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
  container: { background: '#0a0a0a', color: '#f5f5f5', minHeight: '100vh', fontFamily: "'Segoe UI', -apple-system, sans-serif" },
  nav: { background: '#1a1a1a', borderBottom: '1px solid #2d2d2d', padding: '20px 0', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 10px rgba(0,0,0,0.3)' },
  navContent: { maxWidth: '1400px', margin: '0 auto', padding: '0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  navBrand: { display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.3em', fontWeight: '700', color: '#C523A1' },
  navLogo: { fontSize: '1.5em' },
  navButton: { background: 'transparent', color: '#C523A1', border: '1px solid #C523A1', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.3s' },
  addBtn: { background: '#C523A1', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '1em', transition: 'all 0.3s' },
  deleteBtn: { background: '#e74c3c', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9em', marginTop: '10px' },
  mainContent: { maxWidth: '1400px', margin: '0 auto', padding: '40px' },
  dashHeader: { marginBottom: '50px', textAlign: 'center' },
  dashTitle: { margin: 0, fontSize: '2.5em', fontWeight: '800' },
  dashSubtitle: { margin: '12px 0 0 0', fontSize: '1.1em', opacity: 0.7 },
  formCard: { background: '#1a1a1a', border: '1px solid #2d2d2d', borderRadius: '12px', padding: '30px', marginBottom: '40px' },
  formTitle: { margin: '0 0 20px 0', fontSize: '1.2em', fontWeight: '700' },
  input: { width: '100%', padding: '12px 16px', background: '#0a0a0a', border: '1px solid #2d2d2d', borderRadius: '8px', color: '#fff', marginBottom: '15px', fontSize: '1em', boxSizing: 'border-box' },
  formButtons: { display: 'flex', gap: '12px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' },
  compCard: { background: '#1a1a1a', border: '1px solid #2d2d2d', borderTop: '4px solid', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.3s ease', padding: '24px' },
  compCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' },
  compCardTitle: { margin: 0, fontSize: '1.2em', fontWeight: '700' },
  compBadge: { color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75em', fontWeight: '700' },
  compCardScore: { textAlign: 'center', padding: '20px 0' },
  scoreLabel: { fontSize: '0.9em', opacity: 0.6, marginTop: '4px' },
  compCardFooter: { textAlign: 'center', padding: '12px', background: 'rgba(197, 35, 161, 0.1)', borderRadius: '6px', color: '#C523A1', fontWeight: '600', fontSize: '0.9em', marginTop: '16px' },
  profileHeader: { background: '#1a1a1a', border: '1px solid #2d2d2d', borderRadius: '12px', padding: '40px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  profileLeft: {},
  profileRight: { textAlign: 'right' },
  breadcrumb: { fontSize: '0.9em', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '8px' },
  profileTitle: { margin: '0 0 8px 0', fontSize: '2.5em', fontWeight: '800' },
  profileLink: { color: '#C523A1', textDecoration: 'none', fontSize: '1em' },
  statBlock: { marginBottom: '20px' },
  statLabel: { fontSize: '0.9em', opacity: 0.6, marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' },
  threatBadgeLarge: { display: 'inline-block', color: '#fff', padding: '12px 20px', borderRadius: '8px', fontWeight: '700', fontSize: '1.1em' },
  card: { background: '#1a1a1a', border: '1px solid #2d2d2d', borderRadius: '12px', padding: '30px', marginBottom: '24px' },
  cardTitle: { margin: '0 0 24px 0', fontSize: '1.3em', fontWeight: '700' },
  overviewText: { fontSize: '1.05em', lineHeight: '1.6', margin: 0, marginBottom: '24px' },
  metaGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginTop: '24px' },
  metaItem: { background: '#0a0a0a', padding: '16px', borderRadius: '8px' },
  metaLabel: { fontSize: '0.8em', opacity: 0.6, textTransform: 'uppercase', fontWeight: '600', marginBottom: '8px' },
  metaValue: { fontSize: '1em', fontWeight: '600' },
  twoColumnGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' },
  itemList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  listItem: { background: '#0a0a0a', padding: '16px', borderRadius: '8px', display: 'flex', gap: '16px', borderLeft: '3px solid #C523A1' },
  listItemIcon: { fontSize: '1.2em', fontWeight: '700', color: '#C523A1', minWidth: '24px' },
  listItemTitle: { fontWeight: '600', marginBottom: '4px' },
  listItemDesc: { fontSize: '0.95em', opacity: 0.7 },
  riskGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' },
  riskCard: { background: '#0a0a0a', padding: '16px', borderRadius: '8px', borderLeft: '4px solid' },
  riskCategory: { fontSize: '0.8em', opacity: 0.6, textTransform: 'uppercase', fontWeight: '600', marginBottom: '8px' },
  riskDesc: { margin: '0 0 12px 0', fontSize: '0.95em', lineHeight: '1.5' },
  riskMitigation: { fontSize: '0.9em', opacity: 0.7, fontStyle: 'italic' },
  emptyState: { opacity: 0.6, fontStyle: 'italic' },
};
