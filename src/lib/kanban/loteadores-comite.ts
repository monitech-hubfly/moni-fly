/** Checklist da fase «Comitê» — Funil Loteadores. */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_COMITE_FASE_SLUG = 'comite_moni_inc' as const;

export const LOTEADORES_COMITE_CAMPOS = {
  dataDeliberacao: 'comite_data_deliberacao',
  decisao: 'comite_decisao',
  ressalvas: 'comite_ressalvas',
  membros: 'comite_membros',
} as const;

export const LOTEADORES_COMITE_CAMPOS_VISIVEIS = Object.values(LOTEADORES_COMITE_CAMPOS);

export function isLoteadoresComiteFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_COMITE_FASE_SLUG;
}

export function isLoteadoresComiteCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_COMITE_CAMPOS_VISIVEIS);
}
