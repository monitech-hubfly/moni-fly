/** Checklist da fase «Execução do Material» — Funil Loteadores. */

export const LOTEADORES_EXECUCAO_MATERIAL_FASE_SLUG = 'execucao_material_moni_inc' as const;

export const LOTEADORES_EXECUCAO_MATERIAL_CAMPOS = {
  simulacoesTresCasas: 'simulacoes_tres_casas',
  acoplamento: 'link_acoplamento',
  materiaisVisuais: 'materiais_visuais_apresentacao',
} as const;

export const LOTEADORES_EXECUCAO_MATERIAL_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_EXECUCAO_MATERIAL_CAMPOS,
);

/** Slugs legados removidos da UI (migration 341). */
export const LOTEADORES_EXECUCAO_MATERIAL_CAMPOS_REMOVIDOS = [
  'simulacao_casa_1',
  'simulacao_casa_2',
  'simulacao_casa_3',
  'oferta_showroom',
  'material_comercial',
  'material_institucional',
  'status_material',
] as const;

export function isLoteadoresExecucaoMaterialFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_EXECUCAO_MATERIAL_FASE_SLUG;
}

export function isLoteadoresExecucaoMaterialCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if (slug) {
    return (LOTEADORES_EXECUCAO_MATERIAL_CAMPOS_VISIVEIS as readonly string[]).includes(slug);
  }
  const label = String(item.label ?? '').trim();
  return (
    label === 'Simulações das 3 opções de casa' ||
    label === 'Acoplamentos' ||
    label === 'Link da Apresentação' ||
    label === 'Materiais visuais para apresentação'
  );
}
