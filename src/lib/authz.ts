export type AccessRole = 'admin' | 'team' | 'frank' | 'pending' | 'blocked';

export function normalizeAccessRole(role: string | null | undefined): AccessRole {
  const r = String(role ?? '')
    .trim()
    .toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'team') return 'team';
  if (r === 'pending') return 'pending';
  if (r === 'blocked') return 'blocked';
  if (r === 'frank' || r === 'franqueado') return 'frank';
  // legados
  if (r === 'consultor' || r === 'supervisor') return 'admin';
  return 'pending';
}

export function isAdminRole(role: string | null | undefined): boolean {
  return normalizeAccessRole(role) === 'admin';
}

/** Papel `admin` no banco (não inclui team, consultor legado, etc.). */
export function isStrictAdminRole(role: string | null | undefined): boolean {
  return String(role ?? '').trim().toLowerCase() === 'admin';
}

/** Equipe interna (admin ou team) — ex.: aba Rede de Loteadores. */
export function isRedeStaffRole(role: string | null | undefined): boolean {
  const access = normalizeAccessRole(role);
  return access === 'admin' || access === 'team';
}

/** Aba Condomínios em /rede-franqueados: admin, team (edição) e frank (somente leitura). */
export function canAccessCondominiosTab(role: string | null | undefined): boolean {
  return isRedeStaffRole(role) || isFrankOrFranqueadoRole(role);
}

/** Frank / legado `franqueado` — sem funis internos (Jurídico, Moní Capital, Contratações). */
export function isFrankOrFranqueadoRole(role: string | null | undefined): boolean {
  const raw = String(role ?? '').trim().toLowerCase();
  if (raw === 'franqueado') return true;
  return normalizeAccessRole(role) === 'frank';
}

/** Funis Jurídico e Moní Capital: qualquer papel exceto frank/franqueado. */
export function canAccessFunisInternosNegocio(role: string | null | undefined): boolean {
  return !isFrankOrFranqueadoRole(role);
}

/** Funil Contratações (`/funil-contratacoes`): admin ou time com `profiles.cargo = adm`. */
export function canAccessFunilContratacoes(
  role: string | null | undefined,
  cargo: string | null | undefined,
): boolean {
  if (normalizeAccessRole(role) === 'admin') return true;
  return String(cargo ?? '').trim().toLowerCase() === 'adm';
}

export const FUNIL_CONTRATACOES_PATH = '/funil-contratacoes' as const;

