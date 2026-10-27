/** Checklist da fase «Passagem IMOB» — Funil Loteadores. */

import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const PERGUNTA_INTENCAO_SHOWROOM_LOTEADOR =
  'O loteador tem intenção de fazer Showroom?';

export const ERRO_INTENCAO_SHOWROOM_PASSAGEM_IMOB =
  'Responda se o loteador tem intenção de fazer Showroom antes de entrar em Passagem IMOB.';

export const LOTEADORES_PASSAGEM_WAYSERS_FASE_SLUG = 'passagem_waysers_moni_inc' as const;

export const LOTEADORES_PASSAGEM_WAYSERS_CAMPOS = {
  briefingCompleto: 'briefing_completo_preparado',
} as const;

export const LOTEADORES_PASSAGEM_WAYSERS_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_PASSAGEM_WAYSERS_CAMPOS,
);

export function isLoteadoresPassagemWaysersFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_PASSAGEM_WAYSERS_FASE_SLUG;
}

/** Entrada em Passagem IMOB no Funil Loteadores: a resposta é obrigatória para o card mudar de fase. */
export function devePerguntarIntencaoShowroomPassagem(input: {
  kanbanId: string | null | undefined;
  faseOrigemSlug: string | null | undefined;
  faseDestinoSlug: string | null | undefined;
}): boolean {
  if (String(input.kanbanId ?? '').trim() !== KANBAN_IDS.LOTEADORES) return false;
  const destino = String(input.faseDestinoSlug ?? '').trim();
  const origem = String(input.faseOrigemSlug ?? '').trim();
  if (destino !== FASE_SLUGS.PASSAGEM_WAYSERS_MONI_INC) return false;
  if (origem === destino) return false;
  return true;
}

export function isLoteadoresPassagemWaysersCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_PASSAGEM_WAYSERS_CAMPOS_VISIVEIS);
}
