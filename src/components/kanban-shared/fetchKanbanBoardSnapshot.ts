import type { SupabaseClient } from '@supabase/supabase-js';
import { parseKanbanFaseMateriais } from '@/lib/kanban/parse-kanban-fase-materiais';
import type { KanbanCardBrief, KanbanFase } from './types';

export type KanbanBoardSnapshot = {
  kanban: { id: string } | null;
  fases: KanbanFase[];
  /** Cards ativos: não arquivados e não concluídos (board padrão). */
  cards: KanbanCardBrief[];
  /** Nativo: cards finalizados (toggle “Mostrar concluídos”). Legado: []. */
  cardsConcluidos: KanbanCardBrief[];
  role: string;
  isAdmin: boolean;
};

type ViewLegadoRow = {
  id: string;
  kanban_id: string;
  fase_id: string;
  titulo: string;
  status: string;
  criado_em: string;
  responsavel_id: string | null;
  etapa_slug: string | null;
  origem: string | null;
};

/**
 * Carrega fases e cards do kanban pelo nome (`kanbans.nome`).
 * Cards nativos ativos: `arquivado = false` e `concluido = false`; concluídos vêm em `cardsConcluidos`.
 * Sem `userId` (ex.: visitante com service role): não filtra por franqueado e assume visão ampla.
 *
 * Se não houver linhas em `kanban_cards` para o kanban, os cards vêm de
 * `v_processo_como_kanban_cards` (processo_step_one) com `origem: 'legado'`.
 */
