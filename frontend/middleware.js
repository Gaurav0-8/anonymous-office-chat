import { NextResponse } from 'next/server';

export function middleware(request) {
  // Check the protocol headers set by the reverse proxy / Cloudflare Tunnel
  const proto = request.headers.get('x-forwarded-proto');
  const host = request.headers.get('host') || request.nextUrl.host;
  
  // If the user accessed the site via HTTP in production, redirect them to HTTPS securely
  if (proto === 'http' && host !== 'localhost:3000' && !host.includes('127.0.0.1')) {
    const secureUrl = `https://${host}${request.nextUrl.pathname}${request.nextUrl.search}`;
    return NextResponse.redirect(secureUrl, 301);
  }
  
  return NextResponse.next();
}

// We only want this to run on actual pages and API routes, not static assets
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes - though we could catch these too, our Go backend handles them)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
