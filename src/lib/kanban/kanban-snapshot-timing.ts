/** Logs de timing do snapshot — ativar com `KANBAN_SNAPSHOT_DEBUG=1`. */
export function createKanbanSnapshotTimer(kanbanNomeDb: string, mode: string) {
  const enabled = process.env.KANBAN_SNAPSHOT_DEBUG === '1';
  const label = `${kanbanNomeDb}:${mode}`;
  const t0 = enabled ? performance.now() : 0;
  let last = t0;

  return {
    mark(step: string) {
      if (!enabled) return;
      const now = performance.now();
      console.log(
        `[kanban-snapshot:${label}] ${step} +${Math.round(now - last)}ms (total ${Math.round(now - t0)}ms)`,
      );
      last = now;
    },
    end(extra?: string) {
      if (!enabled) return;
      const now = performance.now();
      console.log(
        `[kanban-snapshot:${label}] done${extra ? ` (${extra})` : ''} ${Math.round(now - t0)}ms`,
      );
    },
  };
}
