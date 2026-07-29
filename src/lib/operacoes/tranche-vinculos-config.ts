import { FASE_SLUGS } from '@/lib/constants/kanban-ids';

export type TrancheVinculoIndex = 1 | 2;

export type TrancheVinculoConfig = {
  index: TrancheVinculoIndex;
  /** Rótulo na sidebar do modal Operações */
  nome: string;
  /** Slug de destino após concluir o vínculo (Funil Crédito Obra) */
  faseDestinoSlug: string;
  faseDestinoLabel: string;
};

/** Vínculos preset Operações → Crédito Obra. Ao concluir, move o card filho para a fase de destino. */
export const OPERACOES_TRANCHE_VINCULOS: TrancheVinculoConfig[] = [
  {
    index: 1,
    nome: 'Necessidade de Tranche',
    faseDestinoSlug: FASE_SLUGS.CO_SOLICITACAO_TRANCHE,
    faseDestinoLabel: 'Necessidade de Tranche',
  },
  {
    index: 2,
    nome: 'Captação adicional',
    faseDestinoSlug: FASE_SLUGS.CO_NECESSIDADE_3A_TRANCHE,
    faseDestinoLabel: 'Captação adicional',
  },
];

export function configTrancheVinculo(index: number): TrancheVinculoConfig | null {
  return OPERACOES_TRANCHE_VINCULOS.find((v) => v.index === index) ?? null;
}

export function indiceTrancheValido(index: number): index is TrancheVinculoIndex {
  return Number.isInteger(index) && index >= 1 && index <= 2;
}
