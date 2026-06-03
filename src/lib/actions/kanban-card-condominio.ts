'use server';

import { revalidatePath } from 'next/cache';
import { condominioFormDraftToPatch, type CondominioFormDraft } from '@/lib/condominios-form';
import { condominioNomeJaExiste, fetchCondominiosRows, type CondominioRow } from '@/lib/condominios';
import { propagarCamposKanbanCards, propagarCamposProcesso } from '@/lib/kanban/card-sync-group';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type KanbanCondominioActionResult = { ok: true } | { ok: false; error: string };

export async function listarCondominiosCadastro(): Promise<CondominioRow[]> {
  const supabase = await createClient();
  const rows = await fetchCondominiosRows(supabase);
  return rows ?? [];
}

async function nomeCondominioJaExiste(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nome: string,
  ignorarId?: string,
): Promise<boolean> {
  return condominioNomeJaExiste(supabase, nome, ignorarId);
}

export async function vincularCondominioAoCard(input: {
  cardId: string;
  origem: 'nativo' | 'legado';
  condominioId: string;
  quadra?: string | null;
  lote?: string | null;
  basePath?: string;
}): Promise<KanbanCondominioActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cardId = String(input.cardId ?? '').trim();
  const condominioId = String(input.condominioId ?? '').trim();
  if (!cardId || !condominioId) return { ok: false, error: 'Card e condomínio são obrigatórios.' };

  const { data: cond, error: condErr } = await supabase
    .from('condominios')
    .select('id, nome')
    .eq('id', condominioId)
    .maybeSingle();
  if (condErr || !cond) return { ok: false, error: 'Condomínio não encontrado no cadastro.' };

  const nome = String((cond as { nome?: string }).nome ?? '').trim();
  const quadra = input.quadra?.trim() || null;
  const lote = input.lote?.trim() || null;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  if (input.origem === 'nativo') {
    const sync = await propagarCamposKanbanCards(admin, cardId, {
      condominio_id: condominioId,
      nome_condominio: nome,
      quadra,
      lote,
    });
    if (!sync.ok) return { ok: false, error: sync.error };
  } else {
    const sync = await propagarCamposProcesso(admin, cardId, cardId, {
      condominio_id: condominioId,
      nome_condominio: nome,
      quadra,
      lote,
    });
    if (!sync.ok) return { ok: false, error: sync.error };
  }

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}

export async function cadastrarCondominioEVincularCard(input: {
  cardId: string;
  origem: 'nativo' | 'legado';
  draft: CondominioFormDraft;
  quadra?: string | null;
  lote?: string | null;
  basePath?: string;
}): Promise<KanbanCondominioActionResult & { condominioId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const nome = String(input.draft.nome ?? '').trim();
  if (!nome) return { ok: false, error: 'Informe o nome do condomínio.' };

  if (await nomeCondominioJaExiste(supabase, nome)) {
    return { ok: false, error: 'Já existe um condomínio cadastrado com este nome.' };
  }

  const patch = condominioFormDraftToPatch(input.draft);
  const row = {
    nome: patch.nome,
    endereco: patch.endereco ?? null,
    numero: patch.numero ?? null,
    cep: patch.cep ?? null,
    cidade: patch.cidade ?? null,
    estado: patch.estado ?? null,
    ticket_medio_lote: patch.ticket_medio_lote ?? null,
    ticket_medio_casas: patch.ticket_medio_casas ?? null,
    ticket_medio_casas_rsm2: patch.ticket_medio_casas_rsm2 ?? null,
    estimativa_casas_vendidas_ano: patch.estimativa_casas_vendidas_ano ?? null,
    criado_por: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data: ins, error: insErr } = await supabase
    .from('condominios')
    .insert(row as never)
    .select('id')
    .single();

  if (insErr) {
    const msg = insErr.message.toLowerCase();
    if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('idx_condominios_nome')) {
      return { ok: false, error: 'Já existe um condomínio cadastrado com este nome.' };
    }
    return { ok: false, error: insErr.message };
  }

  const condominioId = String((ins as { id?: string } | null)?.id ?? '').trim();
  if (!condominioId) return { ok: false, error: 'Condomínio criado sem ID.' };

  const vinc = await vincularCondominioAoCard({
    cardId: input.cardId,
    origem: input.origem,
    condominioId,
    quadra: input.quadra,
    lote: input.lote,
    basePath: input.basePath,
  });
  if (!vinc.ok) return vinc;
  return { ok: true, condominioId };
}

export async function salvarQuadraLoteCard(input: {
  cardId: string;
  origem: 'nativo' | 'legado';
  quadra?: string | null;
  lote?: string | null;
  nomeCondominio?: string | null;
  basePath?: string;
}): Promise<KanbanCondominioActionResult> {
  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const quadra = input.quadra?.trim() || null;
  const lote = input.lote?.trim() || null;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  if (input.origem === 'nativo') {
    const patch: { quadra: string | null; lote: string | null; nome_condominio?: string } = { quadra, lote };
    const nome = input.nomeCondominio?.trim();
    if (nome) patch.nome_condominio = nome;
    const sync = await propagarCamposKanbanCards(admin, cardId, patch);
    if (!sync.ok) return { ok: false, error: sync.error };
  } else {
    const sync = await propagarCamposProcesso(admin, cardId, cardId, { quadra, lote });
    if (!sync.ok) return { ok: false, error: sync.error };
  }

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}
