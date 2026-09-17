import { useState } from 'react';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setError(json.error || 'Incorrect password');
        return;
      }
      const next = typeof router.query.next === 'string' ? router.query.next : '/';
      router.replace(next || '/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #1a1224 0%, #2d1b3d 45%, #1a1224 100%)',
        fontFamily: 'Georgia, "Times New Roman", serif',
        padding: 24,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 400,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16,
          padding: '36px 32px',
          color: '#f5f0f7',
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <img
            src="/divi-logo.png"
            alt="Divi"
            style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', display: 'block' }}
          />
          <div style={{ fontFamily: 'system-ui, sans-serif', fontWeight: 700, letterSpacing: 0.3 }}>
            Divi Intelligence
          </div>
        </div>
        <h1 style={{ fontSize: '1.6rem', margin: '16px 0 8px', fontWeight: 600 }}>Enter password</h1>
        <p style={{ opacity: 0.7, marginBottom: 24, fontFamily: 'system-ui, sans-serif', fontSize: 14 }}>
          This competitive landscape is private.
        </p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '14px 16px',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(0,0,0,0.25)',
            color: '#fff',
            fontSize: 16,
            marginBottom: 12,
            fontFamily: 'system-ui, sans-serif',
          }}
        />
        {error ? (
          <p style={{ color: '#ff8fab', fontSize: 14, margin: '0 0 12px', fontFamily: 'system-ui, sans-serif' }}>
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading || !password}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 10,
            border: 'none',
            background: loading ? '#8a3a74' : '#C523A1',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            cursor: loading ? 'wait' : 'pointer',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {loading ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
