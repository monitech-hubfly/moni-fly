/** Checklist da fase «Comitê» — Funil Loteadores. */

export const LOTEADORES_COMITE_FASE_SLUG = 'comite_moni_inc' as const;

export const LOTEADORES_COMITE_CAMPOS = {
  apresentacao: 'apresentacao_comite',
} as const;

export const LOTEADORES_COMITE_CAMPOS_VISIVEIS = Object.values(LOTEADORES_COMITE_CAMPOS);

export const LOTEADORES_COMITE_CAMPOS_REMOVIDOS = [
  'pareceres_envolvidos',
  'data_comite',
  'participantes_comite',
  'parecer_comercial',
  'parecer_produto',
  'parecer_credito',
  'parecer_juridico',
  'parecer_operacoes',
  'resultado_comite',
  'conclusao_comite',
] as const;

export function isLoteadoresComiteFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_COMITE_FASE_SLUG;
}

export function isLoteadoresComiteCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if (slug) {
    return (LOTEADORES_COMITE_CAMPOS_VISIVEIS as readonly string[]).includes(slug);
  }
  const label = String(item.label ?? '').trim();
  return label === 'Apresentação para Comitê';
}
