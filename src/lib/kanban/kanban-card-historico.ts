import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanFase } from '@/components/kanban-shared/types';
import type { HistoricoItem } from '@/components/kanban-shared/kanban-card-modal-helpers';
import { fetchKanbanFasesAtivas } from '@/lib/kanban/fetch-kanban-fases';
import { CALCULADORA_ESTEIRA_KANBAN_IDS, fetchCalculadoraEsteiraFasesMap } from '@/lib/kanban/calculadora-fases-esteira';
import { listarCardIdsSyncGroup } from '@/lib/kanban/card-sync-group';
import {
  buildNativeFaseVisits,
  mergeFaseVisitsSyncGroup,
  type FaseVisit,
} from '@/lib/kanban/kanban-card-timeline';

type ProcessoEventoRow = {
  id: string;
  autor_nome: string | null;
  tipo: string;
  descricao: string | null;
  created_at: string;
  detalhes: Record<string, unknown> | null;
};

type HistoricoCardIds = {
  /** IDs usados em `kanban_historico.card_id` (nativo + legado/shadow). */
  cardIds: string[];
  /** IDs base para `processo_card_eventos.processo_id` (com historico_base_id). */
  processoIds: string[];
};

function detStr(d: Record<string, unknown> | null | undefined, key: string): string {
  if (!d) return '';
  const v = d[key];
  return typeof v === 'string' ? v.trim() : '';
}

function mapCardMoveLegado(evt: ProcessoEventoRow, fases: KanbanFase[]): HistoricoItem {
  const fromSlug = detStr(evt.detalhes, 'from');
  const toSlug = detStr(evt.detalhes, 'to');
  const fromFase = fases.find((f) => f.slug?.trim() === fromSlug);
  const toFase = fases.find((f) => f.slug?.trim() === toSlug);
  const ordemFrom = fromFase?.ordem ?? 0;
  const ordemTo = toFase?.ordem ?? 0;
  const retro = fromFase && toFase ? ordemTo < ordemFrom : false;
  return {
    id: `proc-evt-${evt.id}`,
    acao: retro ? 'fase_retrocedida' : 'fase_avancada',
    usuario_nome: evt.autor_nome?.trim() || null,
    detalhe: {
      fase_anterior_nome: fromFase?.nome ?? fromSlug,
      fase_nova_nome: toFase?.nome ?? toSlug,
      from_slug: fromSlug,
      to_slug: toSlug,
    },
    criado_em: evt.created_at,
  };
}

function mapProcessoEventoGenerico(evt: ProcessoEventoRow): HistoricoItem {
  const desc = (evt.descricao ?? '').trim() || evt.tipo.replace(/_/g, ' ');
  return {
    id: `proc-evt-${evt.id}`,
    acao: 'campo_alterado',
    usuario_nome: evt.autor_nome?.trim() || null,
    detalhe: {
      descricao: desc,
      tipo_evento: evt.tipo,
      ...(evt.detalhes ?? {}),
    },
    criado_em: evt.created_at,
  };
}

async function resolveHistoricoBaseId(
  supabase: SupabaseClient,
  processoId: string,
): Promise<string> {
  const pid = String(processoId ?? '').trim();
  if (!pid) return pid;
  const { data } = await supabase
    .from('processo_step_one')
    .select('historico_base_id')
    .eq('id', pid)
    .maybeSingle();
  return (data as { historico_base_id?: string | null } | null)?.historico_base_id?.trim() || pid;
}

