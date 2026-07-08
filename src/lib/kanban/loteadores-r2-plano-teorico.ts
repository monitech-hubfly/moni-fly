/** Checklist da fase «R2 — Apresentar Plano Teórico» — Funil Loteadores. */

export const LOTEADORES_R2_PLANO_TEORICO_FASE_SLUG = 'r2_plano_teorico_moni_inc' as const;

export const LOTEADORES_R2_PLANO_TEORICO_CAMPOS = {
  casaShowroom: 'casa_showroom',
  concordaGadgets: 'concorda_gadgets',
  formaPagamento: 'forma_pagamento',
  adendosObservacoes: 'adendos_observacoes',
  comentariosFinais: 'comentarios_finais',
} as const;

export const LOTEADORES_R2_PLANO_TEORICO_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_R2_PLANO_TEORICO_CAMPOS,
);

export const LOTEADORES_R2_PLANO_TEORICO_CAMPOS_REMOVIDOS = [
  'loteador_de_acordo',
  'motivo_nao_acordo',
  'ajustes_solicitados',
  'proximos_passos',
  'casa_sugerida',
] as const;

export function isLoteadoresR2PlanoTeoricoFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_R2_PLANO_TEORICO_FASE_SLUG;
}

export function isLoteadoresR2PlanoTeoricoCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if (slug) {
    return (LOTEADORES_R2_PLANO_TEORICO_CAMPOS_VISIVEIS as readonly string[]).includes(slug);
  }
  const label = String(item.label ?? '').trim();
  return (
    label === 'Qual casa será usada?' ||
    label === 'O loteador concorda com a lista de gadgets?' ||
    label === 'Concorda com gadgets' ||
    label === 'Forma de pagamento' ||
    label === 'Adendos / observações' ||
    label === 'Comentários finais'
  );
}
