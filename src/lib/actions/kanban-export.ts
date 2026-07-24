'use server';

import type { KanbanCardBrief, KanbanFase } from '@/components/kanban-shared/types';
import { createClient } from '@/lib/supabase/server';
import { fetchKanbanCardModalDetalhes } from '@/lib/kanban/kanban-card-modal-detalhes';
import {
  montarCalculadoraPack,
  type CalculadoraPublicaCard,
} from '@/lib/kanban/fetch-calculadora-publica';
import {
  buildKanbanExportRow,
  buildKanbanExportVisibilityContext,
  resolveKanbanExportFields,
  type KanbanExportRowContext,
} from '@/lib/kanban/kanban-export-fields';
import { calcularSlaKanbanCard, tagSlaKanbanParaExibicao } from '@/lib/kanban/kanban-card-sla';
import { redeLoteadorRowToFichaDraft } from '@/lib/rede-loteador-ficha-draft';
import type { RedeLoteadorRow } from '@/lib/rede-loteadores';
import type { MoniCapitalCadastroUpsertDados } from '@/lib/moni-capital-cadastros';

export type ExportKanbanCardsForTableResult =
  | { ok: true; headers: string[]; rows: Record<string, string>[] }
  | { ok: false; error: string };

const CALCULADORA_FIELD_PREFIX = 'calculadora.';

async function fetchLoteadorDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
) {
  const { data: cardRow } = await supabase
    .from('kanban_cards')
    .select('rede_loteador_id')
    .eq('id', cardId)
    .maybeSingle();
  const rlId = String((cardRow as { rede_loteador_id?: string | null } | null)?.rede_loteador_id ?? '').trim();
  if (!rlId) return null;
  const { data: row } = await supabase.from('rede_loteadores').select('*').eq('id', rlId).maybeSingle();
  if (!row) return null;
  return redeLoteadorRowToFichaDraft(row as RedeLoteadorRow);
}

async function fetchMoniCapitalDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
): Promise<MoniCapitalCadastroUpsertDados | null> {
  const { data: cardRow } = await supabase
    .from('kanban_cards')
    .select('moni_capital_cadastro_id')
    .eq('id', cardId)
    .maybeSingle();
  const cadastroId = String(
    (cardRow as { moni_capital_cadastro_id?: string | null } | null)?.moni_capital_cadastro_id ?? '',
  ).trim();
  if (!cadastroId) return null;
  const { data: row } = await supabase
    .from('moni_capital_cadastros')
    .select('broker_nome, broker_email, broker_telefone, investidor_nome, investidor_email, investidor_telefone')
    .eq('id', cadastroId)
    .maybeSingle();
  if (!row) return null;
  const r = row as Record<string, string | null>;
  return {
    broker_nome: r.broker_nome ?? '',
    broker_email: r.broker_email ?? '',
    broker_telefone: r.broker_telefone ?? '',
    investidor_nome: r.investidor_nome ?? '',
    investidor_email: r.investidor_email ?? '',
    investidor_telefone: r.investidor_telefone ?? '',
  };
}

function cardParaCalculadoraPack(
  card: KanbanCardBrief,
  processoStepOneId: string | null,
): CalculadoraPublicaCard {
  return {
    id: card.id,
    titulo: card.titulo,
    kanban_id: String(card.kanban_id ?? ''),
    fase_id: card.fase_id,
    created_at: card.created_at,
    entered_fase_at: card.entered_fase_at ?? null,
    concluido: card.concluido ?? false,
    concluido_em: card.concluido_em ?? null,
    contrato_assinado_em: null,
    contrato_condicoes_precedentes: null,
    obra_iniciada_em: null,
    obra_finalizada_em: null,
    opcao_assinada_em: null,
    processo_step_one_id: processoStepOneId,
    condominio_id: null,
  };
}

function slaTagFromCard(card: KanbanCardBrief, fase: KanbanFase | null): string {
  const sla = calcularSlaKanbanCard({
    created_at: card.created_at,
    entered_fase_at: card.entered_fase_at,
    sla_iniciado_em: card.sla_iniciado_em,
    faseSlug: fase?.slug,
    alvara_url: card.alvara_url,
    docs_terreno_url: card.docs_terreno_url,
    sla_dias: fase?.sla_dias,
    sla_tipo: fase?.sla_tipo,
  });
  const tag = tagSlaKanbanParaExibicao(sla);
  if (tag) return tag.texto;
  if (sla.pausado) return 'Aguardando documentação';
  if (sla.semSla) return '—';
  return 'No prazo';
}

