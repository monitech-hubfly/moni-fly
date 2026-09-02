import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import { isPortfolioKanbanRef } from '@/lib/kanban/portfolio-paralelas';

/** Exibe Checklist Legal + Crédito apenas no Funil Portfólio, fase Check Legal e Crédito (step_4). */
function portfolioFaseStep4(
  kanbanId: string | null | undefined,
  faseSlug: string | null | undefined,
): boolean {
  const kid = String(kanbanId ?? '').trim();
  const slug = String(faseSlug ?? '').trim();
  return isPortfolioKanbanRef(kid) && slug === FASE_SLUGS.STEP_4;
}

/** Exibe Checklist Legal no modal do card (Check Legal e Crédito — Funil Portfólio). */
export function deveExibirChecklistLegalNaFase(
  kanbanId: string | null | undefined,
  faseSlug: string | null | undefined,
  _condominioId?: string | null,
): boolean {
  return portfolioFaseStep4(kanbanId, faseSlug);
}

/** Exibe Checklist de Crédito no modal do card (Check Legal e Crédito — Funil Portfólio). */
export function deveExibirChecklistCreditoNaFase(
  kanbanId: string | null | undefined,
  faseSlug: string | null | undefined,
): boolean {
  return portfolioFaseStep4(kanbanId, faseSlug);
}
