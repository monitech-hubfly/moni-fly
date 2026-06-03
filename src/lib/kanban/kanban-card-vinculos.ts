import type { createAdminClient } from '@/lib/supabase/admin';

type VinculoDb = ReturnType<typeof createAdminClient>;

export type InserirKanbanCardVinculoInput = {
  cardOrigemId: string;
  cardDestinoId: string;
  tipoVinculo: string;
  criadoPor?: string | null;
};

/**
 * Insere vínculo entre cards. Preenche `card_id` legado (PROD) quando a coluna existir.
 */
export async function inserirKanbanCardVinculo(
  db: VinculoDb,
  input: InserirKanbanCardVinculoInput,
): Promise<{ error: { message: string; code?: string } | null }> {
  const orig = String(input.cardOrigemId ?? '').trim();
  const dest = String(input.cardDestinoId ?? '').trim();
  if (!orig || !dest) {
    return { error: { message: 'Cards inválidos para vínculo.' } };
  }

  const row: Record<string, unknown> = {
    card_origem_id: orig,
    card_destino_id: dest,
    tipo_vinculo: input.tipoVinculo,
    criado_por: input.criadoPor ?? null,
    card_id: orig,
  };

  const { error } = await db.from('kanban_card_vinculos').insert(row as never);
  return { error: error ? { message: error.message, code: error.code } : null };
}
