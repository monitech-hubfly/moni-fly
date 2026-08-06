import { KanbanBoardStreamFallback } from '@/components/kanban-shared/KanbanBoardStreamFallback';

/** Skeleton do board (não o spinner genérico de `app/loading.tsx`). */
export default function OperacoesLoading() {
  return <KanbanBoardStreamFallback columnAccent="var(--moni-kanban-stepone)" />;
}
