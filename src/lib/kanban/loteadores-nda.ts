/** Checklist da fase «NDA» — Funil Loteadores. */

export const LOTEADORES_NDA_FASE_SLUG = 'nda_moni_inc' as const;

export const LOTEADORES_NDA_CAMPOS = {
  dataEnvio: 'data_envio_nda',
  dataAssinatura: 'data_assinatura_nda',
  arquivoAssinado: 'arquivo_nda_assinado',
} as const;

export const LOTEADORES_NDA_CAMPOS_VISIVEIS = Object.values(LOTEADORES_NDA_CAMPOS);

/** Slugs legados da migration 512 (renomeados no Prompt 7). */
export const LOTEADORES_NDA_CAMPOS_LEGADOS = [
  'nda_data_envio',
  'nda_data_assinatura',
  'nda_arquivo',
] as const;

export function isLoteadoresNdaFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_NDA_FASE_SLUG;
}

export function isLoteadoresNdaCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if (slug) {
    return (
      (LOTEADORES_NDA_CAMPOS_VISIVEIS as readonly string[]).includes(slug) ||
      (LOTEADORES_NDA_CAMPOS_LEGADOS as readonly string[]).includes(slug)
    );
  }
  const label = String(item.label ?? '').trim().toLowerCase();
  return label.includes('nda') || label.includes('envio') || label.includes('assinatura');
}
