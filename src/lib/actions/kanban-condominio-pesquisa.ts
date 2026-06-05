'use server';

import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import {
  atualizarPesquisaPreenchidaEm,
  linhaPesquisaCompleta,
  normalizarLinhaProspect,
  parseLinhasProspectCondominio,
  serializarLinhasProspectCondominio,
  todasPesquisasProspectCompletas,
  type ChavePesquisaCondominio,
  type LinhaProspectCondominio,
} from '@/lib/kanban/condominio-prospect-pesquisa';
import { createClient } from '@/lib/supabase/server';

export type KanbanCondominioPesquisaResult = { ok: true } | { ok: false; error: string };

export type CarregarProspectsCondominioResult =
  | {
      ok: true;
      linhas: LinhaProspectCondominio[];
      tabelaItemId: string | null;
      pesquisaItemId: string | null;
    }
  | { ok: false; error: string };

const LABEL_TABELA_PROSPECT = 'Tabela de Condomínios';
const LABEL_PESQUISA = 'Pesquisa de condomínios prospectados';

const DADOS_CIDADE_SLUGS = [FASE_SLUGS.DADOS_CIDADE, 'stepone_dados_cidade'] as const;
const DADOS_CONDOMINIOS_SLUGS = [FASE_SLUGS.DADOS_CONDOMINIOS, 'stepone_dados_cond'] as const;

async function buscarFaseIdPorSlugs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  kanbanId: string,
  slugs: readonly string[],
): Promise<string | null> {
  const { data, error } = await supabase
    .from('kanban_fases')
    .select('id, slug')
    .eq('kanban_id', kanbanId)
    .in('slug', [...slugs]);

  if (error || !data?.length) return null;

  for (const slug of slugs) {
    const hit = (data as { id: string; slug: string }[]).find((f) => f.slug === slug);
    if (hit) return hit.id;
  }
  return (data[0] as { id: string }).id;
}

async function buscarItemChecklistPorLabel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  faseId: string,
  label: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id')
    .eq('fase_id', faseId)
    .eq('label', label)
    .maybeSingle();

  if (error || !data) return null;
  return (data as { id: string }).id;
}

async function buscarValorChecklist(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
  cardId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('valor')
    .eq('item_id', itemId)
    .eq('card_id', cardId)
    .maybeSingle();

  if (error) return null;
  return (data as { valor?: string | null } | null)?.valor ?? null;
}

async function upsertChecklistValor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itemId: string,
  cardId: string,
  valor: string | null,
  userId: string,
): Promise<KanbanCondominioPesquisaResult> {
  const { error } = await supabase.from('kanban_fase_checklist_respostas').upsert(
    {
      item_id: itemId,
      card_id: cardId,
      valor,
      preenchido_por: userId,
      preenchido_em: new Date().toISOString(),
    },
    { onConflict: 'item_id,card_id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function carregarProspectsCondominioCard(cardId: string): Promise<CarregarProspectsCondominioResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cardIdTrim = String(cardId ?? '').trim();
  if (!cardIdTrim) return { ok: false, error: 'Card inválido.' };

  const { data: cardRow, error: cardErr } = await supabase
    .from('kanban_cards')
    .select('kanban_id')
    .eq('id', cardIdTrim)
    .maybeSingle();

  if (cardErr || !cardRow) return { ok: false, error: 'Card não encontrado.' };

  const kanbanId = String((cardRow as { kanban_id?: string }).kanban_id ?? '').trim();
  if (!kanbanId) return { ok: false, error: 'Kanban do card não encontrado.' };

  const faseCidadeId = await buscarFaseIdPorSlugs(supabase, kanbanId, DADOS_CIDADE_SLUGS);
  if (!faseCidadeId) return { ok: false, error: 'Fase Dados da Cidade não encontrada.' };

  const faseCondominiosId = await buscarFaseIdPorSlugs(supabase, kanbanId, DADOS_CONDOMINIOS_SLUGS);

  const tabelaItemId = await buscarItemChecklistPorLabel(supabase, faseCidadeId, LABEL_TABELA_PROSPECT);
  if (!tabelaItemId) {
    return { ok: false, error: 'Item "Tabela de Condomínios" não encontrado na fase Dados da Cidade.' };
  }

  const pesquisaItemId = faseCondominiosId
    ? await buscarItemChecklistPorLabel(supabase, faseCondominiosId, LABEL_PESQUISA)
    : null;

  const valor = await buscarValorChecklist(supabase, tabelaItemId, cardIdTrim);
  const linhas = parseLinhasProspectCondominio(valor);

  return { ok: true, linhas, tabelaItemId, pesquisaItemId };
}

export async function salvarPesquisaCondominioProspect(input: {
  cardId: string;
  rowId: string;
  respostas: Partial<Record<ChavePesquisaCondominio, string>>;
}): Promise<KanbanCondominioPesquisaResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cardId = String(input.cardId ?? '').trim();
  const rowId = String(input.rowId ?? '').trim();
  if (!cardId || !rowId) return { ok: false, error: 'Card e condomínio são obrigatórios.' };

  const loaded = await carregarProspectsCondominioCard(cardId);
  if (!loaded.ok) return loaded;

  const idx = loaded.linhas.findIndex((l) => l.row_id === rowId);
  if (idx < 0) return { ok: false, error: 'Condomínio não encontrado na tabela de prospects.' };

  const atual = loaded.linhas[idx];
  const merged: LinhaProspectCondominio = atualizarPesquisaPreenchidaEm(
    normalizarLinhaProspect({
      ...atual,
      ...input.respostas,
      row_id: rowId,
    }),
  );

  if (linhaPesquisaCompleta(merged) && !merged.pesquisa_preenchida_em) {
    merged.pesquisa_preenchida_em = new Date().toISOString();
  }

  const novasLinhas = [...loaded.linhas];
  novasLinhas[idx] = merged;
  const json = serializarLinhasProspectCondominio(novasLinhas);

  const saveTabela = await upsertChecklistValor(supabase, loaded.tabelaItemId!, cardId, json, user.id);
  if (!saveTabela.ok) return saveTabela;

  if (loaded.pesquisaItemId) {
    const valorPesquisa = todasPesquisasProspectCompletas(novasLinhas) ? 'true' : '';
    const savePesquisa = await upsertChecklistValor(supabase, loaded.pesquisaItemId, cardId, valorPesquisa, user.id);
    if (!savePesquisa.ok) return savePesquisa;
  }

  return { ok: true };
}
