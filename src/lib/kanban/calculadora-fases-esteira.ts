import type { KanbanFase } from '@/components/kanban-shared/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { CondominioPrazosAprovacaoSla } from '@/lib/kanban/condominio-prazos-aprovacao';
import {
  calcularLinhasCalculadoraFases,
  inferirFimRealPorProximaFase,
  aplicarAncoraCalculadoraLinhas,
  aplicarDatasManuaisCalculadoraLinhas,
  normalizarIntervaloDatasCalculadoraLinhas,
  type CalculadoraAncora,
  type CalculadoraFaseDataManualOverride,
  type CalculadoraFaseLinha,
  type CalculadoraFasesInput,
} from '@/lib/kanban/calculadora-fases';
import { fetchKanbanFasesAtivas, mapKanbanFaseRow } from '@/lib/kanban/fetch-kanban-fases';
import type { FaseVisit } from '@/lib/kanban/kanban-card-timeline';
import { indiceEsteiraTresEtapas } from '@/lib/kanban/pipeline-esteira-tres-etapas';
import { filterStepOneCalculadoraFases, isCalculadoraExcludedStepOneFaseSlug } from '@/lib/kanban/stepone-fase-slugs';
import { filterOperacoesCalculadoraFases } from '@/lib/kanban/operacoes-fase-slugs';
import {
  filterPortfolioCalculadoraFases,
  isCalculadoraExcludedPortfolioFaseSlug,
} from '@/lib/kanban/portfolio-fase-slugs';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';

/** Ordem fixa da calculadora global: Step One → Portfólio → Pré Obra e Obra. */
export const CALCULADORA_ESTEIRA_FUNIS = [
  { kanbanId: KANBAN_IDS.STEP_ONE, label: 'Funil Step One' },
  { kanbanId: KANBAN_IDS.PORTFOLIO, label: 'Funil Portfólio' },
  { kanbanId: KANBAN_IDS.OPERACOES, label: 'Funil Pré Obra e Obra' },
] as const;

export const CALCULADORA_ESTEIRA_KANBAN_IDS = CALCULADORA_ESTEIRA_FUNIS.map((f) => f.kanbanId);

export type CalculadoraFaseEsteiraMeta = KanbanFase & {
  kanbanId: string;
  funilLabel: string;
  ordemGlobal: number;
  segmentoEsteira: number;
};

export function segmentoEsteiraCardCalculadora(kanbanId: string): number {
  const kid = String(kanbanId ?? '').trim();
  if (kid === KANBAN_IDS.STEP_ONE || kid === KANBAN_IDS.LOTEADORES) return 0;
  if (kid === KANBAN_IDS.PORTFOLIO) return 1;
  if (kid === KANBAN_IDS.OPERACOES) return 2;
  return indiceEsteiraTresEtapas(kid);
}

export function cardKanbanNaEsteiraPrincipalCalculadora(kanbanId: string): boolean {
  const kid = String(kanbanId ?? '').trim();
  return (
    kid === KANBAN_IDS.STEP_ONE ||
    kid === KANBAN_IDS.LOTEADORES ||
    kid === KANBAN_IDS.PORTFOLIO ||
    kid === KANBAN_IDS.OPERACOES
  );
}

function filtrarFasesStepOne(fases: KanbanFase[]): KanbanFase[] {
  return filterStepOneCalculadoraFases(fases);
}

function filtrarFasesOperacoes(fases: KanbanFase[]): KanbanFase[] {
  return filterOperacoesCalculadoraFases(fases);
}

function filtrarFasesPortfolio(fases: KanbanFase[]): KanbanFase[] {
  return filterPortfolioCalculadoraFases(fases);
}

function filtrarFasesCalculadoraEsteira(kanbanId: string, fases: KanbanFase[]): KanbanFase[] {
  if (kanbanId === KANBAN_IDS.STEP_ONE) return filtrarFasesStepOne(fases);
  if (kanbanId === KANBAN_IDS.PORTFOLIO) return filtrarFasesPortfolio(fases);
  if (kanbanId === KANBAN_IDS.OPERACOES) return filtrarFasesOperacoes(fases);
  return fases;
}

/** Carrega fases ativas dos 3 funis da esteira principal. */
export async function fetchCalculadoraEsteiraFasesMap(
  supabase: SupabaseClient,
): Promise<Map<string, KanbanFase[]>> {
  const map = new Map<string, KanbanFase[]>();
  for (const { kanbanId } of CALCULADORA_ESTEIRA_FUNIS) {
    const fases = await fetchKanbanFasesAtivas(supabase, kanbanId);
    const list = filtrarFasesCalculadoraEsteira(kanbanId, fases);
    map.set(kanbanId, list);
  }
  return map;
}

