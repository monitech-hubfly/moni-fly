import { FASE_SLUGS } from '@/lib/constants/kanban-ids';

export type TrancheVinculoIndex = 1 | 2 | 3 | 4 | 5;

export type TrancheVinculoConfig = {
  index: TrancheVinculoIndex;
  /** Rótulo na sidebar do modal Operações */
  nome: string;
  /** Slug da fase do card Crédito Obra filho antes de concluir */
  faseOrigemSlug: string;
  faseOrigemLabel: string;
  /** Slug de destino após concluir o vínculo */
  faseDestinoSlug: string;
  faseDestinoLabel: string;
};

/**
 * Vínculos preset Operações → Crédito Obra.
 * "Aguardando Nª Tranche" não existe como slug único após a 1ª; mapeamos para a fase
 * de acompanhamento da liberação da tranche anterior (co_acompanhamento_*).
 */
export const OPERACOES_TRANCHE_VINCULOS: TrancheVinculoConfig[] = [
  {
    index: 1,
    nome: 'Necessidade de 2ª Tranche',
    faseOrigemSlug: FASE_SLUGS.CO_AGUARDANDO_1A_TRANCHE,
    faseOrigemLabel: 'Aguardando 1ª Tranche',
    faseDestinoSlug: FASE_SLUGS.CO_SOLICITACAO_TRANCHE,
    faseDestinoLabel: 'Necessidade de 2ª Tranche',
  },
  {
    index: 2,
    nome: 'Necessidade de 3ª Tranche',
    faseOrigemSlug: FASE_SLUGS.CO_ACOMPANHAMENTO_TRANCHE,
    faseOrigemLabel: 'Aguardando 2ª Tranche',
    faseDestinoSlug: FASE_SLUGS.CO_NECESSIDADE_3A_TRANCHE,
    faseDestinoLabel: 'Necessidade de 3ª Tranche',
  },
  {
    index: 3,
    nome: 'Necessidade de 4ª Tranche',
    faseOrigemSlug: FASE_SLUGS.CO_ACOMPANHAMENTO_3A,
    faseOrigemLabel: 'Aguardando 3ª Tranche',
    faseDestinoSlug: FASE_SLUGS.CO_NECESSIDADE_4A_TRANCHE,
    faseDestinoLabel: 'Necessidade de 4ª Tranche',
  },
  {
    index: 4,
    nome: 'Necessidade de 5ª Tranche',
    faseOrigemSlug: FASE_SLUGS.CO_ACOMPANHAMENTO_4A,
    faseOrigemLabel: 'Aguardando 4ª Tranche',
    faseDestinoSlug: FASE_SLUGS.CO_NECESSIDADE_5A_TRANCHE,
    faseDestinoLabel: 'Necessidade de 5ª Tranche',
  },
  {
    index: 5,
    nome: 'Necessidade de 6ª Tranche',
    faseOrigemSlug: FASE_SLUGS.CO_ACOMPANHAMENTO_5A,
    faseOrigemLabel: 'Aguardando 5ª Tranche',
    faseDestinoSlug: FASE_SLUGS.CO_NECESSIDADE_6A_TRANCHE,
    faseDestinoLabel: 'Necessidade de 6ª Tranche',
  },
];

export function configTrancheVinculo(index: number): TrancheVinculoConfig | null {
  return OPERACOES_TRANCHE_VINCULOS.find((v) => v.index === index) ?? null;
}

export function indiceTrancheValido(index: number): index is TrancheVinculoIndex {
  return Number.isInteger(index) && index >= 1 && index <= 5;
}
