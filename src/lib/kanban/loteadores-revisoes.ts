/** Checklist da fase «Revisões + Forma Pgto» — Funil Loteadores. */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_REVISOES_FASE_SLUG = 'revisoes_moni_inc' as const;

export const LOTEADORES_REVISOES_CAMPOS = {
  nRodadas: 'revisoes_n_rodadas',
  ajustesImplementados: 'revisoes_ajustes_implementados',
  formaPagamentoDefinida: 'revisoes_forma_pagamento_definida',
  aprovacaoFinal: 'revisoes_aprovacao_final',
} as const;

export const LOTEADORES_REVISOES_CAMPOS_VISIVEIS = Object.values(LOTEADORES_REVISOES_CAMPOS);

export function isLoteadoresRevisoesFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_REVISOES_FASE_SLUG;
}

export function isLoteadoresRevisoesCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_REVISOES_CAMPOS_VISIVEIS);
}
