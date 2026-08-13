/**
 * Fase «Acoplamento + Gbox» — Funil Loteadores.
 * Spec v2: sem campos e sem instruções.
 *
 * Bastão (igual a `acoplamento_moni_inc`): ao entrar nesta fase, spawna card filho
 * no Funil Acoplamento (`modelagem_terreno`).
 */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_ACOPLAMENTO_GBOX_FASE_SLUG = 'acoplamento_gbox_moni_inc' as const;

export const LOTEADORES_ACOPLAMENTO_GBOX_CAMPOS = {} as const;

export const LOTEADORES_ACOPLAMENTO_GBOX_CAMPOS_VISIVEIS: readonly string[] = [];

export function isLoteadoresAcoplamentoGboxFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_ACOPLAMENTO_GBOX_FASE_SLUG;
}

export function isLoteadoresAcoplamentoGboxCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_ACOPLAMENTO_GBOX_CAMPOS_VISIVEIS);
}
