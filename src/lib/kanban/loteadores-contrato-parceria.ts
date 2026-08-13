/** Checklist da fase «Cto de Parceria» — Funil Loteadores.
 * Pop-up «Assinou?» ao avançar — ver loteadores-confirmacao-fase.ts
 */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_CONTRATO_PARCERIA_FASE_SLUG = 'contrato_parceria_moni_inc' as const;

export const LOTEADORES_CONTRATO_PARCERIA_CAMPOS = {
  dataAssinatura: 'parceria_data_assinatura',
  contrato: 'parceria_contrato',
} as const;

export const LOTEADORES_CONTRATO_PARCERIA_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_CONTRATO_PARCERIA_CAMPOS,
);

export function isLoteadoresContratoParceriaFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_CONTRATO_PARCERIA_FASE_SLUG;
}

export function isLoteadoresContratoParceriaCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_CONTRATO_PARCERIA_CAMPOS_VISIVEIS);
}
