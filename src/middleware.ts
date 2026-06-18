import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { isLiveLimitedRelease, isPathAllowedInLimitedRelease } from '@/lib/release-scope';

/** Rotas públicas sem login (ex.: /treinamento-bca/leitura, /pre-batalha/leitura, /embed/*) — ver access-matrix. */

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/onboarding' || pathname.startsWith('/onboarding/')) {
    return NextResponse.redirect(new URL('/rede-franqueados', request.url));
  }

  const response = await updateSession(request);

  if (isLiveLimitedRelease()) {
    if (!isPathAllowedInLimitedRelease(pathname)) {
      const redirect = NextResponse.redirect(new URL('/rede-franqueados', request.url));
      response.cookies.getAll().forEach((cookie) => {
        redirect.cookies.set(cookie.name, cookie.value);
      });
      return redirect;
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
