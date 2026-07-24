/**
 * Skeleton de loading para rotas kanban.
 * Exibido imediatamente após o layout enquanto fetchKanbanBoardSnapshot carrega.
 * Usa apenas variáveis CSS de moni-tokens — sem hex hardcoded.
 */
export function KanbanBoardSkeleton() {
  return (
    <div className="flex flex-col h-full w-full overflow-hidden" aria-label="Carregando board" aria-busy="true">
      {/* Barra superior */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--moni-border-color, #e5e0d8)' }}>
        <div className="h-5 w-40 rounded animate-pulse" style={{ background: 'var(--moni-skeleton-base, #e7e5e4)' }} />
        <div className="h-5 w-24 rounded animate-pulse" style={{ background: 'var(--moni-skeleton-base, #e7e5e4)' }} />
        <div className="ml-auto h-8 w-28 rounded animate-pulse" style={{ background: 'var(--moni-skeleton-base, #e7e5e4)' }} />
      </div>

      {/* Colunas */}
      <div className="flex flex-1 gap-3 overflow-x-auto p-4 items-start">
        {[32, 28, 40, 24, 36].map((colH, colIdx) => (
          <div
            key={colIdx}
            className="flex-shrink-0 flex flex-col gap-2 rounded-lg p-3"
            style={{
              width: 240,
              background: 'var(--moni-skeleton-col, #f5f3f0)',
              minHeight: 120,
            }}
          >
            {/* Cabeçalho da coluna */}
            <div className="flex items-center justify-between mb-1">
              <div
                className="h-4 rounded animate-pulse"
                style={{ width: `${colH * 2.5}px`, background: 'var(--moni-skeleton-base, #e7e5e4)' }}
              />
              <div className="h-4 w-6 rounded-full animate-pulse" style={{ background: 'var(--moni-skeleton-base, #e7e5e4)' }} />
            </div>

            {/* Cards */}
            {Array.from({ length: colIdx === 2 ? 4 : colIdx === 0 ? 3 : 2 }).map((_, cardIdx) => (
              <div
                key={cardIdx}
                className="rounded-lg p-3 flex flex-col gap-2"
                style={{ background: '#fff', border: '0.5px solid var(--moni-border-color, #e5e0d8)' }}
              >
                <div
                  className="h-3 rounded animate-pulse"
                  style={{ width: `${60 + ((cardIdx * 17 + colIdx * 11) % 35)}%`, background: 'var(--moni-skeleton-base, #e7e5e4)' }}
                />
                <div
                  className="h-3 rounded animate-pulse"
                  style={{ width: `${40 + ((cardIdx * 13 + colIdx * 7) % 30)}%`, background: 'var(--moni-skeleton-light, #f0ede8)' }}
                />
                <div className="flex gap-1 mt-1">
                  <div className="h-4 w-12 rounded-full animate-pulse" style={{ background: 'var(--moni-skeleton-light, #f0ede8)' }} />
                  <div className="h-4 w-10 rounded-full animate-pulse" style={{ background: 'var(--moni-skeleton-light, #f0ede8)' }} />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
