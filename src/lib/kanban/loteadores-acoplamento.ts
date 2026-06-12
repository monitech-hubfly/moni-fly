/** Checklist da fase «Acoplamento» — Funil Loteadores. */

export const LOTEADORES_ACOPLAMENTO_FASE_SLUG = 'acoplamento_moni_inc' as const;

/** Campos espelhados da fase Viabilidade (mesmo `campo_slug`). */
export const LOTEADORES_ACOPLAMENTO_MIRROR_VIABILIDADE = [
  'lote_showroom_quadra',
  'lote_showroom',
  'planta_cadastral_lote',
  'fotos_lote',
  'videos_lote',
  'casas_simulacao',
  'manual_obra',
  'gadgets',
] as const;

export const LOTEADORES_ACOPLAMENTO_CAMPOS = {
  loteShowroomQuadra: 'lote_showroom_quadra',
  loteShowroom: 'lote_showroom',
  plantaCadastral: 'planta_cadastral_lote',
  fotosLote: 'fotos_lote',
  videosLote: 'videos_lote',
  casasSimulacao: 'casas_simulacao',
  manualObra: 'manual_obra',
  gadgets: 'gadgets',
  acoplamento: 'link_acoplamento',
  gbox: 'link_gbox',
} as const;

export const LOTEADORES_ACOPLAMENTO_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_ACOPLAMENTO_CAMPOS,
);

export const LOTEADORES_VIABILIDADE_FASE_SLUGS_ORDEM = [
  'viabilidade_moni_inc',
  'dados_loteador_moni_inc',
] as const;

export function isLoteadoresAcoplamentoFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_ACOPLAMENTO_FASE_SLUG;
}

export function isChecklistItemReadonly(item: {
  config_json?: Record<string, unknown> | null;
}): boolean {
  return item.config_json?.readonly === true;
}

export type LoteadorAcoplamentoSyncValor = {
  valor: string;
  arquivo_path: string | null;
};
