/** Checklist da fase «Validação» — Funil Loteadores. */

export const LOTEADORES_VALIDACAO_FASE_SLUG = 'validacao_moni_inc' as const;

export const LOTEADORES_VALIDACAO_CAMPOS = {
  dataValidacao: 'data_validacao',
  feedbacksAjustes: 'feedbacks_ajustes',
} as const;

export const LOTEADORES_VALIDACAO_CAMPOS_VISIVEIS = Object.values(LOTEADORES_VALIDACAO_CAMPOS);

export const LOTEADORES_VALIDACAO_CAMPOS_LEGADOS = [
  'validacao_data',
  'validacao_feedbacks',
] as const;

export function isLoteadoresValidacaoFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_VALIDACAO_FASE_SLUG;
}

export function isLoteadoresValidacaoCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if (slug) {
    return (
      (LOTEADORES_VALIDACAO_CAMPOS_VISIVEIS as readonly string[]).includes(slug) ||
      (LOTEADORES_VALIDACAO_CAMPOS_LEGADOS as readonly string[]).includes(slug)
    );
  }
  const label = String(item.label ?? '').trim().toLowerCase();
  return label.includes('valida') || label.includes('feedback');
}
