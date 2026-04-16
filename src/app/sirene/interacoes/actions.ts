'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type AtualizarStatusInteracaoResult = { ok: true } | { ok: false; error: string };

/** Status persistidos em `kanban_atividades.status`. */
export type StatusInteracaoDb = 'pendente' | 'em_andamento' | 'concluida';

async function usuarioPodeEditarAtividade(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  row: {
    origem: string;
    card_id: string | null;
    responsavel_id: string | null;
    responsaveis_ids: unknown;
    criado_por: string | null;
  },
): Promise<boolean> {
  const { data: prof } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
  const role = String((prof as { role?: string } | null)?.role ?? '');
  if (role === 'admin' || role === 'consultor') return true;

  const ids = Array.isArray(row.responsaveis_ids)
    ? (row.responsaveis_ids as unknown[]).map((x) => String(x))
    : [];
  if (row.responsavel_id && String(row.responsavel_id) === userId) return true;
  if (ids.includes(userId)) return true;
  if (row.criado_por && String(row.criado_por) === userId) return true;

  const origem = String(row.origem ?? 'nativo');

  if (origem === 'sirene') {
    const { data: sp } = await admin
      .from('sirene_papeis')
      .select('papel')
      .eq('user_id', userId)
      .maybeSingle();
    const papel = String((sp as { papel?: string } | null)?.papel ?? '');
    if (papel === 'bombeiro' || papel === 'caneta_verde') return true;
  }

  if (origem === 'externo') {
    return false;
  }

  if (!row.card_id) return false;

  if (origem === 'nativo') {
    const { data: card } = await admin
      .from('kanban_cards')
      .select('franqueado_id')
      .eq('id', row.card_id)
      .maybeSingle();
    return Boolean(card && String((card as { franqueado_id?: string }).franqueado_id) === userId);
  }

  if (origem === 'legado') {
    const { data: p } = await admin
      .from('processo_step_one')
      .select('user_id')
      .eq('id', row.card_id)
      .maybeSingle();
    return Boolean(p && String((p as { user_id?: string }).user_id) === userId);
  }

  return false;
}

export async function atualizarStatusInteracaoSirene(
  atividadeId: string,
  status: StatusInteracaoDb,
): Promise<AtualizarStatusInteracaoResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const admin = createAdminClient();
  const { data: row, error: fetchErr } = await admin
    .from('kanban_atividades')
    .select('id, origem, card_id, responsavel_id, responsaveis_ids, criado_por')
    .eq('id', atividadeId)
    .maybeSingle();

  if (fetchErr || !row) return { ok: false, error: 'Chamado não encontrado.' };

  const ok = await usuarioPodeEditarAtividade(admin, user.id, {
    origem: String((row as { origem?: string }).origem ?? 'nativo'),
    card_id: (row as { card_id?: string | null }).card_id ?? null,
    responsavel_id: (row as { responsavel_id?: string | null }).responsavel_id ?? null,
    responsaveis_ids: (row as { responsaveis_ids?: unknown }).responsaveis_ids,
    criado_por: (row as { criado_por?: string | null }).criado_por ?? null,
  });
  if (!ok) return { ok: false, error: 'Sem permissão para alterar este chamado.' };

  const concluida_em = status === 'concluida' ? new Date().toISOString() : null;

  const { error } = await admin
    .from('kanban_atividades')
    .update({
      status,
      concluida_em,
      updated_at: new Date().toISOString(),
    })
    .eq('id', atividadeId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/sirene/interacoes');
  revalidatePath('/');
  return { ok: true };
}
