import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  isJuridicoTipoDocumento,
  type JuridicoTipoDocumento,
} from '@/lib/kanban/juridico-tipo-documento';
import type { createAdminClient } from '@/lib/supabase/admin';

export const MSG_ATENDIMENTO_JURIDICO_EM_ANDAMENTO =
  'Já existe atendimento jurídico em andamento para esse documento.';

type DbCiclo = Pick<ReturnType<typeof createAdminClient>, 'from'>;

export type AtendimentoJuridicoAberto = {
  id: string;
  fase_id: string | null;
};

/**
 * Atendimento aberto bloqueia novo ciclo do mesmo pai + tipo.
 * Arquivado e Atendimentos Concluídos são histórico: não bloqueiam e não são reabertos.
 */
export function atendimentoJuridicoBloqueiaNovoCiclo(input: {
  arquivado?: boolean | null;
  faseSlug?: string | null;
}): boolean {
  if (Boolean(input.arquivado)) return false;
  if (String(input.faseSlug ?? '').trim() === FASE_SLUGS.JURIDICO_ATENDIMENTOS_CONCLUIDOS) return false;
  return true;
}

export async function buscarAtendimentoJuridicoAberto(
  db: DbCiclo,
  cardPaiId: string,
  tipo: JuridicoTipoDocumento,
): Promise<AtendimentoJuridicoAberto | null> {
  const pai = String(cardPaiId ?? '').trim();
  if (!pai || !isJuridicoTipoDocumento(tipo)) return null;

  const { data, error } = await db
    .from('kanban_cards')
    .select('id, arquivado, fase_id, kanban_fases!kanban_cards_fase_id_fkey(slug)')
    .eq('origem_card_id', pai)
    .eq('kanban_id', KANBAN_IDS.JURIDICO)
    .eq('juridico_tipo_contrato', tipo);

  if (error) throw new Error(error.message);
  if (!data?.length) return null;

  for (const row of data as Array<{
    id?: string;
    arquivado?: boolean | null;
    fase_id?: string | null;
    kanban_fases?: { slug?: string | null } | { slug?: string | null }[] | null;
  }>) {
    const id = String(row.id ?? '').trim();
    if (!id) continue;
    const faseJoin = row.kanban_fases;
    const fase = Array.isArray(faseJoin) ? faseJoin[0] : faseJoin;
    const slug = String(fase?.slug ?? '').trim();
    if (!atendimentoJuridicoBloqueiaNovoCiclo({ arquivado: row.arquivado, faseSlug: slug })) continue;
    return { id, fase_id: row.fase_id ? String(row.fase_id) : null };
  }
  return null;
}
