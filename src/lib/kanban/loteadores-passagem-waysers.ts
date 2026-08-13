/** Checklist da fase «Passagem para Waysers» — Funil Loteadores. */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

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

export function isLoteadoresPassagemWaysersCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_PASSAGEM_WAYSERS_CAMPOS_VISIVEIS);
}
