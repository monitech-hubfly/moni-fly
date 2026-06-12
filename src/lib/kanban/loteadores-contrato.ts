/** Checklist da fase «Contrato» — Funil Loteadores. */

export const LOTEADORES_CONTRATO_FASE_SLUG = 'fechar_contrato_moni_inc' as const;

export const LOTEADORES_CONTRATO_CAMPOS = {
  contratoAssinado: 'contrato_assinado',
} as const;

export function isLoteadoresContratoFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_CONTRATO_FASE_SLUG;
}
