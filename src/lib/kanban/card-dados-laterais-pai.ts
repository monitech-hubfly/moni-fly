import type { SupabaseClient } from '@supabase/supabase-js';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { isLoteadoresKanbanRef, isPortfolioKanbanRef } from '@/lib/kanban/portfolio-paralelas';

/** Funis que recebem cards filhos de Portfólio ou Loteadores. */
export const KANBAN_IDS_FILHO_DADOS_LATERAIS: readonly string[] = [
  KANBAN_IDS.ACOPLAMENTO,
  KANBAN_IDS.MONI_CAPITAL,
  KANBAN_IDS.CREDITO_OBRA,
  KANBAN_IDS.OPERACOES,
  KANBAN_IDS.PROJETO_LEGAL,
  KANBAN_IDS.PROJETOS_LOCAIS,
  KANBAN_IDS.HDM_HOMOLOGACOES,
];

const KANBAN_NOMES_FILHO_DADOS_LATERAIS = new Set([
  'Funil Acoplamento',
  'Funil Divify',
  'Funil Moní Capital',
  'Funil Crédito Obra',
  'Funil Cash Me',
  'Funil Operações',
  'Funil Pré Obra e Obra',
  'Funil Projeto Legal',
  'Funil Projetos Locais',
  'Funil Homologações',
]);

export type FonteDadosLaterais = {
  tipo: 'loteador' | 'franqueado';
  /** Card cuja ficha deve ser exibida (pai Loteadores ou o próprio card). */
  cardIdFonte: string;
};

type DadosLateraisDb = Pick<SupabaseClient, 'from' | 'rpc'>;

type CardOrigemRow = {
  id?: string | null;
  kanban_id?: string | null;
  origem_card_id?: string | null;
  rede_loteador_id?: string | null;
};

export function isKanbanFilhoDadosLaterais(
  kanbanId?: string | null,
  kanbanNome?: string | null,
): boolean {
  const kid = String(kanbanId ?? '').trim();
  if (kid && KANBAN_IDS_FILHO_DADOS_LATERAIS.includes(kid)) return true;
  return KANBAN_NOMES_FILHO_DADOS_LATERAIS.has(String(kanbanNome ?? '').trim());
}

function tipoPorKanban(kanbanId: string | null | undefined): 'loteador' | 'franqueado' | null {
  if (isLoteadoresKanbanRef(kanbanId)) return 'loteador';
  if (isPortfolioKanbanRef(kanbanId)) return 'franqueado';
  return null;
}

type CardLoteadorHint = {
  id?: unknown;
  titulo?: unknown;
  rede_loteador_id?: unknown;
  rede_franqueado_id?: unknown;
  origem_card_id?: unknown;
};

/**
 * Resolve `rede_loteador_id` em lote: FK no próprio card ou ancestrais via
 * `origem_card_id` (RPC 488 + um fetch). Usado no header do card fechado.
 */
export async function resolverRedeLoteadorIdsPorCards(
  db: DadosLateraisDb,
  cards: CardLoteadorHint[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const semFk: string[] = [];
  const origemDireta = new Set<string>();

  for (const c of cards) {
    const id = String(c.id ?? '').trim();
    if (!id) continue;
    const rid = String(c.rede_loteador_id ?? '').trim();
    if (rid) {
      out.set(id, rid);
      continue;
    }
    if (String(c.rede_franqueado_id ?? '').trim()) continue;
    if (/^FK\d+/i.test(String(c.titulo ?? '').trim())) continue;
    const origem = String(c.origem_card_id ?? '').trim();
    if (!origem) continue;
    semFk.push(id);
    origemDireta.add(origem);
  }

  if (semFk.length === 0) return out;

  const ancestraisPorCard = new Map<string, string[]>();
  try {
    const { data: ancestrais } = await db.rpc('kanban_ancestrais_origem_batch', {
      card_ids: semFk,
    });
    for (const row of (ancestrais ?? []) as {
      board_card_id?: string | null;
      ancestral_id?: string | null;
    }[]) {
      const boardId = String(row.board_card_id ?? '').trim();
      const ancId = String(row.ancestral_id ?? '').trim();
      if (!boardId || !ancId || boardId === ancId) continue;
      const list = ancestraisPorCard.get(boardId) ?? [];
      list.push(ancId);
      ancestraisPorCard.set(boardId, list);
    }
  } catch {
    /* RPC ausente — cai no walk pelos pais diretos */
  }

  const idsParaFetch = new Set<string>(origemDireta);
  for (const list of ancestraisPorCard.values()) {
    for (const id of list) idsParaFetch.add(id);
  }
  if (idsParaFetch.size === 0) return out;

  const rowById = new Map<string, { rid: string; origem: string }>();
  const carregarRows = async (ids: string[]) => {
    if (ids.length === 0) return;
    const { data } = await db
      .from('kanban_cards')
      .select('id, rede_loteador_id, origem_card_id')
      .in('id', ids);
    for (const row of data ?? []) {
      const p = row as CardOrigemRow;
      const pid = String(p.id ?? '').trim();
      if (!pid) continue;
      rowById.set(pid, {
        rid: String(p.rede_loteador_id ?? '').trim(),
        origem: String(p.origem_card_id ?? '').trim(),
      });
    }
  };

  await carregarRows([...idsParaFetch]);
  const extra = [...rowById.values()]
    .map((v) => v.origem)
    .filter((o) => o && !rowById.has(o));
  if (extra.length > 0) await carregarRows(extra);

  for (const c of cards) {
    const id = String(c.id ?? '').trim();
    if (!id || out.has(id)) continue;
    const chain = ancestraisPorCard.get(id) ?? [];
    for (const anc of chain) {
      const row = rowById.get(anc);
      if (row?.rid) {
        out.set(id, row.rid);
        break;
      }
    }
    if (out.has(id)) continue;
    let cur = String(c.origem_card_id ?? '').trim();
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const row = rowById.get(cur);
      if (!row) break;
      if (row.rid) {
        out.set(id, row.rid);
        break;
      }
      cur = row.origem;
    }
  }

  return out;
}

