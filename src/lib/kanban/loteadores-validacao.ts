/** Checklist da fase «Validação» — Funil Loteadores. */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_VALIDACAO_FASE_SLUG = 'validacao_moni_inc' as const;

export const LOTEADORES_VALIDACAO_CAMPOS = {
  dataValidacao: 'data_validacao',
  feedbacksAjustes: 'feedbacks_ajustes',
} as const;

export const LOTEADORES_VALIDACAO_CAMPOS_VISIVEIS = Object.values(LOTEADORES_VALIDACAO_CAMPOS);

export function isLoteadoresValidacaoFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_VALIDACAO_FASE_SLUG;
}

export function isLoteadoresValidacaoCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_VALIDACAO_CAMPOS_VISIVEIS);
}
