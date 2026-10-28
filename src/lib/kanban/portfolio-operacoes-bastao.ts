import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import { tipoKanbanHistoricoFromAcao } from '@/lib/kanban/kanban-historico-tipo';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const TIPO_ALERTA = 'bastao_fase_vinculada';
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Db = ReturnType<typeof createAdminClient>;

type CardAlvo = {
  id: string;
  titulo: string | null;
  fase_id: string | null;
  responsavel_id: string | null;
  arquivado: boolean | null;
  kanban_id: string | null;
};

function uuidOuNull(valor: string | null | undefined): string | null {
  const v = String(valor ?? '').trim();
  return UUID_RE.test(v) ? v : null;
}

async function cardsNoKanban(db: Db, ids: string[], kanbanId: string): Promise<CardAlvo[]> {
  const unicos = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unicos.length === 0) return [];
  const { data, error } = await db
    .from('kanban_cards')
    .select('id, titulo, fase_id, responsavel_id, arquivado, kanban_id')
    .in('id', unicos)
    .eq('kanban_id', kanbanId);
  if (error) throw new Error(error.message);
  return (data ?? []) as CardAlvo[];
}

async function idsVinculados(db: Db, cardId: string): Promise<string[]> {
  const { data, error } = await db
    .from('kanban_card_vinculos')
    .select('card_origem_id, card_destino_id')
    .or(`card_origem_id.eq.${cardId},card_destino_id.eq.${cardId}`);
  if (error) throw new Error(error.message);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const orig = String((row as { card_origem_id?: string | null }).card_origem_id ?? '').trim();
    const dest = String((row as { card_destino_id?: string | null }).card_destino_id ?? '').trim();
    if (orig && orig !== cardId) ids.add(orig);
    if (dest && dest !== cardId) ids.add(dest);
  }
  return [...ids];
}

