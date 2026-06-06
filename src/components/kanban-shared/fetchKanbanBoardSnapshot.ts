import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAccessRole } from '@/lib/authz';
import { KANBAN_ID_BY_NOME, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { prepareStepOneBoardSnapshot } from '@/lib/kanban/stepone-fase-slugs';
import {
  augmentKanbanFasesComFasesDosCards,
  fetchKanbanFasesAtivas,
} from '@/lib/kanban/fetch-kanban-fases';
import { enrichCardsParalelasContext } from '@/lib/kanban/kanban-paralelas-chips';
import {
  aplicarFasePorEtapaPainelEmLote,
  buildSlugParaFaseIdMap,
  coletarIdsProcessoDosCards,
  fetchEtapaPainelPorProcessoIds,
} from '@/lib/kanban/reconciliar-fase-etapa-painel';
import { sortKanbanCardsPorOrdemColuna } from '@/lib/kanban/kanban-coluna-ordem';
import { montarTituloCardSync, escolherTituloExibicaoCard } from '@/lib/kanban/card-sync-group';
import { dataIsoInputValida } from '@/lib/kanban/kanban-card-datas';
import type { KanbanCardBrief, KanbanFase } from './types';

export type KanbanBoardSnapshot = {
  kanban: { id: string } | null;
  fases: KanbanFase[];
  /** Ativos + arquivados nativos (pool do filtro STATUS no board). Concluídos ficam em `cardsConcluidos`. */
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
  const s = String(v).slice(0, 10);
  return dataIsoInputValida(s) ? s : null;
}

/** Resolve kanban ativo pelo UUID canônico (PROD) ou fallback em `kanbans.nome`. */
async function resolveKanbanAtivo(
  supabase: SupabaseClient,
  kanbanNomeDb: string,
): Promise<{ id: string } | null> {
  const canonicalId = KANBAN_ID_BY_NOME[kanbanNomeDb];
  if (canonicalId) {
    const { data } = await supabase
      .from('kanbans')
      .select('id')
      .eq('id', canonicalId)
      .eq('ativo', true)
      .maybeSingle();
    if (data?.id) return { id: String(data.id) };
  }

  const { data: kanbans } = await supabase
    .from('kanbans')
    .select('id')
    .eq('nome', kanbanNomeDb)
    .eq('ativo', true)
    .limit(1);

  const row = kanbans?.[0];
  return row?.id ? { id: String(row.id) } : null;
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

  const profilePromise = userId
    ? supabase.from('profiles').select('role').eq('id', userId).single()
    : Promise.resolve({ data: null as { role?: string | null } | null });

  const [profileRes, kanban] = await Promise.all([
    profilePromise,
    resolveKanbanAtivo(supabase, kanbanNomeDb),
  ]);

  if (userId) {
    const profile = profileRes.data;
    role = (profile?.role as string) ?? 'frank';
    const accessRole = normalizeAccessRole(profile?.role);
    isAdmin = accessRole === 'admin' || accessRole === 'team';
  } else {
    isAdmin = true;
  }

  if (!kanban) {
    return { kanban: null, fases: [], cards: [], cardsConcluidos: [], role, isAdmin };
  }

  const kanbanIdStr = String(kanban.id);

  let viewQuery = supabase
    .from('v_processo_como_kanban_cards')
    .select('id, kanban_id, fase_id, titulo, status, criado_em, responsavel_id, etapa_slug, origem, data_reuniao, data_followup')
    .eq('kanban_id', kanban.id)
    .order('criado_em', { ascending: false });

  if (userId && !isAdmin) {
    viewQuery = viewQuery.eq('responsavel_id', userId);
  }

  const [fases, nativeCountResult, viewResult] = await Promise.all([
    fetchKanbanFasesAtivas(supabase, kanbanIdStr),
    supabase
      .from('kanban_cards')
      .select('*', { count: 'exact', head: true })
      .eq('kanban_id', kanban.id),
    viewQuery,
  ]);

  const hasNativo = (nativeCountResult.count ?? 0) > 0;
  const rowsAll = (viewResult.data ?? []) as ViewLegadoRow[];

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
  const redeNomeMapLegado = new Map<string, string>();
  if (franqueadoIdsLegado.length > 0) {
    const [{ data: profiles }, { data: redes }] = await Promise.all([
      supabase.from('profiles').select('id, full_name').in('id', franqueadoIdsLegado),
      supabase.from('rede_franqueados').select('id, nome_completo').in('id', franqueadoIdsLegado),
    ]);
    profiles?.forEach((p) => {
      profilesMapLegado.set(p.id, { full_name: p.full_name });
    });
    (redes ?? []).forEach((r) => {
      if (r.nome_completo) redeNomeMapLegado.set(String(r.id), String(r.nome_completo));
    });
  }

  const processoIds = rows.map((r) => String(r.id)).filter(Boolean);
  const slaBasePorCardId = new Map<
    string,
    { entered_fase_at: string | null; sla_iniciado_em: string | null }
  >();
  if (processoIds.length > 0) {
    const { data: slaRows } = await supabase
      .from('kanban_cards')
      .select('id, entered_fase_at, sla_iniciado_em')
      .in('id', processoIds);
    for (const row of slaRows ?? []) {
      const id = String((row as { id?: string }).id ?? '').trim();
      if (!id) continue;
      slaBasePorCardId.set(id, {
        entered_fase_at:
          (row as { entered_fase_at?: string | null }).entered_fase_at != null
            ? String((row as { entered_fase_at?: string | null }).entered_fase_at)
            : null,
        sla_iniciado_em:
          (row as { sla_iniciado_em?: string | null }).sla_iniciado_em != null
            ? String((row as { sla_iniciado_em?: string | null }).sla_iniciado_em)
            : null,
      });
    }
  }
  const franqueadoNomeMap = new Map<string, string>();
  const legadoOrdemMap = new Map<string, number>();
  const legadoTituloMap = new Map<string, string>();
  if (processoIds.length > 0) {
    const { data: processos } = await supabase
      .from('processo_step_one')
      .select('id, numero_franquia, nome_condominio, quadra, lote, ordem_coluna_painel')
      .in('id', processoIds);
    (processos ?? []).forEach((p) => {
      const pid = String(p.id);
      legadoOrdemMap.set(pid, Number((p as { ordem_coluna_painel?: number | null }).ordem_coluna_painel ?? 0));
      const viewTitulo = rows.find((r) => String(r.id) === pid)?.titulo ?? '';
      const tituloCalc = montarTituloCardSync({
        nFranquia: (p as { numero_franquia?: string | null }).numero_franquia,
        nomeCondominio: (p as { nome_condominio?: string | null }).nome_condominio,
        quadra: (p as { quadra?: string | null }).quadra,
        lote: (p as { lote?: string | null }).lote,
        tituloFallback: viewTitulo,
      });
      if (tituloCalc) legadoTituloMap.set(pid, tituloCalc);
    });
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
    const cardId = String(r.id);
    const slaBase = slaBasePorCardId.get(cardId);
    return {
      id: cardId,
      titulo: legadoTituloMap.get(cardId) ?? String(r.titulo ?? ''),
      status: String(r.status ?? ''),
      created_at: String(r.criado_em ?? ''),
      fase_id: String(r.fase_id ?? ''),
      franqueado_id: fid ?? '',
      ordem_coluna: legadoOrdemMap.get(cardId) ?? 0,
      arquivado: false,
      motivo_arquivamento: null,
      concluido: false,
      concluido_em: null,
      origem: 'legado' as const,
      data_reuniao: dataIsoParaInput(r.data_reuniao),
      data_followup: dataIsoParaInput(r.data_followup),
      entered_fase_at: slaBase?.entered_fase_at ?? null,
      sla_iniciado_em: slaBase?.sla_iniciado_em ?? null,
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
      nome_condominio,
      quadra,
      lote,
      data_reuniao,
      data_followup,
      acoplamento_concluido,
      acoplamento_filho_fase_nome,
      acoplamento_filho_fase_slug,
      credito_terreno_ok,
      contabilidade_ok,
      capital_ok,
      juridico_ok,
      credito_obra_ok,
      projeto_id,
      ordem_coluna,
      alvara_url,
      docs_terreno_url,
      sla_iniciado_em,
      entered_fase_at
    `;

  let cardsRaw: unknown[] = [];
  let conclRaw: unknown[] = [];
  let arquivRaw: unknown[] = [];
  if (hasNativo) {
    let cardsQuery = supabase
      .from('kanban_cards')
      .select(selectCols)
      .eq('kanban_id', kanban.id)
      .eq('status', 'ativo')
      .eq('arquivado', false)
      .eq('concluido', false)
      .order('ordem_coluna', { ascending: true })
      .order('created_at', { ascending: false });

    let concluidosQuery = supabase
      .from('kanban_cards')
      .select(selectCols)
      .eq('kanban_id', kanban.id)
      .eq('status', 'ativo')
      .eq('arquivado', false)
      .eq('concluido', true)
      .order('ordem_coluna', { ascending: true })
      .order('created_at', { ascending: false });

    let arquivadosQuery = supabase
      .from('kanban_cards')
      .select(selectCols)
      .eq('kanban_id', kanban.id)
      .eq('status', 'ativo')
      .eq('arquivado', true)
      .order('ordem_coluna', { ascending: true })
      .order('created_at', { ascending: false });

    if (userId && !isAdmin) {
      cardsQuery = cardsQuery.eq('franqueado_id', userId);
      concluidosQuery = concluidosQuery.eq('franqueado_id', userId);
      arquivadosQuery = arquivadosQuery.eq('franqueado_id', userId);
    }

    const [cardsRes, conclRes, arquivRes] = await Promise.all([
      cardsQuery,
      concluidosQuery,
      arquivadosQuery,
    ]);
    cardsRaw = (cardsRes.data ?? []) as unknown[];
    conclRaw = (conclRes.data ?? []) as unknown[];
    arquivRaw = (arquivRes.data ?? []) as unknown[];
  }

  const franqueadoIds = [
    ...new Set([
      ...((cardsRaw ?? []) as { franqueado_id?: string | null }[]).map((c) => c.franqueado_id),
      ...((conclRaw ?? []) as { franqueado_id?: string | null }[]).map((c) => c.franqueado_id),
      ...((arquivRaw ?? []) as { franqueado_id?: string | null }[]).map((c) => c.franqueado_id),
    ]),
  ].filter(Boolean) as string[];
  const redeIdsDiretos = [
    ...new Set([
      ...(cardsRaw?.map((c) => (c as { rede_franqueado_id?: string | null }).rede_franqueado_id) ?? []).filter(Boolean),
      ...(conclRaw?.map((c) => (c as { rede_franqueado_id?: string | null }).rede_franqueado_id) ?? []).filter(Boolean),
      ...(arquivRaw?.map((c) => (c as { rede_franqueado_id?: string | null }).rede_franqueado_id) ?? []).filter(Boolean),
    ]),
  ] as string[];
  const allRedeLookupIds = [...new Set([...franqueadoIds, ...redeIdsDiretos])];

  const profilesMap = new Map<string, { full_name: string | null }>();
  const redeById = new Map<string, string>();
  const nFranquiaByRedeId = new Map<string, string>();
  const [profilesRes, redesRes] = await Promise.all([
    franqueadoIds.length > 0
      ? supabase.from('profiles').select('id, full_name').in('id', franqueadoIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    allRedeLookupIds.length > 0
      ? supabase.from('rede_franqueados').select('id, nome_completo, n_franquia').in('id', allRedeLookupIds)
      : Promise.resolve({ data: [] as { id: string; nome_completo: string | null; n_franquia: string | null }[] }),
  ]);
  (profilesRes.data ?? []).forEach((p) => {
    profilesMap.set(p.id, { full_name: p.full_name });
  });
  (redesRes.data ?? []).forEach((r) => {
    if (r.nome_completo) redeById.set(String(r.id), String(r.nome_completo));
    const num = String((r as { n_franquia?: string | null }).n_franquia ?? '').trim();
    if (num) nFranquiaByRedeId.set(String(r.id), num);
  });

  const redeNomeMapNativo = new Map<string, string>();
  for (const id of franqueadoIds) {
    const nome = redeById.get(id);
    if (nome) redeNomeMapNativo.set(id, nome);
  }
  const redeNomeDiretoMap = new Map<string, string>();
  for (const id of redeIdsDiretos) {
    const nome = redeById.get(id);
    if (nome) redeNomeDiretoMap.set(id, nome);
  }

  const mapNativo = (c: Record<string, unknown>): KanbanCardBrief => {
    const fid = String(c.franqueado_id ?? '');
    const redeId = String((c as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? '');
    const tituloRaw = String(c.titulo ?? '');
    const tituloCalc = montarTituloCardSync({
      nFranquia: redeId ? nFranquiaByRedeId.get(redeId) : null,
      nomeCondominio: (c as { nome_condominio?: string | null }).nome_condominio,
      quadra: (c as { quadra?: string | null }).quadra,
      lote: (c as { lote?: string | null }).lote,
      tituloFallback: tituloRaw,
    });
    return {
      id: String(c.id),
      titulo: escolherTituloExibicaoCard(tituloRaw, tituloCalc),
      status: String(c.status ?? ''),
      created_at: String(c.created_at ?? ''),
      fase_id: String(c.fase_id ?? ''),
      ordem_coluna: Number((c as { ordem_coluna?: number | null }).ordem_coluna ?? 0),
      kanban_id: kanbanIdStr,
      projeto_id: (c as { projeto_id?: string | null }).projeto_id ?? null,
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
      acoplamento_concluido: Boolean((c as { acoplamento_concluido?: boolean | null }).acoplamento_concluido),
      acoplamento_filho_fase_nome:
        (c as { acoplamento_filho_fase_nome?: string | null }).acoplamento_filho_fase_nome ?? null,
      acoplamento_filho_fase_slug:
        (c as { acoplamento_filho_fase_slug?: string | null }).acoplamento_filho_fase_slug ?? null,
      credito_terreno_ok: Boolean((c as { credito_terreno_ok?: boolean | null }).credito_terreno_ok),
      contabilidade_ok: Boolean((c as { contabilidade_ok?: boolean | null }).contabilidade_ok),
      capital_ok: Boolean((c as { capital_ok?: boolean | null }).capital_ok),
      juridico_ok: Boolean((c as { juridico_ok?: boolean | null }).juridico_ok),
      credito_obra_ok: Boolean((c as { credito_obra_ok?: boolean | null }).credito_obra_ok),
      alvara_url: (c as { alvara_url?: string | null }).alvara_url ?? null,
      docs_terreno_url: (c as { docs_terreno_url?: string | null }).docs_terreno_url ?? null,
      sla_iniciado_em:
        (c as { sla_iniciado_em?: string | null }).sla_iniciado_em != null
          ? String((c as { sla_iniciado_em?: string | null }).sla_iniciado_em)
          : null,
      entered_fase_at:
        (c as { entered_fase_at?: string | null }).entered_fase_at != null
          ? String((c as { entered_fase_at?: string | null }).entered_fase_at)
          : null,
      profiles: redeNomeDiretoMap.has(redeId)
        ? { full_name: redeNomeDiretoMap.get(redeId) ?? null }
        : redeNomeMapNativo.has(fid)
          ? { full_name: redeNomeMapNativo.get(fid) ?? null }
          : (profilesMap.get(fid) ?? null),
    };
  };

  let cardsNativo = (cardsRaw ?? []).map((c) => mapNativo(c as unknown as Record<string, unknown>));
  let cardsConcluidos = (conclRaw ?? []).map((c) => mapNativo(c as unknown as Record<string, unknown>));
  let cardsArquivadosNativo = (arquivRaw ?? []).map((c) => mapNativo(c as unknown as Record<string, unknown>));

  [cardsNativo, cardsConcluidos, cardsArquivadosNativo] = await Promise.all([
    enrichCardsParalelasContext(supabase, kanbanIdStr, cardsNativo),
    enrichCardsParalelasContext(supabase, kanbanIdStr, cardsConcluidos),
    enrichCardsParalelasContext(supabase, kanbanIdStr, cardsArquivadosNativo),
  ]);

  /** `processo_step_one.etapa_painel` prevalece sobre `kanban_cards.fase_id` (incl. UUID de outro funil). */
  const processoIdsReconciliar = coletarIdsProcessoDosCards(
    cardsNativo,
    cardsConcluidos,
    cardsArquivadosNativo,
    cardsLegado,
  );
  const etapaPorProcesso = await fetchEtapaPainelPorProcessoIds(supabase, processoIdsReconciliar);
  const slugsEtapa = [...etapaPorProcesso.values()].map((p) => p.etapa_painel);
  const slugParaFaseId = await buildSlugParaFaseIdMap(supabase, kanbanIdStr, fases, slugsEtapa);

  cardsNativo = aplicarFasePorEtapaPainelEmLote(cardsNativo, etapaPorProcesso, slugParaFaseId);
  cardsConcluidos = aplicarFasePorEtapaPainelEmLote(cardsConcluidos, etapaPorProcesso, slugParaFaseId);
  cardsArquivadosNativo = aplicarFasePorEtapaPainelEmLote(
    cardsArquivadosNativo,
    etapaPorProcesso,
    slugParaFaseId,
  );
  const cardsLegadoReconciliados = aplicarFasePorEtapaPainelEmLote(
    cardsLegado,
    etapaPorProcesso,
    slugParaFaseId,
  );

  const idsComLinhaNativa = new Set([
    ...cardsNativo.map((c) => c.id),
    ...cardsConcluidos.map((c) => c.id),
    ...cardsArquivadosNativo.map((c) => c.id),
  ]);

  // Nativo prevalece quando existe linha; legado só preenche lacunas (sem duplicata por id).
  let cards = [
    ...cardsNativo,
    ...cardsArquivadosNativo,
    ...cardsLegadoReconciliados.filter((c) => !idsComLinhaNativa.has(c.id)),
  ].filter((c) => {
    const id = String(c.id ?? '').trim();
    return Boolean(id);
  });

  const allCardIds = [...new Set([...cards.map((c) => c.id), ...cardsConcluidos.map((c) => c.id)].filter(Boolean))];
  const faseIdsOrfas = [...cards.map((c) => c.fase_id), ...cardsConcluidos.map((c) => c.fase_id)];

  let [fasesComOrfas, tagsRes] = await Promise.all([
    augmentKanbanFasesComFasesDosCards(supabase, kanbanIdStr, fases, faseIdsOrfas),
    allCardIds.length > 0
      ? supabase
          .from('kanban_card_tags')
          .select('card_id, tag_id, kanban_tags(nome, cor)')
          .in('card_id', allCardIds)
      : Promise.resolve({ data: [] as { card_id: string; tag_id: string; kanban_tags: { nome: string | null; cor: string | null } | null }[] }),
  ]);

  if (kanbanIdStr === KANBAN_IDS.STEP_ONE) {
    const prepared = prepareStepOneBoardSnapshot({
      fases: fasesComOrfas,
      cards,
      cardsConcluidos,
    });
    fasesComOrfas = prepared.fases;
    cards = prepared.cards;
    cardsConcluidos = prepared.cardsConcluidos;
  }

  // Tags (nativo): agrega em lote e acopla ao card brief
  if (allCardIds.length > 0) {
    const rows = tagsRes.data;
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
      fases: fasesComOrfas,
      cards: cardsTagged,
      cardsConcluidos: cardsConcluidosTagged,
      role,
      isAdmin,
    };
  }

  return {
    kanban: { id: kanbanIdStr },
    fases: fasesComOrfas,
    cards,
    cardsConcluidos,
    role,
    isAdmin,
  };
}
