import type { SupabaseClient } from '@supabase/supabase-js';
import type { SubInteracaoStatusDb } from '@/lib/actions/card-actions';
import { filterKanbanAtividadeIds } from '@/lib/pastelaria/synthetic-id';
import type { SubInteracaoTipoDb } from '@/types/kanban-subinteracao';
import {
  camposPrazoNegociacaoDeTopicoRow,
  normalizarStatusInteracaoKanban,
  type InteracaoModal,
  type KanbanTimeRow,
  type SubInteracaoModal,
} from '@/components/kanban-shared/kanban-card-modal-helpers';

const INTERACOES_SELECT =
  'id, titulo, descricao, categoria, tipo, times_ids, responsaveis_ids, trava, status, prioridade, data_vencimento, responsavel_id, responsavel_nome_texto, time, created_at, concluida_em, origem, criado_por, arquivado, sirene_chamado_id, numero';

const TOPICOS_SELECT =
  'id, interacao_id, nome, descricao, descricao_detalhe, tipo, times_ids, responsaveis_ids, data_fim, prazo_proposto, prazo_status, prazo_abridor_id, prazo_proposto_por, prazo_negociacao_expira_em, prazo_sla_original, status, trava, pastel, historico, arquivado, atribuicao_status, atribuicao_recusado_por, atribuicao_justificativa';

let timesCache: KanbanTimeRow[] | null = null;

export async function fetchKanbanTimesCached(supabase: SupabaseClient): Promise<KanbanTimeRow[]> {
  if (timesCache) return timesCache;
  const { data } = await supabase.from('kanban_times').select('id, nome').order('nome');
  timesCache = (data ?? []).map((r) => ({ id: String(r.id), nome: String(r.nome) }));
  return timesCache;
}

async function fetchAtividadesDoCard(
  supabase: SupabaseClient,
  cardId: string,
): Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> {
  const first = await supabase
    .from('kanban_atividades')
    .select(INTERACOES_SELECT)
    .eq('card_id', cardId)
    .order('ordem', { ascending: true });
  if (first.error && /ordem/i.test(first.error.message)) {
    const fallback = await supabase
      .from('kanban_atividades')
      .select(INTERACOES_SELECT)
      .eq('card_id', cardId)
      .order('created_at', { ascending: true });
    return {
      data: (fallback.data ?? null) as Record<string, unknown>[] | null,
      error: fallback.error,
    };
  }
  return {
    data: (first.data ?? null) as Record<string, unknown>[] | null,
    error: first.error,
  };
}

