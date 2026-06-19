import { KANBAN_IDS } from '@/lib/constants/kanban-ids';

/** Esteira principal contínua: Step One → Portfólio → Pré Obra e Obra. */
export const ESTEIRA_TRES_ETAPAS = [
  {
    id: 'step_one',
    label: 'Step One',
    kanbanIds: [KANBAN_IDS.STEP_ONE, KANBAN_IDS.LOTEADORES],
  },
  {
    id: 'portfolio',
    label: 'Portfólio',
    kanbanIds: [KANBAN_IDS.PORTFOLIO],
  },
  {
    id: 'pre_obra_obra',
    label: 'Pré Obra e Obra',
    kanbanIds: [
      KANBAN_IDS.OPERACOES,
      KANBAN_IDS.PROJETO_LEGAL,
      KANBAN_IDS.PROJETOS_LOCAIS,
      KANBAN_IDS.PROJETOS_LEGAIS,
      KANBAN_IDS.CONTRATACOES,
      KANBAN_IDS.HDM_PRODUTO,
      KANBAN_IDS.HDM_MODELO_VIRTUAL,
      KANBAN_IDS.HDM_HOMOLOGACOES,
    ],
  },
] as const;

/** Funis paralelos à esteira principal (barra secundária). */
export const FUNIS_PARALELOS_ESTEIRA = [
  { id: 'credito_obra', label: 'Crédito Obra', kanbanIds: [KANBAN_IDS.CREDITO_OBRA] },
  { id: 'acoplamento', label: 'Acoplamento', kanbanIds: [KANBAN_IDS.ACOPLAMENTO] },
  { id: 'contabilidade', label: 'Contabilidade', kanbanIds: [KANBAN_IDS.CONTABILIDADE] },
  { id: 'juridico', label: 'Jurídico', kanbanIds: [KANBAN_IDS.JURIDICO] },
  { id: 'moni_capital', label: 'Moní Capital', kanbanIds: [KANBAN_IDS.MONI_CAPITAL] },
] as const;

const KANBAN_PARA_INDICE_MAIN = new Map<string, number>();
for (let i = 0; i < ESTEIRA_TRES_ETAPAS.length; i++) {
  for (const kid of ESTEIRA_TRES_ETAPAS[i].kanbanIds) {
    KANBAN_PARA_INDICE_MAIN.set(kid, i);
  }
}

const KANBAN_PARALELO = new Map<string, (typeof FUNIS_PARALELOS_ESTEIRA)[number]>();
for (const funil of FUNIS_PARALELOS_ESTEIRA) {
  for (const kid of funil.kanbanIds) {
    KANBAN_PARALELO.set(kid, funil);
  }
}

/** Estágio da esteira principal em que o funil paralelo se ramifica. */
const PARALELO_RAMIFICACAO_MAIN: Record<string, number> = {
  credito_obra: 2,
  acoplamento: 1,
  contabilidade: 1,
  juridico: 1,
  moni_capital: 1,
};

export function indiceEsteiraTresEtapas(kanbanId: string): number {
  const kid = String(kanbanId ?? '').trim();
  const main = KANBAN_PARA_INDICE_MAIN.get(kid);
  if (typeof main === 'number') return main;
  const paralelo = KANBAN_PARALELO.get(kid);
  if (paralelo) return PARALELO_RAMIFICACAO_MAIN[paralelo.id] ?? 1;
  return 0;
}

export function isFunilParaleloEsteira(kanbanId: string): boolean {
  return KANBAN_PARALELO.has(String(kanbanId ?? '').trim());
}

export function configFunilParaleloEsteira(kanbanId: string): (typeof FUNIS_PARALELOS_ESTEIRA)[number] | null {
  return KANBAN_PARALELO.get(String(kanbanId ?? '').trim()) ?? null;
}

export function isFunilEsteiraPrincipal(kanbanId: string): boolean {
  return KANBAN_PARA_INDICE_MAIN.has(String(kanbanId ?? '').trim());
}

export function maxOrdemFaseKanban(
  kanbanId: string,
  maxOrdemPorKanban: Record<string, number> | undefined,
  fallbackOrdemCard: number,
): number {
  const fromMap = maxOrdemPorKanban?.[kanbanId];
  if (fromMap != null && fromMap > 0) return fromMap;
  return Math.max(1, fallbackOrdemCard);
}

export function ratioFaseNoKanban(
  card: { kanban_id: string; fase_ordem: number },
  maxOrdemPorKanban: Record<string, number> | undefined,
): number {
  const max = maxOrdemFaseKanban(card.kanban_id, maxOrdemPorKanban, card.fase_ordem);
  const ordem = Math.max(0, Number(card.fase_ordem ?? 0));
  if (ordem <= 0) return 0.08;
  return Math.max(0.08, Math.min(0.98, ordem / max));
}
