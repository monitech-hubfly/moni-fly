'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAppFullyPublic } from '@/lib/public-rede-novos';
import { revalidatePath } from 'next/cache';
import type { Chamado, HdmTime } from '@/types/sirene';
import { canActAsBombeiro, type SireneUserContext } from '@/lib/sirene';
import {
  TIMES_MONI,
  TIMES_MONI_HDM,
  inferirHdmResponsavelPorNomesTimes,
  validarParTimeResponsavelMoni,
  validarTimeMoniOpcional,
} from '@/lib/times-responsaveis';
import { compareChamadosPainelRank } from '@/lib/sirene-painel-chamados-rank';
import type { SubInteracaoTipoDb } from '@/types/kanban-subinteracao';
import { podeExcluirChamadoSirene } from '@/lib/sirene-utils';
import { notificarMencoesSirene, resolverMencoesSirene } from '@/lib/actions/sirene-mencoes';
import { criarPastelariaInboxParaChamadoSirene } from '@/lib/pastelaria/sirene-pastel-abertura';
import {
  aggregatePorPrioridadeAbertosFromBreakdown,
  aggregatePorTipoFromBreakdown,
  normalizePrioridade,
  normalizeTipoAtividade,
  slaStatusFromDate,
  type DashboardAtividadeBreakdownRow,
  type DashboardChamadoBreakdownRow,
} from './dashboard-breakdown';
import { labelPastelariaColuna } from '@/lib/pastelaria/coluna-labels';
import { syncPastelariaColunaFromSireneStatus } from '@/lib/pastelaria/sirene-status-sync';
import {
  buscarTopicosStatusChamado,
  registrarPrimeiroAtendimentoSeNecessario,
  todosTopicosFechados,
  topicoStatusFechado,
} from '@/lib/sirene/chamado-regras';

export type SireneActionResult = { ok: true } | { ok: false; error: string };

/** Arquiva chamado Sirene com motivo (apenas admin/team). Atualiza espelho em `kanban_atividades`. */
export type DeletarChamadoInput =
  | { modo: 'sirene'; sireneChamadoId: number }
  | { modo: 'interacao_kanban'; interacaoKanbanId: string; basePath?: string };

function podeUsuarioExcluirChamado(opts: {
  role: string | null;
  cargo: string | null;
  userId: string;
  criadorOuAbertoPor: string | null;
}): boolean {
  return podeExcluirChamadoSirene({
    role: opts.role,
    cargo: opts.cargo,
    userId: opts.userId,
    abertoPor: opts.criadorOuAbertoPor,
  });
}

/**
 * Exclui chamado Sirene (e espelho em `kanban_atividades`) ou uma interação no card do funil.
 * Ordem: remove `kanban_atividades` (CASCADE em `sirene_topicos.interacao_id`, notificações, etc.),
 * depois `sirene_chamados` quando aplicável.
 */
export async function deletarChamado(input: DeletarChamadoInput): Promise<SireneActionResult> {
  try {
    const supabase = await createClient();
    const me = await getSireneUserContext(supabase);
    if (!me) return { ok: false, error: 'Faça login.' };

    const admin = createAdminClient();

    if (input.modo === 'sirene') {
      if (!Number.isFinite(input.sireneChamadoId)) {
        return { ok: false, error: 'ID do chamado inválido.' };
      }
      const { data: sc, error: scErr } = await admin
        .from('sirene_chamados')
        .select('id, aberto_por')
        .eq('id', input.sireneChamadoId)
        .maybeSingle();
      if (scErr || !sc) {
        console.error('[sirene] deletarChamado: falha ao buscar chamado', scErr);
        return { ok: false, error: 'Chamado não encontrado.' };
      }
      const abertoPor = (sc as { aberto_por?: string | null }).aberto_por ?? null;
      if (!podeUsuarioExcluirChamado({ role: me.role, cargo: me.cargo, userId: me.userId, criadorOuAbertoPor: abertoPor })) {
        return { ok: false, error: 'Sem permissão para excluir este chamado.' };
      }

      const { data: kaRows, error: kaListErr } = await admin
        .from('kanban_atividades')
        .select('id')
        .eq('sirene_chamado_id', input.sireneChamadoId)
        .eq('origem', 'sirene');
      if (kaListErr) {
        console.error('[sirene] deletarChamado: falha ao listar kanban_atividades', kaListErr);
        return { ok: false, error: kaListErr.message };
      }

      for (const row of kaRows ?? []) {
        const kaId = String((row as { id: string }).id);
        const { error: delKa } = await admin.from('kanban_atividades').delete().eq('id', kaId);
        if (delKa) {
          console.error('[sirene] deletarChamado: falha ao deletar kanban_atividades', { kaId, delKa });
          return { ok: false, error: delKa.message };
        }
      }

      const { error: delSc, count: delScCount } = await admin
        .from('sirene_chamados')
        .delete({ count: 'exact' })
        .eq('id', input.sireneChamadoId);
      if (delSc) {
        console.error('[sirene] deletarChamado: falha ao deletar sirene_chamados', delSc);
        return { ok: false, error: delSc.message };
      }
      if (!delScCount) {
        console.error('[sirene] deletarChamado: delete não removeu linhas', { chamadoId: input.sireneChamadoId });
        return { ok: false, error: 'Não foi possível excluir o chamado (nenhuma linha removida).' };
      }

      revalidatePath('/sirene');
      revalidatePath('/sirene/chamados');
      revalidatePath('/sirene/kanban');
      revalidatePath(`/sirene/${input.sireneChamadoId}`);
      return { ok: true };
    }

    const { data: row, error: rowErr } = await admin
      .from('kanban_atividades')
      .select('id, criado_por, sirene_chamado_id, origem')
      .eq('id', input.interacaoKanbanId)
      .maybeSingle();
    if (rowErr || !row) {
      console.error('[sirene] deletarChamado: falha ao buscar interacao', rowErr);
      return { ok: false, error: 'Chamado não encontrado.' };
    }
    const criadoPor = (row as { criado_por?: string | null }).criado_por ?? null;
    if (!podeUsuarioExcluirChamado({ role: me.role, cargo: me.cargo, userId: me.userId, criadorOuAbertoPor: criadoPor })) {
      return { ok: false, error: 'Sem permissão para excluir este chamado.' };
    }

    const sid = (row as { sirene_chamado_id?: number | null }).sirene_chamado_id;
    const origem = String((row as { origem?: string | null }).origem ?? '');

    const { error: delKa } = await admin.from('kanban_atividades').delete().eq('id', input.interacaoKanbanId);
    if (delKa) {
      console.error('[sirene] deletarChamado: falha ao deletar interacao kanban_atividades', delKa);
      return { ok: false, error: delKa.message };
    }

    if (sid != null && origem === 'sirene') {
      const { error: delSc } = await admin.from('sirene_chamados').delete().eq('id', sid);
      if (delSc) {
        console.error('[sirene] deletarChamado: falha ao deletar sirene_chamados via interacao', delSc);
        return { ok: false, error: delSc.message };
      }
      revalidatePath('/sirene');
      revalidatePath('/sirene/chamados');
      revalidatePath('/sirene/kanban');
      revalidatePath(`/sirene/${sid}`);
    }

    const bp = input.basePath?.trim() || '/';
    revalidatePath(bp);
    revalidatePath('/');
    return { ok: true };
  } catch (e) {
    console.error('[sirene] deletarChamado: exceção', e);
    return { ok: false, error: String(e) };
  }
}

export async function arquivarChamado(
  chamadoId: number,
  motivo: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Não autenticado.' };

    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const role = String((prof as { role?: string | null } | null)?.role ?? '').toLowerCase();
    if (role !== 'admin' && role !== 'team') {
      return { ok: false, error: 'Apenas administradores ou equipe podem arquivar chamados.' };
    }

    const motivoTrim = motivo.trim();
    if (!motivoTrim) return { ok: false, error: 'Informe o motivo do arquivamento.' };

    const admin = createAdminClient();
    const agora = new Date().toISOString();
    const { error } = await admin
      .from('sirene_chamados')
      .update({
        arquivado: true,
        arquivado_em: agora,
        arquivado_por: user.id,
        motivo_arquivamento_sirene: motivoTrim,
        status: 'concluido',
        updated_at: agora,
      })
      .eq('id', chamadoId);

    if (error) return { ok: false, error: error.message };

    await admin
      .from('kanban_atividades')
      .update({ status: 'concluida', updated_at: agora })
      .eq('sirene_chamado_id', chamadoId)
      .eq('origem', 'sirene');

    revalidatePath('/sirene');
    revalidatePath('/sirene/chamados');
    revalidatePath('/sirene/kanban');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function arquivarTopico(
  topicoId: number,
  motivo: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Não autenticado.' };
    const { error } = await admin
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
    revalidatePath('/sirene');
    revalidatePath('/sirene/chamados');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

const HDM_TIMES: HdmTime[] = [...TIMES_MONI_HDM];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseDataVencimentoChamado(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim();
  if (!t) return null;
  const head = t.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

/** Dados do layout Sirene: nome do usuário e se é Bombeiro (para mostrar aba Monitor). */
export async function getSireneLayoutContext(): Promise<
  | { ok: true; userName: string; isBombeiro: boolean }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    if (isAppFullyPublic()) {
      return { ok: true, userName: 'Visitante', isBombeiro: false };
    }
    return { ok: false, error: 'Faça login.' };
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();
  const userName = (profile?.full_name as string)?.trim() || user.email?.split('@')[0] || 'Usuário';
  const { data: papelRow } = await supabase
    .from('sirene_papeis')
    .select('papel')
    .eq('user_id', user.id)
    .maybeSingle();
  const isBombeiro = papelRow?.papel === 'bombeiro';
  return { ok: true, userName, isBombeiro };
}

/** Dados para o modal de novo chamado: se é frank e lista de franqueados (times vêm do catálogo fixo no cliente). */
export async function getDadosNovoChamado(): Promise<
  | { ok: true; isFrank: boolean; franqueados: { id: string; n_franquia: string | null; nome_completo: string | null }[] }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = (profile?.role as string) ?? 'franqueado';
  const isFrank = role === 'franqueado' || role === 'frank';

  let franqueados: { id: string; n_franquia: string | null; nome_completo: string | null }[] = [];
  if (!isFrank) {
    const { data: rows } = await supabase
      .from('rede_franqueados')
      .select('id, n_franquia, nome_completo')
      .order('nome_completo', { ascending: true, nullsFirst: false });
    franqueados = (rows ?? []).map((r) => ({
      id: r.id,
      n_franquia: r.n_franquia ?? null,
      nome_completo: r.nome_completo ?? null,
    }));
  }

  return { ok: true, isFrank, franqueados };
}

/** Lista de times para vincular a tópicos (mesma lista do modal de abertura). */
export async function getTimesParaTopicos(): Promise<
  | { ok: true; times: string[] }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  return { ok: true, times: [...TIMES_MONI] };
}

export type TopicoPainelLinha = {
  id: number;
  ordem: number;
  nome: string;
  descricao: string;
  descricao_detalhe: string | null;
  time_responsavel: string;
  tipo: SubInteracaoTipoDb;
  times_ids: string[];
  responsaveis_ids: string[];
  data_inicio: string | null;
  data_fim: string | null;
  trava: boolean;
  pastel: boolean;
  historico: Array<{ tipo: string; em: string; por?: string | null }>;
  status: string;
  resolucao_time: string | null;
  motivo_reprovacao: string | null;
  prazo_proposto?: string | null;
  prazo_status?: string | null;
  prazo_abridor_id?: string | null;
  prazo_proposto_por?: string | null;
  prazo_negociacao_expira_em?: string | null;
};

type GetTopicosPainelResult =
  | { ok: true; topicos: TopicoPainelLinha[] }
  | { ok: false; error: string };

const TOPICOS_PAINEL_SELECT =
  'id, ordem, nome, descricao, descricao_detalhe, time_responsavel, tipo, times_ids, responsaveis_ids, data_inicio, data_fim, status, trava, pastel, historico, resolucao_time, motivo_reprovacao, prazo_proposto, prazo_status, prazo_abridor_id, prazo_proposto_por, prazo_negociacao_expira_em';

function mapRowsToTopicosPainel(rows: Record<string, unknown>[]): TopicoPainelLinha[] {
  return rows.map((r) => {
    const rawTi = (r as { times_ids?: unknown }).times_ids;
    const ti = Array.isArray(rawTi) ? rawTi.map((x) => String(x)) : [];
    const rawRi = (r as { responsaveis_ids?: unknown }).responsaveis_ids;
    const ri = Array.isArray(rawRi) ? rawRi.map((x) => String(x)) : [];
    const tipoRaw = String((r as { tipo?: string }).tipo ?? 'atividade');
    const tipo: SubInteracaoTipoDb =
      tipoRaw === 'duvida' || tipoRaw === 'chamado' || tipoRaw === 'proposicoes' ? (tipoRaw as SubInteracaoTipoDb) : 'atividade';
    const di = (r as { data_inicio?: unknown }).data_inicio;
    const df = (r as { data_fim?: unknown }).data_fim;
    const rt = (r as { resolucao_time?: unknown }).resolucao_time;
    const mr = (r as { motivo_reprovacao?: unknown }).motivo_reprovacao;
    const nomeRaw = String((r as { nome?: string }).nome ?? '').trim();
    const descRaw = String((r as { descricao?: string }).descricao ?? '').trim();
    const hist = (r as { historico?: unknown }).historico;
    const historico = Array.isArray(hist)
      ? (hist as Array<{ tipo: string; em: string; por?: string | null }>)
      : [];
    return {
      id: r.id as number,
      ordem: r.ordem as number,
      nome: nomeRaw || descRaw || 'Atividade',
      descricao: descRaw || nomeRaw || 'Atividade',
      descricao_detalhe: (r as { descricao_detalhe?: string | null }).descricao_detalhe ?? null,
      time_responsavel: r.time_responsavel as string,
      tipo,
      times_ids: ti,
      responsaveis_ids: ri,
      data_inicio: di != null && typeof di === 'string' ? di : null,
      data_fim: df != null && typeof df === 'string' ? df : null,
      trava: (r as { trava?: boolean }).trava ?? false,
      pastel: Boolean((r as { pastel?: boolean }).pastel),
      historico,
      status: r.status as string,
      resolucao_time: rt != null && typeof rt === 'string' ? rt : null,
      motivo_reprovacao: mr != null && typeof mr === 'string' ? mr : null,
      prazo_proposto:
        (r as { prazo_proposto?: unknown }).prazo_proposto != null
          ? String((r as { prazo_proposto?: unknown }).prazo_proposto)
          : null,
      prazo_status:
        (r as { prazo_status?: unknown }).prazo_status != null
          ? String((r as { prazo_status?: unknown }).prazo_status)
          : null,
      prazo_abridor_id:
        (r as { prazo_abridor_id?: unknown }).prazo_abridor_id != null
          ? String((r as { prazo_abridor_id?: unknown }).prazo_abridor_id)
          : null,
      prazo_proposto_por:
        (r as { prazo_proposto_por?: unknown }).prazo_proposto_por != null
          ? String((r as { prazo_proposto_por?: unknown }).prazo_proposto_por)
          : null,
      prazo_negociacao_expira_em:
        (r as { prazo_negociacao_expira_em?: unknown }).prazo_negociacao_expira_em != null
          ? String((r as { prazo_negociacao_expira_em?: unknown }).prazo_negociacao_expira_em)
          : null,
    };
  });
}

/** Tópicos do chamado (para listar e exibir ações Concluir / Aprovar / Reprovar). */
export async function getTopicosChamado(chamadoId: number): Promise<GetTopicosPainelResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: direct, error: directErr } = await supabase
    .from('sirene_topicos')
    .select(TOPICOS_PAINEL_SELECT)
    .eq('chamado_id', chamadoId)
    .eq('arquivado', false)
    .order('ordem', { ascending: true });

  if (directErr) return { ok: false, error: directErr.message };
  if ((direct ?? []).length > 0) {
    return { ok: true, topicos: mapRowsToTopicosPainel((direct ?? []) as Record<string, unknown>[]) };
  }

  const { data: interacoes } = await supabase
    .from('kanban_atividades')
    .select('id')
    .eq('sirene_chamado_id', chamadoId);
  const interacaoIds = (interacoes ?? []).map((r) => String((r as { id: string }).id));
  if (interacaoIds.length === 0) return { ok: true, topicos: [] };

  const { data, error } = await supabase
    .from('sirene_topicos')
    .select(TOPICOS_PAINEL_SELECT)
    .in('interacao_id', interacaoIds)
    .eq('arquivado', false)
    .order('ordem', { ascending: true });

  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as Record<string, unknown>[];
  return { ok: true, topicos: mapRowsToTopicosPainel(rows) };
}

