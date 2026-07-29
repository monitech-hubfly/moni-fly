import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import type { CreditoObraTrancheNumero } from '@/lib/kanban/credito-obra-tag-tranche';

export type TrancheVinculoIndex = 2 | 3 | 4 | 5 | 6;

export type TrancheVinculoConfig = {
  index: TrancheVinculoIndex;
  /** Rótulo na sidebar do modal Operações */
  nome: string;
  /** Tag aplicada ao card filho criado */
  tagTranche: CreditoObraTrancheNumero;
  tagLabel: string;
  /** Slug de destino do novo card (Funil Crédito Obra) */
  faseDestinoSlug: string;
};

/** Vínculos preset Operações → Crédito Obra (2ª–6ª tranche). Ao concluir, cria card filho com tag. */
export const OPERACOES_TRANCHE_VINCULOS: TrancheVinculoConfig[] = [
  {
    index: 2,
    nome: 'Necessidade de 2ª Tranche',
    tagTranche: 2,
    tagLabel: '2ª tranche',
    faseDestinoSlug: FASE_SLUGS.CO_NOVO_PROJETO,
  },
  {
    index: 3,
    nome: 'Necessidade de 3ª Tranche',
    tagTranche: 3,
    tagLabel: '3ª tranche',
    faseDestinoSlug: FASE_SLUGS.CO_NOVO_PROJETO,
  },
  {
    index: 4,
    nome: 'Necessidade de 4ª Tranche',
    tagTranche: 4,
    tagLabel: '4ª tranche',
    faseDestinoSlug: FASE_SLUGS.CO_NOVO_PROJETO,
  },
  {
    index: 5,
    nome: 'Necessidade de 5ª Tranche',
    tagTranche: 5,
    tagLabel: '5ª tranche',
    faseDestinoSlug: FASE_SLUGS.CO_NOVO_PROJETO,
  },
  {
    index: 6,
    nome: 'Necessidade de 6ª Tranche',
    tagTranche: 6,
    tagLabel: '6ª tranche',
    faseDestinoSlug: FASE_SLUGS.CO_NOVO_PROJETO,
  },
];

/** Fases Operações em que o 1º card Crédito Obra (1ª tranche) já se presume aberto. */
export const OPERACOES_FASES_COM_PRIMEIRA_TRANCHE_CO = [
  FASE_SLUGS.APROVACAO_PREFEITURA,
  FASE_SLUGS.REVISAO_BCA,
  FASE_SLUGS.AGUARDANDO_CREDITO,
  FASE_SLUGS.EM_OBRA,
] as const;

export function faseOperacoesPresumePrimeiraTrancheCo(faseSlug: string | null | undefined): boolean {
  const s = String(faseSlug ?? '').trim();
  if (!s) return false;
  return (OPERACOES_FASES_COM_PRIMEIRA_TRANCHE_CO as readonly string[]).includes(s);
}

export function configTrancheVinculo(index: number): TrancheVinculoConfig | null {
  return OPERACOES_TRANCHE_VINCULOS.find((v) => v.index === index) ?? null;
}

export function indiceTrancheValido(index: number): index is TrancheVinculoIndex {
  return Number.isInteger(index) && index >= 2 && index <= 6;
}
