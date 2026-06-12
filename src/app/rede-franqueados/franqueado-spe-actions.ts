'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import type { FranqueadoSpeStatus, FranqueadoSpeUpsertDados } from '@/lib/franqueado-spe';
import {
  FRANQUEADO_SPE_DOC_SLOTS,
  isFranqueadoSpeAnexoDocTipo,
  slotSpePorTipo,
} from '@/lib/rede-documentos-spe';

type Ok = { ok: true; mensagem: string; speId?: string };
type Err = { ok: false; error: string };

const MAX_DOC_BYTES = 10 * 1024 * 1024;
const STATUS_VALUES: FranqueadoSpeStatus[] = ['ativa', 'inativa', 'em_abertura'];

async function requireSpeStaff(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const access = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (access !== 'admin' && access !== 'team') {
    return { ok: false, error: 'Apenas administradores ou time podem gerenciar SPE.' };
  }
  return { ok: true, supabase, userId: user.id };
}

function cleanSpeDados(dados: FranqueadoSpeUpsertDados): Record<string, unknown> {
  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const set = (k: keyof FranqueadoSpeUpsertDados, v: string | null | undefined) => {
    if (v === undefined) return;
    out[k] = v === '' ? null : v;
  };
  set('nome_projeto', dados.nome_projeto);
  set('razao_social', dados.razao_social);
  set('cnpj', dados.cnpj);
  set('inscricao_municipal', dados.inscricao_municipal);
  set('inscricao_estadual', dados.inscricao_estadual);
  if (dados.status !== undefined) {
    if (!STATUS_VALUES.includes(dados.status)) throw new Error('Status inválido.');
    out.status = dados.status;
  }
  set('conta_banco', dados.conta_banco);
  set('conta_agencia', dados.conta_agencia);
  set('conta_numero', dados.conta_numero);
  set('conta_tipo', dados.conta_tipo);
  if (dados.kanban_card_id !== undefined) {
    out.kanban_card_id = dados.kanban_card_id === '' ? null : dados.kanban_card_id;
  }
  return out;
}

function revalidateSpePaths(redeId: string) {
  revalidatePath('/rede-franqueados');
  revalidatePath(`/rede-franqueados/${redeId}`);
}

/** Cria SPE vazia para o franqueado (um projeto). */
export async function criarFranqueadoSpe(
  redeFranqueadoId: string,
  nomeProjeto?: string | null,
): Promise<Ok | Err> {
  const gate = await requireSpeStaff();
  if (!gate.ok) return gate;
  const redeId = redeFranqueadoId.trim();
  if (!redeId) return { ok: false, error: 'Franqueado inválido.' };

  const { data, error } = await gate.supabase
    .from('franqueado_spe')
    .insert({
      rede_franqueado_id: redeId,
      nome_projeto: nomeProjeto?.trim() || null,
      status: 'em_abertura',
    } as never)
    .select('id')
    .single();

  if (error) {
    return {
      ok: false,
      error: /franqueado_spe|schema cache|relation/i.test(error.message ?? '')
        ? 'Tabela franqueado_spe ainda não existe. Execute a migration 320 no Supabase.'
        : error.message,
    };
  }

  revalidateSpePaths(redeId);
  return { ok: true, mensagem: 'SPE criada.', speId: String((data as { id: string }).id) };
}

/** Atualiza cadastro da SPE. */
export async function upsertFranqueadoSpe(
  speId: string,
  dados: FranqueadoSpeUpsertDados,
): Promise<Ok | Err> {
  const gate = await requireSpeStaff();
  if (!gate.ok) return gate;
  const id = speId.trim();
  if (!id) return { ok: false, error: 'SPE inválida.' };

  let patch: Record<string, unknown>;
  try {
    patch = cleanSpeDados(dados);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Dados inválidos.' };
  }

  const { data: atual, error: leErr } = await gate.supabase
    .from('franqueado_spe')
    .select('rede_franqueado_id')
    .eq('id', id)
    .maybeSingle();
  if (leErr || !atual) return { ok: false, error: 'SPE não encontrada.' };

  const { error } = await gate.supabase.from('franqueado_spe').update(patch as never).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidateSpePaths(String((atual as { rede_franqueado_id: string }).rede_franqueado_id));
  return { ok: true, mensagem: 'SPE salva.', speId: id };
}