/** Tópicos só de card (kanban_atividades), sem `sirene_chamados`. */
export async function getTopicosPorInteracaoId(interacaoId: string): Promise<GetTopicosPainelResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data, error } = await supabase
    .from('sirene_topicos')
    .select(TOPICOS_PAINEL_SELECT)
    .eq('interacao_id', interacaoId)
    .eq('arquivado', false)
    .order('ordem', { ascending: true });

  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as Record<string, unknown>[];
  return { ok: true, topicos: mapRowsToTopicosPainel(rows) };
}

export type TopicoInput = {
  descricao: string;
  time_responsavel: string;
  data_inicio?: string;
  data_fim?: string;
  trava?: boolean;
};

/** Salvar resolução em tópicos: cria/atualiza tópicos, marca início do atendimento e status em andamento. */
export async function salvarResolucaoComTopicos(
  chamadoId: number,
  topicos: TopicoInput[],
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', chamadoId)
    .single();
  if (!chamado || !canActAsBombeiro(me.ctx, chamado as unknown as Chamado))
    return { ok: false, error: 'Sem permissão para salvar tópicos.' };

  const validos = topicos.filter((t) => (t.descricao?.trim() ?? '') !== '' && (t.time_responsavel?.trim() ?? '') !== '');
  if (validos.length === 0) return { ok: false, error: 'Adicione ao menos um tópico com descrição e time.' };

  const { error: delErr } = await supabase.from('sirene_topicos').delete().eq('chamado_id', chamadoId);
  if (delErr) return { ok: false, error: delErr.message };

  for (let i = 0; i < validos.length; i++) {
    const t = validos[i];
    const dataInicio = t.data_inicio?.trim() || null;
    const dataFim = t.data_fim?.trim() || null;
    const { error: insErr } = await supabase.from('sirene_topicos').insert({
      chamado_id: chamadoId,
      ordem: i + 1,
      descricao: t.descricao.trim(),
      time_responsavel: t.time_responsavel.trim(),
      data_inicio: dataInicio || null,
      data_fim: dataFim || null,
      trava: t.trava ?? false,
      status: 'nao_iniciado',
      tipo: 'atividade',
    });
    if (insErr) return { ok: false, error: insErr.message };
  }

  const { error: updErr } = await supabase
    .from('sirene_chamados')
    .update({
      status: 'em_andamento',
      updated_at: new Date().toISOString(),
    })
    .eq('id', chamadoId);
  if (updErr) return { ok: false, error: updErr.message };

  const adminSync = createAdminClient();
  const syncPastel = await syncPastelariaColunaFromSireneStatus(adminSync, chamadoId, 'em_andamento');
  if (!syncPastel.ok) console.error('[salvarResolucaoComTopicos] sync pastelaria', syncPastel.error);

  revalidatePath('/sirene');
  revalidatePath(`/sirene/${chamadoId}`);
  revalidatePath('/carometro/pastelaria');
  return { ok: true };
}

async function getSireneUserContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ userId: string; userName: string; ctx: SireneUserContext; role: string | null; cargo: string | null } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [papelRes, profileRes] = await Promise.all([
    supabase.from('sirene_papeis').select('papel').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('full_name, time, role, cargo').eq('id', user.id).single(),
  ]);

  const papel = (papelRes.data?.papel as 'bombeiro' | 'caneta_verde') ?? null;
  const time = (profileRes.data?.time as string) ?? null;
  const role = (profileRes.data?.role as string) ?? null;
  const cargoRaw = (profileRes.data as { cargo?: string | null } | null)?.cargo;
  const cargo = cargoRaw != null && String(cargoRaw).trim() !== '' ? String(cargoRaw).trim() : null;

  return {
    userId: user.id,
    userName: (profileRes.data?.full_name as string)?.trim() || user.email || 'Usuário',
    ctx: { papel, time },
    role,
    cargo,
  };
}

/** Retorna IDs de usuários a notificar: bombeiros ou time HDM. */
async function getUserIdsToNotify(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tipo: 'bombeiro' | 'hdm',
  hdmTime?: HdmTime,
): Promise<string[]> {
  if (tipo === 'bombeiro') {
    const { data } = await supabase.from('sirene_papeis').select('user_id').eq('papel', 'bombeiro');
    return (data ?? []).map((r) => r.user_id);
  }
  if (tipo === 'hdm' && hdmTime) {
    const { data } = await supabase.from('profiles').select('id').eq('time', hdmTime);
    return (data ?? []).map((r) => r.id);
  }
  return [];
}

/** Corpo estruturado opcional (ex.: mencao_comentario). `texto` permanece preenchido para compatibilidade. */
type AvisoNotificacaoEstruturado = {
  titulo: string;
  mensagem: string;
  referencia_id: number;
};

/** Insere uma notificação para um usuário. */
async function inserirNotificacao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  chamadoId: number | null,
  tipo: string,
  texto: string,
  topicoId?: number | null,
  aviso?: AvisoNotificacaoEstruturado,
): Promise<void> {
  const corpo = aviso?.mensagem ?? texto;
  await supabase.from('sirene_notificacoes').insert({
    user_id: userId,
    chamado_id: chamadoId,
    tipo,
    texto: corpo,
    ...(topicoId != null && { topico_id: topicoId }),
    ...(aviso && {
      titulo: aviso.titulo,
      mensagem: aviso.mensagem,
      referencia_id: aviso.referencia_id,
    }),
  });
}

/** IDs do time responsável por um tópico (responsavel_id ou profiles com time = time_responsavel). */
async function getUserIdsTimeTopico(
  supabase: Awaited<ReturnType<typeof createClient>>,
  timeResponsavel: string,
  responsavelId: string | null,
): Promise<string[]> {
  if (responsavelId) return [responsavelId];
  const { data } = await supabase.from('profiles').select('id').eq('time', timeResponsavel);
  return (data ?? []).map((r) => r.id);
}

/** Todos os usuários do time (para notificações de atraso: sinalizar o time inteiro). */
async function getUserIdsTimeTopicoTodos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  timeResponsavel: string,
  responsavelId: string | null,
): Promise<string[]> {
  const { data } = await supabase.from('profiles').select('id').eq('time', timeResponsavel);
  const ids = new Set<string>((data ?? []).map((r) => r.id));
  if (responsavelId) ids.add(responsavelId);
  return [...ids];
}

/** Dias úteis entre data (YYYY-MM-DD) e hoje (inclusive). */
function diasUteisAtraso(dataFimStr: string): number {
  const dataFim = new Date(dataFimStr + 'T12:00:00Z');
  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);
  if (dataFim >= hoje) return 0;
  let count = 0;
  const d = new Date(dataFim);
  d.setHours(0, 0, 0, 0);
  const end = new Date(hoje);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Tópicos atrasados (não concluídos, data_fim no passado) com dias úteis de atraso. Ordenados pelos mais atrasados (TOP 10 primeiro). */
async function getTopicosAtrasados(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<
  Array<{
    id: number;
    chamado_id: number;
    numero: number;
    descricao: string;
    time_responsavel: string;
    responsavel_id: string | null;
    data_fim: string;
    dias_atraso: number;
  }>
> {
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: topicos, error } = await supabase
    .from('sirene_topicos')
    .select('id, chamado_id, descricao, time_responsavel, responsavel_id, data_fim')
    .in('status', ['nao_iniciado', 'em_andamento'])
    .not('data_fim', 'is', null)
    .lt('data_fim', hoje);

  if (error || !topicos?.length) return [];

  const chamadoIds = [...new Set(topicos.map((t) => t.chamado_id))];
  const { data: chamados } = await supabase
    .from('sirene_chamados')
    .select('id, numero')
    .in('id', chamadoIds);
  const numeroByChamado = new Map(
    (chamados ?? []).map((c) => [c.id, (c as { numero?: number }).numero ?? c.id]),
  );

  return topicos
    .map((t) => {
      const dataFim = (t.data_fim as string) ?? '';
      const dias_atraso = diasUteisAtraso(dataFim);
      return {
        id: t.id,
        chamado_id: t.chamado_id,
        numero: numeroByChamado.get(t.chamado_id) ?? t.chamado_id,
        descricao: t.descricao ?? '',
        time_responsavel: t.time_responsavel ?? '',
        responsavel_id: t.responsavel_id ?? null,
        data_fim: dataFim,
        dias_atraso,
      };
    })
    .sort((a, b) => a.data_fim.localeCompare(b.data_fim)); // mais antigo = mais atrasado primeiro
}

/** Verifica se já enviamos notificação (user, topico, tipo) nas últimas 24h. */
async function notificacaoAtrasoJaEnviada(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  topicoId: number,
  tipo: string,
): Promise<boolean> {
  const desde = new Date();
  desde.setHours(desde.getHours() - 24);
  const { data } = await supabase
    .from('sirene_notificacoes')
    .select('id')
    .eq('user_id', userId)
    .eq('topico_id', topicoId)
    .eq('tipo', tipo)
    .gte('created_at', desde.toISOString())
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Sinaliza aos times: tarefas > 2 dias úteis atrasadas e TOP 10 mais atrasadas. Evita duplicata nas últimas 24h. */
export async function enviarNotificacoesAtrasoTopicos(): Promise<SireneActionResult> {
  const supabase = await createClient();
  const lista = await getTopicosAtrasados(supabase);
  if (lista.length === 0) return { ok: true };

  const top10Ids = new Set(lista.slice(0, 10).map((t) => t.id));

  for (const t of lista) {
    const userIds = await getUserIdsTimeTopicoTodos(
      supabase,
      t.time_responsavel,
      t.responsavel_id,
    );
    if (userIds.length === 0) continue;

    const textoBase = `Chamado #${t.numero}: ${t.descricao.slice(0, 60)}${t.descricao.length > 60 ? '…' : ''}`;

    if (t.dias_atraso > 2) {
      const tipo = 'atraso_2d';
      const texto = `Tarefa com mais de 2 dias úteis de atraso — ${textoBase}`;
      for (const uid of userIds) {
        const ja = await notificacaoAtrasoJaEnviada(supabase, uid, t.id, tipo);
        if (!ja) {
          await inserirNotificacao(supabase, uid, t.chamado_id, tipo, texto, t.id);
        }
      }
    }

    if (top10Ids.has(t.id)) {
      const tipo = 'atraso_top10';
      const texto = `Tarefa entre as TOP 10 mais atrasadas — ${textoBase}`;
      for (const uid of userIds) {
        const ja = await notificacaoAtrasoJaEnviada(supabase, uid, t.id, tipo);
        if (!ja) {
          await inserirNotificacao(supabase, uid, t.chamado_id, tipo, texto, t.id);
        }
      }
    }
  }

  revalidatePath('/sirene');
  revalidatePath('/sirene/chamados');
  revalidatePath('/sirene/kanban');
  return { ok: true };
}

/** Criar chamado. Se tipo === 'hdm', notifica o time HDM em vez do Bombeiro. */
export async function criarChamado(
  formData: FormData,
): Promise<SireneActionResult & { chamadoId?: number }> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const incendio = (formData.get('incendio') as string)?.trim();
  const timeAbertura = (formData.get('time_abertura') as string)?.trim() || null;
  const aberturaResponsavelNome =
    (formData.get('abertura_responsavel_nome') as string)?.trim() || null;
  const frankId = (formData.get('frank_id') as string)?.trim() || null;
  const frankNome = (formData.get('frank_nome') as string)?.trim() || null;
  const cardIdRaw = (formData.get('card_id') as string)?.trim() || null;
  const cardKanbanNome = (formData.get('card_kanban_nome') as string)?.trim() || null;
  const cardTitulo = (formData.get('card_titulo') as string)?.trim() || null;
  const dataVencimento = parseDataVencimentoChamado(formData.get('data_vencimento') as string | null);
  const teTrataRaw = formData.get('te_trata');
  const teTrata =
    teTrataRaw === 'sim' ? true : teTrataRaw === 'nao' ? false : null;
  const tema = (formData.get('tema') as string)?.trim() || null;

  if (!incendio) return { ok: false, error: 'Informe o incêndio (resumo).' };
  if (!timeAbertura || !aberturaResponsavelNome) {
    return { ok: false, error: 'Informe o time e o responsável antes de abrir o chamado.' };
  }

  const admin = createAdminClient();
  const nomesPorTimesIds: string[] = [];
  const timesIdsRaw = (formData.get('times_ids') as string) || '';
  try {
    const parsed = JSON.parse(timesIdsRaw) as unknown;
    if (Array.isArray(parsed)) {
      for (const rawId of parsed) {
        const id = String(rawId ?? '').trim();
        if (!id) continue;
        const { data: trow } = await admin.from('kanban_times').select('nome').eq('id', id).maybeSingle();
        const n = (trow as { nome?: string } | null)?.nome;
        if (n) nomesPorTimesIds.push(String(n).trim());
      }
    }
  } catch {
    /* ignore JSON inválido */
  }
  const timeAbTrim = (timeAbertura ?? '').trim();
  const nomesParaInferencia =
    nomesPorTimesIds.length > 0 ? nomesPorTimesIds : timeAbTrim ? [timeAbTrim] : [];
  const inferredHdm = inferirHdmResponsavelPorNomesTimes(nomesParaInferencia);
  const tipo: 'padrao' | 'hdm' = inferredHdm ? 'hdm' : 'padrao';
  const hdmResponsavel: HdmTime | null = inferredHdm;

  if (tipo === 'hdm' && hdmResponsavel && !HDM_TIMES.includes(hdmResponsavel))
    return { ok: false, error: 'Time HDM inválido.' };

  const vTimeAb = validarTimeMoniOpcional(timeAbertura);
  if (!vTimeAb.ok) return { ok: false, error: vTimeAb.error };
  const vRespAb = validarParTimeResponsavelMoni(timeAbertura, aberturaResponsavelNome);
  if (!vRespAb.ok) return { ok: false, error: vRespAb.error };

  const roleNorm = (me.role ?? '').toLowerCase();
  const visivelFrank = roleNorm === 'frank' || roleNorm === 'franqueado';

  const cardId = cardIdRaw && UUID_RE.test(cardIdRaw) ? cardIdRaw : null;

  const { data: chamado, error } = await supabase
    .from('sirene_chamados')
    .insert({
      aberto_por: me.userId,
      aberto_por_nome: me.userName,
      incendio,
      time_abertura: timeAbertura,
      abertura_responsavel_nome: aberturaResponsavelNome,
      frank_id: frankId,
      frank_nome: frankNome,
      te_trata: teTrata,
      trava: teTrata === true,
      tipo,
      hdm_responsavel: hdmResponsavel,
      visivel_frank: visivelFrank,
      ...(cardId
        ? {
            card_id: cardId,
            card_kanban_nome: cardKanbanNome || null,
            card_titulo: cardTitulo || null,
          }
        : {}),
      ...(dataVencimento ? { data_vencimento: dataVencimento } : {}),
      tema,
    })
    .select('id, numero, created_at')
    .single();

  if (error) return { ok: false, error: error.message };

  const chamadoRow = chamado as { id: number; numero?: number; created_at?: string };
  const timeNome = timeAbertura?.trim() || null;
  let timesIdsKa: string[] = [];
  let timeCol: string | null = null;
  if (timeNome) {
    const { data: trow } = await admin.from('kanban_times').select('id').eq('nome', timeNome).maybeSingle();
    if (trow && (trow as { id?: string }).id) {
      timesIdsKa = [String((trow as { id: string }).id)];
      timeCol = timeNome;
    }
  }
  const tipoKa = tipo === 'hdm' ? 'chamado_hdm' : 'chamado_padrao';
  const createdAtSc = chamadoRow.created_at ?? new Date().toISOString();
  const { error: kaErr } = await admin.from('kanban_atividades').insert({
    card_id: cardId,
    titulo: incendio,
    descricao: null,
    tipo: tipoKa,
    status: 'pendente',
    trava: false,
    origem: 'sirene',
    criado_por: me.userId,
    created_at: createdAtSc,
    updated_at: new Date().toISOString(),
    data_vencimento: dataVencimento,
    times_ids: timesIdsKa,
    time: timeCol,
    responsavel_nome_texto: aberturaResponsavelNome,
    sirene_chamado_id: chamadoRow.id,
    tema,
  });
  if (kaErr) {
    await admin.from('sirene_chamados').delete().eq('id', chamadoRow.id);
    return { ok: false, error: kaErr.message };
  }

  const pastelResult = await criarPastelariaInboxParaChamadoSirene(admin, {
    chamadoId: chamadoRow.id,
    incendio,
    timeAbertura,
    aberturaResponsavelNome,
    criadoPorUserId: me.userId,
  });
  if (!pastelResult.ok && 'error' in pastelResult && pastelResult.error) {
    console.error('[criarChamado] pastelaria:', pastelResult.error);
  }

  const numero = chamadoRow.numero ?? chamadoRow.id;
  const userIds =
    tipo === 'hdm' && hdmResponsavel
      ? await getUserIdsToNotify(supabase, 'hdm', hdmResponsavel)
      : await getUserIdsToNotify(supabase, 'bombeiro');
  const notifTipo =
    tipo === 'hdm' && hdmResponsavel ? 'chamado_hdm_recebido' : 'novo_chamado';
  const texto =
    tipo === 'hdm' && hdmResponsavel
      ? `Chamado #${numero} direcionado ao time ${hdmResponsavel}`
      : `Novo chamado #${numero}: ${incendio}`;

  for (const uid of userIds) {
    await supabase.from('sirene_notificacoes').insert({
      user_id: uid,
      chamado_id: chamadoRow.id,
      tipo: notifTipo,
      texto,
    });
  }

  revalidatePath('/sirene');
  revalidatePath('/sirene/chamados');
  revalidatePath('/carometro/pastelaria');
  return { ok: true, chamadoId: chamado.id };
}

