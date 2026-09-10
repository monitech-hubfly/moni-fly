import {
  KANBANS_INTERNOS,
  KANBANS_OCULTOS_FRANK,
} from '@/lib/constants/kanban-ids';
import { isFrankOrFranqueadoRole } from '@/lib/authz';
import { isFrankAllowedPath } from '@/lib/access-matrix';

const KANBANS_INTERNOS_SET = new Set<string>(KANBANS_INTERNOS as readonly string[]);
const KANBANS_OCULTOS_FRANK_SET = new Set<string>(KANBANS_OCULTOS_FRANK as readonly string[]);

/** Remove esteiras internas / ocultas ao frank quando o papel é frank/franqueado. */
export function filtrarKanbanIdsParaRole(
  kanbanIds: string[],
  role: string | null | undefined,
): string[] {
  if (!isFrankOrFranqueadoRole(role)) {
    return kanbanIds.filter((id) => !KANBANS_INTERNOS_SET.has(String(id).trim()));
  }
  return kanbanIds.filter((id) => {
    const kid = String(id).trim();
    if (KANBANS_INTERNOS_SET.has(kid)) return false;
    if (KANBANS_OCULTOS_FRANK_SET.has(kid)) return false;
    return true;
  });
}

export function isKanbanIdInterno(kanbanId: string | null | undefined): boolean {
  const id = String(kanbanId ?? '').trim();
  return id !== '' && KANBANS_INTERNOS_SET.has(id);
}

/** Funil oculto no Hub / listagens para frank (ex.: Jurídico). */
export function isKanbanIdOcultoFrank(kanbanId: string | null | undefined): boolean {
  const id = String(kanbanId ?? '').trim();
  return id !== '' && KANBANS_OCULTOS_FRANK_SET.has(id);
}

/** Hub de Funis: staff vê todos; frank só rotas permitidas (sem Jurídico). */
export function funilHrefVisivelNoHub(
  href: string,
  role: string | null | undefined,
): boolean {
  if (!isFrankOrFranqueadoRole(role)) return true;
  return isFrankAllowedPath(href);
}
