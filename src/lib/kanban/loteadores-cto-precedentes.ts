/** Checklist da fase «Cto c/ Precedentes» — Funil Loteadores.
 * Pop-up «Assinou?» ao avançar — ver loteadores-confirmacao-fase.ts
 */

export const LOTEADORES_CTO_PRECEDENTES_FASE_SLUG = 'cto_precedentes_moni_inc' as const;

export const LOTEADORES_CTO_PRECEDENTES_CAMPOS = {
  dataAssinatura: 'data_assinatura_cto_precedentes',
  contrato: 'contrato_precedentes',
  motivoAssinatura: 'motivo_assinatura_precedentes',
} as const;

export const LOTEADORES_CTO_PRECEDENTES_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_CTO_PRECEDENTES_CAMPOS,
);

export const LOTEADORES_CTO_PRECEDENTES_CAMPOS_LEGADOS = [
  'precedentes_data_assinatura',
  'precedentes_contrato',
  'precedentes_motivo',
] as const;

export function isLoteadoresCtoPrecedentesFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_CTO_PRECEDENTES_FASE_SLUG;
}

export function isLoteadoresCtoPrecedentesCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if (slug) {
    return (
      (LOTEADORES_CTO_PRECEDENTES_CAMPOS_VISIVEIS as readonly string[]).includes(slug) ||
      (LOTEADORES_CTO_PRECEDENTES_CAMPOS_LEGADOS as readonly string[]).includes(slug)
    );
  }
  const label = String(item.label ?? '').trim().toLowerCase();
  return label.includes('precedente') || label.includes('assinatura') || label.includes('contrato');
}
