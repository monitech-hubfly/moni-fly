import { normalizeAccessRole, type AccessRole } from '@/lib/authz';
import { PRE_BATALHA_PUBLIC_LEITURA_PATH } from '@/lib/pre-batalha-secoes';

/**
 * Rotas permitidas ao papel `team` (matriz: Rede, Comunidade, Novos Negócios + dashboard/tarefas, Perfil, Sirene).
 * Demais seções (Steps, Catálogo, Crédito interno, etc.) ficam só para `admin`.
 */
export const TEAM_ALLOWED_PATH_PREFIXES: readonly string[] = [
  '/dashboard',
  '/rede-franqueados',
  '/comunidade',
  '/treinamento-bca',
  '/pre-batalha',
  '/repositorio',
  '/painel-novos-negocios',
  '/portfolio',
  '/funil-acoplamento',
  '/funil-juridico',
  '/funil-moni-capital',
  '/funil-produto',
  '/funil-modelo-virtual',
  '/funil-homologacoes',
  '/funil-projeto-legal',
  '/projetos-locais',
  '/projetos-legais',
  '/funil-projetos-locais',
  '/operacoes',
  '/funil-stepone',
  '/loteadores',
  '/funil-moni-inc',
  '/dashboard-novos-negocios',
  '/perfil',
  '/alertas',
  '/sirene',
  '/universidade',
  '/admin/universidade',
  '/carometro',
] as const;

export function isTeamAllowedPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return TEAM_ALLOWED_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Rotas do franqueado: portal + funis de Novos Negócios (RLS limita cards/processos ao próprio usuário).
 * Fora daqui: Rede/Comunidade/Sirene matriz, Contabilidade/Crédito e demais `ADMIN_ONLY_PATH_PREFIXES`.
 */
export const FRANK_ALLOWED_PATH_PREFIXES: readonly string[] = [
  '/dashboard',
  '/portal-frank',
  '/treinamento-bca',
  '/pre-batalha',
  '/painel-novos-negocios',
  '/portfolio',
  '/operacoes',
  '/funil-acoplamento',
  '/funil-stepone',
  '/loteadores',
  '/funil-moni-inc',
  '/dashboard-novos-negocios',
  '/perfil',
  '/universidade',
  '/casa0',
  '/casa1',
  '/minhas-empresas',
  '/alertas',
] as const;

/**
 * Fora da matriz Frank: bloqueia estes caminhos mesmo que coincidam com regra ampla; middleware redireciona a frank/franqueado para /portal-frank.
 */
export const FRANK_FORBIDDEN_PATH_PREFIXES: readonly string[] = [
  '/meus-processos',
  '/iniciar-processo',
  '/pre-obra',
  '/saude-unidade',
  '/unidade-franquia',
  '/catalogo-produtos-moni',
  '/obra-ways',
  '/funil-juridico',
  '/funil-moni-capital',
  '/funil-produto',
  '/funil-modelo-virtual',
  '/funil-homologacoes',
  '/funil-projeto-legal',
  '/projetos-locais',
  '/projetos-legais',
  '/funil-projetos-locais',
  '/funil-contratacoes',
] as const;

/** Detalhe de uma linha da rede (`/rede-franqueados/:id`): a página restringe à própria franquia. */
export function isFrankRedeFranqueadoDetalhePath(pathname: string): boolean {
  return /^\/rede-franqueados\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$|\?)/i.test(
    pathname,
  );
}

