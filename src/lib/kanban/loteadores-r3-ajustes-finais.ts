/** Checklist da fase «R3 — Ajustes Finais nas Propostas» — Funil Loteadores. */

export const LOTEADORES_R3_AJUSTES_FINAIS_FASE_SLUG = 'r3_ajustes_finais_moni_inc' as const;

export const LOTEADORES_R3_AJUSTES_FINAIS_CAMPOS = {
  parecerFinal: 'parecer_final',
  proximosPassos: 'proximos_passos',
} as const;

export function isLoteadoresR3AjustesFinaisFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_R3_AJUSTES_FINAIS_FASE_SLUG;
}