/** Vincula SPE a um card pelo ID — preenche Dados das Empresas do card. */
export async function vincularSpeACard(speId: string, kanbanCardId: string): Promise<Ok | Err> {
  const gate = await requireSpeStaff();
  if (!gate.ok) return gate;
  const spe = speId.trim();
  const cardId = kanbanCardId.trim();
  if (!spe || !cardId) return { ok: false, error: 'SPE ou card inválido.' };

  const { data: speRow, error: speErr } = await gate.supabase
    .from('franqueado_spe')
    .select('id, rede_franqueado_id, kanban_card_id')
    .eq('id', spe)
    .maybeSingle();
  if (speErr || !speRow) return { ok: false, error: 'SPE não encontrada.' };

  const redeId = String((speRow as { rede_franqueado_id: string }).rede_franqueado_id);

  const { data: card, error: cardErr } = await gate.supabase
    .from('kanban_cards')
    .select('id, rede_franqueado_id')
    .eq('id', cardId)
    .maybeSingle();
  if (cardErr || !card) return { ok: false, error: 'Card não encontrado.' };

  const cardRedeId = (card as { rede_franqueado_id: string | null }).rede_franqueado_id;
  if (cardRedeId && cardRedeId !== redeId) {
    return { ok: false, error: 'O card pertence a outro franqueado.' };
  }

  const { data: ocupada } = await gate.supabase
    .from('franqueado_spe')
    .select('id')
    .eq('kanban_card_id', cardId)
    .neq('id', spe)
    .maybeSingle();
  if (ocupada) {
    return { ok: false, error: 'Este card já está vinculado a outra SPE.' };
  }

  const oldCardId = (speRow as { kanban_card_id: string | null }).kanban_card_id;

  const { error: upSpe } = await gate.supabase
    .from('franqueado_spe')
    .update({ kanban_card_id: cardId, updated_at: new Date().toISOString() } as never)
    .eq('id', spe);
  if (upSpe) return { ok: false, error: upSpe.message };

  if (oldCardId && oldCardId !== cardId) {
    await gate.supabase
      .from('kanban_cards')
      .update({ franqueado_spe_id: null } as never)
      .eq('id', oldCardId);
  }

  const { error: upCard } = await gate.supabase
    .from('kanban_cards')
    .update({ franqueado_spe_id: spe, rede_franqueado_id: redeId } as never)
    .eq('id', cardId);
  if (upCard) return { ok: false, error: upCard.message };

  revalidateSpePaths(redeId);
  return { ok: true, mensagem: 'SPE vinculada ao card.', speId: spe };
}

/** Desvincula SPE do card. */
export async function desvincularSpeDoCard(speId: string): Promise<Ok | Err> {
  const gate = await requireSpeStaff();
  if (!gate.ok) return gate;
  const id = speId.trim();
  if (!id) return { ok: false, error: 'SPE inválida.' };

  const { data: speRow } = await gate.supabase
    .from('franqueado_spe')
    .select('rede_franqueado_id, kanban_card_id')
    .eq('id', id)
    .maybeSingle();
  if (!speRow) return { ok: false, error: 'SPE não encontrada.' };

  const cardId = (speRow as { kanban_card_id: string | null }).kanban_card_id;
  await gate.supabase
    .from('franqueado_spe')
    .update({ kanban_card_id: null, updated_at: new Date().toISOString() } as never)
    .eq('id', id);
  if (cardId) {
    await gate.supabase.from('kanban_cards').update({ franqueado_spe_id: null } as never).eq('id', cardId);
  }

  revalidateSpePaths(String((speRow as { rede_franqueado_id: string }).rede_franqueado_id));
  return { ok: true, mensagem: 'Vínculo removido.', speId: id };
}

