import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAccessRole } from '@/lib/authz';
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
  data_reuniao?: string | null;
  data_followup?: string | null;
};

function dataIsoParaInput(v: unknown): string | null {
  if (v == null || v === '') return null;
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

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
    // Mesmo critério que RLS (163) e `normalizeAccessRole`: evita visão “frank” por casing/espaços
    // ou legados já mapeados (consultor/supervisor → admin).
    const accessRole = normalizeAccessRole(profile?.role);
    isAdmin = accessRole === 'admin' || accessRole === 'team';
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
  const hasNativo = (nativeCount ?? 0) > 0;

  // Sempre busca cards legados (view); mistura com nativo quando existirem ambos.
  let viewQuery = supabase
    .from('v_processo_como_kanban_cards')
    .select('id, kanban_id, fase_id, titulo, status, criado_em, responsavel_id, etapa_slug, origem, data_reuniao, data_followup')
    .eq('kanban_id', kanban.id)
    .order('criado_em', { ascending: false });

  if (userId && !isAdmin) {
    viewQuery = viewQuery.eq('responsavel_id', userId);
  }

  const { data: rowsRaw } = await viewQuery;
  const rowsAll = (rowsRaw ?? []) as ViewLegadoRow[];

  const processoIdsAll = rowsAll.map((r) => String(r.id)).filter(Boolean);
  const archivedLegadoIds = new Set<string>();
  if (processoIdsAll.length > 0) {
    const { data: archRows } = await supabase
      .from('kanban_cards')
      .select('id')
      .in('id', processoIdsAll)
      .eq('arquivado', true);
    for (const row of archRows ?? []) {
      const id = String((row as { id?: string }).id ?? '').trim();
      if (id) archivedLegadoIds.add(id);
    }
  }
  const rows = rowsAll.filter((r) => !archivedLegadoIds.has(String(r.id)));

  const franqueadoIdsLegado = [...new Set(rows.map((r) => r.responsavel_id).filter(Boolean))] as string[];
  const profilesMapLegado = new Map<string, { full_name: string | null }>();
  if (franqueadoIdsLegado.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', franqueadoIdsLegado);
    profiles?.forEach((p) => {
      profilesMapLegado.set(p.id, { full_name: p.full_name });
    });
  }

  const redeNomeMapLegado = new Map<string, string>();
  if (franqueadoIdsLegado.length > 0) {
    const { data: redes } = await supabase
      .from('rede_franqueados')
      .select('id, nome_completo')
      .in('id', franqueadoIdsLegado);
    (redes ?? []).forEach((r) => {
      if (r.nome_completo) redeNomeMapLegado.set(String(r.id), String(r.nome_completo));
    });
  }

  const processoIds = rows.map((r) => String(r.id)).filter(Boolean);
  const franqueadoNomeMap = new Map<string, string>();
  if (processoIds.length > 0) {
    const { data: processos } = await supabase
      .from('processo_step_one')
      .select('id, numero_franquia')
      .in('id', processoIds);
    const numeros = [...new Set((processos ?? []).map((p) => p.numero_franquia).filter(Boolean))] as string[];
    if (numeros.length > 0) {
      const { data: redes } = await supabase
        .from('rede_franqueados')
        .select('n_franquia, nome_completo')
        .in('n_franquia', numeros);
      const redeByNumero = new Map((redes ?? []).map((r) => [String(r.n_franquia), String(r.nome_completo ?? '')]));
      (processos ?? []).forEach((p) => {
        if (p.numero_franquia && redeByNumero.has(p.numero_franquia)) {
          franqueadoNomeMap.set(String(p.id), redeByNumero.get(p.numero_franquia)!);
        }
      });
    }
  }

  const cardsLegado: KanbanCardBrief[] = rows.map((r) => {
    const fid = r.responsavel_id ? String(r.responsavel_id) : null;
    return {
      id: String(r.id),
      titulo: String(r.titulo ?? ''),
      status: String(r.status ?? ''),
      created_at: String(r.criado_em ?? ''),
      fase_id: String(r.fase_id ?? ''),
      franqueado_id: fid ?? '',
      arquivado: false,
      motivo_arquivamento: null,
      concluido: false,
      concluido_em: null,
      origem: 'legado' as const,
      data_reuniao: dataIsoParaInput(r.data_reuniao),
      data_followup: dataIsoParaInput(r.data_followup),
      profiles: franqueadoNomeMap.has(String(r.id))
        ? { full_name: franqueadoNomeMap.get(String(r.id)) ?? null }
        : fid
          ? redeNomeMapLegado.has(fid)
            ? { full_name: redeNomeMapLegado.get(fid) ?? null }
            : (profilesMapLegado.get(fid) ?? null)
          : null,
    };
  });

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
      concluido_em,
      rede_franqueado_id,
      data_reuniao,
      data_followup
    `;

  let cardsRaw: unknown[] = [];
  let conclRaw: unknown[] = [];
  if (hasNativo) {
    let cardsQuery = supabase
      .from('kanban_cards')
      .select(selectCols)
      .eq('kanban_id', kanban.id)
      .eq('status', 'ativo')
      .eq('arquivado', false)
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

    const [cardsRes, conclRes] = await Promise.all([cardsQuery, concluidosQuery]);
    cardsRaw = (cardsRes.data ?? []) as unknown[];
    conclRaw = (conclRes.data ?? []) as unknown[];
  }

  const franqueadoIds = [
    ...new Set([
      ...((cardsRaw ?? []) as { franqueado_id?: string | null }[]).map((c) => c.franqueado_id),
      ...((conclRaw ?? []) as { franqueado_id?: string | null }[]).map((c) => c.franqueado_id),
    ]),
  ].filter(Boolean) as string[];
  const profilesMap = new Map<string, { full_name: string | null }>();
  if (franqueadoIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', franqueadoIds);
    profiles?.forEach((p) => {
      profilesMap.set(p.id, { full_name: p.full_name });
    });
  }

  const redeNomeMapNativo = new Map<string, string>();
  if (franqueadoIds.length > 0) {
    const { data: redes } = await supabase
      .from('rede_franqueados')
      .select('id, nome_completo')
      .in('id', franqueadoIds);
    (redes ?? []).forEach((r) => {
      if (r.nome_completo) redeNomeMapNativo.set(String(r.id), String(r.nome_completo));
    });
  }

  const redeIdsDiretos = [
    ...new Set([
      ...(cardsRaw?.map((c) => (c as { rede_franqueado_id?: string | null }).rede_franqueado_id) ?? []).filter(Boolean),
      ...(conclRaw?.map((c) => (c as { rede_franqueado_id?: string | null }).rede_franqueado_id) ?? []).filter(Boolean),
    ]),
  ] as string[];
  const redeNomeDiretoMap = new Map<string, string>();
  if (redeIdsDiretos.length > 0) {
    const { data: redes } = await supabase.from('rede_franqueados').select('id, nome_completo').in('id', redeIdsDiretos);
    (redes ?? []).forEach((r) => {
      if (r.nome_completo) redeNomeDiretoMap.set(String(r.id), String(r.nome_completo));
    });
  }

  const mapNativo = (c: Record<string, unknown>): KanbanCardBrief => {
    const fid = String(c.franqueado_id ?? '');
    const redeId = String((c as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? '');
    return {
      id: String(c.id),
      titulo: String(c.titulo ?? ''),
      status: String(c.status ?? ''),
      created_at: String(c.created_at ?? ''),
      fase_id: String(c.fase_id ?? ''),
      franqueado_id: fid,
      arquivado: Boolean((c as { arquivado?: boolean | null }).arquivado),
      motivo_arquivamento: (c as { motivo_arquivamento?: string | null }).motivo_arquivamento ?? null,
      concluido: Boolean((c as { concluido?: boolean | null }).concluido),
      concluido_em:
        (c as { concluido_em?: string | null }).concluido_em != null
          ? String((c as { concluido_em?: string | null }).concluido_em)
          : null,
      origem: 'nativo',
      data_reuniao: dataIsoParaInput(c.data_reuniao),
      data_followup: dataIsoParaInput(c.data_followup),
      profiles: redeNomeDiretoMap.has(redeId)
        ? { full_name: redeNomeDiretoMap.get(redeId) ?? null }
        : redeNomeMapNativo.has(fid)
          ? { full_name: redeNomeMapNativo.get(fid) ?? null }
          : (profilesMap.get(fid) ?? null),
    };
  };

  const cardsNativo = (cardsRaw ?? []).map((c) => mapNativo(c as unknown as Record<string, unknown>));
  const cardsConcluidos = (conclRaw ?? []).map((c) => mapNativo(c as unknown as Record<string, unknown>));

  // Combina nativo + legado (nativo primeiro) e remove duplicatas por id
  const seen = new Set<string>();
  const cards = [...cardsNativo, ...cardsLegado].filter((c) => {
    const id = String(c.id ?? '').trim();
    if (!id) return false;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  // Tags (nativo): agrega em lote e acopla ao card brief
  const allCardIds = [...new Set([...cards.map((c) => c.id), ...cardsConcluidos.map((c) => c.id)].filter(Boolean))];
  if (allCardIds.length > 0) {
    const { data: rows } = await supabase
      .from('kanban_card_tags')
      .select('card_id, tag_id, kanban_tags(nome, cor)')
      .in('card_id', allCardIds);
    const byCardId = new Map<string, { tag_id: string; nome: string; cor: string }[]>();
    (rows ?? []).forEach((r) => {
      const cid = String((r as { card_id?: string | null }).card_id ?? '').trim();
      if (!cid) return;
      const tag_id = String((r as { tag_id?: string | null }).tag_id ?? '').trim();
      const nome = String(((r as { kanban_tags?: { nome?: string | null } | null }).kanban_tags as { nome?: string | null } | null)?.nome ?? '');
      const cor = String(((r as { kanban_tags?: { cor?: string | null } | null }).kanban_tags as { cor?: string | null } | null)?.cor ?? '#cccccc');
      if (!tag_id) return;
      const arr = byCardId.get(cid) ?? [];
      arr.push({ tag_id, nome, cor });
      byCardId.set(cid, arr);
    });
    const cardsTagged = cards.map((c) => ({ ...c, tagsCard: byCardId.get(c.id) ?? [] }));
    const cardsConcluidosTagged = cardsConcluidos.map((c) => ({ ...c, tagsCard: byCardId.get(c.id) ?? [] }));

    return {
      kanban: { id: kanbanIdStr },
      fases,
      cards: cardsTagged,
      cardsConcluidos: cardsConcluidosTagged,
      role,
      isAdmin,
    };
  }

  return {
    kanban: { id: kanbanIdStr },
    fases,
    cards,
    cardsConcluidos,
    role,
    isAdmin,
  };
}
