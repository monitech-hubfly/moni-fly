/** Label do item de checklist na fase Mapa de Competidores (espelha Gbox). */
export const CHECKLIST_LABEL_LINK_PLANILHA_MAPA = 'Link planilha / mapa externo';

function normLabel(label: string | null | undefined): string {
  return String(label ?? '')
    .trim()
    .toLowerCase();
}

export function isChecklistItemLinkPlanilhaMapa(label: string | null | undefined): boolean {
  const n = normLabel(label);
  return n === normLabel(CHECKLIST_LABEL_LINK_PLANILHA_MAPA) || n.startsWith('link planilha');
}