/** Monta lista única de fases na ordem global da esteira. */
export function montarFasesCalculadoraEsteira(
  fasesPorKanban: Map<string, KanbanFase[]>,
): CalculadoraFaseEsteiraMeta[] {
  const result: CalculadoraFaseEsteiraMeta[] = [];
  let ordemGlobal = 0;

  for (let segmento = 0; segmento < CALCULADORA_ESTEIRA_FUNIS.length; segmento++) {
    const funil = CALCULADORA_ESTEIRA_FUNIS[segmento]!;
    const fases = [...(fasesPorKanban.get(funil.kanbanId) ?? [])].sort((a, b) => a.ordem - b.ordem);
    for (const fase of fases) {
      ordemGlobal += 1;
      result.push({
        ...fase,
        kanbanId: funil.kanbanId,
        funilLabel: funil.label,
        ordemGlobal,
        segmentoEsteira: segmento,
      });
    }
  }

  return result;
}

function aplicarOrdemRelativaFaseAtual(
  linhas: CalculadoraFaseLinha[],
  meta: CalculadoraFaseEsteiraMeta[],
  cardFaseId: string,
): CalculadoraFaseLinha[] {
  const ordemPorFase = new Map(meta.map((m) => [m.id, m.ordemGlobal]));
  const ordemAtual = ordemPorFase.get(cardFaseId);
  if (ordemAtual == null) return linhas;

  return linhas.map((linha) => {
    if (linha.faseId === cardFaseId) return linha;
    const ordem = ordemPorFase.get(linha.faseId) ?? linha.ordem;

    if (ordem < ordemAtual) {
      if (linha.status === 'futura' || linha.status === 'atual' || linha.status === 'atual_atrasada') {
        return { ...linha, status: 'concluida', atrasoDias: null };
      }
      return linha;
    }

    if (ordem > ordemAtual && linha.status !== 'concluida' && linha.status !== 'concluida_atraso') {
      return {
        ...linha,
        status: 'futura',
        dataFimReal: null,
        atrasoDias: null,
      };
    }

    return linha;
  });
}

function aplicarRegrasSegmentoEsteira(
  linhas: CalculadoraFaseLinha[],
  meta: CalculadoraFaseEsteiraMeta[],
  segmentoCard: number,
): CalculadoraFaseLinha[] {
  const segPorFase = new Map(meta.map((m) => [m.id, m.segmentoEsteira]));
  const labelPorFase = new Map(meta.map((m) => [m.id, m.funilLabel]));

  return linhas.map((linha) => {
    const seg = segPorFase.get(linha.faseId) ?? 0;
    const funilLabel = labelPorFase.get(linha.faseId);
    const base = funilLabel ? { ...linha, funilLabel } : linha;

    if (seg < segmentoCard) {
      if (
        base.status === 'futura' ||
        base.status === 'atual' ||
        base.status === 'atual_atrasada'
      ) {
        return {
          ...base,
          status: 'concluida',
          atrasoDias: null,
        };
      }
      return base;
    }

    if (seg > segmentoCard) {
      return {
        ...base,
        status: 'futura',
        dataFimReal: null,
        atrasoDias: null,
      };
    }

    return base;
  });
}

function resolverFaseIdParaCalculo(
  cardFaseId: string,
  meta: CalculadoraFaseEsteiraMeta[],
  segmentoCard: number,
  cardNaEsteira: boolean,
  cardFaseSlug?: string | null,
): string {
  if (cardNaEsteira && meta.some((m) => m.id === cardFaseId)) return cardFaseId;

  if (isCalculadoraExcludedStepOneFaseSlug(cardFaseSlug)) {
    const primeiraIncluida = meta.find((m) => m.segmentoEsteira === 0);
    if (primeiraIncluida) return primeiraIncluida.id;
  }

  if (isCalculadoraExcludedPortfolioFaseSlug(cardFaseSlug)) {
    const passagem = meta.find(
      (m) => m.segmentoEsteira === 1 && m.slug === FASE_SLUGS.PASSAGEM_WAYSER,
    );
    if (passagem) return passagem.id;
    const primeiraPortfolio = meta.find((m) => m.segmentoEsteira === 1);
    if (primeiraPortfolio) return primeiraPortfolio.id;
  }

  const primeiraDoSegmento = meta.find((m) => m.segmentoEsteira === segmentoCard);
  return primeiraDoSegmento?.id ?? cardFaseId;
}

/** Fases de todos os funis da esteira — necessário para montar visitas com histórico cross-funil. */
export function montarFasesFlatCalculadoraVisitas(
  fasesPorKanban: Map<string, KanbanFase[]>,
  fasesKanbanAtual: KanbanFase[],
  kanbanId: string,
): KanbanFase[] {
  const list: KanbanFase[] = [];
  for (const kid of CALCULADORA_ESTEIRA_KANBAN_IDS) {
    list.push(...(fasesPorKanban.get(kid) ?? []));
  }
  if (list.length > 0) return list;
  return filtrarFasesCalculadoraEsteira(kanbanId, fasesKanbanAtual);
}

/**
 * Calculadora com todas as fases Step One → Portfólio → Pré Obra e Obra.
 * Cards em funis anteriores marcam fases futuras; em funis posteriores, anteriores como concluídas.
 */
