'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { KanbanFaseMaterial } from '@/components/kanban-shared/types';
import { KANBAN_APP_BASE_PATHS } from '@/lib/kanban/kanban-card-href';
import { parseKanbanFaseMateriais } from '@/lib/kanban/parse-kanban-fase-materiais';
import { concluirChamadoCriador, criarChamado } from '@/app/sirene/actions';
import {
  registrarPrimeiroAtendimentoSeNecessario,
  resolverSireneChamadoId,
  todosTopicosFechados,
} from '@/lib/sirene/chamado-regras';
import { notificarMencoesSirene, resolverMencoesSirene } from '@/lib/actions/sirene-mencoes';
import type { SubInteracaoTipoDb } from '@/types/kanban-subinteracao';
import { isFrankOrFranqueadoRole, normalizeAccessRole } from '@/lib/authz';
import { isKanbanIdInterno } from '@/lib/kanban/filtrar-kanbans-internos';
import { validarMotivoArquivamento } from '@/lib/kanban/motivos-arquivamento';
import type { PortfolioConfirmacaoFaseTipo } from '@/lib/kanban/portfolio-confirmacao-fase';
import type { OperacoesConfirmacaoFaseTipo } from '@/lib/kanban/operacoes-confirmacao-fase';
import { carregarPermissoesMap } from '@/lib/permissoes-load';
import { FASE_IDS, FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { montarTituloCardLoteadores, isKanbanFunilLoteadoresRef } from '@/lib/kanban/loteadores-card-titulo';
import { isHipotesesFaseSlug } from '@/lib/kanban/stepone-fase-slugs';
import { calcularDataEnvioCreditoObra } from '@/lib/pre-obra/credito-obra-envio-data';
import type { FundingTipo } from '@/lib/kanban/funding-card-fields';
import {
  deveValidarGatePortfolioStep5,
  deveValidarGateLoteadoresComite,
  deveVerificarCapital,
  gatePortfolioStep5Liberado,
  listarEsteirasParalelasPendentes,
  mensagemGateLoteadoresComite,
  mensagemGatePortfolioStep5,
  PORTFOLIO_KANBAN_NOME,
  type PortfolioParalelasFlags,
} from '@/lib/kanban/portfolio-paralelas';
import { createAdminClient } from '@/lib/supabase/admin';
import { inserirKanbanCardVinculo, garantirShadowKanbanCardLegadoPorId } from '@/lib/kanban/kanban-card-vinculos';
import {
  faseNomeExibicaoVinculoCard,
  limparTagAcoplamentoPaiDoFilhoArquivado,
} from '@/lib/kanban/acoplamento-tag-pai';
import { createClient } from '@/lib/supabase/server';
import { usuarioConcluiuCasasUniversidade012 } from '@/lib/universidade/queries';
import { podeExcluirChamadoSirene } from '@/lib/sirene-utils';
import {
  buscarMetaCardParaNotificacao,
  buscarMetaNotificacaoChamado,
  notificarAlertasKanbanAtividade,
} from '@/lib/kanban/chamados-notificacoes';
import { chamadoEditavelNaSirene } from '@/lib/kanban/sirene-chamado-permissoes';
import { normalizeTemaChamado } from '@/lib/kanban/resolve-tema-chamado';
import { criarPastelariaInboxParaChamadoSirene } from '@/lib/pastelaria/sirene-pastel-abertura';
import {
  inferirHdmResponsavelPorNomesTimes,
  MONI_TIME_FILTRO_PREFIX,
  TIMES_MONI_HDM,
} from '@/lib/times-responsaveis';
import type { HdmTime } from '@/types/sirene';
import {
  nomesTimesIncluemBombeiro,
  validarCategoriaComTimes,
  validarPrazoBombeiro,
} from '@/lib/kanban/chamados-validacao';
import type { FaseChecklistItem } from './candidato-actions';
import { fetchFaseChecklistItens } from '@/lib/kanban/fase-checklist-select';
import {
  executarBastaoDeVolta,
  executarBastoes,
  garantirBastaoPassagemWayser,
} from '@/lib/actions/kanban-bastoes';
import { sincronizarTagAcoplamentoPaiDoFilho } from '@/lib/kanban/acoplamento-tag-pai';
import { notificarUniversidadeSeAvancoStep2 } from '@/lib/universidade/kanban-notify';
import { payloadInicialNegociacaoPrazo } from '@/lib/kanban/prazo-negociacao';
import {
  contarOutrosCardsSyncGroup,
  escolherTituloExibicaoCard,
  fetchCamposKanbanCanonicos,
  montarTituloCardSync,
  propagarCamposKanbanCards,
  propagarCamposProcesso,
  reconciliarFranqueadoNoSyncGroup,
  type KanbanCardCamposSync,
} from '@/lib/kanban/card-sync-group';
import {
  updateProcessoNegocioCampos,
  type ProcessoNegocioUpdatePayload,
} from '@/lib/kanban/kanban-card-modal-detalhes';

/** Wrapper para validar gate Checklist Legal (Step 4 Portfólio) no cliente. */
export async function verificarGateChecklistLegalPortfolio(
  cardId: string,
  novaFaseId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { verificarGateChecklistLegalAcoplamento } = await import('@/lib/kanban/checklist-legal-gate');
  return verificarGateChecklistLegalAcoplamento(cardId, novaFaseId);
}

/** Wrapper para evitar import estático de módulo server-only no bundle do cliente. */
export async function verificarGateAcoplamentoModelagemCasa(
  cardId: string,
  novaFaseId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { verificarGateAcoplamentoModelagemCasa: verify } = await import(
    '@/lib/kanban/links-bca-acoplamento-sync'
  );
  return verify(cardId, novaFaseId);
}

export type { FaseChecklistItem } from './candidato-actions';

/**
 * `data_vencimento` / `data_fim` vindos de `<input type="date">`: grava só `YYYY-MM-DD`,
 * sem `new Date()` / `toISOString()` (evita perder um dia em timezones atrás do UTC).
 */
function dataCampoCalendarioIso(input: string | null | undefined): string | null {
  const t = String(input ?? '').trim();
  if (!t) return null;
  const head = t.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

export type CriarInteracaoInput = {
  card_id: string;
  titulo: string;
  tipo: 'atividade' | 'duvida' | 'proposicoes' | 'chamado_padrao' | 'chamado_hdm';
  times_ids: string[];
  data_vencimento: string | null;
  /** Legado: um responsável; preferir `responsaveis_ids`. */
  responsavel_id?: string | null;
  /** Novos campos (migration 117). */
  responsaveis_ids?: string[];
  /** Nome em texto quando não há perfil (catálogo Moní). */
  responsavel_nome_texto?: string | null;
  /** Coluna `time` (texto) quando não há UUID em `kanban_times`. */
  time_legado?: string | null;
  trava?: boolean;
  status?: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  ordem: number;
  /** Rota do kanban (ex.: `/portfolio`) para invalidar cache após mutação. */
  basePath?: string;
  /** `legado` quando `card_id` é `processo_step_one.id` (migration 116). */
  origem?: 'nativo' | 'legado';
  tema?: string | null;
};

export type EditarInteracaoInput = {
  titulo?: string;
  descricao?: string | null;
  categoria?: ChamadoCategoriaDb;
  tipo?: 'atividade' | 'duvida' | 'proposicoes';
  data_vencimento?: string | null;
  times_ids?: string[];
  responsavel_id?: string | null;
  responsaveis_ids?: string[];
  responsavel_nome_texto?: string | null;
  time_legado?: string | null;
  trava?: boolean;
  /** Rota do kanban para `revalidatePath`. */
  basePath?: string;
};

export type { SubInteracaoTipoDb } from '@/types/kanban-subinteracao';

export async function listarTagsKanban(
  kanbanId: string,
): Promise<{ id: string; nome: string; cor: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('kanban_tags')
    .select('id, nome, cor')
    .eq('kanban_id', kanbanId)
    .order('nome');
  return (data ?? []).map((t) => ({ id: String(t.id), nome: String(t.nome), cor: String(t.cor) }));
}

export async function criarTagKanban(
  kanbanId: string,
  nome: string,
  cor: string,
  basePath?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('kanban_tags')
      .insert({ kanban_id: kanbanId, nome: nome.trim(), cor })
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message };
    revalidatePath(basePath ?? '/');
    return { ok: true, id: String((data as { id: string }).id) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function listarTagsCard(
  cardId: string,
): Promise<{ id: string; tag_id: string; nome: string; cor: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('kanban_card_tags')
    .select('id, tag_id, kanban_tags(nome, cor)')
    .eq('card_id', cardId);
  return (data ?? []).map((r) => {
    const tag = Array.isArray(r.kanban_tags) ? r.kanban_tags[0] : r.kanban_tags;
    return {
      id: String(r.id),
      tag_id: String(r.tag_id),
      nome: String((tag as { nome?: string } | null)?.nome ?? ''),
      cor: String((tag as { cor?: string } | null)?.cor ?? '#cccccc'),
    };
  });
}

export async function vincularTagCard(
  cardId: string,
  tagId: string,
  basePath?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('kanban_card_tags').insert({ card_id: cardId, tag_id: tagId });
    if (error) return { ok: false, error: error.message };
    revalidatePath(basePath ?? '/');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function desvincularTagCard(
  cardTagId: string,
  basePath?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('kanban_card_tags').delete().eq('id', cardTagId);
    if (error) return { ok: false, error: error.message };
    revalidatePath(basePath ?? '/');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export type CriarSubInteracaoInput = {
  interacao_id: string;
  /** Nome da atividade (obrigatório). */
  nome: string;
  descricao_detalhe?: string | null;
  /** Legado: alias de nome quando nome omitido. */
  descricao?: string;
  tipo?: SubInteracaoTipoDb;
  times_ids: string[];
  responsaveis_ids: string[];
  data_fim?: string | null;
  status?: SubInteracaoStatusDb;
  pastel?: boolean;
  basePath?: string;
  origem?: 'nativo' | 'legado';
  /** Quando true, rejeita se chamado não for editável na Sirene. */
  viaSirene?: boolean;
};

export type ChamadoCategoriaDb = 'chamado' | 'melhoria';

export type AtividadeInput = {
  nome: string;
  descricao_detalhe?: string | null;
  times_ids: string[];
  responsaveis_ids: string[];
  data_fim: string | null;
  status: SubInteracaoStatusDb;
  pastel?: boolean;
};

export type CriarChamadoComAtividadeInput = {
  card_id: string;
  titulo: string;
  descricao: string;
  categoria: ChamadoCategoriaDb;
  status?: 'pendente' | 'concluida' | 'cancelada';
  /** Trava no chamado (interação pai), não na atividade. */
  trava?: boolean;
  atividade: AtividadeInput;
  ordem: number;
  basePath?: string;
  origem?: 'nativo' | 'legado';
};

export type CriarChamadoSireneComAtividadeInput = {
  titulo: string;
  descricao: string;
  categoria: ChamadoCategoriaDb;
  status?: 'pendente' | 'concluida' | 'cancelada';
  /** Trava no chamado (sirene_chamados / interação pai), não na atividade. */
  trava?: boolean;
  atividade: AtividadeInput;
  /** Vínculo opcional com card nativo (kanban_cards). */
  card_id?: string | null;
  card_kanban_nome?: string | null;
  card_titulo?: string | null;
  /** Vínculo opcional com card legado (processo_step_one) — mutuamente exclusivo com card_id. */
  processo_id?: string | null;
  processo_kanban_nome?: string | null;
  processo_titulo?: string | null;
};

export type SubInteracaoStatusDb = 'nao_iniciado' | 'em_andamento' | 'concluido' | 'aprovado';

export type ActionOk = { ok: true };
export type ActionErr = { ok: false; error: string };
export type ActionResult = ActionOk | ActionErr;

async function fetchCardMetaForSireneChamado(
  admin: ReturnType<typeof createAdminClient>,
  cardId: string,
  origem: 'nativo' | 'legado',
): Promise<{ titulo: string; kanban_nome: string } | null> {
  if (origem === 'legado') {
    const { data: v, error } = await admin
      .from('v_processo_como_kanban_cards')
      .select('titulo, kanban_id')
      .eq('id', cardId)
      .maybeSingle();
    if (error || !v) return null;
    const kid = String((v as { kanban_id?: string }).kanban_id ?? '');
    const { data: kb } = await admin.from('kanbans').select('nome').eq('id', kid).maybeSingle();
    return {
      titulo: String((v as { titulo?: string | null }).titulo ?? 'Sem título'),
      kanban_nome: String((kb as { nome?: string } | null)?.nome ?? 'Funil Step One'),
    };
  }
  const { data: card, error: cErr } = await admin
    .from('kanban_cards')
    .select('titulo, kanban_id')
    .eq('id', cardId)
    .maybeSingle();
  if (cErr || !card) return null;
  const kid = String((card as { kanban_id?: string }).kanban_id ?? '');
  const { data: kb2 } = await admin.from('kanbans').select('nome').eq('id', kid).maybeSingle();
  return {
    titulo: String((card as { titulo?: string | null }).titulo ?? 'Sem título'),
    kanban_nome: String((kb2 as { nome?: string } | null)?.nome ?? '—'),
  };
}

function uniqUuids(ids: string[] | undefined | null): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of ids) {
    const u = String(x ?? '').trim();
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

type TopicoHistoricoEvento = {
  tipo: string;
  em: string;
  por?: string | null;
  de?: string[] | null;
  para?: string[] | null;
  detalhe?: string | null;
};

function appendHistoricoEvento(
  historico: unknown,
  evento: TopicoHistoricoEvento,
): TopicoHistoricoEvento[] {
  const base = Array.isArray(historico) ? (historico as TopicoHistoricoEvento[]) : [];
  return [...base, evento];
}

async function nomesTimesFromIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  timesIds: string[],
): Promise<string[]> {
  if (!timesIds.length) return [];
  const uuids: string[] = [];
  const nomes: string[] = [];
  for (const raw of timesIds) {
    const id = String(raw ?? '').trim();
    if (!id) continue;
    if (id.startsWith(MONI_TIME_FILTRO_PREFIX)) {
      const nome = id.slice(MONI_TIME_FILTRO_PREFIX.length).trim();
      if (nome) nomes.push(nome);
      continue;
    }
    uuids.push(id);
  }
  if (uuids.length) {
    const { data } = await supabase.from('kanban_times').select('id, nome').in('id', uuids);
    for (const id of uuids) {
      const row = (data ?? []).find((r) => String((r as { id?: string }).id) === id);
      const nome = String((row as { nome?: string } | undefined)?.nome ?? '').trim();
      if (nome) nomes.push(nome);
    }
  }
  return nomes;
}

async function ensureKanbanTimeIdByNome(
  admin: ReturnType<typeof createAdminClient>,
  nome: string,
): Promise<string | null> {
  const n = nome.trim();
  if (!n) return null;
  const { data: existing } = await admin.from('kanban_times').select('id').eq('nome', n).maybeSingle();
  if (existing) return String((existing as { id: string }).id);
  const { data: inserted, error } = await admin
    .from('kanban_times')
    .insert({ nome: n } as never)
    .select('id')
    .single();
  if (error || !inserted) return null;
  return String((inserted as { id: string }).id);
}

/** Converte ids sintéticos do catálogo Moní em UUIDs persistíveis em `kanban_times`. */
async function resolvePersistableTimesIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  admin: ReturnType<typeof createAdminClient>,
  rawIds: string[],
): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of uniqUuids(rawIds)) {
    if (raw.startsWith(MONI_TIME_FILTRO_PREFIX)) {
      const nome = raw.slice(MONI_TIME_FILTRO_PREFIX.length).trim();
      if (!nome) continue;
      const id = await ensureKanbanTimeIdByNome(admin, nome);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      continue;
    }
    const { data } = await supabase.from('kanban_times').select('id').eq('id', raw).maybeSingle();
    if (!data || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

async function todosResponsaveisDoChamado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  interacaoId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('sirene_topicos')
    .select('responsaveis_ids')
    .eq('interacao_id', interacaoId);
  const set = new Set<string>();
  for (const row of data ?? []) {
    for (const id of (row as { responsaveis_ids?: string[] }).responsaveis_ids ?? []) {
      const u = String(id ?? '').trim();
      if (u) set.add(u);
    }
  }
  return [...set];
}

async function assertEditableFromSirene(
  supabase: Awaited<ReturnType<typeof createClient>>,
  interacaoId: string,
  viaSirene?: boolean,
): Promise<ActionErr | null> {
  if (!viaSirene) return null;
  const { data } = await supabase
    .from('kanban_atividades')
    .select('origem, card_id')
    .eq('id', interacaoId)
    .maybeSingle();
  if (!data) return { ok: false, error: 'Chamado não encontrado.' };
  if (
    !chamadoEditavelNaSirene({
      origem: String((data as { origem?: string }).origem ?? ''),
      card_id: (data as { card_id?: string | null }).card_id ?? null,
    })
  ) {
    return { ok: false, error: 'Este chamado só pode ser alterado no card vinculado.' };
  }
  return null;
}

async function notificarEventoChamado(
  interacaoId: string,
  opts: {
    userIds: string[];
    tipo: 'kanban_atividade_criada' | 'kanban_atividade_atualizada' | 'kanban_atividade_redirecionada';
    mensagem: string;
    excluirUserId?: string | null;
    basePath?: string;
  },
): Promise<void> {
  try {
    const admin = createAdminClient();
    const meta = await buscarMetaNotificacaoChamado(admin, interacaoId);
    if (!meta) return;
    await notificarAlertasKanbanAtividade({
      userIds: opts.userIds,
      tipo: opts.tipo,
      mensagem: opts.mensagem,
      cardId: meta.cardId,
      basePath: opts.basePath?.trim() || meta.basePath,
      interacaoId: meta.cardId ? null : meta.interacaoId,
      excluirUserId: opts.excluirUserId,
    });
  } catch {
    /* noop */
  }
}

function validarAtividadeInput(
  atividade: AtividadeInput,
  categoria: ChamadoCategoriaDb,
  nomesTimes: string[],
): { ok: true } | { ok: false; error: string } {
  const nome = (atividade.nome ?? '').trim();
  if (!nome) return { ok: false, error: 'Informe o nome da atividade.' };
  const prazo = dataCampoCalendarioIso(atividade.data_fim);
  if (!prazo) return { ok: false, error: 'Informe o prazo limite da atividade.' };
  const timesIds = uniqUuids(atividade.times_ids);
  if (timesIds.length === 0) return { ok: false, error: 'Selecione ao menos um time.' };
  const respIds = uniqUuids(atividade.responsaveis_ids);
  if (respIds.length === 0) return { ok: false, error: 'Selecione ao menos um responsável.' };
  const catVal = validarCategoriaComTimes(categoria, nomesTimes);
  if (!catVal.ok) return catVal;
  if (nomesTimesIncluemBombeiro(nomesTimes)) {
    const prazoVal = validarPrazoBombeiro(prazo);
    if (!prazoVal.ok) return prazoVal;
    if (atividade.pastel) return { ok: false, error: 'Atividades do time Bombeiro não podem usar Pastel.' };
  }
  return { ok: true };
}

export async function criarChamadoComAtividade(input: CriarChamadoComAtividadeInput): Promise<ActionResult & { topicoId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para criar um chamado.' };

  const titulo = (input.titulo ?? '').trim();
  const descricao = (input.descricao ?? '').trim();
  if (!titulo) return { ok: false, error: 'Informe o título do chamado.' };
  if (!descricao) return { ok: false, error: 'Informe a descrição do chamado.' };

  const admin = createAdminClient();
  const timesIds = await resolvePersistableTimesIds(
    supabase,
    admin,
    uniqUuids(input.atividade.times_ids),
  );
  const respIds = uniqUuids(input.atividade.responsaveis_ids);
  const nomesTimes = await nomesTimesFromIds(supabase, timesIds);
  const val = validarAtividadeInput(
    { ...input.atividade, times_ids: timesIds, responsaveis_ids: respIds },
    input.categoria,
    nomesTimes,
  );
  if (!val.ok) return val;

  const statusChamado = input.status ?? 'pendente';

  const row = {
    card_id: input.card_id,
    titulo,
    descricao,
    categoria: input.categoria,
    tipo: 'atividade' as const,
    times_ids: [] as string[],
    responsaveis_ids: [] as string[],
    responsavel_id: null,
    trava: Boolean(input.trava),
    data_vencimento: null,
    status: statusChamado,
    prioridade: 'normal',
    ordem: input.ordem,
    criado_por: user.id,
    time: null,
    origem: input.origem === 'legado' ? 'legado' : 'nativo',
  };

  const { data: inserted, error } = await supabase
    .from('kanban_atividades')
    .insert(row as never)
    .select('id, numero')
    .single();
  if (error || !inserted) return { ok: false, error: error?.message ?? 'Erro ao criar chamado.' };

  const interacaoId = String((inserted as { id: string }).id);
  const nomeAtiv = (input.atividade.nome ?? '').trim();
  const timeLabel = nomesTimes[0] ?? '—';
  const statusAtiv = input.atividade.status ?? 'nao_iniciado';
  const pastel = nomesTimesIncluemBombeiro(nomesTimes) ? false : Boolean(input.atividade.pastel);

  const prazoInicial = dataCampoCalendarioIso(input.atividade.data_fim);
  const topicoRow = {
    chamado_id: null,
    interacao_id: interacaoId,
    ordem: 1,
    nome: nomeAtiv,
    descricao: nomeAtiv,
    descricao_detalhe: (input.atividade.descricao_detalhe ?? '').trim() || null,
    time_responsavel: timeLabel,
    responsavel_id: respIds[0] ?? null,
    responsaveis_ids: respIds,
    times_ids: timesIds,
    trava: false,
    status: statusAtiv,
    tipo: 'atividade' as const,
    pastel,
    historico: [] as TopicoHistoricoEvento[],
    ...(prazoInicial ? payloadInicialNegociacaoPrazo(prazoInicial, user.id) : { data_fim: null }),
  };

  const { data: topicoInserted, error: subErr } = await supabase.from('sirene_topicos').insert(topicoRow as never).select('id').single();
  if (subErr) {
    await supabase.from('kanban_atividades').delete().eq('id', interacaoId);
    return { ok: false, error: subErr.message };
  }

  if (statusAtiv === 'em_andamento') {
    await supabase.from('kanban_atividades').update({ status: 'em_andamento' }).eq('id', interacaoId);
  }

  const origem = input.origem === 'legado' ? 'legado' : 'nativo';
  try {
    const meta = await buscarMetaCardParaNotificacao(admin, input.card_id, origem);
    if (meta) {
      await notificarAlertasKanbanAtividade({
        userIds: respIds,
        tipo: 'kanban_atividade_criada',
        mensagem: `Nova Atividade Criada — ${meta.titulo}`,
        cardId: input.card_id,
        basePath: input.basePath?.trim() || meta.basePath,
        excluirUserId: user.id,
      });
    }
  } catch {
    /* notificação não bloqueia */
  }

  revalidatePath(input.basePath?.trim() || '/');
  revalidatePath('/');
  const topicoId = String((topicoInserted as { id: number | string }).id);
  return { ok: true, topicoId };
}

const UUID_RE_SIRENE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function criarChamadoSireneComAtividade(
  input: CriarChamadoSireneComAtividadeInput,
): Promise<ActionResult & { interacaoId?: string; sireneChamadoId?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para criar um chamado.' };

  const titulo = (input.titulo ?? '').trim();
  const descricao = (input.descricao ?? '').trim();
  if (!titulo) return { ok: false, error: 'Informe o título do chamado.' };
  if (!descricao) return { ok: false, error: 'Informe a descrição do chamado.' };

  const admin = createAdminClient();
  const timesIds = await resolvePersistableTimesIds(
    supabase,
    admin,
    uniqUuids(input.atividade.times_ids),
  );
  const respIds = uniqUuids(input.atividade.responsaveis_ids);
  const nomesTimes = await nomesTimesFromIds(supabase, timesIds);
  const val = validarAtividadeInput(
    { ...input.atividade, times_ids: timesIds, responsaveis_ids: respIds },
    input.categoria,
    nomesTimes,
  );
  if (!val.ok) return val;

  const cardIdRaw = (input.card_id ?? '').trim();
  const cardId = cardIdRaw && UUID_RE_SIRENE.test(cardIdRaw) ? cardIdRaw : null;
  const processoIdRaw = (input.processo_id ?? '').trim();
  const processoId = processoIdRaw && UUID_RE_SIRENE.test(processoIdRaw) ? processoIdRaw : null;
  const inferredHdm = inferirHdmResponsavelPorNomesTimes(nomesTimes);
  const tipoSc: 'padrao' | 'hdm' = inferredHdm ? 'hdm' : 'padrao';
  const hdmResponsavel: HdmTime | null = inferredHdm;
  if (tipoSc === 'hdm' && hdmResponsavel && !TIMES_MONI_HDM.includes(hdmResponsavel as HdmTime)) {
    return { ok: false, error: 'Time HDM inválido.' };
  }

  const { data: perf } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  const userName = String((perf as { full_name?: string } | null)?.full_name ?? '').trim() || 'Usuário';

  const timeAberturaNome = nomesTimes[0] ?? null;

  const { data: chamadoSc, error: scErr } = await supabase
    .from('sirene_chamados')
    .insert({
      aberto_por: user.id,
      aberto_por_nome: userName,
      incendio: titulo,
      time_abertura: timeAberturaNome,
      abertura_responsavel_nome: null,
      tipo: tipoSc,
      hdm_responsavel: hdmResponsavel,
      trava: Boolean(input.trava),
      ...(cardId
        ? {
            card_id: cardId,
            card_kanban_nome: input.card_kanban_nome?.trim() || null,
            card_titulo: input.card_titulo?.trim() || null,
          }
        : {}),
      ...(processoId
        ? {
            processo_id: processoId,
            processo_kanban_nome: input.processo_kanban_nome?.trim() || null,
            processo_titulo: input.processo_titulo?.trim() || null,
          }
        : {}),
    } as never)
    .select('id, numero')
    .single();

  if (scErr || !chamadoSc) return { ok: false, error: scErr?.message ?? 'Erro ao criar chamado Sirene.' };

  const sireneChamadoId = Number((chamadoSc as { id: number }).id);
  const numeroChamado = Number((chamadoSc as { numero?: number }).numero);
  const statusChamado = input.status ?? 'pendente';
  const statusAtiv = input.atividade.status ?? 'nao_iniciado';
  const pastel = nomesTimesIncluemBombeiro(nomesTimes) ? false : Boolean(input.atividade.pastel);
  const nomeAtiv = (input.atividade.nome ?? '').trim();

  const { data: inserted, error: kaErr } = await admin
    .from('kanban_atividades')
    .insert({
      card_id: cardId,
      titulo,
      descricao,
      categoria: input.categoria,
      tipo: 'atividade',
      times_ids: [] as string[],
      responsaveis_ids: [] as string[],
      responsavel_id: null,
      trava: Boolean(input.trava),
      data_vencimento: null,
      status: statusChamado,
      prioridade: 'normal',
      criado_por: user.id,
      time: null,
      time_abertura_nome: timeAberturaNome,
      origem: 'sirene',
      sirene_chamado_id: sireneChamadoId,
      numero: Number.isFinite(numeroChamado) ? numeroChamado : undefined,
    } as never)
    .select('id, numero')
    .single();

  if (kaErr || !inserted) {
    await admin.from('sirene_chamados').delete().eq('id', sireneChamadoId);
    return { ok: false, error: kaErr?.message ?? 'Erro ao criar interação.' };
  }

  const interacaoId = String((inserted as { id: string }).id);
  const timeLabel = nomesTimes[0] ?? '—';

  const prazoInicialSirene = dataCampoCalendarioIso(input.atividade.data_fim);
  const { error: subErr } = await admin.from('sirene_topicos').insert({
    chamado_id: null,
    interacao_id: interacaoId,
    ordem: 1,
    nome: nomeAtiv,
    descricao: nomeAtiv,
    descricao_detalhe: (input.atividade.descricao_detalhe ?? '').trim() || null,
    time_responsavel: timeLabel,
    responsavel_id: respIds[0] ?? null,
    responsaveis_ids: respIds,
    times_ids: timesIds,
    trava: false,
    status: statusAtiv,
    tipo: 'atividade',
    pastel,
    historico: [],
    ...(prazoInicialSirene ? payloadInicialNegociacaoPrazo(prazoInicialSirene, user.id) : { data_fim: null }),
  } as never);

  if (subErr) {
    await admin.from('kanban_atividades').delete().eq('id', interacaoId);
    await admin.from('sirene_chamados').delete().eq('id', sireneChamadoId);
    return { ok: false, error: subErr.message };
  }

  if (statusAtiv === 'em_andamento') {
    await admin.from('kanban_atividades').update({ status: 'em_andamento' }).eq('id', interacaoId);
    await registrarPrimeiroAtendimentoSeNecessario(admin, sireneChamadoId);
  }

  if (timeAberturaNome && respIds[0]) {
    const { data: respProf } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', respIds[0]!)
      .maybeSingle();
    const respNome = String((respProf as { full_name?: string } | null)?.full_name ?? '').trim();
    if (respNome) {
      await criarPastelariaInboxParaChamadoSirene(admin, {
        chamadoId: sireneChamadoId,
        incendio: titulo,
        timeAbertura: timeAberturaNome,
        aberturaResponsavelNome: respNome,
        criadoPorUserId: user.id,
      });
    }
  }

  await notificarEventoChamado(interacaoId, {
    userIds: respIds,
    tipo: 'kanban_atividade_criada',
    mensagem: `Nova Atividade Criada — ${titulo}`,
    excluirUserId: user.id,
    basePath: cardId ? undefined : `/sirene/chamados?interacao=${encodeURIComponent(interacaoId)}`,
  });

  revalidatePath('/sirene/chamados');
  revalidatePath('/sirene');
  revalidatePath('/alertas');
  if (cardId) revalidatePath('/');

  return { ok: true, interacaoId, sireneChamadoId };
}

export async function criarInteracao(input: CriarInteracaoInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para criar um chamado.' };

  const timesIds = uniqUuids(input.times_ids);
  const respIds = uniqUuids(input.responsaveis_ids);
  const legacyResp = input.responsavel_id?.trim() || null;
  const mergedResp =
    respIds.length > 0 ? respIds : legacyResp ? [legacyResp] : [];
  const responsavelSingular = mergedResp.length > 0 ? mergedResp[0]! : null;
  const nomeTxtRaw = (input.responsavel_nome_texto ?? '').trim() || null;
  const responsavel_nome_texto = mergedResp.length > 0 ? null : nomeTxtRaw;
  const timeLegado = (input.time_legado ?? '').trim() || null;
  const timeCol = timesIds.length > 0 ? null : timeLegado;

  const titulo = (input.titulo ?? '').trim();
  if (!titulo) return { ok: false, error: 'Informe o título do chamado.' };

  if (input.tipo === 'chamado_padrao' || input.tipo === 'chamado_hdm') {
    const admin = createAdminClient();
    const meta = await fetchCardMetaForSireneChamado(admin, input.card_id, input.origem ?? 'nativo');
    if (!meta) return { ok: false, error: 'Não foi possível resolver o card para criar o chamado Sirene.' };
    const fd = new FormData();
    fd.set('incendio', titulo);
    fd.set('te_trata', 'nao');
    fd.set('tipo', input.tipo === 'chamado_hdm' ? 'hdm' : 'padrao');
    fd.set('card_id', input.card_id);
    fd.set('card_kanban_nome', meta.kanban_nome);
    fd.set('card_titulo', meta.titulo);
    if (input.data_vencimento) fd.set('data_vencimento', input.data_vencimento);
    const cr = await criarChamado(fd);
    if (!cr.ok) return { ok: false, error: cr.error };
  }

  const resolvedTipo: 'atividade' | 'duvida' | 'proposicoes' | 'chamado_padrao' | 'chamado_hdm' =
    input.tipo === 'chamado_padrao'
      ? 'chamado_padrao'
      : input.tipo === 'chamado_hdm'
        ? 'chamado_hdm'
        : input.tipo === 'duvida'
          ? 'duvida'
          : input.tipo === 'proposicoes'
            ? 'proposicoes'
            : 'atividade';

  const row = {
    card_id: input.card_id,
    titulo,
    tipo: resolvedTipo,
    times_ids: timesIds,
    data_vencimento: dataCampoCalendarioIso(input.data_vencimento),
    responsavel_id: responsavelSingular,
    responsaveis_ids: mergedResp,
    responsavel_nome_texto,
    trava: Boolean(input.trava),
    status: input.status ?? 'pendente',
    prioridade: 'normal',
    ordem: input.ordem,
    criado_por: user.id,
    time: timeCol,
    origem: input.origem === 'legado' ? 'legado' : 'nativo',
    tema: normalizeTemaChamado(input.tema),
  };

  const { error } = await supabase.from('kanban_atividades').insert(row as never);
  if (error) return { ok: false, error: error.message };

  revalidatePath(input.basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

export async function editarInteracao(id: string, dados: EditarInteracaoInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para editar.' };

  /** `data_vencimento` usa só `dataCampoCalendarioIso`; `updated_at` é timestamp de auditoria (não campo date HTML). */
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (dados.titulo !== undefined) {
    const t = String(dados.titulo ?? '').trim();
    if (!t) return { ok: false, error: 'O título do chamado não pode ficar vazio.' };
    update.titulo = t;
  }
  if (dados.descricao !== undefined) update.descricao = dados.descricao;
  if (dados.categoria !== undefined) update.categoria = dados.categoria;
  if (dados.tipo !== undefined) update.tipo = dados.tipo === 'duvida' ? 'duvida' : dados.tipo === 'proposicoes' ? 'proposicoes' : 'atividade';
  if (dados.data_vencimento !== undefined) {
    update.data_vencimento = dataCampoCalendarioIso(dados.data_vencimento);
  }
  if (dados.times_ids !== undefined) update.times_ids = uniqUuids(dados.times_ids);
  if (dados.time_legado !== undefined) {
    update.time = dados.time_legado?.trim() || null;
  }
  if (dados.trava !== undefined) update.trava = Boolean(dados.trava);

  if (dados.responsaveis_ids !== undefined) {
    const merged = uniqUuids(dados.responsaveis_ids);
    update.responsaveis_ids = merged;
    update.responsavel_id = merged.length > 0 ? merged[0]! : null;
  } else if (dados.responsavel_id !== undefined) {
    const r = dados.responsavel_id?.trim() || null;
    update.responsavel_id = r;
    update.responsaveis_ids = r ? [r] : [];
  }
  if (dados.responsavel_nome_texto !== undefined) {
    const nt = (dados.responsavel_nome_texto ?? '').trim() || null;
    update.responsavel_nome_texto = nt;
  }

  const { error } = await supabase.from('kanban_atividades').update(update as never).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(dados.basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

async function labelTimeResponsavel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  times_ids: string[],
): Promise<string> {
  if (!times_ids.length) return '—';
  const { data } = await supabase.from('kanban_times').select('nome').eq('id', times_ids[0]!).maybeSingle();
  const n = (data as { nome?: string } | null)?.nome?.trim();
  return n && n.length > 0 ? n : '—';
}

export async function criarSubInteracao(input: CriarSubInteracaoInput): Promise<ActionResult & { topicoId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para criar uma atividade.' };

  const bloqueio = await assertEditableFromSirene(supabase, input.interacao_id, input.viaSirene);
  if (bloqueio) return bloqueio;

  const nome = (input.nome ?? input.descricao ?? '').trim();
  if (!nome) return { ok: false, error: 'Informe o nome da atividade.' };

  const { data: interacaoRow } = await supabase
    .from('kanban_atividades')
    .select('titulo, card_id, categoria, origem')
    .eq('id', input.interacao_id)
    .maybeSingle();
  if (!interacaoRow) return { ok: false, error: 'Chamado não encontrado.' };

  const categoria = ((interacaoRow as { categoria?: ChamadoCategoriaDb }).categoria ?? 'chamado') as ChamadoCategoriaDb;
  const admin = createAdminClient();
  const timesIds = await resolvePersistableTimesIds(supabase, admin, uniqUuids(input.times_ids));
  const respIds = uniqUuids(input.responsaveis_ids);
  const nomesTimes = await nomesTimesFromIds(supabase, timesIds);
  const val = validarAtividadeInput(
    {
      nome,
      descricao_detalhe: input.descricao_detalhe,
      times_ids: timesIds,
      responsaveis_ids: respIds,
      data_fim: input.data_fim ?? null,
      status: input.status ?? 'nao_iniciado',
      pastel: input.pastel,
    },
    categoria,
    nomesTimes,
  );
  if (!val.ok) return val;

  const timeLabel = nomesTimes[0] ?? '—';
  const existentes = await todosResponsaveisDoChamado(supabase, input.interacao_id);
  const novosResp = respIds.filter((id) => !existentes.includes(id));

  const { data: maxRow } = await supabase
    .from('sirene_topicos')
    .select('ordem')
    .eq('interacao_id', input.interacao_id)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();
  const proxOrdem = ((maxRow as { ordem?: number } | null)?.ordem ?? 0) + 1;

  const statusAtiv = input.status ?? 'nao_iniciado';
  const pastel = nomesTimesIncluemBombeiro(nomesTimes) ? false : Boolean(input.pastel);

  const prazoNovaSub = dataCampoCalendarioIso(input.data_fim);
  const row = {
    chamado_id: null,
    interacao_id: input.interacao_id,
    ordem: proxOrdem,
    nome,
    descricao: nome,
    descricao_detalhe: (input.descricao_detalhe ?? '').trim() || null,
    time_responsavel: timeLabel,
    responsavel_id: respIds[0] ?? null,
    responsaveis_ids: respIds,
    times_ids: timesIds,
    status: statusAtiv,
    tipo: 'atividade' as const,
    pastel,
    historico: [] as TopicoHistoricoEvento[],
    ...(prazoNovaSub ? payloadInicialNegociacaoPrazo(prazoNovaSub, user.id) : { data_fim: null }),
  };

  const { data: topicoInserted, error } = await supabase.from('sirene_topicos').insert(row as never).select('id').single();
  if (error) return { ok: false, error: error.message };

  if (statusAtiv === 'em_andamento') {
    await supabase.from('kanban_atividades').update({ status: 'em_andamento' }).eq('id', input.interacao_id);
  }

  const cardId = String((interacaoRow as { card_id?: string }).card_id ?? '');
  if (novosResp.length > 0) {
    const tituloChamado = String((interacaoRow as { titulo?: string }).titulo ?? 'Chamado').trim();
    await notificarEventoChamado(input.interacao_id, {
      userIds: novosResp,
      tipo: 'kanban_atividade_criada',
      mensagem: `Nova Atividade Criada — ${tituloChamado || 'Chamado'}`,
      excluirUserId: user.id,
      basePath: input.basePath?.trim() || (cardId ? undefined : `/sirene/chamados?interacao=${encodeURIComponent(input.interacao_id)}`),
    });
  }

  revalidatePath(input.basePath?.trim() || '/');
  revalidatePath('/');
  revalidatePath('/sirene/chamados');
  const topicoId = String((topicoInserted as { id: number | string }).id);
  return { ok: true, topicoId };
}

export async function editarSubInteracao(
  topicoId: string,
  payload: {
    nome: string;
    descricao_detalhe?: string | null;
    times_ids: string[];
    responsaveis_ids: string[];
    data_fim: string | null;
    status?: SubInteracaoStatusDb;
    pastel?: boolean;
  },
  basePath?: string,
  viaSirene?: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Faça login para editar.' };

    const idNum = Number.parseInt(String(topicoId), 10);
    if (!Number.isFinite(idNum)) return { ok: false, error: 'ID inválido.' };

    const { data: antes } = await supabase
      .from('sirene_topicos')
      .select('interacao_id, responsaveis_ids, historico, times_ids, prazo_status, prazo_negociacao_expira_em')
      .eq('id', idNum)
      .maybeSingle();
    if (!antes) return { ok: false, error: 'Atividade não encontrada.' };

    const interacaoId = String((antes as { interacao_id?: string }).interacao_id ?? '');
    const bloqueio = await assertEditableFromSirene(supabase, interacaoId, viaSirene);
    if (bloqueio) return bloqueio;

    const { data: interacaoRow } = await supabase
      .from('kanban_atividades')
      .select('card_id, categoria, origem, titulo')
      .eq('id', interacaoId)
      .maybeSingle();
    if (!interacaoRow) return { ok: false, error: 'Chamado não encontrado.' };

    const nome = (payload.nome ?? '').trim();
    if (!nome) return { ok: false, error: 'Informe o nome da atividade.' };

    const admin = createAdminClient();
    const timesIds = await resolvePersistableTimesIds(supabase, admin, uniqUuids(payload.times_ids));
    const respIds = uniqUuids(payload.responsaveis_ids);
    const nomesTimes = await nomesTimesFromIds(supabase, timesIds);
    const categoria = ((interacaoRow as { categoria?: ChamadoCategoriaDb }).categoria ?? 'chamado') as ChamadoCategoriaDb;
    const val = validarAtividadeInput(
      {
        nome,
        descricao_detalhe: payload.descricao_detalhe,
        times_ids: timesIds,
        responsaveis_ids: respIds,
        data_fim: payload.data_fim,
        status: payload.status ?? 'nao_iniciado',
        pastel: payload.pastel,
      },
      categoria,
      nomesTimes,
    );
    if (!val.ok) return val;

    const respAntes = uniqUuids((antes as { responsaveis_ids?: string[] }).responsaveis_ids);
    const novos = respIds.filter((id) => !respAntes.includes(id));
    const historicoAntes = (antes as { historico?: unknown }).historico;
    let historico = historicoAntes;
    if (novos.length > 0 || respAntes.some((id) => !respIds.includes(id))) {
      historico = appendHistoricoEvento(historicoAntes, {
        tipo: 'Redirecionado',
        em: new Date().toISOString(),
        por: user.id,
        de: respAntes,
        para: respIds,
      });
    }

    const timeLabel = nomesTimes[0] ?? '—';
    const prazoStatusAntes = String((antes as { prazo_status?: string | null }).prazo_status ?? '').trim();
    const updateSub: Record<string, unknown> = {
      nome,
      descricao: nome,
      descricao_detalhe: (payload.descricao_detalhe ?? '').trim() || null,
      times_ids: timesIds,
      responsaveis_ids: respIds,
      responsavel_id: respIds[0] ?? null,
      time_responsavel: timeLabel,
      historico,
      ...(payload.status ? { status: payload.status } : {}),
    };
    if (payload.pastel !== undefined && respIds.includes(user.id)) {
      updateSub.pastel = nomesTimesIncluemBombeiro(nomesTimes) ? false : Boolean(payload.pastel);
    }
    if (!prazoStatusAntes) {
      updateSub.data_fim = dataCampoCalendarioIso(payload.data_fim);
    }
    const { error } = await supabase
      .from('sirene_topicos')
      .update(updateSub as never)
      .eq('id', idNum);
    if (error) return { ok: false, error: error.message };

    if (payload.status === 'em_andamento') {
      await supabase.from('kanban_atividades').update({ status: 'em_andamento' }).eq('id', interacaoId);
    }

    const cardId = String((interacaoRow as { card_id?: string }).card_id ?? '');
    const tituloChamado = String((interacaoRow as { titulo?: string }).titulo ?? 'Chamado').trim();
    const { data: perf } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const quem = String((perf as { full_name?: string } | null)?.full_name ?? '').trim() || 'Alguém';
    if (novos.length > 0) {
      await notificarEventoChamado(interacaoId, {
        userIds: novos,
        tipo: 'kanban_atividade_redirecionada',
        mensagem: `Nova Atividade Criada — ${tituloChamado || 'Chamado'}`,
        excluirUserId: user.id,
        basePath: basePath?.trim() || (cardId ? undefined : `/sirene/chamados?interacao=${encodeURIComponent(interacaoId)}`),
      });
    }
    if (novos.length === 0 && respAntes.some((id) => !respIds.includes(id))) {
      const todos = await todosResponsaveisDoChamado(supabase, interacaoId);
      await notificarEventoChamado(interacaoId, {
        userIds: todos,
        tipo: 'kanban_atividade_atualizada',
        mensagem: `${quem} redirecionou responsáveis no chamado — ${tituloChamado || 'Chamado'}`,
        excluirUserId: user.id,
        basePath: basePath?.trim() || (cardId ? undefined : `/sirene/chamados?interacao=${encodeURIComponent(interacaoId)}`),
      });
    }

    revalidatePath(basePath ?? '/');
    revalidatePath('/sirene/chamados');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function atualizarStatusSubInteracao(
  id: number | string,
  status: SubInteracaoStatusDb,
  basePath?: string,
  viaSirene?: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para atualizar.' };

  const idNum = typeof id === 'number' ? id : Number.parseInt(String(id), 10);
  if (!Number.isFinite(idNum)) return { ok: false, error: 'ID inválido.' };

  const { data: antes } = await supabase
    .from('sirene_topicos')
    .select('status, interacao_id, chamado_id, responsavel_id, responsaveis_ids')
    .eq('id', idNum)
    .maybeSingle();
  if (!antes) return { ok: false, error: 'Atividade não encontrada.' };
  const statusAntes = String((antes as { status?: string }).status ?? '');
  const interacaoId = String((antes as { interacao_id?: string }).interacao_id ?? '');
  const chamadoIdRaw = (antes as { chamado_id?: number | null }).chamado_id;

  // Allow status update if user is the responsible for this tópico
  const topicoResponsavelId = (antes as { responsavel_id?: string | null }).responsavel_id ?? null;
  const topicoResponsaveisIds = (antes as { responsaveis_ids?: string[] }).responsaveis_ids ?? [];
  const isResponsavel =
    topicoResponsavelId === user.id ||
    topicoResponsaveisIds.includes(user.id);
  if (!isResponsavel) {
    const bloqueio = await assertEditableFromSirene(supabase, interacaoId, viaSirene);
    if (bloqueio) return bloqueio;
  }

  const { error } = await supabase
    .from('sirene_topicos')
    .update({ status, updated_at: new Date().toISOString() } as never)
    .eq('id', idNum);

  if (error) return { ok: false, error: error.message };

  if (interacaoId && status === 'em_andamento') {
    const { error: errPai } = await supabase
      .from('kanban_atividades')
      .update({ status: 'em_andamento' })
      .eq('id', interacaoId);
    if (errPai) return { ok: false, error: errPai.message };
  }

  if (status === 'em_andamento' && statusAntes !== 'em_andamento') {
    const sireneCid = await resolverSireneChamadoId(supabase, {
      chamadoId: chamadoIdRaw,
      interacaoId,
    });
    if (sireneCid != null) {
      await registrarPrimeiroAtendimentoSeNecessario(supabase, sireneCid);
    }
  }

  if (interacaoId && statusAntes !== status) {
    const { data: interacaoRow } = await supabase
      .from('kanban_atividades')
      .select('card_id, origem, titulo')
      .eq('id', interacaoId)
      .maybeSingle();
    const tituloChamado = String((interacaoRow as { titulo?: string }).titulo ?? 'Chamado').trim();
    const { data: perf } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const quem = String((perf as { full_name?: string } | null)?.full_name ?? '').trim() || 'Alguém';
    const labelStatus: Record<string, string> = {
      nao_iniciado: 'Não iniciado',
      em_andamento: 'Em andamento',
      concluido: 'Concluído',
      aprovado: 'Aprovado',
    };
    const todosResp = await todosResponsaveisDoChamado(supabase, interacaoId);
    const { data: interacaoCriador } = await supabase
      .from('kanban_atividades')
      .select('criado_por')
      .eq('id', interacaoId)
      .maybeSingle();
    const criadorId = (interacaoCriador as { criado_por?: string | null } | null)?.criado_por ?? null;
    const todos = criadorId ? [...new Set([...todosResp, criadorId])] : todosResp;
    const cardId = String((interacaoRow as { card_id?: string }).card_id ?? '');
    await notificarEventoChamado(interacaoId, {
      userIds: todos,
      tipo: 'kanban_atividade_atualizada',
      mensagem: `${quem} alterou status para "${labelStatus[status] ?? status}" — ${tituloChamado || 'Chamado'}`,
      excluirUserId: user.id,
      basePath: basePath?.trim() || (cardId ? undefined : `/sirene/chamados?interacao=${encodeURIComponent(interacaoId)}`),
    });
  }

  revalidatePath(basePath?.trim() || '/');
  revalidatePath('/');
  revalidatePath('/sirene/chamados');
  return { ok: true };
}

export async function togglePastelAtividade(
  topicoId: string,
  pastel: boolean,
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const idNum = Number.parseInt(String(topicoId), 10);
  if (!Number.isFinite(idNum)) return { ok: false, error: 'ID inválido.' };

  const { data: row } = await supabase
    .from('sirene_topicos')
    .select('responsaveis_ids, times_ids')
    .eq('id', idNum)
    .maybeSingle();
  if (!row) return { ok: false, error: 'Atividade não encontrada.' };

  const respIds = uniqUuids((row as { responsaveis_ids?: string[] }).responsaveis_ids);
  if (!respIds.includes(user.id)) {
    return { ok: false, error: 'Somente o responsável da atividade pode alterar Pastel.' };
  }

  const nomesTimes = await nomesTimesFromIds(supabase, uniqUuids((row as { times_ids?: string[] }).times_ids));
  if (nomesTimesIncluemBombeiro(nomesTimes)) {
    return { ok: false, error: 'Atividades do time Bombeiro não podem usar Pastel.' };
  }

  const { error } = await supabase.from('sirene_topicos').update({ pastel: Boolean(pastel) } as never).eq('id', idNum);
  if (error) return { ok: false, error: error.message };

  revalidatePath(basePath?.trim() || '/');
  return { ok: true };
}

export async function atualizarStatusInteracao(
  id: string,
  status: 'pendente' | 'em_andamento' | 'concluida',
  basePath?: string,
  opts?: { infoConclusaoCriador?: string; resolucaoSuficiente?: boolean },
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para atualizar.' };

  if (status === 'em_andamento') {
    return { ok: false, error: 'O status em andamento é definido automaticamente pelas atividades.' };
  }

  if (status === 'concluida') {
    const texto = opts?.infoConclusaoCriador?.trim();
    if (!texto) {
      return { ok: false, error: 'Informe as informações da conclusão do chamado.' };
    }

    const { data: interacao } = await supabase
      .from('kanban_atividades')
      .select('criado_por, sirene_chamado_id')
      .eq('id', id)
      .maybeSingle();
    const criador = String((interacao as { criado_por?: string } | null)?.criado_por ?? '');
    if (criador && criador !== user.id) {
      return { ok: false, error: 'Somente quem abriu o chamado pode marcá-lo como concluído.' };
    }

    const { data: subs } = await supabase
      .from('sirene_topicos')
      .select('status')
      .eq('interacao_id', id)
      .eq('arquivado', false);
    if (!todosTopicosFechados(subs ?? [])) {
      return { ok: false, error: 'Conclua todas as atividades antes de fechar o chamado.' };
    }

    const sireneCid = (interacao as { sirene_chamado_id?: number | null } | null)?.sirene_chamado_id;
    const suficiente = opts?.resolucaoSuficiente !== false;

    if (sireneCid != null && Number.isFinite(Number(sireneCid))) {
      const r = await concluirChamadoCriador(Number(sireneCid), suficiente, texto);
      if (!r.ok) return r;
      revalidatePath(basePath?.trim() || '/');
      revalidatePath('/sirene/chamados');
      return { ok: true };
    }

    const now = new Date().toISOString();
    if (suficiente) {
      const { error } = await supabase
        .from('kanban_atividades')
        .update({
          status: 'concluida',
          concluida_em: now,
          info_conclusao_criador: texto,
          updated_at: now,
        })
        .eq('id', id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await supabase
        .from('kanban_atividades')
        .update({
          status: 'em_andamento',
          concluida_em: null,
          info_conclusao_criador: null,
          updated_at: now,
        })
        .eq('id', id);
      if (error) return { ok: false, error: error.message };
    }
    revalidatePath(basePath?.trim() || '/');
    revalidatePath('/sirene/chamados');
    return { ok: true };
  }

  const { error } = await supabase.from('kanban_atividades').update({ status }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(basePath?.trim() || '/');
  revalidatePath('/sirene/chamados');
  return { ok: true };
}

export type ArquivarCardInput = {
  cardId: string;
  motivo: string;
  basePath?: string;
  /** `legado` quando `cardId` é `processo_step_one.id` (view `v_processo_como_kanban_cards`). */
  origem?: 'nativo' | 'legado';
};

export async function finalizarCard(input: {
  cardId: string;
  basePath?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para finalizar o card.' };

  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const { data: row, error: fetchErr } = await supabase
    .from('kanban_cards')
    .select('id, kanban_id, fase_id, concluido, arquivado')
    .eq('id', cardId)
    .maybeSingle();

  if (fetchErr || !row) return { ok: false, error: fetchErr?.message ?? 'Card não encontrado.' };

  const r = row as { kanban_id: string; fase_id: string; concluido?: boolean | null; arquivado?: boolean | null };
  if (Boolean(r.concluido)) return { ok: false, error: 'Este card já está concluído.' };
  if (Boolean(r.arquivado)) return { ok: false, error: 'Não é possível finalizar um card arquivado.' };

  const kid = String(r.kanban_id ?? '').trim();
  const fid = String(r.fase_id ?? '').trim();
  if (!kid || !fid) return { ok: false, error: 'Dados do card incompletos.' };

  const { data: ultimaFase, error: faseErr } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', kid)
    .eq('ativo', true)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (faseErr || !ultimaFase) return { ok: false, error: faseErr?.message ?? 'Não foi possível obter a última fase do kanban.' };

  const ultimaId = String((ultimaFase as { id: string }).id);
  if (fid !== ultimaId) {
    return { ok: false, error: 'O card precisa estar na última fase do funil para ser finalizado.' };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('kanban_cards')
    .update({
      concluido: true,
      concluido_em: now,
      concluido_por: user.id,
    } as never)
    .eq('id', cardId);

  if (error) return { ok: false, error: error.message };

  const bp = input.basePath?.trim() || '/';
  revalidatePath(bp);
  revalidatePath('/');
  return { ok: true };
}

export async function arquivarCard(input: ArquivarCardInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para arquivar o card.' };

  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const motivoRaw = String(input.motivo ?? '').trim();
  const motivoVal = validarMotivoArquivamento(motivoRaw);
  if (!motivoVal.ok) return { ok: false, error: motivoVal.error };
  const motivo = motivoVal.motivo;

  const [perm, { data: meProf }] = await Promise.all([
    carregarPermissoesMap(supabase, user.id),
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ]);
  const roleNorm = String((meProf as { role?: string | null } | null)?.role ?? '').toLowerCase();
  const papelPrivilegiadoKanban =
    roleNorm === 'admin' ||
    roleNorm === 'team' ||
    roleNorm === 'supervisor' ||
    roleNorm === 'consultor';
  if (!papelPrivilegiadoKanban && !perm.get('arquivar_cards')) {
    return { ok: false, error: 'Sem permissão para arquivar cards.' };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const origem = input.origem ?? 'nativo';

  const patchArquivar = {
    arquivado: true,
    arquivado_em: now,
    arquivado_por: user.id,
    motivo_arquivamento: motivo,
  } as const;

  if (origem === 'legado') {
    const { data: vLeg, error: vErr } = await admin
      .from('v_processo_como_kanban_cards')
      .select('id, kanban_id, fase_id, titulo, responsavel_id')
      .eq('id', cardId)
      .maybeSingle();

    if (vErr) return { ok: false, error: vErr.message };
    if (!vLeg) return { ok: false, error: 'Card legado não encontrado na view de processos.' };

    const r = vLeg as {
      kanban_id: string | null;
      fase_id: string | null;
      titulo: string | null;
      responsavel_id: string | null;
    };
    const kid = String(r.kanban_id ?? '').trim();
    const fid = String(r.fase_id ?? '').trim();
    const franq = String(r.responsavel_id ?? '').trim();
    if (!kid || !fid || !franq) {
      return { ok: false, error: 'Dados incompletos do processo (kanban/fase/franqueado).' };
    }

    const { data: existing } = await admin.from('kanban_cards').select('id').eq('id', cardId).maybeSingle();

    if (existing) {
      const { data: upd, error: uErr } = await admin
        .from('kanban_cards')
        .update({ ...patchArquivar } as never)
        .eq('id', cardId)
        .select('id');
      if (uErr) return { ok: false, error: uErr.message };
      if (!upd?.length) return { ok: false, error: 'Não foi possível atualizar o registro de arquivamento.' };
    } else {
      const titulo = String(r.titulo ?? '').trim() || 'Sem título';
      const { error: iErr } = await admin.from('kanban_cards').insert({
        id: cardId,
        kanban_id: kid,
        fase_id: fid,
        franqueado_id: franq,
        titulo,
        status: 'ativo',
        concluido: false,
        ...patchArquivar,
      } as never);
      if (iErr) return { ok: false, error: iErr.message };
    }
  } else {
    const { data: updated, error } = await admin
      .from('kanban_cards')
      .update({ ...patchArquivar } as never)
      .eq('id', cardId)
      .select('id');

    if (error) return { ok: false, error: error.message };
    if (!updated?.length) return { ok: false, error: 'Card não encontrado em kanban_cards.' };
  }

  const { data: arquivadoRow } = await admin
    .from('kanban_cards')
    .select('kanban_id')
    .eq('id', cardId)
    .maybeSingle();
  if (String((arquivadoRow as { kanban_id?: string | null } | null)?.kanban_id ?? '') === KANBAN_IDS.ACOPLAMENTO) {
    await limparTagAcoplamentoPaiDoFilhoArquivado(cardId);
  }

  const bp = input.basePath?.trim() || '/';
  revalidatePath(bp);
  revalidatePath('/');
  return { ok: true };
}

export type DesarquivarCardInput = {
  cardId: string;
  basePath?: string;
  origem?: 'nativo' | 'legado';
};

export async function desarquivarCard(input: DesarquivarCardInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para desarquivar o card.' };

  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const [perm, { data: meProf2 }] = await Promise.all([
    carregarPermissoesMap(supabase, user.id),
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ]);
  const roleNorm2 = String((meProf2 as { role?: string | null } | null)?.role ?? '').toLowerCase();
  const papelPriv =
    roleNorm2 === 'admin' ||
    roleNorm2 === 'team' ||
    roleNorm2 === 'supervisor' ||
    roleNorm2 === 'consultor';
  if (!papelPriv && !perm.get('arquivar_cards')) {
    return { ok: false, error: 'Sem permissão para desarquivar cards.' };
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from('kanban_cards')
    .update({
      arquivado: false,
      arquivado_em: null,
      arquivado_por: null,
      motivo_arquivamento: null,
    } as never)
    .eq('id', cardId)
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!updated?.length) {
    const hint =
      input.origem === 'legado'
        ? 'Não há registro em kanban_cards para este processo (nada para desarquivar).'
        : 'Card não encontrado em kanban_cards.';
    return { ok: false, error: hint };
  }

  const bp = input.basePath?.trim() || '/';
  revalidatePath(bp);
  revalidatePath('/');
  return { ok: true };
}

export async function arquivarInteracao(
  interacaoId: string,
  motivo: string,
  basePath?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Não autenticado.' };

    const { data: ka, error: kaErr } = await supabase
      .from('kanban_atividades')
      .update({
        arquivado: true,
        arquivado_em: new Date().toISOString(),
        arquivado_por: user.id,
        motivo_arquivamento: motivo.trim(),
        status: 'concluida',
      })
      .eq('id', interacaoId)
      .select('sirene_chamado_id')
      .single();
    if (kaErr) return { ok: false, error: kaErr.message };

    const sid = (ka as { sirene_chamado_id?: number | null }).sirene_chamado_id;
    if (sid) {
      const { error: scErr } = await supabase
        .from('sirene_chamados')
        .update({
          arquivado: true,
          arquivado_em: new Date().toISOString(),
          arquivado_por: user.id,
          motivo_arquivamento_sirene: motivo.trim(),
          status: 'concluido',
        })
        .eq('id', sid);
      if (scErr) return { ok: false, error: scErr.message };
    }

    const bp = basePath?.trim() || '/';
    revalidatePath(bp);
    revalidatePath('/');
    if (sid) {
      revalidatePath('/sirene');
      revalidatePath('/sirene/chamados');
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function arquivarSubInteracao(
  topicoId: string,
  motivo: string,
  basePath?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Não autenticado.' };
    const { error } = await supabase
      .from('sirene_topicos')
      .update({
        arquivado: true,
        arquivado_em: new Date().toISOString(),
        arquivado_por: user.id,
        motivo_arquivamento: motivo.trim(),
        status: 'concluido',
      })
      .eq('id', topicoId);
    if (error) return { ok: false, error: error.message };
    const bp = basePath?.trim() || '/';
    revalidatePath(bp);
    revalidatePath('/');
    revalidatePath('/sirene');
    revalidatePath('/sirene/chamados');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function excluirSubInteracao(
  topicoId: string,
  basePath?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Não autenticado.' };

    const idNum = Number.parseInt(String(topicoId), 10);
    if (!Number.isFinite(idNum)) return { ok: false, error: 'ID inválido.' };

    const { data: topico, error: topErr } = await supabase
      .from('sirene_topicos')
      .select('id, interacao_id')
      .eq('id', idNum)
      .maybeSingle();
    if (topErr || !topico) return { ok: false, error: 'Atividade não encontrada.' };

    const interacaoId = String((topico as { interacao_id?: string }).interacao_id ?? '');
    if (!interacaoId) return { ok: false, error: 'Chamado vinculado não encontrado.' };

    const { data: interacao, error: intErr } = await supabase
      .from('kanban_atividades')
      .select('id, criado_por')
      .eq('id', interacaoId)
      .maybeSingle();
    if (intErr || !interacao) return { ok: false, error: 'Chamado não encontrado.' };

    const { data: prof } = await supabase
      .from('profiles')
      .select('role, cargo')
      .eq('id', user.id)
      .maybeSingle();
    const role = String((prof as { role?: string | null } | null)?.role ?? '').toLowerCase();
    const cargo = String((prof as { cargo?: string | null } | null)?.cargo ?? '').toLowerCase();
    const criadoPor = (interacao as { criado_por?: string | null }).criado_por ?? null;
    if (
      !podeExcluirChamadoSirene({
        role,
        cargo,
        userId: user.id,
        abertoPor: criadoPor,
      })
    ) {
      return { ok: false, error: 'Sem permissão para excluir esta atividade.' };
    }

    const { error: delErr } = await supabase.from('sirene_topicos').delete().eq('id', idNum);
    if (delErr) return { ok: false, error: delErr.message };

    const bp = basePath?.trim() || '/';
    revalidatePath(bp);
    revalidatePath('/');
    revalidatePath('/sirene');
    revalidatePath('/sirene/chamados');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export type CriarCardKanbanInput = {
  titulo: string;
  kanban_nome: string;
  fase_id: string;
  /** Ex.: `/funil-moni-inc` para `revalidatePath`. */
  basePath?: string;
  /** Funil Loteadores: nome do parceiro/loteador (1ª parte do título). */
  nomeLoteador?: string;
  nomeCondominio?: string;
  quadra?: string;
  lote?: string;
  redeFranqueadoId?: string;
  origemTipo?: 'hipotese_direta';
};

export type CriarCardFundingInput = {
  fase_id: string;
  basePath?: string;
  funding_nome: string;
  funding_tipo: FundingTipo;
  funding_localizacao: string;
  funding_descritivo?: string;
  funding_proxima_atividade?: string;
  funding_prazo_atividade?: string;
};

/** Card nativo no kanban (`franqueado_id` = utilizador autenticado). */
export async function criarCard(input: CriarCardKanbanInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para criar o card.' };

  const titulo = (input.titulo ?? '').trim();
  if (!titulo) return { ok: false, error: 'Informe o nome.' };

  const kanbanNome = (input.kanban_nome ?? '').trim();
  if (!kanbanNome) return { ok: false, error: 'Kanban inválido.' };

  const faseId = (input.fase_id ?? '').trim();
  if (!faseId) return { ok: false, error: 'Fase inválida.' };

  const { data: kb, error: kbErr } = await supabase
    .from('kanbans')
    .select('id')
    .eq('nome', kanbanNome)
    .eq('ativo', true)
    .maybeSingle();
  if (kbErr) return { ok: false, error: kbErr.message };
  const kanbanId = String((kb as { id?: string } | null)?.id ?? '').trim();
  if (!kanbanId) return { ok: false, error: 'Kanban não encontrado.' };

  const { data: faseRow, error: faseErr } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('id', faseId)
    .eq('kanban_id', kanbanId)
    .eq('ativo', true)
    .maybeSingle();
  if (faseErr) return { ok: false, error: faseErr.message };
  if (!faseRow) return { ok: false, error: 'Fase não pertence a este kanban.' };

  const nomeCondominio = (input.nomeCondominio ?? '').trim() || null;
  const quadra = (input.quadra ?? '').trim() || null;
  const lote = (input.lote ?? '').trim() || null;

  let projetoId: string | null = null;
  if (kanbanId === KANBAN_IDS.PORTFOLIO) {
    projetoId = await tentarCriarProjetoNegocioPortfolio({
      titulo,
      franqueadoUserId: user.id,
      redeFranqueadoId: (input.redeFranqueadoId ?? '').trim() || null,
      nomeCondominio,
      quadra,
      lote,
    });
  }

  let tituloFinal = titulo;
  if (isKanbanFunilLoteadoresRef(kanbanId, kanbanNome)) {
    tituloFinal =
      montarTituloCardLoteadores({
        nomeLoteador: (input.nomeLoteador ?? '').trim() || titulo,
        nomeCondominio,
        quadra,
        lote,
        tituloFallback: titulo,
      }) ?? titulo;
  }

  const insertPayload: Record<string, unknown> = {
    kanban_id: kanbanId,
    fase_id: faseId,
    franqueado_id: user.id,
    titulo: tituloFinal,
    status: 'ativo',
    nome_condominio: nomeCondominio,
    quadra,
    lote,
    ...(projetoId ? { projeto_id: projetoId } : {}),
  };
  const redeId = (input.redeFranqueadoId ?? '').trim();
  if (redeId) insertPayload.rede_franqueado_id = redeId;
  if (input.origemTipo === 'hipotese_direta') {
    insertPayload.origem_tipo = 'hipotese_direta';
  }

  const { data: cardRow, error } = await supabase.from('kanban_cards').insert(insertPayload as never).select('id').single();
  if (error) return { ok: false, error: error.message };

  const cardId = String((cardRow as { id: string }).id);
  const { aplicarResponsavelFasePadraoAoCard, aplicarResponsavelDaFasePadraoSeVazio } =
    await import('@/lib/kanban/responsavel-fase-checklist');
  await aplicarResponsavelFasePadraoAoCard(supabase, cardId, faseId, kanbanId, user.id);
  await aplicarResponsavelDaFasePadraoSeVazio(supabase, cardId, faseId, user.id);

  const bp = (input.basePath ?? '').trim() || '/';
  revalidatePath(bp);
  revalidatePath('/');
  return { ok: true };
}

export type CriarCardFunilStepOneInput = {
  faseId: string;
  redeFranqueadoId: string;
  titulo: string;
  /** Praça/cidade (formulário `/funil-stepone/novo` com área de atuação). */
  cidade?: string;
  estado?: string;
  nomeCondominio?: string;
  quadra?: string;
  lote?: string;
  origemTipo?: 'hipotese_direta';
};

export type CriarCardFunilStepOneResult =
  | { ok: true; cardId: string; processoId: string }
  | { ok: false; error: string };

const KANBAN_CARD_STAFF_ROLES = new Set(['admin', 'team', 'consultor', 'supervisor']);

function isKanbanCardStaffRole(role: string | null | undefined): boolean {
  return KANBAN_CARD_STAFF_ROLES.has(String(role ?? '').trim());
}

/** Card manual no Funil Funding — staff only (página já restringe `?novo=true`). */
export async function criarCardFunding(input: CriarCardFundingInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para criar o card.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (!isKanbanCardStaffRole((profile as { role?: string } | null)?.role)) {
    return { ok: false, error: 'Sem permissão para criar cards no Funding.' };
  }

  const titulo = String(input.funding_nome ?? '').trim();
  if (!titulo) return { ok: false, error: 'Informe o nome.' };

  const tipo = String(input.funding_tipo ?? '').trim();
  if (tipo !== 'Investidor' && tipo !== 'Broker') {
    return { ok: false, error: 'Selecione o tipo.' };
  }

  const localizacao = String(input.funding_localizacao ?? '').trim();
  if (!localizacao) return { ok: false, error: 'Informe a localização.' };

  const faseId = String(input.fase_id ?? '').trim();
  if (!faseId) return { ok: false, error: 'Fase inválida.' };

  const { data: faseRow, error: faseErr } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('id', faseId)
    .eq('kanban_id', KANBAN_IDS.FUNDING)
    .eq('ativo', true)
    .maybeSingle();
  if (faseErr) return { ok: false, error: faseErr.message };
  if (!faseRow) return { ok: false, error: 'Fase não pertence ao funil Funding.' };

  const insertPayload: Record<string, unknown> = {
    kanban_id: KANBAN_IDS.FUNDING,
    fase_id: faseId,
    franqueado_id: user.id,
    titulo,
    status: 'ativo',
    funding_tipo: tipo,
    funding_localizacao: localizacao,
    funding_descritivo: String(input.funding_descritivo ?? '').trim() || null,
    funding_proxima_atividade: String(input.funding_proxima_atividade ?? '').trim() || null,
    funding_prazo_atividade: timestampCampoCalendarioIso(input.funding_prazo_atividade),
  };

  const { data: cardRow, error } = await supabase
    .from('kanban_cards')
    .insert(insertPayload as never)
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  const cardId = String((cardRow as { id: string }).id);
  const { aplicarResponsavelFasePadraoAoCard, aplicarResponsavelDaFasePadraoSeVazio } =
    await import('@/lib/kanban/responsavel-fase-checklist');
  await aplicarResponsavelFasePadraoAoCard(supabase, cardId, faseId, KANBAN_IDS.FUNDING, user.id);
  await aplicarResponsavelDaFasePadraoSeVazio(supabase, cardId, faseId, user.id);

  const bp = String(input.basePath ?? '/funil-funding').trim() || '/funil-funding';
  revalidatePath(bp);
  revalidatePath('/');
  return { ok: true };
}

/** Card manual no Funil Step One — cria `kanban_cards` + `processo_step_one` vinculado. */
export async function criarCardFunilStepOne(
  input: CriarCardFunilStepOneInput,
): Promise<CriarCardFunilStepOneResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para criar o card.' };

  const titulo = (input.titulo ?? '').trim();
  if (!titulo) return { ok: false, error: 'Informe o título do card.' };

  const faseId = (input.faseId ?? '').trim();
  const redeFranqueadoId = (input.redeFranqueadoId ?? '').trim();
  if (!faseId || !redeFranqueadoId) {
    return { ok: false, error: 'Franqueado e fase são obrigatórios.' };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const staff = isKanbanCardStaffRole((profile as { role?: string } | null)?.role);

  const { data: kb, error: kbErr } = await supabase
    .from('kanbans')
    .select('id')
    .eq('nome', 'Funil Step One')
    .eq('ativo', true)
    .maybeSingle();
  if (kbErr) return { ok: false, error: kbErr.message };
  const kanbanId = String((kb as { id?: string } | null)?.id ?? '').trim();
  if (!kanbanId) return { ok: false, error: 'Kanban Funil Step One não encontrado.' };

  const { data: faseRow, error: faseErr } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('id', faseId)
    .eq('kanban_id', kanbanId)
    .eq('ativo', true)
    .maybeSingle();
  if (faseErr) return { ok: false, error: faseErr.message };
  if (!faseRow) return { ok: false, error: 'Fase inválida para o Funil Step One.' };

  let admin: ReturnType<typeof createAdminClient> | null = null;
  try {
    admin = createAdminClient();
  } catch {
    admin = null;
  }

  const insertPayload: Record<string, unknown> = {
    kanban_id: kanbanId,
    fase_id: faseId,
    franqueado_id: user.id,
    rede_franqueado_id: redeFranqueadoId,
    titulo,
    status: 'ativo',
    concluido: false,
    arquivado: false,
    nome_condominio: input.nomeCondominio?.trim() || null,
    quadra: input.quadra?.trim() || null,
    lote: input.lote?.trim() || null,
  };
  if (input.origemTipo === 'hipotese_direta') {
    insertPayload.origem_tipo = 'hipotese_direta';
  }

  const insertClients = staff
    ? [supabase, ...(admin ? [admin] : [])]
    : [...(admin ? [admin] : []), supabase];

  let cardId = '';
  let lastInsertError = 'Erro ao criar card.';
  for (const client of insertClients) {
    const { data: cardRow, error: errCard } = await client
      .from('kanban_cards')
      .insert(insertPayload)
      .select('id')
      .single();
    if (!errCard && cardRow?.id) {
      cardId = String((cardRow as { id: string }).id);
      break;
    }
    lastInsertError = errCard?.message ?? lastInsertError;
    if (errCard && !/permission denied|row-level security/i.test(errCard.message)) break;
  }

  if (!cardId) {
    return { ok: false, error: lastInsertError };
  }

  const writeDb = admin ?? supabase;
  const { criarEVincularProcessoStepOneAoCard } = await import('@/lib/kanban/processo-step-one-card');
  let processoRes = await criarEVincularProcessoStepOneAoCard(writeDb, {
    cardId,
    userId: user.id,
    titulo,
    cidade: input.cidade,
    estado: input.estado,
    nomeCondominio: input.nomeCondominio,
    quadra: input.quadra,
    lote: input.lote,
    redeFranqueadoId,
  });

  if (!processoRes.ok && writeDb !== supabase) {
    processoRes = await criarEVincularProcessoStepOneAoCard(supabase, {
      cardId,
      userId: user.id,
      titulo,
      cidade: input.cidade,
      estado: input.estado,
      nomeCondominio: input.nomeCondominio,
      quadra: input.quadra,
      lote: input.lote,
      redeFranqueadoId,
    });
  }

  if (!processoRes.ok) {
    return { ok: false, error: `Card criado, mas falha ao vincular processo: ${processoRes.error}` };
  }

  const { aplicarResponsavelFasePadraoAoCard, aplicarResponsavelDaFasePadraoSeVazio } =
    await import('@/lib/kanban/responsavel-fase-checklist');
  await aplicarResponsavelFasePadraoAoCard(supabase, cardId, faseId, kanbanId, user.id);
  await aplicarResponsavelDaFasePadraoSeVazio(supabase, cardId, faseId, user.id);

  revalidatePath('/funil-stepone');
  revalidatePath('/');
  return { ok: true, cardId, processoId: processoRes.processoId };
}

export type CardArquivadoListRow = {
  id: string;
  titulo: string;
  fase_nome: string | null;
  arquivado_em: string | null;
  motivo_arquivamento: string | null;
};

export type ListarArquivadosResult =
  | { ok: true; items: CardArquivadoListRow[] }
  | { ok: false; error: string };

export async function listarArquivados(kanbanId: string): Promise<ListarArquivadosResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para listar arquivados.' };

  const kid = String(kanbanId ?? '').trim();
  if (!kid) return { ok: false, error: 'Kanban inválido.' };

  const { data: rows, error } = await supabase
    .from('kanban_cards')
    .select('id, titulo, fase_id, arquivado_em, motivo_arquivamento')
    .eq('kanban_id', kid)
    .eq('arquivado', true)
    .order('arquivado_em', { ascending: false });

  if (error) return { ok: false, error: error.message };

  const list = rows ?? [];
  const faseIds = [...new Set(list.map((r) => String((r as { fase_id?: string }).fase_id ?? '')).filter(Boolean))];
  const faseNomeById = new Map<string, string>();
  if (faseIds.length > 0) {
    const { data: fases } = await supabase.from('kanban_fases').select('id, nome').in('id', faseIds);
    fases?.forEach((f) => {
      const id = String((f as { id: string }).id);
      const nome = (f as { nome?: string | null }).nome;
      faseNomeById.set(id, nome?.trim() ? String(nome) : '—');
    });
  }

  const items: CardArquivadoListRow[] = list.map((r) => {
    const row = r as {
      id: string;
      titulo: string | null;
      fase_id: string | null;
      arquivado_em: string | null;
      motivo_arquivamento: string | null;
    };
    const fid = row.fase_id ? String(row.fase_id) : '';
    return {
      id: String(row.id),
      titulo: (row.titulo ?? '').trim() || '(sem título)',
      fase_nome: fid ? (faseNomeById.get(fid) ?? '—') : '—',
      arquivado_em: row.arquivado_em,
      motivo_arquivamento: row.motivo_arquivamento,
    };
  });

  return { ok: true, items };
}

export type SalvarDadosPreObraInput = {
  processoId: string;
  /** Card que originou o save — propaga datas para o grupo de sync. */
  cardOrigemId?: string;
  previsao_aprovacao_condominio?: string | null;
  previsao_aprovacao_prefeitura?: string | null;
  previsao_emissao_alvara?: string | null;
  previsao_liberacao_credito_obra?: string | null;
  previsao_inicio_obra?: string | null;
  data_aprovacao_condominio?: string | null;
  data_aprovacao_prefeitura?: string | null;
  data_emissao_alvara?: string | null;
  data_aprovacao_credito?: string | null;
  basePath?: string;
};

export async function salvarDadosPreObra(input: SalvarDadosPreObraInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para salvar.' };

  const pid = String(input.processoId ?? '').trim();
  if (!pid) return { ok: false, error: 'Processo inválido.' };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const setText = (k: keyof SalvarDadosPreObraInput, col: string) => {
    const v = input[k];
    if (v !== undefined) update[col] = String(v ?? '').trim() || null;
  };

  setText('previsao_aprovacao_condominio', 'previsao_aprovacao_condominio');
  setText('previsao_aprovacao_prefeitura', 'previsao_aprovacao_prefeitura');
  setText('previsao_emissao_alvara', 'previsao_emissao_alvara');
  setText('previsao_liberacao_credito_obra', 'previsao_liberacao_credito_obra');
  setText('previsao_inicio_obra', 'previsao_inicio_obra');

  const setDate = (k: keyof SalvarDadosPreObraInput, col: string) => {
    const v = input[k];
    if (v !== undefined) update[col] = dataCampoCalendarioIso(String(v ?? ''));
  };
  setDate('data_aprovacao_condominio', 'data_aprovacao_condominio');
  setDate('data_aprovacao_prefeitura', 'data_aprovacao_prefeitura');
  setDate('data_emissao_alvara', 'data_emissao_alvara');
  setDate('data_aprovacao_credito', 'data_aprovacao_credito');

  if (input.previsao_aprovacao_prefeitura !== undefined) {
    update.previsao_liberacao_credito_obra =
      calcularDataEnvioCreditoObra(String(input.previsao_aprovacao_prefeitura ?? '')) ?? null;
  }

  const cardOrigem = String(input.cardOrigemId ?? pid).trim();
  try {
    const admin = createAdminClient();
    const procPatch: Record<string, string | null | undefined> = {};
    for (const [k, v] of Object.entries(update)) {
      if (k === 'updated_at') continue;
      procPatch[k] = v as string | null;
    }
    const sync = await propagarCamposProcesso(admin, cardOrigem, pid, procPatch);
    if (!sync.ok) return sync;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  revalidatePath(input.basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

/** Salva dados do negócio no processo e propaga ao grupo de sync. */
export async function salvarDadosNegocioKanban(input: {
  cardId: string;
  processoId: string;
  payload: ProcessoNegocioUpdatePayload;
  basePath?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para salvar.' };

  const pid = String(input.processoId ?? '').trim();
  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const { data: cardRow } = await supabase
    .from('kanban_cards')
    .select('processo_step_one_id, rede_franqueado_id, titulo')
    .eq('id', cardId)
    .maybeSingle();

  const card = cardRow as {
    processo_step_one_id?: string | null;
    rede_franqueado_id?: string | null;
    titulo?: string | null;
  } | null;

  const redeId = String(card?.rede_franqueado_id ?? '').trim();
  let redeProcessoId: string | null = null;
  if (redeId) {
    const { data: redeRow } = await supabase
      .from('rede_franqueados')
      .select('processo_id')
      .eq('id', redeId)
      .maybeSingle();
    redeProcessoId = String((redeRow as { processo_id?: string | null } | null)?.processo_id ?? '').trim() || null;
  }

  const { garantirProcessoNegocioDedicadoAoCard } = await import('@/lib/kanban/processo-step-one-card');
  const dedicado = await garantirProcessoNegocioDedicadoAoCard(supabase, cardId, {
    userId: user.id,
    processoIdAtual: String(card?.processo_step_one_id ?? '').trim() || pid,
    redeProcessoId,
    titulo: card?.titulo ?? undefined,
    redeFranqueadoId: redeId || null,
  });
  if (!dedicado.ok) return dedicado;

  const payloadNegocio = { ...input.payload };
  if (payloadNegocio.link_gbox !== undefined && payloadNegocio.link_mapa_competidores === undefined) {
    payloadNegocio.link_mapa_competidores = payloadNegocio.link_gbox;
  } else if (
    payloadNegocio.link_mapa_competidores !== undefined &&
    payloadNegocio.link_gbox === undefined
  ) {
    payloadNegocio.link_gbox = payloadNegocio.link_mapa_competidores;
  }

  const upd = await updateProcessoNegocioCampos(supabase, dedicado.processoId, payloadNegocio);
  if (!upd.ok) return upd;

  const linkPlanilhaMapa =
    payloadNegocio.link_gbox !== undefined
      ? payloadNegocio.link_gbox
      : payloadNegocio.link_mapa_competidores;
  if (linkPlanilhaMapa !== undefined) {
    const { sincronizarGboxPainelParaPlanilhaMapaChecklist } = await import(
      '@/lib/kanban/gbox-planilha-mapa-sync'
    );
    const sync = await sincronizarGboxPainelParaPlanilhaMapaChecklist({
      cardId,
      linkGbox: linkPlanilhaMapa ?? null,
      usuarioId: user.id,
    });
    if (!sync.ok) return sync;
  }

  revalidatePath(input.basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

export type UploadContratoFranquiaResult = ActionResult & { path?: string };

export type ProcessoNegocioAnexoCampo =
  | 'opcao_permuta'
  | 'contrato_permuta'
  | 'seguro_garantia';

const PROCESSO_NEGOCIO_ANEXO_COL: Record<ProcessoNegocioAnexoCampo, string> = {
  opcao_permuta: 'anexo_opcao_permuta_path',
  contrato_permuta: 'anexo_contrato_permuta_path',
  seguro_garantia: 'anexo_seguro_garantia_path',
};

/** Upload de anexo em `processo-docs` e grava path em `processo_step_one` (dados do negócio). */
export async function uploadProcessoNegocioAnexo(
  formData: FormData,
): Promise<UploadContratoFranquiaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para anexar.' };

  const field = String(formData.get('field') ?? '').trim() as ProcessoNegocioAnexoCampo;
  if (!PROCESSO_NEGOCIO_ANEXO_COL[field]) return { ok: false, error: 'Campo de anexo inválido.' };

  const cardOrigemId = String(formData.get('cardOrigemId') ?? formData.get('processoId') ?? '').trim();
  if (!cardOrigemId) return { ok: false, error: 'Card inválido.' };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  const { data: cardRow } = await admin
    .from('kanban_cards')
    .select('processo_step_one_id, rede_franqueado_id, titulo')
    .eq('id', cardOrigemId)
    .maybeSingle();

  const card = cardRow as {
    processo_step_one_id?: string | null;
    rede_franqueado_id?: string | null;
    titulo?: string | null;
  } | null;

  const redeId = String(card?.rede_franqueado_id ?? '').trim();
  let redeProcessoId: string | null = null;
  if (redeId) {
    const { data: redeRow } = await admin
      .from('rede_franqueados')
      .select('processo_id')
      .eq('id', redeId)
      .maybeSingle();
    redeProcessoId = String((redeRow as { processo_id?: string | null } | null)?.processo_id ?? '').trim() || null;
  }

  const processoIdForm = String(formData.get('processoId') ?? '').trim();
  const { garantirProcessoNegocioDedicadoAoCard } = await import('@/lib/kanban/processo-step-one-card');
  const dedicado = await garantirProcessoNegocioDedicadoAoCard(admin, cardOrigemId, {
    userId: user.id,
    processoIdAtual: String(card?.processo_step_one_id ?? '').trim() || processoIdForm,
    redeProcessoId,
    titulo: card?.titulo ?? undefined,
    redeFranqueadoId: redeId || null,
  });
  if (!dedicado.ok) return dedicado;

  const processoId = dedicado.processoId;

  const file = formData.get('file');
  if (!file || !(file instanceof File) || file.size === 0) return { ok: false, error: 'Selecione um arquivo.' };

  const safeName = file.name.replace(/[^\w.\-()+ ]/g, '_').slice(0, 180);
  const path = `${processoId}/dados-negocio/${field}/${Date.now()}_${safeName}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage.from('processo-docs').upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: true,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const col = PROCESSO_NEGOCIO_ANEXO_COL[field];

  try {
    const sync = await propagarCamposProcesso(admin, cardOrigemId, processoId, { [col]: path });
    if (!sync.ok) return sync;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  revalidatePath(String(formData.get('basePath') ?? '').trim() || '/');
  revalidatePath('/');
  return { ok: true, path };
}

/** Upload de contrato para `contratos-franquia` e grava `contrato_franquia_path` em `rede_franqueados`. */
export async function uploadContratoFranquia(formData: FormData): Promise<UploadContratoFranquiaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para anexar.' };

  const franqueadoId = String(formData.get('franqueadoId') ?? '').trim();
  if (!franqueadoId) return { ok: false, error: 'Franqueado inválido.' };

  const file = formData.get('file');
  if (!file || !(file instanceof File) || file.size === 0) return { ok: false, error: 'Selecione um arquivo.' };

  const safeName = file.name.replace(/[^\w.\-()+ ]/g, '_').slice(0, 180);
  const path = `${franqueadoId}/${Date.now()}_${safeName}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage.from('contratos-franquia').upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: true,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { error: dbErr } = await supabase
    .from('rede_franqueados')
    .update({ contrato_franquia_path: path } as never)
    .eq('id', franqueadoId);
  if (dbErr) return { ok: false, error: dbErr.message };

  revalidatePath(String(formData.get('basePath') ?? '').trim() || '/');
  revalidatePath('/');
  return { ok: true, path };
}

/** Atualiza texto e materiais da fase (admin/consultor). */
export async function salvarInstrucoesFase(
  faseId: string,
  instrucoes: string | null,
  materiais: KanbanFaseMaterial[],
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para salvar.' };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = String((profile as { role?: string } | null)?.role ?? '');
  if (role !== 'admin' && role !== 'consultor') {
    return { ok: false, error: 'Apenas administradores e consultores podem editar instruções da fase.' };
  }

  const fid = String(faseId ?? '').trim();
  if (!fid) return { ok: false, error: 'Fase inválida.' };

  const lista = parseKanbanFaseMateriais(materiais);
  const inst =
    instrucoes != null && String(instrucoes).trim() !== '' ? String(instrucoes).trim() : null;

  const { error } = await supabase
    .from('kanban_fases')
    .update({ instrucoes: inst, materiais: lista as unknown as never })
    .eq('id', fid);

  if (error) return { ok: false, error: error.message };

  revalidatePath(basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

export type TipoVinculoKanbanCard = 'relacionado' | 'depende_de' | 'bloqueia';

export type KanbanCardVinculoListItem = {
  id: string;
  tipo_vinculo: TipoVinculoKanbanCard;
  /** Card atual é a origem do registro (seta saindo) ou o destino (seta entrando). */
  papel: 'origem' | 'destino';
  outro_card: { id: string; titulo: string; kanban_nome: string };
};

export type TipoRelacionamentoDisplay =
  | 'originou'
  | 'relacionado'
  | 'depende_de'
  | 'bloqueia'
  | 'retornou';

export type RelacionamentoCardRow = {
  key: string;
  card_id: string;
  titulo: string;
  kanban_nome: string;
  fase_nome: string;
  tipo: TipoRelacionamentoDisplay;
  vinculo_id: string | null;
};

async function perfilEhAdminOuConsultor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
  const role = String((profile as { role?: string } | null)?.role ?? '');
  return role === 'admin' || role === 'consultor';
}

async function perfilEhAdminOuTeam(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
  const role = String((profile as { role?: string } | null)?.role ?? '').toLowerCase();
  return role === 'admin' || role === 'team';
}

function kanbanNomeDeJoin(row: { kanbans?: unknown }): string {
  const kn = row.kanbans;
  if (Array.isArray(kn)) return String((kn[0] as { nome?: string } | undefined)?.nome ?? '').trim();
  if (kn && typeof kn === 'object') return String((kn as { nome?: string }).nome ?? '').trim();
  return '';
}

/** Lista vínculos em que o card participa (origem ou destino). */
export async function listarVinculosCard(
  cardId: string,
): Promise<{ ok: true; items: KanbanCardVinculoListItem[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cid = String(cardId ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const { data: vins, error } = await supabase
    .from('kanban_card_vinculos')
    .select('id, tipo_vinculo, card_origem_id, card_destino_id')
    .or(`card_origem_id.eq.${cid},card_destino_id.eq.${cid}`);

  if (error) return { ok: false, error: error.message };
  const rows = (vins ?? []) as {
    id: string;
    tipo_vinculo: string;
    card_origem_id: string;
    card_destino_id: string;
  }[];
  if (rows.length === 0) return { ok: true, items: [] };

  const idSet = new Set<string>();
  for (const v of rows) {
    idSet.add(String(v.card_origem_id));
    idSet.add(String(v.card_destino_id));
  }
  const idList = [...idSet];

  const { data: cards, error: cErr } = await supabase
    .from('kanban_cards')
    .select('id, titulo, kanban_id, kanbans(nome)')
    .in('id', idList);
  if (cErr) return { ok: false, error: cErr.message };

  const mapInfo = new Map<string, { titulo: string; kanban_nome: string }>();
  for (const c of cards ?? []) {
    const row = c as { id: string; titulo: string | null; kanbans?: unknown };
    const nomeKanban = kanbanNomeDeJoin(row);
    mapInfo.set(String(row.id), {
      titulo: (row.titulo ?? '').trim() || '(sem título)',
      kanban_nome: nomeKanban || 'Kanban',
    });
  }

  const items: KanbanCardVinculoListItem[] = rows.map((v) => {
    const papel: 'origem' | 'destino' = v.card_origem_id === cid ? 'origem' : 'destino';
    const outroId = v.card_origem_id === cid ? v.card_destino_id : v.card_origem_id;
    const info = mapInfo.get(outroId) ?? { titulo: '—', kanban_nome: '—' };
    const tv = String(v.tipo_vinculo ?? 'relacionado');
    const tipo: TipoVinculoKanbanCard =
      tv === 'depende_de' || tv === 'bloqueia' || tv === 'relacionado' ? tv : 'relacionado';
    return {
      id: v.id,
      tipo_vinculo: tipo,
      papel,
      outro_card: { id: outroId, titulo: info.titulo, kanban_nome: info.kanban_nome },
    };
  });

  return { ok: true, items };
}

function faseNomeDeJoin(row: { kanban_fases?: unknown }): string {
  const f = row.kanban_fases;
  if (Array.isArray(f)) return String((f[0] as { nome?: string } | undefined)?.nome ?? '').trim() || '—';
  if (f && typeof f === 'object') return String((f as { nome?: string }).nome ?? '').trim() || '—';
  return '—';
}

function faseNomeExibicaoCardRow(row: {
  kanban_fases?: unknown;
  arquivado?: boolean | null;
}): string {
  return faseNomeExibicaoVinculoCard(faseNomeDeJoin(row), row.arquivado);
}

async function enriquecerMapInfoCardsLegado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mapInfo: Map<string, { titulo: string; kanban_nome: string; fase_nome: string }>,
  cardIds: string[],
): Promise<void> {
  const missing = cardIds.filter((id) => !mapInfo.has(id));
  if (missing.length === 0) return;

  const { data: legados, error } = await supabase
    .from('v_processo_como_kanban_cards')
    .select('id, titulo, kanban_fases ( nome ), kanbans ( nome )')
    .in('id', missing);

  if (error) return;

  for (const c of legados ?? []) {
    const row = c as { id: string; titulo: string | null; kanban_fases?: unknown; kanbans?: unknown };
    mapInfo.set(String(row.id), {
      titulo: (row.titulo ?? '').trim() || '(sem título)',
      kanban_nome: kanbanNomeDeJoin(row) || 'Kanban',
      fase_nome: faseNomeDeJoin(row),
    });
  }
}

type CardTituloKanbanRow = {
  id: string;
  titulo: string | null;
  origem_card_id?: string | null;
  rede_franqueado_id?: string | null;
  nome_condominio?: string | null;
  quadra?: string | null;
  lote?: string | null;
};

async function enriquecerTitulosMapInfoCards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mapInfo: Map<string, { titulo: string; kanban_nome: string; fase_nome: string }>,
  cardRows: CardTituloKanbanRow[],
): Promise<void> {
  if (cardRows.length === 0) return;

  const redeIds = [
    ...new Set(
      cardRows.map((r) => String(r.rede_franqueado_id ?? '').trim()).filter(Boolean),
    ),
  ];
  const nFranquiaPorRede = new Map<string, string>();
  const nomeFranqueadoPorRede = new Map<string, string>();
  if (redeIds.length > 0) {
    const { data: redes } = await supabase
      .from('rede_franqueados')
      .select('id, n_franquia, nome_completo')
      .in('id', redeIds);
    for (const r of redes ?? []) {
      const id = String((r as { id?: string }).id ?? '').trim();
      const num = String((r as { n_franquia?: string | null }).n_franquia ?? '').trim();
      const nome = String((r as { nome_completo?: string | null }).nome_completo ?? '').trim();
      if (id && num) nFranquiaPorRede.set(id, num);
      if (id && nome) nomeFranqueadoPorRede.set(id, nome);
    }
  }

  for (const row of cardRows) {
    const id = String(row.id);
    const info = mapInfo.get(id);
    if (!info) continue;

    const redeId = String(row.rede_franqueado_id ?? '').trim();
    const nFranquia = redeId ? nFranquiaPorRede.get(redeId) : null;
    const tituloCalc = montarTituloCardSync({
      nFranquia,
      nomeFranqueado: redeId ? nomeFranqueadoPorRede.get(redeId) : null,
      nomeCondominio: row.nome_condominio,
      quadra: row.quadra,
      lote: row.lote,
      tituloFallback: row.titulo,
    });
    info.titulo = escolherTituloExibicaoCard(info.titulo, tituloCalc, nFranquia);
  }
}

async function enriquecerTitulosMapInfoComAncestrais(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mapInfo: Map<string, { titulo: string; kanban_nome: string; fase_nome: string }>,
  cardRows: CardTituloKanbanRow[],
): Promise<void> {
  const byId = new Map(cardRows.map((r) => [String(r.id), r]));
  let frontier = cardRows
    .map((r) => String(r.origem_card_id ?? '').trim())
    .filter((id) => id && !byId.has(id));

  while (frontier.length > 0) {
    const { data: ancestrais } = await supabase
      .from('kanban_cards')
      .select(
        'id, titulo, origem_card_id, rede_franqueado_id, nome_condominio, quadra, lote',
      )
      .in('id', frontier);
    const next: string[] = [];
    for (const row of (ancestrais ?? []) as CardTituloKanbanRow[]) {
      const id = String(row.id);
      byId.set(id, row);
      const origem = String(row.origem_card_id ?? '').trim();
      if (origem && !byId.has(origem)) next.push(origem);
    }
    frontier = next;
  }

  const redeIds = [
    ...new Set(
      [...byId.values()]
        .map((r) => String(r.rede_franqueado_id ?? '').trim())
        .filter(Boolean),
    ),
  ];
  const nFranquiaPorRede = new Map<string, string>();
  const nomeFranqueadoPorRede = new Map<string, string>();
  if (redeIds.length > 0) {
    const { data: redes } = await supabase
      .from('rede_franqueados')
      .select('id, n_franquia, nome_completo')
      .in('id', redeIds);
    for (const r of redes ?? []) {
      const id = String((r as { id?: string }).id ?? '').trim();
      const num = String((r as { n_franquia?: string | null }).n_franquia ?? '').trim();
      const nome = String((r as { nome_completo?: string | null }).nome_completo ?? '').trim();
      if (id && num) nFranquiaPorRede.set(id, num);
      if (id && nome) nomeFranqueadoPorRede.set(id, nome);
    }
  }

  for (const row of cardRows) {
    const id = String(row.id);
    const info = mapInfo.get(id);
    if (!info) continue;

    let merged: CardTituloKanbanRow = { ...row };
    let cur = String(row.origem_card_id ?? '').trim();
    for (let depth = 0; depth < 32 && cur; depth++) {
      const pai = byId.get(cur);
      if (!pai) break;
      merged = {
        ...merged,
        titulo: escolherTituloExibicaoCard(merged.titulo, pai.titulo),
        rede_franqueado_id: merged.rede_franqueado_id ?? pai.rede_franqueado_id,
        nome_condominio: merged.nome_condominio ?? pai.nome_condominio,
        quadra: merged.quadra ?? pai.quadra,
        lote: merged.lote ?? pai.lote,
      };
      cur = String(pai.origem_card_id ?? '').trim();
    }

    const redeId = String(merged.rede_franqueado_id ?? '').trim();
    const nFranquia = redeId ? nFranquiaPorRede.get(redeId) : null;
    const tituloCalc = montarTituloCardSync({
      nFranquia,
      nomeFranqueado: redeId ? nomeFranqueadoPorRede.get(redeId) : null,
      nomeCondominio: merged.nome_condominio,
      quadra: merged.quadra,
      lote: merged.lote,
      tituloFallback: merged.titulo,
    });
    info.titulo = escolherTituloExibicaoCard(info.titulo, tituloCalc, nFranquia);
  }
}

function normalizarTipoRelacionamento(raw: string | null | undefined): TipoRelacionamentoDisplay {
  const t = String(raw ?? '').trim().toLowerCase();
  if (t === 'originou') return 'originou';
  if (t === 'depende_de') return 'depende_de';
  if (t === 'bloqueia') return 'bloqueia';
  if (t === 'retornou') return 'retornou';
  return 'relacionado';
}

/** Cadeia `origem_card_id` (pais e filhos) + vínculos em `kanban_card_vinculos` para a seção Vínculos. */
export async function listarRelacionamentosCard(
  cardId: string,
): Promise<{ ok: true; items: RelacionamentoCardRow[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cid = String(cardId ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const items: RelacionamentoCardRow[] = [];
  const cardIdsOrigemCadeia = new Set<string>();

  const ancestorIds: string[] = [];
  let walkId = cid;
  for (let depth = 0; depth < 32; depth++) {
    const { data: row, error: errPai } = await supabase
      .from('kanban_cards')
      .select('origem_card_id')
      .eq('id', walkId)
      .maybeSingle();
    if (errPai) return { ok: false, error: errPai.message };
    const pai = String((row as { origem_card_id?: string | null } | null)?.origem_card_id ?? '').trim();
    if (!pai || pai === walkId || ancestorIds.includes(pai)) break;
    ancestorIds.push(pai);
    walkId = pai;
  }

  const descendantIds: string[] = [];
  let frontier = [cid];
  for (let depth = 0; depth < 32 && frontier.length > 0; depth++) {
    const { data: filhosBatch, error: errFilhos } = await supabase
      .from('kanban_cards')
      .select('id')
      .in('origem_card_id', frontier)
      .order('created_at', { ascending: true });
    if (errFilhos) return { ok: false, error: errFilhos.message };
    const novos: string[] = [];
    for (const row of filhosBatch ?? []) {
      const id = String((row as { id?: string }).id ?? '').trim();
      if (!id || cardIdsOrigemCadeia.has(id)) continue;
      cardIdsOrigemCadeia.add(id);
      descendantIds.push(id);
      novos.push(id);
    }
    frontier = novos;
  }

  for (const id of ancestorIds) {
    cardIdsOrigemCadeia.add(id);
  }

  const origemIdsParaDetalhe = [...ancestorIds, ...descendantIds];
  if (origemIdsParaDetalhe.length > 0) {
    const mapOrigem = new Map<
      string,
      { titulo: string; kanban_nome: string; fase_nome: string }
    >();

    const { data: cardsOrigem, error: errCardsOrigem } = await supabase
      .from('kanban_cards')
      .select(
        'id, titulo, arquivado, origem_card_id, rede_franqueado_id, nome_condominio, quadra, lote, kanban_fases ( nome ), kanbans ( nome )',
      )
      .in('id', origemIdsParaDetalhe);
    if (errCardsOrigem) return { ok: false, error: errCardsOrigem.message };

    const rowsOrigem: CardTituloKanbanRow[] = [];
    for (const c of cardsOrigem ?? []) {
      const row = c as {
        id: string;
        titulo: string | null;
        arquivado?: boolean | null;
        origem_card_id?: string | null;
        rede_franqueado_id?: string | null;
        nome_condominio?: string | null;
        quadra?: string | null;
        lote?: string | null;
        kanban_fases?: unknown;
        kanbans?: unknown;
      };
      rowsOrigem.push(row);
      mapOrigem.set(String(row.id), {
        titulo: (row.titulo ?? '').trim() || '(sem título)',
        kanban_nome: kanbanNomeDeJoin(row) || 'Kanban',
        fase_nome: faseNomeExibicaoCardRow(row),
      });
    }

    await enriquecerMapInfoCardsLegado(supabase, mapOrigem, origemIdsParaDetalhe);
    await enriquecerTitulosMapInfoCards(supabase, mapOrigem, rowsOrigem);
    await enriquecerTitulosMapInfoComAncestrais(supabase, mapOrigem, rowsOrigem);

    for (const id of ancestorIds) {
      const info = mapOrigem.get(id) ?? { titulo: '—', kanban_nome: '—', fase_nome: '—' };
      items.push({
        key: `pai-${id}`,
        card_id: id,
        titulo: info.titulo,
        kanban_nome: info.kanban_nome,
        fase_nome: info.fase_nome,
        tipo: 'depende_de',
        vinculo_id: null,
      });
    }

    for (const id of descendantIds) {
      const info = mapOrigem.get(id) ?? { titulo: '—', kanban_nome: '—', fase_nome: '—' };
      items.push({
        key: `filho-${id}`,
        card_id: id,
        titulo: info.titulo,
        kanban_nome: info.kanban_nome,
        fase_nome: info.fase_nome,
        tipo: 'originou',
        vinculo_id: null,
      });
    }
  }

  const { data: vins, error: errVins } = await supabase
    .from('kanban_card_vinculos')
    .select('id, tipo_vinculo, card_origem_id, card_destino_id')
    .or(`card_origem_id.eq.${cid},card_destino_id.eq.${cid}`);

  if (errVins) return { ok: false, error: errVins.message };

  const vincRows = (vins ?? []) as {
    id: string;
    tipo_vinculo: string;
    card_origem_id: string;
    card_destino_id: string;
  }[];

  if (vincRows.length > 0) {
    const idSet = new Set<string>();
    for (const v of vincRows) {
      idSet.add(String(v.card_origem_id));
      idSet.add(String(v.card_destino_id));
    }
    const { data: cards, error: cErr } = await supabase
      .from('kanban_cards')
      .select(
        'id, titulo, arquivado, origem_card_id, rede_franqueado_id, nome_condominio, quadra, lote, kanban_fases ( nome ), kanbans ( nome )',
      )
      .in('id', [...idSet]);
    if (cErr) return { ok: false, error: cErr.message };

    const mapInfo = new Map<
      string,
      { titulo: string; kanban_nome: string; fase_nome: string }
    >();
    const rowsVinculo: CardTituloKanbanRow[] = [];
    for (const c of cards ?? []) {
      const row = c as {
        id: string;
        titulo: string | null;
        arquivado?: boolean | null;
        origem_card_id?: string | null;
        rede_franqueado_id?: string | null;
        nome_condominio?: string | null;
        quadra?: string | null;
        lote?: string | null;
        kanban_fases?: unknown;
        kanbans?: unknown;
      };
      rowsVinculo.push(row);
      mapInfo.set(String(row.id), {
        titulo: (row.titulo ?? '').trim() || '(sem título)',
        kanban_nome: kanbanNomeDeJoin(row) || 'Kanban',
        fase_nome: faseNomeExibicaoCardRow(row),
      });
    }

    await enriquecerMapInfoCardsLegado(supabase, mapInfo, [...idSet]);
    await enriquecerTitulosMapInfoCards(supabase, mapInfo, rowsVinculo);
    await enriquecerTitulosMapInfoComAncestrais(supabase, mapInfo, rowsVinculo);

    for (const v of vincRows) {
      const outroId = v.card_origem_id === cid ? v.card_destino_id : v.card_origem_id;
      const tipo = normalizarTipoRelacionamento(v.tipo_vinculo);
      if (outroId === cid || cardIdsOrigemCadeia.has(outroId)) continue;
      const info = mapInfo.get(outroId) ?? { titulo: '—', kanban_nome: '—', fase_nome: '—' };
      items.push({
        key: `vinculo-${v.id}`,
        card_id: outroId,
        titulo: info.titulo,
        kanban_nome: info.kanban_nome,
        fase_nome: info.fase_nome,
        tipo,
        vinculo_id: v.id,
      });
    }
  }

  return { ok: true, items };
}

/** Quantidade de outros cards no grupo de sync + campos canônicos (para UI/leitura). */
export async function obterInfoSyncGrupoCard(
  cardId: string,
): Promise<
  { ok: true; totalVinculados: number; camposCanonicos: KanbanCardCamposSync | null } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cid = String(cardId ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  try {
    const admin = createAdminClient();
    const [totalVinculados, camposCanonicos] = await Promise.all([
      contarOutrosCardsSyncGroup(admin, cid),
      fetchCamposKanbanCanonicos(admin, cid),
    ]);
    return { ok: true, totalVinculados, camposCanonicos };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function salvarFranqueadoCardVinculado(input: {
  cardId: string;
  origem: 'nativo' | 'legado';
  redeFranqueadoId: string;
  nFranquia?: string | null;
  nomeCondominio?: string | null;
  quadra?: string | null;
  lote?: string | null;
  basePath?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para salvar.' };

  const cardId = String(input.cardId ?? '').trim();
  const redeId = String(input.redeFranqueadoId ?? '').trim();
  if (!cardId || !redeId) return { ok: false, error: 'Card e franqueado são obrigatórios.' };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  if (input.origem === 'nativo') {
    const sync = await propagarCamposKanbanCards(admin, cardId, {
      rede_franqueado_id: redeId,
      nome_condominio: input.nomeCondominio?.trim() || null,
      quadra: input.quadra?.trim() || null,
      lote: input.lote?.trim() || null,
    });
    if (!sync.ok) return sync;
  } else {
    const sync = await propagarCamposProcesso(admin, cardId, cardId, {
      origem_rede_franqueados_id: redeId,
      numero_franquia: input.nFranquia?.trim() || null,
    });
    if (!sync.ok) return sync;
  }

  revalidatePath(input.basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

export type BuscaCardVinculoRow = { id: string; titulo: string; kanban_nome: string };

/** Busca cards por título (admin/consultor) para vincular. */
export async function buscarCardsParaVinculo(
  termo: string,
  excetoCardId: string,
): Promise<{ ok: true; items: BuscaCardVinculoRow[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const pode = await perfilEhAdminOuTeam(supabase, user.id);
  if (!pode) return { ok: false, error: 'Sem permissão para buscar cards.' };

  const t = String(termo ?? '').trim().replace(/%/g, '').replace(/_/g, ' ').slice(0, 120);
  if (t.length < 2) return { ok: true, items: [] };

  const ex = String(excetoCardId ?? '').trim();
  let q = supabase
    .from('kanban_cards')
    .select('id, titulo, kanban_id, kanbans(nome)')
    .ilike('titulo', `%${t}%`)
    .limit(25);
  if (ex) q = q.neq('id', ex);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };

  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = (prof as { role?: string | null } | null)?.role;
  const ocultarInternos = isFrankOrFranqueadoRole(role);

  const items: BuscaCardVinculoRow[] = (data ?? [])
    .map((row) => {
      const r = row as { id: string; titulo: string | null; kanban_id?: string; kanbans?: unknown };
      return {
        id: String(r.id),
        titulo: (r.titulo ?? '').trim() || '(sem título)',
        kanban_nome: kanbanNomeDeJoin(r) || 'Kanban',
        kanban_id: String(r.kanban_id ?? ''),
      };
    })
    .filter((it) => !ocultarInternos || !isKanbanIdInterno(it.kanban_id))
    .map(({ id, titulo, kanban_nome }) => ({ id, titulo, kanban_nome }));

  return { ok: true, items };
}

export async function criarVinculoCard(input: {
  cardOrigemId: string;
  cardDestinoId: string;
  tipo: TipoVinculoKanbanCard;
  basePath?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const pode = await perfilEhAdminOuTeam(supabase, user.id);
  if (!pode) return { ok: false, error: 'Sem permissão para criar vínculo.' };

  const orig = String(input.cardOrigemId ?? '').trim();
  const dest = String(input.cardDestinoId ?? '').trim();
  if (!orig || !dest || orig === dest) return { ok: false, error: 'Cards inválidos.' };

  const tipo =
    input.tipo === 'depende_de' || input.tipo === 'bloqueia' || input.tipo === 'relacionado'
      ? input.tipo
      : 'relacionado';

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  const shadowOrig = await garantirShadowKanbanCardLegadoPorId(db, orig);
  if (!shadowOrig.ok) return { ok: false, error: shadowOrig.error };
  const shadowDest = await garantirShadowKanbanCardLegadoPorId(db, dest);
  if (!shadowDest.ok) return { ok: false, error: shadowDest.error };

  const { error } = await inserirKanbanCardVinculo(db, {
    cardOrigemId: orig,
    cardDestinoId: dest,
    tipoVinculo: tipo,
    criadoPor: user.id,
  });

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'Este vínculo já existe.' };
    return { ok: false, error: error.message };
  }

  const healOrig = await reconciliarFranqueadoNoSyncGroup(db, orig);
  if (!healOrig.ok) return { ok: false, error: healOrig.error };
  const healDest = await reconciliarFranqueadoNoSyncGroup(db, dest);
  if (!healDest.ok) return { ok: false, error: healDest.error };

  revalidatePath(input.basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

export async function removerVinculoCard(
  vinculoId: string,
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const pode = await perfilEhAdminOuConsultor(supabase, user.id);
  if (!pode) return { ok: false, error: 'Sem permissão para remover vínculo.' };

  const vid = String(vinculoId ?? '').trim();
  if (!vid) return { ok: false, error: 'Vínculo inválido.' };

  const { error } = await supabase.from('kanban_card_vinculos').delete().eq('id', vid);
  if (error) return { ok: false, error: error.message };

  revalidatePath(basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

const FUNIL_PORTFOLIO_NOME = 'Funil Portfólio';
const PORTFOLIO_FASE_STEP2_SLUG = 'step_2';

export type CriarProjetoNegocioPortfolioInput = {
  titulo: string;
  /** `kanban_cards.franqueado_id` (auth.users) — informativo; FK em projeto_negocio é rede. */
  franqueadoUserId?: string | null;
  redeFranqueadoId?: string | null;
  nomeCondominio?: string | null;
  quadra?: string | null;
  lote?: string | null;
};

/** Cria `projeto_negocio` para card do Portfolio; falhas não propagam (retorna null). */
export async function tentarCriarProjetoNegocioPortfolio(
  input: CriarProjetoNegocioPortfolioInput,
): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const titulo = String(input.titulo ?? '').trim() || 'Projeto';
    const row: Record<string, unknown> = {
      titulo,
      status: 'ativo',
    };

    const redeId = String(input.redeFranqueadoId ?? '').trim();
    if (redeId) {
      row.franqueado_id = redeId;
      row.rede_franqueado_id = redeId;
    }

    const nomeCondominio = String(input.nomeCondominio ?? '').trim();
    if (nomeCondominio) row.nome_condominio = nomeCondominio;
    const quadra = String(input.quadra ?? '').trim();
    if (quadra) row.quadra = quadra;
    const lote = String(input.lote ?? '').trim();
    if (lote) row.lote = lote;

    const { data, error } = await admin
      .from('projeto_negocio')
      .insert(row as never)
      .select('id')
      .single();

    if (error) throw error;
    const id = (data as { id?: string } | null)?.id;
    return id != null ? String(id) : null;
  } catch (e) {
    console.error('[tentarCriarProjetoNegocioPortfolio]', e);
    return null;
  }
}
/** PROD: hipoteses; DEV: stepone_hipoteses (migration 157 / sync_dev_with_prod). */
const ERRO_UNIVERSIDADE_HIPOTESE =
  'Conclua as Casas 0, 1 e 2 da Universidade Moní para enviar hipóteses ao Portfolio.';

const ERRO_HIPOTESE_ATIVA_PORTFOLIO =
  'Já existe uma hipótese ativa no Portfolio para este franqueado.';

export type EnviarHipoteseAoPortfolioResult =
  | { ok: true; cardPortfolioId: string }
  | { ok: false; error: string };

async function existeHipoteseAtivaNoPortfolio(
  db: ReturnType<typeof createAdminClient>,
  portfolioKanbanId: string,
  redeFranqueadoId: string,
  ordemMinimaStep2: number,
): Promise<boolean> {
  const { data: fases, error: errFases } = await db
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', portfolioKanbanId)
    .gte('ordem', ordemMinimaStep2)
    .eq('ativo', true);

  if (errFases) throw new Error(errFases.message);
  const faseIds = (fases ?? []).map((f) => String((f as { id: string }).id));
  if (faseIds.length === 0) return false;

  const { data: cards, error: errCards } = await db
    .from('kanban_cards')
    .select('id')
    .eq('kanban_id', portfolioKanbanId)
    .eq('rede_franqueado_id', redeFranqueadoId)
    .in('fase_id', faseIds)
    .eq('concluido', false)
    .eq('arquivado', false)
    .limit(1);

  if (errCards) throw new Error(errCards.message);
  return (cards?.length ?? 0) > 0;
}

/** Gate Universidade (casas 0–2) + handoff Step One → Portfolio (fase step_2). */
export async function enviarHipoteseAoPortfolio(
  cardId: string,
): Promise<EnviarHipoteseAoPortfolioResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para enviar a hipótese.' };

  const cid = String(cardId ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const { data: cardRow, error: errCard } = await supabase
    .from('kanban_cards')
    .select(
      'id, titulo, franqueado_id, rede_franqueado_id, nome_condominio, quadra, lote, kanban_fases(slug)',
    )
    .eq('id', cid)
    .maybeSingle();

  if (errCard) return { ok: false, error: errCard.message };
  if (!cardRow) return { ok: false, error: 'Card não encontrado.' };

  const faseSlug = String(
    (cardRow as { kanban_fases?: { slug?: string } | null }).kanban_fases?.slug ?? '',
  ).trim();
  if (!isHipotesesFaseSlug(faseSlug)) {
    return { ok: false, error: 'Card não está na fase Nova Hipótese.' };
  }

  const franqueadoId = String((cardRow as { franqueado_id?: string }).franqueado_id ?? '').trim();
  if (!franqueadoId) return { ok: false, error: 'Card sem franqueado responsável.' };

  const redeFranqueadoId = String(
    (cardRow as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? '',
  ).trim();
  if (!redeFranqueadoId) {
    return { ok: false, error: 'Card sem vínculo com a rede de franqueados.' };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Serviço indisponível: ${msg}` };
  }

  let universidadeOk: boolean;
  try {
    universidadeOk = await usuarioConcluiuCasasUniversidade012(admin, franqueadoId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
  if (!universidadeOk) {
    return { ok: false, error: ERRO_UNIVERSIDADE_HIPOTESE };
  }

  const { data: kanbanPortfolio, error: errKb } = await admin
    .from('kanbans')
    .select('id')
    .eq('nome', FUNIL_PORTFOLIO_NOME)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle();

  if (errKb) return { ok: false, error: errKb.message };
  if (!kanbanPortfolio?.id) {
    return { ok: false, error: `Kanban "${FUNIL_PORTFOLIO_NOME}" não encontrado.` };
  }

  const portfolioKanbanId = String(kanbanPortfolio.id);

  const { data: faseStep2, error: errFase } = await admin
    .from('kanban_fases')
    .select('id, ordem')
    .eq('kanban_id', portfolioKanbanId)
    .eq('slug', PORTFOLIO_FASE_STEP2_SLUG)
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (errFase) return { ok: false, error: errFase.message };
  if (!faseStep2?.id) {
    return { ok: false, error: `Fase "${PORTFOLIO_FASE_STEP2_SLUG}" não encontrada no Portfolio.` };
  }

  const step2Ordem = Number((faseStep2 as { ordem?: number }).ordem ?? 0);

  try {
    const jaAtiva = await existeHipoteseAtivaNoPortfolio(
      admin,
      portfolioKanbanId,
      redeFranqueadoId,
      step2Ordem,
    );
    if (jaAtiva) {
      return { ok: false, error: ERRO_HIPOTESE_ATIVA_PORTFOLIO };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  const titulo = String((cardRow as { titulo?: string }).titulo ?? '').trim() || 'Hipótese';

  let projetoId: string | null = null;
  if (portfolioKanbanId === KANBAN_IDS.PORTFOLIO) {
    projetoId = await tentarCriarProjetoNegocioPortfolio({
      titulo,
      franqueadoUserId: franqueadoId,
      redeFranqueadoId,
      nomeCondominio: (cardRow as { nome_condominio?: string | null }).nome_condominio,
      quadra: (cardRow as { quadra?: string | null }).quadra,
      lote: (cardRow as { lote?: string | null }).lote,
    });
  }

  const { data: portfolioCard, error: errInsert } = await admin
    .from('kanban_cards')
    .insert({
      kanban_id: portfolioKanbanId,
      fase_id: String(faseStep2.id),
      titulo,
      franqueado_id: franqueadoId,
      rede_franqueado_id: redeFranqueadoId,
      projeto_id: projetoId,
      status: 'ativo',
    })
    .select('id')
    .single();

  if (errInsert) return { ok: false, error: errInsert.message };
  if (!portfolioCard?.id) {
    return { ok: false, error: 'Não foi possível criar o card no Portfolio.' };
  }

  const cardPortfolioId = String(portfolioCard.id);

  const { error: errVinc } = await inserirKanbanCardVinculo(admin, {
    cardOrigemId: cid,
    cardDestinoId: cardPortfolioId,
    tipoVinculo: 'relacionado',
    criadoPor: user.id,
  });

  if (errVinc) {
    return { ok: false, error: errVinc.message };
  }

  revalidatePath('/funil-stepone');
  revalidatePath('/portfolio');

  return { ok: true, cardPortfolioId };
}

const MAX_ANEXO_BYTES = 10 * 1024 * 1024;

export type ChamadoAnexoRow = {
  id: string;
  chamado_id: string;
  storage_path: string;
  nome_original: string;
  tamanho: number | null;
  tipo_mime: string | null;
  uploader_id: string | null;
  uploader_nome: string | null;
  criado_em: string;
};

export type SubchamadoAnexoRow = {
  id: string;
  subchamado_id: string;
  storage_path: string;
  nome_original: string;
  tamanho: number | null;
  tipo_mime: string | null;
  uploader_id: string | null;
  uploader_nome: string | null;
  criado_em: string;
};

function sanitizeNomeArquivo(nome: string): string {
  return String(nome ?? '')
    .replace(/[/\\]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export async function listarAnexosChamado(
  chamadoId: string,
): Promise<{ ok: true; items: ChamadoAnexoRow[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const cid = String(chamadoId ?? '').trim();
  if (!cid) return { ok: false, error: 'Chamado inválido.' };

  const { data, error } = await supabase
    .from('chamado_anexos')
    .select('id, chamado_id, storage_path, nome_original, tamanho, tipo_mime, uploader_id, uploader_nome, criado_em')
    .eq('chamado_id', cid)
    .order('criado_em', { ascending: false });
  if (error) return { ok: false, error: error.message };
  const items = (data ?? []) as unknown as ChamadoAnexoRow[];
  return { ok: true, items };
}

export async function listarAnexosSubchamado(
  subchamadoId: string,
): Promise<{ ok: true; items: SubchamadoAnexoRow[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const sid = Number.parseInt(String(subchamadoId ?? '').trim(), 10);
  if (!Number.isFinite(sid)) return { ok: false, error: 'Sub-chamado inválido.' };

  const { data, error } = await supabase
    .from('subchamado_anexos')
    .select('id, subchamado_id, storage_path, nome_original, tamanho, tipo_mime, uploader_id, uploader_nome, criado_em')
    .eq('subchamado_id', sid)
    .order('criado_em', { ascending: false });
  if (error) return { ok: false, error: error.message };
  const items = (data ?? []).map((r) => {
    const x = r as Record<string, unknown>;
    return {
      id: String(x.id),
      subchamado_id: String(x.subchamado_id),
      storage_path: String(x.storage_path ?? ''),
      nome_original: String(x.nome_original ?? ''),
      tamanho: x.tamanho != null ? Number(x.tamanho) : null,
      tipo_mime: x.tipo_mime != null ? String(x.tipo_mime) : null,
      uploader_id: x.uploader_id != null ? String(x.uploader_id) : null,
      uploader_nome: x.uploader_nome != null ? String(x.uploader_nome) : null,
      criado_em: String(x.criado_em ?? ''),
    } satisfies SubchamadoAnexoRow;
  });
  return { ok: true, items };
}

export async function getSignedUrlAnexo(
  bucket: string,
  path: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const b = String(bucket ?? '').trim();
  const p = String(path ?? '').trim();
  if (!b || !p) return { ok: false, error: 'Bucket ou caminho inválido.' };
  if (b !== 'chamados-attachments' && b !== 'subchamados-attachments') {
    return { ok: false, error: 'Bucket não permitido.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data, error } = await supabase.storage.from(b).createSignedUrl(p, 3600);
  if (error || !data?.signedUrl) return { ok: false, error: error?.message ?? 'Não foi possível gerar o link.' };
  return { ok: true, url: data.signedUrl };
}

export async function adicionarAnexoChamado(
  formData: FormData,
  basePath?: string,
): Promise<ActionResult & { storagePath?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const chamadoId = String(formData.get('chamadoId') ?? '').trim();
  const uploaderNome = String(formData.get('uploaderNome') ?? '').trim() || '—';
  const portalFrank = formData.get('portalFrank') === 'true' || formData.get('portalFrank') === '1';
  const file = formData.get('file');
  if (!chamadoId) return { ok: false, error: 'Chamado inválido.' };
  if (!(file instanceof File)) return { ok: false, error: 'Arquivo inválido.' };
  if (file.size > MAX_ANEXO_BYTES) return { ok: false, error: 'Arquivo acima de 10 MB.' };

  const { data: atv, error: eAtv } = await supabase
    .from('kanban_atividades')
    .select('id, criado_por, responsaveis_ids')
    .eq('id', chamadoId)
    .maybeSingle();
  if (eAtv || !atv) return { ok: false, error: 'Chamado não encontrado.' };
  const row = atv as { criado_por?: string | null; responsaveis_ids?: string[] | null };
  const resp = Array.isArray(row.responsaveis_ids) ? row.responsaveis_ids.map(String) : [];
  const adminTeam = await perfilEhAdminOuTeam(supabase, user.id);
  const ehCriador = row.criado_por != null && String(row.criado_por) === user.id;
  const ehResp = resp.includes(user.id);
  if (portalFrank) {
    if (!adminTeam && !ehCriador) {
      return { ok: false, error: 'No portal do franqueado só é possível anexar em chamados criados por você.' };
    }
  } else if (!adminTeam && !ehCriador && !ehResp) {
    return { ok: false, error: 'Sem permissão para anexar neste chamado.' };
  }

  const orig = sanitizeNomeArquivo(file.name || 'arquivo');
  const storagePath = `chamados/${chamadoId}/${randomUUID()}-${orig}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from('chamados-attachments').upload(storagePath, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { error: insErr } = await supabase.from('chamado_anexos').insert({
    chamado_id: chamadoId,
    storage_path: storagePath,
    nome_original: orig,
    tamanho: file.size,
    tipo_mime: file.type || null,
    uploader_id: user.id,
    uploader_nome: uploaderNome,
  } as never);
  if (insErr) {
    await supabase.storage.from('chamados-attachments').remove([storagePath]);
    return { ok: false, error: insErr.message };
  }

  revalidatePath(basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true, storagePath };
}

export async function adicionarAnexoSubchamado(formData: FormData, basePath?: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const subIdRaw = String(formData.get('subchamadoId') ?? '').trim();
  const uploaderNome = String(formData.get('uploaderNome') ?? '').trim() || '—';
  const file = formData.get('file');
  const sid = Number.parseInt(subIdRaw, 10);
  if (!Number.isFinite(sid)) return { ok: false, error: 'Sub-chamado inválido.' };
  if (!(file instanceof File)) return { ok: false, error: 'Arquivo inválido.' };
  if (file.size > MAX_ANEXO_BYTES) return { ok: false, error: 'Arquivo acima de 10 MB.' };

  const orig = sanitizeNomeArquivo(file.name || 'arquivo');
  const storagePath = `subchamados/${sid}/${randomUUID()}-${orig}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from('subchamados-attachments').upload(storagePath, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { error: insErr } = await supabase.from('subchamado_anexos').insert({
    subchamado_id: sid,
    storage_path: storagePath,
    nome_original: orig,
    tamanho: file.size,
    tipo_mime: file.type || null,
    uploader_id: user.id,
    uploader_nome: uploaderNome,
  } as never);
  if (insErr) {
    await supabase.storage.from('subchamados-attachments').remove([storagePath]);
    return { ok: false, error: insErr.message };
  }

  revalidatePath(basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

export async function removerAnexoChamado(
  anexoId: string,
  storagePath: string,
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const id = String(anexoId ?? '').trim();
  const path = String(storagePath ?? '').trim();
  if (!id || !path) return { ok: false, error: 'Dados inválidos.' };

  const { data: row, error: fErr } = await supabase
    .from('chamado_anexos')
    .select('id, uploader_id')
    .eq('id', id)
    .maybeSingle();
  if (fErr || !row) return { ok: false, error: 'Anexo não encontrado.' };
  const up = (row as { uploader_id?: string | null }).uploader_id;
  const adminTeam = await perfilEhAdminOuTeam(supabase, user.id);
  if (!adminTeam && up !== user.id) return { ok: false, error: 'Sem permissão para excluir.' };

  await supabase.storage.from('chamados-attachments').remove([path]);
  const { error: delE } = await supabase.from('chamado_anexos').delete().eq('id', id);
  if (delE) return { ok: false, error: delE.message };

  revalidatePath(basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

export async function removerAnexoSubchamado(
  anexoId: string,
  storagePath: string,
  basePath?: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const id = String(anexoId ?? '').trim();
  const path = String(storagePath ?? '').trim();
  if (!id || !path) return { ok: false, error: 'Dados inválidos.' };

  const { data: row, error: fErr } = await supabase
    .from('subchamado_anexos')
    .select('id, uploader_id')
    .eq('id', id)
    .maybeSingle();
  if (fErr || !row) return { ok: false, error: 'Anexo não encontrado.' };
  const up = (row as { uploader_id?: string | null }).uploader_id;
  const adminTeam = await perfilEhAdminOuTeam(supabase, user.id);
  if (!adminTeam && up !== user.id) return { ok: false, error: 'Sem permissão para excluir.' };

  await supabase.storage.from('subchamados-attachments').remove([path]);
  const { error: delE } = await supabase.from('subchamado_anexos').delete().eq('id', id);
  if (delE) return { ok: false, error: delE.message };

  revalidatePath(basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true };
}

// ─── Checklist por card ───────────────────────────────────────────────────────

export type ChecklistItem = {
  id: string;
  card_id: string;
  texto: string;
  feito: boolean;
  responsavel_id: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  responsavel?: { full_name: string | null } | null;
};

export async function listarChecklistCard(cardId: string): Promise<ChecklistItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('kanban_checklist_itens')
    .select('*, responsavel:responsavel_id(full_name)')
    .eq('card_id', cardId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []) as ChecklistItem[];
}

export async function criarChecklistItem(input: {
  card_id: string;
  texto: string;
  responsavel_id: string | null;
  basePath?: string;
}): Promise<{ ok: boolean; error?: string; item?: ChecklistItem }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data, error } = await supabase
    .from('kanban_checklist_itens')
    .insert({ card_id: input.card_id, texto: input.texto.trim(), responsavel_id: input.responsavel_id || null, criado_por: user.id })
    .select('*, responsavel:responsavel_id(full_name)')
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true, item: data as ChecklistItem };
}

export async function toggleChecklistItem(input: {
  id: string;
  feito: boolean;
  basePath?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { error } = await supabase
    .from('kanban_checklist_itens')
    .update({ feito: input.feito, updated_at: new Date().toISOString() })
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}

export async function deletarChecklistItem(input: {
  id: string;
  basePath?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { error } = await supabase
    .from('kanban_checklist_itens')
    .delete()
    .eq('id', input.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}

// ─── Movimentação de fase (nativo) ───────────────────────────────────────────

type SupabaseGateClient = Pick<Awaited<ReturnType<typeof createClient>>, 'from'>;

async function obterGatePortfolioStep5(
  supabase: SupabaseGateClient,
  cardId: string,
  novaFaseSlug: string,
  kanbanNomeHint?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: cardRow, error } = await supabase
    .from('kanban_cards')
    .select(
      'kanban_id, acoplamento_concluido, credito_terreno_ok, contabilidade_ok, juridico_ok, capital_ok, kanbans ( nome )',
    )
    .eq('id', cardId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!cardRow) return { ok: false, error: 'Card não encontrado.' };

  const row = cardRow as {
    kanban_id?: string;
    acoplamento_concluido?: boolean | null;
    credito_terreno_ok?: boolean | null;
    contabilidade_ok?: boolean | null;
    juridico_ok?: boolean | null;
    capital_ok?: boolean | null;
    kanbans?: { nome?: string } | { nome?: string }[] | null;
  };

  const kn = row.kanbans;
  const knNode = Array.isArray(kn) ? kn[0] : kn;
  const kanbanNome = String(knNode?.nome ?? kanbanNomeHint ?? '').trim();

  if (deveValidarGateLoteadoresComite(novaFaseSlug, row.kanban_id, kanbanNome)) {
    if (!Boolean(row.acoplamento_concluido)) {
      return { ok: false, error: mensagemGateLoteadoresComite() };
    }
    return { ok: true };
  }

  if (!deveValidarGatePortfolioStep5(novaFaseSlug, row.kanban_id, kanbanNome)) {
    return { ok: true };
  }

  const flags: PortfolioParalelasFlags = {
    acoplamento_concluido: row.acoplamento_concluido,
    credito_terreno_ok: row.credito_terreno_ok,
    contabilidade_ok: row.contabilidade_ok,
    juridico_ok: row.juridico_ok,
    capital_ok: row.capital_ok,
  };

  const exigirCapital = await deveVerificarCapital(supabase, cardId);
  const gateOpts = { exigirCapital };

  if (gatePortfolioStep5Liberado(flags, gateOpts)) return { ok: true };

  return {
    ok: false,
    error: mensagemGatePortfolioStep5(listarEsteirasParalelasPendentes(flags, gateOpts)),
  };
}

/** Valida gate Comitê (Portfolio → step_5) antes de avançar fase no cliente. */
export async function verificarGatePortfolioStep5(
  cardId: string,
  proximaFaseId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const cid = String(cardId ?? '').trim();
  const fid = String(proximaFaseId ?? '').trim();
  if (!cid || !fid) return { ok: false, error: 'Dados inválidos.' };

  const { data: faseRow, error: faseErr } = await supabase
    .from('kanban_fases')
    .select('slug')
    .eq('id', fid)
    .maybeSingle();

  if (faseErr) return { ok: false, error: faseErr.message };

  const slug = String((faseRow as { slug?: string | null } | null)?.slug ?? '').trim();
  return obterGatePortfolioStep5(supabase, cid, slug, PORTFOLIO_KANBAN_NOME);
}

export async function registrarConfirmacaoFasePortfolio(input: {
  cardId: string;
  tipo: PortfolioConfirmacaoFaseTipo;
  basePath?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para registrar a confirmação.' };

  const cardId = String(input.cardId ?? '').trim();
  const tipo = input.tipo;
  if (!cardId || !tipo) return { ok: false, error: 'Dados inválidos.' };

  const { data: cardRow, error: cardErr } = await supabase
    .from('kanban_cards')
    .select('kanban_id')
    .eq('id', cardId)
    .maybeSingle();
  if (cardErr) return { ok: false, error: cardErr.message };
  if (String((cardRow as { kanban_id?: string | null } | null)?.kanban_id ?? '') !== KANBAN_IDS.PORTFOLIO) {
    return { ok: false, error: 'Confirmação aplicável apenas ao Funil Portfólio.' };
  }

  const now = new Date().toISOString();
  const patchByTipo = {
    opcao: { opcao_assinada: true, opcao_assinada_em: now },
    comite: { comite_aprovado: true, comite_aprovado_em: now },
    contrato: { contrato_assinado: true, contrato_assinado_em: now },
  } as const;

  const { error: updErr } = await supabase
    .from('kanban_cards')
    .update(patchByTipo[tipo] as never)
    .eq('id', cardId);

  if (updErr) return { ok: false, error: updErr.message };

  const base = String(input.basePath ?? '/').trim() || '/';
  revalidatePath(base);
  revalidatePath('/');
  return { ok: true };
}

function timestampCampoCalendarioIso(input: string | null | undefined): string | null {
  const ymd = dataCampoCalendarioIso(input);
  if (!ymd) return null;
  return `${ymd}T12:00:00.000Z`;
}

export type SalvarDadosPreObraOperacoesInput = {
  cardId: string;
  condominio_aprovada_em?: string | null;
  prefeitura_aprovada_em?: string | null;
  alvara_emitido_em?: string | null;
  basePath?: string;
};

/** Salva datas reais de pré-obra no card nativo do Funil Operações (prev_* recalculados pelo trigger). */
export async function salvarDadosPreObraOperacoes(
  input: SalvarDadosPreObraOperacoesInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para salvar.' };

  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const { data: cardRow, error: cardErr } = await supabase
    .from('kanban_cards')
    .select('kanban_id')
    .eq('id', cardId)
    .maybeSingle();
  if (cardErr) return { ok: false, error: cardErr.message };
  if (String((cardRow as { kanban_id?: string | null } | null)?.kanban_id ?? '') !== KANBAN_IDS.OPERACOES) {
    return { ok: false, error: 'Pré-obra aplicável apenas ao Funil Operações.' };
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.condominio_aprovada_em !== undefined) {
    update.condominio_aprovada_em = timestampCampoCalendarioIso(input.condominio_aprovada_em);
  }
  if (input.prefeitura_aprovada_em !== undefined) {
    const ts = timestampCampoCalendarioIso(input.prefeitura_aprovada_em);
    update.prefeitura_aprovada_em = ts;
    update.prefeitura_aprovada = ts != null;
  }
  if (input.alvara_emitido_em !== undefined) {
    update.alvara_emitido_em = timestampCampoCalendarioIso(input.alvara_emitido_em);
  }

  const { error: updErr } = await supabase.from('kanban_cards').update(update as never).eq('id', cardId);
  if (updErr) return { ok: false, error: updErr.message };

  const base = String(input.basePath ?? '/').trim() || '/';
  revalidatePath(base);
  revalidatePath('/');
  return { ok: true };
}

export type SalvarDadosFundingInput = {
  cardId: string;
  funding_nome?: string | null;
  funding_tipo?: FundingTipo | '' | null;
  funding_localizacao?: string | null;
  funding_descritivo?: string | null;
  funding_proxima_atividade?: string | null;
  funding_prazo_atividade?: string | null;
  basePath?: string;
};

/** Salva campos específicos do Funil Funding em `kanban_cards`. */
export async function salvarDadosFunding(input: SalvarDadosFundingInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para salvar.' };

  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  const { data: cardRow, error: cardErr } = await supabase
    .from('kanban_cards')
    .select('kanban_id')
    .eq('id', cardId)
    .maybeSingle();
  if (cardErr) return { ok: false, error: cardErr.message };
  if (String((cardRow as { kanban_id?: string | null } | null)?.kanban_id ?? '') !== KANBAN_IDS.FUNDING) {
    return { ok: false, error: 'Campos Funding aplicáveis apenas ao funil Funding.' };
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (input.funding_nome !== undefined) {
    const nome = String(input.funding_nome ?? '').trim();
    if (!nome) return { ok: false, error: 'Informe o nome.' };
    update.titulo = nome;
  }
  if (input.funding_tipo !== undefined) {
    const t = String(input.funding_tipo ?? '').trim();
    if (t !== '' && t !== 'Investidor' && t !== 'Broker') {
      return { ok: false, error: 'Tipo inválido.' };
    }
    update.funding_tipo = t === '' ? null : t;
  }
  if (input.funding_localizacao !== undefined) {
    const v = String(input.funding_localizacao ?? '').trim();
    update.funding_localizacao = v === '' ? null : v;
  }
  if (input.funding_descritivo !== undefined) {
    const v = String(input.funding_descritivo ?? '').trim();
    update.funding_descritivo = v === '' ? null : v;
  }
  if (input.funding_proxima_atividade !== undefined) {
    const v = String(input.funding_proxima_atividade ?? '').trim();
    update.funding_proxima_atividade = v === '' ? null : v;
  }
  if (input.funding_prazo_atividade !== undefined) {
    update.funding_prazo_atividade = timestampCampoCalendarioIso(input.funding_prazo_atividade);
  }

  const { error: updErr } = await supabase.from('kanban_cards').update(update as never).eq('id', cardId);
  if (updErr) return { ok: false, error: updErr.message };

  const base = String(input.basePath ?? '/').trim() || '/';
  revalidatePath(base);
  revalidatePath('/');
  return { ok: true };
}

export async function registrarConfirmacaoFaseOperacoes(input: {
  cardId: string;
  tipo: OperacoesConfirmacaoFaseTipo;
  basePath?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para registrar a confirmação.' };

  const cardId = String(input.cardId ?? '').trim();
  const tipo = input.tipo;
  if (!cardId || !tipo) return { ok: false, error: 'Dados inválidos.' };

  const { data: cardRow, error: cardErr } = await supabase
    .from('kanban_cards')
    .select('kanban_id, obra_iniciada, obra_finalizada')
    .eq('id', cardId)
    .maybeSingle();
  if (cardErr) return { ok: false, error: cardErr.message };
  if (String((cardRow as { kanban_id?: string | null } | null)?.kanban_id ?? '') !== KANBAN_IDS.OPERACOES) {
    return { ok: false, error: 'Confirmação aplicável apenas ao Funil Operações.' };
  }

  const now = new Date().toISOString();
  const cardFlags = cardRow as {
    obra_iniciada?: boolean | null;
    obra_finalizada?: boolean | null;
  } | null;

  let patch: Record<string, boolean | string>;
  if (tipo === 'prefeitura') {
    patch = { prefeitura_aprovada: true, prefeitura_aprovada_em: now };
  } else if (tipo === 'em_obra') {
    patch = {};
    if (cardFlags?.obra_iniciada !== true) {
      patch.obra_iniciada = true;
      patch.obra_iniciada_em = now;
    }
  } else if (tipo === 'entregue') {
    patch = {};
    if (cardFlags?.obra_finalizada !== true) {
      patch.obra_finalizada = true;
      patch.obra_finalizada_em = now;
    }
  } else {
    return { ok: false, error: 'Tipo de confirmação inválido.' };
  }

  if (Object.keys(patch).length === 0) {
    const base = String(input.basePath ?? '/').trim() || '/';
    revalidatePath(base);
    revalidatePath('/');
    return { ok: true };
  }

  const { error: updErr } = await supabase
    .from('kanban_cards')
    .update(patch as never)
    .eq('id', cardId);

  if (updErr) return { ok: false, error: updErr.message };

  const base = String(input.basePath ?? '/').trim() || '/';
  revalidatePath(base);
  revalidatePath('/');
  return { ok: true };
}

export async function moverCardParaFase(input: {
  cardId: string;
  novaFaseId: string;
  basePath?: string;
  kanbanNome?: string;
  /** Obrigatório ao mover para Reprovado no Funil Acoplamento. */
  motivoReprovacaoAcoplamento?: string;
  /** Obrigatório ao sair de fase com SLA vencido no Funil Loteadores (Dados do Loteador / Fechar Contrato). */
  justificativaSlaQuebra?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para mover o card.' };

  const cardId = String(input.cardId ?? '').trim();
  const novaFaseId = String(input.novaFaseId ?? '').trim();
  if (!cardId || !novaFaseId) return { ok: false, error: 'Dados inválidos.' };

  const { data: faseRow, error: faseErr } = await supabase
    .from('kanban_fases')
    .select('id, slug')
    .eq('id', novaFaseId)
    .maybeSingle();

  if (faseErr) return { ok: false, error: faseErr.message };
  if (!faseRow?.id) return { ok: false, error: 'Fase de destino não encontrada.' };

  const novaFaseSlug = String((faseRow as { slug?: string | null }).slug ?? '').trim();
  const gate = await obterGatePortfolioStep5(supabase, cardId, novaFaseSlug, input.kanbanNome);
  if (!gate.ok) return gate;

  const gateAcoplamento = await verificarGateAcoplamentoModelagemCasa(cardId, novaFaseId);
  if (!gateAcoplamento.ok) return gateAcoplamento;

  const gateChecklistLegal = await verificarGateChecklistLegalPortfolio(cardId, novaFaseId);
  if (!gateChecklistLegal.ok) return gateChecklistLegal;

  const { verificarGateJustificativaSlaLoteadores } = await import('@/lib/actions/kanban-sla-justificativa');
  const gateSlaJustificativa = await verificarGateJustificativaSlaLoteadores(
    cardId,
    input.justificativaSlaQuebra,
  );
  if (!gateSlaJustificativa.ok) return gateSlaJustificativa;

  const { data: cardKanban } = await supabase
    .from('kanban_cards')
    .select('kanban_id')
    .eq('id', cardId)
    .maybeSingle();

  if (
    novaFaseSlug === FASE_SLUGS.ACOPLAMENTO_REPROVADO &&
    String((cardKanban as { kanban_id?: string } | null)?.kanban_id ?? '') === KANBAN_IDS.ACOPLAMENTO
  ) {
    const motivo = String(input.motivoReprovacaoAcoplamento ?? '').trim();
    if (!motivo) {
      return { ok: false, error: 'Informe o motivo da paralisação para mover o card para Paralisados.' };
    }
    const admin = createAdminClient();
    const { error: errMot } = await admin
      .from('kanban_cards')
      .update({ motivo_reprovacao_acoplamento: motivo } as never)
      .eq('id', cardId);
    if (errMot) return { ok: false, error: errMot.message };
  }

  const { error: updErr } = await supabase
    .from('kanban_cards')
    .update({ fase_id: novaFaseId })
    .eq('id', cardId);

  if (updErr) return { ok: false, error: updErr.message };

  if (novaFaseSlug) {
    const { data: procRow } = await supabase
      .from('processo_step_one')
      .select('id')
      .eq('id', cardId)
      .maybeSingle();
    if (procRow?.id) {
      await supabase
        .from('processo_step_one')
        .update({ etapa_painel: novaFaseSlug, updated_at: new Date().toISOString() })
        .eq('id', cardId);
    }
  }

  const { aplicarSlaInicioDocumentacaoAoMoverFase } = await import('@/lib/actions/kanban-credito-obra-docs');
  await aplicarSlaInicioDocumentacaoAoMoverFase(supabase, cardId, novaFaseSlug);

  await executarBastoes(cardId, novaFaseSlug);
  await executarBastaoDeVolta(cardId, novaFaseSlug);
  await sincronizarTagAcoplamentoPaiDoFilho(cardId, novaFaseSlug);

  const { propagarResponsavelFaseAoEntrarFase, propagarResponsavelDaFaseAoEntrarFase } =
    await import('@/lib/kanban/responsavel-fase-checklist');
  await propagarResponsavelFaseAoEntrarFase(supabase, cardId, novaFaseId, user.id);
  await propagarResponsavelDaFaseAoEntrarFase(supabase, cardId, novaFaseId, user.id);

  void notificarUniversidadeSeAvancoStep2({
    cardId,
    newFaseId: novaFaseId,
    kanbanNombre: String(input.kanbanNome ?? '').trim(),
  });

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}

// ─── Aprovação de passagem de fase ───────────────────────────────────────────

export async function verificarChecklistParaFase(
  cardId: string,
): Promise<{ bloqueado: boolean; itens_pendentes: number }> {
  const supabase = await createClient();
  const cid = String(cardId ?? '').trim();
  if (!cid) return { bloqueado: false, itens_pendentes: 0 };

  const { data, error } = await supabase
    .from('kanban_checklist_itens')
    .select('id')
    .eq('card_id', cid)
    .eq('feito', false);

  if (error) return { bloqueado: false, itens_pendentes: 0 };
  const count = (data ?? []).length;
  return { bloqueado: count > 0, itens_pendentes: count };
}

export async function solicitarAprovacaoFase(input: {
  card_id: string;
  fase_destino: string;
  card_titulo: string;
  itens_pendentes: number;
  basePath?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para solicitar aprovação.' };

  const cid = String(input.card_id ?? '').trim();
  const faseDest = String(input.fase_destino ?? '').trim();
  if (!cid || !faseDest) return { ok: false, error: 'Dados inválidos.' };

  const { data: prof } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();
  const nomeSolicitante =
    String((prof as { full_name?: string | null } | null)?.full_name ?? '').trim() || 'Alguém';

  const { error: insErr } = await supabase.from('kanban_aprovacoes_fase').insert({
    card_id: cid,
    solicitado_por: user.id,
    fase_destino: faseDest,
    status: 'pendente',
  } as never);
  if (insErr) return { ok: false, error: insErr.message };

  const { data: bombeiros } = await supabase
    .from('sirene_papeis')
    .select('user_id')
    .eq('papel', 'bombeiro');

  const titulo = 'Solicitação de aprovação de fase';
  const n = input.itens_pendentes;
  const pendentesStr = n === 1 ? '1 item de checklist pendente' : `${n} itens de checklist pendentes`;
  const mensagem = `${nomeSolicitante} quer mover o card "${input.card_titulo}" para a próxima fase, mas há ${pendentesStr}.`;

  for (const b of bombeiros ?? []) {
    const uid = String((b as { user_id: string }).user_id);
    await supabase.from('sirene_notificacoes').insert({
      user_id: uid,
      chamado_id: null,
      tipo: 'aprovacao_fase',
      texto: mensagem,
      titulo,
      mensagem,
    } as never);
  }

  revalidatePath(input.basePath?.trim() || '/');
  revalidatePath('/sirene/monitor');
  revalidatePath('/');
  return { ok: true };
}

function revalidateAprovacaoFaseEMonitor() {
  revalidatePath('/sirene/monitor');
  for (const p of KANBAN_APP_BASE_PATHS) revalidatePath(p);
  revalidatePath('/');
}

export type AprovacaoFasePendente = {
  id: string;
  card_id: string;
  fase_destino: string;
  solicitado_por: string;
  created_at: string;
  card_titulo: string;
  funil_nome: string;
  solicitante_nome: string;
  itens_pendentes: number;
};

function cardEmbedRow(
  raw: unknown,
): { titulo: string; funil_nome: string } {
  const r = raw as
    | { titulo?: string; kanbans?: { nome?: string } | { nome?: string }[] | null }
    | { titulo?: string; kanbans?: { nome?: string } | { nome?: string }[] | null }[]
    | null
    | undefined;
  const node = Array.isArray(r) ? r[0] : r;
  if (!node) return { titulo: '—', funil_nome: 'Funil' };
  const k = node.kanbans;
  const kn = Array.isArray(k) ? k[0] : k;
  const funil = String(kn?.nome ?? 'Funil').trim() || 'Funil';
  return { titulo: String(node.titulo ?? '—').trim() || '—', funil_nome: funil };
}

export async function listarAprovacoesPendentes(): Promise<
  { ok: true; rows: AprovacaoFasePendente[] } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: isBombeiro } = await supabase
    .from('sirene_papeis')
    .select('papel')
    .eq('user_id', user.id)
    .eq('papel', 'bombeiro')
    .maybeSingle();
  if (!isBombeiro) return { ok: false, error: 'Acesso restrito a bombeiro.' };

  const { data: aprovs, error: aErr } = await supabase
    .from('kanban_aprovacoes_fase')
    .select(
      'id, card_id, fase_destino, solicitado_por, created_at, kanban_cards!inner ( titulo, kanbans ( nome ) )',
    )
    .eq('status', 'pendente')
    .order('created_at', { ascending: true });
  if (aErr) return { ok: false, error: aErr.message };

  const rows = (aprovs ?? []) as {
    id: string;
    card_id: string;
    fase_destino: string;
    solicitado_por: string;
    created_at: string;
    kanban_cards: unknown;
  }[];
  const cardIds = rows.map((r) => r.card_id);
  const solicitIds = [...new Set(rows.map((r) => r.solicitado_por))];

  const { data: profs } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', solicitIds);
  const nomePorId = new Map(
    (profs ?? []).map((p) => [
      p.id as string,
      String(p.full_name ?? '').trim() || 'Solicitante',
    ]),
  );

  let checklistPend: { card_id: string }[] | null = null;
  if (cardIds.length) {
    const { data: ck } = await supabase
      .from('kanban_checklist_itens')
      .select('card_id')
      .in('card_id', cardIds)
      .eq('feito', false);
    checklistPend = (ck ?? []) as { card_id: string }[];
  }
  const pendentesPorCard = new Map<string, number>();
  for (const c of cardIds) pendentesPorCard.set(c, 0);
  for (const it of checklistPend ?? []) pendentesPorCard.set(
    it.card_id,
    (pendentesPorCard.get(it.card_id) ?? 0) + 1,
  );

  return {
    ok: true,
    rows: rows.map((r) => {
      const { titulo, funil_nome } = cardEmbedRow(r.kanban_cards);
      const name = nomePorId.get(r.solicitado_por) ?? 'Solicitante';
      return {
        id: r.id,
        card_id: r.card_id,
        fase_destino: r.fase_destino,
        solicitado_por: r.solicitado_por,
        created_at: r.created_at,
        card_titulo: titulo,
        funil_nome: funil_nome,
        solicitante_nome: name,
        itens_pendentes: pendentesPorCard.get(r.card_id) ?? 0,
      };
    }),
  };
}

export async function aprovarPassagemFase(aprovacaoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: isBombeiro } = await supabase
    .from('sirene_papeis')
    .select('papel')
    .eq('user_id', user.id)
    .eq('papel', 'bombeiro')
    .maybeSingle();
  if (!isBombeiro) return { ok: false, error: 'Apenas bombeiro pode aprovar.' };

  const id = String(aprovacaoId ?? '').trim();
  if (!id) return { ok: false, error: 'Solicitação inválida.' };

  const { data: aprov, error: rErr } = await supabase
    .from('kanban_aprovacoes_fase')
    .select('id, card_id, fase_destino, status')
    .eq('id', id)
    .eq('status', 'pendente')
    .maybeSingle();
  if (rErr) return { ok: false, error: rErr.message };
  if (!aprov) return { ok: false, error: 'Aprovação não encontrada ou já tratada.' };

  const aprovRow = aprov as { id: string; card_id: string; fase_destino: string; status: string };
  const fase = String(aprovRow.fase_destino ?? '').trim();
  if (!fase) return { ok: false, error: 'Fase de destino inválida.' };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Serviço indisponível.' };
  }

  const { data: faseSlugRow } = await admin
    .from('kanban_fases')
    .select('slug')
    .eq('id', fase)
    .maybeSingle();
  const novaFaseSlug = String((faseSlugRow as { slug?: string | null } | null)?.slug ?? '').trim();

  const gate = await obterGatePortfolioStep5(admin, aprovRow.card_id, novaFaseSlug);
  if (!gate.ok) return gate;

  const now = new Date().toISOString();
  const { error: cErr } = await admin
    .from('kanban_cards')
    .update({ fase_id: fase })
    .eq('id', aprovRow.card_id);
  if (cErr) return { ok: false, error: cErr.message };
  await executarBastoes(aprovRow.card_id, novaFaseSlug);
  await executarBastaoDeVolta(aprovRow.card_id, novaFaseSlug);
  await sincronizarTagAcoplamentoPaiDoFilho(aprovRow.card_id, novaFaseSlug);

  const { data: kbNome } = await admin
    .from('kanban_cards')
    .select('kanbans ( nome )')
    .eq('id', aprovRow.card_id)
    .maybeSingle();
  const knRaw = kbNome as { kanbans?: { nome?: string } | { nome?: string }[] } | null;
  const knNode = Array.isArray(knRaw?.kanbans) ? knRaw.kanbans[0] : knRaw?.kanbans;
  const kanbanNombre = String(knNode?.nome ?? '').trim();
  void notificarUniversidadeSeAvancoStep2({
    cardId: aprovRow.card_id,
    newFaseId: fase,
    kanbanNombre,
  });

  const { error: uErr } = await supabase
    .from('kanban_aprovacoes_fase')
    .update({ status: 'aprovado', aprovado_por: user.id, updated_at: now })
    .eq('id', aprovRow.id);
  if (uErr) return { ok: false, error: uErr.message };

  revalidateAprovacaoFaseEMonitor();
  return { ok: true };
}

export async function rejeitarPassagemFase(aprovacaoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: isBombeiro } = await supabase
    .from('sirene_papeis')
    .select('papel')
    .eq('user_id', user.id)
    .eq('papel', 'bombeiro')
    .maybeSingle();
  if (!isBombeiro) return { ok: false, error: 'Apenas bombeiro pode rejeitar.' };

  const id = String(aprovacaoId ?? '').trim();
  if (!id) return { ok: false, error: 'Solicitação inválida.' };

  const { data: aprov, error: rErr } = await supabase
    .from('kanban_aprovacoes_fase')
    .select('id, card_id, solicitado_por, status, kanban_cards!inner ( titulo )')
    .eq('id', id)
    .eq('status', 'pendente')
    .maybeSingle();
  if (rErr) return { ok: false, error: rErr.message };
  if (!aprov) return { ok: false, error: 'Aprovação não encontrada ou já tratada.' };

  const row = aprov as {
    id: string;
    card_id: string;
    solicitado_por: string;
    status: string;
    kanban_cards: unknown;
  };
  const { titulo: tCard } = cardEmbedRow(row.kanban_cards);
  const cardTit = tCard !== '—' ? tCard : 'Card';

  const { data: perfBombeiro } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();
  const nomeBom = String(perfBombeiro?.full_name ?? '').trim() || 'Bombeiro';

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Serviço indisponível.' };
  }

  const now = new Date().toISOString();
  const { error: uErr } = await supabase
    .from('kanban_aprovacoes_fase')
    .update({ status: 'rejeitado', aprovado_por: user.id, updated_at: now })
    .eq('id', row.id);
  if (uErr) return { ok: false, error: uErr.message };

  const mensagem = `${nomeBom} rejeitou a solicitação de avanço do card "${cardTit}"`;
  const { error: nErr } = await admin.from('sirene_notificacoes').insert({
    user_id: row.solicitado_por,
    chamado_id: null,
    tipo: 'aprovacao_rejeitada',
    titulo: 'Passagem de fase rejeitada',
    mensagem,
    texto: mensagem,
    referencia_id: null,
    referencia_card_id: row.card_id,
  } as never);
  if (nErr) return { ok: false, error: nErr.message };

  revalidateAprovacaoFaseEMonitor();
  return { ok: true };
}

// ─── Form tokens para candidatos ────────────────────────────────────────────

export async function gerarFormTokenCandidato(
  cardId: string,
  faseId: string,
): Promise<{ ok: true; token: string; url: string } | ActionErr> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Serviço indisponível.' };
  }

  // Busca itens "Nome" e "E-mail" da fase para pré-popular o token de cobrança
  const { data: itens } = await admin
    .from('kanban_fase_checklist_itens')
    .select('id, label')
    .eq('fase_id', faseId)
    .in('label', ['Nome', 'E-mail']);

  const itemPorLabel = new Map<string, string>();
  for (const it of (itens ?? []) as { id: string; label: string }[]) {
    itemPorLabel.set(it.label, it.id);
  }

  let nomeCandidato: string | null = null;
  let emailCandidato: string | null = null;
  const itemIds = [...itemPorLabel.values()];
  if (itemIds.length) {
    const { data: resps } = await admin
      .from('kanban_fase_checklist_respostas')
      .select('item_id, valor')
      .eq('card_id', cardId)
      .in('item_id', itemIds);

    const valorPorItem = new Map<string, string>();
    for (const r of (resps ?? []) as { item_id: string; valor: string | null }[]) {
      if (r.valor) valorPorItem.set(r.item_id, r.valor);
    }
    const nomeId = itemPorLabel.get('Nome');
    const emailId = itemPorLabel.get('E-mail');
    if (nomeId) nomeCandidato = valorPorItem.get(nomeId) ?? null;
    if (emailId) emailCandidato = valorPorItem.get(emailId) ?? null;
  }

  const { data, error } = await admin
    .from('kanban_card_form_tokens')
    .insert({
      card_id: cardId,
      fase_id: faseId,
      created_by: user.id,
      nome_candidato: nomeCandidato,
      email_candidato: emailCandidato,
    })
    .select('token')
    .single();
  if (error) return { ok: false, error: error.message };

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'http://localhost:3000';
  const token = String((data as { token: string }).token);
  return { ok: true, token, url: `${baseUrl}/formulario-candidato/${token}` };
}

// ─── E-mail a partir do card ─────────────────────────────────────────────────

export type EnviarEmailCardInput = {
  card_id: string;
  para: string;
  assunto: string;
  mensagem: string;
  cc?: string;
  bcc?: string;
  basePath?: string;
};

export async function enviarEmailCard(input: EnviarEmailCardInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const para = input.para.trim();
  const assunto = input.assunto.trim();
  const mensagem = input.mensagem.trim();
  const cc = input.cc?.trim() ?? '';
  const bcc = input.bcc?.trim() ?? '';
  if (!para || !assunto || !mensagem) return { ok: false, error: 'Preencha todos os campos.' };

  const { data: cardInfo } = await supabase
    .from('kanban_cards')
    .select('kanban_id, kanbans(nome)')
    .eq('id', input.card_id)
    .maybeSingle();

  let kanbanNome = String((cardInfo?.kanbans as { nome?: string } | null)?.nome ?? '');
  if (!kanbanNome.trim()) {
    const { data: vRow } = await supabase
      .from('v_processo_como_kanban_cards')
      .select('kanban_id, kanbans(nome)')
      .eq('id', input.card_id)
      .maybeSingle();
    kanbanNome = String((vRow?.kanbans as { nome?: string } | null)?.nome ?? '');
  }

  const fromEmail =
    kanbanNome === 'Funil Step One' || kanbanNome === 'Funil Portfólio'
      ? 'Atendimento Moní <onboarding@moni.casa>'
      : (process.env.RESEND_FROM ?? 'Casa Moní <onboarding@moni.casa>');

  const { sendEmailViaResend } = await import('@/lib/email');
  const result = await sendEmailViaResend({
    to: para,
    subject: assunto,
    text: mensagem,
    html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${mensagem.replace(/\n/g, '<br>')}</div>`,
    from: fromEmail,
    ...(cc ? { cc } : {}),
    ...(bcc ? { bcc } : {}),
  });
  if (!result.ok) return { ok: false, error: result.error };

  const meta = [
    `[E-mail para: ${para}]`,
    cc ? `[CC: ${cc}]` : '',
    bcc ? `[BCC: ${bcc}]` : '',
    assunto,
  ]
    .filter(Boolean)
    .join(' ');
  const textoComentario = `${meta}\n\n${mensagem}`;
  const { error: insErr } = await supabase.from('kanban_card_comentarios').insert({
    card_id: input.card_id,
    autor_id: user.id,
    conteudo: textoComentario,
  });
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}

// ─── Checklist estrutural por fase ──────────────────────────────────────────
// `FaseChecklistItem` (tipos incl. `data`, `hora`) em `candidato-actions`; reexportado aqui.

export type FaseChecklistResposta = {
  id: string;
  item_id: string;
  card_id: string;
  valor: string | null;
  arquivo_path: string | null;
  preenchido_por: string | null;
  preenchido_em: string | null;
};

export async function listarFaseChecklistItens(faseId: string): Promise<FaseChecklistItem[]> {
  const supabase = await createClient();
  const { data } = await fetchFaseChecklistItens(supabase, faseId);
  return data;
}

export async function listarFaseChecklistRespostas(cardId: string): Promise<FaseChecklistResposta[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('id, item_id, card_id, valor, arquivo_path, preenchido_por, preenchido_em')
    .eq('card_id', cardId);
  return (data ?? []) as FaseChecklistResposta[];
}

export async function upsertFaseChecklistResposta(input: {
  item_id: string;
  card_id: string;
  valor?: string | null;
  arquivo_path?: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: itemRow } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('label, campo_slug, fase_id')
    .eq('id', input.item_id)
    .maybeSingle();

  const { error } = await supabase.from('kanban_fase_checklist_respostas').upsert(
    {
      item_id: input.item_id,
      card_id: input.card_id,
      valor: input.valor ?? null,
      arquivo_path: input.arquivo_path ?? null,
      preenchido_por: user.id,
      preenchido_em: new Date().toISOString(),
    },
    { onConflict: 'item_id,card_id' },
  );
  if (error) return { ok: false, error: error.message };

  const faseIdItem = String((itemRow as { fase_id?: string | null } | null)?.fase_id ?? '').trim();
  if (faseIdItem === FASE_IDS.PORTFOLIO_PASSAGEM_WAYSER) {
    void garantirBastaoPassagemWayser(input.card_id);
  }

  const campoSlug = String((itemRow as { campo_slug?: string | null } | null)?.campo_slug ?? '').trim();
  if (campoSlug && ['preco_atratividade', 'produto_atratividade', 'showroom_interesse', 'linhas_receita'].includes(campoSlug)) {
    const { atualizarScoreLoteadorR1 } = await import('@/lib/actions/loteador-externo-actions');
    await atualizarScoreLoteadorR1(input.card_id);
  }

  const itemLabel = String((itemRow as { label?: string | null } | null)?.label ?? '');
  const { isChecklistItemLinkPlanilhaMapa, sincronizarPlanilhaMapaChecklistParaGbox } = await import(
    '@/lib/kanban/gbox-planilha-mapa-sync'
  );
  if (isChecklistItemLinkPlanilhaMapa(itemLabel)) {
    let processoId: string | null = null;
    const { data: cardRow } = await supabase
      .from('kanban_cards')
      .select('processo_step_one_id')
      .eq('id', input.card_id)
      .maybeSingle();
    processoId = String(
      (cardRow as { processo_step_one_id?: string | null } | null)?.processo_step_one_id ?? '',
    ).trim() || null;

    const sync = await sincronizarPlanilhaMapaChecklistParaGbox({
      cardId: input.card_id,
      valorChecklist: input.valor ?? null,
      processoId,
    });
    if (!sync.ok) return sync;
  }

  return { ok: true };
}

/** Espelha Gbox ↔ checklist «Link planilha / mapa externo» quando só um lado está preenchido. */
export async function reconciliarGboxPlanilhaMapaChecklist(input: {
  cardId: string;
  processoId?: string | null;
}): Promise<
  | {
      ok: true;
      linkGbox: string | null;
      valorChecklist: string | null;
      alterado: boolean;
    }
  | { ok: false; error: string }
> {
  const { reconciliarGboxPlanilhaMapa } = await import('@/lib/kanban/gbox-planilha-mapa-sync');
  return reconciliarGboxPlanilhaMapa(input);
}

/** Salva links Gbox/Acoplamento no processo e propaga a checklist + cards vinculados. */
export async function salvarLinksBcaAcoplamentoNegocio(input: {
  cardId: string;
  linkGbox?: string | null;
  linkAcoplamento?: string | null;
  basePath?: string;
}): Promise<ActionResult & { linkGbox?: string | null; linkAcoplamento?: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para salvar.' };

  const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();

  const { sincronizarLinksGboxAcoplamento } = await import('@/lib/kanban/links-bca-acoplamento-sync');
  const sync = await sincronizarLinksGboxAcoplamento({
    cardOrigemId: input.cardId,
    origem: 'painel_negocio',
    usuarioId: user.id,
    usuarioNome: String((prof as { full_name?: string | null } | null)?.full_name ?? '').trim() || null,
    linkGbox: input.linkGbox,
    linkAcoplamento: input.linkAcoplamento,
  });

  if (!sync.ok) return sync;

  revalidatePath(input.basePath?.trim() || '/');
  revalidatePath('/');
  return { ok: true, linkGbox: sync.linkGbox, linkAcoplamento: sync.linkAcoplamento };
}
