import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { isPortfolioKanbanRef } from '@/lib/kanban/portfolio-paralelas';

/** Exibe Checklist Legal no modal quando fase/kanban exige ou card já tem condomínio vinculado. */
export function deveExibirChecklistLegalNaFase(
  kanbanId: string | null | undefined,
  faseSlug: string | null | undefined,
  condominioId?: string | null,
): boolean {
  if (String(condominioId ?? '').trim()) return true;
  const kid = String(kanbanId ?? '').trim();
  const slug = String(faseSlug ?? '').trim();
  if (kid === KANBAN_IDS.ACOPLAMENTO) return true;
  if (isPortfolioKanbanRef(kid) && (slug === FASE_SLUGS.STEP_4 || slug === FASE_SLUGS.ACOPLAMENTO)) return true;
  return false;
}
