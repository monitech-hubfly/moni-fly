/** Checklist da fase «Executar Material» — Funil Loteadores. */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_EXECUCAO_MATERIAL_FASE_SLUG = 'execucao_material_moni_inc' as const;

export const LOTEADORES_EXECUCAO_MATERIAL_CAMPOS = {
  pptCriado: 'ppt_criado',
  /** Legado — sync do link de acoplamento da fase anterior. */
  acoplamento: 'link_acoplamento',
} as const;

export const LOTEADORES_EXECUCAO_MATERIAL_CAMPOS_VISIVEIS = [
  LOTEADORES_EXECUCAO_MATERIAL_CAMPOS.pptCriado,
] as const;

export function isLoteadoresExecucaoMaterialFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_EXECUCAO_MATERIAL_FASE_SLUG;
}

export function isLoteadoresExecucaoMaterialCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_EXECUCAO_MATERIAL_CAMPOS_VISIVEIS);
}
