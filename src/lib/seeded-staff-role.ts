import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAccessRole, type AccessRole } from '@/lib/authz';
import { seedEntryForEmail, seededRoleNeedsRepair } from '@/lib/team-seed-signup';

/** Papel efetivo: seed de e-mail da equipe prevalece sobre pending/frank/vazio no DEV. */
export function effectiveAccessRoleFromEmail(
  profileRole: string | null | undefined,
  email: string | null | undefined,
): AccessRole {
  const seeded = seedEntryForEmail(email);
  if (seeded && seededRoleNeedsRepair(profileRole, seeded.role)) return seeded.role;
  return normalizeAccessRole(profileRole);
}

export type BoardStaffAuth = {
  role: string;
  isAdmin: boolean;
  veTodosCards: boolean;
};

/**
 * Se o e-mail está no seed da equipe e o perfil no banco ainda é frank/pending/vazio,
 * grava o papel correto (admin/team) para o restante do Hub (kanban, simulador, sidebar).
 */
export async function persistSeededStaffRoleIfNeeded(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
  currentRole: string | null | undefined,
): Promise<AccessRole> {
  const seeded = seedEntryForEmail(user.email);
  const effective = effectiveAccessRoleFromEmail(currentRole, user.email);
  if (!seeded || !seededRoleNeedsRepair(currentRole, seeded.role)) return effective;

  const payload: Record<string, unknown> = {
    role: seeded.role,
    email: user.email ?? undefined,
    aprovado_em: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (seeded.departamento) payload.departamento = seeded.departamento;
  if (seeded.role === 'team') payload.cargo = seeded.cargo ?? 'analista';

  const { error } = await supabase.from('profiles').update(payload).eq('id', user.id).select('id');
  if (error) {
    console.error('[seeded-staff-role] falha ao gravar papel da equipe:', error.message);
  }
  const { error: rpcErr } = await supabase.rpc('seed_users');
  if (rpcErr) {
    console.error('[seeded-staff-role] seed_users:', rpcErr.message);
  }
  return effective;
}

/** Persiste o seed e devolve o papel para o board (precisa rodar ANTES do SELECT dos cards). */
export async function resolveBoardStaffAuth(
  supabase: SupabaseClient,
  userId: string | null,
): Promise<BoardStaffAuth> {
  if (!userId) return { role: 'frank', isAdmin: true, veTodosCards: true };

  const [{ data: profile }, { data: authData }] = await Promise.all([
    supabase.from('profiles').select('role, email').eq('id', userId).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const email = authData.user?.email ?? (profile as { email?: string | null } | null)?.email ?? null;
  const access = await persistSeededStaffRoleIfNeeded(
    supabase,
    { id: userId, email },
    (profile as { role?: string } | null)?.role,
  );
  const isAdmin = access === 'admin' || access === 'team';
  const roleRaw = String((profile as { role?: string } | null)?.role ?? '').trim();
  return {
    role: isAdmin ? access : roleRaw || access,
    isAdmin,
    veTodosCards: isAdmin || roleRaw === 'consultor' || roleRaw === 'supervisor',
  };
}
