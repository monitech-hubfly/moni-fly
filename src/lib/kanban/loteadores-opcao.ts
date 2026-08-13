/** Checklist da fase «Opção» — Funil Loteadores.
 * Pop-up «Assinou?» ao avançar — ver loteadores-confirmacao-fase.ts
 */

export const LOTEADORES_OPCAO_FASE_SLUG = 'opcao_moni_inc' as const;

export const LOTEADORES_OPCAO_CAMPOS = {
  loteSelecionado: 'lote_selecionado_opcionado',
  dataOpcao: 'data_opcao',
  documentoOpcao: 'documento_opcao',
} as const;

export const LOTEADORES_OPCAO_CAMPOS_VISIVEIS = Object.values(LOTEADORES_OPCAO_CAMPOS);

export const LOTEADORES_OPCAO_CAMPOS_LEGADOS = [
  'opcao_lote',
  'opcao_data',
  'opcao_documento',
] as const;

export function isLoteadoresOpcaoFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_OPCAO_FASE_SLUG;
}

export function isLoteadoresOpcaoCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if (slug) {
    return (
      (LOTEADORES_OPCAO_CAMPOS_VISIVEIS as readonly string[]).includes(slug) ||
      (LOTEADORES_OPCAO_CAMPOS_LEGADOS as readonly string[]).includes(slug)
    );
  }
  const label = String(item.label ?? '').trim().toLowerCase();
  return label.includes('opção') || label.includes('opcao') || label.includes('lote');
}
