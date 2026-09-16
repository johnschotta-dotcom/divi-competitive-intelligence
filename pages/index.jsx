import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://znusgttwjfuuzhycuvhs.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY || 'sb_publishable_uBx9cLk0PYHlOz5-kE3nLA_W8I2jQlq';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function CompetitiveIntelligenceDashboard() {
  const [competitors, setCompetitors] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [vettingQueue, setVettingQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [formData, setFormData] = useState({
    name: '',
    website: '',
    category: '',
    description: '',
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchCompetitors(),
      fetchAlerts(),
      fetchVettingQueue(),
    ]);
    setLoading(false);
  };

  const fetchCompetitors = async () => {
    const { data, error } = await supabase
      .from('competitors')
      .select('*')
      .eq('status', 'active')
      .order('threat_score', { ascending: false });
    
    if (error) console.error('Error fetching competitors:', error);
    else setCompetitors(data || []);
  };

  const fetchAlerts = async () => {
    const { data, error } = await supabase
      .from('alerts')
      .select('*, competitors(name)')
      .eq('dismissed', false)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) console.error('Error fetching alerts:', error);
    else setAlerts(data || []);
  };

  const fetchVettingQueue = async () => {
    const { data, error } = await supabase
      .from('vetting_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) console.error('Error fetching vetting queue:', error);
    else setVettingQueue(data || []);
  };

  const handleAddCompetitor = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.website) {
      alert('Name and website are required');
      return;
    }

    const { error } = await supabase
      .from('competitors')
      .insert([
        {
          name: formData.name,
          website: formData.website,
          category: formData.category,
          description: formData.description,
          manual_entry: true,
          status: 'active',
          tier: 'monitor',
          threat_score: 50,
        },
      ]);

    if (error) {
      alert('Error adding competitor: ' + error.message);
    } else {
      setFormData({ name: '', website: '', category: '', description: '' });
      alert('Competitor added successfully!');
      fetchCompetitors();
    }
  };

  const handleApproveVetting = async (id, tier) => {
    const vetting = vettingQueue.find(v => v.id === id);
    
    const { error: addError } = await supabase
      .from('competitors')
      .insert([
        {
          name: vetting.competitor_name,
          website: vetting.website,
          category: 'discovered',
          description: vetting.claude_analysis,
          tier: tier || vetting.recommended_tier,
          threat_score: Math.round((vetting.confidence_score || 0.5) * 100),
          status: 'active',
        },
      ]);

    if (!addError) {
      const { error: updateError } = await supabase
        .from('vetting_queue')
        .update({ status: 'approved', reviewed_at: new Date() })
        .eq('id', id);

      if (!updateError) {
        fetchCompetitors();
        fetchVettingQueue();
      }
    }
  };

  const handleRejectVetting = async (id) => {
    const { error } = await supabase
      .from('vetting_queue')
      .update({ status: 'rejected', reviewed_at: new Date() })
      .eq('id', id);

    if (!error) {
      fetchVettingQueue();
    }
  };

  const dismissAlert = async (id) => {
    const { error } = await supabase
      .from('alerts')
      .update({ dismissed: true, dismissed_at: new Date() })
      .eq('id', id);

    if (!error) {
      fetchAlerts();
    }
  };

  const getTierColor = (tier) => {
    const colors = {
      critical: '#ff4d6d',
      high: '#ff9f1c',
      medium: '#ffc107',
      emerging: '#17a2b8',
      monitor: '#888',
    };
    return colors[tier] || '#888';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: '#ff4d6d',
      high: '#ff9f1c',
      medium: '#ffc107',
      low: '#17a2b8',
    };
    return colors[severity] || '#888';
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🎯 Divi Competitive Intelligence</h1>
        <p style={styles.subtitle}>Real-time competitor tracking & threat analysis</p>
      </header>

      <nav style={styles.nav}>
        <button
          style={{
            ...styles.navButton,
            background: activeTab === 'dashboard' ? '#C523A1' : '#2d1f42',
          }}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard ({competitors.length})
        </button>
        <button
          style={{
            ...styles.navButton,
            background: activeTab === 'alerts' ? '#C523A1' : '#2d1f42',
          }}
          onClick={() => setActiveTab('alerts')}
        >
          Alerts ({alerts.length})
        </button>
        <button
          style={{
            ...styles.navButton,
            background: activeTab === 'vetting' ? '#C523A1' : '#2d1f42',
          }}
          onClick={() => setActiveTab('vetting')}
        >
          Vetting Queue ({vettingQueue.length})
        </button>
        <button
          style={{
            ...styles.navButton,
            background: activeTab === 'add' ? '#C523A1' : '#2d1f42',
          }}
          onClick={() => setActiveTab('add')}
        >
          + Add Competitor
        </button>
      </nav>

      <main style={styles.main}>
        {loading && <p style={styles.loading}>Loading data...</p>}

        {activeTab === 'dashboard' && !loading && (
          <div>
            <h2 style={styles.sectionTitle}>Active Competitors</h2>
            {competitors.length === 0 ? (
              <p style={styles.empty}>No competitors tracked yet. Add one to get started!</p>
            ) : (
              <div style={styles.grid}>
                {competitors.map((comp) => (
                  <div key={comp.id} style={{ ...styles.card, borderLeftColor: getTierColor(comp.tier) }}>
                    <div style={styles.cardHeader}>
                      <h3 style={styles.cardTitle}>{comp.name}</h3>
                      <span style={{ ...styles.tier, background: getTierColor(comp.tier) }}>
                        {comp.tier.toUpperCase()}
                      </span>
                    </div>
                    <p style={styles.cardText}><strong>Website:</strong> <a href={comp.website} target="_blank" rel="noopener noreferrer">{comp.website}</a></p>
                    <p style={styles.cardText}><strong>Category:</strong> {comp.category || 'N/A'}</p>
                    <p style={styles.cardText}><strong>Threat Score:</strong> <strong style={{ color: getTierColor(comp.tier) }}>{comp.threat_score}/100</strong></p>
                    {comp.description && <p style={styles.cardText}><strong>Notes:</strong> {comp.description}</p>}
                    <p style={styles.cardMeta}>Last checked: {comp.last_checked ? new Date(comp.last_checked).toLocaleDateString() : 'Never'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'alerts' && !loading && (
          <div>
            <h2 style={styles.sectionTitle}>Recent Alerts</h2>
            {alerts.length === 0 ? (
              <p style={styles.empty}>No active alerts. All quiet!</p>
            ) : (
              <div style={styles.alertList}>
                {alerts.map((alert) => (
                  <div key={alert.id} style={{ ...styles.alertItem, borderLeftColor: getSeverityColor(alert.severity) }}>
                    <div style={styles.alertHeader}>
                      <div>
                        <h4 style={styles.alertTitle}>{alert.competitors?.name}</h4>
                        <p style={styles.alertType}>{alert.alert_type}</p>
                      </div>
                      <span style={{ ...styles.severity, background: getSeverityColor(alert.severity) }}>
                        {alert.severity.toUpperCase()}
                      </span>
                    </div>
                    <p style={styles.alertMessage}>{alert.message}</p>
                    <button
                      style={styles.dismissBtn}
                      onClick={() => dismissAlert(alert.id)}
                    >
                      Dismiss
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'vetting' && !loading && (
          <div>
            <h2 style={styles.sectionTitle}>Vetting Queue (New Competitors)</h2>
            {vettingQueue.length === 0 ? (
              <p style={styles.empty}>No pending vetting. Check back soon!</p>
            ) : (
              <div style={styles.vettingList}>
                {vettingQueue.map((item) => (
                  <div key={item.id} style={styles.vettingCard}>
                    <div style={styles.vettingHeader}>
                      <div>
                        <h4 style={styles.cardTitle}>{item.competitor_name}</h4>
                        <p style={styles.cardText}><a href={item.website} target="_blank" rel="noopener noreferrer">{item.website}</a></p>
                      </div>
                      <span style={{ ...styles.confidence, background: `rgba(197, 35, 161, ${item.confidence_score})` }}>
                        {Math.round(item.confidence_score * 100)}% confident
                      </span>
                    </div>
                    <div style={styles.analysis}>
                      <p><strong>Claude's Analysis:</strong></p>
                      <p style={styles.cardText}>{item.claude_analysis}</p>
                    </div>
                    <p style={styles.cardText}><strong>Recommended Tier:</strong> {item.recommended_tier}</p>
                    <p style={styles.cardText}><strong>Source:</strong> {item.discovery_source}</p>
                    <div style={styles.vettingActions}>
                      <button
                        style={{ ...styles.btn, background: '#00d4ff' }}
                        onClick={() => handleApproveVetting(item.id, item.recommended_tier)}
                      >
                        ✓ Approve
                      </button>
                      <button
                        style={{ ...styles.btn, background: '#ff4d6d' }}
                        onClick={() => handleRejectVetting(item.id)}
                      >
                        ✗ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'add' && !loading && (
          <div>
            <h2 style={styles.sectionTitle}>Manually Add Competitor</h2>
            <form onSubmit={handleAddCompetitor} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Competitor Name *</label>
                <input
                  type="text"
                  placeholder="e.g., AngelHub"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Website URL *</label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Category</label>
                <input
                  type="text"
                  placeholder="e.g., Portfolio Tracking"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  style={styles.input}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Notes/Description</label>
                <textarea
                  placeholder="Any notes about this competitor..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ ...styles.input, minHeight: '100px' }}
                />
              </div>

              <button type="submit" style={styles.submitBtn}>
                + Add Competitor
              </button>
            </form>
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        <p>Divi Competitive Intelligence System v1.0 | Powered by Claude + Supabase</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    background: '#0a0806',
    color: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    minHeight: '100vh',
    padding: '0',
    margin: '0',
  },
  header: {
    background: 'linear-gradient(135deg, #1D1529 0%, #2d1f42 100%)',
    borderBottom: '3px solid #C523A1',
    padding: '40px',
    textAlign: 'center',
  },
  title: {
    fontSize: '2.5em',
    margin: '0 0 10px 0',
    color: '#C523A1',
  },
  subtitle: {
    fontSize: '1.1em',
    opacity: 0.85,
    margin: '0',
  },
  nav: {
    display: 'flex',
    gap: '10px',
    background: '#1D1529',
    padding: '20px 40px',
    borderBottom: '1px solid #3d2d52',
    flexWrap: 'wrap',
  },
  navButton: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.95em',
    fontWeight: '600',
    transition: 'background 0.2s',
  },
  main: {
    padding: '40px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  sectionTitle: {
    fontSize: '1.8em',
    color: '#C523A1',
    marginBottom: '25px',
    borderBottom: '3px solid #C523A1',
    paddingBottom: '15px',
  },
  loading: {
    textAlign: 'center',
    fontSize: '1.1em',
    opacity: 0.7,
  },
  empty: {
    textAlign: 'center',
    opacity: 0.7,
    padding: '40px 20px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
  },
  card: {
    background: '#2d1f42',
    border: '1px solid #3d2d52',
    borderLeft: '5px solid',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 4px 12px rgba(197, 35, 161, 0.15)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    marginBottom: '15px',
  },
  cardTitle: {
    margin: '0 0 5px 0',
    fontSize: '1.3em',
    color: '#fff',
  },
  tier: {
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '0.8em',
    fontWeight: '600',
    color: '#fff',
    whiteSpace: 'nowrap',
  },
  cardText: {
    margin: '8px 0',
    fontSize: '0.95em',
    color: '#d0d0d0',
  },
  cardMeta: {
    marginTop: '15px',
    fontSize: '0.85em',
    opacity: 0.6,
    color: '#b0b0b0',
  },
  alertList: {
    display: 'grid',
    gap: '15px',
  },
  alertItem: {
    background: '#2d1f42',
    border: '1px solid #3d2d52',
    borderLeft: '5px solid',
    borderRadius: '8px',
    padding: '20px',
  },
  alertHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    marginBottom: '10px',
  },
  alertTitle: {
    margin: '0',
    fontSize: '1.1em',
    color: '#fff',
  },
  alertType: {
    margin: '5px 0 0 0',
    fontSize: '0.9em',
    opacity: 0.7,
  },
  severity: {
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '0.75em',
    fontWeight: '600',
    color: '#fff',
    whiteSpace: 'nowrap',
  },
  alertMessage: {
    margin: '10px 0',
    color: '#d0d0d0',
    lineHeight: 1.5,
  },
  dismissBtn: {
    background: '#C523A1',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9em',
  },
  vettingList: {
    display: 'grid',
    gap: '20px',
  },
  vettingCard: {
    background: '#2d1f42',
    border: '2px solid #C523A1',
    borderRadius: '8px',
    padding: '25px',
  },
  vettingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'start',
    marginBottom: '15px',
  },
  confidence: {
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '0.9em',
    fontWeight: '600',
    color: '#fff',
    whiteSpace: 'nowrap',
  },
  analysis: {
    background: '#1D1529',
    padding: '15px',
    borderRadius: '6px',
    marginBottom: '15px',
  },
  vettingActions: {
    display: 'flex',
    gap: '10px',
    marginTop: '15px',
  },
  btn: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.95em',
    fontWeight: '600',
    color: '#fff',
  },
  form: {
    background: '#2d1f42',
    padding: '30px',
    borderRadius: '8px',
    maxWidth: '600px',
  },
  formGroup: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '0.95em',
    fontWeight: '600',
    color: '#C523A1',
  },
  input: {
    width: '100%',
    padding: '10px 15px',
    background: '#1D1529',
    border: '1px solid #3d2d52',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '0.95em',
    boxSizing: 'border-box',
  },
  submitBtn: {
    background: '#C523A1',
    color: '#fff',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    fontSize: '1em',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
  },
  footer: {
    background: '#1D1529',
    borderTop: '1px solid #3d2d52',
    padding: '20px',
    textAlign: 'center',
    color: '#888',
    fontSize: '0.85em',
    marginTop: '60px',
  },
};