export async function fetchKanbanBoardSnapshot(
  supabase: SupabaseClient,
  kanbanNomeDb: string,
  userId: string | null,
): Promise<KanbanBoardSnapshot> {
  let role = 'frank';
  let isAdmin = false;
  if (userId) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
    role = (profile?.role as string) ?? 'frank';
    isAdmin =
      role === 'admin' || role === 'consultor' || role === 'supervisor' || role === 'team';
  } else {
    isAdmin = true;
  }

  const { data: kanbans } = await supabase
    .from('kanbans')
    .select('id')
    .eq('nome', kanbanNomeDb)
    .eq('ativo', true)
    .limit(1);

  const kanban = kanbans?.[0] ?? null;
  if (!kanban) {
    return { kanban: null, fases: [], cards: [], cardsConcluidos: [], role, isAdmin };
  }

  const kanbanIdStr = String(kanban.id);

  const { data: fasesRows } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias, slug, instrucoes, materiais')
    .eq('kanban_id', kanban.id)
    .eq('ativo', true)
    .order('ordem');

  const fases: KanbanFase[] = (fasesRows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      nome: String(r.nome ?? ''),
      ordem: Number(r.ordem ?? 0),
      sla_dias: r.sla_dias != null && r.sla_dias !== '' ? Number(r.sla_dias) : null,
      slug: r.slug != null ? String(r.slug) : null,
      instrucoes: r.instrucoes != null ? String(r.instrucoes) : null,
      materiais: parseKanbanFaseMateriais(r.materiais),
    };
  });

  const { count: nativeCount } = await supabase
    .from('kanban_cards')
    .select('*', { count: 'exact', head: true })
    .eq('kanban_id', kanban.id);

  const useLegadoView = (nativeCount ?? 0) === 0;

  let cards: KanbanCardBrief[] = [];

  if (useLegadoView) {
    let viewQuery = supabase
      .from('v_processo_como_kanban_cards')
      .select('id, kanban_id, fase_id, titulo, status, criado_em, responsavel_id, etapa_slug, origem')
      .eq('kanban_id', kanban.id)
      .order('criado_em', { ascending: false });

    if (userId && !isAdmin) {
      viewQuery = viewQuery.eq('responsavel_id', userId);
    }

    const { data: rowsRaw } = await viewQuery;
    const rows = (rowsRaw ?? []) as ViewLegadoRow[];

    const franqueadoIds = [...new Set(rows.map((r) => r.responsavel_id).filter(Boolean))] as string[];
    const profilesMap = new Map<string, { full_name: string | null }>();
    if (franqueadoIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', franqueadoIds);
      profiles?.forEach((p) => {
        profilesMap.set(p.id, { full_name: p.full_name });
      });
    }

    cards = rows.map((r) => ({
      id: String(r.id),
      titulo: String(r.titulo ?? ''),
      status: String(r.status ?? ''),
      created_at: String(r.criado_em ?? ''),
      fase_id: String(r.fase_id ?? ''),
      franqueado_id: String(r.responsavel_id ?? ''),
      arquivado: false,
      motivo_arquivamento: null,
      concluido: false,
      concluido_em: null,
      origem: 'legado' as const,
      profiles: r.responsavel_id ? profilesMap.get(String(r.responsavel_id)) ?? null : null,
    }));
    return {
      kanban: { id: kanbanIdStr },
      fases,
      cards,
      cardsConcluidos: [],
      role,
      isAdmin,
    };
  }

  const selectCols = `
      id,
      titulo,
      status,
      created_at,
      fase_id,
      franqueado_id,
      arquivado,
      motivo_arquivamento,
      concluido,
      concluido_em
    `;

  let cardsQuery = supabase
    .from('kanban_cards')
    .select(selectCols)
    .eq('kanban_id', kanban.id)
    .eq('status', 'ativo')
    .eq('concluido', false)
    .order('created_at', { ascending: false });

  let concluidosQuery = supabase
    .from('kanban_cards')
    .select(selectCols)
    .eq('kanban_id', kanban.id)
    .eq('status', 'ativo')
    .eq('arquivado', false)
    .eq('concluido', true)
    .order('created_at', { ascending: false });

  if (userId && !isAdmin) {
    cardsQuery = cardsQuery.eq('franqueado_id', userId);
    concluidosQuery = concluidosQuery.eq('franqueado_id', userId);
  }

  const [{ data: cardsRaw }, { data: conclRaw }] = await Promise.all([cardsQuery, concluidosQuery]);

  const franqueadoIds = [
    ...new Set([...(cardsRaw?.map((c) => c.franqueado_id) ?? []), ...(conclRaw?.map((c) => c.franqueado_id) ?? [])]),
  ].filter(Boolean) as string[];
  const profilesMap = new Map<string, { full_name: string | null }>();
  if (franqueadoIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', franqueadoIds);
    profiles?.forEach((p) => {
      profilesMap.set(p.id, { full_name: p.full_name });
    });
  }

  const mapNativo = (c: Record<string, unknown>): KanbanCardBrief => ({
    id: String(c.id),
    titulo: String(c.titulo ?? ''),
    status: String(c.status ?? ''),
    created_at: String(c.created_at ?? ''),
    fase_id: String(c.fase_id ?? ''),
    franqueado_id: String(c.franqueado_id ?? ''),
    arquivado: Boolean((c as { arquivado?: boolean | null }).arquivado),
    motivo_arquivamento: (c as { motivo_arquivamento?: string | null }).motivo_arquivamento ?? null,
    concluido: Boolean((c as { concluido?: boolean | null }).concluido),
    concluido_em:
      (c as { concluido_em?: string | null }).concluido_em != null
        ? String((c as { concluido_em?: string | null }).concluido_em)
        : null,
    origem: 'nativo',
    profiles: profilesMap.get(String(c.franqueado_id)) || null,
  });

  cards = (cardsRaw ?? []).map((c) => mapNativo(c as unknown as Record<string, unknown>));
  const cardsConcluidos = (conclRaw ?? []).map((c) => mapNativo(c as unknown as Record<string, unknown>));

  return {
    kanban: { id: kanbanIdStr },
    fases,
    cards,
    cardsConcluidos,
    role,
    isAdmin,
  };
}