export function isFrankAllowedPath(pathname: string): boolean {
  if (FRANK_FORBIDDEN_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  if (FRANK_ALLOWED_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (isFrankRedeFranqueadoDetalhePath(pathname)) return true;
  return false;
}

/**
 * Matriz de rotas exclusivas de administrador.
 * O papel `team` não acessa — nem por URL direta (middleware). Franqueado (`frank`) usa `/portal-frank/*`
 * e os prefixos em `FRANK_ALLOWED_PATH_PREFIXES` (funis novos negócios + dashboard + perfil).
 */
export const ADMIN_ONLY_PATH_PREFIXES: readonly string[] = [
  '/admin',
  '/painel-contabilidade',
  '/funil-credito-obra',
  '/financeiro',
  '/juridico',
  '/processo-seletivo-candidatos',
  '/credito-terreno',
  '/credito-checklist',
  '/credito-obra',
  '/credito-abertura-conta',
  '/due-diligence-frank',
  '/due-diligence-empresas',
] as const;

export function isAdminOnlyPath(pathname: string): boolean {
  if (pathname === '/admin/universidade' || pathname.startsWith('/admin/universidade/')) {
    return false;
  }
  return ADMIN_ONLY_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Link público compartilhável do manual BCA (modo leitura, sem Hub). */
export const BCA_PUBLIC_LEITURA_PATH = '/treinamento-bca/leitura' as const;

/** Página pública do manual BCA — sem sidebar, header ou dados do Hub Fly. */
export function isBcaPublicLeituraPagePath(pathname: string): boolean {
  return pathname === BCA_PUBLIC_LEITURA_PATH || pathname.startsWith(`${BCA_PUBLIC_LEITURA_PATH}/`);
}

/** Página pública do guia Pré Batalha — sem sidebar, header ou dados do Hub Fly. */
export function isPreBatalhaPublicLeituraPagePath(pathname: string): boolean {
  return (
    pathname === PRE_BATALHA_PUBLIC_LEITURA_PATH ||
    pathname.startsWith(`${PRE_BATALHA_PUBLIC_LEITURA_PATH}/`)
  );
}

/** Páginas públicas de guias em modo leitura (sem Hub). */
export function isPublicGuiaLeituraPagePath(pathname: string): boolean {
  return isBcaPublicLeituraPagePath(pathname) || isPreBatalhaPublicLeituraPagePath(pathname);
}

/**
 * Conteúdo do portal acessível sem login: guias em leitura + iframe do embed.
 */
export function isBcaPublicLeituraAccessPath(pathname: string): boolean {
  if (isPublicGuiaLeituraPagePath(pathname)) return true;
  return pathname === '/embed' || pathname.startsWith('/embed/');
}

/** Login, convite e recuperação de senha (não é navegação no portal). */
export function isAuthFlowAccessPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/aceitar-convite' ||
    pathname === '/esqueci-senha' ||
    pathname === '/redefinir-senha'
  );
}

export function isPortalFrankAuthAccessPath(pathname: string): boolean {
  return (
    pathname === '/portal-frank/login' ||
    pathname.startsWith('/portal-frank/login/') ||
    pathname === '/portal-frank/cadastro' ||
    pathname.startsWith('/portal-frank/cadastro/')
  );
}

/** Links externos com token (candidato, formulários) — fora do escopo BCA, mas sem sessão. */
function isExternalTokenAccessPath(pathname: string): boolean {
  return (
    pathname.startsWith('/formulario-candidato/') ||
    pathname.startsWith('/loteador/') ||
    pathname.startsWith('/public/forms/') ||
    pathname.startsWith('/api/public/') ||
    pathname.startsWith('/api/candidato/') ||
    pathname === '/api/accept-invite' ||
    pathname.startsWith('/api/webhooks/')
  );
}

/** Sem sessão Supabase: só BCA público, auth, portal Frank (login) e links tokenizados. */
export function isAnonymousAllowedPath(pathname: string): boolean {
  return (
    isBcaPublicLeituraAccessPath(pathname) ||
    isAuthFlowAccessPath(pathname) ||
    isPortalFrankAuthAccessPath(pathname) ||
    isExternalTokenAccessPath(pathname)
  );
}

/** Considera legados: consultor/supervisor contam como admin. */
export function roleMayAccessPath(pathname: string, role: string | null | undefined): boolean {
  const r: AccessRole = normalizeAccessRole(role);
  if (r === 'pending') return isBcaPublicLeituraAccessPath(pathname);
  if (r === 'admin') return true;
  if (r === 'team') return isTeamAllowedPath(pathname);
  if (r === 'frank') return isFrankAllowedPath(pathname);
  return false;
}