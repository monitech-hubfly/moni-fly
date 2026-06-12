/** Checklist da fase «Viabilidade» — Funil Loteadores. */

export const LOTEADORES_VIABILIDADE_FASE_SLUGS = [
  'viabilidade_moni_inc',
  'dados_loteador_moni_inc',
] as const;

export const LOTEADORES_VIABILIDADE_CAMPOS = {
  mapaCompetidores: 'mapa_competidores',
  loteShowroomQuadra: 'lote_showroom_quadra',
  loteShowroom: 'lote_showroom',
  plantaCadastral: 'planta_cadastral_lote',
  fotosLote: 'fotos_lote',
  videosLote: 'videos_lote',
  casasSimulacao: 'casas_simulacao',
  manualObra: 'manual_obra',
  gadgets: 'gadgets',
} as const;

export const LOTEADORES_VIABILIDADE_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_VIABILIDADE_CAMPOS,
);
