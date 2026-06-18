import { KANBAN_IDS } from '@/lib/constants/kanban-ids';

/** Etapas sequenciais da esteira principal documentada na Rede de Franqueados. */
export const ESTEIRA_PRINCIPAL_ETAPAS = [
  {
    id: 'step_one',
    label: 'Step One',
    kanbanId: KANBAN_IDS.STEP_ONE,
    ordemFaseMaxEstimada: 13,
  },
  {
    id: 'portfolio',
    label: 'Portfólio',
    kanbanId: KANBAN_IDS.PORTFOLIO,
    ordemFaseMaxEstimada: 20,
  },
  {
    id: 'acoplamento',
    label: 'Acoplamento',
    kanbanId: KANBAN_IDS.ACOPLAMENTO,
    ordemFaseMaxEstimada: 6,
  },
  {
    id: 'operacoes',
    label: 'Operações',
    kanbanId: KANBAN_IDS.OPERACOES,
    ordemFaseMaxEstimada: 18,
  },
] as const;

export type EsteiraPrincipalEtapaId = (typeof ESTEIRA_PRINCIPAL_ETAPAS)[number]['id'];

/** Funis da esteira principal (ordem fixa). */
export const KANBANS_ESTEIRA_PRINCIPAL = new Set(
  ESTEIRA_PRINCIPAL_ETAPAS.map((e) => e.kanbanId),
);

/**
 * Mapeia o funil real do card para o índice da esteira principal (0–3).
 * Funis paralelos herdam o estágio em que normalmente se ramificam.
 */
const KANBAN_INDICE_ESTEIRA: Record<string, number> = {
  [KANBAN_IDS.STEP_ONE]: 0,
  [KANBAN_IDS.LOTEADORES]: 0,
  [KANBAN_IDS.PORTFOLIO]: 1,
  [KANBAN_IDS.JURIDICO]: 1,
  [KANBAN_IDS.MONI_CAPITAL]: 1,
  [KANBAN_IDS.CONTABILIDADE]: 1,
  [KANBAN_IDS.ACOPLAMENTO]: 2,
  [KANBAN_IDS.OPERACOES]: 3,
  [KANBAN_IDS.CREDITO_OBRA]: 3,
  [KANBAN_IDS.PROJETO_LEGAL]: 3,
  [KANBAN_IDS.PROJETOS_LOCAIS]: 3,
  [KANBAN_IDS.PROJETOS_LEGAIS]: 3,
  [KANBAN_IDS.CONTRATACOES]: 3,
  [KANBAN_IDS.HDM_PRODUTO]: 3,
  [KANBAN_IDS.HDM_MODELO_VIRTUAL]: 3,
  [KANBAN_IDS.HDM_HOMOLOGACOES]: 3,
};

export function indiceEstagioEsteiraPrincipal(kanbanId: string): number {
  const idx = KANBAN_INDICE_ESTEIRA[String(kanbanId ?? '').trim()];
  return typeof idx === 'number' ? idx : 0;
}

export function isFunilEsteiraPrincipal(kanbanId: string): boolean {
  return (KANBANS_ESTEIRA_PRINCIPAL as Set<string>).has(String(kanbanId ?? '').trim());
}

export function ordemFaseMaxEstimadaEsteira(kanbanId: string): number {
  const etapa = ESTEIRA_PRINCIPAL_ETAPAS.find((e) => e.kanbanId === kanbanId);
  if (etapa) return etapa.ordemFaseMaxEstimada;
  const idx = indiceEstagioEsteiraPrincipal(kanbanId);
  return ESTEIRA_PRINCIPAL_ETAPAS[idx]?.ordemFaseMaxEstimada ?? 12;
}
