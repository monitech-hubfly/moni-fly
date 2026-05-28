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

