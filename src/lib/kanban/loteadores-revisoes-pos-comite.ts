/** Checklist da fase «Revisões» (pós-Comitê) — Funil Loteadores. */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_REVISOES_POS_COMITE_FASE_SLUG = 'revisoes_pos_comite_moni_inc' as const;

export const LOTEADORES_REVISOES_POS_COMITE_CAMPOS = {
  ajustesRealizados: 'ajustes_realizados',
  versaoPosComite: 'versao_pos_comite',
  validadoAposRevisoes: 'validado_apos_revisoes',
} as const;

export const LOTEADORES_REVISOES_POS_COMITE_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_REVISOES_POS_COMITE_CAMPOS,
);

export function isLoteadoresRevisoesPosComiteFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_REVISOES_POS_COMITE_FASE_SLUG;
}

export function isLoteadoresRevisoesPosComiteCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_REVISOES_POS_COMITE_CAMPOS_VISIVEIS);
}