export type SireneVinculoCardBuscaItem = {
  card_id: string;
  titulo: string;
  kanban_nome: string;
  origem: 'nativo' | 'legado';
};

/** Autocomplete: cards nativos + legado (view) por título — para vínculo opcional no novo chamado. */
export async function buscarCardsParaNovoChamadoSirene(
  busca: string,
): Promise<{ ok: true; items: SireneVinculoCardBuscaItem[] } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const q = busca.trim();
  if (q.length < 2) return { ok: true, items: [] };

  const admin = createAdminClient();
  const pattern = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
  const out: SireneVinculoCardBuscaItem[] = [];
  const seen = new Set<string>();

  const { data: nativeCards, error: nErr } = await admin
    .from('kanban_cards')
    .select('id, titulo, kanban_id')
    .ilike('titulo', pattern)
    .limit(18);
  if (nErr) return { ok: false, error: nErr.message };

  const kidSet = new Set<string>();
  for (const r of nativeCards ?? []) {
    const kid = String((r as { kanban_id?: string }).kanban_id ?? '');
    if (kid) kidSet.add(kid);
  }
  let kbNomeById = new Map<string, string>();
  if (kidSet.size > 0) {
    const { data: kbs } = await admin.from('kanbans').select('id, nome').in('id', [...kidSet]);
    kbNomeById = new Map(
      (kbs ?? []).map((k) => [String((k as { id: string }).id), String((k as { nome?: string }).nome ?? '')]),
    );
  }
  for (const r of nativeCards ?? []) {
    const id = String((r as { id: string }).id);
    const key = `n:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const kid = String((r as { kanban_id?: string }).kanban_id ?? '');
    out.push({
      card_id: id,
      titulo: String((r as { titulo?: string | null }).titulo ?? 'Sem título'),
      kanban_nome: kbNomeById.get(kid) || '—',
      origem: 'nativo',
    });
  }

  const { data: legRows, error: lErr } = await admin
    .from('v_processo_como_kanban_cards')
    .select('id, titulo, kanban_id')
    .ilike('titulo', pattern)
    .limit(12);
  if (lErr) return { ok: false, error: lErr.message };

  const kidSet2 = new Set<string>();
  for (const r of legRows ?? []) {
    const kid = String((r as { kanban_id?: string }).kanban_id ?? '');
    if (kid) kidSet2.add(kid);
  }
  let kbNome2 = new Map<string, string>();
  if (kidSet2.size > 0) {
    const { data: kbs2 } = await admin.from('kanbans').select('id, nome').in('id', [...kidSet2]);
    kbNome2 = new Map(
      (kbs2 ?? []).map((k) => [String((k as { id: string }).id), String((k as { nome?: string }).nome ?? '')]),
    );
  }
  for (const r of legRows ?? []) {
    const id = String((r as { id: string }).id);
    const key = `l:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const kid = String((r as { kanban_id?: string }).kanban_id ?? '');
    out.push({
      card_id: id,
      titulo: String((r as { titulo?: string | null }).titulo ?? 'Sem título'),
      kanban_nome: kbNome2.get(kid) || 'Funil Step One',
      origem: 'legado',
    });
  }

  return { ok: true, items: out.slice(0, 24) };
}

