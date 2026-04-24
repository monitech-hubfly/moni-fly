'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export type FaseChecklistItem = {
  id: string;
  fase_id: string;
  ordem: number;
  label: string;
  tipo:
    | 'texto_curto'
    | 'texto_longo'
    | 'email'
    | 'telefone'
    | 'numero'
    | 'anexo'
    | 'anexo_template'
    | 'checkbox'
    | 'data'
    | 'hora';
  obrigatorio: boolean;
  visivel_candidato: boolean;
  template_storage_path: string | null;
  placeholder: string | null;
};

export type CandidatoActionResult = { ok: true } | { ok: false; error: string };

export async function buscarFormTokenInfo(token: string): Promise<
  | { ok: true; card_id: string; fase_id: string; expires_at: string; usado_em: string | null }
  | { ok: false; error: string }
> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Serviço indisponível.' };
  }

  const { data, error } = await admin
    .from('kanban_card_form_tokens')
    .select('card_id, fase_id, expires_at, usado_em')
    .eq('token', token)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Link inválido.' };

  const row = data as { card_id: string; fase_id: string; expires_at: string; usado_em: string | null };
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: 'Este link expirou.' };

  return { ok: true, card_id: row.card_id, fase_id: row.fase_id, expires_at: row.expires_at, usado_em: row.usado_em };
}

export async function salvarRespostaCandidato(
  token: string,
  item_id: string,
  valor: string,
  arquivo_path?: string | null,
): Promise<CandidatoActionResult> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Serviço indisponível.' };
  }

  const { data: tok, error: tokErr } = await admin
    .from('kanban_card_form_tokens')
    .select('card_id, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (tokErr) return { ok: false, error: tokErr.message };
  if (!tok) return { ok: false, error: 'Token inválido.' };

  const tokRow = tok as { card_id: string; expires_at: string };
  if (new Date(tokRow.expires_at) < new Date()) return { ok: false, error: 'Link expirado.' };

  const { data: existente } = await admin
    .from('kanban_fase_checklist_respostas')
    .select('arquivo_path, valor')
    .eq('card_id', tokRow.card_id)
    .eq('item_id', item_id)
    .maybeSingle();
  const ex = existente as { arquivo_path?: string | null; valor?: string | null } | null;
  const nextArquivo =
    arquivo_path !== undefined ? arquivo_path : (ex?.arquivo_path != null ? String(ex.arquivo_path) : null);

  const { error } = await admin.from('kanban_fase_checklist_respostas').upsert(
    {
      item_id,
      card_id: tokRow.card_id,
      valor,
      arquivo_path: nextArquivo,
      preenchido_por: null,
      preenchido_em: new Date().toISOString(),
    },
    { onConflict: 'item_id,card_id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Itens da fase para a página pública (sem sessão); mesmas colunas que o painel interno. */
export async function listarFaseChecklistItens(faseId: string): Promise<FaseChecklistItem[]> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  const { data, error } = await admin
    .from('kanban_fase_checklist_itens')
    .select('*')
    .eq('fase_id', faseId)
    .eq('visivel_candidato', true)
    .order('ordem', { ascending: true });

  console.log('[CANDIDATO] faseId:', faseId, '| itens:', data, '| error:', error);

  return (data ?? []) as FaseChecklistItem[];
}
