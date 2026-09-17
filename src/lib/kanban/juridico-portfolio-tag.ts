import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { createAdminClient } from '@/lib/supabase/admin';

/** Tags do Funil Jurídico disparadas pelos bastões do Portfólio. */
export const JURIDICO_PORTFOLIO_TAG_OPCAO = 'Opção';
export const JURIDICO_PORTFOLIO_TAG_CTO_PRECEDENTES = 'Cto c/ Precedentes';
export const JURIDICO_PORTFOLIO_TAG_CTO_SEM_PRECEDENTES = 'Cto s/ Precedentes';

export const JURIDICO_PORTFOLIO_TAGS = [
  { nome: JURIDICO_PORTFOLIO_TAG_OPCAO, cor: '#3e7490' },
  { nome: JURIDICO_PORTFOLIO_TAG_CTO_PRECEDENTES, cor: '#2f4a3a' },
  { nome: JURIDICO_PORTFOLIO_TAG_CTO_SEM_PRECEDENTES, cor: '#4a3929' },
] as const;

export type JuridicoPortfolioTagNome = (typeof JURIDICO_PORTFOLIO_TAGS)[number]['nome'];

type DbTagClient = Pick<ReturnType<typeof createAdminClient>, 'from'>;

const NOMES = new Set<string>(JURIDICO_PORTFOLIO_TAGS.map((t) => t.nome));

export function isJuridicoPortfolioTagNome(nome: string | null | undefined): nome is JuridicoPortfolioTagNome {
  return NOMES.has(String(nome ?? '').trim());
}

/** Garante as tags canônicas no Funil Jurídico (idempotente). */
export async function garantirTagsJuridicoPortfolio(
  db: DbTagClient,
  kanbanId: string = KANBAN_IDS.JURIDICO,
): Promise<void> {
  const kid = String(kanbanId ?? '').trim();
  if (!kid) return;

  for (const tag of JURIDICO_PORTFOLIO_TAGS) {
    const { data: existing } = await db
      .from('kanban_tags')
      .select('id, cor')
      .eq('kanban_id', kid)
      .eq('nome', tag.nome)
      .maybeSingle();

    if (existing?.id) {
      if (String((existing as { cor?: string }).cor ?? '') !== tag.cor) {
        await db
          .from('kanban_tags')
          .update({ cor: tag.cor } as never)
          .eq('id', String(existing.id));
      }
      continue;
    }

    await db.from('kanban_tags').insert({
      kanban_id: kid,
      nome: tag.nome,
      cor: tag.cor,
    } as never);
  }
}

async function resolverTagIdJuridicoPortfolio(
  db: DbTagClient,
  kanbanId: string,
  nome: JuridicoPortfolioTagNome,
): Promise<string | null> {
  await garantirTagsJuridicoPortfolio(db, kanbanId);
  const { data } = await db
    .from('kanban_tags')
    .select('id')
    .eq('kanban_id', kanbanId)
    .eq('nome', nome)
    .maybeSingle();
  const id = String((data as { id?: string } | null)?.id ?? '').trim();
  return id || null;
}

/** Aplica a tag de tipo de demanda Jurídico (não remove outras tags do card). */
export async function aplicarTagJuridicoPortfolio(
  db: DbTagClient,
  cardId: string,
  nome: JuridicoPortfolioTagNome,
  kanbanId: string = KANBAN_IDS.JURIDICO,
): Promise<void> {
  const cid = String(cardId ?? '').trim();
  const kid = String(kanbanId ?? '').trim();
  if (!cid || !kid || !isJuridicoPortfolioTagNome(nome)) return;

  const tagId = await resolverTagIdJuridicoPortfolio(db, kid, nome);
  if (!tagId) return;

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

/**
 * Localiza card filho no Jurídico do mesmo pai que já tenha a tag informada.
 * Usado para idempotência dos bastões Portfólio → Jurídico (permite múltiplos filhos).
 */
export async function buscarCardFilhoJuridicoPorTag(
  db: DbTagClient,
  cardPaiId: string,
  tagNome: JuridicoPortfolioTagNome,
  kanbanId: string = KANBAN_IDS.JURIDICO,
): Promise<{ id: string; arquivado: boolean | null } | null> {
  const pai = String(cardPaiId ?? '').trim();
  const kid = String(kanbanId ?? '').trim();
  if (!pai || !kid || !isJuridicoPortfolioTagNome(tagNome)) return null;

  const tagId = await resolverTagIdJuridicoPortfolio(db, kid, tagNome);
  if (!tagId) return null;

  const { data: filhos, error } = await db
    .from('kanban_cards')
    .select('id, arquivado')
    .eq('origem_card_id', pai)
    .eq('kanban_id', kid);

  if (error || !filhos?.length) return null;

  const ids = (filhos as { id: string; arquivado?: boolean | null }[])
    .map((f) => String(f.id ?? '').trim())
    .filter(Boolean);
  if (ids.length === 0) return null;

  const { data: links } = await db
    .from('kanban_card_tags')
    .select('card_id')
    .eq('tag_id', tagId)
    .in('card_id', ids);

  const comTag = new Set(
    (links ?? []).map((r) => String((r as { card_id?: string }).card_id ?? '').trim()).filter(Boolean),
  );
  if (comTag.size === 0) return null;

  const list = filhos as { id: string; arquivado?: boolean | null }[];
  const ativo = list.find((c) => comTag.has(String(c.id)) && !Boolean(c.arquivado));
  if (ativo?.id) return { id: String(ativo.id), arquivado: false };

  const qualquer = list.find((c) => comTag.has(String(c.id)));
  if (!qualquer?.id) return null;
  return { id: String(qualquer.id), arquivado: Boolean(qualquer.arquivado) };
}