async function fetchProfilesMap(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, { full_name: string | null }>> {
  const uniq = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const { data } = await supabase.from('profiles').select('id, full_name').in('id', uniq);
  return new Map(
    (data ?? []).map((r) => [
      String((r as { id: string }).id),
      { full_name: (r as { full_name?: string | null }).full_name ?? null },
    ]),
  );
}

function mapAtividadeParaInteracao(
  a: Record<string, unknown>,
  nomePorTimeId: Map<string, string>,
  responsaveisMap: Map<string, { full_name: string | null }>,
): InteracaoModal {
  const rawIds = a.times_ids;
  const ids = Array.isArray(rawIds) ? rawIds.map((x) => String(x)) : [];
  const rawR = a.responsaveis_ids;
  let respIds = Array.isArray(rawR) ? rawR.map((x) => String(x)) : [];
  const rid = a.responsavel_id ? String(a.responsavel_id) : null;
  if (respIds.length === 0 && rid) respIds = [rid];
  const tipoRaw = a.tipo;
  const tipo: InteracaoModal['tipo'] =
    tipoRaw === 'duvida' ? 'duvida' : tipoRaw === 'proposicoes' ? 'proposicoes' : 'atividade';
  const primeiroResp = respIds[0] ?? rid;
  const cp = a.criado_por;
  const rnt = a.responsavel_nome_texto;
  const n = Number(a.numero);
  const sid = a.sirene_chamado_id;
  return {
    id: String(a.id),
    titulo: String(a.titulo ?? ''),
    descricao: (a.descricao as string | null) ?? null,
    categoria: a.categoria === 'melhoria' ? 'melhoria' : 'chamado',
    tipo,
    times_ids: ids,
    responsaveis_ids: respIds,
    trava: Boolean(a.trava),
    status: normalizarStatusInteracaoKanban(a.status),
    prioridade: (a.prioridade as InteracaoModal['prioridade']) ?? 'normal',
    data_vencimento: (a.data_vencimento as string | null) ?? null,
    responsavel_id: rid,
    responsavel_nome_texto: rnt != null && String(rnt).trim() !== '' ? String(rnt).trim() : null,
    time: (a.time as string | null) ?? null,
    created_at: String(a.created_at),
    concluida_em: (a.concluida_em as string | null) ?? null,
    criado_por: cp != null && String(cp).trim() !== '' ? String(cp) : null,
    profiles: primeiroResp ? responsaveisMap.get(primeiroResp) ?? null : null,
    times_resolvidos: ids.map((id) => ({ id, nome: nomePorTimeId.get(id) ?? id.slice(0, 8) })),
    responsaveis_resolvidos: respIds.map((id) => ({
      id,
      nome: responsaveisMap.get(id)?.full_name?.trim() || id.slice(0, 8),
    })),
    arquivado: Boolean(a.arquivado),
    numero: Number.isFinite(n) ? n : null,
    sirene_chamado_id: (() => {
      if (sid == null || sid === '') return null;
      const num = Number(sid);
      return Number.isFinite(num) ? num : null;
    })(),
  };
}

function mapTopicoParaSub(
  t: Record<string, unknown>,
  timeTopMap: Map<string, string>,
  profTop: Map<string, { full_name: string | null }>,
): SubInteracaoModal {
  const iid = String(t.interacao_id);
  const rawTi = t.times_ids;
  const ti = Array.isArray(rawTi) ? rawTi.map((x) => String(x)) : [];
  const rawRi = t.responsaveis_ids;
  const ri = Array.isArray(rawRi) ? rawRi.map((x) => String(x)) : [];
  const st = String(t.status ?? 'nao_iniciado') as SubInteracaoStatusDb;
  const tipoRaw = String(t.tipo ?? 'atividade').toLowerCase();
  const tipoSub: SubInteracaoTipoDb =
    tipoRaw === 'duvida' || tipoRaw === 'chamado' || tipoRaw === 'proposicoes'
      ? (tipoRaw as SubInteracaoTipoDb)
      : 'atividade';
  return {
    id: String(t.id),
    interacao_id: iid,
    tipo: tipoSub,
    nome: String(t.nome ?? t.descricao ?? ''),
    descricao: String(t.descricao ?? ''),
    descricao_detalhe: (t.descricao_detalhe as string | null) ?? null,
    times_ids: ti,
    responsaveis_ids: ri,
    times_resolvidos: ti.map((id) => ({ id, nome: timeTopMap.get(id) ?? id.slice(0, 8) })),
    responsaveis_resolvidos: ri.map((id) => ({
      id,
      nome: profTop.get(id)?.full_name?.trim() || id.slice(0, 8),
    })),
    data_fim: t.data_fim != null ? String(t.data_fim).slice(0, 10) : null,
    ...camposPrazoNegociacaoDeTopicoRow(t),
    status: ['nao_iniciado', 'em_andamento', 'concluido', 'aprovado'].includes(st) ? st : 'nao_iniciado',
    trava: Boolean(t.trava),
    pastel: Boolean(t.pastel),
    historico: Array.isArray(t.historico)
      ? ((t.historico as Array<{ tipo: string; em: string }>) ?? [])
      : [],
    atribuicao_status: (t.atribuicao_status as string | null) ?? null,
    atribuicao_recusado_por: (t.atribuicao_recusado_por as string | null) ?? null,
    atribuicao_justificativa: (t.atribuicao_justificativa as string | null) ?? null,
  };
}

export type CarregarChamadosCardModalOpts = {
  supabase: SupabaseClient;
  cardId: string;
  stillCurrent: () => boolean;
  onTimes: (times: KanbanTimeRow[]) => void;
  onInteracoes: (rows: InteracaoModal[]) => void;
  onSubs: (porPai: Record<string, SubInteracaoModal[]>) => void;
};

export async function carregarChamadosDoCardModal(
  opts: CarregarChamadosCardModalOpts,
): Promise<{ error: string | null }> {
  const { supabase, cardId, stillCurrent, onTimes, onInteracoes, onSubs } = opts;
  try {
    const [times, ativRes] = await Promise.all([
      fetchKanbanTimesCached(supabase),
      fetchAtividadesDoCard(supabase, cardId),
    ]);
    if (!stillCurrent()) return { error: null };
    onTimes(times);

    if (ativRes.error) {
      onInteracoes([]);
      onSubs({});
      return { error: ativRes.error.message };
    }

    const interacoesData = ativRes.data ?? [];
    if (interacoesData.length === 0) {
      onInteracoes([]);
      onSubs({});
      return { error: null };
    }

    const nomePorTimeId = new Map(times.map((t) => [t.id, t.nome]));
    const rascunho = interacoesData
      .map((a) => mapAtividadeParaInteracao(a, nomePorTimeId, new Map()))
      .filter((a) => !a.arquivado);
    onInteracoes(rascunho);

    const respFromArrays = interacoesData.flatMap((a) => {
      const arr = a.responsaveis_ids;
      return Array.isArray(arr) ? arr.map((x) => String(x)) : [];
    });
    const responsavelIds = [
      ...new Set([...interacoesData.map((a) => a.responsavel_id).filter(Boolean).map(String), ...respFromArrays]),
    ];
    const actIds = filterKanbanAtividadeIds(rascunho.map((m) => m.id));

    const [responsaveisMap, topicosRows] = await Promise.all([
      fetchProfilesMap(supabase, responsavelIds),
      actIds.length > 0
        ? supabase
            .from('sirene_topicos')
            .select(TOPICOS_SELECT)
            .eq('arquivado', false)
            .in('interacao_id', actIds)
            .order('ordem', { ascending: true })
            .then((res) => res.data ?? [])
        : Promise.resolve([] as Record<string, unknown>[]),
    ]);
    if (!stillCurrent()) return { error: null };

    const enriquecidas = interacoesData
      .map((a) => mapAtividadeParaInteracao(a, nomePorTimeId, responsaveisMap))
      .filter((a) => !a.arquivado);
    onInteracoes(enriquecidas);

    const topicos = (topicosRows ?? []) as Record<string, unknown>[];
    const tRespIds = [
      ...new Set(
        topicos.flatMap((t) => {
          const arr = t.responsaveis_ids;
          return Array.isArray(arr) ? arr.map((x) => String(x)) : [];
        }),
      ),
    ].filter((id) => !responsaveisMap.has(id));
    const profTopExtra = tRespIds.length > 0 ? await fetchProfilesMap(supabase, tRespIds) : new Map();
    if (!stillCurrent()) return { error: null };
    const profTop = new Map([...responsaveisMap.entries(), ...profTopExtra.entries()]);

    const porPai: Record<string, SubInteracaoModal[]> = {};
    for (const t of topicos) {
      const row = mapTopicoParaSub(t, nomePorTimeId, profTop);
      if (!porPai[row.interacao_id]) porPai[row.interacao_id] = [];
      porPai[row.interacao_id]!.push(row);
    }
    onSubs(porPai);
    return { error: null };
  } catch (e) {
    console.error('[carregarChamadosDoCardModal]', e);
    if (stillCurrent()) {
      onInteracoes([]);
      onSubs({});
    }
    return { error: 'Erro inesperado ao carregar chamados.' };
  }
}
