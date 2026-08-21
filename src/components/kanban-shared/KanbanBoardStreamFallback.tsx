/** Skeleton do board enquanto o snapshot RSC carrega (Suspense / navegação do hub). */
export function KanbanBoardStreamFallback({ columnAccent }: { columnAccent?: string }) {
  const accent = columnAccent ?? 'var(--moni-kanban-stepone)';

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1600px] px-6 py-8" aria-busy="true" aria-label="Carregando kanban">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div
          className="h-9 w-48 animate-pulse rounded-[var(--moni-radius-md)]"
          style={{ background: 'var(--moni-surface-200)' }}
        />
        <div className="flex gap-2">
          <div
            className="h-9 w-24 animate-pulse rounded-[var(--moni-radius-md)]"
            style={{ background: 'var(--moni-surface-200)' }}
          />
          <div
            className="h-9 w-32 animate-pulse rounded-[var(--moni-radius-md)]"
            style={{ background: 'var(--moni-surface-200)' }}
          />
        </div>
      </div>

      <div className="moni-kanban-board flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="moni-kanban-column flex w-[280px] shrink-0 flex-col gap-3 rounded-[var(--moni-radius-lg)] p-3"
            style={{
              background: 'var(--moni-surface-100)',
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
            }}
          >
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ background: accent }} />
              <div
                className="h-4 flex-1 animate-pulse rounded"
                style={{ background: 'var(--moni-surface-200)' }}
              />
            </div>
            {Array.from({ length: 2 + (i % 2) }).map((__, j) => (
              <div
                key={j}
                className="animate-pulse rounded-[var(--moni-radius-lg)] p-4"
                style={{
                  background: 'var(--moni-surface-50)',
                  border: 'var(--moni-border-width) solid var(--moni-border-default)',
                  minHeight: 88,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
