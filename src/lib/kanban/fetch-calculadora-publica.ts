import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanFase } from '@/components/kanban-shared/types';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  calcularLinhasCalculadoraFases,
  calculadoraAncoraFromProcesso,
  aplicarEncadeamentoMarcoContratoNasLinhas,
  aplicarDatasManuaisCalculadoraLinhas,
  aplicarOverlayAncoraOcultarFasesAnteriores,
  enriquecerLinhasCalculadoraComCusto,
  enriquecerLinhasCalculadoraComResponsavelDaFase,
  normalizarIntervaloDatasCalculadoraLinhas,
  type CalculadoraFaseLinha,
  type CalculadoraResumoExecutivo,
} from '@/lib/kanban/calculadora-fases';
import type { CalculadoraMarcosInput } from '@/lib/kanban/calculadora-fases-marcos';
import { calculadoraMarcosInputFromProcessoRow } from '@/lib/kanban/calculadora-fases-marcos';
import { parseNegociacaoLinhasFromDb, type NegociacaoLinha } from '@/lib/kanban/negociacao-linhas';
import {
  CALCULADORA_ESTEIRA_KANBAN_IDS,
  calcularLinhasCalculadoraFasesEsteira,
  calcularResumoExecutivoCalculadoraSyncGroup,
  fetchCalculadoraEsteiraFasesMap,
  mesclarFasesKanbanAtualNoMapa,
} from '@/lib/kanban/calculadora-fases-esteira';
import { buscarDatasManuaisCalculadoraSyncGroup } from '@/lib/kanban/calculadora-fase-datas';
import { fetchContextoCalculadoraSyncGroup } from '@/lib/kanban/card-sync-group';
import { fetchKanbanFasesAtivas } from '@/lib/kanban/fetch-kanban-fases';
import { buildVisitsCalculadoraEsteiraSyncGroup } from '@/lib/kanban/kanban-card-historico';
import { filterOperacoesCalculadoraFases } from '@/lib/kanban/operacoes-fase-slugs';
import { filterPortfolioCalculadoraFases } from '@/lib/kanban/portfolio-fase-slugs';
import { buscarResponsavelDaFaseSalvoPorFases } from '@/lib/kanban/responsavel-fase-checklist';
import { filterStepOneCalculadoraFases } from '@/lib/kanban/stepone-fase-slugs';
import { fetchCondominioRowById } from '@/lib/condominios';
import { condominioPrazosSlaFromRow } from '@/lib/kanban/condominio-prazos-aprovacao';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type CalculadoraPublicaCard = {
  id: string;
  titulo: string;
  kanban_id: string;
  fase_id: string;
  created_at: string;
  entered_fase_at: string | null;
  concluido: boolean;
  concluido_em: string | null;
  contrato_assinado_em: string | null;
  obra_iniciada_em: string | null;
  obra_finalizada_em: string | null;
  opcao_assinada_em: string | null;
  processo_step_one_id: string | null;
  condominio_id: string | null;
};

export type CalculadoraPublicaPack = {
  card: CalculadoraPublicaCard;
  linhas: CalculadoraFaseLinha[];
  resumo: CalculadoraResumoExecutivo;
  faseAtualIdCanonico: string;
  cardConcluidoCanonico: boolean;
  fasesFlat: KanbanFase[];
  fasesMeta: Map<string, KanbanFase>;
  marcos: CalculadoraMarcosInput;
  negociacaoLinhas: NegociacaoLinha[];
};

/** Resolve card_id via RPC pública (anon). */
export async function resolveCalculadoraCardIdByToken(token: string): Promise<string | null> {
  const trimmed = String(token ?? '').trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_card_id_by_calculadora_token', {
    p_token: trimmed,
  });

  if (error) {
    console.error('[resolveCalculadoraCardIdByToken]', error.message);
    return null;
  }

  const id = String(data ?? '').trim();
  return id || null;
}

function buildSlugPorFaseId(fases: KanbanFase[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of fases) {
    const slug = String(f.slug ?? '').trim();
    if (slug) map.set(f.id, slug);
  }
  return map;
}

