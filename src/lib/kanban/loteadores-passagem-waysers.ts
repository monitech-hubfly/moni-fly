/** Checklist da fase «Passagem para Waysers» — Funil Loteadores. */

export const LOTEADORES_PASSAGEM_WAYSERS_FASE_SLUG = 'passagem_waysers_moni_inc' as const;

export const LOTEADORES_PASSAGEM_WAYSERS_CAMPOS = {
  briefingCompleto: 'briefing_completo_preparado',
} as const;

export const LOTEADORES_PASSAGEM_WAYSERS_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_PASSAGEM_WAYSERS_CAMPOS,
);

export const LOTEADORES_PASSAGEM_WAYSERS_CAMPOS_LEGADOS = ['waysers_briefing'] as const;

export function isLoteadoresPassagemWaysersFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_PASSAGEM_WAYSERS_FASE_SLUG;
}

export function isLoteadoresPassagemWaysersCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if (slug) {
    return (
      (LOTEADORES_PASSAGEM_WAYSERS_CAMPOS_VISIVEIS as readonly string[]).includes(slug) ||
      (LOTEADORES_PASSAGEM_WAYSERS_CAMPOS_LEGADOS as readonly string[]).includes(slug)
    );
  }
  const label = String(item.label ?? '').trim().toLowerCase();
  return label.includes('briefing') || label.includes('waysers');
}
