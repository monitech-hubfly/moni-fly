/** Checklist da fase «Diligência» — Funil Loteadores. */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_DILIGENCIA_FASE_SLUG = 'diligencia_moni_inc' as const;

export const LOTEADORES_DILIGENCIA_CAMPOS = {
  relatorio: 'diligencia_relatorio',
} as const;

export const LOTEADORES_DILIGENCIA_CAMPOS_VISIVEIS = Object.values(LOTEADORES_DILIGENCIA_CAMPOS);

export function isLoteadoresDiligenciaFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_DILIGENCIA_FASE_SLUG;
}

export function isLoteadoresDiligenciaCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_DILIGENCIA_CAMPOS_VISIVEIS);
}
