import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { PipelineCardDisplay } from '@/lib/kanban/pipeline-cards-types';
import {
  idProjetoNegocioPipelineCard,
  isFunilEsteiraPrincipal,
  isFunilParaleloEsteira,
} from '@/lib/kanban/pipeline-esteira-tres-etapas';
import { sortCardsFranqueadoraPrioridade } from '@/lib/kanban/pipeline-franqueadora-compute';

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
  const pid = idProjetoNegocioPipelineCard(card);
  if (!pid) return [card];
  return allCards.filter((c) => idProjetoNegocioPipelineCard(c) === pid);
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
  const pid = idProjetoNegocioPipelineCard(rowCard);
  const relacionados = pid ? cardsRelacionadosProjeto(rowCard, siblingCards) : siblingCards;
  const match = relacionados.find((c) => c.kanban_id === kanbanId);
  if (match) return match;
  if (rowCard.kanban_id === kanbanId) return rowCard;
  return null;
}
