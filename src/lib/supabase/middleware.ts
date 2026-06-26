import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  canAccessFunilContratacoes,
  canAccessFunisInternosNegocio,
  FUNIL_CONTRATACOES_PATH,
  normalizeAccessRole,
} from '@/lib/authz';
import {
  BCA_PUBLIC_LEITURA_PATH,
  isAdminOnlyPath,
  isAnonymousAllowedPath,
  isAuthFlowAccessPath,
  isBcaPublicLeituraAccessPath,
  isCalculadoraPublicLeituraPath,
  isFrankAllowedPath,
  isTeamAllowedPath,
} from '@/lib/access-matrix';
import { PRE_BATALHA_PUBLIC_LEITURA_PATH } from '@/lib/pre-batalha-secoes';
import { isLiveLimitedRelease } from '@/lib/release-scope';

const HUB_FLY_HOME_TODO_PATH = '/carometro/todo';

function shouldUseTodoAsHubFlyHome(accessRole: ReturnType<typeof normalizeAccessRole>): boolean {
  return (accessRole === 'team' || accessRole === 'admin') && !isLiveLimitedRelease();
}

function redirectToPublicLeituraFallback(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/pre-batalha' || pathname.startsWith('/pre-batalha/')) {
    return NextResponse.redirect(new URL(PRE_BATALHA_PUBLIC_LEITURA_PATH, request.url));
  }
  return NextResponse.redirect(new URL(BCA_PUBLIC_LEITURA_PATH, request.url));
}

