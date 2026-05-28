import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  canAccessFunilContratacoes,
  canAccessFunisInternosNegocio,
  FUNIL_CONTRATACOES_PATH,
  normalizeAccessRole,
} from '@/lib/authz';
import { isAdminOnlyPath, isFrankAllowedPath, isTeamAllowedPath } from '@/lib/access-matrix';
import { allowPublicAccessRedeNovos, isAppFullyPublic } from '@/lib/public-rede-novos';

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/signup' || pathname.startsWith('/signup/')) {
    const url = new URL('/login', request.url);
    url.searchParams.set('tab', 'cadastro');
    return NextResponse.redirect(url);
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = pathname === '/login' || pathname === '/aceitar-convite';
  const isPortalFrankPublic =
    pathname === '/portal-frank/login' ||
    pathname.startsWith('/portal-frank/login/') ||
    pathname === '/portal-frank/cadastro' ||
    pathname.startsWith('/portal-frank/cadastro/');
  const isPublicPage =
    isAuthPage ||
    isPortalFrankPublic ||
    pathname === '/esqueci-senha' ||
    pathname === '/redefinir-senha' ||
    pathname.startsWith('/api/webhooks/');
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
    '/funil-produto',
    '/funil-modelo-virtual',
    '/funil-homologacoes',
    '/funil-projeto-legal',
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
  const publicRedeNovos = allowPublicAccessRedeNovos(pathname);
  const appPublic = isAppFullyPublic();
  const needsAuth = appPublic
    ? pathname === '/admin' || pathname.startsWith('/admin/')
    : (matchesProtected && !publicRedeNovos) || isAdminOnlyPath(pathname);

  if (needsAuth && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && user) {
    const { data: profLogin } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const roleLogin = normalizeAccessRole((profLogin as { role?: string | null } | null)?.role);
    // Usuários pendentes/bloqueados precisam conseguir ver `/login?status=...` sem loop de redirect.
    if (roleLogin === 'pending' || roleLogin === 'blocked') {
      return response;
    }
    if (roleLogin === 'frank') {
      return NextResponse.redirect(new URL('/portal-frank', request.url));
    }
    return NextResponse.redirect(new URL('/rede-franqueados', request.url));
  }

  if (!user || isPublicPage) return response;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, cargo')
    .eq('id', user.id)
    .maybeSingle();
  const profileRow = profile as { role?: string | null; cargo?: string | null } | null;
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
    '/funil-produto',
    '/funil-modelo-virtual',
    '/funil-homologacoes',
    '/funil-projeto-legal',
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
    if (pathname !== '/login') {
      const url = new URL('/login', request.url);
      url.searchParams.set('status', 'pending');
      return NextResponse.redirect(url);
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
