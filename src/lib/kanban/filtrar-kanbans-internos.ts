import { KANBANS_INTERNOS } from '@/lib/constants/kanban-ids';
import { isFrankOrFranqueadoRole } from '@/lib/authz';

const KANBANS_INTERNOS_SET = new Set<string>(KANBANS_INTERNOS as readonly string[]);

/** Remove esteiras internas da lista quando o usuário é frank/franqueado. */
export function filtrarKanbanIdsParaRole(
  kanbanIds: string[],
  role: string | null | undefined,
): string[] {
  if (!isFrankOrFranqueadoRole(role)) return kanbanIds;
  return kanbanIds.filter((id) => !KANBANS_INTERNOS_SET.has(String(id).trim()));
}

export function isKanbanIdInterno(kanbanId: string | null | undefined): boolean {
  const id = String(kanbanId ?? '').trim();
  return id !== '' && KANBANS_INTERNOS_SET.has(id);
}
