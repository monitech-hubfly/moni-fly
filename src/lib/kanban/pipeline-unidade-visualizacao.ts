import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { PipelineCardDisplay } from '@/lib/kanban/pipeline-cards-types';
import {
  indiceEsteiraTresEtapas,
  isFunilEsteiraPrincipal,
  isFunilParaleloEsteira,
} from '@/lib/kanban/pipeline-esteira-tres-etapas';
import {
  badgeStatusPipelineCard,
  sortCardsFranqueadoraPrioridade,
} from '@/lib/kanban/pipeline-franqueadora-compute';
import type { PipelineCardBadgeStatus } from '@/lib/kanban/pipeline-cards-types';

/** Linhas da esteira no bloco Paralelos (ordem de exibição). */
export const PARALELOS_ESTEIRA_LINHAS = [
  {
    id: 'acoplamento_projetos_legais',
    label: 'Acoplamento · Projetos Legais',
    kanbanIds: [KANBAN_IDS.ACOPLAMENTO, KANBAN_IDS.PROJETOS_LEGAIS],
  },
  {
    id: 'projetos_locais',
    label: 'Projetos Locais',
    kanbanIds: [KANBAN_IDS.PROJETOS_LOCAIS],
  },
  {
    id: 'moni_capital',
    label: 'Moní Capital',
    kanbanIds: [KANBAN_IDS.MONI_CAPITAL],
  },
  {
    id: 'credito_obra',
    label: 'Crédito Obra',
    kanbanIds: [KANBAN_IDS.CREDITO_OBRA],
  },
  {
    id: 'contabilidade',
    label: 'Contabilidade',
    kanbanIds: [KANBAN_IDS.CONTABILIDADE],
  },
] as const;

export type ParalelosEsteiraLinha = (typeof PARALELOS_ESTEIRA_LINHAS)[number];

const KANBAN_PARA_LINHA_PARALELA = new Map<string, ParalelosEsteiraLinha>();
for (const linha of PARALELOS_ESTEIRA_LINHAS) {
  for (const kid of linha.kanbanIds) {
    KANBAN_PARA_LINHA_PARALELA.set(kid, linha);
  }
}

const ORDEM_LINHA_PARALELA = new Map(PARALELOS_ESTEIRA_LINHAS.map((l, i) => [l.id, i]));

export function isCardBlocoPrincipalUnidade(card: PipelineCardDisplay): boolean {
  return isFunilEsteiraPrincipal(card.kanban_id);
}

export function isCardBlocoParalelosUnidade(card: PipelineCardDisplay): boolean {
  return isFunilParaleloEsteira(card.kanban_id);
}

export function linhaEsteiraParalelaKanban(kanbanId: string): ParalelosEsteiraLinha | null {
  return KANBAN_PARA_LINHA_PARALELA.get(String(kanbanId ?? '').trim()) ?? null;
}

export function cardsRelacionadosProjeto(
  card: PipelineCardDisplay,
  allCards: readonly PipelineCardDisplay[],
): PipelineCardDisplay[] {
  const relacionados = allCards.filter((c) => cardsCompartilhamNegocioPipeline(card, c));
  return relacionados.length > 0 ? relacionados : [card];
}

/** Cards da linha principal + funis paralelos do mesmo projeto (para multi-track). */
export function cardsParaEsteiraPrincipalRow(
  card: PipelineCardDisplay,
  allCards: readonly PipelineCardDisplay[],
): PipelineCardDisplay[] {
  const relacionados = cardsRelacionadosProjeto(card, allCards);
  const paralelos = relacionados.filter((c) => isFunilParaleloEsteira(c.kanban_id));
  return [card, ...paralelos.filter((c) => c.id !== card.id)];
}

export function splitCardsUnidadePrincipalParalelos(cards: PipelineCardDisplay[]): {
  principal: PipelineCardDisplay[];
  paralelos: PipelineCardDisplay[];
} {
  const principal = sortCardsFranqueadoraPrioridade(cards.filter(isCardBlocoPrincipalUnidade));
  const paralelosRaw = cards.filter(isCardBlocoParalelosUnidade);
  const paralelos = sortCardsFranqueadoraPrioridade([...paralelosRaw].sort(compareParalelosUnidade));
  return { principal, paralelos };
}

