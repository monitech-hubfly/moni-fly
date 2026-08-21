'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeAccessRole } from '@/lib/authz';

const MAPEAMENTO_PATH = '/admin/pastelaria/mapeamento';

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (normalizeAccessRole((profile as { role?: string } | null)?.role) !== 'admin') {
    return { ok: false as const, error: 'Apenas admin.' };
  }
  return { ok: true as const };
}

export async function vincularAreaPessoa(areaPessoaId: string, userId: string) {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;

  if (!areaPessoaId?.trim() || !userId?.trim()) {
    return { ok: false as const, error: 'Pessoa e usuário são obrigatórios.' };
  }

  const admin = createAdminClient();

  const { error: clearError } = await admin
    .from('area_pessoas_users')
    .delete()
    .or(`area_pessoa_id.eq.${areaPessoaId},user_id.eq.${userId}`);

  if (clearError) return { ok: false as const, error: clearError.message };

  const { error } = await admin.from('area_pessoas_users').upsert(
    { area_pessoa_id: areaPessoaId, user_id: userId },
    { onConflict: 'area_pessoa_id' },
  );

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(MAPEAMENTO_PATH);
  return { ok: true as const };
}

export async function desvincularAreaPessoa(areaPessoaId: string) {
  const guard = await assertAdmin();
  if (!guard.ok) return guard;

  if (!areaPessoaId?.trim()) {
    return { ok: false as const, error: 'Pessoa inválida.' };
  }

  const admin = createAdminClient();
  const { error } = await admin.from('area_pessoas_users').delete().eq('area_pessoa_id', areaPessoaId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath(MAPEAMENTO_PATH);
  return { ok: true as const };
}

export async function vincularAreaPessoaFormAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const areaPessoaId = String(formData.get('areaPessoaId') ?? '');
  const userId = String(formData.get('userId') ?? '');
  const result = await vincularAreaPessoa(areaPessoaId, userId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

export async function desvincularAreaPessoaFormAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const areaPessoaId = String(formData.get('areaPessoaId') ?? '');
  const result = await desvincularAreaPessoa(areaPessoaId);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}
