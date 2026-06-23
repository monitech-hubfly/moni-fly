import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanFase } from '@/components/kanban-shared/types';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { normalizarSlaTipo } from '@/lib/dias-uteis';
import { isRemovedStepOneFaseSlug } from '@/lib/kanban/stepone-fase-slugs';
import { ESTEIRA_COLUNAS } from '@/lib/kanban/pipeline-esteira-datas';
import { ESTEIRA_TRES_ETAPAS } from '@/lib/kanban/pipeline-esteira-tres-etapas';
import { parseKanbanFaseMateriais } from './parse-kanban-fase-materiais';
import type { FaseNegocioPrazoOpcao } from './dados-negocio-prazo';

export function mapKanbanFaseRow(row: Record<string, unknown>): KanbanFase {
  return {
    id: String(row.id),
    nome: String(row.nome ?? ''),
    ordem: Number(row.ordem ?? 0),
    sla_dias: row.sla_dias != null && row.sla_dias !== '' ? Number(row.sla_dias) : null,
    sla_tipo: normalizarSlaTipo(row.sla_tipo != null ? String(row.sla_tipo) : null),
    slug: row.slug != null ? String(row.slug) : null,
    instrucoes: row.instrucoes != null ? String(row.instrucoes) : null,
    materiais: parseKanbanFaseMateriais(row.materiais),
    fase_conversao: Boolean(row.fase_conversao),
    ativo: row.ativo !== false && row.ativo !== 'false',
  };
}

/**
 * Fases ativas do kanban para renderização do board e modal.
 * Inclui fases terminais sem SLA (`sla_dias` NULL). Único filtro: `ativo = true`.
 */
export async function fetchKanbanFasesAtivas(
  supabase: SupabaseClient,
  kanbanId: string,
): Promise<KanbanFase[]> {
  const { data: fasesRows, error } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias, sla_tipo, slug, instrucoes, materiais, fase_conversao, ativo')
    .eq('kanban_id', kanbanId)
    .eq('ativo', true)
    .order('ordem');

  if (error) {
    console.error('[fetchKanbanFasesAtivas]', error.message);
    return [];
  }

  return (fasesRows ?? []).map((row) => mapKanbanFaseRow(row as Record<string, unknown>));
}

/** Fases ativas de vários kanbans em uma única query (pipeline / painel). */
export async function fetchKanbanFasesAtivasBatch(
  supabase: SupabaseClient,
  kanbanIds: string[],
): Promise<KanbanFase[]> {
  const uniq = [...new Set(kanbanIds.map((id) => String(id ?? '').trim()).filter(Boolean))];
  if (uniq.length === 0) return [];

  const { data: fasesRows, error } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias, sla_tipo, slug, instrucoes, materiais, fase_conversao, kanban_id')
    .in('kanban_id', uniq)
    .eq('ativo', true)
    .order('ordem');

  if (error) {
    console.error('[fetchKanbanFasesAtivasBatch]', error.message);
    return [];
  }

  return (fasesRows ?? []).map((row) => mapKanbanFaseRow(row as Record<string, unknown>));
}

/** Inclui fases referenciadas por cards cujo `fase_id` não está nas fases ativas (ex.: fase desativada). */
export async function augmentKanbanFasesComFasesDosCards(
  supabase: SupabaseClient,
  kanbanId: string,
  fases: KanbanFase[],
  cardFaseIds: Iterable<string>,
): Promise<KanbanFase[]> {
  const known = new Set(fases.map((f) => f.id));
  const missing = [...new Set([...cardFaseIds].filter((id) => id && !known.has(id)))];
  if (missing.length === 0) return fases;

  const { data: extraRows, error } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias, sla_tipo, slug, instrucoes, materiais, fase_conversao, ativo')
    .eq('kanban_id', kanbanId)
    .in('id', missing);

  if (error) {
    console.error('[augmentKanbanFasesComFasesDosCards]', error.message);
    return fases;
  }

  const extra = (extraRows ?? [])
    .map((row) => mapKanbanFaseRow(row as Record<string, unknown>))
    .filter((f) => !isRemovedStepOneFaseSlug(f.slug));
  return [...fases, ...extra].sort((a, b) => a.ordem - b.ordem);
}

/** Funis das três esteiras da pipeline consolidada (Step One → Portfólio → Pré Obra e Obra). */
const KANBANS_NEGOCIO_PRAZO_ESTEIRA = [
  KANBAN_IDS.STEP_ONE,
  KANBAN_IDS.PORTFOLIO,
  KANBAN_IDS.OPERACOES,
] as const;

function etapaEsteiraLabelNegocioPrazo(ordemGlobal: number): string {
  if (ordemGlobal <= 3) return ESTEIRA_TRES_ETAPAS[0].label;
  if (ordemGlobal <= 10) return ESTEIRA_TRES_ETAPAS[1].label;
  return ESTEIRA_TRES_ETAPAS[2].label;
}

/** 14 fases-chave das três esteiras — mesma ordem da tabela consolidada da Rede. */
export function montarFasesNegocioPrazoOpcoes(fases: KanbanFase[]): FaseNegocioPrazoOpcao[] {
  const bySlug = new Map<string, KanbanFase>();
  const byId = new Map<string, KanbanFase>();
  for (const fase of fases) {
    byId.set(fase.id, fase);
    const slug = String(fase.slug ?? '').trim();
    if (slug) bySlug.set(slug, fase);
  }

  const opcoes: FaseNegocioPrazoOpcao[] = [];
  for (const col of ESTEIRA_COLUNAS) {
    const fase = bySlug.get(col.slug) ?? byId.get(col.faseId);
    if (!fase) continue;
    opcoes.push({
      id: fase.id,
      label: `${etapaEsteiraLabelNegocioPrazo(col.ordemGlobal)} — ${col.label}`,
    });
  }

  const faseOpcao = bySlug.get('step_3') ?? bySlug.get('opcao');
  if (faseOpcao && !opcoes.some((o) => o.id === faseOpcao.id)) {
    const idxNovoNeg = opcoes.findIndex((o) => /—\s*Novo Neg\./i.test(o.label));
    const insertAt = idxNovoNeg >= 0 ? idxNovoNeg + 1 : opcoes.length;
    opcoes.splice(insertAt, 0, {
      id: faseOpcao.id,
      label: `${ESTEIRA_TRES_ETAPAS[1].label} — Opção`,
    });
  }

  return opcoes;
}

/** Fases âncora dos prazos em Dados do Negócio — apenas as 14 colunas das três esteiras. */
export async function fetchFasesNegocioPrazoOpcoes(supabase: SupabaseClient): Promise<FaseNegocioPrazoOpcao[]> {
  const fases: KanbanFase[] = [];
  for (const kanbanId of KANBANS_NEGOCIO_PRAZO_ESTEIRA) {
    const list = await fetchKanbanFasesAtivas(supabase, kanbanId);
    fases.push(...list);
  }
  return montarFasesNegocioPrazoOpcoes(fases);
}
