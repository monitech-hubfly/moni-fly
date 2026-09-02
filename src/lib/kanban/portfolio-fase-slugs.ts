import type { KanbanFase } from '@/components/kanban-shared/types';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';

/** Fases do Funil Portfólio omitidas da calculadora global. */
export const PORTFOLIO_CALCULADORA_EXCLUDED_SLUGS = [FASE_SLUGS.CAPTACAO_CAPITAL] as const;

export function isCalculadoraExcludedPortfolioFaseSlug(slug: string | null | undefined): boolean {
  const s = String(slug ?? '').trim();
  return (PORTFOLIO_CALCULADORA_EXCLUDED_SLUGS as readonly string[]).includes(s);
}

/** Fases ativas do Funil Portfólio exibidas na calculadora de fases. */
export function filterPortfolioCalculadoraFases(fases: KanbanFase[]): KanbanFase[] {
  return fases.filter((f) => !isCalculadoraExcludedPortfolioFaseSlug(f.slug));
}
