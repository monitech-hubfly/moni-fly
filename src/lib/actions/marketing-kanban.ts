'use server';

import { criarCard } from '@/lib/actions/card-actions';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  KANBAN_NOME_MKT_PROGRAMACAO,
  MKT_CAMPO_PERFIL_DESTINO,
  MKT_PROG_PLANEJAMENTO_SLUG,
  isMarketingKanbanId,
  labelSemanaIsoAtual,
  marketingFunilPorSlug,
} from '@/lib/kanban/funis-marketing';
import { createClient } from '@/lib/supabase/server';

export type MarketingPerfilMap = Record<string, string>;

export async function fetchMarketingPerfilDestino(
  cardIds: string[],
): Promise<MarketingPerfilMap> {
  const ids = [...new Set(cardIds.map((id) => String(id ?? '').trim()).filter(Boolean))];
  if (ids.length === 0) return {};

  const supabase = await createClient();
  const { data: itens } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id')
    .eq('campo_slug', MKT_CAMPO_PERFIL_DESTINO);
  const itemIds = (itens ?? []).map((r) => String((r as { id?: string }).id ?? '')).filter(Boolean);
  if (itemIds.length === 0) return {};

  const { data: resps } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('card_id, valor')
    .in('card_id', ids)
    .in('item_id', itemIds);

  const out: MarketingPerfilMap = {};
  for (const row of resps ?? []) {
    const cardId = String((row as { card_id?: string }).card_id ?? '').trim();
    const valor = String((row as { valor?: string | null }).valor ?? '').trim();
    if (cardId && valor) out[cardId] = valor;
  }
  return out;
}

