/** Checklist da fase «Cto c/ Precedentes» — Funil Loteadores.
 * Pop-up «Assinou?» ao avançar — ver loteadores-confirmacao-fase.ts
 */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_CTO_PRECEDENTES_FASE_SLUG = 'cto_precedentes_moni_inc' as const;

export const LOTEADORES_CTO_PRECEDENTES_CAMPOS = {
  dataAssinatura: 'data_assinatura_cto_precedentes',
  contrato: 'contrato_precedentes',
  motivoAssinatura: 'motivo_assinatura_precedentes',
} as const;

export const LOTEADORES_CTO_PRECEDENTES_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_CTO_PRECEDENTES_CAMPOS,
);

export function isLoteadoresCtoPrecedentesFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_CTO_PRECEDENTES_FASE_SLUG;
}

export function isLoteadoresCtoPrecedentesCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_CTO_PRECEDENTES_CAMPOS_VISIVEIS);
}
