/** Checklist da fase «R3 — Ajustes Finais nas Propostas» — Funil Loteadores. */

export const LOTEADORES_R3_AJUSTES_FINAIS_FASE_SLUG = 'r3_ajustes_finais_moni_inc' as const;

export const LOTEADORES_R3_AJUSTES_FINAIS_CAMPOS = {
  parecerFinal: 'parecer_final',
  proximosPassos: 'proximos_passos',
} as const;

export const LOTEADORES_R3_AJUSTES_FINAIS_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_R3_AJUSTES_FINAIS_CAMPOS,
);

export const LOTEADORES_R3_AJUSTES_FINAIS_CAMPOS_REMOVIDOS = [
  'data_apresentacao_final',
  'participantes_apresentacao',
  'aceite_final',
  'observacoes_finais',
  'encaminhamentos',
] as const;

export function isLoteadoresR3AjustesFinaisFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_R3_AJUSTES_FINAIS_FASE_SLUG;
}

export function isLoteadoresR3AjustesFinaisCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if (slug) {
    return (LOTEADORES_R3_AJUSTES_FINAIS_CAMPOS_VISIVEIS as readonly string[]).includes(slug);
  }
  const label = String(item.label ?? '').trim();
  return label === 'Parecer final' || label === 'Próximos passos';
}