/** Cookie de sessão Supabase — evita round-trip Auth em rotas públicas sem login. */
function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((cookie) => cookie.name.includes('-auth-token'));
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/signup' || pathname.startsWith('/signup/')) {
    const url = new URL('/login', request.url);
    url.searchParams.set('tab', 'cadastro');
    return NextResponse.redirect(url);
  }

  if (isCalculadoraPublicLeituraPath(pathname)) {
    return NextResponse.next({ request });
  }

  // Rotas públicas sem cookie de sessão: não chama Supabase (reduz timeout no Edge).
  if (isAnonymousAllowedPath(pathname) && !hasSupabaseAuthCookie(request)) {
    return NextResponse.next({ request });
  }

  const response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]),
        );
      },
    },
  });

  const getUserWithTimeout = Promise.race([
    supabase.auth.getUser(),
    new Promise<{ data: { user: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { user: null } }), 3000),
    ),
  ]);
  const {
    data: { user },
  } = await getUserWithTimeout;

  // APIs: só renova cookies de sessão; autorização fica nos handlers / RLS.
  if (pathname.startsWith('/api')) {
    return response;
  }

  const isAuthPage = isAuthFlowAccessPath(pathname);
  const protectedPrefixes = [
    '/step-one',
    '/step-2',
    '/step-3',
    '/step-5',
    '/step-6',
    '/step-7',
    '/painel',
    '/painel-novos-negocios',
    '/portfolio',
    '/funil-acoplamento',
    '/funil-juridico',
    '/funil-moni-capital',
    '/funil-funding',
    '/funil-produto',
    '/funil-modelo-virtual',
    '/funil-homologacoes',
    '/funil-projeto-legal',
    '/projetos-locais',
    '/projetos-legais',
    '/funil-projetos-locais',
    '/funil-contratacoes',
    '/dashboard',
    '/operacoes',
    '/funil-stepone',
    '/loteadores',
    '/funil-moni-inc',
    '/dashboard-novos-negocios',
    '/rede-franqueados',
    '/comunidade',
    '/repositorio',
    '/perfil',
    '/sirene',
    '/universidade',
    '/casa0',
    '/casa1',
    '/admin/universidade',
  ];
  const matchesProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
  const needsAuth = matchesProtected || isAdminOnlyPath(pathname);

  if (!user) {
    if (isAnonymousAllowedPath(pathname)) {
      return response;
    }
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return redirectToPublicLeituraFallback(request);
  }

  // Try to read role from cache cookie first (avoids DB round-trip on every request)
  const PROFILE_CACHE_COOKIE = 'moni_profile_cache';
  const cachedProfile = request.cookies.get(PROFILE_CACHE_COOKIE)?.value;
  let profileRow: { role?: string | null; cargo?: string | null } | null = null;
  let profileFromCache = false;

  if (cachedProfile) {
    try {
      profileRow = JSON.parse(cachedProfile) as { role?: string | null; cargo?: string | null };
      profileFromCache = true;
    } catch {
      profileRow = null;
    }
  }

  if (!profileRow) {
    const profileWithTimeout = await Promise.race([
      supabase.from('profiles').select('role, cargo').eq('id', user.id).maybeSingle(),
      new Promise<{ data: null }>((resolve) =>
        setTimeout(() => resolve({ data: null }), 3000),
      ),
    ]);
    const { data: profile } = profileWithTimeout;
    profileRow = profile as { role?: string | null; cargo?: string | null } | null;
    // Cache the profile in a cookie for 5 minutes
    if (profileRow) {
      response.cookies.set(PROFILE_CACHE_COOKIE, JSON.stringify(profileRow), {
        maxAge: 300,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      });
    }
  }

  if (isAuthPage && user) {
    if (!profileRow) {
      return response;
    }
    const rawRoleLogin = String(profileRow.role ?? '').trim().toLowerCase();
    const roleLogin = normalizeAccessRole(profileRow.role);
    if (rawRoleLogin === 'pending') {
      return redirectToPublicLeituraFallback(request);
    }
    if (roleLogin === 'blocked') {
      return response;
    }
    if (roleLogin === 'frank') {
      return NextResponse.redirect(new URL('/portal-frank', request.url));
    }
    if (shouldUseTodoAsHubFlyHome(roleLogin)) {
      return NextResponse.redirect(new URL(HUB_FLY_HOME_TODO_PATH, request.url));
    }
    return NextResponse.redirect(new URL('/rede-franqueados', request.url));
  }
  const rawProfileRole = String(profileRow?.role ?? '').trim().toLowerCase();
  const accessRole = normalizeAccessRole(profileRow?.role);

  if (
    (pathname === FUNIL_CONTRATACOES_PATH || pathname.startsWith(`${FUNIL_CONTRATACOES_PATH}/`)) &&
    !pathname.startsWith('/api')
  ) {
    if (!canAccessFunilContratacoes(profileRow?.role, profileRow?.cargo)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  const funisInternosNegocioPaths = [
    '/funil-juridico',
    '/funil-moni-capital',
    '/funil-funding',
    '/funil-produto',
    '/funil-modelo-virtual',
    '/funil-homologacoes',
    '/funil-projeto-legal',
    '/projetos-locais',
    '/projetos-legais',
    '/funil-projetos-locais',
  ] as const;
  if (
    funisInternosNegocioPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`)) &&
    !pathname.startsWith('/api')
  ) {
    if (!canAccessFunisInternosNegocio(profileRow?.role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  const sirenePath = pathname === '/sirene' || pathname.startsWith('/sirene/');
  if (sirenePath && !pathname.startsWith('/api')) {
    const bloqueioSirene = ['frank', 'franqueado', 'parceiro', 'fornecedor', 'cliente'];
    if (bloqueioSirene.includes(rawProfileRole)) {
      const dest = rawProfileRole === 'frank' || rawProfileRole === 'franqueado' ? '/portal-frank' : '/rede-franqueados';
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }

  if (accessRole === 'pending') {
    if (!isBcaPublicLeituraAccessPath(pathname)) {
      return redirectToPublicLeituraFallback(request);
    }
    return response;
  }

  if (accessRole === 'blocked') {
    if (pathname !== '/login') {
      const url = new URL('/login', request.url);
      url.searchParams.set('status', 'blocked');
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (pathname === '/' && shouldUseTodoAsHubFlyHome(accessRole)) {
    return NextResponse.redirect(new URL(HUB_FLY_HOME_TODO_PATH, request.url));
  }

  // Franqueado: apenas rotas sob /portal-frank (login/cadastro públicos tratados acima).
  if (accessRole === 'frank' && !pathname.startsWith('/api')) {
    if (!isFrankAllowedPath(pathname)) {
      return NextResponse.redirect(new URL('/portal-frank', request.url));
    }
  }

  // Team: gestão da Universidade em /admin/universidade; rotas de franqueado não usadas na sidebar.
  if (accessRole === 'team' && !pathname.startsWith('/api')) {
    if (pathname === '/universidade' || pathname.startsWith('/universidade/')) {
      return NextResponse.redirect(new URL('/admin/universidade', request.url));
    }
  }

  // Team: só Rede, Comunidade, Novos Negócios (painel/dashboard/tarefas), Perfil e home `/`.
  // APIs seguem validação nos handlers / RLS (não redirecionar JSON).
  if (accessRole === 'team' && !pathname.startsWith('/api')) {
    if (!isTeamAllowedPath(pathname)) {
      return NextResponse.redirect(new URL('/rede-franqueados', request.url));
    }
  }

  const isAdminOnly = isAdminOnlyPath(pathname);
  if (isAdminOnly && accessRole !== 'admin') {
    const dest = accessRole === 'frank' ? '/portal-frank' : '/rede-franqueados';
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return response;
}
