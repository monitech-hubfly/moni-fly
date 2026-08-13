/** Checklist da fase «R2 Apresentação» — Funil Loteadores. */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_R2_PLANO_TEORICO_FASE_SLUG = 'r2_plano_teorico_moni_inc' as const;

export const LOTEADORES_R2_PLANO_TEORICO_CAMPOS = {
  dataApresentacao: 'r2_data_apresentacao',
  ajustesParceiro: 'r2_ajustes_parceiro',
  formaPagamentoDiscutida: 'r2_forma_pagamento_discutida',
  proximosPassos: 'r2_proximos_passos',
} as const;

export const LOTEADORES_R2_PLANO_TEORICO_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_R2_PLANO_TEORICO_CAMPOS,
);

export function isLoteadoresR2PlanoTeoricoFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_R2_PLANO_TEORICO_FASE_SLUG;
}

export function isLoteadoresR2PlanoTeoricoCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_R2_PLANO_TEORICO_CAMPOS_VISIVEIS);
}
