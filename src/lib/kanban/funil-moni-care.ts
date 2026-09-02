import { KANBAN_IDS } from '@/lib/constants/kanban-ids';

export const KANBAN_NOME_MONI_CARE = 'Funil Moní Care' as const;
export const MONI_CARE_BASE_PATH = '/manutencoes/moni-care';

export function isMoniCareKanbanId(id: string | null | undefined): boolean {
  return String(id ?? '').trim() === KANBAN_IDS.MONI_CARE;
}
