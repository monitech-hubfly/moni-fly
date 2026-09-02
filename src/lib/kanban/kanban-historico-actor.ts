type HistoricoActorDb = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ error: { message?: string } | null }>;
};

/** Propaga o usuário autenticado para triggers de histórico em updates via service role. */
export async function setKanbanHistoricoActor(
  db: HistoricoActorDb,
  userId: string | null | undefined,
): Promise<void> {
  const id = String(userId ?? '').trim();
  const { error } = await db.rpc('set_kanban_historico_actor', { p_user_id: id || null });
  if (error) throw new Error(error.message ?? 'Falha ao definir autor do histórico.');
}

export async function withKanbanHistoricoActor<T>(
  db: HistoricoActorDb,
  userId: string | null | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  await setKanbanHistoricoActor(db, userId);
  try {
    return await fn();
  } finally {
    await setKanbanHistoricoActor(db, null);
  }
}

export async function resolveUsuarioNomeHistorico(
  db: { from: (table: string) => unknown },
  userId: string | null | undefined,
): Promise<string> {
  const id = String(userId ?? '').trim();
  if (!id) return 'Usuário';

  const q = db.from('profiles') as {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => PromiseLike<{
          data: { full_name?: string | null; email?: string | null } | null;
        }>;
      };
    };
  };

  const { data } = await q.select('full_name, email').eq('id', id).maybeSingle();
  const nome = String(data?.full_name ?? '').trim();
  const email = String(data?.email ?? '').trim();
  return nome || email || 'Usuário';
}
