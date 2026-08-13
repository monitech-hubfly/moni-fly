export function KanbanBoardSkeleton() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px] px-6 py-8" aria-busy="true" aria-label="Carregando kanban">
      <div className="mb-4 h-10 w-64 animate-pulse rounded-[var(--moni-radius-md)] bg-[var(--moni-neutral-100)]" />
      <div className="moni-kanban-board flex flex-row flex-nowrap items-stretch gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex w-[280px] shrink-0 flex-col gap-3 p-3"
            style={{
              borderRadius: 'var(--moni-radius-lg)',
              border: '0.5px solid var(--moni-border-default)',
              background: 'var(--moni-kanban-col-bg)',
            }}
          >
            <div className="h-5 w-2/3 animate-pulse rounded-[var(--moni-radius-md)] bg-[var(--moni-neutral-100)]" />
            <div className="h-16 animate-pulse rounded-[var(--moni-radius-lg)] bg-[var(--moni-surface-0)]" />
            <div className="h-16 animate-pulse rounded-[var(--moni-radius-lg)] bg-[var(--moni-surface-0)]" />
            <div className="h-16 animate-pulse rounded-[var(--moni-radius-lg)] bg-[var(--moni-surface-0)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
