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
  const [riskBreakdown, setRiskBreakdown] = useState(null);
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

    const [p, s, w, rb] = await Promise.all([
      supabase.from('competitor_profiles').select('*').eq('competitor_id', comp.id).single(),
      supabase.from('competitor_strengths').select('*').eq('competitor_id', comp.id),
      supabase.from('competitor_weaknesses').select('*').eq('competitor_id', comp.id),
      supabase.from('risk_score_breakdown').select('*').eq('competitor_id', comp.id).single(),
    ]);

    setProfile(p.data);
    setStrengths(s.data || []);
    setWeaknesses(w.data || []);
    setRiskBreakdown(rb.data);
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

  const RiskBar = ({ label, value, notes }) => (
    <div style={styles.riskBarContainer}>
      <div style={styles.riskBarLabel}>
        <span>{label}</span>
        <span style={styles.riskBarValue}>{value}/100</span>
      </div>
      <div style={styles.riskBarTrack}>
        <div
          style={{
            ...styles.riskBarFill,
            width: `${value}%`,
            background: value > 70 ? '#e74c3c' : value > 50 ? '#f39c12' : '#f1c40f',
          }}
        />
      </div>
      {notes && <p style={styles.riskBarNotes}>{notes}</p>}
    </div>
  );

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
            <div style={styles.profileHeaderLeft}>
              {selected.logo_url && (
                <img 
                  src={selected.logo_url} 
                  alt={selected.name}
                  style={styles.companyLogo}
                  onError={(e) => e.target.style.display = 'none'}
                />
              )}
              <div>
                <div style={styles.breadcrumb}>COMPETITIVE PROFILE</div>
                <h1 style={styles.profileTitle}>{selected.name}</h1>
                <a href={selected.website} target="_blank" rel="noopener noreferrer" style={styles.profileLink}>
                  {selected.website}
                </a>
              </div>
            </div>
            <div style={styles.profileHeaderRight}>
              <div style={styles.statBlock}>
                <div style={styles.statLabel}>Overall Risk Score</div>
                <div style={{ fontSize: '3.5em', fontWeight: '900', color: getTierColor(selected.tier) }}>
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
              </div>

              {riskBreakdown && (
                <div style={styles.card}>
                  <h2 style={styles.cardTitle}>📊 How We Score Risk (0-100)</h2>
                  <p style={styles.scoreExplainer}>
                    Risk score is calculated from 5 factors: Team (25%), Features (35%), Funding (15%), Market Fit (15%), Growth (10%)
                  </p>
                  <RiskBar label="Team & Execution" value={riskBreakdown.team_risk} notes={riskBreakdown.team_notes} />
                  <RiskBar label="Product Features" value={riskBreakdown.feature_risk} notes={riskBreakdown.feature_notes} />
                  <RiskBar label="Funding Status" value={riskBreakdown.funding_risk} notes={riskBreakdown.funding_notes} />
                  <RiskBar label="Market Fit" value={riskBreakdown.market_fit_risk} notes={riskBreakdown.market_notes} />
                  <RiskBar label="Growth Momentum" value={riskBreakdown.growth_risk} notes={riskBreakdown.growth_notes} />
                </div>
              )}

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
                {comp.logo_url && (
                  <div style={styles.cardLogoContainer}>
                    <img 
                      src={comp.logo_url} 
                      alt={comp.name}
                      style={styles.cardLogo}
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  </div>
                )}
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
  navButton: { background: 'transparent', color: '#C523A1', border: '1px solid #C523A1', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' },
  addBtn: { background: '#C523A1', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '1em' },
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
  cardLogoContainer: { textAlign: 'center', marginBottom: '16px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardLogo: { maxHeight: '80px', maxWidth: '100%', objectFit: 'contain' },
  compCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' },
  compCardTitle: { margin: 0, fontSize: '1.2em', fontWeight: '700' },
  compBadge: { color: '#fff', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75em', fontWeight: '700' },
  compCardScore: { textAlign: 'center', padding: '20px 0' },
  scoreLabel: { fontSize: '0.9em', opacity: 0.6, marginTop: '4px' },
  compCardFooter: { textAlign: 'center', padding: '12px', background: 'rgba(197, 35, 161, 0.1)', borderRadius: '6px', color: '#C523A1', fontWeight: '600', fontSize: '0.9em', marginTop: '16px' },
  profileHeader: { background: '#1a1a1a', border: '1px solid #2d2d2d', borderRadius: '12px', padding: '40px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '40px' },
  profileHeaderLeft: { display: 'flex', gap: '24px', alignItems: 'flex-start' },
  profileHeaderRight: { textAlign: 'right' },
  companyLogo: { height: '100px', objectFit: 'contain' },
  breadcrumb: { fontSize: '0.9em', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '8px' },
  profileTitle: { margin: '0 0 8px 0', fontSize: '2.5em', fontWeight: '800' },
  profileLink: { color: '#C523A1', textDecoration: 'none', fontSize: '1em' },
  statBlock: { marginBottom: '20px' },
  statLabel: { fontSize: '0.9em', opacity: 0.6, marginBottom: '8px', textTransform: 'uppercase', fontWeight: '600' },
  threatBadgeLarge: { display: 'inline-block', color: '#fff', padding: '12px 20px', borderRadius: '8px', fontWeight: '700', fontSize: '1.1em' },
  card: { background: '#1a1a1a', border: '1px solid #2d2d2d', borderRadius: '12px', padding: '30px', marginBottom: '24px' },
  cardTitle: { margin: '0 0 24px 0', fontSize: '1.3em', fontWeight: '700' },
  overviewText: { fontSize: '1.05em', lineHeight: '1.6', margin: 0, marginBottom: '24px' },
  scoreExplainer: { fontSize: '0.95em', opacity: 0.8, marginBottom: '24px', fontStyle: 'italic' },
  riskBarContainer: { marginBottom: '24px' },
  riskBarLabel: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.95em', fontWeight: '600' },
  riskBarValue: { color: '#C523A1' },
  riskBarTrack: { background: '#0a0a0a', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px' },
  riskBarFill: { height: '100%', transition: 'width 0.3s ease' },
  riskBarNotes: { fontSize: '0.85em', opacity: 0.7, margin: '0', fontStyle: 'italic' },
  twoColumnGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' },
  itemList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  listItem: { background: '#0a0a0a', padding: '16px', borderRadius: '8px', display: 'flex', gap: '16px', borderLeft: '3px solid #C523A1' },
  listItemIcon: { fontSize: '1.2em', fontWeight: '700', color: '#C523A1', minWidth: '24px' },
  listItemTitle: { fontWeight: '600', marginBottom: '4px' },
  listItemDesc: { fontSize: '0.95em', opacity: 0.7 },
  emptyState: { opacity: 0.6, fontStyle: 'italic' },
};