function compareParalelosUnidade(a: PipelineCardDisplay, b: PipelineCardDisplay): number {
  const la = linhaEsteiraParalelaKanban(a.kanban_id);
  const lb = linhaEsteiraParalelaKanban(b.kanban_id);
  const oa = la ? (ORDEM_LINHA_PARALELA.get(la.id) ?? 99) : 99;
  const ob = lb ? (ORDEM_LINHA_PARALELA.get(lb.id) ?? 99) : 99;
  if (oa !== ob) return oa - ob;
  const posA = la ? la.kanbanIds.findIndex((id) => id === a.kanban_id) : 0;
  const posB = lb ? lb.kanbanIds.findIndex((id) => id === b.kanban_id) : 0;
  if (posA !== posB) return posA - posB;
  return a.kanban_nome.localeCompare(b.kanban_nome, 'pt-BR');
}

/** Card do funil dentro do grupo paralelo (mesmo projeto quando possível). */
export function resolverCardFunilNoGrupoParalelo(
  kanbanId: string,
  rowCard: PipelineCardDisplay,
  siblingCards: readonly PipelineCardDisplay[],
): PipelineCardDisplay | null {
  const relacionados = cardsRelacionadosProjeto(rowCard, siblingCards);
  const match = relacionados.find((c) => c.kanban_id === kanbanId);
  if (match) return match;
  if (rowCard.kanban_id === kanbanId) return rowCard;
  return null;
}

export function resolverAnchorCardGrupoUnidade(cards: PipelineCardDisplay[]): PipelineCardDisplay {
  if (cards.length === 0) throw new Error('grupo vazio');
  const principal = cards.find((c) => isFunilEsteiraPrincipal(c.kanban_id));
  if (principal) return principal;
  return cards.reduce((best, c) => {
    const idx = indiceEsteiraTresEtapas(c.kanban_id);
    const bestIdx = indiceEsteiraTresEtapas(best.kanban_id);
    return idx >= bestIdx ? c : best;
  }, cards[0]);
}

export type GrupoProjetoUnidade = {
  anchor: PipelineCardDisplay;
  cards: PipelineCardDisplay[];
};

/** IDs compartilhados entre Step One (`processo_step_one`) e Portfolio (`projeto_negocio`). */
function chavesCorrelacaoNegocioPipeline(
  card: Pick<PipelineCardDisplay, 'projeto_id' | 'processo_step_one_id'>,
): string[] {
  const keys: string[] = [];
  const pid = String(card.projeto_id ?? '').trim();
  const proc = String(card.processo_step_one_id ?? '').trim();
  if (pid) keys.push(`ref:${pid}`);
  if (proc && proc !== pid) keys.push(`ref:${proc}`);
  return keys;
}

/** Dois cards pertencem ao mesmo negócio (projeto, processo ou bastão). */
export function cardsCompartilhamNegocioPipeline(
  a: Pick<PipelineCardDisplay, 'id' | 'projeto_id' | 'processo_step_one_id' | 'origem_card_id'>,
  b: Pick<PipelineCardDisplay, 'id' | 'projeto_id' | 'processo_step_one_id' | 'origem_card_id'>,
): boolean {
  if (a.id === b.id) return true;
  const keysB = new Set(chavesCorrelacaoNegocioPipeline(b));
  for (const k of chavesCorrelacaoNegocioPipeline(a)) {
    if (keysB.has(k)) return true;
  }
  const origA = String(a.origem_card_id ?? '').trim();
  const origB = String(b.origem_card_id ?? '').trim();
  if (origA && origA === b.id) return true;
  if (origB && origB === a.id) return true;
  return false;
}

class UnionFindAgrupamento {
  private parent = new Map<string, string>();

