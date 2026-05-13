const RELEASE_SCOPE = (process.env.NEXT_PUBLIC_RELEASE_SCOPE ?? 'full').trim().toLowerCase();

export function isLiveLimitedRelease(): boolean {
  return RELEASE_SCOPE === 'limited';
}

/**
 * Itens de menu reservados a ambiente de desenvolvimento (`next dev`).
 * Em build de produção (`next build` / deploy prod) ficam ocultos na sidebar.
 * Para forçar exibição num preview (ex.: QA), defina `NEXT_PUBLIC_SHOW_DEV_NAV=1`.
 */
export function showDevOnlySidebarNav(): boolean {
  if ((process.env.NEXT_PUBLIC_SHOW_DEV_NAV ?? '').trim() === '1') return true;
  return process.env.NODE_ENV !== 'production';
}

/**
 * Rotas permitidas quando NEXT_PUBLIC_RELEASE_SCOPE=limited (middleware).
 * Deve estar alinhado com o que o menu / app realmente expõe — senão o usuário cai em /rede-franqueados.
 */
export const LIMITED_RELEASE_ALLOWED_PATHS: readonly string[] = [
  '/',
  '/aceitar-convite',
  '/esqueci-senha',
  '/redefinir-senha',
  '/auth',
  '/rede-franqueados',
  '/comunidade',
  '/repositorio',
  '/dashboard-novos-negocios',
  '/painel-novos-negocios',
  '/portfolio',
  '/funil-acoplamento',
  '/operacoes',
  '/funil-stepone',
  '/funil-moni-inc',
  '/painel-contabilidade',
  '/painel-credito',
  '/login',
  '/portal-frank',
  '/perfil',
  '/admin/usuarios',
  '/api',
  '/_next',
  '/formulario-candidato',
] as const;

/** Mesma regra do middleware: `/` só a home exata; demais por prefixo. */
export function isPathAllowedInLimitedRelease(pathname: string): boolean {
  return LIMITED_RELEASE_ALLOWED_PATHS.some((path) =>
    path === '/' ? pathname === '/' : pathname.startsWith(path),
  );
}

/** @deprecated Prefer isPathAllowedInLimitedRelease — nome mantido para compat. */
export const isAllowedInLimitedRelease = isPathAllowedInLimitedRelease;
