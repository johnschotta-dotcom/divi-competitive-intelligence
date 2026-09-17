import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://znusgttwjfuuzhycuvhs.supabase.co',
  'sb_publishable_uBx9cLk0PYHlOz5-kE3nLA_W8I2jQlq'
);

export default function CompetitiveIntelligenceDashboard() {
  const [competitors, setCompetitors] = useState([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState(null);
  const [profile, setProfile] = useState(null);
  const [strengths, setStrengths] = useState([]);
  const [weaknesses, setWeaknesses] = useState([]);
  const [risks, setRisks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');

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

  const fetchCompetitorDetails = async (competitor) => {
    setSelectedCompetitor(competitor);
    setLoading(true);

    const [profileData, strengthsData, weaknessesData, risksData, notesData] = await Promise.all([
      supabase.from('competitor_profiles').select('*').eq('competitor_id', competitor.id).single(),
      supabase.from('competitor_strengths').select('*').eq('competitor_id', competitor.id),
      supabase.from('competitor_weaknesses').select('*').eq('competitor_id', competitor.id),
      supabase.from('risk_assessment').select('*').eq('competitor_id', competitor.id),
      supabase.from('manual_notes').select('*').eq('competitor_id', competitor.id),
    ]);

    setProfile(profileData.data);
    setStrengths(strengthsData.data || []);
    setWeaknesses(weaknessesData.data || []);
    setRisks(risksData.data || []);
    setNotes(notesData.data || []);
    setLoading(false);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;

    const { error } = await supabase.from('manual_notes').insert({
      competitor_id: selectedCompetitor.id,
      note_text: newNote,
      category: 'observation',
      source: 'manual',
    });

    if (!error) {
      setNewNote('');
      fetchCompetitorDetails(selectedCompetitor);
    }
  };

  const getTierColor = (tier) => {
    const colors = { critical: '#ff4d6d', high: '#ff9f1c', medium: '#ffc107', emerging: '#17a2b8', monitor: '#888' };
    return colors[tier] || '#888';
  };

  if (selectedCompetitor && !loading) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <button onClick={() => { setSelectedCompetitor(null); fetchCompetitors(); }} style={styles.backBtn}>
            ← Back to Competitors
          </button>
          <h1 style={{ color: '#C523A1', margin: '10px 0' }}>{selectedCompetitor.name}</h1>
        </header>

        <div style={styles.profileContainer}>
          <div style={styles.profileHeader}>
            <div>
              <p><strong>Website:</strong> <a href={selectedCompetitor.website} target="_blank" rel="noopener noreferrer">{selectedCompetitor.website}</a></p>
              <p><strong>Threat Level:</strong> <span style={{ ...styles.threatBadge, background: getTierColor(selectedCompetitor.tier) }}>{selectedCompetitor.tier.toUpperCase()}</span></p>
              <p><strong>Threat Score:</strong> {selectedCompetitor.threat_score}/100</p>
            </div>
            {profile && (
              <div>
                <p><strong>Credibility:</strong> {profile.credibility_score}/100</p>
                <p><strong>Risk Score:</strong> {profile.risk_score}/100</p>
                <p><strong>Last Analyzed:</strong> {new Date(profile.analyzed_at).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {profile && (
            <>
              <section style={styles.section}>
                <h2 style={{ color: '#C523A1' }}>Overview</h2>
                <p><strong>Summary:</strong> {profile.overall_summary}</p>
                <p><strong>Target Audience:</strong> {profile.target_audience}</p>
                <p><strong>Value Proposition:</strong> {profile.primary_value_prop}</p>
                <p><strong>Business Model:</strong> {profile.business_model}</p>
              </section>

              <section style={styles.section}>
                <h2 style={{ color: '#00d4ff' }}>Strengths (What They Do Well)</h2>
                {strengths.length === 0 ? (
                  <p>No strengths recorded yet. Run agent to analyze.</p>
                ) : (
                  strengths.map((s) => (
                    <div key={s.id} style={styles.strengthBox}>
                      <h3 style={{ margin: '0 0 10px 0', color: '#00d4ff' }}>{s.strength_title}</h3>
                      <p><strong>What it is:</strong> {s.description}</p>
                      <p><strong>Why it's strong:</strong> {s.why_its_strong}</p>
                      <p><strong>Competitive Advantage:</strong> <span style={{ background: s.competitive_advantage_level === 'high' ? '#ff4d6d' : '#ffc107', padding: '4px 8px', borderRadius: '4px', color: '#fff', fontSize: '0.85em' }}>{s.competitive_advantage_level}</span></p>
                    </div>
                  ))
                )}
              </section>

              <section style={styles.section}>
                <h2 style={{ color: '#ff4d6d' }}>Weaknesses (Divi Advantages)</h2>
                {weaknesses.length === 0 ? (
                  <p>No weaknesses recorded yet. Run agent to analyze.</p>
                ) : (
                  weaknesses.map((w) => (
                    <div key={w.id} style={styles.weaknessBox}>
                      <h3 style={{ margin: '0 0 10px 0', color: '#ff4d6d' }}>{w.weakness_title}</h3>
                      <p><strong>Gap:</strong> {w.description}</p>
                      <p><strong>Why it's weak:</strong> {w.why_its_weak}</p>
                      <p><strong>Divi Advantage:</strong> {w.divi_advantage}</p>
                      <p><strong>Opportunity Level:</strong> <span style={{ background: w.opportunity_level === 'high' ? '#00d4ff' : '#17a2b8', padding: '4px 8px', borderRadius: '4px', color: '#fff', fontSize: '0.85em' }}>{w.opportunity_level}</span></p>
                    </div>
                  ))
                )}
              </section>

              <section style={styles.section}>
                <h2 style={{ color: '#ff9f1c' }}>Risk Assessment</h2>
                {risks.length === 0 ? (
                  <p>No risks recorded yet. Run agent to analyze.</p>
                ) : (
                  risks.map((r) => (
                    <div key={r.id} style={styles.riskBox}>
                      <h3 style={{ margin: '0 0 10px 0' }}>{r.risk_category}</h3>
                      <p><strong>Risk Level:</strong> <span style={{ background: getTierColor(r.risk_level), padding: '4px 8px', borderRadius: '4px', color: '#fff', fontSize: '0.85em' }}>{r.risk_level.toUpperCase()}</span></p>
                      <p><strong>Description:</strong> {r.description}</p>
                      <p><strong>Potential Impact:</strong> {r.potential_impact}</p>
                      <p><strong>Mitigation:</strong> {r.mitigation_strategy}</p>
                    </div>
                  ))
                )}
              </section>

              <section style={styles.section}>
                <h2 style={{ color: '#C523A1' }}>Research Notes</h2>
                <div style={styles.notesArea}>
                  {notes.map((n) => (
                    <div key={n.id} style={styles.noteBox}>
                      <p style={{ margin: '0 0 5px 0', fontSize: '0.85em', opacity: 0.7 }}>{new Date(n.added_at).toLocaleDateString()}</p>
                      <p style={{ margin: '0' }}>{n.note_text}</p>
                      {n.source_url && <a href={n.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85em', color: '#C523A1' }}>View Source</a>}
                    </div>
                  ))}
                </div>

                <div style={styles.addNoteForm}>
                  <textarea
                    placeholder="Add a research note... (LinkedIn findings, article, observation, etc.)"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: '#1D1529', border: '1px solid #3d2d52', borderRadius: '6px', color: '#fff', minHeight: '80px', boxSizing: 'border-box' }}
                  />
                  <button onClick={addNote} style={{ marginTop: '10px', padding: '10px 20px', background: '#C523A1', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    Add Note
                  </button>
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
        <h1 style={{ color: '#C523A1' }}>🎯 Divi Competitive Intelligence</h1>
        <p style={{ opacity: 0.8 }}>Deep analysis of {competitors.length} competitors</p>
      </header>

      {loading && <p style={{ textAlign: 'center', padding: '40px' }}>Loading competitors...</p>}

      {!loading && (
        <div style={styles.competitorGrid}>
          {competitors.map((comp) => (
            <div
              key={comp.id}
              onClick={() => fetchCompetitorDetails(comp)}
              style={{ ...styles.competitorCard, borderLeftColor: getTierColor(comp.tier), cursor: 'pointer' }}
            >
              <div style={styles.cardHeader}>
                <h3 style={styles.competitorName}>{comp.name}</h3>
                <span style={{ ...styles.threatBadge, background: getTierColor(comp.tier) }}>
                  {comp.tier.toUpperCase()}
                </span>
              </div>
              <p style={styles.cardText}><strong>Website:</strong> <a href={comp.website} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{comp.website}</a></p>
              <p style={styles.cardText}><strong>Threat Score:</strong> <strong style={{ color: getTierColor(comp.tier) }}>{comp.threat_score}/100</strong></p>
              <p style={{ ...styles.cardText, fontSize: '0.9em', opacity: 0.7 }}>Click to see detailed profile →</p>
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
  competitorGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px', maxWidth: '1400px', margin: '0 auto' },
  competitorCard: { background: '#2d1f42', border: '1px solid #3d2d52', borderLeft: '5px solid', borderRadius: '8px', padding: '20px', transition: 'transform 0.2s, boxShadow 0.2s' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' },
  competitorName: { margin: '0', color: '#fff', fontSize: '1.3em' },
  cardText: { margin: '8px 0', color: '#d0d0d0', fontSize: '0.95em' },
  threatBadge: { padding: '6px 12px', borderRadius: '20px', fontSize: '0.8em', fontWeight: '600', color: '#fff' },
  profileContainer: { maxWidth: '1200px', margin: '0 auto' },
  profileHeader: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', background: '#2d1f42', padding: '30px', borderRadius: '8px', marginBottom: '30px' },
  section: { background: '#2d1f42', padding: '30px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #3d2d52' },
  strengthBox: { background: '#1D1529', padding: '20px', borderRadius: '6px', marginBottom: '15px', borderLeft: '4px solid #00d4ff' },
  weaknessBox: { background: '#1D1529', padding: '20px', borderRadius: '6px', marginBottom: '15px', borderLeft: '4px solid #ff4d6d' },
  riskBox: { background: '#1D1529', padding: '20px', borderRadius: '6px', marginBottom: '15px', borderLeft: '4px solid #ff9f1c' },
  notesArea: { marginBottom: '20px' },
  noteBox: { background: '#1D1529', padding: '15px', borderRadius: '6px', marginBottom: '10px', borderLeft: '3px solid #C523A1' },
  addNoteForm: { background: '#1D1529', padding: '20px', borderRadius: '6px', marginTop: '20px' },
};
