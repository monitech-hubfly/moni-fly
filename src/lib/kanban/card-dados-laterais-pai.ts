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

type DadosLateraisDb = Pick<SupabaseClient, 'from'>;

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

  const seen = new Set<string>();
  let cur = cid;
  let loteadorPorFk: string | null = null;

  for (let depth = 0; depth < 32 && cur && !seen.has(cur); depth++) {
    seen.add(cur);
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

    if (!loteadorPorFk && String(row?.rede_loteador_id ?? '').trim()) {
      loteadorPorFk = rowId;
    }
    cur = String(row?.origem_card_id ?? '').trim();
  }

  try {
    const { data: vinculos } = await db
      .from('kanban_card_vinculos')
      .select('card_origem_id, card_destino_id')
      .or(`card_origem_id.eq.${cid},card_destino_id.eq.${cid}`);

    const peerIds: string[] = [];
    for (const row of vinculos ?? []) {
      const orig = String((row as { card_origem_id?: string | null }).card_origem_id ?? '').trim();
      const dest = String((row as { card_destino_id?: string | null }).card_destino_id ?? '').trim();
      if (orig === cid && dest && dest !== cid) peerIds.push(dest);
      else if (dest === cid && orig && orig !== cid) peerIds.push(orig);
    }

    if (peerIds.length > 0) {
      const { data: peers } = await db
        .from('kanban_cards')
        .select('id, kanban_id, rede_loteador_id')
        .in('id', peerIds);
      for (const peer of peers ?? []) {
        const p = peer as CardOrigemRow;
        const pid = String(p.id ?? '').trim();
        const tipo = tipoPorKanban(p.kanban_id);
        if (tipo === 'loteador' && pid) return { tipo: 'loteador', cardIdFonte: pid };
      }
      for (const peer of peers ?? []) {
        const p = peer as CardOrigemRow;
        const pid = String(p.id ?? '').trim();
        const tipo = tipoPorKanban(p.kanban_id);
        if (tipo === 'franqueado' && pid) return { tipo: 'franqueado', cardIdFonte: pid };
      }
      for (const peer of peers ?? []) {
        const p = peer as CardOrigemRow;
        const pid = String(p.id ?? '').trim();
        if (pid && String(p.rede_loteador_id ?? '').trim()) {
          return { tipo: 'loteador', cardIdFonte: pid };
        }
      }
    }
  } catch {
    /* vínculo ausente ou RLS — segue fallback da cadeia */
  }

  if (loteadorPorFk) return { tipo: 'loteador', cardIdFonte: loteadorPorFk };
  return { tipo: 'franqueado', cardIdFonte: cid };
}
