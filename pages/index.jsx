import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://znusgttwjfuuzhycuvhs.supabase.co',
  'sb_publishable_uBx9cLk0PYHlOz5-kE3nLA_W8I2jQlq'
);

export default function Dashboard() {
  const [competitors, setCompetitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [formData, setFormData] = useState({ name: '', website: '', category: '', description: '' });

  useEffect(() => {
    fetchCompetitors();
  }, []);

  const fetchCompetitors = async () => {
    const { data } = await supabase.from('competitors').select('*').eq('status', 'active');
    setCompetitors(data || []);
    setLoading(false);
  };

  const handleAddCompetitor = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.website) { alert('Name and website required'); return; }
    
    await supabase.from('competitors').insert([{
      name: formData.name,
      website: formData.website,
      category: formData.category,
      description: formData.description,
      manual_entry: true,
      status: 'active',
      tier: 'monitor',
      threat_score: 50,
    }]);
    
    setFormData({ name: '', website: '', category: '', description: '' });
    fetchCompetitors();
  };

  return (
    <div style={{ background: '#0a0806', color: '#f5f5f5', minHeight: '100vh', padding: '40px', fontFamily: 'system-ui' }}>
      <h1 style={{ color: '#C523A1' }}>🎯 Divi Competitive Intelligence</h1>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
        <button onClick={() => setActiveTab('dashboard')} style={{ padding: '10px 20px', background: activeTab === 'dashboard' ? '#C523A1' : '#2d1f42', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          Dashboard ({competitors.length})
        </button>
        <button onClick={() => setActiveTab('add')} style={{ padding: '10px 20px', background: activeTab === 'add' ? '#C523A1' : '#2d1f42', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          Add Competitor
        </button>
      </div>

      {activeTab === 'dashboard' && !loading && (
        <div>
          <h2 style={{ color: '#C523A1', marginBottom: '20px' }}>Competitors</h2>
          {competitors.length === 0 ? (
            <p>No competitors yet. Add one!</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              {competitors.map((c) => (
                <div key={c.id} style={{ background: '#2d1f42', border: '1px solid #3d2d52', borderRadius: '8px', padding: '20px', borderLeft: '5px solid #C523A1' }}>
                  <h3 style={{ margin: '0 0 10px 0', color: '#fff' }}>{c.name}</h3>
                  <p style={{ margin: '5px 0', color: '#d0d0d0' }}><strong>Website:</strong> <a href={c.website} target="_blank" rel="noopener noreferrer" style={{ color: '#C523A1' }}>{c.website}</a></p>
                  <p style={{ margin: '5px 0', color: '#d0d0d0' }}><strong>Tier:</strong> {c.tier}</p>
                  <p style={{ margin: '5px 0', color: '#d0d0d0' }}><strong>Threat Score:</strong> {c.threat_score}/100</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'add' && (
        <div style={{ background: '#2d1f42', padding: '30px', borderRadius: '8px', maxWidth: '600px' }}>
          <h2 style={{ color: '#C523A1', marginTop: 0 }}>Add New Competitor</h2>
          <form onSubmit={handleAddCompetitor}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#C523A1' }}>Competitor Name</label>
              <input type="text" placeholder="e.g., AngelHub" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '10px', background: '#1D1529', border: '1px solid #3d2d52', borderRadius: '6px', color: '#fff', boxSizing: 'border-box' }} required />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#C523A1' }}>Website URL</label>
              <input type="url" placeholder="https://example.com" value={formData.website} onChange={(e) => setFormData({...formData, website: e.target.value})} style={{ width: '100%', padding: '10px', background: '#1D1529', border: '1px solid #3d2d52', borderRadius: '6px', color: '#fff', boxSizing: 'border-box' }} required />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#C523A1' }}>Category</label>
              <input type="text" placeholder="e.g., Portfolio Tracking" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} style={{ width: '100%', padding: '10px', background: '#1D1529', border: '1px solid #3d2d52', borderRadius: '6px', color: '#fff', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" style={{ width: '100%', padding: '12px', background: '#C523A1', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1em', fontWeight: 600, cursor: 'pointer' }}>
              Add Competitor
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
