import type { SupabaseClient } from '@supabase/supabase-js';

/** Identificador de casa no onboarding (tabela `franqueado_onboarding_progresso`). */
export const CASA0_ID = 'casa0' as const;

/** Seis itens obrigatórios do setup Casa 0 — mesmo critério que `tudoConcluido` no hook. */
export const CASA0_ITEM_IDS = [
  'acesso-hubfly',
  'login-configurador',
  'planilha-step-one',
  'bca-geral-2026',
  'google-drive',
  'corretores-mapeados',
] as const;

export type Casa0ItemId = (typeof CASA0_ITEM_IDS)[number];

/**
 * `true` quando todos os itens do setup Casa 0 estão `concluido` em `franqueado_onboarding_progresso`.
 * Em erro de leitura retorna `false` (estado seguro: bloqueia Casa 1).
 */
export async function getCasa0TudoConcluidoServer(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data: rows, error } = await supabase
    .from('franqueado_onboarding_progresso')
    .select('item_id, status')
    .eq('user_id', userId)
    .eq('casa_id', CASA0_ID);

  if (error) return false;

  const byItem = new Map<string, string>();
  for (const row of rows ?? []) {
    const id = (row as { item_id?: string | null }).item_id;
    if (id) byItem.set(id, String((row as { status?: string | null }).status ?? ''));
  }

  return CASA0_ITEM_IDS.every((id) => byItem.get(id) === 'concluido');
}
