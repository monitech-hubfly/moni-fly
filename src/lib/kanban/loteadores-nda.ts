/** Checklist da fase «NDA» — Funil Loteadores. */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_NDA_FASE_SLUG = 'nda_moni_inc' as const;

export const LOTEADORES_NDA_CAMPOS = {
  dataEnvio: 'data_envio_nda',
  dataAssinatura: 'data_assinatura_nda',
  arquivoAssinado: 'arquivo_nda_assinado',
} as const;

export const LOTEADORES_NDA_CAMPOS_VISIVEIS = Object.values(LOTEADORES_NDA_CAMPOS);

export function isLoteadoresNdaFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_NDA_FASE_SLUG;
}

export function isLoteadoresNdaCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_NDA_CAMPOS_VISIVEIS);
}
