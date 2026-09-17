export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const password = String(req.body?.password || '');
  const expected = process.env.SITE_PASSWORD || 'divi.go';

  if (!password || password !== expected) {
    return res.status(401).json({ success: false, error: 'Incorrect password' });
  }

  const secure = process.env.NODE_ENV === 'production';
  // 30 days
  const maxAge = 60 * 60 * 24 * 30;
  res.setHeader(
    'Set-Cookie',
    `divi_ci_gate=${encodeURIComponent(expected)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
      secure ? '; Secure' : ''
    }`
  );

  return res.status(200).json({ success: true });
}