async function cardVinculadoNoKanban(db: Db, cardOpsId: string, kanbanId: string): Promise<CardAlvo | null> {
  const { data: ops, error } = await db
    .from('kanban_cards')
    .select('origem_card_id')
    .eq('id', cardOpsId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const origem = String((ops as { origem_card_id?: string | null } | null)?.origem_card_id ?? '').trim();
  const candidatos = [...(origem ? [origem] : []), ...(await idsVinculados(db, cardOpsId))];
  const cards = await cardsNoKanban(db, candidatos, kanbanId);
  return cards.find((c) => !c.arquivado) ?? cards[0] ?? null;
}

async function portfolioVinculado(db: Db, cardOpsId: string): Promise<CardAlvo | null> {
  return cardVinculadoNoKanban(db, cardOpsId, KANBAN_IDS.PORTFOLIO);
}

async function operacoesVinculadas(db: Db, cardPortfolioId: string): Promise<CardAlvo[]> {
  const { data, error } = await db
    .from('kanban_cards')
    .select('id, titulo, fase_id, responsavel_id, arquivado, kanban_id')
    .eq('origem_card_id', cardPortfolioId)
    .eq('kanban_id', KANBAN_IDS.OPERACOES);
  if (error) throw new Error(error.message);
  const porOrigem = (data ?? []) as CardAlvo[];
  const extras = await cardsNoKanban(db, await idsVinculados(db, cardPortfolioId), KANBAN_IDS.OPERACOES);
  const vistos = new Set<string>();
  const todos: CardAlvo[] = [];
  for (const card of [...porOrigem, ...extras]) {
    if (vistos.has(card.id)) continue;
    vistos.add(card.id);
    todos.push(card);
  }
  return todos.filter((c) => !c.arquivado);
}

async function fasePorSlug(
  db: Db,
  kanbanId: string,
  slug: string,
): Promise<{ id: string; slug: string } | null> {
  const { data, error } = await db
    .from('kanban_fases')
    .select('id, slug')
    .eq('kanban_id', kanbanId)
    .eq('slug', slug)
    .eq('ativo', true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const id = String((data as { id?: string } | null)?.id ?? '').trim();
  if (!id) return null;
  return { id, slug };
}

async function slugDaFase(db: Db, faseId: string | null): Promise<string> {
  const id = String(faseId ?? '').trim();
  if (!id) return '';
  const { data, error } = await db.from('kanban_fases').select('slug').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return String((data as { slug?: string | null } | null)?.slug ?? '').trim();
}

async function responsavelDoCard(db: Db, card: CardAlvo, faseDestinoId: string): Promise<string | null> {
  const { data: item } = await db
    .from('kanban_fase_checklist_itens')
    .select('id')
    .eq('fase_id', faseDestinoId)
    .eq('campo_slug', 'responsavel_fase')
    .maybeSingle();
  const itemId = String((item as { id?: string } | null)?.id ?? '').trim();
  if (itemId) {
    const { data: resposta } = await db
      .from('kanban_fase_checklist_respostas')
      .select('valor')
      .eq('item_id', itemId)
      .eq('card_id', card.id)
      .maybeSingle();
    const daFase = uuidOuNull((resposta as { valor?: string | null } | null)?.valor);
    if (daFase) return daFase;
  }
  return uuidOuNull(card.responsavel_id);
}

async function notificar(input: {
  db: Db;
  userId: string;
  cardId: string;
  kanbanNome: string;
  mensagem: string;
}): Promise<void> {
  const path = hrefAbrirCardKanban(input.kanbanNome, input.cardId);
  const { error } = await input.db.from('alertas').insert({
    user_id: input.userId,
    tipo: TIPO_ALERTA,
    mensagem: input.mensagem,
    referencia_card_id: input.cardId,
    referencia_path: path,
    lido: false,
  } as never);
  if (error) console.error('[bastao-portfolio-operacoes] alerta:', error.message);
}

async function registrarHistorico(input: {
  cardId: string;
  userId: string | null;
  descricao: string;
  faseOrigemSlug: string;
  faseDestinoSlug: string;
  faseDestinoId: string;
  cardGatilhoId: string;
}): Promise<void> {
  const row = {
    card_id: input.cardId,
    usuario_id: uuidOuNull(input.userId),
    usuario_nome: null,
    acao: 'bastao_retorno',
    tipo: tipoKanbanHistoricoFromAcao('bastao_retorno'),
    detalhe: {
      tipo: 'bastao_retorno',
      descricao: input.descricao,
      fase_slug: input.faseOrigemSlug,
      fase_destino_slug: input.faseDestinoSlug,
      fase_destino_id: input.faseDestinoId,
      card_gatilho_id: input.cardGatilhoId,
    },
  };
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('kanban_historico').insert(row as never);
    if (error) console.error('[bastao-portfolio-operacoes] historico:', error.message);
  } catch (e) {
    console.error('[bastao-portfolio-operacoes] historico:', e);
  }
}

async function pularCard(input: {
  db: Db;
  card: CardAlvo;
  faseOrigemSlug: string;
  faseDestinoId: string;
  faseDestinoSlug: string;
  kanbanNome: string;
  mensagem: string;
  userId: string | null;
  cardGatilhoId: string;
}): Promise<boolean> {
  const slugAtual = await slugDaFase(input.db, input.card.fase_id);
  if (slugAtual !== input.faseOrigemSlug) return false;

  const { error } = await input.db
    .from('kanban_cards')
    .update({ fase_id: input.faseDestinoId })
    .eq('id', input.card.id);
  if (error) {
    console.error('[bastao-portfolio-operacoes] mover:', error.message);
    return false;
  }

  try {
    const { propagarResponsavelFaseAoEntrarFase, propagarResponsavelDaFaseAoEntrarFase } =
      await import('@/lib/kanban/responsavel-fase-checklist');
    await propagarResponsavelFaseAoEntrarFase(input.db, input.card.id, input.faseDestinoId, input.userId);
    await propagarResponsavelDaFaseAoEntrarFase(input.db, input.card.id, input.faseDestinoId, input.userId);
  } catch (e) {
    console.error('[bastao-portfolio-operacoes] responsavel:', e);
  }

  const { data: atualizado } = await input.db
    .from('kanban_cards')
    .select('id, titulo, fase_id, responsavel_id, arquivado, kanban_id')
    .eq('id', input.card.id)
    .maybeSingle();
  const cardAtual = (atualizado as CardAlvo | null) ?? input.card;
  const responsavelId = await responsavelDoCard(input.db, cardAtual, input.faseDestinoId);
  if (responsavelId) {
    await notificar({
      db: input.db,
      userId: responsavelId,
      cardId: input.card.id,
      kanbanNome: input.kanbanNome,
      mensagem: input.mensagem,
    });
  } else {
    console.error('[bastao-portfolio-operacoes] card sem responsavel:', input.card.id);
  }

  await registrarHistorico({
    cardId: input.card.id,
    userId: input.userId,
    descricao: input.mensagem,
    faseOrigemSlug: input.faseOrigemSlug,
    faseDestinoSlug: input.faseDestinoSlug,
    faseDestinoId: input.faseDestinoId,
    cardGatilhoId: input.cardGatilhoId,
  });
  return true;
}

/**
 * Comitê Ops no Pré Obra e Obra puxa o Portfólio de Convertidos para Atualizar Material.
 * A mesma regra vale para o Showroom, no card vinculado a ele — sem cruzar com o Portfólio.
 * Concluídos no Portfólio ou no Showroom puxa o Pré Obra e Obra de Comitê Ops para Comitê Ops Aprovado.
 * Só move se o card vinculado estiver exatamente na fase de origem.
 */
export async function executarBastaoPortfolioOperacoes(input: {
  cardId: string;
  novaFaseSlug: string;
  userId?: string | null;
}): Promise<void> {
  const cardId = String(input.cardId ?? '').trim();
  const slug = String(input.novaFaseSlug ?? '').trim();
  if (!cardId || !slug) return;
  if (
    slug !== FASE_SLUGS.REVISAO_BCA &&
    slug !== FASE_SLUGS.PORTFOLIO_CONCLUIDOS &&
    slug !== FASE_SLUGS.SR_CONCLUIDOS
  ) {
    return;
  }

  let db: Db;
  try {
    db = createAdminClient();
  } catch (e) {
    console.error('[bastao-portfolio-operacoes] admin:', e);
    return;
  }

  const { data: gatilho, error } = await db
    .from('kanban_cards')
    .select('id, kanban_id, titulo')
    .eq('id', cardId)
    .maybeSingle();
  if (error || !gatilho?.id) {
    if (error) console.error('[bastao-portfolio-operacoes] card:', error.message);
    return;
  }
  const kanbanId = String((gatilho as { kanban_id?: string }).kanban_id ?? '');
  let moveu = false;

  if (slug === FASE_SLUGS.REVISAO_BCA && kanbanId === KANBAN_IDS.OPERACOES) {
    const portfolio = await portfolioVinculado(db, cardId);
    const destino = await fasePorSlug(db, KANBAN_IDS.PORTFOLIO, FASE_SLUGS.PORTFOLIO_ATUALIZACAO_MATERIAL);
    if (portfolio && destino) {
      const titulo = String(portfolio.titulo ?? '').trim() || 'Card do Portfólio';
      moveu = await pularCard({
        db,
        card: portfolio,
        faseOrigemSlug: FASE_SLUGS.PORTFOLIO_CONVERTIDOS,
        faseDestinoId: destino.id,
        faseDestinoSlug: destino.slug,
        kanbanNome: 'Funil Portfólio',
        mensagem: `O card "${titulo}" foi para Atualizar Material porque o Pré Obra e Obra entrou em Comitê Ops.`,
        userId: input.userId ?? null,
        cardGatilhoId: cardId,
      });
    }

    const showroom = await cardVinculadoNoKanban(db, cardId, KANBAN_IDS.SHOWROOM);
    const destinoShowroom = await fasePorSlug(db, KANBAN_IDS.SHOWROOM, FASE_SLUGS.SR_ATUALIZAR_MATERIAL);
    if (showroom && destinoShowroom) {
      const titulo = String(showroom.titulo ?? '').trim() || 'Card do Showroom';
      const saltou = await pularCard({
        db,
        card: showroom,
        faseOrigemSlug: FASE_SLUGS.SR_CONVERTIDOS,
        faseDestinoId: destinoShowroom.id,
        faseDestinoSlug: destinoShowroom.slug,
        kanbanNome: 'Funil Showroom',
        mensagem: `O card "${titulo}" foi para Atualizar Material porque o Pré Obra e Obra entrou em Comitê Ops.`,
        userId: input.userId ?? null,
        cardGatilhoId: cardId,
      });
      moveu = moveu || saltou;
    }
  }

  if (slug === FASE_SLUGS.PORTFOLIO_CONCLUIDOS && kanbanId === KANBAN_IDS.PORTFOLIO) {
    const destino = await fasePorSlug(db, KANBAN_IDS.OPERACOES, FASE_SLUGS.COMITE_OPS_APROVADO);
    if (destino) {
      for (const ops of await operacoesVinculadas(db, cardId)) {
        const titulo = String(ops.titulo ?? '').trim() || 'Card de Pré Obra e Obra';
        const saltou = await pularCard({
          db,
          card: ops,
          faseOrigemSlug: FASE_SLUGS.REVISAO_BCA,
          faseDestinoId: destino.id,
          faseDestinoSlug: destino.slug,
          kanbanNome: 'Funil Operações',
          mensagem: `O card "${titulo}" foi para Comitê Ops Aprovado porque o Portfólio entrou em Concluídos.`,
          userId: input.userId ?? null,
          cardGatilhoId: cardId,
        });
        moveu = moveu || saltou;
      }
    }
  }

  if (slug === FASE_SLUGS.SR_CONCLUIDOS && kanbanId === KANBAN_IDS.SHOWROOM) {
    const destino = await fasePorSlug(db, KANBAN_IDS.OPERACOES, FASE_SLUGS.COMITE_OPS_APROVADO);
    if (destino) {
      for (const ops of await operacoesVinculadas(db, cardId)) {
        const titulo = String(ops.titulo ?? '').trim() || 'Card de Pré Obra e Obra';
        const saltou = await pularCard({
          db,
          card: ops,
          faseOrigemSlug: FASE_SLUGS.REVISAO_BCA,
          faseDestinoId: destino.id,
          faseDestinoSlug: destino.slug,
          kanbanNome: 'Funil Operações',
          mensagem: `O card "${titulo}" foi para Comitê Ops Aprovado porque o Showroom entrou em Concluídos.`,
          userId: input.userId ?? null,
          cardGatilhoId: cardId,
        });
        moveu = moveu || saltou;
      }
    }
  }

  if (!moveu) return;
  revalidatePath('/portfolio');
  revalidatePath('/funil-showroom');
  revalidatePath('/operacoes');
  revalidatePath('/alertas');
  revalidatePath('/');
}
