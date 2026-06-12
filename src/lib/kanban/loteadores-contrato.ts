/** Checklist da fase «Contrato» — Funil Loteadores. */

export const LOTEADORES_CONTRATO_FASE_SLUG = 'fechar_contrato_moni_inc' as const;

export const LOTEADORES_CONTRATO_CAMPOS = {
  contratoAssinado: 'contrato_assinado',
} as const;

export const LOTEADORES_CONTRATO_CAMPOS_VISIVEIS = Object.values(LOTEADORES_CONTRATO_CAMPOS);

export const LOTEADORES_CONTRATO_CAMPOS_REMOVIDOS = [
  'contrato_enviado',
  'data_assinatura',
  'cnpj_contratante',
  'contrato_anexado',
  'documentos_complementares',
] as const;

export function isLoteadoresContratoFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_CONTRATO_FASE_SLUG;
}

export function isLoteadoresContratoCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if (slug) {
    return (LOTEADORES_CONTRATO_CAMPOS_VISIVEIS as readonly string[]).includes(slug);
  }
  const label = String(item.label ?? '').trim();
  return label === 'Contrato assinado';
}