/** Redirecionar chamado para HDM. Apenas Bombeiro. */
export async function redirecionarParaHDM(
  chamadoId: number,
  hdmResponsavel: HdmTime,
  observacao?: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamado, error: fetchErr } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', chamadoId)
    .single();

  if (fetchErr || !chamado) return { ok: false, error: 'Chamado não encontrado.' };

  const ctx: SireneUserContext = me.ctx;
  const chamadoTyped = chamado as unknown as Chamado;
  if (!canActAsBombeiro(ctx, chamadoTyped))
    return { ok: false, error: 'Apenas o Bombeiro pode redirecionar para HDM.' };

  if (chamado.tipo === 'hdm') return { ok: false, error: 'Chamado já está em HDM.' };

  if (!HDM_TIMES.includes(hdmResponsavel)) return { ok: false, error: 'Time HDM inválido.' };

  const { error: updateErr } = await supabase
    .from('sirene_chamados')
    .update({
      tipo: 'hdm',
      hdm_responsavel: hdmResponsavel,
      hdm_redirecionado_por: me.userId,
      hdm_redirecionado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', chamadoId);

  if (updateErr) return { ok: false, error: updateErr.message };

  if (observacao?.trim()) {
    await supabase.from('sirene_mensagens').insert({
      chamado_id: chamadoId,
      autor_id: me.userId,
      autor_nome: me.userName,
      autor_time: me.ctx.time ?? undefined,
      texto: `[Redirecionamento HDM — ${hdmResponsavel}] ${observacao.trim()}`,
    });
  }

  const userIds = await getUserIdsToNotify(supabase, 'hdm', hdmResponsavel);
  const numero = chamado.numero ?? chamadoId;
  const texto = `Chamado #${numero} redirecionado para ${hdmResponsavel}.`;
  for (const uid of userIds) {
    await supabase.from('sirene_notificacoes').insert({
      user_id: uid,
      chamado_id: chamadoId,
      tipo: 'chamado_hdm_recebido',
      texto,
    });
  }

  revalidatePath('/sirene');
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/** Definir prioridade. Quem pode: Bombeiro ou time HDM responsável (canActAsBombeiro). */
export async function definirPrioridade(
  chamadoId: number,
  prioridade: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', chamadoId)
    .single();
  if (!chamado || !canActAsBombeiro(me.ctx, chamado as unknown as Chamado))
    return { ok: false, error: 'Sem permissão para alterar prioridade.' };

  const { error } = await supabase
    .from('sirene_chamados')
    .update({
      prioridade: prioridade?.trim() || 'Média',
      updated_at: new Date().toISOString(),
    })
    .eq('id', chamadoId);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/sirene');
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/**
 * Permite editar tema (título) e incêndio (resumo) de um sirene_chamado.
 * Só o criador (aberto_por) ou Bombeiro (papel em sirene_papeis) pode editar.
 */
export async function editarChamado(
  chamadoId: number,
  incendio: string,
  tema: string | null,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: row } = await supabase
    .from('sirene_chamados')
    .select('id, aberto_por')
    .eq('id', chamadoId)
    .single();
  if (!row) return { ok: false, error: 'Chamado não encontrado.' };

  const isCriador = row.aberto_por != null && row.aberto_por === me.userId;
  const isBombeiro = me.ctx.papel === 'bombeiro';
  if (!isCriador && !isBombeiro) {
    return { ok: false, error: 'Apenas o criador do chamado ou o Bombeiro pode editar o resumo e o tema.' };
  }

  const incendioTrim = incendio?.trim() ?? '';
  if (!incendioTrim) return { ok: false, error: 'O resumo (incêndio) é obrigatório.' };
  const temaTrim = tema?.trim() || null;

  const { error } = await supabase
    .from('sirene_chamados')
    .update({
      incendio: incendioTrim,
      tema: temaTrim,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chamadoId);

  if (error) return { ok: false, error: error.message };

  const admin = createAdminClient();
  await admin
    .from('kanban_atividades')
    .update({ titulo: incendioTrim, updated_at: new Date().toISOString() })
    .eq('sirene_chamado_id', chamadoId);

  revalidatePath('/sirene');
  revalidatePath('/sirene/chamados');
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

export type AtualizarChamadoPainelInput = {
  incendio: string;
  time_abertura: string | null;
  abertura_responsavel_nome: string | null;
  data_vencimento: string | null;
  trava: boolean;
  tipo: 'padrao' | 'hdm';
  hdm_responsavel: HdmTime | null;
  times_ids?: string[];
  responsaveis_ids?: string[];
};

/** Edição inline na lista unificada: atualiza sirene_chamados e espelho em kanban_atividades. */
export async function atualizarChamadoPainelUnificado(
  chamadoId: number,
  dados: AtualizarChamadoPainelInput,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamadoFull } = await supabase.from('sirene_chamados').select('*').eq('id', chamadoId).single();
  if (!chamadoFull) return { ok: false, error: 'Chamado não encontrado.' };

  const isCriador =
    (chamadoFull as { aberto_por?: string | null }).aberto_por != null &&
    (chamadoFull as { aberto_por: string }).aberto_por === me.userId;
  const isBombeiro = me.ctx.papel === 'bombeiro';
  const podeBombeiroOuHdm = canActAsBombeiro(me.ctx, chamadoFull as unknown as Chamado);
  if (!isCriador && !isBombeiro && !podeBombeiroOuHdm) {
    return { ok: false, error: 'Sem permissão para editar este chamado.' };
  }

  const incendioTrim = dados.incendio?.trim() ?? '';
  if (!incendioTrim) return { ok: false, error: 'O resumo (incêndio) é obrigatório.' };

  const timeAb = (dados.time_abertura ?? '').trim() || null;
  const inferredHdm = inferirHdmResponsavelPorNomesTimes(timeAb ? [timeAb] : []);
  const tipo = inferredHdm ? 'hdm' : 'padrao';
  const hdmRaw = inferredHdm;
  if (tipo === 'hdm' && hdmRaw && !HDM_TIMES.includes(hdmRaw)) return { ok: false, error: 'Time HDM inválido.' };
  const respAb = (dados.abertura_responsavel_nome ?? '').trim() || null;
  const vTime = validarTimeMoniOpcional(timeAb);
  if (!vTime.ok) return { ok: false, error: vTime.error };
  const vPar = validarParTimeResponsavelMoni(timeAb, respAb);
  if (!vPar.ok) return { ok: false, error: vPar.error };

  const dataVen = parseDataVencimentoChamado(dados.data_vencimento);

  const { error: scErr } = await supabase
    .from('sirene_chamados')
    .update({
      incendio: incendioTrim,
      time_abertura: timeAb,
      abertura_responsavel_nome: respAb,
      data_vencimento: dataVen,
      trava: Boolean(dados.trava),
      tipo,
      hdm_responsavel: tipo === 'hdm' ? hdmRaw : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chamadoId);
  if (scErr) return { ok: false, error: scErr.message };

  const admin = createAdminClient();
  let timesIdsKa: string[] = dados.times_ids ?? [];
  let timeCol: string | null = null;
  if (timesIdsKa.length === 0 && timeAb) {
    const { data: trow } = await admin.from('kanban_times').select('id').eq('nome', timeAb).maybeSingle();
    if (trow && (trow as { id?: string }).id) {
      timesIdsKa = [String((trow as { id: string }).id)];
      timeCol = timeAb;
    }
  } else if (timesIdsKa.length > 0) {
    const { data: trow } = await admin.from('kanban_times').select('nome').eq('id', timesIdsKa[0]!).maybeSingle();
    timeCol = String((trow as { nome?: string } | null)?.nome ?? '').trim() || null;
  }
  const respIdsKa: string[] = dados.responsaveis_ids ?? [];
  const tipoKa = tipo === 'hdm' ? 'chamado_hdm' : 'chamado_padrao';
  const { error: kaErr } = await admin
    .from('kanban_atividades')
    .update({
      titulo: incendioTrim,
      tipo: tipoKa,
      data_vencimento: dataVen,
      trava: Boolean(dados.trava),
      times_ids: timesIdsKa,
      time: timeCol,
      responsavel_nome_texto: respAb,
      ...(respIdsKa.length > 0 ? { responsaveis_ids: respIdsKa } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('sirene_chamado_id', chamadoId);
  if (kaErr) return { ok: false, error: kaErr.message };

  revalidatePath('/sirene');
  revalidatePath('/sirene/chamados');
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

export type AdicionarTopicoChamadoPainelInput = {
  descricao: string;
  tipo: SubInteracaoTipoDb;
  times_ids: string[];
  responsaveis_ids: string[];
  data_fim: string | null;
  trava: boolean;
  tema?: string | null;
};

function uniqUuidStrings(ids: string[] | undefined | null): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of ids) {
    const u = String(x ?? '').trim();
    if (!u || !UUID_RE.test(u) || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

export async function adicionarTopicoChamadoPainel(
  chamadoId: number,
  payload: AdicionarTopicoChamadoPainelInput,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { plain, mencoesIds } = await resolverMencoesSirene(payload.descricao ?? '');
  const desc = plain.trim();
  if (!desc) return { ok: false, error: 'Informe a descrição do sub-chamado.' };

  const tipo =
    payload.tipo === 'duvida' || payload.tipo === 'chamado' || payload.tipo === 'proposicoes' ? payload.tipo : 'atividade';

  const timesIds = uniqUuidStrings(payload.times_ids);
  if (timesIds.length === 0) {
    return { ok: false, error: 'Selecione ao menos um time.' };
  }

  const respIds = uniqUuidStrings(payload.responsaveis_ids);
  const dataFim = parseDataVencimentoChamado(payload.data_fim);

  const { data: nomeRow } = await supabase.from('kanban_times').select('nome').eq('id', timesIds[0]!).maybeSingle();
  const timeLabel = String((nomeRow as { nome?: string } | null)?.nome ?? '').trim() || '—';

  const { data: chamadoFull } = await supabase.from('sirene_chamados').select('*').eq('id', chamadoId).single();
  if (!chamadoFull) return { ok: false, error: 'Chamado não encontrado.' };

  const isCriador =
    (chamadoFull as { aberto_por?: string | null }).aberto_por != null &&
    (chamadoFull as { aberto_por: string }).aberto_por === me.userId;
  const podeBombeiro = canActAsBombeiro(me.ctx, chamadoFull as unknown as Chamado);
  if (!isCriador && !podeBombeiro) {
    return { ok: false, error: 'Sem permissão para adicionar tópico.' };
  }

  const { data: maxRow } = await supabase
    .from('sirene_topicos')
    .select('ordem')
    .eq('chamado_id', chamadoId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();
  const proxOrdem = Number((maxRow as { ordem?: number } | null)?.ordem ?? 0) + 1;

  const { error: insErr } = await supabase.from('sirene_topicos').insert({
    chamado_id: chamadoId,
    ordem: proxOrdem,
    descricao: desc,
    time_responsavel: timeLabel,
    times_ids: timesIds,
    responsavel_id: respIds.length > 0 ? respIds[0]! : null,
    responsaveis_ids: respIds,
    status: 'nao_iniciado',
    trava: Boolean(payload.trava),
    data_fim: dataFim,
    tipo,
    tema: payload.tema?.trim() || null,
  });
  if (insErr) return { ok: false, error: insErr.message };

  const numero = (chamadoFull as { numero?: number | null }).numero ?? chamadoId;
  const temaCh = String((chamadoFull as { tema?: string | null }).tema ?? '').trim();
  const incendioCh = String((chamadoFull as { incendio?: string | null }).incendio ?? '').trim();
  const contextoTitulo = temaCh || incendioCh || `Chamado #${numero}`;

  await notificarMencoesSirene({
    mencoesIds,
    plain: desc,
    referenciaPath: `/sirene/${chamadoId}`,
    contextoTitulo,
    autorId: me.userId,
  });

  revalidatePath('/sirene/chamados');
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

export async function editarTopico(
  topicoId: number,
  payload: {
    descricao: string;
    tipo: SubInteracaoTipoDb;
    times_ids: string[];
    responsaveis_ids: string[];
    data_fim: string | null;
    trava: boolean;
    tema: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient();
    const dataFim = payload.data_fim?.trim() || null;
    const { error } = await admin
      .from('sirene_topicos')
      .update({
        descricao: payload.descricao.trim(),
        tipo: payload.tipo,
        times_ids: payload.times_ids,
        responsaveis_ids: payload.responsaveis_ids,
        data_fim: dataFim,
        trava: payload.trava,
        tema: payload.tema,
      })
      .eq('id', topicoId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Salvar resolução pontual do chamado. canActAsBombeiro. */
export async function salvarResolucaoPontual(
  chamadoId: number,
  resolucao: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', chamadoId)
    .single();
  if (!chamado || !canActAsBombeiro(me.ctx, chamado as unknown as Chamado))
    return { ok: false, error: 'Sem permissão para editar resolução pontual.' };

  const { error } = await supabase
    .from('sirene_chamados')
    .update({
      resolucao_pontual: resolucao?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chamadoId);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/** Concluir tópico: preenche resolução do time e marca status concluído. Pode: Bombeiro ou o time responsável. */
export async function concluirTopico(
  topicoId: number,
  resolucaoTime: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: topico, error: errT } = await supabase
    .from('sirene_topicos')
    .select('id, chamado_id, time_responsavel, status')
    .eq('id', topicoId)
    .single();
  if (errT || !topico) return { ok: false, error: 'Tópico não encontrado.' };
  if (topico.status === 'aprovado') return { ok: false, error: 'Tópico já foi aprovado.' };

  const podeConcluir =
    me.ctx.papel === 'bombeiro' || me.ctx.time === topico.time_responsavel;
  if (!podeConcluir)
    return { ok: false, error: 'Apenas o Bombeiro ou o time responsável pode concluir este tópico.' };

  const resolucaoTrim = resolucaoTime?.trim() ?? '';
  if (!resolucaoTrim) return { ok: false, error: 'Informe a resolução antes de concluir.' };

  const { error } = await supabase
    .from('sirene_topicos')
    .update({
      resolucao_time: resolucaoTrim,
      status: 'concluido',
      updated_at: new Date().toISOString(),
    })
    .eq('id', topicoId);

  if (error) return { ok: false, error: error.message };
  const { data: chamadoRef } = await supabase
    .from('sirene_chamados')
    .select('numero')
    .eq('id', topico.chamado_id)
    .single();
  const numero = (chamadoRef as { numero?: number } | null)?.numero ?? topico.chamado_id;
  const bombeiros = await getUserIdsToNotify(supabase, 'bombeiro');
  for (const uid of bombeiros) {
    await inserirNotificacao(
      supabase,
      uid,
      topico.chamado_id,
      'topico_concluido',
      `Tópico do chamado #${numero} foi concluído pelo time.`,
    );
  }
  revalidatePath('/sirene');
  revalidatePath(`/sirene/${topico.chamado_id}`);
  return { ok: true };
}

/** Aprovar tópico. canActAsBombeiro. */
export async function aprovarTopico(topicoId: number): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: topico } = await supabase
    .from('sirene_topicos')
    .select('chamado_id, time_responsavel, responsavel_id')
    .eq('id', topicoId)
    .single();
  if (!topico) return { ok: false, error: 'Tópico não encontrado.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', topico.chamado_id)
    .single();
  if (!chamado || !canActAsBombeiro(me.ctx, chamado as unknown as Chamado))
    return { ok: false, error: 'Sem permissão para aprovar tópico.' };

  const { error } = await supabase
    .from('sirene_topicos')
    .update({
      status: 'aprovado',
      aprovado_bombeiro: true,
      motivo_reprovacao: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', topicoId);

  if (error) return { ok: false, error: error.message };
  const numero = (chamado as { numero?: number })?.numero ?? topico.chamado_id;
  const userIdsTime = await getUserIdsTimeTopico(
    supabase,
    topico.time_responsavel ?? '',
    topico.responsavel_id ?? null,
  );
  for (const uid of userIdsTime) {
    await inserirNotificacao(
      supabase,
      uid,
      topico.chamado_id,
      'topico_aprovado',
      `Tópico do chamado #${numero} foi aprovado pelo Bombeiro.`,
    );
  }
  revalidatePath(`/sirene/${topico.chamado_id}`);
  return { ok: true };
}

/** Reprovar tópico. canActAsBombeiro. */
export async function reprovarTopico(
  topicoId: number,
  motivo: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: topico } = await supabase
    .from('sirene_topicos')
    .select('chamado_id, time_responsavel, responsavel_id')
    .eq('id', topicoId)
    .single();
  if (!topico) return { ok: false, error: 'Tópico não encontrado.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', topico.chamado_id)
    .single();
  if (!chamado || !canActAsBombeiro(me.ctx, chamado as unknown as Chamado))
    return { ok: false, error: 'Sem permissão para reprovar tópico.' };

  const { error } = await supabase
    .from('sirene_topicos')
    .update({
      status: 'em_andamento',
      aprovado_bombeiro: false,
      motivo_reprovacao: motivo?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', topicoId);

  if (error) return { ok: false, error: error.message };
  const numero = (chamado as { numero?: number })?.numero ?? topico.chamado_id;
  const userIdsTime = await getUserIdsTimeTopico(
    supabase,
    topico.time_responsavel ?? '',
    topico.responsavel_id ?? null,
  );
  for (const uid of userIdsTime) {
    await inserirNotificacao(
      supabase,
      uid,
      topico.chamado_id,
      'topico_reprovado',
      `Tópico do chamado #${numero} foi reprovado pelo Bombeiro.`,
    );
  }
  if ((chamado as { aberto_por?: string }).aberto_por) {
    await inserirNotificacao(
      supabase,
      (chamado as { aberto_por: string }).aberto_por,
      topico.chamado_id,
      'topico_reprovado',
      `Tópico do chamado #${numero} foi reprovado.`,
    );
  }
  revalidatePath(`/sirene/${topico.chamado_id}`);
  return { ok: true };
}

/**
 * @deprecated Não é mais gate de conclusão. Salva parecer/tema/mapeamento sem alterar status do chamado.
 */
export async function fecharChamado(
  chamadoId: number,
  parecer: string,
  tema: string,
  mapeamento: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', chamadoId)
    .single();

  if (!chamado) return { ok: false, error: 'Chamado não encontrado.' };

  const chamadoTyped = chamado as unknown as Chamado;
  if (!canActAsBombeiro(me.ctx, chamadoTyped))
    return { ok: false, error: 'Apenas Bombeiro pode preencher tema e mapeamento de perícia.' };

  const parecerTrim = parecer?.trim();
  const temaTrim = tema?.trim();
  const mapeamentoTrim = mapeamento?.trim();
  if (!parecerTrim || !temaTrim || !mapeamentoTrim)
    return { ok: false, error: 'Parecer, tema e mapeamento de perícia são obrigatórios.' };

  const { error } = await supabase
    .from('sirene_chamados')
    .update({
      parecer_final: parecerTrim,
      tema: temaTrim,
      mapeamento_pericia: mapeamentoTrim,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chamadoId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/sirene');
  revalidatePath(`/sirene/${chamadoId}`);
  revalidatePath('/carometro/pastelaria');
  revalidatePath('/sirene/chamados');
  return { ok: true };
}

/** Criador conclui ou reabre o chamado (regra CARD). Só quem abriu; todas as atividades fechadas. */
export async function concluirChamadoCriador(
  chamadoId: number,
  suficiente: boolean,
  texto: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const textoTrim = texto?.trim();
  if (!textoTrim) {
    return {
      ok: false,
      error: suficiente
        ? 'Informe as informações da conclusão.'
        : 'Informe o motivo da insuficiência para reabrir.',
    };
  }

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('id, aberto_por, status')
    .eq('id', chamadoId)
    .single();

  if (!chamado) return { ok: false, error: 'Chamado não encontrado.' };
  if (chamado.aberto_por !== me.userId)
    return { ok: false, error: 'Somente quem abriu o chamado pode marcá-lo como concluído.' };

  if (chamado.status === 'concluido')
    return { ok: false, error: 'Este chamado já está concluído.' };

  const topicos = await buscarTopicosStatusChamado(supabase, chamadoId);
  if (!todosTopicosFechados(topicos)) {
    return {
      ok: false,
      error: 'Conclua todas as atividades (concluídas ou aprovadas) antes de fechar o chamado.',
    };
  }

  const legadoAguardando = chamado.status === 'aguardando_aprovacao_criador';
  if (
    chamado.status !== 'em_andamento' &&
    !legadoAguardando
  ) {
    return { ok: false, error: 'Chamado não está em andamento.' };
  }

  const admin = createAdminClient();

  if (suficiente) {
    const { error } = await supabase
      .from('sirene_chamados')
      .update({
        resolucao_suficiente: true,
        motivo_insuficiente: null,
        info_conclusao_criador: textoTrim,
        status: 'concluido',
        data_conclusao: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', chamadoId);
    if (error) return { ok: false, error: error.message };

    await admin
      .from('kanban_atividades')
      .update({
        status: 'concluida',
        concluida_em: new Date().toISOString(),
        info_conclusao_criador: textoTrim,
        updated_at: new Date().toISOString(),
      })
      .eq('sirene_chamado_id', chamadoId);
  } else {
    const { error } = await supabase
      .from('sirene_chamados')
      .update({
        resolucao_suficiente: false,
        motivo_insuficiente: textoTrim,
        info_conclusao_criador: null,
        status: 'em_andamento',
        updated_at: new Date().toISOString(),
      })
      .eq('id', chamadoId);
    if (error) return { ok: false, error: error.message };

    await admin
      .from('kanban_atividades')
      .update({
        status: 'em_andamento',
        concluida_em: null,
        updated_at: new Date().toISOString(),
      })
      .eq('sirene_chamado_id', chamadoId);

    const bombeiros = await getUserIdsToNotify(supabase, 'bombeiro');
    const numero = (chamado as { numero?: number })?.numero ?? chamadoId;
    for (const uid of bombeiros) {
      await inserirNotificacao(
        supabase,
        uid,
        chamadoId,
        'criador_reabriu',
        `Criador indicou resolução insuficiente no chamado #${numero}. Chamado reaberto.`,
      );
    }
  }

  const adminSync = createAdminClient();
  const statusSync = suficiente ? 'concluido' : 'em_andamento';
  const syncPastel = await syncPastelariaColunaFromSireneStatus(adminSync, chamadoId, statusSync);
  if (!syncPastel.ok) console.error('[concluirChamadoCriador] sync pastelaria', syncPastel.error);

  revalidatePath('/sirene');
  revalidatePath(`/sirene/${chamadoId}`);
  revalidatePath('/carometro/pastelaria');
  revalidatePath('/sirene/chamados');
  return { ok: true };
}

export { topicoStatusFechado, todosTopicosFechados };

export type AnexoOrigem = 'criador' | 'topico' | 'fechamento_bombeiro';

/** Listar anexos do chamado (todos os participantes veem todos; RLS garante acesso). */
export async function listAnexosChamado(chamadoId: number): Promise<
  | {
      ok: true;
      anexos: Array<{
        id: number;
        chamado_id: number;
        topico_id: number | null;
        uploader_nome: string | null;
        nome_original: string | null;
        origem: string | null;
        created_at: string;
      }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('id')
    .eq('id', chamadoId)
    .single();
  if (!chamado) return { ok: false, error: 'Chamado não encontrado.' };

  const { data: rows, error } = await supabase
    .from('sirene_anexos')
    .select('id, chamado_id, topico_id, uploader_nome, nome_original, origem, created_at')
    .eq('chamado_id', chamadoId)
    .order('created_at', { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, anexos: rows ?? [] };
}

/** Upload de anexo: criador (abertura), time (tópico) ou Bombeiro (fechamento). */
export async function uploadAnexoChamado(
  chamadoId: number,
  origem: AnexoOrigem,
  formData: FormData,
  topicoId?: number,
): Promise<SireneActionResult & { anexoId?: number }> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const file = formData.get('file') as File | null;
  if (!file || !(file instanceof File) || file.size === 0)
    return { ok: false, error: 'Selecione um arquivo.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', chamadoId)
    .single();
  if (!chamado) return { ok: false, error: 'Chamado não encontrado.' };
  const chamadoTyped = chamado as unknown as Chamado;

  if (origem === 'criador') {
    if (chamado.aberto_por !== me.userId)
      return { ok: false, error: 'Apenas quem abriu o chamado pode anexar como criador.' };
  } else if (origem === 'fechamento_bombeiro') {
    if (!canActAsBombeiro(me.ctx, chamadoTyped))
      return { ok: false, error: 'Apenas Bombeiro pode anexar no fechamento.' };
  } else if (origem === 'topico') {
    if (topicoId == null) return { ok: false, error: 'Informe o tópico para anexo do time.' };
    const { data: topico } = await supabase
      .from('sirene_topicos')
      .select('time_responsavel')
      .eq('id', topicoId)
      .eq('chamado_id', chamadoId)
      .single();
    if (!topico) return { ok: false, error: 'Tópico não encontrado.' };
    if (!canActAsBombeiro(me.ctx, chamadoTyped) && topico.time_responsavel !== me.ctx.time)
      return { ok: false, error: 'Apenas o time do tópico ou Bombeiro pode anexar neste tópico.' };
  }

  const ext = file.name.replace(/^.*\./, '') || 'bin';
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const uid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
  const path =
    origem === 'topico' && topicoId != null
      ? `chamado_${chamadoId}/topico_${topicoId}_${uid}_${safeName}`
      : `chamado_${chamadoId}/${origem}_${uid}_${safeName}`;

  const { error: uploadErr } = await supabase.storage.from('sirene-attachments').upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { data: inserted, error: insertErr } = await supabase
    .from('sirene_anexos')
    .insert({
      chamado_id: chamadoId,
      topico_id: origem === 'topico' ? topicoId ?? null : null,
      uploader_id: me.userId,
      uploader_nome: me.userName,
      storage_path: path,
      nome_original: file.name,
      tipo: file.type || null,
      origem,
    })
    .select('id')
    .single();

  if (insertErr) return { ok: false, error: insertErr.message };
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true, anexoId: inserted?.id };
}

/** URL assinada para download de anexo (bucket privado). */
export async function getAnexoChamadoDownloadUrl(
  anexoId: number,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: anexo, error } = await supabase
    .from('sirene_anexos')
    .select('chamado_id, storage_path')
    .eq('id', anexoId)
    .single();
  if (error || !anexo) return { ok: false, error: 'Anexo não encontrado.' };

  const { data: signed, error: signErr } = await supabase.storage
    .from('sirene-attachments')
    .createSignedUrl(anexo.storage_path, 60);
  if (signErr || !signed?.signedUrl) return { ok: false, error: signErr?.message ?? 'Erro ao gerar link.' };
  return { ok: true, url: signed.signedUrl };
}

function statusSireneParaRankLista(status: string): string {
  const x = String(status ?? '').trim().toLowerCase();
  if (x === 'concluido') return 'concluida';
  if (x === 'em_andamento' || x === 'aguardando_aprovacao_criador') return 'em_andamento';
  return 'pendente';
}

/** Listar chamados (filtro opcional por tipo: todos | padrao | hdm). Por padrão exclui arquivados. */
export async function listChamados(
  filtroTipo?: 'todos' | 'padrao' | 'hdm',
  incluirArquivados = false,
): Promise<
  | {
      ok: true;
      chamados: Array<{
        id: number;
        numero: number;
        incendio: string;
        status: string;
        prioridade: string;
        tipo: string;
        hdm_responsavel: string | null;
        time_abertura: string | null;
        abertura_responsavel_nome: string | null;
        trava: boolean;
        created_at: string;
        frank_id: string | null;
        data_vencimento: string | null;
        /** Primeiro tópico do chamado (`ordem` ASC): nome do responsável, se houver. */
        primeiro_topico_responsavel_nome: string | null;
        /** Primeiro tópico: time responsável. */
        primeiro_topico_time_responsavel: string | null;
      }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  let q = supabase.from('sirene_chamados').select(
    'id, numero, incendio, status, prioridade, tipo, hdm_responsavel, time_abertura, abertura_responsavel_nome, trava, te_trata, created_at, frank_id, data_vencimento, arquivado',
  );

  if (!incluirArquivados) q = q.eq('arquivado', false);
  if (filtroTipo === 'padrao') q = q.eq('tipo', 'padrao');
  else if (filtroTipo === 'hdm') q = q.eq('tipo', 'hdm');

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  const rows = data ?? [];

  const firstTopicoByChamado = new Map<number, { responsavel_nome: string | null; time_responsavel: string | null }>();
  if (rows.length > 0) {
    const chamadoIds = rows.map((c) => c.id);
    const { data: topicosRows, error: tErr } = await supabase
      .from('sirene_topicos')
      .select('chamado_id, ordem, responsavel_nome, time_responsavel')
      .in('chamado_id', chamadoIds)
      .order('chamado_id', { ascending: true })
      .order('ordem', { ascending: true });
    if (tErr) return { ok: false, error: tErr.message };
    for (const t of topicosRows ?? []) {
      const cid = Number((t as { chamado_id: number }).chamado_id);
      if (!Number.isFinite(cid) || firstTopicoByChamado.has(cid)) continue;
      const rn = (t as { responsavel_nome?: string | null }).responsavel_nome;
      const tr = (t as { time_responsavel?: string | null }).time_responsavel;
      firstTopicoByChamado.set(cid, {
        responsavel_nome: rn != null && String(rn).trim() !== '' ? String(rn).trim() : null,
        time_responsavel: tr != null && String(tr).trim() !== '' ? String(tr).trim() : null,
      });
    }
  }

  const chamados = rows.map((c) => {
    const first = firstTopicoByChamado.get(Number(c.id));
    const row = c as Record<string, unknown>;
    return {
      ...c,
      frank_id: (row.frank_id as string | null | undefined) ?? null,
      data_vencimento:
        row.data_vencimento != null && String(row.data_vencimento).trim() !== ''
          ? String(row.data_vencimento).slice(0, 10)
          : null,
      primeiro_topico_responsavel_nome: first?.responsavel_nome ?? null,
      primeiro_topico_time_responsavel: first?.time_responsavel ?? null,
    };
  });

  chamados.sort((a, b) =>
    compareChamadosPainelRank(
      {
        frank_id: a.frank_id,
        trava: a.trava,
        te_trata: (a as { te_trata?: boolean | null }).te_trata,
        data_vencimento: a.data_vencimento,
        atividade_status: statusSireneParaRankLista(a.status),
        criado_em: a.created_at,
      },
      {
        frank_id: b.frank_id,
        trava: b.trava,
        te_trata: (b as { te_trata?: boolean | null }).te_trata,
        data_vencimento: b.data_vencimento,
        atividade_status: statusSireneParaRankLista(b.status),
        criado_em: b.created_at,
      },
    ),
  );

  return { ok: true, chamados };
}

export type MonitorTopico = {
  topicoId: number;
  chamadoId: number;
  numero: number;
  incendio: string;
  frank_nome: string | null;
  trava: boolean;
  descricao: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
};

/** Monitor dos times: Bombeiro vê todos os tópicos agrupados por time (não aprovados). filtroTipo: todos | padrao | hdm */
export async function getMonitorTopicosPorTime(
  filtroTipo?: 'todos' | 'padrao' | 'hdm',
): Promise<
  | { ok: true; isBombeiro: true; porTime: Record<string, MonitorTopico[]> }
  | { ok: true; isBombeiro: false }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: papelRow } = await supabase
    .from('sirene_papeis')
    .select('papel')
    .eq('user_id', user.id)
    .maybeSingle();
  const isBombeiro = papelRow?.papel === 'bombeiro';
  if (!isBombeiro) return { ok: true, isBombeiro: false };

  const { data: topicos, error: errT } = await supabase
    .from('sirene_topicos')
    .select('id, chamado_id, descricao, time_responsavel, status, data_inicio, data_fim, trava')
    .in('status', ['nao_iniciado', 'em_andamento', 'concluido'])
    .order('ordem', { ascending: true });

  if (errT) return { ok: false, error: errT.message };
  let list = topicos ?? [];
  if (list.length === 0) return { ok: true, isBombeiro: true, porTime: {} };

  const chamadoIds = [...new Set(list.map((t) => t.chamado_id))];
  let q = supabase
    .from('sirene_chamados')
    .select('id, numero, incendio, frank_nome, trava, tipo')
    .in('id', chamadoIds);
  if (filtroTipo === 'padrao') q = q.eq('tipo', 'padrao');
  else if (filtroTipo === 'hdm') q = q.eq('tipo', 'hdm');
  const { data: chamados, error: errC } = await q;
  if (errC) return { ok: false, error: errC.message };
  const chamadosById = new Map(
    (chamados ?? []).map((c) => [
      c.id,
      { numero: c.numero, incendio: c.incendio, frank_nome: c.frank_nome ?? null, trava: c.trava ?? false },
    ]),
  );

  if (filtroTipo === 'padrao' || filtroTipo === 'hdm') {
    const idsFiltrados = new Set((chamados ?? []).map((c) => c.id));
    list = list.filter((t) => idsFiltrados.has(t.chamado_id));
  }

  const porTime: Record<string, MonitorTopico[]> = {};
  for (const t of list) {
    const c = chamadosById.get(t.chamado_id);
    if (!c) continue;
    const time = t.time_responsavel?.trim() || 'Sem time';
    if (!porTime[time]) porTime[time] = [];
    porTime[time].push({
      topicoId: t.id,
      chamadoId: t.chamado_id,
      numero: c.numero,
      incendio: c.incendio,
      frank_nome: c.frank_nome,
      trava: (t as { trava?: boolean }).trava ?? c.trava,
      descricao: t.descricao,
      status: t.status,
      data_inicio: t.data_inicio ?? null,
      data_fim: t.data_fim ?? null,
    });
  }
  return { ok: true, isBombeiro: true, porTime };
}

/** Conta atividades com SLA na view unificada, respeitando filtro de tipo Sirene (mesma regra do painel Chamados). */
async function countSlaAtividades(
  queryClient: Awaited<ReturnType<typeof createClient>>,
  slaStatus: 'atrasado' | 'vence_hoje',
  filtroTipo?: 'todos' | 'padrao' | 'hdm',
): Promise<number> {
  const { data: rows } = await queryClient
    .from('v_atividades_unificadas')
    .select('id')
    .eq('sla_status', slaStatus);
  if (!rows?.length) return 0;

  const ids = rows.map((r) => String((r as { id: string }).id)).filter(Boolean);
  const kaById = new Map<string, { origem: string; sirene_chamado_id: number | null }>();
  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data: kaRows } = await queryClient
      .from('kanban_atividades')
      .select('id, origem, sirene_chamado_id')
      .in('id', slice);
    for (const r of kaRows ?? []) {
      const id = String((r as { id: string }).id);
      const sid = (r as { sirene_chamado_id?: number | null }).sirene_chamado_id;
      kaById.set(id, {
        origem: String((r as { origem?: string }).origem ?? 'nativo'),
        sirene_chamado_id: sid != null && Number.isFinite(Number(sid)) ? Number(sid) : null,
      });
    }
  }

  const sireneIds = [
    ...new Set(
      [...kaById.values()]
        .map((k) => k.sirene_chamado_id)
        .filter((x): x is number => x != null && Number.isFinite(x)),
    ),
  ];
  const sireneTipoById = new Map<number, string>();
  if (sireneIds.length > 0) {
    for (let i = 0; i < sireneIds.length; i += chunk) {
      const slice = sireneIds.slice(i, i + chunk);
      const { data: scRows } = await queryClient
        .from('sirene_chamados')
        .select('id, tipo')
        .in('id', slice);
      for (const s of scRows ?? []) {
        sireneTipoById.set(Number((s as { id: number }).id), String((s as { tipo?: string }).tipo ?? 'padrao'));
      }
    }
  }

  let count = 0;
  for (const row of rows) {
    const id = String((row as { id: string }).id);
    const ka = kaById.get(id);
    if (filtroTipo === 'padrao' || filtroTipo === 'hdm') {
      if (ka?.origem === 'sirene' && ka.sirene_chamado_id != null) {
        const t = sireneTipoById.get(ka.sirene_chamado_id) ?? 'padrao';
        if (filtroTipo === 'hdm' ? t !== 'hdm' : t !== 'padrao') continue;
      }
    }
    count++;
  }
  return count;
}

/** Mesma regra de `buscarTopicosStatusChamado`, em lote (legado `chamado_id` ou `interacao_id`). */
async function mapTopicosStatusPorChamado(
  queryClient: Awaited<ReturnType<typeof createClient>>,
  chamadoIds: number[],
): Promise<Map<number, Array<{ status?: string | null }>>> {
  const out = new Map<number, Array<{ status?: string | null }>>();
  if (chamadoIds.length === 0) return out;

  const { data: directTopicos } = await queryClient
    .from('sirene_topicos')
    .select('chamado_id, status')
    .in('chamado_id', chamadoIds)
    .eq('arquivado', false);

  const directByChamado = new Map<number, Array<{ status?: string | null }>>();
  for (const t of directTopicos ?? []) {
    const cid = Number((t as { chamado_id: number }).chamado_id);
    if (!Number.isFinite(cid)) continue;
    const arr = directByChamado.get(cid) ?? [];
    arr.push({ status: (t as { status?: string | null }).status });
    directByChamado.set(cid, arr);
  }

  const chamadosSemDirect = chamadoIds.filter((id) => (directByChamado.get(id)?.length ?? 0) === 0);
  const viaInteracaoByChamado = new Map<number, Array<{ status?: string | null }>>();

  if (chamadosSemDirect.length > 0) {
    const { data: interacoes } = await queryClient
      .from('kanban_atividades')
      .select('id, sirene_chamado_id')
      .in('sirene_chamado_id', chamadosSemDirect);

    const interacaoToChamado = new Map<string, number>();
    const interacaoIds: string[] = [];
    for (const i of interacoes ?? []) {
      const kaId = String((i as { id: string }).id);
      const cid = Number((i as { sirene_chamado_id?: number | null }).sirene_chamado_id);
      if (!Number.isFinite(cid)) continue;
      interacaoToChamado.set(kaId, cid);
      interacaoIds.push(kaId);
    }

    if (interacaoIds.length > 0) {
      const chunk = 200;
      for (let i = 0; i < interacaoIds.length; i += chunk) {
        const slice = interacaoIds.slice(i, i + chunk);
        const { data: viaInteracao } = await queryClient
          .from('sirene_topicos')
          .select('interacao_id, status')
          .in('interacao_id', slice)
          .eq('arquivado', false);
        for (const t of viaInteracao ?? []) {
          const cid = interacaoToChamado.get(String((t as { interacao_id: string }).interacao_id));
          if (cid == null) continue;
          const arr = viaInteracaoByChamado.get(cid) ?? [];
          arr.push({ status: (t as { status?: string | null }).status });
          viaInteracaoByChamado.set(cid, arr);
        }
      }
    }
  }

  for (const cid of chamadoIds) {
    const direct = directByChamado.get(cid);
    const topicos = direct && direct.length > 0 ? direct : (viaInteracaoByChamado.get(cid) ?? []);
    out.set(cid, topicos);
  }
  return out;
}

/** Dias desde o fechamento pelo bombeiro; `updated_at` do chamado como proxy (ex.: fecharChamado). */
function diasDesdeFechamentoBombeiro(updatedAt: string | null | undefined): number {
  if (updatedAt == null || String(updatedAt).trim() === '') return 0;
  const ms = Date.now() - new Date(String(updatedAt)).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Franqueado: `frank_nome` do chamado; senão card vinculado ou `v_atividades_unificadas` da interação kanban. */
async function resolverFranqueadoNomesPorChamado(
  queryClient: Awaited<ReturnType<typeof createClient>>,
  chamados: Array<{ id: number; frank_nome?: string | null; card_id?: string | null }>,
): Promise<Map<number, string | null>> {
  const out = new Map<number, string | null>();
  for (const c of chamados) {
    const n = String(c.frank_nome ?? '').trim();
    if (n) out.set(c.id, n);
  }

  const pendentes = chamados.filter((c) => !out.has(c.id));
  if (pendentes.length === 0) return out;

  const cardIds = [
    ...new Set(
      pendentes
        .map((c) => (c.card_id != null ? String(c.card_id).trim() : ''))
        .filter((id) => id.length > 0),
    ),
  ];
  const cardFranqueadoId = new Map<string, string>();
  if (cardIds.length > 0) {
    const chunk = 200;
    for (let i = 0; i < cardIds.length; i += chunk) {
      const slice = cardIds.slice(i, i + chunk);
      const { data: cards } = await queryClient
        .from('kanban_cards')
        .select('id, franqueado_id')
        .in('id', slice);
      for (const card of cards ?? []) {
        const fid = String((card as { franqueado_id?: string | null }).franqueado_id ?? '').trim();
        if (fid) cardFranqueadoId.set(String((card as { id: string }).id), fid);
      }
    }
    const profileIds = [...new Set(cardFranqueadoId.values())];
    const profileNome = new Map<string, string>();
    if (profileIds.length > 0) {
      const { data: profiles } = await queryClient
        .from('profiles')
        .select('id, full_name, email')
        .in('id', profileIds);
      for (const p of profiles ?? []) {
        const nome =
          String((p as { full_name?: string | null }).full_name ?? '').trim() ||
          String((p as { email?: string | null }).email ?? '').trim();
        if (nome) profileNome.set(String((p as { id: string }).id), nome);
      }
    }
    for (const c of pendentes) {
      if (out.has(c.id) || !c.card_id) continue;
      const fid = cardFranqueadoId.get(String(c.card_id));
      const nome = fid ? profileNome.get(fid) : undefined;
      if (nome) out.set(c.id, nome);
    }
  }

  const aindaPendentes = pendentes.filter((c) => !out.has(c.id)).map((c) => c.id);
  if (aindaPendentes.length === 0) return out;

  const { data: interacoes } = await queryClient
    .from('kanban_atividades')
    .select('id, sirene_chamado_id')
    .in('sirene_chamado_id', aindaPendentes);
  const kaIds = (interacoes ?? []).map((r) => String((r as { id: string }).id));
  const kaPorChamado = new Map<number, string>();
  for (const i of interacoes ?? []) {
    const cid = Number((i as { sirene_chamado_id?: number | null }).sirene_chamado_id);
    if (!Number.isFinite(cid) || kaPorChamado.has(cid)) continue;
    kaPorChamado.set(cid, String((i as { id: string }).id));
  }

  if (kaIds.length > 0) {
    const chunk = 200;
    for (let i = 0; i < kaIds.length; i += chunk) {
      const slice = kaIds.slice(i, i + chunk);
      const { data: views } = await queryClient
        .from('v_atividades_unificadas')
        .select('id, franqueado_nome')
        .in('id', slice);
      for (const v of views ?? []) {
        const kaId = String((v as { id: string }).id);
        const nome = String((v as { franqueado_nome?: string | null }).franqueado_nome ?? '').trim();
        if (!nome) continue;
        for (const [cid, kid] of kaPorChamado) {
          if (kid === kaId && !out.has(cid)) out.set(cid, nome);
        }
      }
    }
  }

  return out;
}

/** Dias de calendário desde data_abertura até agora (mesma base ms do KPI tempo médio). */
function diasAbertoDesdeDataAbertura(dataAbertura: unknown): number {
  if (dataAbertura == null) return 0;
  const aberturaStr = String(dataAbertura).trim();
  if (!aberturaStr) return 0;
  const aberturaMs = new Date(aberturaStr).getTime();
  if (!Number.isFinite(aberturaMs)) return 0;
  const diff = (Date.now() - aberturaMs) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.floor(diff));
}

function mapChamadoListaDashboard(c: {
  id: number;
  numero: number;
  time_abertura: string | null;
  incendio: string;
  data_abertura?: unknown;
}): {
  id: number;
  numero: number;
  time_abertura: string | null;
  incendio: string;
  dias_aberto: number;
} {
  return {
    id: c.id,
    numero: c.numero,
    time_abertura: c.time_abertura,
    incendio: c.incendio,
    dias_aberto: diasAbertoDesdeDataAbertura(c.data_abertura),
  };
}

const TOPICOS_DASHBOARD_STATUSES = ['nao_iniciado', 'em_andamento', 'concluido', 'aprovado'] as const;

/** Contagem de tópicos não arquivados por status, limitada aos chamados do escopo (filtro tipo via `allowedChamadoIds`). */
async function fetchTopicosPorStatus(
  queryClient: Awaited<ReturnType<typeof createClient>>,
  allowedChamadoIds: Set<number>,
): Promise<Array<{ status: string; count: number }>> {
  const counts = Object.fromEntries(TOPICOS_DASHBOARD_STATUSES.map((s) => [s, 0])) as Record<
    (typeof TOPICOS_DASHBOARD_STATUSES)[number],
    number
  >;

  const { data: topicosRows } = await queryClient
    .from('sirene_topicos')
    .select('status, chamado_id, interacao_id')
    .or('arquivado.eq.false,arquivado.is.null')
    .in('status', [...TOPICOS_DASHBOARD_STATUSES]);

  const interacaoIds = new Set<string>();
  for (const t of topicosRows ?? []) {
    const cid = (t as { chamado_id?: number | null }).chamado_id;
    if (cid == null || !Number.isFinite(Number(cid))) {
      const iid = (t as { interacao_id?: string | null }).interacao_id;
      if (iid) interacaoIds.add(String(iid));
    }
  }

  const interacaoToChamado = new Map<string, number>();
  if (interacaoIds.size > 0) {
    const unique = [...interacaoIds];
    const chunk = 200;
    for (let i = 0; i < unique.length; i += chunk) {
      const slice = unique.slice(i, i + chunk);
      const { data: kaRows } = await queryClient
        .from('kanban_atividades')
        .select('id, sirene_chamado_id')
        .in('id', slice);
      for (const r of kaRows ?? []) {
        const id = String((r as { id: string }).id);
        const sid = Number((r as { sirene_chamado_id?: number | null }).sirene_chamado_id);
        if (Number.isFinite(sid)) interacaoToChamado.set(id, sid);
      }
    }
  }

  for (const t of topicosRows ?? []) {
    let cid: number | null = null;
    const rawCid = (t as { chamado_id?: number | null }).chamado_id;
    if (rawCid != null && Number.isFinite(Number(rawCid))) {
      cid = Number(rawCid);
    } else {
      const iid = (t as { interacao_id?: string | null }).interacao_id;
      if (iid) cid = interacaoToChamado.get(String(iid)) ?? null;
    }
    if (cid == null || !allowedChamadoIds.has(cid)) continue;
    const st = String((t as { status?: string }).status ?? '');
    if (st in counts) counts[st as (typeof TOPICOS_DASHBOARD_STATUSES)[number]]++;
  }

  return TOPICOS_DASHBOARD_STATUSES.map((status) => ({ status, count: counts[status] }));
}

const DASHBOARD_PESSOA_UNASSIGNED = '__unassigned__';

export type DashboardPessoaMetrica = {
  nome: string;
  abertos: number;
  atrasados: number;
  com_trava?: number;
  sem_julgamento?: number;
};

function responsaveisIdsFromTopico(t: {
  responsaveis_ids?: unknown;
  responsavel_id?: string | null;
}): string[] {
  const raw = t.responsaveis_ids;
  const arr = Array.isArray(raw) ? raw.map((x) => String(x)).filter(Boolean) : [];
  if (arr.length > 0) return arr;
  const rid = t.responsavel_id;
  if (rid) return [String(rid)];
  return [DASHBOARD_PESSOA_UNASSIGNED];
}

function interacaoStatusAberto(atividadeStatus: string | null | undefined): boolean {
  const s = String(atividadeStatus ?? '')
    .trim()
    .toLowerCase();
  return s !== 'concluida' && s !== 'concluída' && s !== 'cancelada';
}

function top8PorAbertos<T extends { abertos: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.abertos - a.abertos).slice(0, 8);
}

async function resolveInteracaoToChamado(
  queryClient: Awaited<ReturnType<typeof createClient>>,
  interacaoIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (interacaoIds.length === 0) return out;
  const chunk = 200;
  for (let i = 0; i < interacaoIds.length; i += chunk) {
    const slice = interacaoIds.slice(i, i + chunk);
    const { data: kaRows } = await queryClient
      .from('kanban_atividades')
      .select('id, sirene_chamado_id')
      .in('id', slice);
    for (const r of kaRows ?? []) {
      const id = String((r as { id: string }).id);
      const sid = Number((r as { sirene_chamado_id?: number | null }).sirene_chamado_id);
      if (Number.isFinite(sid)) out.set(id, sid);
    }
  }
  return out;
}

async function loadProfileNomes(
  queryClient: Awaited<ReturnType<typeof createClient>>,
  userIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(userIds.filter((id) => id && id !== DASHBOARD_PESSOA_UNASSIGNED))];
  if (ids.length === 0) return out;
  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data: profiles } = await queryClient.from('profiles').select('id, full_name').in('id', slice);
    for (const p of profiles ?? []) {
      const id = String((p as { id: string }).id);
      const nome = String((p as { full_name?: string | null }).full_name ?? '').trim() || 'Sem nome';
      out.set(id, nome);
    }
  }
  return out;
}

function metricasToLista(
  agg: Map<string, { abertos: number; atrasados: number; extra: number }>,
  nomes: Map<string, string>,
  extraKey: 'com_trava' | 'sem_julgamento',
  unassignedLabel: string,
): DashboardPessoaMetrica[] {
  const rows: DashboardPessoaMetrica[] = [];
  for (const [uid, m] of agg) {
    const nome = uid === DASHBOARD_PESSOA_UNASSIGNED ? unassignedLabel : (nomes.get(uid) ?? 'Sem nome');
    rows.push({
      nome,
      abertos: m.abertos,
      atrasados: m.atrasados,
      [extraKey]: m.extra,
    });
  }
  return top8PorAbertos(rows);
}

/** Tópicos do escopo: abertos = não concluído/aprovado; atrasados = data_fim vencida ou SLA da interação; com_trava = trava do tópico ou do chamado. */
async function aggregatePorResponsavel(
  queryClient: Awaited<ReturnType<typeof createClient>>,
  allowedChamadoIds: Set<number>,
  comTravaByChamadoId: Map<number, boolean>,
): Promise<DashboardPessoaMetrica[]> {
  const { data: topicosRows } = await queryClient
    .from('sirene_topicos')
    .select(
      'status, chamado_id, interacao_id, data_fim, trava, responsaveis_ids, responsavel_id',
    )
    .or('arquivado.eq.false,arquivado.is.null');

  const interacaoIds = new Set<string>();
  for (const t of topicosRows ?? []) {
    const cid = (t as { chamado_id?: number | null }).chamado_id;
    if (cid == null || !Number.isFinite(Number(cid))) {
      const iid = (t as { interacao_id?: string | null }).interacao_id;
      if (iid) interacaoIds.add(String(iid));
    }
  }
  const interacaoToChamado = await resolveInteracaoToChamado(queryClient, [...interacaoIds]);

  const slaByInteracao = new Map<string, ReturnType<typeof slaStatusFromDate>>();
  if (interacaoIds.size > 0) {
    const unique = [...interacaoIds];
    const chunk = 200;
    for (let i = 0; i < unique.length; i += chunk) {
      const slice = unique.slice(i, i + chunk);
      const { data: kaRows } = await queryClient
        .from('kanban_atividades')
        .select('id, data_vencimento')
        .in('id', slice);
      for (const r of kaRows ?? []) {
        const id = String((r as { id: string }).id);
        slaByInteracao.set(
          id,
          slaStatusFromDate((r as { data_vencimento?: string | null }).data_vencimento),
        );
      }
    }
  }

  const agg = new Map<string, { abertos: number; atrasados: number; extra: number }>();
  const bump = (uid: string, field: 'abertos' | 'atrasados' | 'extra') => {
    const cur = agg.get(uid) ?? { abertos: 0, atrasados: 0, extra: 0 };
    cur[field]++;
    agg.set(uid, cur);
  };

  for (const t of topicosRows ?? []) {
    let cid: number | null = null;
    const rawCid = (t as { chamado_id?: number | null }).chamado_id;
    if (rawCid != null && Number.isFinite(Number(rawCid))) {
      cid = Number(rawCid);
    } else {
      const iid = (t as { interacao_id?: string | null }).interacao_id;
      if (iid) cid = interacaoToChamado.get(String(iid)) ?? null;
    }
    if (cid == null || !allowedChamadoIds.has(cid)) continue;

    const status = (t as { status?: string | null }).status;
    const aberto = !topicoStatusFechado(status);
    const iid = (t as { interacao_id?: string | null }).interacao_id;
    const dataFim = (t as { data_fim?: string | null }).data_fim;
    const atrasado =
      aberto &&
      (slaStatusFromDate(dataFim) === 'atrasado' ||
        (iid != null && slaByInteracao.get(String(iid)) === 'atrasado'));
    const comTrava =
      Boolean((t as { trava?: boolean }).trava) || (comTravaByChamadoId.get(cid) ?? false);

    for (const uid of responsaveisIdsFromTopico(t as { responsaveis_ids?: unknown; responsavel_id?: string | null })) {
      if (aberto) bump(uid, 'abertos');
      if (atrasado) bump(uid, 'atrasados');
      if (comTrava && aberto) bump(uid, 'extra');
    }
  }

  const nomes = await loadProfileNomes(queryClient, [...agg.keys()]);
  return metricasToLista(agg, nomes, 'com_trava', 'Sem responsável');
}

/** Interações Sirene: abertos = status ≠ concluída; atrasados = SLA atrasado; sem_julgamento = chamados aguardando julgamento do criador. */
async function aggregatePorCriador(
  queryClient: Awaited<ReturnType<typeof createClient>>,
  allowedChamadoIds: Set<number>,
  aguardandoJulgamentoIds: Set<number>,
): Promise<DashboardPessoaMetrica[]> {
  const chamadoIds = [...allowedChamadoIds];
  if (chamadoIds.length === 0) return [];

  const kaRows: Array<{
    id: string;
    criado_por: string | null;
    sirene_chamado_id: number;
    data_vencimento: string | null;
  }> = [];
  const chunk = 200;
  for (let i = 0; i < chamadoIds.length; i += chunk) {
    const slice = chamadoIds.slice(i, i + chunk);
    const { data: rows } = await queryClient
      .from('kanban_atividades')
      .select('id, criado_por, sirene_chamado_id, data_vencimento')
      .in('sirene_chamado_id', slice);
    for (const r of rows ?? []) {
      const cid = Number((r as { sirene_chamado_id?: number | null }).sirene_chamado_id);
      if (!Number.isFinite(cid)) continue;
      kaRows.push({
        id: String((r as { id: string }).id),
        criado_por: (r as { criado_por?: string | null }).criado_por ?? null,
        sirene_chamado_id: cid,
        data_vencimento: (r as { data_vencimento?: string | null }).data_vencimento ?? null,
      });
    }
  }

  const kaIds = kaRows.map((r) => r.id);
  const statusByKa = new Map<string, string>();
  const slaAtrasadoIds = new Set<string>();
  for (let i = 0; i < kaIds.length; i += chunk) {
    const slice = kaIds.slice(i, i + chunk);
    const { data: views } = await queryClient
      .from('v_atividades_unificadas')
      .select('id, atividade_status, sla_status')
      .in('id', slice);
    for (const v of views ?? []) {
      const id = String((v as { id: string }).id);
      statusByKa.set(id, String((v as { atividade_status?: string }).atividade_status ?? ''));
      if (String((v as { sla_status?: string }).sla_status ?? '') === 'atrasado') {
        slaAtrasadoIds.add(id);
      }
    }
  }

  const agg = new Map<string, { abertos: number; atrasados: number; extra: number }>();
  const bump = (uid: string, field: 'abertos' | 'atrasados' | 'extra') => {
    const cur = agg.get(uid) ?? { abertos: 0, atrasados: 0, extra: 0 };
    cur[field]++;
    agg.set(uid, cur);
  };

  const semJulgamentoCounted = new Set<string>();

  for (const ka of kaRows) {
    const uid = ka.criado_por ? String(ka.criado_por) : DASHBOARD_PESSOA_UNASSIGNED;
    const st = statusByKa.get(ka.id) ?? '';
    if (interacaoStatusAberto(st)) bump(uid, 'abertos');
    const atrasado =
      slaStatusFromDate(ka.data_vencimento) === 'atrasado' || slaAtrasadoIds.has(ka.id);
    if (atrasado) bump(uid, 'atrasados');

    if (aguardandoJulgamentoIds.has(ka.sirene_chamado_id)) {
      const key = `${ka.sirene_chamado_id}:${uid}`;
      if (!semJulgamentoCounted.has(key)) {
        semJulgamentoCounted.add(key);
        bump(uid, 'extra');
      }
    }
  }

  const nomes = await loadProfileNomes(queryClient, [...agg.keys()]);
  return metricasToLista(agg, nomes, 'sem_julgamento', 'Sem criador');
}

type AbertosGrupo = { nome: string; count: number };

/** Carrega origem/sirene_chamado_id e tipos de chamado Sirene para filtro padrao/hdm em atividades. */
async function loadKanbanAtividadesFiltroContext(
  queryClient: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<{
  kaById: Map<string, { origem: string; sirene_chamado_id: number | null }>;
  sireneTipoById: Map<number, string>;
}> {
  const kaById = new Map<string, { origem: string; sirene_chamado_id: number | null }>();
  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data: kaRows } = await queryClient
      .from('kanban_atividades')
      .select('id, origem, sirene_chamado_id')
      .in('id', slice);
    for (const r of kaRows ?? []) {
      const id = String((r as { id: string }).id);
      const sid = (r as { sirene_chamado_id?: number | null }).sirene_chamado_id;
      kaById.set(id, {
        origem: String((r as { origem?: string }).origem ?? 'nativo'),
        sirene_chamado_id: sid != null && Number.isFinite(Number(sid)) ? Number(sid) : null,
      });
    }
  }

  const sireneIds = [
    ...new Set(
      [...kaById.values()]
        .map((k) => k.sirene_chamado_id)
        .filter((x): x is number => x != null && Number.isFinite(x)),
    ),
  ];
  const sireneTipoById = new Map<number, string>();
  for (let i = 0; i < sireneIds.length; i += chunk) {
    const slice = sireneIds.slice(i, i + chunk);
    const { data: scRows } = await queryClient
      .from('sirene_chamados')
      .select('id, tipo')
      .in('id', slice);
    for (const s of scRows ?? []) {
      sireneTipoById.set(Number((s as { id: number }).id), String((s as { tipo?: string }).tipo ?? 'padrao'));
    }
  }

  return { kaById, sireneTipoById };
}

function passaFiltroTipoKanbanAtividade(
  id: string,
  filtroTipo: 'todos' | 'padrao' | 'hdm' | undefined,
  kaById: Map<string, { origem: string; sirene_chamado_id: number | null }>,
  sireneTipoById: Map<number, string>,
): boolean {
  if (filtroTipo !== 'padrao' && filtroTipo !== 'hdm') return true;
  const ka = kaById.get(id);
  if (ka?.origem === 'sirene' && ka.sirene_chamado_id != null) {
    const t = sireneTipoById.get(ka.sirene_chamado_id) ?? 'padrao';
    if (filtroTipo === 'hdm' ? t !== 'hdm' : t !== 'padrao') return false;
  }
  return true;
}

function topGruposPorCount(map: Map<string, number>, limit: number): AbertosGrupo[] {
  return [...map.entries()]
    .map(([nome, count]) => ({ nome, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Atividades não concluídas: agrupamento por time de abertura e por funil.
 * Funil via `v_atividades_unificadas` (join nativo/legado em kanban_cards→kanbans); sem card_id → "Sirene livre".
 */
async function aggregateAbertosDashboard(
  queryClient: Awaited<ReturnType<typeof createClient>>,
  filtroTipo?: 'todos' | 'padrao' | 'hdm',
): Promise<{ abertos_por_time: AbertosGrupo[]; abertos_por_funil: AbertosGrupo[] }> {
  const { data: rows } = await queryClient
    .from('v_atividades_unificadas')
    .select('id, card_id, kanban_nome, time_abertura_nome, atividade_status')
    .neq('atividade_status', 'concluida');

  if (!rows?.length) {
    return { abertos_por_time: [], abertos_por_funil: [] };
  }

  const ids = rows.map((r) => String((r as { id: string }).id)).filter(Boolean);
  const { kaById, sireneTipoById } = await loadKanbanAtividadesFiltroContext(queryClient, ids);

  const porTime = new Map<string, number>();
  const porFunil = new Map<string, number>();

  for (const row of rows) {
    const id = String((row as { id: string }).id);
    if (!passaFiltroTipoKanbanAtividade(id, filtroTipo, kaById, sireneTipoById)) continue;

    const timeNome = String((row as { time_abertura_nome?: string | null }).time_abertura_nome ?? '').trim();
    if (timeNome) {
      porTime.set(timeNome, (porTime.get(timeNome) ?? 0) + 1);
    }

    const cardId = (row as { card_id?: string | null }).card_id;
    const funilNome =
      cardId == null || String(cardId).trim() === ''
        ? 'Sirene livre'
        : String((row as { kanban_nome?: string | null }).kanban_nome ?? '').trim() || 'Sem funil';
    porFunil.set(funilNome, (porFunil.get(funilNome) ?? 0) + 1);
  }

  return {
    abertos_por_time: topGruposPorCount(porTime, 8),
    abertos_por_funil: topGruposPorCount(porFunil, 6),
  };
}

function displayNomeRedeFranqueado(rf: {
  nome_completo?: string | null;
  n_franquia?: string | null;
  nome?: string | null;
  unidade?: string | null;
}): string {
  return (
    String(rf.nome_completo ?? '').trim() ||
    String(rf.n_franquia ?? '').trim() ||
    String(rf.nome ?? '').trim() ||
    String(rf.unidade ?? '').trim() ||
    'Sem nome'
  );
}

/**
 * Top franqueados com chamados abertos: `kanban_atividades.card_id` → `kanban_cards.rede_franqueado_id` → `rede_franqueados`.
 * Conta chamados com `status != 'concluido'` (escopo já filtrado por tipo).
 */
async function aggregateTopFranqueados(
  queryClient: Awaited<ReturnType<typeof createClient>>,
  chamadosAbertos: Array<{ id: number }>,
): Promise<Array<{ nome: string; count: number }>> {
  const ids = chamadosAbertos.map((c) => c.id);
  if (ids.length === 0) return [];

  const chamadoToCardId = new Map<number, string>();
  const chunk = 200;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data: kaRows } = await queryClient
      .from('kanban_atividades')
      .select('sirene_chamado_id, card_id')
      .in('sirene_chamado_id', slice);
    for (const r of kaRows ?? []) {
      const cid = Number((r as { sirene_chamado_id?: number | null }).sirene_chamado_id);
      const cardId = String((r as { card_id?: string | null }).card_id ?? '').trim();
      if (!Number.isFinite(cid) || !cardId || chamadoToCardId.has(cid)) continue;
      chamadoToCardId.set(cid, cardId);
    }
  }

  const cardIds = [...new Set(chamadoToCardId.values())];
  const cardToRedeId = new Map<string, string>();
  for (let i = 0; i < cardIds.length; i += chunk) {
    const slice = cardIds.slice(i, i + chunk);
    const { data: cards } = await queryClient
      .from('kanban_cards')
      .select('id, rede_franqueado_id')
      .in('id', slice);
    for (const card of cards ?? []) {
      const rid = String((card as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? '').trim();
      if (rid) cardToRedeId.set(String((card as { id: string }).id), rid);
    }
  }

  const redeIds = [...new Set(cardToRedeId.values())];
  const redeNome = new Map<string, string>();
  if (redeIds.length > 0) {
    for (let i = 0; i < redeIds.length; i += chunk) {
      const slice = redeIds.slice(i, i + chunk);
      const { data: redes } = await queryClient
        .from('rede_franqueados')
        .select('id, nome_completo, n_franquia, nome, unidade')
        .in('id', slice);
      for (const rf of redes ?? []) {
        redeNome.set(String((rf as { id: string }).id), displayNomeRedeFranqueado(rf as Parameters<typeof displayNomeRedeFranqueado>[0]));
      }
    }
  }

  const countsByNome = new Map<string, number>();
  for (const c of chamadosAbertos) {
    const cardId = chamadoToCardId.get(c.id);
    if (!cardId) continue;
    const redeId = cardToRedeId.get(cardId);
    if (!redeId) continue;
    const nome = redeNome.get(redeId) ?? 'Sem nome';
    countsByNome.set(nome, (countsByNome.get(nome) ?? 0) + 1);
  }

  return topGruposPorCount(countsByNome, 5);
}

/** Top temas (`sirene_chamados.tema` preenchido) no escopo do filtro de tipo. */
function aggregateTopTemas(
  chamados: Array<{ tema?: string | null }>,
): Array<{ tema: string; count: number }> {
  const counts = new Map<string, number>();
  for (const c of chamados) {
    const tema = String(c.tema ?? '').trim();
    if (!tema) continue;
    counts.set(tema, (counts.get(tema) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tema, count]) => ({ tema, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/** Dados para o dashboard: KPIs, chamados por status, travados, satisfação, minhas tarefas. */
export async function getDashboardData(
  filtroTipo?: 'todos' | 'padrao' | 'hdm',
): Promise<
  | {
      ok: true;
      emAberto: number;
      emAndamento: number;
      concluidos: number;
      tempoMedioPrimeiroAtendimento: string | null;
      slaAtrasados: number;
      slaVenceHoje: number;
      aguardandoJulgamento: number;
      aguardando_julgamento_lista: Array<{
        id: number;
        numero: number;
        tema: string;
        franqueado_nome: string | null;
        dias_desde_fechamento_bombeiro: number;
      }>;
      topicos_por_status: Array<{ status: string; count: number }>;
      porStatus: { status: string; count: number; pct: number }[];
      por_tipo: { tipo: string; count: number; pct: number }[];
      por_prioridade_abertos: { prioridade: string; count: number; pct: number }[];
      chamadosBreakdown: DashboardChamadoBreakdownRow[];
      atividadesBreakdown: DashboardAtividadeBreakdownRow[];
      satisfacaoPct: number;
      satisfacao_total: number;
      satisfacao_aprovados: number;
      chamadosComTrava: number;
      recentesComTrava: Array<{
        id: number;
        numero: number;
        time_abertura: string | null;
        incendio: string;
        dias_aberto: number;
      }>;
      chamadosAtrasados: Array<{
        id: number;
        numero: number;
        time_abertura: string | null;
        incendio: string;
        dias_aberto: number;
      }>;
      minhasTarefas: Array<{
        chamadoId: number;
        numero: number;
        incendio: string;
        titulo: string;
        status: string;
      }>;
      por_responsavel: DashboardPessoaMetrica[];
      por_criador: DashboardPessoaMetrica[];
      abertos_por_time: AbertosGrupo[];
      abertos_por_funil: AbertosGrupo[];
      top_franqueados: Array<{ nome: string; count: number }>;
      top_temas: Array<{ tema: string; count: number }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  let me = await getSireneUserContext(supabase);
  let queryClient: typeof supabase = supabase;
  if (!me && isAppFullyPublic()) {
    try {
      queryClient = createAdminClient() as typeof supabase;
      me = {
        userId: '00000000-0000-0000-0000-000000000000',
        userName: 'Visitante',
        ctx: { papel: null, time: null },
        role: null,
        cargo: null,
      };
    } catch {
      /* sem service role */
    }
  }
  if (!me) return { ok: false, error: 'Faça login.' };

  let query = queryClient
    .from('sirene_chamados')
    .select(
      'id, numero, status, trava, te_trata, data_abertura, data_vencimento, data_inicio_atendimento, resolucao_suficiente, incendio, tema, frank_nome, card_id, time_abertura, tipo, updated_at, prioridade',
    );
  if (filtroTipo === 'padrao') query = query.eq('tipo', 'padrao');
  else if (filtroTipo === 'hdm') query = query.eq('tipo', 'hdm');

  const { data: chamados } = await query;

  const list = chamados ?? [];
  const total = list.length;
  const emAberto = list.filter((c) => c.status === 'nao_iniciado').length;
  const emAndamento = list.filter((c) => c.status === 'em_andamento').length;
  const concluidos = list.filter((c) => c.status === 'concluido').length;

  const deltasDiasPrimeiroAtendimento: number[] = [];
  for (const c of list) {
    const aberturaRaw = c.data_abertura;
    const inicioRaw = c.data_inicio_atendimento;
    if (aberturaRaw == null || inicioRaw == null) continue;
    const aberturaStr = String(aberturaRaw).trim();
    const inicioStr = String(inicioRaw).trim();
    if (!aberturaStr || !inicioStr) continue;
    const aberturaMs = new Date(aberturaStr).getTime();
    const inicioMs = new Date(inicioStr).getTime();
    if (!Number.isFinite(aberturaMs) || !Number.isFinite(inicioMs) || inicioMs <= aberturaMs) {
      continue;
    }
    deltasDiasPrimeiroAtendimento.push((inicioMs - aberturaMs) / (1000 * 60 * 60 * 24));
  }
  const tempoMedioPrimeiroAtendimento: string | null =
    deltasDiasPrimeiroAtendimento.length > 0
      ? `${(
          deltasDiasPrimeiroAtendimento.reduce((acc, d) => acc + d, 0) /
          deltasDiasPrimeiroAtendimento.length
        )
          .toFixed(1)
          .replace('.', ',')}d`
      : null;

  const comResolucao = list.filter((c) => c.resolucao_suficiente != null);
  const resolvidosPrimeira = comResolucao.filter((c) => c.resolucao_suficiente === true).length;
  const satisfacaoPct =
    comResolucao.length > 0 ? Math.round((resolvidosPrimeira / comResolucao.length) * 100) : 0;

  // Chamados com trava: campo trava da abertura OU flag "te_trata" marcada na abertura do chamado
  const comTrava = list.filter((c) => c.trava === true || (c as { te_trata?: boolean | null }).te_trata === true);
  const recentesComTrava = comTrava
    .sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime())
    .slice(0, 5)
    .map((c) => mapChamadoListaDashboard(c));

  const chamadosAtrasados = list
    .filter((c) => {
      if (c.status === 'concluido') return false;
      return slaStatusFromDate((c as { data_vencimento?: string | null }).data_vencimento) === 'atrasado';
    })
    .sort((a, b) => {
      const va = new Date(String(a.data_vencimento).trim()).getTime();
      const vb = new Date(String(b.data_vencimento).trim()).getTime();
      return va - vb;
    })
    .slice(0, 5)
    .map((c) => mapChamadoListaDashboard(c));

  const porStatus = [
    { status: 'nao_iniciado', count: emAberto, pct: total > 0 ? (emAberto / total) * 100 : 0 },
    {
      status: 'em_andamento',
      count: emAndamento,
      pct: total > 0 ? (emAndamento / total) * 100 : 0,
    },
    { status: 'concluido', count: concluidos, pct: total > 0 ? (concluidos / total) * 100 : 0 },
  ];

  const filteredChamadoIds = list.map((c) => c.id);
  const comTravaByChamadoId = new Map<number, boolean>();
  for (const c of list) {
    comTravaByChamadoId.set(
      c.id,
      c.trava === true || (c as { te_trata?: boolean | null }).te_trata === true,
    );
  }

  const atrasadoByChamadoId = new Map<number, boolean>();
  const atividadesBreakdown: DashboardAtividadeBreakdownRow[] = [];

  if (filteredChamadoIds.length > 0) {
    const chunk = 200;
    for (let i = 0; i < filteredChamadoIds.length; i += chunk) {
      const slice = filteredChamadoIds.slice(i, i + chunk);
      const { data: atividadesRows } = await queryClient
        .from('kanban_atividades')
        .select('tipo, sirene_chamado_id, data_vencimento')
        .in('sirene_chamado_id', slice);

      for (const row of atividadesRows ?? []) {
        const cid = Number((row as { sirene_chamado_id?: number | null }).sirene_chamado_id);
        if (!Number.isFinite(cid)) continue;
        const sla = slaStatusFromDate((row as { data_vencimento?: string | null }).data_vencimento);
        const atrasado = sla === 'atrasado';
        if (atrasado) atrasadoByChamadoId.set(cid, true);
        atividadesBreakdown.push({
          tipo: normalizeTipoAtividade((row as { tipo?: string | null }).tipo),
          comTrava: comTravaByChamadoId.get(cid) ?? false,
          atrasado,
        });
      }
    }
  }

  const chamadosBreakdown: DashboardChamadoBreakdownRow[] = list.map((c) => ({
    status: String(c.status ?? 'nao_iniciado'),
    prioridade: normalizePrioridade((c as { prioridade?: string | null }).prioridade),
    comTrava: comTravaByChamadoId.get(c.id) ?? false,
    atrasado: atrasadoByChamadoId.get(c.id) ?? false,
  }));

  const por_tipo = aggregatePorTipoFromBreakdown(atividadesBreakdown);
  const por_prioridade_abertos = aggregatePorPrioridadeAbertosFromBreakdown(chamadosBreakdown);

  const naoConcluidoIds = list.filter((c) => c.status !== 'concluido').map((c) => c.id);
  const allowedChamadoIds = new Set(filteredChamadoIds);
  const [slaAtrasados, slaVenceHoje, topicosPorChamado, topicos_por_status] = await Promise.all([
    countSlaAtividades(queryClient, 'atrasado', filtroTipo),
    countSlaAtividades(queryClient, 'vence_hoje', filtroTipo),
    mapTopicosStatusPorChamado(queryClient, naoConcluidoIds),
    fetchTopicosPorStatus(queryClient, allowedChamadoIds),
  ]);
  const aguardandoJulgamentoIds = naoConcluidoIds.filter((id) =>
    todosTopicosFechados(topicosPorChamado.get(id) ?? []),
  );
  const aguardandoJulgamento = aguardandoJulgamentoIds.length;

  const aguardandoChamadosOrdenados = list
    .filter((c) => aguardandoJulgamentoIds.includes(c.id))
    .sort(
      (a, b) =>
        new Date(String(a.updated_at ?? 0)).getTime() - new Date(String(b.updated_at ?? 0)).getTime(),
    )
    .slice(0, 5);
  const franqueadoPorChamado = await resolverFranqueadoNomesPorChamado(
    queryClient,
    aguardandoChamadosOrdenados.map((c) => ({
      id: c.id,
      frank_nome: (c as { frank_nome?: string | null }).frank_nome,
      card_id: (c as { card_id?: string | null }).card_id,
    })),
  );
  const aguardando_julgamento_lista = aguardandoChamadosOrdenados.map((c) => {
    const temaRaw = String((c as { tema?: string | null }).tema ?? '').trim();
    const incendioRaw = String(c.incendio ?? '').trim();
    return {
      id: c.id,
      numero: c.numero,
      tema: temaRaw || incendioRaw,
      franqueado_nome: franqueadoPorChamado.get(c.id) ?? null,
      dias_desde_fechamento_bombeiro: diasDesdeFechamentoBombeiro(c.updated_at),
    };
  });

  const minhasTarefas: Array<{
    chamadoId: number;
    numero: number;
    incendio: string;
    titulo: string;
    status: string;
  }> = [];

  const { data: topicos } = await queryClient
    .from('sirene_topicos')
    .select('id, chamado_id, descricao, status, time_responsavel')
    .eq('responsavel_id', me.userId);

  const chamadoIds = [...new Set((topicos ?? []).map((t) => t.chamado_id))];
  const chamadosById = new Map<number, { numero: number; incendio: string | null }>();
  if (chamadoIds.length > 0) {
    const { data: chamadosList } = await queryClient
      .from('sirene_chamados')
      .select('id, numero, incendio')
      .in('id', chamadoIds);
    for (const c of chamadosList ?? []) {
      chamadosById.set(c.id, { numero: c.numero, incendio: c.incendio });
    }
  }

  for (const t of topicos ?? []) {
    if (t.status === 'aprovado') continue;
    const c = chamadosById.get(t.chamado_id);
    if (c)
      minhasTarefas.push({
        chamadoId: t.chamado_id,
        numero: c.numero,
        incendio: c.incendio ?? '',
        titulo: `Tópico: ${t.descricao?.slice(0, 40) ?? ''}${(t.descricao?.length ?? 0) > 40 ? '…' : ''}`,
        status: t.status === 'concluido' ? 'Aguardando' : 'Em andamento',
      });
  }

  if (me.ctx.papel === 'bombeiro') {
    const { data: chamadosEmAndamento } = await queryClient
      .from('sirene_chamados')
      .select('id, numero, incendio')
      .eq('status', 'em_andamento');
    const { data: todosTopicos } = await queryClient
      .from('sirene_topicos')
      .select('chamado_id, status, aprovado_bombeiro');
    const porChamado = new Map<number, { concluidos: number; aprovados: number }>();
    for (const t of todosTopicos ?? []) {
      const cur = porChamado.get(t.chamado_id) ?? { concluidos: 0, aprovados: 0 };
      if (t.status === 'concluido' || t.status === 'aprovado') cur.concluidos++;
      if (t.status === 'aprovado' || t.aprovado_bombeiro === true) cur.aprovados++;
      porChamado.set(t.chamado_id, cur);
    }
    for (const c of chamadosEmAndamento ?? []) {
      const stats = porChamado.get(c.id);
      if (!stats) continue;
      const temConcluidoNaoAprovado = stats.concluidos > stats.aprovados;
      const todosAprovados = stats.concluidos > 0 && stats.concluidos === stats.aprovados;
      if (temConcluidoNaoAprovado)
        minhasTarefas.push({
          chamadoId: c.id,
          numero: c.numero,
          incendio: c.incendio ?? '',
          titulo: 'Revisar resolução pontual',
          status: 'Em andamento',
        });
      else if (todosAprovados)
        minhasTarefas.push({
          chamadoId: c.id,
          numero: c.numero,
          incendio: c.incendio ?? '',
          titulo: 'Parecer final pendente após todos os times concluírem',
          status: 'Em andamento',
        });
    }
  }

  const aguardandoJulgamentoSet = new Set(aguardandoJulgamentoIds);
  const chamadosNaoConcluidos = list.filter((c) => c.status !== 'concluido');
  const top_temas = aggregateTopTemas(list);
  const [por_responsavel, por_criador, abertosAgg, top_franqueados] = await Promise.all([
    aggregatePorResponsavel(queryClient, allowedChamadoIds, comTravaByChamadoId),
    aggregatePorCriador(queryClient, allowedChamadoIds, aguardandoJulgamentoSet),
    aggregateAbertosDashboard(queryClient, filtroTipo),
    aggregateTopFranqueados(
      queryClient,
      chamadosNaoConcluidos.map((c) => ({ id: c.id })),
    ),
  ]);

  return {
    ok: true,
    emAberto,
    emAndamento,
    concluidos,
    tempoMedioPrimeiroAtendimento,
    slaAtrasados,
    slaVenceHoje,
    aguardandoJulgamento,
    aguardando_julgamento_lista,
    topicos_por_status,
    porStatus,
    por_tipo,
    por_prioridade_abertos,
    chamadosBreakdown,
    atividadesBreakdown,
    satisfacaoPct,
    satisfacao_total: comResolucao.length,
    satisfacao_aprovados: resolvidosPrimeira,
    chamadosComTrava: comTrava.length,
    recentesComTrava,
    chamadosAtrasados,
    minhasTarefas: minhasTarefas.slice(0, 10),
    por_responsavel,
    por_criador,
    abertos_por_time: abertosAgg.abertos_por_time,
    abertos_por_funil: abertosAgg.abertos_por_funil,
    top_franqueados,
    top_temas,
  };
}

/** Buscar um chamado por id (para detalhe). */
export async function getChamado(
  chamadoId: number,
): Promise<
  | {
      ok: true;
      chamado: Chamado & { numero: number };
      userContext: SireneUserContext | null;
      currentUserId: string;
      isFrank: boolean;
      /** `profiles.role` bruto (ex.: admin, team, franqueado). */
      rawProfileRole: string | null;
      /** `profiles.cargo` bruto (ex.: adm, analista). */
      profileCargo: string | null;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: chamado, error } = await supabase
    .from('sirene_chamados')
    .select('*')
    .eq('id', chamadoId)
    .single();

  if (error || !chamado) return { ok: false, error: 'Chamado não encontrado.' };

  const c = chamado as unknown as Chamado & { numero: number };
  const isFrank = me.role === 'frank' || me.role === 'franqueado';
  return {
    ok: true,
    chamado: c,
    userContext: me.ctx,
    currentUserId: me.userId,
    isFrank,
    rawProfileRole: me.role,
    profileCargo: me.cargo,
  };
}

/** Chamados com tema e mapeamento preenchidos e ainda sem perícia vinculada (para Caneta Verde). */
export async function listChamadosParaVincularPericia(): Promise<
  | {
      ok: true;
      chamados: Array<{
        id: number;
        numero: number;
        incendio: string;
        tema: string | null;
        mapeamento_pericia: string | null;
      }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };
  if (me.ctx.papel !== 'bombeiro' && me.ctx.papel !== 'caneta_verde')
    return { ok: false, error: 'Apenas Bombeiro ou Caneta Verde podem vincular perícia.' };

  const { data: chamados } = await supabase
    .from('sirene_chamados')
    .select('id, numero, incendio, tema, mapeamento_pericia')
    .not('tema', 'is', null)
    .not('mapeamento_pericia', 'is', null);
  const list = chamados ?? [];
  const { data: vinculados } = await supabase
    .from('sirene_pericia_chamados')
    .select('chamado_id');
  const idsVinculados = new Set((vinculados ?? []).map((v) => v.chamado_id));
  const pendentes = list.filter((c) => !idsVinculados.has(c.id));
  return { ok: true, chamados: pendentes };
}

/** Lista perícias do planejamento (autocomplete / filtro). */
export async function listPericias(busca?: string): Promise<
  | {
      ok: true;
      pericias: Array<{
        id: number;
        nome_pericia: string;
        time_responsavel: string | null;
        responsavel_id: string | null;
        responsavel_nome: string | null;
        data_inicio: string | null;
        status: string;
      }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };
  let q = supabase
    .from('sirene_pericias')
    .select('id, nome_pericia, time_responsavel, responsavel_id, responsavel_nome, data_inicio, status')
    .order('nome_pericia', { ascending: true });
  if (busca?.trim()) {
    q = q.ilike('nome_pericia', `%${busca.trim()}%`);
  }
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, pericias: data ?? [] };
}

/** Vincula chamado a uma perícia (Caneta Verde). Dados da perícia vêm do planejamento. */
export async function vincularChamadoPericia(
  chamadoId: number,
  periciaId: number,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };
  if (me.ctx.papel !== 'bombeiro' && me.ctx.papel !== 'caneta_verde')
    return { ok: false, error: 'Apenas Bombeiro ou Caneta Verde podem vincular perícia.' };

  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('id, tema, mapeamento_pericia')
    .eq('id', chamadoId)
    .single();
  if (!chamado || !chamado.tema || !chamado.mapeamento_pericia)
    return { ok: false, error: 'Chamado não encontrado ou sem tema/mapeamento preenchidos.' };

  const { data: pericia } = await supabase
    .from('sirene_pericias')
    .select('id, nome_pericia, time_responsavel, responsavel_id, responsavel_nome, data_inicio, status')
    .eq('id', periciaId)
    .single();
  if (!pericia) return { ok: false, error: 'Perícia não encontrada.' };

  const { error: insErr } = await supabase.from('sirene_pericia_chamados').insert({
    pericia_id: periciaId,
    chamado_id: chamadoId,
  });
  if (insErr) return { ok: false, error: insErr.message };
  revalidatePath('/sirene/pericias');
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/** Perícia vinculada ao chamado (para exibir no detalhe). */
export async function getPericiaDoChamado(chamadoId: number): Promise<
  | {
      ok: true;
      pericia: {
        id: number;
        nome_pericia: string;
        time_responsavel: string | null;
        responsavel_nome: string | null;
        data_inicio: string | null;
        status: string;
      } | null;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };

  const { data: vinc } = await supabase
    .from('sirene_pericia_chamados')
    .select('pericia_id')
    .eq('chamado_id', chamadoId)
    .limit(1)
    .maybeSingle();
  if (!vinc) return { ok: true, pericia: null };
  const { data: pericia } = await supabase
    .from('sirene_pericias')
    .select('id, nome_pericia, time_responsavel, responsavel_nome, data_inicio, status')
    .eq('id', vinc.pericia_id)
    .single();
  return { ok: true, pericia: pericia ?? null };
}

/** Lista perícias com chamados vinculados (planejamento). Filtros opcionais. */
export async function listPericiasComChamados(filtros?: {
  nome?: string;
  time?: string;
  status?: string;
}): Promise<
  | {
      ok: true;
      pericias: Array<{
        id: number;
        nome_pericia: string;
        time_responsavel: string | null;
        responsavel_nome: string | null;
        data_inicio: string | null;
        status: string;
        chamados: Array<{ id: number; numero: number; incendio: string }>;
      }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };
  let q = supabase
    .from('sirene_pericias')
    .select('id, nome_pericia, time_responsavel, responsavel_nome, data_inicio, status')
    .order('nome_pericia', { ascending: true });
  if (filtros?.nome?.trim()) q = q.ilike('nome_pericia', `%${filtros.nome.trim()}%`);
  if (filtros?.time?.trim()) q = q.eq('time_responsavel', filtros.time.trim());
  if (filtros?.status?.trim()) q = q.eq('status', filtros.status.trim());
  const { data: pericias, error } = await q;
  if (error) return { ok: false, error: error.message };
  const list = pericias ?? [];
  const { data: vinc } = await supabase.from('sirene_pericia_chamados').select('pericia_id, chamado_id');
  const porPericia = new Map<number, number[]>();
  for (const v of vinc ?? []) {
    if (!porPericia.has(v.pericia_id)) porPericia.set(v.pericia_id, []);
    porPericia.get(v.pericia_id)!.push(v.chamado_id);
  }
  const chamadoIds = [...new Set((vinc ?? []).map((v) => v.chamado_id))];
  const { data: chamadosList } =
    chamadoIds.length > 0
      ? await supabase.from('sirene_chamados').select('id, numero, incendio').in('id', chamadoIds)
      : { data: [] };
  const chamadosMap = new Map(
    (chamadosList ?? []).map((c) => [c.id, { id: c.id, numero: c.numero, incendio: c.incendio }]),
  );
  const result = list.map((p) => ({
    ...p,
    chamados: (porPericia.get(p.id) ?? []).map((cid) => chamadosMap.get(cid)!).filter(Boolean),
  }));
  return { ok: true, pericias: result };
}

/** Mensagens do chamado (comentários). */
export async function listMensagensChamado(chamadoId: number): Promise<
  | {
      ok: true;
      mensagens: Array<{
        id: number;
        autor_nome: string | null;
        autor_time: string | null;
        texto: string;
        created_at: string;
      }>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };
  const { data: c } = await supabase.from('sirene_chamados').select('id').eq('id', chamadoId).single();
  if (!c) return { ok: false, error: 'Chamado não encontrado.' };
  const { data, error } = await supabase
    .from('sirene_mensagens')
    .select('id, autor_nome, autor_time, texto, created_at')
    .eq('chamado_id', chamadoId)
    .order('created_at', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, mensagens: data ?? [] };
}

export type AtividadePastelariaMensagem = {
  id: number;
  autor_nome: string | null;
  autor_time: string | null;
  texto: string;
  created_at: string;
};

export type GetAtividadePastelariaResult =
  | { ok: true; hasVinculo: false }
  | {
      ok: true;
      hasVinculo: true;
      pastelCardId: string;
      coluna: string;
      colunaLabel: string;
      responsavelNome: string | null;
      mensagens: AtividadePastelariaMensagem[];
    }
  | { ok: false; error: string };

/** Feed somente leitura: pastel vinculado ao chamado + comentários Sirene (para card kanban de origem). */
export async function getAtividadePastelaria(
  sireneChamadoId: number,
): Promise<GetAtividadePastelariaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  if (!Number.isFinite(sireneChamadoId)) {
    return { ok: false, error: 'Chamado inválido.' };
  }

  const admin = createAdminClient();

  const { data: vinculo, error: vincErr } = await admin
    .from('sirene_pastelaria_vinculos')
    .select('pastelaria_card_id')
    .eq('sirene_chamado_id', sireneChamadoId)
    .maybeSingle();

  if (vincErr) return { ok: false, error: vincErr.message };
  const pastelCardId = (vinculo as { pastelaria_card_id?: string } | null)?.pastelaria_card_id;
  if (!pastelCardId) return { ok: true, hasVinculo: false };

  const { data: card, error: cardErr } = await admin
    .from('pastelaria_cards')
    .select('coluna, responsavel_nome, responsavel_id, area_pessoas!responsavel_id(nome)')
    .eq('id', pastelCardId)
    .maybeSingle();

  if (cardErr) return { ok: false, error: cardErr.message };
  if (!card) return { ok: true, hasVinculo: false };

  const row = card as {
    coluna: string;
    responsavel_nome: string | null;
    area_pessoas?: { nome: string } | { nome: string }[] | null;
  };
  const pessoaJoin = row.area_pessoas;
  const pessoaNome = Array.isArray(pessoaJoin)
    ? pessoaJoin[0]?.nome?.trim()
    : pessoaJoin?.nome?.trim();
  const responsavelNome = pessoaNome || row.responsavel_nome?.trim() || null;

  const msgs = await listMensagensChamado(sireneChamadoId);
  if (!msgs.ok) return { ok: false, error: msgs.error };

  return {
    ok: true,
    hasVinculo: true,
    pastelCardId,
    coluna: row.coluna,
    colunaLabel: labelPastelariaColuna(row.coluna),
    responsavelNome,
    mensagens: msgs.mensagens,
  };
}

/** Participantes do chamado (para autocomplete @pessoa): criador, bombeiros, times dos tópicos. */
export async function getParticipantesChamado(chamadoId: number): Promise<
  | { ok: true; participantes: Array<{ id: string; nome: string }> }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };
  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('aberto_por')
    .eq('id', chamadoId)
    .single();
  if (!chamado) return { ok: false, error: 'Chamado não encontrado.' };
  const ids = new Set<string>();
  if ((chamado as { aberto_por?: string }).aberto_por) ids.add((chamado as { aberto_por: string }).aberto_por);
  const { data: bombeiros } = await supabase.from('sirene_papeis').select('user_id').eq('papel', 'bombeiro');
  for (const b of bombeiros ?? []) ids.add(b.user_id);
  const { data: topicos } = await supabase
    .from('sirene_topicos')
    .select('responsavel_id, time_responsavel')
    .eq('chamado_id', chamadoId);
  const times = new Set<string>();
  for (const t of topicos ?? []) {
    if (t.responsavel_id) ids.add(t.responsavel_id);
    if ((t as { time_responsavel?: string }).time_responsavel)
      times.add((t as { time_responsavel: string }).time_responsavel);
  }
  if (times.size > 0) {
    const { data: byTime } = await supabase.from('profiles').select('id').in('time', [...times]);
    for (const p of byTime ?? []) ids.add(p.id);
  }
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', [...ids]);
  const participantes = (profiles ?? []).map((p) => ({
    id: p.id,
    nome: (p.full_name as string)?.trim() || 'Sem nome',
  }));
  return { ok: true, participantes };
}

/** Enviar comentário no chamado. Parse @nome e cria notificações tipo mencao_comentario. */
export async function enviarMensagemChamado(
  chamadoId: number,
  texto: string,
): Promise<SireneActionResult> {
  const supabase = await createClient();
  const me = await getSireneUserContext(supabase);
  if (!me) return { ok: false, error: 'Faça login.' };
  const { data: chamado } = await supabase
    .from('sirene_chamados')
    .select('id, numero, incendio, tema')
    .eq('id', chamadoId)
    .single();
  if (!chamado) return { ok: false, error: 'Chamado não encontrado.' };
  const textoTrim = texto?.trim();
  if (!textoTrim) return { ok: false, error: 'Digite um comentário.' };

  const { plain, mencoesIds } = await resolverMencoesSirene(textoTrim);
  if (!plain) return { ok: false, error: 'Digite um comentário.' };

  const { data: msgData, error: msgErr } = await supabase
    .from('sirene_mensagens')
    .insert({
      chamado_id: chamadoId,
      autor_id: me.userId,
      autor_nome: me.userName,
      autor_time: me.ctx.time ?? undefined,
      texto: plain,
      mencoes: mencoesIds.length > 0 ? mencoesIds : null,
    })
    .select('id')
    .single();
  if (msgErr) return { ok: false, error: msgErr.message };
  const numero = (chamado as { numero?: number })?.numero ?? chamadoId;
  const temaCh = ((chamado as { tema?: string | null }).tema ?? '').trim();
  const incendioCh = ((chamado as { incendio?: string | null }).incendio ?? '').trim();
  const tituloChamadoNotif = temaCh || incendioCh || `Chamado #${numero}`;
  const tituloChamadoEsc = tituloChamadoNotif.replace(/"/g, "'");
  const tituloAvisoMencao = '@você foi mencionado em um chamado';
  const mensagemMencao = `${me.userName} te mencionou no chamado "${tituloChamadoEsc}"`;
  const mencoesParaOutros = mencoesIds.filter((uid) => uid !== me.userId);
  if (mencoesParaOutros.length > 0 && msgData?.id) {
    await supabase.from('chamado_mencoes').insert(
      mencoesParaOutros.map((uid) => ({
        comentario_id: msgData.id,
        mencionado_id: uid,
        chamado_id: chamadoId,
      })),
    );
  }
  for (const uid of mencoesParaOutros) {
    await inserirNotificacao(supabase, uid, chamadoId, 'mencao_comentario', mensagemMencao, null, {
      titulo: tituloAvisoMencao,
      mensagem: mensagemMencao,
      referencia_id: chamadoId,
    });
  }
  await notificarMencoesSirene({
    mencoesIds,
    plain,
    referenciaPath: `/sirene/${chamadoId}`,
    contextoTitulo: tituloChamadoNotif,
    autorId: me.userId,
  });
  revalidatePath(`/sirene/${chamadoId}`);
  return { ok: true };
}

/** Busca usuários internos para autocomplete de @menção. Exclui roles frank/franqueado. */
export async function buscarUsuariosInternos(
  query: string,
): Promise<{ id: string; nome: string; avatar_url: string | null }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const q = query.trim();
  if (!q) return [];

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .not('role', 'in', '("frank","franqueado")')
    .ilike('full_name', `%${q}%`)
    .order('full_name', { ascending: true })
    .limit(10);

  return (data ?? []).map((p) => ({
    id: p.id as string,
    nome: ((p.full_name as string) ?? '').trim() || 'Sem nome',
    avatar_url: null,
  }));
}

/** Insere uma linha em chamado_mencoes por mencionado. Ignora duplicatas silenciosamente. */
export async function inserirMencoes(
  comentarioId: number,
  chamadoId: number,
  idsMencionados: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (idsMencionados.length === 0) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.from('chamado_mencoes').insert(
    idsMencionados.map((uid) => ({
      comentario_id: comentarioId,
      mencionado_id: uid,
      chamado_id: chamadoId,
    })),
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Resumo de notificações para o sino no header (não lidas + últimas). */
export async function getNotificacoesResumo(): Promise<{
  totalNaoLidas: number;
  ultimas: Array<{
    id: number;
    chamado_id: number | null;
    tipo: string;
    texto: string | null;
    titulo: string | null;
    mensagem: string | null;
    referencia_id: number | null;
    lida: boolean;
    created_at: string;
  }>;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { totalNaoLidas: 0, ultimas: [] };

  const { data: list } = await supabase
    .from('sirene_notificacoes')
    .select('id, chamado_id, tipo, texto, titulo, mensagem, referencia_id, lida, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const ultimas = (list ?? []) as Array<{
    id: number;
    chamado_id: number | null;
    tipo: string;
    texto: string | null;
    titulo: string | null;
    mensagem: string | null;
    referencia_id: number | null;
    lida: boolean;
    created_at: string;
  }>;
  const totalNaoLidas = ultimas.filter((n) => !n.lida).length;
  return { totalNaoLidas, ultimas };
}

/** Marcar notificação como lida (ao clicar no sino). */
export async function marcarNotificacaoLida(notificacaoId: number): Promise<SireneActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { error } = await supabase
    .from('sirene_notificacoes')
    .update({ lida: true })
    .eq('id', notificacaoId)
    .eq('user_id', user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/sirene');
  revalidatePath('/sirene/chamados');
  revalidatePath('/sirene/kanban');
  revalidatePath('/sirene/pericias');
  return { ok: true };
}
