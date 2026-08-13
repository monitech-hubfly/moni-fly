/** Checklist da fase «Revisões» (pós-Comitê) — Funil Loteadores. */

export const LOTEADORES_REVISOES_POS_COMITE_FASE_SLUG = 'revisoes_pos_comite_moni_inc' as const;

export const LOTEADORES_REVISOES_POS_COMITE_CAMPOS = {
  ajustesRealizados: 'ajustes_realizados',
  versaoPosComite: 'versao_pos_comite',
  validadoAposRevisoes: 'validado_apos_revisoes',
} as const;

export const LOTEADORES_REVISOES_POS_COMITE_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_REVISOES_POS_COMITE_CAMPOS,
);

export const LOTEADORES_REVISOES_POS_COMITE_CAMPOS_LEGADOS = [
  'revisoes_pos_ajustes',
  'revisoes_pos_versao',
  'revisoes_pos_validado',
] as const;

export function isLoteadoresRevisoesPosComiteFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_REVISOES_POS_COMITE_FASE_SLUG;
}

export function isLoteadoresRevisoesPosComiteCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if (slug) {
    return (
      (LOTEADORES_REVISOES_POS_COMITE_CAMPOS_VISIVEIS as readonly string[]).includes(slug) ||
      (LOTEADORES_REVISOES_POS_COMITE_CAMPOS_LEGADOS as readonly string[]).includes(slug)
    );
  }
  const label = String(item.label ?? '').trim().toLowerCase();
  return (
    label.includes('ajuste') ||
    label.includes('versão') ||
    label.includes('versao') ||
    label.includes('validado')
  );
}
