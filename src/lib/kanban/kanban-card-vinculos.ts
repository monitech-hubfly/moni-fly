import type { createAdminClient } from '@/lib/supabase/admin';
import { sincronizarTagAcoplamentoPaiAoVincularCards } from '@/lib/kanban/acoplamento-tag-pai';

type VinculoDb = ReturnType<typeof createAdminClient>;

export type GarantirShadowLegadoResult = { ok: true } | { ok: false; error: string };

/**
 * Garante linha espelho em `kanban_cards` para card legado (`processo_step_one.id`).
 * Necessário para FKs e vínculos que referenciam `kanban_cards`.
 */
export async function garantirShadowKanbanCardLegadoPorId(
  db: VinculoDb,
  cardId: string,
): Promise<GarantirShadowLegadoResult> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const { data: existing } = await db.from('kanban_cards').select('id').eq('id', cid).maybeSingle();
  if (existing?.id) return { ok: true };

  const { data: vLeg, error: vErr } = await db
    .from('v_processo_como_kanban_cards')
    .select('id, kanban_id, fase_id, titulo, responsavel_id')
    .eq('id', cid)
    .maybeSingle();

  if (vErr) return { ok: false, error: vErr.message };
  if (!vLeg?.id) return { ok: false, error: 'Card não encontrado.' };

  const kid = String((vLeg as { kanban_id?: string | null }).kanban_id ?? '').trim();
  const fid = String((vLeg as { fase_id?: string | null }).fase_id ?? '').trim();
  const franq = String((vLeg as { responsavel_id?: string | null }).responsavel_id ?? '').trim();
  if (!kid || !fid || !franq) {
    return { ok: false, error: 'Dados incompletos do processo (kanban/fase/franqueado).' };
  }

  const { error } = await db.from('kanban_cards').insert({
    id: cid,
    kanban_id: kid,
    fase_id: fid,
    franqueado_id: franq,
    titulo: String((vLeg as { titulo?: string | null }).titulo ?? '').trim() || 'Sem título',
    status: 'ativo',
    concluido: false,
  } as never);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type InserirKanbanCardVinculoInput = {
  cardOrigemId: string;
  cardDestinoId: string;
  tipoVinculo: string;
  criadoPor?: string | null;
};

/**
 * Insere vínculo entre cards. Preenche colunas legadas PROD (`card_id`, `vinculado_a`) quando existirem.
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
    vinculado_a: dest,
  };

  const { error } = await db.from('kanban_card_vinculos').insert(row as never);
  if (!error) {
    void sincronizarTagAcoplamentoPaiAoVincularCards(orig, dest);
  }
  return { error: error ? { message: error.message, code: error.code } : null };
}
