import { KanbanBoardSkeleton } from '@/components/kanban-shared/KanbanBoardSkeleton';

export default function MarketingFunilLoading() {
  return (
    <div className="min-h-0 min-w-0 bg-[var(--moni-surface-50)]">
      <KanbanBoardSkeleton />
    </div>
  );
}