async function montarCalculadoraPack(
  supabase: SupabaseClient,
  card: CalculadoraPublicaCard,
): Promise<CalculadoraPublicaPack | null> {
  const kanbanId = String(card.kanban_id ?? '').trim();
  if (!kanbanId) return null;

  const ctx = await fetchContextoCalculadoraSyncGroup(supabase, card.id);
  const kanbanIdCalc = ctx?.kanbanIdCanonico ?? kanbanId;

  const [fasesEsteiraMap, fasesKanban, visits] = await Promise.all([
    fetchCalculadoraEsteiraFasesMap(supabase),
    fetchKanbanFasesAtivas(supabase, kanbanId),
    buildVisitsCalculadoraEsteiraSyncGroup(supabase, card.id, 'nativo', new Map()),
  ]);

  const fasesMap = mesclarFasesKanbanAtualNoMapa(fasesEsteiraMap, kanbanId, fasesKanban);

  const cardFaseSlug =
    ctx?.faseSlugCanonico ??
    fasesKanban.find((f) => f.id === card.fase_id)?.slug ??
    null;

  let calculadoraAncora = calculadoraAncoraFromProcesso(null);
  const procIdAncora = String(card.processo_step_one_id ?? '').trim();
  if (procIdAncora) {
    const { data: procAncora } = await supabase
      .from('processo_step_one')
      .select('calculadora_ancora_fase_slug, calculadora_ancora_data_fim')
      .eq('id', procIdAncora)
      .maybeSingle();
    calculadoraAncora = calculadoraAncoraFromProcesso(
      (procAncora as Record<string, unknown> | null) ?? null,
    );
  }

  const faseIdsPreCalc = (() => {
    const ids: string[] = [];
    for (const kid of CALCULADORA_ESTEIRA_KANBAN_IDS) {
      for (const f of fasesMap.get(kid) ?? []) ids.push(f.id);
    }
    if (ids.length === 0) {
      for (const f of fasesKanban) ids.push(f.id);
    }
    return ids;
  })();

  const overrides = await buscarDatasManuaisCalculadoraSyncGroup(supabase, card.id, faseIdsPreCalc);

  const condominioId =
    ctx?.condominioIdCanonico?.trim() || String(card.condominio_id ?? '').trim() || null;
  let slaCondominio = null;
  if (condominioId) {
    const condominioRow = await fetchCondominioRowById(supabase, condominioId);
    slaCondominio = condominioPrazosSlaFromRow(condominioRow);
  }

  const cardCalcInput = ctx
    ? ctx.cardCalcCanonico
    : {
        fase_id: card.fase_id,
        created_at: card.created_at,
        entered_fase_at: card.entered_fase_at,
        concluido: card.concluido,
        concluido_em: card.concluido_em,
      };

  const linhasEsteira = calcularLinhasCalculadoraFasesEsteira({
    fasesPorKanban: fasesMap,
    cardKanbanId: kanbanIdCalc,
    cardFaseSlug,
    card: cardCalcInput,
    visits,
    ancora: calculadoraAncora,
    overrides,
    slaCondominio,
  });

  let linhas = linhasEsteira;

  if (linhas.length === 0 && fasesKanban.length > 0) {
    const fasesCalculadora =
      kanbanId === KANBAN_IDS.STEP_ONE
        ? filterStepOneCalculadoraFases(fasesKanban)
        : kanbanId === KANBAN_IDS.PORTFOLIO
          ? filterPortfolioCalculadoraFases(fasesKanban)
          : kanbanId === KANBAN_IDS.OPERACOES
            ? filterOperacoesCalculadoraFases(fasesKanban)
            : fasesKanban;

    linhas = calcularLinhasCalculadoraFases({
      fases: fasesCalculadora,
      card: cardCalcInput,
      visits,
      ancora: calculadoraAncora,
      overrides,
      slaCondominio,
    });
  }

  const fasesFlat: KanbanFase[] = [];
  for (const kid of CALCULADORA_ESTEIRA_KANBAN_IDS) {
    fasesFlat.push(...(fasesMap.get(kid) ?? []));
  }
  const fasesFlatFinal =
    fasesFlat.length > 0
      ? fasesFlat
      : kanbanId === KANBAN_IDS.STEP_ONE
        ? filterStepOneCalculadoraFases(fasesKanban)
        : kanbanId === KANBAN_IDS.PORTFOLIO
          ? filterPortfolioCalculadoraFases(fasesKanban)
          : kanbanId === KANBAN_IDS.OPERACOES
            ? filterOperacoesCalculadoraFases(fasesKanban)
            : fasesKanban;

  linhas = normalizarIntervaloDatasCalculadoraLinhas(
    (() => {
      const encadeadas = aplicarEncadeamentoMarcoContratoNasLinhas(
        linhas,
        fasesFlatFinal,
        {
          contrato_assinado_em:
            ctx?.marcosCanonicos.contrato_assinado_em ?? card.contrato_assinado_em,
        },
        cardCalcInput,
        visits,
        undefined,
        overrides,
      );
      const comOverlay = aplicarOverlayAncoraOcultarFasesAnteriores(encadeadas, calculadoraAncora);
      return overrides.size > 0
        ? aplicarDatasManuaisCalculadoraLinhas(comOverlay, overrides, cardCalcInput)
        : comOverlay;
    })(),
    cardCalcInput,
  );

  const fasesMeta = new Map<string, KanbanFase>();
  for (const f of fasesFlatFinal) fasesMeta.set(f.id, f);
  for (const f of fasesKanban) fasesMeta.set(f.id, f);

  const slugPorFaseId = buildSlugPorFaseId(Array.from(fasesMeta.values()));
  const faseIds = linhas.map((l: CalculadoraFaseLinha) => l.faseId).filter(Boolean);
  const salvoPorFase = await buscarResponsavelDaFaseSalvoPorFases(supabase, card.id, faseIds);

  const linhasEnriquecidas = enriquecerLinhasCalculadoraComCusto(
    enriquecerLinhasCalculadoraComResponsavelDaFase(linhas, slugPorFaseId, salvoPorFase),
    slugPorFaseId,
  );

  const marcosBase: Omit<CalculadoraMarcosInput, 'prazo_opcao' | 'prazo_instrumento_garantidor'> = {
    contrato_assinado_em:
      ctx?.marcosCanonicos.contrato_assinado_em ?? card.contrato_assinado_em,
    obra_iniciada_em: ctx?.marcosCanonicos.obra_iniciada_em ?? card.obra_iniciada_em,
    obra_finalizada_em: ctx?.marcosCanonicos.obra_finalizada_em ?? card.obra_finalizada_em,
    concluido_em: ctx?.marcosCanonicos.concluido_em ?? card.concluido_em,
    opcao_assinada_em: ctx?.marcosCanonicos.opcao_assinada_em ?? card.opcao_assinada_em,
    visits,
  };

  let marcos: CalculadoraMarcosInput = { ...marcosBase, prazo_opcao: null, prazo_instrumento_garantidor: null };
  let negociacaoLinhas: NegociacaoLinha[] = [];
  const procId = String(card.processo_step_one_id ?? '').trim();
  if (procId) {
    const { data: procRow } = await supabase
      .from('processo_step_one')
      .select(
        'negociacao_linhas, tipo_aquisicao_terreno, prazo_opcao_dias, prazo_opcao_sla_tipo, prazo_opcao_modo, prazo_opcao_fase_id, prazo_opcao_data, prazo_instrumento_garantidor_dias, prazo_instrumento_garantidor_sla_tipo, prazo_instrumento_garantidor_modo, prazo_instrumento_garantidor_fase_id, prazo_instrumento_garantidor_data, calculadora_ancora_fase_slug, calculadora_ancora_data_fim',
      )
      .eq('id', procId)
      .maybeSingle();
    if (procRow) {
      negociacaoLinhas = parseNegociacaoLinhasFromDb(
        (procRow as Record<string, unknown>).negociacao_linhas,
      );
      marcos = calculadoraMarcosInputFromProcessoRow(procRow as Record<string, unknown>, marcosBase);
    }
  }

  const resumo = calcularResumoExecutivoCalculadoraSyncGroup(linhasEnriquecidas, ctx, {
    cardConcluido: cardCalcInput.concluido,
    visits,
    ancora: calculadoraAncora,
  });

  return {
    card,
    linhas: linhasEnriquecidas,
    resumo,
    faseAtualIdCanonico: ctx?.faseIdCanonico ?? card.fase_id,
    cardConcluidoCanonico: cardCalcInput.concluido === true,
    fasesFlat: fasesFlatFinal,
    fasesMeta,
    marcos,
    negociacaoLinhas,
  };
}

