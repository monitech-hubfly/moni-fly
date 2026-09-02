/**
 * Sincroniza campos de SPE do checklist de fases → `franqueado_spe` na Rede.
 * Chamado quando itens de checklist de abertura SPE são preenchidos no card.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FranqueadoSpeUpsertDados } from '@/lib/franqueado-spe';

const LABEL_RAZAO = /raz[aã]o\s*social/i;
const LABEL_CNPJ = /^cnpj/i;
const LABEL_INSC_MUN = /inscri[cç][aã]o\s*municipal/i;
const LABEL_INSC_EST = /inscri[cç][aã]o\s*estadual/i;
const LABEL_CONTA = /conta\s*banc[aá]ria/i;

export type ChecklistItemValor = { label: string; valor: string };

function extrairDadosSpeDeChecklist(itens: ChecklistItemValor[]): FranqueadoSpeUpsertDados {
  const dados: FranqueadoSpeUpsertDados = {};
  for (const { label, valor } of itens) {
    const v = valor.trim();
    if (!v) continue;
    const l = label.trim();
    if (LABEL_RAZAO.test(l)) dados.razao_social = v;
    else if (LABEL_CNPJ.test(l)) dados.cnpj = v;
    else if (LABEL_INSC_MUN.test(l)) dados.inscricao_municipal = v;
    else if (LABEL_INSC_EST.test(l)) dados.inscricao_estadual = v;
    else if (LABEL_CONTA.test(l)) dados.conta_banco = v;
  }
  return dados;
}

export function checklistTemDadosSpe(itens: ChecklistItemValor[]): boolean {
  const d = extrairDadosSpeDeChecklist(itens);
  return Boolean(
    d.razao_social || d.cnpj || d.inscricao_municipal || d.inscricao_estadual || d.conta_banco,
  );
}

/** Upsert SPE vinculada ao card a partir de respostas de checklist (idempotente). */
export async function syncSpeRedeFromChecklist(
  supabase: SupabaseClient,
  input: {
    cardId: string;
    redeFranqueadoId: string;
    nomeProjeto?: string | null;
    itens: ChecklistItemValor[];
  },
): Promise<{ ok: true; speId: string } | { ok: false; error: string }> {
  const dados = extrairDadosSpeDeChecklist(input.itens);
  if (!checklistTemDadosSpe(input.itens)) {
    return { ok: false, error: 'Nenhum campo SPE reconhecido no checklist.' };
  }

  const cardId = input.cardId.trim();
  const redeId = input.redeFranqueadoId.trim();
  if (!cardId || !redeId) return { ok: false, error: 'Card ou franqueado inválido.' };

  const { data: existente } = await supabase
    .from('franqueado_spe')
    .select('id')
    .eq('kanban_card_id', cardId)
    .maybeSingle();

  const now = new Date().toISOString();
  const patch = {
    ...dados,
    nome_projeto: input.nomeProjeto?.trim() || undefined,
    updated_at: now,
  };

  if (existente) {
    const speId = String((existente as { id: string }).id);
    const { error } = await supabase
      .from('franqueado_spe')
      .update({ ...patch, kanban_card_id: cardId } as never)
      .eq('id', speId);
    if (error) return { ok: false, error: error.message };
    await supabase.from('kanban_cards').update({ franqueado_spe_id: speId } as never).eq('id', cardId);
    return { ok: true, speId };
  }

  const { data: criada, error: insErr } = await supabase
    .from('franqueado_spe')
    .insert({
      status: 'em_abertura',
      rede_franqueado_id: redeId,
      kanban_card_id: cardId,
      ...patch,
    } as never)
    .select('id')
    .single();
  if (insErr || !criada) return { ok: false, error: insErr?.message ?? 'Falha ao criar SPE.' };

  const speId = String((criada as { id: string }).id);
  await supabase
    .from('kanban_cards')
    .update({ franqueado_spe_id: speId, rede_franqueado_id: redeId } as never)
    .eq('id', cardId);

  return { ok: true, speId };
}
