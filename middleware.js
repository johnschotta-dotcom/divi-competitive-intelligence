import { NextResponse } from 'next/server';

const COOKIE = 'divi_ci_gate';

export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Public paths + Vercel cron for scheduled analysis
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    (pathname.startsWith('/api/intelligence') && req.headers.get('x-vercel-cron') === '1')
  ) {
    return NextResponse.next();
  }

  const gate = decodeURIComponent(req.cookies.get(COOKIE)?.value || '');
  const expected = process.env.SITE_PASSWORD || 'divi.go';

  if (gate && gate === expected) {
    return NextResponse.next();
  }

  // APIs: return 401 instead of HTML redirect
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const login = new URL('/login', req.url);
  if (pathname !== '/') login.searchParams.set('next', pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
