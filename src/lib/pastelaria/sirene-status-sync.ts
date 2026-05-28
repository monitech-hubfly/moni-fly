import type { SupabaseClient } from '@supabase/supabase-js';
import type { PastelariaColuna } from '@/lib/pastelaria/types';
import { semanaAtualLabel } from '@/lib/pastelaria/week';

export function pastelariaColunaParaSireneStatus(
  coluna: PastelariaColuna,
): 'nao_iniciado' | 'em_andamento' | 'concluido' | null {
  switch (coluna) {
    case 'inbox':
    case 'mapped':
      return 'nao_iniciado';
    case 'doing':
      return 'em_andamento';
    case 'done':
      return 'concluido';
    default:
      return null;
  }
}

export function sireneStatusParaPastelariaColuna(status: string): PastelariaColuna | null {
  switch (status) {
    case 'em_andamento':
      return 'doing';
    case 'concluido':
      return 'done';
    default:
      return null;
  }
}

/** Pastelaria → Sirene: atualiza status do chamado vinculado quando a coluna do pastel muda. */
export async function syncSireneStatusFromPastelariaColuna(
  admin: SupabaseClient,
  input: { sireneChamadoId: number; coluna: PastelariaColuna },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const status = pastelariaColunaParaSireneStatus(input.coluna);
  if (!status) return { ok: true };

  const { error } = await admin
    .from('sirene_chamados')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', input.sireneChamadoId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Sirene → Pastelaria: atualiza coluna do pastel vinculado quando o status do chamado muda. */
export async function syncPastelariaColunaFromSireneStatus(
  admin: SupabaseClient,
  chamadoId: number,
  status: string,
): Promise<{ ok: true; updated: boolean } | { ok: false; error: string }> {
  const coluna = sireneStatusParaPastelariaColuna(status);
  if (!coluna) return { ok: true, updated: false };

  const { data: vinculo, error: vincErr } = await admin
    .from('sirene_pastelaria_vinculos')
    .select('pastelaria_card_id')
    .eq('sirene_chamado_id', chamadoId)
    .maybeSingle();

  if (vincErr) return { ok: false, error: vincErr.message };
  const cardId = (vinculo as { pastelaria_card_id?: string } | null)?.pastelaria_card_id;
  if (!cardId) return { ok: true, updated: false };

  const { data: card, error: cardFetchErr } = await admin
    .from('pastelaria_cards')
    .select('coluna')
    .eq('id', cardId)
    .maybeSingle();

  if (cardFetchErr) return { ok: false, error: cardFetchErr.message };
  if (!card) return { ok: true, updated: false };

  if ((card as { coluna: string }).coluna === coluna) return { ok: true, updated: false };

  const patch: { coluna: PastelariaColuna; completed_week?: string | null } = { coluna };
  if (coluna === 'done') {
    patch.completed_week = semanaAtualLabel();
  }

  const { error: updErr } = await admin.from('pastelaria_cards').update(patch).eq('id', cardId);
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true, updated: true };
}
