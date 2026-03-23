import { normalizeAccessRole, type AccessRole } from '@/lib/authz';

/**
 * Rotas permitidas ao papel `team` (matriz: Rede, Comunidade, Novos Negócios + dashboard/tarefas, Perfil).
 * Demais seções (Steps, Catálogo, Sirene, Crédito interno, etc.) ficam só para `admin`.
 */
export const TEAM_ALLOWED_PATH_PREFIXES: readonly string[] = [
  '/rede-franqueados',
  '/comunidade',
  '/painel-novos-negocios',
  '/dashboard-novos-negocios',
  '/perfil',
] as const;

export function isTeamAllowedPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return TEAM_ALLOWED_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Matriz de rotas exclusivas de administrador.
 * O papel `team` (e legado `frank`) não acessa — nem por URL direta (middleware).
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
  return false;
}
