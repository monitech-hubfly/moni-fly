import { KANBAN_IDS } from '@/lib/constants/kanban-ids';

/** Esteira sequencial da visão franqueadora: Step One → Portfólio → Pré Obra e Obra. */
export const ESTEIRA_TRES_ETAPAS = [
  {
    id: 'step_one',
    label: 'Step One',
    kanbanIds: [KANBAN_IDS.STEP_ONE, KANBAN_IDS.LOTEADORES],
  },
  {
    id: 'portfolio',
    label: 'Portfólio',
    kanbanIds: [
      KANBAN_IDS.PORTFOLIO,
      KANBAN_IDS.ACOPLAMENTO,
      KANBAN_IDS.JURIDICO,
      KANBAN_IDS.MONI_CAPITAL,
      KANBAN_IDS.CONTABILIDADE,
    ],
  },
  {
    id: 'pre_obra_obra',
    label: 'Pré Obra e Obra',
    kanbanIds: [
      KANBAN_IDS.OPERACOES,
      KANBAN_IDS.CREDITO_OBRA,
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

const KANBAN_PARA_INDICE = new Map<string, number>();
for (let i = 0; i < ESTEIRA_TRES_ETAPAS.length; i++) {
  for (const kid of ESTEIRA_TRES_ETAPAS[i].kanbanIds) {
    KANBAN_PARA_INDICE.set(kid, i);
  }
}

export function indiceEsteiraTresEtapas(kanbanId: string): number {
  const idx = KANBAN_PARA_INDICE.get(String(kanbanId ?? '').trim());
  return typeof idx === 'number' ? idx : 0;
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
