import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { createAdminClient } from '@/lib/supabase/admin';

/** Tags preset de tranche no Funil Crédito Obra — cores da paleta Moní (sem laranja). */
export const CREDITO_OBRA_TRANCHES = [
  { numero: 1 as const, nome: '1ª tranche', cor: '#0c2633' },
  { numero: 2 as const, nome: '2ª tranche', cor: '#2f4a3a' },
  { numero: 3 as const, nome: '3ª tranche', cor: '#4a3929' },
  { numero: 4 as const, nome: '4ª tranche', cor: '#d4ad68' },
  { numero: 5 as const, nome: '5ª tranche', cor: '#3e7490' },
  { numero: 6 as const, nome: '6ª tranche', cor: '#365848' },
] as const;

export type CreditoObraTrancheNumero = (typeof CREDITO_OBRA_TRANCHES)[number]['numero'];

type DbTagClient = Pick<ReturnType<typeof createAdminClient>, 'from'>;

const NOMES_TRANCHE = new Set<string>(CREDITO_OBRA_TRANCHES.map((t) => t.nome));

export function nomeTagTrancheCreditoObra(numero: CreditoObraTrancheNumero): string {
  return CREDITO_OBRA_TRANCHES.find((t) => t.numero === numero)?.nome ?? `${numero}ª tranche`;
}

export function corTagTrancheCreditoObra(numero: CreditoObraTrancheNumero): string {
  return CREDITO_OBRA_TRANCHES.find((t) => t.numero === numero)?.cor ?? '#0c2633';
}

export function trancheNumeroFromIndex(index: number): CreditoObraTrancheNumero | null {
  if (index >= 1 && index <= 6) return index as CreditoObraTrancheNumero;
  return null;
}

/** Garante as 6 tags de tranche no kanban Crédito Obra (idempotente). */
export async function garantirTagsTrancheCreditoObra(
  db: DbTagClient,
  kanbanId: string = KANBAN_IDS.CREDITO_OBRA,
): Promise<void> {
  const kid = String(kanbanId ?? '').trim();
  if (!kid) return;

  for (const tranche of CREDITO_OBRA_TRANCHES) {
    const { data: existing } = await db
      .from('kanban_tags')
      .select('id, cor')
      .eq('kanban_id', kid)
      .eq('nome', tranche.nome)
      .maybeSingle();

    if (existing?.id) {
      if (String((existing as { cor?: string }).cor ?? '') !== tranche.cor) {
        await db
          .from('kanban_tags')
          .update({ cor: tranche.cor } as never)
          .eq('id', String(existing.id));
      }
      continue;
    }

    await db.from('kanban_tags').insert({
      kanban_id: kid,
      nome: tranche.nome,
      cor: tranche.cor,
    } as never);
  }
}

async function resolverTagIdTranche(
  db: DbTagClient,
  kanbanId: string,
  numero: CreditoObraTrancheNumero,
): Promise<string | null> {
  await garantirTagsTrancheCreditoObra(db, kanbanId);
  const nome = nomeTagTrancheCreditoObra(numero);
  const { data } = await db
    .from('kanban_tags')
    .select('id')
    .eq('kanban_id', kanbanId)
    .eq('nome', nome)
    .maybeSingle();
  const id = String((data as { id?: string } | null)?.id ?? '').trim();
  return id || null;
}

/** Aplica tag de tranche exclusiva no card (remove outras tags de tranche do mesmo card). */
export async function aplicarTagTrancheCreditoObra(
  db: DbTagClient,
  cardId: string,
  numero: CreditoObraTrancheNumero,
  kanbanId: string = KANBAN_IDS.CREDITO_OBRA,
): Promise<void> {
  const cid = String(cardId ?? '').trim();
  const kid = String(kanbanId ?? '').trim();
  if (!cid || !kid) return;

  const tagId = await resolverTagIdTranche(db, kid, numero);
  if (!tagId) return;

  const { data: tagsKanban } = await db.from('kanban_tags').select('id, nome').eq('kanban_id', kid);
  const trancheTagIds = (tagsKanban ?? [])
    .filter((t) => NOMES_TRANCHE.has(String((t as { nome?: string }).nome ?? '')))
    .map((t) => String((t as { id: string }).id));

  if (trancheTagIds.length > 0) {
    await db
      .from('kanban_card_tags')
      .delete()
      .eq('card_id', cid)
      .in('tag_id', trancheTagIds);
  }

  const { data: existing } = await db
    .from('kanban_card_tags')
    .select('id')
    .eq('card_id', cid)
    .eq('tag_id', tagId)
    .maybeSingle();

  if (!existing?.id) {
    await db.from('kanban_card_tags').insert({ card_id: cid, tag_id: tagId } as never);
  }
}

/** Primeiro card filho ativo no Crédito Obra — recebe 1ª tranche se ainda não tiver tag de tranche. */
export async function aplicarTagPrimeiraTrancheSeAusente(
  db: DbTagClient,
  cardId: string,
  kanbanId: string = KANBAN_IDS.CREDITO_OBRA,
): Promise<void> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return;

  const kid = String(kanbanId ?? '').trim() || KANBAN_IDS.CREDITO_OBRA;
  await garantirTagsTrancheCreditoObra(db, kid);

  const { data: tagsCard } = await db
    .from('kanban_card_tags')
    .select('tag_id, kanban_tags(nome)')
    .eq('card_id', cid);

  const temTranche = (tagsCard ?? []).some((row) => {
    const tag = Array.isArray(row.kanban_tags) ? row.kanban_tags[0] : row.kanban_tags;
    return NOMES_TRANCHE.has(String((tag as { nome?: string } | null)?.nome ?? ''));
  });

  if (!temTranche) {
    await aplicarTagTrancheCreditoObra(db, cid, 1, kid);
  }
}
