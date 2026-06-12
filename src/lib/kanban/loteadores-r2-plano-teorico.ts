/** Checklist da fase «R2 — Apresentar Plano Teórico» — Funil Loteadores. */

export const LOTEADORES_R2_PLANO_TEORICO_FASE_SLUG = 'r2_plano_teorico_moni_inc' as const;

export const LOTEADORES_R2_PLANO_TEORICO_CAMPOS = {
  casaShowroom: 'casa_showroom',
  concordaGadgets: 'concorda_gadgets',
  formaPagamento: 'forma_pagamento',
  loteadorDeAcordo: 'loteador_de_acordo',
  motivoNaoAcordo: 'motivo_nao_acordo',
  adendosObservacoes: 'adendos_observacoes',
} as const;

export const LOTEADORES_R2_PLANO_TEORICO_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_R2_PLANO_TEORICO_CAMPOS,
);

export function isLoteadoresR2PlanoTeoricoFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_R2_PLANO_TEORICO_FASE_SLUG;
}
