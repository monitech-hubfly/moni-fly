/** Checklist da fase «Revisões» — Funil Loteadores. */

export const LOTEADORES_REVISOES_FASE_SLUG = 'revisoes_moni_inc' as const;

export const LOTEADORES_REVISOES_CAMPOS = {
  anexosAtualizados: 'anexos_atualizados',
} as const;

export const LOTEADORES_REVISOES_CAMPOS_VISIVEIS = Object.values(LOTEADORES_REVISOES_CAMPOS);

export const LOTEADORES_REVISOES_CAMPOS_REMOVIDOS = [
  'ajustes_revisao',
  'responsavel_revisao',
  'prazo_revisao',
  'arquivos_revisados',
  'status_revisao',
] as const;

export function isLoteadoresRevisoesFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_REVISOES_FASE_SLUG;
}

export function isLoteadoresRevisoesCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if (slug) {
    return (LOTEADORES_REVISOES_CAMPOS_VISIVEIS as readonly string[]).includes(slug);
  }
  const label = String(item.label ?? '').trim();
  return label === 'Anexos atualizados' || label === 'Arquivos revisados';
}
