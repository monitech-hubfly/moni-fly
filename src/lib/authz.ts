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

