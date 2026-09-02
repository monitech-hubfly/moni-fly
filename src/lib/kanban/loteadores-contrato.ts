/** Checklist da fase «Cto Showroom» — Funil Loteadores (esteira v1). */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_CONTRATO_FASE_SLUG = 'cto_showroom_moni_inc' as const;

/** Slug legado pré-rename (fase inativa / deprecated). */
export const LOTEADORES_CONTRATO_FASE_SLUG_LEGADO = 'fechar_contrato_moni_inc' as const;

export const LOTEADORES_CONTRATO_CAMPOS = {
  dataAssinatura: 'showroom_data_assinatura',
  contrato: 'showroom_contrato',
} as const;

export const LOTEADORES_CONTRATO_CAMPOS_VISIVEIS = Object.values(LOTEADORES_CONTRATO_CAMPOS);

export function isLoteadoresContratoFaseSlug(slug: string | null | undefined): boolean {
  const s = String(slug ?? '').trim();
  return s === LOTEADORES_CONTRATO_FASE_SLUG || s === LOTEADORES_CONTRATO_FASE_SLUG_LEGADO;
}

export function isLoteadoresContratoCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_CONTRATO_CAMPOS_VISIVEIS);
}
