/** Checklist da fase «Revisões» — Funil Loteadores. */

export const LOTEADORES_REVISOES_FASE_SLUG = 'revisoes_moni_inc' as const;

export const LOTEADORES_REVISOES_CAMPOS = {
  anexosAtualizados: 'anexos_atualizados',
} as const;

export function isLoteadoresRevisoesFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_REVISOES_FASE_SLUG;
}