/** Resolve IDs nativo/legado para merge de histórico unificado. */
export async function resolveHistoricoCardIds(
  supabase: SupabaseClient,
  cardId: string,
  origem: 'legado' | 'nativo',
  processoStepOneId?: string | null,
): Promise<HistoricoCardIds> {
  const cid = String(cardId ?? '').trim();
  const cardIds = new Set<string>();
  const processoRaw = new Set<string>();

  if (cid) cardIds.add(cid);

  const procHint = String(processoStepOneId ?? '').trim();
  if (procHint) processoRaw.add(procHint);

  if (origem === 'legado' && cid) {
    processoRaw.add(cid);
  }

  if (cid) {
    const { data: cardRow } = await supabase
      .from('kanban_cards')
      .select('processo_step_one_id')
      .eq('id', cid)
      .maybeSingle();
    const fromCard = String(
      (cardRow as { processo_step_one_id?: string | null } | null)?.processo_step_one_id ?? '',
    ).trim();
    if (fromCard) processoRaw.add(fromCard);

    const { data: procAsCard } = await supabase
      .from('processo_step_one')
      .select('id')
      .eq('id', cid)
      .maybeSingle();
    if (procAsCard?.id) processoRaw.add(String(procAsCard.id));
  }

  const processoIds = new Set<string>();
  for (const pid of processoRaw) {
    const base = await resolveHistoricoBaseId(supabase, pid);
    processoIds.add(base);
    cardIds.add(base);
    if (base !== pid) cardIds.add(pid);
  }

  for (const pid of processoIds) {
    cardIds.add(pid);
  }

  return {
    cardIds: [...cardIds].filter(Boolean),
    processoIds: [...processoIds].filter(Boolean),
  };
}

function dedupeHistoricoItems(items: HistoricoItem[]): HistoricoItem[] {
  const seen = new Set<string>();
  const unique: HistoricoItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }
  unique.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
  return unique;
}

async function fetchKanbanHistoricoRows(
  supabase: SupabaseClient,
  cardIds: string[],
): Promise<HistoricoItem[]> {
  if (cardIds.length === 0) return [];

  const { data: histRows, error: histErr } = await supabase
    .from('kanban_historico')
    .select('id, acao, usuario_nome, detalhe, criado_em')
    .in('card_id', cardIds);

  if (histErr || !histRows?.length) return [];

  return histRows.map((h) => ({
    id: String(h.id),
    acao: String(h.acao),
    usuario_nome: (h.usuario_nome as string | null) ?? null,
    detalhe: (h.detalhe as Record<string, unknown> | null) ?? null,
    criado_em: String(h.criado_em),
  }));
}

async function fetchProcessoEventosRows(
  supabase: SupabaseClient,
  processoIds: string[],
  fases: KanbanFase[],
): Promise<HistoricoItem[]> {
  if (processoIds.length === 0) return [];

  const { data: evRows } = await supabase
    .from('processo_card_eventos')
    .select('id, autor_nome, tipo, descricao, created_at, detalhes')
    .in('processo_id', processoIds);

  const merged: HistoricoItem[] = [];
  for (const raw of evRows ?? []) {
    const evt = raw as ProcessoEventoRow;
    const tipo = String(evt.tipo ?? '').trim();
    if (tipo === 'card_move') {
      merged.push(mapCardMoveLegado(evt, fases));
    } else if (tipo && tipo !== 'comentario_add') {
      merged.push(mapProcessoEventoGenerico(evt));
    }
  }
  return merged;
}

/** Carrega histórico unificado do modal (nativo + legado quando houver processo Step One). */
export async function loadHistoricoCardModal(
  supabase: SupabaseClient,
  cardId: string,
  origem: 'legado' | 'nativo',
  fases: KanbanFase[],
  kanbanId?: string,
  processoStepOneId?: string | null,
): Promise<HistoricoItem[]> {
  let fasesResolved = fases;
  if (fasesResolved.length === 0 && kanbanId) {
    fasesResolved = await fetchKanbanFasesAtivas(supabase, kanbanId);
  }

  const ids = await resolveHistoricoCardIds(supabase, cardId, origem, processoStepOneId);

  const [nativo, legado] = await Promise.all([
    fetchKanbanHistoricoRows(supabase, ids.cardIds),
    fetchProcessoEventosRows(supabase, ids.processoIds, fasesResolved),
  ]);

  return dedupeHistoricoItems([...nativo, ...legado]);
}

