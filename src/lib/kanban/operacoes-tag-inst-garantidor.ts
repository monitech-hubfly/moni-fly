import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { createClient } from '@/lib/supabase/server';

export const OPERACOES_TAG_INST_GARANTIDOR_NOME = 'Contratar Inst. Garantidor' as const;

/** Vermelho sóbrio Moní — alinhado a `--moni-status-overdue-border`. */
export const OPERACOES_TAG_INST_GARANTIDOR_COR = '#c24b3a';

/** Fases do Funil Pré Obra e Obra que recebem a tag automaticamente. */
export const OPERACOES_FASES_TAG_INST_GARANTIDOR: readonly string[] = [
  FASE_SLUGS.APROVACAO_CONDOMINIO,
  FASE_SLUGS.APROVACAO_PREFEITURA,
  'revisao_bca',
  FASE_SLUGS.PROJETO_LEGAL,
  'planialtimetrico',
] as const;

const FASES_SET = new Set<string>(OPERACOES_FASES_TAG_INST_GARANTIDOR);

type SupabaseTagClient = Pick<Awaited<ReturnType<typeof createClient>>, 'from'>;

export function faseOperacoesExigeTagInstGarantidor(faseSlug: string | null | undefined): boolean {
  return FASES_SET.has(String(faseSlug ?? '').trim());
}

export function kanbanOperacoesUsaTagInstGarantidor(kanbanId: string | null | undefined): boolean {
  return String(kanbanId ?? '').trim() === KANBAN_IDS.OPERACOES;
}

async function resolverTagInstGarantidorId(
  supabase: SupabaseTagClient,
  kanbanId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('kanban_tags')
    .select('id')
    .eq('kanban_id', kanbanId)
    .eq('nome', OPERACOES_TAG_INST_GARANTIDOR_NOME)
    .maybeSingle();
  const id = String((data as { id?: string | null } | null)?.id ?? '').trim();
  return id || null;
}

/** Aplica ou remove a tag «Contratar Inst. Garantidor» conforme fase atual do card Operações. */
export async function sincronizarTagInstGarantidorOperacoes(
  supabase: SupabaseTagClient,
  cardId: string,
  kanbanId: string | null | undefined,
  faseSlug: string | null | undefined,
): Promise<void> {
  const cid = String(cardId ?? '').trim();
  const kid = String(kanbanId ?? '').trim();
  if (!cid || !kanbanOperacoesUsaTagInstGarantidor(kid)) return;

  const tagId = await resolverTagInstGarantidorId(supabase, kid);
  if (!tagId) return;

  const deveTer = faseOperacoesExigeTagInstGarantidor(faseSlug);

  if (deveTer) {
    const { data: existing } = await supabase
      .from('kanban_card_tags')
      .select('id')
      .eq('card_id', cid)
      .eq('tag_id', tagId)
      .maybeSingle();
    if (!existing) {
      await supabase.from('kanban_card_tags').insert({ card_id: cid, tag_id: tagId });
    }
    return;
  }

  await supabase.from('kanban_card_tags').delete().eq('card_id', cid).eq('tag_id', tagId);
}
