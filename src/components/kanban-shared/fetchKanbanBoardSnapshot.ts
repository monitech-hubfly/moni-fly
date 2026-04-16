import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanCardBrief, KanbanFase } from './types';

export type KanbanBoardSnapshot = {
  kanban: { id: string } | null;
  fases: KanbanFase[];
  cards: KanbanCardBrief[];
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
 * Carrega fases e cards ativos de um kanban pelo nome (`kanbans.nome`).
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
    isAdmin = role === 'admin' || role === 'consultor';
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
    return { kanban: null, fases: [], cards: [], role, isAdmin };
  }

  const kanbanIdStr = String(kanban.id);

  const { data: fases } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias, slug')
    .eq('kanban_id', kanban.id)
    .eq('ativo', true)
    .order('ordem');

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
      origem: 'legado' as const,
      profiles: r.responsavel_id ? profilesMap.get(String(r.responsavel_id)) ?? null : null,
    }));
  } else {
    let cardsQuery = supabase
      .from('kanban_cards')
      .select(
        `
      id,
      titulo,
      status,
      created_at,
      fase_id,
      franqueado_id
    `,
      )
      .eq('kanban_id', kanban.id)
      .eq('status', 'ativo')
      .order('created_at', { ascending: false });

    if (userId && !isAdmin) {
      cardsQuery = cardsQuery.eq('franqueado_id', userId);
    }

    const { data: cardsRaw } = await cardsQuery;

    const franqueadoIds = [...new Set(cardsRaw?.map((c) => c.franqueado_id).filter(Boolean) || [])];
    const profilesMap = new Map<string, { full_name: string | null }>();
    if (franqueadoIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', franqueadoIds);
      profiles?.forEach((p) => {
        profilesMap.set(p.id, { full_name: p.full_name });
      });
    }

    cards =
      cardsRaw?.map((c) => ({
        ...c,
        profiles: profilesMap.get(c.franqueado_id) || null,
      })) || [];
  }

  return {
    kanban: { id: kanbanIdStr },
    fases: (fases ?? []) as KanbanFase[],
    cards,
    role,
    isAdmin,
  };
}
