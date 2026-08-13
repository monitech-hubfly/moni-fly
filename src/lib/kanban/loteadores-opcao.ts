/** Checklist da fase «Opção» — Funil Loteadores.
 * Pop-up «Assinou?» ao avançar — ver loteadores-confirmacao-fase.ts
 */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_OPCAO_FASE_SLUG = 'opcao_moni_inc' as const;

export const LOTEADORES_OPCAO_CAMPOS = {
  loteSelecionado: 'lote_selecionado_opcionado',
  dataOpcao: 'data_opcao',
  documentoOpcao: 'documento_opcao',
} as const;

export const LOTEADORES_OPCAO_CAMPOS_VISIVEIS = Object.values(LOTEADORES_OPCAO_CAMPOS);

export function isLoteadoresOpcaoFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_OPCAO_FASE_SLUG;
}

export function isLoteadoresOpcaoCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_OPCAO_CAMPOS_VISIVEIS);
}
