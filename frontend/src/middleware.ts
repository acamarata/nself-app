import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_ROUTES = ['/dashboard', '/account', '/todos', '/lists'];
const AUTH_ROUTES = ['/login', '/register', '/forgot-password'];

function hasAuthToken(request: NextRequest): boolean {
  const cookies = request.cookies;

  const hasSupabaseCookie =
    cookies.has('sb-access-token') ||
    cookies.has('sb-refresh-token') ||
    Array.from(cookies.getAll()).some(
      (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
    );

  if (hasSupabaseCookie) return true;

  const hasNselfCookie =
    cookies.has('nself-access-token') ||
    cookies.has('nself-refresh-token');

  if (hasNselfCookie) return true;

  const hasNhostCookie =
    cookies.has('nhostRefreshToken') ||
    cookies.has('nhost-access-token');

  if (hasNhostCookie) return true;

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) return true;

  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthenticated = hasAuthToken(request);

  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/account/:path*', '/todos/:path*', '/lists/:path*', '/login', '/register', '/forgot-password'],
};
