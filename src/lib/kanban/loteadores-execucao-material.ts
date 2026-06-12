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

export function isLoteadoresExecucaoMaterialFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_EXECUCAO_MATERIAL_FASE_SLUG;
}