export function calcularLinhasCalculadoraFasesEsteira(input: {
  fasesPorKanban: Map<string, KanbanFase[]>;
  cardKanbanId: string;
  cardFaseSlug?: string | null;
  card: CalculadoraFasesInput['card'];
  visits: FaseVisit[];
  hoje?: Date;
  ancora?: CalculadoraAncora | null;
  overrides?: Map<string, CalculadoraFaseDataManualOverride>;
  slaCondominio?: CondominioPrazosAprovacaoSla | null;
}): CalculadoraFaseLinha[] {
  const meta = montarFasesCalculadoraEsteira(input.fasesPorKanban);
  if (meta.length === 0) return [];

  const segmentoCard = segmentoEsteiraCardCalculadora(input.cardKanbanId);
  const cardNaEsteira = cardKanbanNaEsteiraPrincipalCalculadora(input.cardKanbanId);
  const faseIdCalc = resolverFaseIdParaCalculo(
    input.card.fase_id,
    meta,
    segmentoCard,
    cardNaEsteira,
    input.cardFaseSlug,
  );

  const fasesGlobais: KanbanFase[] = meta.map((m) => ({
    ...m,
    ordem: m.ordemGlobal,
  }));

  const visits =
    cardNaEsteira && meta.some((m) => m.id === input.card.fase_id) ? input.visits : [];

  const linhas = calcularLinhasCalculadoraFases({
    fases: fasesGlobais,
    card: { ...input.card, fase_id: faseIdCalc },
    visits,
    hoje: input.hoje,
    slaCondominio: input.slaCondominio,
  });

  const comSegmento = aplicarRegrasSegmentoEsteira(linhas, meta, segmentoCard);
  const faseOrdemRelativa =
    meta.some((m) => m.id === input.card.fase_id) ? input.card.fase_id : faseIdCalc;
  const cardCalc = { ...input.card, fase_id: faseOrdemRelativa };
  const comOrdem = aplicarOrdemRelativaFaseAtual(comSegmento, meta, faseOrdemRelativa);
  const comInferencia = inferirFimRealPorProximaFase(comOrdem);
  const comAncora = aplicarAncoraCalculadoraLinhas(comInferencia, input.ancora, cardCalc, input.hoje);
  const comDatasManuais = aplicarDatasManuaisCalculadoraLinhas(
    comAncora,
    input.overrides ?? new Map(),
    cardCalc,
    input.hoje,
  );
  return normalizarIntervaloDatasCalculadoraLinhas(comDatasManuais, cardCalc, input.hoje);
}

/** Mescla fases já carregadas do kanban atual no mapa (fallback enquanto busca a esteira). */
export function mesclarFasesKanbanAtualNoMapa(
  map: Map<string, KanbanFase[]>,
  kanbanId: string,
  fasesAtuais: KanbanFase[],
): Map<string, KanbanFase[]> {
  const next = new Map(map);
  if (fasesAtuais.length > 0 && (CALCULADORA_ESTEIRA_KANBAN_IDS as readonly string[]).includes(kanbanId)) {
    const list = filtrarFasesCalculadoraEsteira(kanbanId, fasesAtuais);
    next.set(kanbanId, list);
  }
  return next;
}

/** Carrega fases ausentes do mapa via Supabase (uma query batch). */
export async function completarMapaCalculadoraEsteira(
  supabase: SupabaseClient,
  map: Map<string, KanbanFase[]>,
): Promise<Map<string, KanbanFase[]>> {
  const faltantes = CALCULADORA_ESTEIRA_KANBAN_IDS.filter((id) => !(map.get(id)?.length ?? 0));
  if (faltantes.length === 0) return map;

  const { data, error } = await supabase
    .from('kanban_fases')
    .select('id, nome, ordem, sla_dias, sla_tipo, slug, instrucoes, materiais, fase_conversao, ativo, kanban_id')
    .in('kanban_id', faltantes)
    .eq('ativo', true)
    .order('ordem');

  if (error) {
    console.error('[completarMapaCalculadoraEsteira]', error.message);
    return map;
  }

  const next = new Map(map);
  for (const row of data ?? []) {
    const kid = String((row as { kanban_id: string }).kanban_id);
    const list = next.get(kid) ?? [];
    list.push(mapKanbanFaseRow(row as Record<string, unknown>));
    next.set(kid, list);
  }

  if (next.has(KANBAN_IDS.STEP_ONE)) {
    next.set(KANBAN_IDS.STEP_ONE, filtrarFasesStepOne(next.get(KANBAN_IDS.STEP_ONE)!));
  }
  if (next.has(KANBAN_IDS.PORTFOLIO)) {
    next.set(KANBAN_IDS.PORTFOLIO, filtrarFasesPortfolio(next.get(KANBAN_IDS.PORTFOLIO)!));
  }
  if (next.has(KANBAN_IDS.OPERACOES)) {
    next.set(KANBAN_IDS.OPERACOES, filtrarFasesOperacoes(next.get(KANBAN_IDS.OPERACOES)!));
  }

  return next;
}
