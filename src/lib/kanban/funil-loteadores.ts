import type { KanbanFase } from '@/components/kanban-shared/types';

/** Nome do kanban na tabela `kanbans` (ex.: Funil Loteadores). Rota do app: `/loteadores`. */
export const KANBAN_NOME_FUNIL_LOTEADORES = 'Funil Loteadores' as const;

const SLUG_PRIMEIRO_CONTATO = 'primeiro_contato_moni_inc';

/** Fase inicial para «+ Novo card» e modal de criação. */
export function resolverPrimeiraFaseContatoLoteadores(fases: KanbanFase[]): string | null {
  if (!fases.length) return null;
  const bySlug = fases.find((f) => (f.slug ?? '').trim() === SLUG_PRIMEIRO_CONTATO);
  if (bySlug) return bySlug.id;
  const byNome = fases.find((f) => f.nome.trim().toLowerCase() === 'primeiro contato');
  if (byNome) return byNome.id;
  const byOrdem = fases.find((f) => f.ordem === 1);
  if (byOrdem) return byOrdem.id;
  return fases[0]?.id ?? null;
}

export function isStaffKanbanLoteadores(role: string | null | undefined): boolean {
  const r = String(role ?? '').trim().toLowerCase();
  return r === 'admin' || r === 'team' || r === 'consultor' || r === 'supervisor';
}
