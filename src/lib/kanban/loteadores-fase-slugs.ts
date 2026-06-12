/** Slugs canônicos do Funil Loteadores — reaproveitamento de fases legadas. */

/** Fase Viabilidade: preferir slug novo; fallback slug legado «Dados do Loteador». */
export const LOTEADORES_VIABILIDADE_SLUGS = ['viabilidade_moni_inc', 'dados_loteador_moni_inc'] as const;

export type LoteadoresViabilidadeSlug = (typeof LOTEADORES_VIABILIDADE_SLUGS)[number];

export function isLoteadoresViabilidadeFaseSlug(slug: string | null | undefined): boolean {
  const s = String(slug ?? '').trim();
  return (LOTEADORES_VIABILIDADE_SLUGS as readonly string[]).includes(s);
}

/** Slug canônico preferido para código novo (fase pode ainda usar legado no banco). */
export const LOTEADORES_VIABILIDADE_SLUG_PREFERIDO = 'viabilidade_moni_inc' as const;
