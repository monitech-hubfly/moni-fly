/**
 * Fase «Acoplamento + Gbox» — Funil Loteadores.
 * Sem campos de checklist — apenas nota informativa.
 *
 * Bastão (igual a `acoplamento_moni_inc`): ao entrar nesta fase, spawna card filho
 * no Funil Acoplamento (`modelagem_terreno`). Flag `acoplamento_concluido` no pai
 * continua sendo atualizada pela esteira de Acoplamento (aprovado/reprovado).
 * Gate do Comitê exige `acoplamento_concluido === true` — inalterado.
 *
 * Ambas as fases (`acoplamento_moni_inc` e esta) disparam bastão; o segundo spawn
 * é no-op se já existir filho ativo (`criarCardFilho` idempotente).
 */

export const LOTEADORES_ACOPLAMENTO_GBOX_FASE_SLUG = 'acoplamento_gbox_moni_inc' as const;

/** Sem checklist — lista vazia. */
export const LOTEADORES_ACOPLAMENTO_GBOX_CAMPOS = {} as const;

export const LOTEADORES_ACOPLAMENTO_GBOX_CAMPOS_VISIVEIS: readonly string[] = [];

/** Itens legados da 512 a ocultar na UI. */
export const LOTEADORES_ACOPLAMENTO_GBOX_CAMPOS_OCULTOS = [
  'link_acoplamento',
  'link_gbox',
] as const;

export const LOTEADORES_ACOPLAMENTO_GBOX_NOTA =
  'Esta fase gera um card filho no Funil de Acoplamento (modelagem do terreno). Finalize Acoplamento + Gbox antes do Comitê.';

export function isLoteadoresAcoplamentoGboxFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_ACOPLAMENTO_GBOX_FASE_SLUG;
}

/** Nenhum campo de checklist visível nesta fase. */
export function isLoteadoresAcoplamentoGboxCampoVisivel(_item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return false;
}