/** Salva SPE a partir do card (cria se necessário) e abastece cadastro na Rede. */
export async function salvarSpeDoCard(input: {
  cardId: string;
  redeFranqueadoId: string;
  speId?: string | null;
  dados: FranqueadoSpeUpsertDados;
}): Promise<Ok | Err> {
  const gate = await requireSpeStaff();
  if (!gate.ok) return gate;

  const cardId = input.cardId.trim();
  const redeId = input.redeFranqueadoId.trim();
  if (!cardId || !redeId) return { ok: false, error: 'Card ou franqueado inválido.' };

  let speId = input.speId?.trim() || '';

  if (!speId) {
    const criar = await criarFranqueadoSpe(redeId, input.dados.nome_projeto);
    if (!criar.ok) return criar;
    speId = criar.speId ?? '';
    if (!speId) return { ok: false, error: 'Falha ao criar SPE.' };
  }

  const salvar = await upsertFranqueadoSpe(speId, {
    ...input.dados,
    kanban_card_id: cardId,
  });
  if (!salvar.ok) return salvar;

  await gate.supabase
    .from('kanban_cards')
    .update({ franqueado_spe_id: speId, rede_franqueado_id: redeId } as never)
    .eq('id', cardId);

  return { ok: true, mensagem: 'Dados da SPE salvos e sincronizados com a Rede.', speId };
}

function sanitizeNomeArquivo(nome: string): string {
  return nome.replace(/[^\w.\-() ]+/g, '_').slice(0, 120);
}

