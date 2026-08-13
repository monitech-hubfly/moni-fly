/** Checklist da fase «Cto Showroom» — Funil Loteadores (esteira v1). */

export const LOTEADORES_CONTRATO_FASE_SLUG = 'cto_showroom_moni_inc' as const;

/** Slug legado pré-rename (fase inativa / deprecated). */
export const LOTEADORES_CONTRATO_FASE_SLUG_LEGADO = 'fechar_contrato_moni_inc' as const;

export const LOTEADORES_CONTRATO_CAMPOS = {
  dataAssinatura: 'showroom_data_assinatura',
  contrato: 'showroom_contrato',
  /** Campo legado (pré-v1). */
  contratoAssinado: 'contrato_assinado',
} as const;

export const LOTEADORES_CONTRATO_CAMPOS_VISIVEIS = [
  LOTEADORES_CONTRATO_CAMPOS.dataAssinatura,
  LOTEADORES_CONTRATO_CAMPOS.contrato,
  LOTEADORES_CONTRATO_CAMPOS.contratoAssinado,
] as const;

export const LOTEADORES_CONTRATO_CAMPOS_REMOVIDOS = [
  'contrato_enviado',
  'data_assinatura',
  'cnpj_contratante',
  'contrato_anexado',
  'documentos_complementares',
] as const;

export function isLoteadoresContratoFaseSlug(slug: string | null | undefined): boolean {
  const s = String(slug ?? '').trim();
  return s === LOTEADORES_CONTRATO_FASE_SLUG || s === LOTEADORES_CONTRATO_FASE_SLUG_LEGADO;
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
  return (
    label === 'Contrato assinado' ||
    label === 'Data de assinatura' ||
    label === 'Arquivo do contrato assinado'
  );
}
