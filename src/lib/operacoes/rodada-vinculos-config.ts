import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  nomeTagRodadaDivify,
  type DivifyRodadaNumero,
} from '@/lib/kanban/divify-tag-rodada';

/** Funil Divify / Moní Capital — destino dos cards filhos de rodada. */
export const DIVIFY_KANBAN_ID = KANBAN_IDS.MONI_CAPITAL; // 724aef36-37de-4454-bf6f-ec481693aeeb

/** Funil Operações — cards pai dos vínculos de rodada. */
export const OPERACOES_KANBAN_ID = KANBAN_IDS.OPERACOES; // f6bba1de-a7a1-4b14-89d1-10c2f7bba636

export type RodadaVinculoIndex = 1 | 2 | 3 | 4 | 5 | 6;

export type RodadaVinculoConfig = {
  index: RodadaVinculoIndex;
  /** Rótulo na sidebar do modal Operações */
  nome: string;
  /** Tag aplicada ao card filho criado */
  tagRodada: DivifyRodadaNumero;
  tagLabel: string;
  /** Slug de destino do novo card (Funil Divify) — 1ª fase: Recebimento */
  faseDestinoSlug: string;
};

/**
 * Vínculos preset Operações → Funil Divify (1ª–6ª rodada).
 * Todas disponíveis na lista (sem gate de 1ª via bastão).
 * Ao concluir, cria card filho com tag de rodada na fase `capital_recebimento`.
 */
export const OPERACOES_RODADA_VINCULOS: RodadaVinculoConfig[] = (
  [1, 2, 3, 4, 5, 6] as const
).map((index) => ({
  index,
  nome: `Necessidade de ${index}ª Rodada`,
  tagRodada: index,
  tagLabel: nomeTagRodadaDivify(index),
  faseDestinoSlug: FASE_SLUGS.CAPITAL_RECEBIMENTO, // ordem 1 — Recebimento (DEV confirmado)
}));

export function configRodadaVinculo(index: number): RodadaVinculoConfig | null {
  return OPERACOES_RODADA_VINCULOS.find((v) => v.index === index) ?? null;
}

export function indiceRodadaValido(index: number): index is RodadaVinculoIndex {
  return Number.isInteger(index) && index >= 1 && index <= 6;
}

/** Papéis que podem abrir rodadas 1ª–6ª (sidebar Vínculos + server action). */
export const ROLES_PODE_ABRIR_RODADA_VINCULOS = [
  'admin',
  'team',
  'consultor',
  'supervisor',
] as const;

export function rolePodeAbrirRodadaVinculosOperacoes(role: string | null | undefined): boolean {
  const r = String(role ?? '').trim().toLowerCase();
  return (ROLES_PODE_ABRIR_RODADA_VINCULOS as readonly string[]).includes(r);
}
