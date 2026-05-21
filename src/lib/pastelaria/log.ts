import type { SupabaseClient } from '@supabase/supabase-js';
import type { PastelariaLogAcao, PastelariaLogDetalhes } from '@/lib/pastelaria/types';

export async function registrarPastelariaLog(
  supabase: SupabaseClient,
  input: {
    card_id: string | null;
    user_id: string;
    acao: PastelariaLogAcao;
    detalhes?: PastelariaLogDetalhes;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from('pastelaria_log').insert({
    card_id: input.card_id,
    user_id: input.user_id,
    acao: input.acao,
    detalhes: input.detalhes ?? null,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
