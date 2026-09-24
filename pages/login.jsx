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
        background: '#1d1529',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: 24,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#251b36',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: '36px 32px',
          color: '#fafafa',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <img
            src="/divi-logo.png"
            alt="Divi"
            style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', display: 'block' }}
          />
          <div style={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 13 }}>
            Divi
          </div>
        </div>
        <h1
          style={{
            fontSize: '1.8rem',
            margin: '16px 0 8px',
            fontWeight: 800,
            fontFamily: 'Lexend, Inter, sans-serif',
            letterSpacing: '-0.03em',
          }}
        >
          Enter password
        </h1>
        <p style={{ color: '#b8b0c5', marginBottom: 24, fontSize: 14, lineHeight: 1.5 }}>
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
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.18)',
            background: '#1d1529',
            color: '#fff',
            fontSize: 16,
            marginBottom: 12,
            fontFamily: 'inherit',
          }}
        />
        {error ? (
          <p style={{ color: '#ff8fab', fontSize: 14, margin: '0 0 12px' }}>{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={loading || !password}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 999,
            border: 'none',
            background: loading || !password ? '#413552' : '#fafafa',
            color: '#1d1529',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: loading ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
