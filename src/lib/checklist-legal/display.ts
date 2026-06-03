import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { isPortfolioKanbanRef } from '@/lib/kanban/portfolio-paralelas';

export function deveExibirChecklistLegalNaFase(
  kanbanId: string | null | undefined,
  faseSlug: string | null | undefined,
): boolean {
  const kid = String(kanbanId ?? '').trim();
  const slug = String(faseSlug ?? '').trim();
  if (kid === KANBAN_IDS.ACOPLAMENTO) return true;
  if (isPortfolioKanbanRef(kid) && (slug === FASE_SLUGS.STEP_4 || slug === FASE_SLUGS.ACOPLAMENTO)) return true;
  return false;
}