async function resolveProcessoStepOneId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  card: KanbanCardBrief,
): Promise<string | null> {
  if (card.origem === 'legado') return card.id;
  const { data } = await supabase
    .from('kanban_cards')
    .select('processo_step_one_id')
    .eq('id', card.id)
    .maybeSingle();
  const proc = String((data as { processo_step_one_id?: string | null } | null)?.processo_step_one_id ?? '').trim();
  return proc || null;
}

async function buildExportRowContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  card: KanbanCardBrief,
  fases: KanbanFase[],
  kanbanNome: string,
  needsCalculadora: boolean,
  visibility: ReturnType<typeof buildKanbanExportVisibilityContext>,
): Promise<KanbanExportRowContext> {
  const isLegado = card.origem === 'legado';
  const fase = fases.find((f) => f.id === card.fase_id) ?? null;

  const [detalhes, loteador, moniCapital, calculadoraPack] = await Promise.all([
    fetchKanbanCardModalDetalhes(supabase, {
      origem: isLegado ? 'legado' : 'nativo',
      cardId: card.id,
      cardTitulo: card.titulo,
      redeFranqueadoId: String(card.franqueado_id ?? '').trim() || null,
      cardProjetoId: card.projeto_id ?? null,
      cardProcessoStepOneId: isLegado ? card.id : null,
    }),
    visibility.isLoteador ? fetchLoteadorDraft(supabase, card.id) : Promise.resolve(null),
    visibility.isFunding && !isLegado ? fetchMoniCapitalDraft(supabase, card.id) : Promise.resolve(null),
    (async () => {
      if (!needsCalculadora || visibility.isLoteador) return null;
      const procId = await resolveProcessoStepOneId(supabase, card);
      return montarCalculadoraPack(supabase, cardParaCalculadoraPack(card, procId));
    })(),
  ]);

  return {
    card,
    detalhes,
    fase,
    slaTag: slaTagFromCard(card, fase),
    loteador,
    moniCapital,
    calculadoraResumo: calculadoraPack?.resumo ?? null,
    fases,
    kanbanNome,
    visibility,
  };
}

/** Exporta cards do Kanban como linhas planas para CSV/Excel. */
export async function exportKanbanCardsForTable(input: {
  kanbanId: string;
  kanbanNome: string;
  fases: KanbanFase[];
  cards: KanbanCardBrief[];
  selectedFieldIds: string[];
}): Promise<ExportKanbanCardsForTableResult> {
  const kanbanId = String(input.kanbanId ?? '').trim();
  const kanbanNome = String(input.kanbanNome ?? '').trim();
  const cards = input.cards ?? [];
  const selectedFieldIds = (input.selectedFieldIds ?? []).filter(Boolean);
  const fases = input.fases ?? [];

  if (!kanbanId) return { ok: false, error: 'Kanban não informado.' };
  if (cards.length === 0) return { ok: false, error: 'Nenhum card selecionado para exportar.' };
  if (selectedFieldIds.length === 0) return { ok: false, error: 'Selecione ao menos um campo.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado.' };

  const needsCalculadora = selectedFieldIds.some((id) => id.startsWith(CALCULADORA_FIELD_PREFIX));

  const firstVisibility = buildKanbanExportVisibilityContext({
    kanbanId,
    kanbanNome,
    card: cards[0]!,
    fases,
  });
  const fields = resolveKanbanExportFields(selectedFieldIds, firstVisibility);
  if (fields.length === 0) {
    return { ok: false, error: 'Nenhum campo válido para exportação neste funil.' };
  }

  const headers = fields.map((f) => f.label);
  const rows: Record<string, string>[] = [];

  for (const card of cards) {
    const visibility = buildKanbanExportVisibilityContext({
      kanbanId,
      kanbanNome,
      card,
      fases,
    });
    const cardFields = resolveKanbanExportFields(selectedFieldIds, visibility);
    if (cardFields.length === 0) continue;

    const ctx = await buildExportRowContext(
      supabase,
      card,
      fases,
      kanbanNome,
      needsCalculadora,
      visibility,
    );

    const row = buildKanbanExportRow(ctx, cardFields);
    for (const h of headers) {
      if (!(h in row)) row[h] = '';
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    return { ok: false, error: 'Nenhuma linha gerada — verifique os campos selecionados.' };
  }

  return { ok: true, headers, rows };
}
