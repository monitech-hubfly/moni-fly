'use server';

import { revalidatePath } from 'next/cache';
import { condominioFormDraftToPatch, type CondominioFormDraft } from '@/lib/condominios-form';
import {
  prazosAprovacaoPatchFromDraft,
  type CondominioPrazosAprovacaoDraft,
} from '@/lib/kanban/condominio-prazos-aprovacao';
import {
  condominioNomeJaExiste,
  fetchCondominiosRows,
  parseIntegerInput,
  type CondominioRow,
} from '@/lib/condominios';
import { parseTicketMedioFaixaParaCadastro } from '@/lib/kanban/ticket-medio-faixa';
import { normalizeAccessRole } from '@/lib/authz';
import { propagarCamposKanbanCards, propagarCamposProcesso } from '@/lib/kanban/card-sync-group';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type KanbanCondominioActionResult = { ok: true } | { ok: false; error: string };

export async function listarCondominiosCadastro(): Promise<CondominioRow[]> {
  const supabase = await createClient();
  const rows = await fetchCondominiosRows(supabase);
  return rows ?? [];
}

async function requireCondominiosStaff(): Promise<
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
    return { ok: false, error: 'Apenas administradores ou time podem atualizar o cadastro de condomínios.' };
  }
  return { ok: true, supabase, userId: user.id };
}

/** Cria ou atualiza condomínio no cadastro a partir de uma linha da Tabela de Condomínios. */
export async function sincronizarProspectComCadastro(input: {
  condominioId?: string | null;
  nome: string;
  ticket_lote: string;
  ticket_casas: string;
  ticket_m2: string;
  estimativa_giro?: string;
  descricao_breve?: string;
  /** true = dados iguais ao cadastro (concordância); false = persistir alterações. */
  apenasConfirmar?: boolean;
  cidade?: string | null;
  estado?: string | null;
}): Promise<KanbanCondominioActionResult & { condominioId?: string }> {
  const gate = await requireCondominiosStaff();
  if (!gate.ok) return gate;

  const nome = String(input.nome ?? '').trim();
  if (!nome) return { ok: false, error: 'Informe o nome do condomínio.' };

  const patch = {
    nome,
    descricao_breve: String(input.descricao_breve ?? '').trim() || null,
    ticket_medio_lote: parseTicketMedioFaixaParaCadastro(input.ticket_lote),
    ticket_medio_casas: parseTicketMedioFaixaParaCadastro(input.ticket_casas),
    ticket_medio_casas_rsm2: parseTicketMedioFaixaParaCadastro(input.ticket_m2),
    estimativa_casas_vendidas_ano: parseIntegerInput(input.estimativa_giro ?? ''),
  };
  const cidadePraca = String(input.cidade ?? '').trim() || null;
  const estadoPraca = String(input.estado ?? '').trim().toUpperCase() || null;
  const localizacaoPatch =
    cidadePraca && estadoPraca && estadoPraca.length === 2
      ? { cidade: cidadePraca, estado: estadoPraca }
      : {};

  const condominioId = String(input.condominioId ?? '').trim();

  if (condominioId) {
    const { data: existente, error: errExist } = await gate.supabase
      .from('condominios')
      .select('id, nome')
      .eq('id', condominioId)
      .maybeSingle();
    if (errExist || !existente) return { ok: false, error: 'Condomínio não encontrado no cadastro.' };

    if (input.apenasConfirmar) {
      return { ok: true, condominioId };
    }

    if (patch.nome && (await condominioNomeJaExiste(gate.supabase, patch.nome, condominioId))) {
      return { ok: false, error: 'Já existe outro condomínio cadastrado com este nome.' };
    }

    const { error } = await gate.supabase
      .from('condominios')
      .update({
        nome: patch.nome,
        descricao_breve: patch.descricao_breve,
        ticket_medio_lote: patch.ticket_medio_lote,
        ticket_medio_casas: patch.ticket_medio_casas,
        ticket_medio_casas_rsm2: patch.ticket_medio_casas_rsm2,
        estimativa_casas_vendidas_ano: patch.estimativa_casas_vendidas_ano,
        ...localizacaoPatch,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', condominioId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/rede-franqueados');
    return { ok: true, condominioId };
  }

  if (await condominioNomeJaExiste(gate.supabase, nome)) {
    return { ok: false, error: 'Condomínio já existe — selecione-o na lista em vez de cadastrar de novo.' };
  }

  const { data: ins, error: insErr } = await gate.supabase
    .from('condominios')
    .insert({
      nome: patch.nome,
      descricao_breve: patch.descricao_breve,
      ticket_medio_lote: patch.ticket_medio_lote,
      ticket_medio_casas: patch.ticket_medio_casas,
      ticket_medio_casas_rsm2: patch.ticket_medio_casas_rsm2,
      estimativa_casas_vendidas_ano: patch.estimativa_casas_vendidas_ano,
      ...localizacaoPatch,
      criado_por: gate.userId,
      updated_at: new Date().toISOString(),
    } as never)
    .select('id')
    .single();

  if (insErr) {
    const msg = insErr.message.toLowerCase();
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return { ok: false, error: 'Já existe um condomínio cadastrado com este nome.' };
    }
    return { ok: false, error: insErr.message };
  }

  const novoId = String((ins as { id?: string } | null)?.id ?? '').trim();
  if (!novoId) return { ok: false, error: 'Condomínio criado sem ID.' };
  revalidatePath('/rede-franqueados');
  return { ok: true, condominioId: novoId };
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
    extrato_como_eram_casas: patch.extrato_como_eram_casas ?? null,
    extrato_tempo_venda: patch.extrato_tempo_venda ?? null,
    prazo_aprovacao_condominio_dias: patch.prazo_aprovacao_condominio_dias ?? null,
    prazo_aprovacao_condominio_sla_tipo: patch.prazo_aprovacao_condominio_sla_tipo ?? null,
    prazo_aprovacao_prefeitura_dias: patch.prazo_aprovacao_prefeitura_dias ?? null,
    prazo_aprovacao_prefeitura_sla_tipo: patch.prazo_aprovacao_prefeitura_sla_tipo ?? null,
    descricao_breve: patch.descricao_breve ?? null,
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

export async function salvarPrazosAprovacaoCondominio(input: {
  condominioId: string;
  draft: CondominioPrazosAprovacaoDraft;
  basePath?: string;
}): Promise<KanbanCondominioActionResult> {
  const gate = await requireCondominiosStaff();
  if (!gate.ok) return gate;

  const condominioId = String(input.condominioId ?? '').trim();
  if (!condominioId) return { ok: false, error: 'Condomínio inválido.' };

  const patch = prazosAprovacaoPatchFromDraft(input.draft);
  const { error } = await gate.supabase
    .from('condominios')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', condominioId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/rede-franqueados');
  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}
