import { normalizeAccessRole, type AccessRole } from '@/lib/authz';

/**
 * Rotas permitidas ao papel `team` (matriz: Rede, Comunidade, Novos Negócios + dashboard/tarefas, Perfil).
 * Demais seções (Steps, Catálogo, Sirene, Crédito interno, etc.) ficam só para `admin`.
 */
export const TEAM_ALLOWED_PATH_PREFIXES: readonly string[] = [
  '/rede-franqueados',
  '/comunidade',
  '/painel-novos-negocios',
  '/portfolio',
  '/funil-acoplamento',
  '/operacoes',
  '/funil-stepone',
  '/dashboard-novos-negocios',
  '/perfil',
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
  '/portal-frank',
  '/painel-novos-negocios',
  '/portfolio',
  '/operacoes',
  '/funil-acoplamento',
  '/funil-stepone',
  '/dashboard-novos-negocios',
  '/perfil',
] as const;

/** Detalhe de uma linha da rede (`/rede-franqueados/:id`): a página restringe à própria franquia. */
export function isFrankRedeFranqueadoDetalhePath(pathname: string): boolean {
  return /^\/rede-franqueados\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\/|$|\?)/i.test(
    pathname,
  );
}

export function isFrankAllowedPath(pathname: string): boolean {
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
  '/painel-credito',
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
  return ADMIN_ONLY_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Considera legados: consultor/supervisor contam como admin. */
export function roleMayAccessPath(pathname: string, role: string | null | undefined): boolean {
  const r: AccessRole = normalizeAccessRole(role);
  if (r === 'admin') return true;
  if (r === 'team') return isTeamAllowedPath(pathname);
  if (r === 'frank') return isFrankAllowedPath(pathname);
  return false;
}
