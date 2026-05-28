import { redirect } from 'next/navigation';
import { guardLoginRequired } from '@/lib/auth-guard';
import {
  canAccessFunilContratacoes,
  canAccessFunisInternosNegocio,
} from '@/lib/authz';
import { createClient } from '@/lib/supabase/server';

async function loadProfileRoleCargo(userId: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, cargo')
    .eq('id', userId)
    .maybeSingle();
  return profile as { role?: string | null; cargo?: string | null } | null;
}

/** Bloqueia frank/franqueado nos funis internos de negócio (Jurídico, Capital, HDM). */
export async function requireFunisInternosNegocioAccess(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const profile = await loadProfileRoleCargo(user.id);
  if (!canAccessFunisInternosNegocio(profile?.role)) {
    redirect('/dashboard');
  }
}

/** Bloqueia quem não é admin nem `cargo = adm` em `/funil-contratacoes`. */
export async function requireFunilContratacoesAccess(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const profile = await loadProfileRoleCargo(user.id);
  if (!canAccessFunilContratacoes(profile?.role, profile?.cargo)) {
    redirect('/dashboard');
  }
}