/** Histórico agregado do grupo de sync nos funis da esteira principal (calculadora global). */
export async function loadHistoricoCalculadoraEsteira(
  supabase: SupabaseClient,
  cardId: string,
  origem: 'legado' | 'nativo',
  fasesPorKanban: Map<string, KanbanFase[]>,
  processoStepOneId?: string | null,
): Promise<HistoricoItem[]> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return [];

  let fasesMap = fasesPorKanban;
  if ([...fasesMap.values()].every((list) => list.length === 0)) {
    fasesMap = await fetchCalculadoraEsteiraFasesMap(supabase);
  }

  const groupIds = await listarCardIdsSyncGroup(supabase, cid);
  const { data: cardRows } = await supabase
    .from('kanban_cards')
    .select('id, kanban_id, processo_step_one_id')
    .in('id', groupIds)
    .in('kanban_id', [...CALCULADORA_ESTEIRA_KANBAN_IDS]);

  const merged: HistoricoItem[] = [];
  for (const row of cardRows ?? []) {
    const id = String((row as { id?: string | null }).id ?? '').trim();
    const kid = String((row as { kanban_id?: string | null }).kanban_id ?? '').trim();
    const procId = String((row as { processo_step_one_id?: string | null }).processo_step_one_id ?? '').trim() || null;
    if (!id || !kid) continue;
    const fases = fasesMap.get(kid) ?? [];
    const procForCard = id === cid ? processoStepOneId ?? procId : procId;
    const hist = await loadHistoricoCardModal(supabase, id, origem, fases, kid, procForCard);
    merged.push(...hist);
  }

  return dedupeHistoricoItems(merged);
}

/** Visitas agregadas por card do sync group — cada card com seu histórico, mescladas por fase. */
export async function buildVisitsCalculadoraEsteiraSyncGroup(
  supabase: SupabaseClient,
  cardId: string,
  origem: 'legado' | 'nativo',
  fasesPorKanban: Map<string, KanbanFase[]>,
  processoStepOneId?: string | null,
): Promise<FaseVisit[]> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return [];

  let fasesMap = fasesPorKanban;
  if ([...fasesMap.values()].every((list) => list.length === 0)) {
    fasesMap = await fetchCalculadoraEsteiraFasesMap(supabase);
  }

  const fasesFlat: KanbanFase[] = [];
  for (const kid of CALCULADORA_ESTEIRA_KANBAN_IDS) {
    fasesFlat.push(...(fasesMap.get(kid) ?? []));
  }
  if (fasesFlat.length === 0) return [];

  const groupIds = await listarCardIdsSyncGroup(supabase, cid);
  const { data: cardRows } = await supabase
    .from('kanban_cards')
    .select('id, kanban_id, created_at, fase_id, processo_step_one_id')
    .in('id', groupIds)
    .in('kanban_id', [...CALCULADORA_ESTEIRA_KANBAN_IDS]);

  const allVisits: FaseVisit[] = [];
  for (const row of cardRows ?? []) {
    const id = String((row as { id?: string | null }).id ?? '').trim();
    const kid = String((row as { kanban_id?: string | null }).kanban_id ?? '').trim();
    const procId = String((row as { processo_step_one_id?: string | null }).processo_step_one_id ?? '').trim() || null;
    if (!id || !kid) continue;
    const fases = fasesMap.get(kid) ?? [];
    const procForCard = id === cid ? processoStepOneId ?? procId : procId;
    const hist = await loadHistoricoCardModal(supabase, id, origem, fases, kid, procForCard);
    const movimentos = hist.map((h) => ({
      acao: h.acao,
      detalhe: h.detalhe,
      criado_em: h.criado_em,
    }));
    allVisits.push(
      ...buildNativeFaseVisits(
        fasesFlat,
        {
          created_at: String((row as { created_at?: string }).created_at ?? ''),
          fase_id: String((row as { fase_id?: string }).fase_id ?? ''),
        },
        movimentos,
      ),
    );
  }

  return mergeFaseVisitsSyncGroup(allVisits);
}
