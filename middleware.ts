import { NextRequest, NextResponse } from 'next/server';

/**
 * Private internal tool. Require HTTP Basic Auth when APP_GATE_PASSWORD is set.
 * Always send X-Robots-Tag: noindex so search engines drop the listing.
 */
export function middleware(req: NextRequest) {
  const resHeaders = {
    'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
  };

  // Allow robots.txt and health without auth so Google can read Disallow rules
  const path = req.nextUrl.pathname;
  if (path === '/robots.txt') {
    return NextResponse.next({
      headers: resHeaders,
    });
  }

  const password = (process.env.APP_GATE_PASSWORD || '').trim();
  if (!password) {
    // Fail closed in production if password missing
    if (process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production') {
      return new NextResponse(
        'This application is private. Set APP_GATE_PASSWORD in Vercel environment variables.',
        { status: 503, headers: { ...resHeaders, 'Content-Type': 'text/plain' } }
      );
    }
    return NextResponse.next({ headers: resHeaders });
  }

  const user = (process.env.APP_GATE_USER || 'admin').trim();
  const auth = req.headers.get('authorization');

  if (auth?.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const idx = decoded.indexOf(':');
      const u = idx >= 0 ? decoded.slice(0, idx) : '';
      const p = idx >= 0 ? decoded.slice(idx + 1) : '';
      if (u === user && p === password) {
        return NextResponse.next({ headers: resHeaders });
      }
    } catch {
      /* fall through */
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      ...resHeaders,
      'WWW-Authenticate': 'Basic realm="CryptoByt Private Tool"',
      'Content-Type': 'text/plain',
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets Next serves from /_next
     */
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon).*)',
  ],
};