/** Sobe `origem_card_id` até achar `rede_loteador_id`. */
export async function resolverRedeLoteadorIdNaCadeia(
  db: DadosLateraisDb,
  startCardId: string,
): Promise<string | null> {
  const seen = new Set<string>();
  let cur = String(startCardId ?? '').trim();
  for (let depth = 0; depth < 32 && cur && !seen.has(cur); depth++) {
    seen.add(cur);
    const { data } = await db
      .from('kanban_cards')
      .select('rede_loteador_id, origem_card_id')
      .eq('id', cur)
      .maybeSingle();
    const row = data as CardOrigemRow | null;
    const rid = String(row?.rede_loteador_id ?? '').trim();
    if (rid) return rid;
    cur = String(row?.origem_card_id ?? '').trim();
  }
  return null;
}

/**
 * Painel esquerdo: Loteadores → Dados do Loteador; Portfólio → Dados do Franqueado.
 * Nos funis filhos, segue o card pai da cadeia `origem_card_id` (e vínculos).
 */
export async function resolverFonteDadosLateraisCard(
  db: DadosLateraisDb,
  cardId: string,
  kanbanId: string,
  kanbanNome?: string | null,
): Promise<FonteDadosLaterais> {
  const cid = String(cardId ?? '').trim();
  const kid = String(kanbanId ?? '').trim();
  const nome = String(kanbanNome ?? '').trim() || null;

  if (isLoteadoresKanbanRef(kid, nome)) {
    return { tipo: 'loteador', cardIdFonte: cid };
  }
  if (isPortfolioKanbanRef(kid, nome)) {
    return { tipo: 'franqueado', cardIdFonte: cid };
  }
  if (!cid || !isKanbanFilhoDadosLaterais(kid, nome)) {
    return { tipo: 'franqueado', cardIdFonte: cid || String(cardId ?? '') };
  }

  const { data: atual } = await db
    .from('kanban_cards')
    .select('id, kanban_id, origem_card_id, rede_loteador_id')
    .eq('id', cid)
    .maybeSingle();
  const atualRow = atual as CardOrigemRow | null;
  if (atualRow) {
    const tipoAtual = tipoPorKanban(atualRow.kanban_id);
    if (tipoAtual === 'loteador') return { tipo: 'loteador', cardIdFonte: cid };
    if (tipoAtual === 'franqueado') return { tipo: 'franqueado', cardIdFonte: cid };
    if (String(atualRow.rede_loteador_id ?? '').trim()) {
      return { tipo: 'loteador', cardIdFonte: cid };
    }
  }

  const ancestralIds: string[] = [];
  try {
    const { data: ancestrais } = await db.rpc('kanban_ancestrais_origem_batch', {
      card_ids: [cid],
    });
    for (const row of (ancestrais ?? []) as { ancestral_id?: string | null }[]) {
      const anc = String(row.ancestral_id ?? '').trim();
      if (anc && anc !== cid) ancestralIds.push(anc);
    }
  } catch {
    /* RPC ausente — cai no walk curto */
  }

  if (ancestralIds.length === 0) {
    let cur = String(atualRow?.origem_card_id ?? '').trim();
    const seen = new Set<string>([cid]);
    for (let depth = 0; depth < 8 && cur && !seen.has(cur); depth++) {
      seen.add(cur);
      ancestralIds.push(cur);
      const { data } = await db
        .from('kanban_cards')
        .select('id, kanban_id, origem_card_id, rede_loteador_id')
        .eq('id', cur)
        .maybeSingle();
      const row = data as CardOrigemRow | null;
      const rowId = String(row?.id ?? '').trim();
      if (!rowId) break;
      const tipo = tipoPorKanban(row?.kanban_id);
      if (tipo === 'loteador') return { tipo: 'loteador', cardIdFonte: rowId };
      if (tipo === 'franqueado') return { tipo: 'franqueado', cardIdFonte: rowId };
      if (String(row?.rede_loteador_id ?? '').trim()) return { tipo: 'loteador', cardIdFonte: rowId };
      cur = String(row?.origem_card_id ?? '').trim();
    }
    return { tipo: 'franqueado', cardIdFonte: cid };
  }

  const { data: ancestraisCards } = await db
    .from('kanban_cards')
    .select('id, kanban_id, rede_loteador_id')
    .in('id', ancestralIds);

  let loteadorPorFk: string | null = null;
  for (const peer of ancestraisCards ?? []) {
    const p = peer as CardOrigemRow;
    const pid = String(p.id ?? '').trim();
    const tipo = tipoPorKanban(p.kanban_id);
    if (tipo === 'loteador' && pid) return { tipo: 'loteador', cardIdFonte: pid };
    if (!loteadorPorFk && pid && String(p.rede_loteador_id ?? '').trim()) loteadorPorFk = pid;
  }
  for (const peer of ancestraisCards ?? []) {
    const p = peer as CardOrigemRow;
    const pid = String(p.id ?? '').trim();
    const tipo = tipoPorKanban(p.kanban_id);
    if (tipo === 'franqueado' && pid) return { tipo: 'franqueado', cardIdFonte: pid };
  }

  if (loteadorPorFk) return { tipo: 'loteador', cardIdFonte: loteadorPorFk };
  return { tipo: 'franqueado', cardIdFonte: cid };
}
