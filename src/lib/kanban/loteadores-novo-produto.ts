/**
 * Fase «Novo Produto» — Funil Loteadores (antes de Viabilidade / Premissas).
 * SLA 20 d.u. Responsável padrão: Helenna Luz (`moni`).
 *
 * Entrada: carteira existente avaliada como incompatível com as necessidades do loteador.
 * Saída: novo produto definido e validado → avança para Viabilidade / Premissas.
 */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_NOVO_PRODUTO_FASE_SLUG = 'novo_produto_moni_inc' as const;

export const LOTEADORES_NOVO_PRODUTO_CAMPOS = {} as const;

export const LOTEADORES_NOVO_PRODUTO_CAMPOS_VISIVEIS: readonly string[] = [];

export function isLoteadoresNovoProdutoFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_NOVO_PRODUTO_FASE_SLUG;
}

export function isLoteadoresNovoProdutoCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_NOVO_PRODUTO_CAMPOS_VISIVEIS);
}