  init(id: string): void {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    let root = id;
    let p = this.parent.get(root);
    while (p && p !== root) {
      root = p;
      p = this.parent.get(root);
    }
    let cur = id;
    while (cur !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

/** Agrupa cards da unidade por negócio — `projeto_negocio`, `processo_step_one` e cadeia `origem_card_id`. */
export function agruparCardsUnidadePorProjeto(cards: PipelineCardDisplay[]): GrupoProjetoUnidade[] {
  if (cards.length === 0) return [];

  const ufs = new UnionFindAgrupamento();
  const cardById = new Map(cards.map((c) => [c.id, c]));
  const refParaCard = new Map<string, string>();

  for (const c of cards) {
    ufs.init(c.id);
    for (const key of chavesCorrelacaoNegocioPipeline(c)) {
      const outro = refParaCard.get(key);
      if (outro) ufs.union(c.id, outro);
      else refParaCard.set(key, c.id);
    }
    const origem = String(c.origem_card_id ?? '').trim();
    if (origem && cardById.has(origem)) ufs.union(c.id, origem);
  }

  const porRaiz = new Map<string, PipelineCardDisplay[]>();
  for (const c of cards) {
    const root = ufs.find(c.id);
    const list = porRaiz.get(root) ?? [];
    list.push(c);
    porRaiz.set(root, list);
  }

  const grupos: GrupoProjetoUnidade[] = [];
  for (const list of porRaiz.values()) {
    grupos.push({ anchor: resolverAnchorCardGrupoUnidade(list), cards: list });
  }

  const byAnchorId = new Map(grupos.map((g) => [g.anchor.id, g]));
  return sortCardsFranqueadoraPrioridade(grupos.map((g) => g.anchor)).map(
    (anchor) => byAnchorId.get(anchor.id)!,
  );
}

/** Linhas de sub-esteira paralela com pelo menos um card no grupo do projeto. */
export function linhasSubesteiraParalelaDoGrupo(
  grupoCards: readonly PipelineCardDisplay[],
): ParalelosEsteiraLinha[] {
  const ids = new Set(grupoCards.map((c) => c.kanban_id));
  return PARALELOS_ESTEIRA_LINHAS.filter((linha) => linha.kanbanIds.some((kid) => ids.has(kid)));
}

/** Cards ativos de uma linha de sub-esteira paralela no mesmo projeto. */
export function cardsDaLinhaSubesteira(
  linha: ParalelosEsteiraLinha,
  anchor: PipelineCardDisplay,
  siblingCards: readonly PipelineCardDisplay[],
): PipelineCardDisplay[] {
  return linha.kanbanIds
    .map((kid) => resolverCardFunilNoGrupoParalelo(kid, anchor, siblingCards))
    .filter((c): c is PipelineCardDisplay => c != null);
}

/** Card de referência para status/tempo (pior prioridade entre os da linha). */
export function cardPrioritarioSubesteira(cards: readonly PipelineCardDisplay[]): PipelineCardDisplay | null {
  if (cards.length === 0) return null;
  return sortCardsFranqueadoraPrioridade([...cards])[0] ?? null;
}

/** Rótulo de fase(s) para sub-esteira com um ou mais funis. */
export function rotuloFaseSubesteira(cards: readonly PipelineCardDisplay[]): string {
  if (cards.length === 0) return '—';
  if (cards.length === 1) return cards[0].fase_nome;
  return cards.map((c) => c.fase_nome).join(' · ');
}

const BADGE_PRIORIDADE: Record<PipelineCardBadgeStatus, number> = {
  atrasado: 0,
  parado: 1,
  alerta: 2,
  em_dia: 3,
};

/** Pior badge entre os cards da sub-esteira. */
export function badgeSubesteira(cards: readonly PipelineCardDisplay[]): PipelineCardBadgeStatus {
  let worst: PipelineCardBadgeStatus = 'em_dia';
  for (const c of cards) {
    const b = badgeStatusPipelineCard(c);
    if (BADGE_PRIORIDADE[b] < BADGE_PRIORIDADE[worst]) worst = b;
  }
  return worst;
}