/** Upload de documento da SPE. */
export async function uploadFranqueadoSpeDoc(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const speId = String(formData.get('speId') ?? '').trim();
  const tipoRaw = String(formData.get('tipo') ?? '').trim();
  const file = formData.get('file');
  if (!speId) return { ok: false, error: 'SPE inválida.' };
  if (!isFranqueadoSpeAnexoDocTipo(tipoRaw)) return { ok: false, error: 'Tipo inválido.' };
  if (!(file instanceof File)) return { ok: false, error: 'Arquivo inválido.' };
  if (file.size > MAX_DOC_BYTES) return { ok: false, error: 'Arquivo acima de 10 MB.' };

  const gate = await requireSpeStaff();
  if (!gate.ok) return gate;

  const slot = slotSpePorTipo(tipoRaw);
  if (!slot) return { ok: false, error: 'Tipo inválido.' };

  const { data: atual, error: leErr } = await gate.supabase
    .from('franqueado_spe')
    .select('*')
    .eq('id', speId)
    .maybeSingle();
  if (leErr || !atual) return { ok: false, error: 'SPE não encontrada.' };

  const redeId = String((atual as { rede_franqueado_id: string }).rede_franqueado_id);
  const orig = sanitizeNomeArquivo(file.name || 'arquivo');
  const storagePath = `rede/${redeId}/spe/${speId}/${tipoRaw}-${randomUUID()}-${orig}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await gate.supabase.storage.from('rede-attachments').upload(storagePath, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const oldPath = String((atual as Record<string, unknown>)[slot.pathKey] ?? '').trim() || null;
  const patch: Record<string, unknown> = {
    [slot.pathKey]: storagePath,
    updated_at: new Date().toISOString(),
  };
  if (slot.justificativaKey) patch[slot.justificativaKey] = null;

  const { error } = await gate.supabase.from('franqueado_spe').update(patch as never).eq('id', speId);
  if (error) {
    await gate.supabase.storage.from('rede-attachments').remove([storagePath]);
    return { ok: false, error: error.message };
  }
  if (oldPath) await gate.supabase.storage.from('rede-attachments').remove([oldPath]);

  revalidateSpePaths(redeId);
  return { ok: true };
}

/** Justificativa de ausência de documento SPE. */
export async function salvarJustificativaSpeDoc(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const speId = String(formData.get('speId') ?? '').trim();
  const tipoRaw = String(formData.get('tipo') ?? '').trim();
  const justificativa = String(formData.get('justificativa') ?? '').trim();
  if (!speId) return { ok: false, error: 'SPE inválida.' };
  if (!isFranqueadoSpeAnexoDocTipo(tipoRaw)) return { ok: false, error: 'Tipo inválido.' };
  const slot = slotSpePorTipo(tipoRaw);
  if (!slot?.justificativaKey) {
    return { ok: false, error: 'Este documento não aceita justificativa.' };
  }
  if (!justificativa) return { ok: false, error: 'Informe a justificativa.' };

  const gate = await requireSpeStaff();
  if (!gate.ok) return gate;

  const { data: atual } = await gate.supabase.from('franqueado_spe').select('*').eq('id', speId).maybeSingle();
  if (!atual) return { ok: false, error: 'SPE não encontrada.' };

  const pathAtual = String((atual as Record<string, unknown>)[slot.pathKey] ?? '').trim();
  if (pathAtual) {
    return { ok: false, error: 'Já existe arquivo anexado.' };
  }

  const { error } = await gate.supabase
    .from('franqueado_spe')
    .update({
      [slot.justificativaKey]: justificativa,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', speId);
  if (error) return { ok: false, error: error.message };

  revalidateSpePaths(String((atual as { rede_franqueado_id: string }).rede_franqueado_id));
  return { ok: true };
}

/** Após salvar checklist em fase de abertura SPE, sincroniza campos com `franqueado_spe`. */
export async function syncSpeFromFaseChecklistKanban(input: {
  cardId: string;
  processoId: string;
  faseSlug: string;
  itens: { label: string; valor: string }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { isFaseAberturaSpeSlug } = await import('@/lib/kanban/fase-spe-slugs');
  if (!isFaseAberturaSpeSlug(input.faseSlug)) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cardId = input.cardId.trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const admin = createAdminClient();
  const { data: card } = await admin
    .from('kanban_cards')
    .select('rede_franqueado_id, titulo, projeto_id')
    .eq('id', cardId)
    .maybeSingle();
  if (!card) return { ok: false, error: 'Card não encontrado.' };

  let redeId = (card as { rede_franqueado_id: string | null }).rede_franqueado_id?.trim() ?? '';
  if (!redeId) {
    const { data: proc } = await admin
      .from('processo_step_one')
      .select('origem_rede_franqueados_id')
      .eq('id', input.processoId.trim())
      .maybeSingle();
    redeId = String((proc as { origem_rede_franqueados_id?: string | null } | null)?.origem_rede_franqueados_id ?? '').trim();
  }
  if (!redeId) return { ok: false, error: 'Franqueado não vinculado ao card.' };

  const { syncSpeRedeFromChecklist, checklistTemDadosSpe } = await import('@/lib/kanban/spe-sync-checklist');
  if (!checklistTemDadosSpe(input.itens)) return { ok: true };

  const titulo = String((card as { titulo?: string | null }).titulo ?? '').trim();
  const sync = await syncSpeRedeFromChecklist(admin, {
    cardId,
    redeFranqueadoId: redeId,
    nomeProjeto: titulo || null,
    itens: input.itens,
  });
  if (!sync.ok) return sync;
  revalidatePath('/rede-franqueados');
  revalidatePath(`/rede-franqueados/${redeId}`);
  return { ok: true };
}

export async function excluirFranqueadoSpe(speId: string): Promise<Ok | Err> {
  const gate = await requireSpeStaff();
  if (!gate.ok) return gate;
  const id = speId.trim();
  if (!id) return { ok: false, error: 'SPE inválida.' };

  const { data: row } = await gate.supabase
    .from('franqueado_spe')
    .select('rede_franqueado_id, kanban_card_id')
    .eq('id', id)
    .maybeSingle();
  if (!row) return { ok: false, error: 'SPE não encontrada.' };

  const cardId = (row as { kanban_card_id: string | null }).kanban_card_id;
  const { error } = await gate.supabase.from('franqueado_spe').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  if (cardId) {
    await gate.supabase.from('kanban_cards').update({ franqueado_spe_id: null } as never).eq('id', cardId);
  }

  revalidateSpePaths(String((row as { rede_franqueado_id: string }).rede_franqueado_id));
  return { ok: true, mensagem: 'SPE excluída.' };
}
