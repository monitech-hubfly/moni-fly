/** Checklist da fase «Viabilidade / Premissas» — Funil Loteadores. Spec v2: sem campos. */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_VIABILIDADE_FASE_SLUGS = [
  'viabilidade_moni_inc',
  'dados_loteador_moni_inc',
] as const;

/** Spec v2: nenhum campo de checklist. */
export const LOTEADORES_VIABILIDADE_CAMPOS = {} as const;

export const LOTEADORES_VIABILIDADE_CAMPOS_VISIVEIS: readonly string[] = [];

export function isLoteadoresViabilidadeFaseSlug(slug: string | null | undefined): boolean {
  const s = String(slug ?? '').trim();
  return (LOTEADORES_VIABILIDADE_FASE_SLUGS as readonly string[]).includes(s);
}

export function isLoteadoresViabilidadeCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_VIABILIDADE_CAMPOS_VISIVEIS);
}