export async function criarCicloSemanalMarketing(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para criar o ciclo.' };

  const { data: fase, error: faseErr } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.MARKETING_PROGRAMACAO)
    .eq('slug', MKT_PROG_PLANEJAMENTO_SLUG)
    .eq('ativo', true)
    .maybeSingle();
  if (faseErr) return { ok: false, error: faseErr.message };
  const faseId = String((fase as { id?: string } | null)?.id ?? '').trim();
  if (!faseId) return { ok: false, error: 'Fase Planejamento Semanal não encontrada.' };

  const titulo = `Ciclo ${labelSemanaIsoAtual()}`;
  const res = await criarCard({
    titulo,
    kanban_nome: KANBAN_NOME_MKT_PROGRAMACAO,
    fase_id: faseId,
    basePath: '/marketing/programacao-conteudo-semanal',
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

export type MarketingFunilExportJson = {
  funil: string;
  kanbanId: string;
  exportadoEm: string;
  fases: { id: string; slug: string | null; nome: string; ordem: number }[];
  cards: {
    id: string;
    titulo: string;
    status: string;
    concluido: boolean;
    arquivado: boolean;
    faseId: string;
    faseNome: string | null;
    criadoEm: string | null;
    atualizadoEm: string | null;
    campos: Record<string, string | null>;
  }[];
};

export async function exportMarketingFunilJson(input: {
  kanbanId: string;
}): Promise<{ ok: true; payload: MarketingFunilExportJson } | { ok: false; error: string }> {
  const kanbanId = String(input.kanbanId ?? '').trim();
  if (!isMarketingKanbanId(kanbanId)) {
    return { ok: false, error: 'Funil de Marketing inválido.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const { data: kanban, error: kbErr } = await supabase
    .from('kanbans')
    .select('id, nome')
    .eq('id', kanbanId)
    .maybeSingle();
  if (kbErr) return { ok: false, error: kbErr.message };
  if (!kanban) return { ok: false, error: 'Kanban não encontrado.' };

  const { data: fases, error: fasesErr } = await supabase
    .from('kanban_fases')
    .select('id, nome, slug, ordem')
    .eq('kanban_id', kanbanId)
    .eq('ativo', true)
    .order('ordem');
  if (fasesErr) return { ok: false, error: fasesErr.message };
  const fasesList = fases ?? [];
  const faseIds = fasesList.map((f) => String((f as { id: string }).id));
  const faseNomePorId = new Map(
    fasesList.map((f) => [
      String((f as { id: string }).id),
      String((f as { nome?: string }).nome ?? ''),
    ]),
  );

  const { data: cards, error: cardsErr } = await supabase
    .from('kanban_cards')
    .select('id, titulo, status, concluido, arquivado, fase_id, created_at, updated_at')
    .eq('kanban_id', kanbanId)
    .order('created_at', { ascending: true });
  if (cardsErr) return { ok: false, error: cardsErr.message };
  const cardsList = cards ?? [];
  const cardIds = cardsList.map((c) => String((c as { id: string }).id));

  const { data: itens } = faseIds.length
    ? await supabase
        .from('kanban_fase_checklist_itens')
        .select('id, fase_id, label, campo_slug')
        .in('fase_id', faseIds)
    : { data: [] as { id: string; fase_id: string; label: string; campo_slug: string | null }[] };

  const itemMeta = new Map(
    (itens ?? []).map((i) => [
      String((i as { id: string }).id),
      {
        label: String((i as { label?: string }).label ?? ''),
        slug: String((i as { campo_slug?: string | null }).campo_slug ?? ''),
      },
    ]),
  );
  const itemIds = [...itemMeta.keys()];

  const { data: resps } =
    cardIds.length && itemIds.length
      ? await supabase
          .from('kanban_fase_checklist_respostas')
          .select('card_id, item_id, valor')
          .in('card_id', cardIds)
          .in('item_id', itemIds)
      : { data: [] as { card_id: string; item_id: string; valor: string | null }[] };

  const camposPorCard = new Map<string, Record<string, string | null>>();
  for (const r of resps ?? []) {
    const cardId = String((r as { card_id?: string }).card_id ?? '');
    const itemId = String((r as { item_id?: string }).item_id ?? '');
    const meta = itemMeta.get(itemId);
    if (!cardId || !meta) continue;
    const key = meta.slug || meta.label;
    if (!camposPorCard.has(cardId)) camposPorCard.set(cardId, {});
    camposPorCard.get(cardId)![key] = (r as { valor?: string | null }).valor ?? null;
  }

  const funilDef = marketingFunilPorSlug(
    kanbanId === KANBAN_IDS.MARKETING_GRAVACAO
      ? 'gravacao-videos-externos'
      : kanbanId === KANBAN_IDS.MARKETING_PROGRAMACAO
        ? 'programacao-conteudo-semanal'
        : 'serie-inc-to-fly',
  );

  return {
    ok: true,
    payload: {
      funil: funilDef?.titulo ?? String((kanban as { nome?: string }).nome ?? 'Marketing'),
      kanbanId,
      exportadoEm: new Date().toISOString(),
      fases: fasesList.map((f) => ({
        id: String((f as { id: string }).id),
        slug: (f as { slug?: string | null }).slug ?? null,
        nome: String((f as { nome?: string }).nome ?? ''),
        ordem: Number((f as { ordem?: number }).ordem ?? 0),
      })),
      cards: cardsList.map((c) => {
        const id = String((c as { id: string }).id);
        const faseId = String((c as { fase_id?: string }).fase_id ?? '');
        return {
          id,
          titulo: String((c as { titulo?: string }).titulo ?? ''),
          status: String((c as { status?: string }).status ?? ''),
          concluido: Boolean((c as { concluido?: boolean }).concluido),
          arquivado: Boolean((c as { arquivado?: boolean }).arquivado),
          faseId,
          faseNome: faseNomePorId.get(faseId) ?? null,
          criadoEm: (c as { created_at?: string | null }).created_at ?? null,
          atualizadoEm: (c as { updated_at?: string | null }).updated_at ?? null,
          campos: camposPorCard.get(id) ?? {},
        };
      }),
    },
  };
}
