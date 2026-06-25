import type { KanbanFase } from '@/components/kanban-shared/types';

/** Fases removidas do board Operações — cards realocados via migração SQL 401. */
export const OPERACOES_REMOVED_FASE_SLUGS = ['moni_care'] as const;

export function isRemovedOperacoesFaseSlug(slug: string | null | undefined): boolean {
  const s = String(slug ?? '').trim();
  return (OPERACOES_REMOVED_FASE_SLUGS as readonly string[]).includes(s);
}

/** Fases ativas do Funil Operações exibidas na calculadora de fases. */
export function filterOperacoesCalculadoraFases(fases: KanbanFase[]): KanbanFase[] {
  return fases.filter((f) => !isRemovedOperacoesFaseSlug(f.slug));
}