/** Carrega calculadora pública após validar token (service role para dados do card). */
export async function fetchCalculadoraPublicaByToken(
  token: string,
): Promise<CalculadoraPublicaPack | null> {
  const cardId = await resolveCalculadoraCardIdByToken(token);
  if (!cardId) return null;

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error('[fetchCalculadoraPublicaByToken] admin client', e);
    return null;
  }

  const { data: row, error } = await admin
    .from('kanban_cards')
    .select(
      'id, titulo, kanban_id, fase_id, created_at, entered_fase_at, concluido, concluido_em, contrato_assinado_em, obra_iniciada_em, obra_finalizada_em, opcao_assinada_em, processo_step_one_id, condominio_id, status',
    )
    .eq('id', cardId)
    .eq('status', 'ativo')
    .maybeSingle();

  if (error || !row) {
    if (error) console.error('[fetchCalculadoraPublicaByToken]', error.message);
    return null;
  }

  const card: CalculadoraPublicaCard = {
    id: String(row.id),
    titulo: String(row.titulo ?? '').trim() || '(sem título)',
    kanban_id: String(row.kanban_id ?? ''),
    fase_id: String(row.fase_id ?? ''),
    created_at: String(row.created_at ?? ''),
    entered_fase_at: row.entered_fase_at != null ? String(row.entered_fase_at) : null,
    concluido: Boolean(row.concluido),
    concluido_em: row.concluido_em != null ? String(row.concluido_em) : null,
    contrato_assinado_em:
      row.contrato_assinado_em != null ? String(row.contrato_assinado_em) : null,
    obra_iniciada_em:
      row.obra_iniciada_em != null ? String(row.obra_iniciada_em) : null,
    obra_finalizada_em:
      row.obra_finalizada_em != null ? String(row.obra_finalizada_em) : null,
    opcao_assinada_em:
      row.opcao_assinada_em != null ? String(row.opcao_assinada_em) : null,
    processo_step_one_id:
      row.processo_step_one_id != null ? String(row.processo_step_one_id).trim() || null : null,
    condominio_id: row.condominio_id != null ? String(row.condominio_id).trim() || null : null,
  };

  return montarCalculadoraPack(admin, card);
}
