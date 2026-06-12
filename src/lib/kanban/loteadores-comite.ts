/** Checklist da fase «Comitê» — Funil Loteadores. */

export const LOTEADORES_COMITE_FASE_SLUG = 'comite_moni_inc' as const;

export const LOTEADORES_COMITE_CAMPOS = {
  apresentacao: 'apresentacao_comite',
  pareceres: 'pareceres_envolvidos',
} as const;

export const LOTEADORES_COMITE_CAMPOS_VISIVEIS = Object.values(LOTEADORES_COMITE_CAMPOS);

export function isLoteadoresComiteFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_COMITE_FASE_SLUG;
}
