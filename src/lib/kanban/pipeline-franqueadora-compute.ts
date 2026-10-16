import { computeGargaloScoreRanking } from '@/lib/kanban/painel-gargalo-score-compute';
import type {
  GargaloScoreFase,
  PainelCardDTO,
  PainelChamadoUnificadoDTO,
  PainelFaseDTO,
} from '@/lib/kanban/painel-performance-types';
import { calcularDiasNaFase, cardVenceEm2DiasUteis } from '@/lib/kanban/pipeline-card-readonly';
import type {
  PipelineCardBadgeStatus,
  PipelineCardDisplay,
  PipelineCardRow,
  PipelineCardsKpis,
  PipelineFranqueadoUnidade,
  PipelineFranqueadoraEnrichment,
  PipelineUnidadeAlertas,
  PipelineUnidadeBlocoMeta,
  PipelineUnidadeSaudeMes,
} from '@/lib/kanban/pipeline-cards-types';
import {
  cardElegivelMetricasSlaPipeline,
  enriquecerPipelineCard,
  slaCategoriaPipeline,
  labelFranqueadoPipeline,
} from '@/lib/kanban/pipeline-cards-utils';
import {
  cardVinculadoAoCadastroRedeFranqueados,
  excluirFranquiaDosGraficosVisaoGeral,
} from '@/lib/rede-visibilidade-franqueado';
import { indiceEsteiraTresEtapas } from '@/lib/kanban/pipeline-esteira-tres-etapas';
import { computeFunilMesCompact } from '@/lib/kanban/pipeline-funil-mes-compute';
import { isCardBlocoPrincipalUnidade } from '@/lib/kanban/pipeline-unidade-visualizacao';

export const PARADO_DIAS = 20;
const META_ENTRADAS_MES = 5;
const META_CONTRATOS_MES = 1;

export function cardsElegiveisFranqueadora(cards: PipelineCardDisplay[]): PipelineCardDisplay[] {
  return cards.filter(cardVinculadoAoCadastroRedeFranqueados);
}

/** Card do fluxo principal (Step One / Portfólio / Pré Obra e Obra) com tag «⭐Especial». */
export function cardTemTagEspecialFluxoPrincipal(card: PipelineCardRow): boolean {
  return card.tem_tag_especial === true && isCardBlocoPrincipalUnidade(card as PipelineCardDisplay);
}

/** Unidade com ≥1 card do fluxo principal com tag «⭐Especial». */
export function unidadeTemTagEspecialFluxoPrincipal(cards: PipelineCardRow[]): boolean {
  return cards.some(cardTemTagEspecialFluxoPrincipal);
}

/** Mapa rede_franqueado_id → unidade tem tag no fluxo principal. */
export function redeIdsComTagEspecialFluxoPrincipal(cards: PipelineCardRow[]): Set<string> {
  const ids = new Set<string>();
  for (const c of cards) {
    if (!cardTemTagEspecialFluxoPrincipal(c)) continue;
    const rid = String(c.rede_franqueado_id ?? '').trim();
    if (rid) ids.add(rid);
  }
  return ids;
}

function cardParado(card: PipelineCardDisplay): boolean {
  return calcularDiasNaFase(card) >= PARADO_DIAS && card.inativo;
}

const BADGE_SORT_PRIORITY: Record<PipelineCardBadgeStatus, number> = {
  atrasado: 0,
  parado: 1,
  alerta: 2,
  em_dia: 3,
};

export function sortCardsFranqueadoraPrioridade(cards: PipelineCardDisplay[]): PipelineCardDisplay[] {
  return [...cards].sort((a, b) => {
    const pa = BADGE_SORT_PRIORITY[badgeStatusPipelineCard(a)];
    const pb = BADGE_SORT_PRIORITY[badgeStatusPipelineCard(b)];
    if (pa !== pb) return pa - pb;
    if (pa <= 1) {
      const d = calcularDiasNaFase(b) - calcularDiasNaFase(a);
      if (d !== 0) return d;
    }
    const dKanban = a.kanban_nome.localeCompare(b.kanban_nome, 'pt-BR');
    if (dKanban !== 0) return dKanban;
    return (b.fase_ordem ?? 0) - (a.fase_ordem ?? 0);
  });
}

export function badgeStatusPipelineCard(card: PipelineCardDisplay): PipelineCardBadgeStatus {
  if (slaCategoriaPipeline(card) === 'atrasado') return 'atrasado';
  if (cardParado(card)) return 'parado';
  const cat = slaCategoriaPipeline(card);
  if (cat === 'vence_hoje' || cat === 'atencao_outros' || card.inativo) return 'alerta';
  return 'em_dia';
}

export function labelBadgeStatusPipeline(status: PipelineCardBadgeStatus): string {
  if (status === 'atrasado') return 'Atrasado';
  if (status === 'parado') return 'Parado';
  if (status === 'alerta') return 'Alerta';
  return 'Em dia';
}

export function tagClassBadgeStatusPipeline(status: PipelineCardBadgeStatus): string {
  if (status === 'atrasado') return 'moni-tag-atrasado';
  if (status === 'parado') return '';
  if (status === 'alerta') return 'moni-tag-atencao';
  return 'moni-tag-concluido';
}

function inicioMesUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function isNoMesAtual(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return false;
  const ini = inicioMesUtc();
  return d >= ini;
}

function mapCardPainel(c: PipelineCardDisplay): PainelCardDTO {
  return {
    id: c.id,
    titulo: c.titulo,
    fase_id: c.fase_id,
    created_at: c.created_at,
    updated_at: c.updated_at,
    entered_fase_at: c.entered_fase_at,
    franqueado_id: '',
    arquivado: c.arquivado,
    arquivado_em: null,
    concluido: c.concluido,
    concluido_em: null,
    status: 'ativo',
    rede_franqueado_id: c.rede_franqueado_id,
    n_franquia: c.n_franquia,
    contrato_assinado: c.contrato_assinado ?? false,
    contrato_assinado_em: c.contrato_assinado_em ?? null,
  };
}

function cardAtrasadoNaFase(card: PipelineCardDisplay, fase: PainelFaseDTO): boolean {
  if (card.fase_id !== fase.id) return false;
  return slaCategoriaPipeline(card) === 'atrasado';
}

export function computeGargaloRankingRede(
  cards: PipelineCardDisplay[],
  enrichment: PipelineFranqueadoraEnrichment | null | undefined,
): GargaloScoreFase[] {
  if (!enrichment?.fases.length) return enrichment?.gargaloRanking ?? [];

  const elegiveis = cardsElegiveisFranqueadora(cards);
  const painelCards = elegiveis.map(mapCardPainel);

  const chamadosPorFase = new Map<
    string,
    { abertos: number; comTrava: number; atrasados: number }
  >();
  for (const f of enrichment.fases) {
    chamadosPorFase.set(f.id, { abertos: 0, comTrava: 0, atrasados: 0 });
  }
  const cardById = new Map(elegiveis.map((c) => [c.id, c]));
  for (const ch of enrichment.chamados) {
    const card = cardById.get(ch.cardId);
    if (!card) continue;
    const row = chamadosPorFase.get(card.fase_id);
    if (!row) continue;
    if (ch.aberto) row.abertos += 1;
    if (ch.trava && ch.aberto) row.comTrava += 1;
    if (ch.vencido) row.atrasados += 1;
  }

  return computeGargaloScoreRanking({
    fases: enrichment.fases,
    cards: painelCards,
    historicoMovimentos: [],
    chamadosAbertosPorFase: chamadosPorFase,
    perdaConversaoPorFase: new Map(),
    arquivamentoPorFase: new Map(),
    totalArquivadosPeriodo: 0,
    totalArquivamentosAntesConversao: 0,
    totalArquivamentosSemMotivo: 0,
    totalChamadosComTrava: enrichment.chamados.filter((c) => c.trava && c.aberto).length,
    cardAtrasadoNaFase: (card, fase) => {
      const disp = cardById.get(card.id);
      return disp ? cardAtrasadoNaFase(disp, fase) : false;
    },
    cardSemMovimentacaoFn: (card) => {
      const disp = cardById.get(card.id);
      return disp ? disp.inativo : false;
    },
  });
}

export function calcularKpisPipelineFranqueadoraExtended(
  cards: PipelineCardDisplay[],
  enrichment: PipelineFranqueadoraEnrichment | null | undefined,
): PipelineCardsKpis {
  const elegiveis = cardsElegiveisFranqueadora(cards);
  const elegiveisSla = elegiveis.filter(cardElegivelMetricasSlaPipeline);
  const ranking =
    enrichment?.gargaloRanking?.length
      ? enrichment.gargaloRanking
      : computeGargaloRankingRede(cards, enrichment);

  const gargalosCriticos = ranking.filter((g) => g.score > 70).length;
  const cardIds = new Set(elegiveis.map((c) => c.id));
  const chamadosComTrava = (enrichment?.chamados ?? []).filter(
    (c) => c.trava && c.aberto && cardIds.has(c.cardId),
  ).length;

  return {
    cardsAtivos: elegiveis.length,
    cardsAtrasados: elegiveisSla.filter((c) => slaCategoriaPipeline(c) === 'atrasado').length,
    cardsSemMovimentacao: elegiveisSla.filter((c) => c.inativo).length,
    cardsVencendoEmBreve: elegiveis.filter((c) => {
      const cat = slaCategoriaPipeline(c);
      return cat === 'atencao_outros' || cat === 'vence_hoje';
    }).length,
    gargalosCriticos,
    chamadosComTrava,
  };
}

export function alertasUnidadePipeline(
  cards: PipelineCardDisplay[],
  chamados: PainelChamadoUnificadoDTO[],
): PipelineUnidadeAlertas {
  const cardIds = new Set(cards.map((c) => c.id));
  const atrasados = cards
    .filter(cardElegivelMetricasSlaPipeline)
    .filter((c) => slaCategoriaPipeline(c) === 'atrasado').length;
  const parados = cards.filter((c) => cardParado(c)).length;
  const chamadosTrava = chamados.filter((c) => c.trava && c.aberto && cardIds.has(c.cardId)).length;
  const venceEm2Dias = cards.filter((c) => cardVenceEm2DiasUteis(c)).length;

  let nivel: PipelineUnidadeAlertas['nivel'] = 'ok';
  if (atrasados > 0 || parados > 0 || chamadosTrava > 0) nivel = 'critico';
  else if (cards.some((c) => c.inativo || badgeStatusPipelineCard(c) === 'alerta')) nivel = 'atencao';

  return { atrasados, parados, chamadosTrava, venceEm2Dias, nivel };
}

export type PipelineSaudeIndicador = 'vermelho' | 'amarelo' | 'verde';

export function indicadorSaudeUnidadePipeline(
  alertas: PipelineUnidadeAlertas,
  saude: PipelineUnidadeSaudeMes,
): PipelineSaudeIndicador {
  if (alertas.atrasados > 0 || alertas.chamadosTrava > 0) return 'vermelho';
  const metas = {
    entradas: saude.entradasMes >= saude.metaEntradas,
    contratos: saude.contratosMes >= saude.metaContratos,
  };
  if (!metas.entradas || !metas.contratos) return 'amarelo';
  return 'verde';
}

export function emojiIndicadorSaudePipeline(indicador: PipelineSaudeIndicador): string {
  if (indicador === 'vermelho') return '🔴';
  if (indicador === 'amarelo') return '🟡';
  return '🟢';
}

export function saudeMesUnidadePipeline(cards: PipelineCardDisplay[]): PipelineUnidadeSaudeMes {
  let entradasMes = 0;
  let contratosMes = 0;
  for (const c of cards) {
    if (isNoMesAtual(c.created_at)) entradasMes += 1;
    if (c.contrato_assinado && isNoMesAtual(c.contrato_assinado_em)) contratosMes += 1;
  }
  return {
    entradasMes,
    contratosMes,
    metaEntradas: META_ENTRADAS_MES,
    metaContratos: META_CONTRATOS_MES,
  };
}

export function montarBlocoMetaUnidadePipeline(
  franqueado: PipelineFranqueadoUnidade,
  cards: PipelineCardDisplay[],
  chamados: PainelChamadoUnificadoDTO[],
  options?: { defaultExpanded?: boolean },
): PipelineUnidadeBlocoMeta {
  const alertas = alertasUnidadePipeline(cards, chamados);
  const saude = saudeMesUnidadePipeline(cards);
  const funilMes = computeFunilMesCompact(cards);
  const sortPriority =
    alertas.nivel === 'critico' ? 0 : alertas.nivel === 'atencao' ? 1 : 2;
  const temTagEspecial = unidadeTemTagEspecialFluxoPrincipal(cards);
  return {
    redeId: franqueado.rede_franqueado_id,
    label: labelFranqueadoPipeline(franqueado),
    nFranquia: franqueado.n_franquia,
    alertas,
    saude,
    funilMes,
    defaultExpanded: options?.defaultExpanded ?? false,
    sortPriority,
    temTagEspecial,
  };
}

export function montarBlocosUnidadePipeline(
  franqueados: PipelineFranqueadoUnidade[],
  cards: PipelineCardDisplay[],
  chamados: PainelChamadoUnificadoDTO[],
): PipelineUnidadeBlocoMeta[] {
  const porRede = new Map<string, PipelineCardDisplay[]>();
  for (const c of cards) {
    const rid = String(c.rede_franqueado_id ?? '').trim();
    if (!rid) continue;
    const list = porRede.get(rid) ?? [];
    list.push(c);
    porRede.set(rid, list);
  }

  const blocos: PipelineUnidadeBlocoMeta[] = [];

  for (const f of franqueados) {
    if (excluirFranquiaDosGraficosVisaoGeral(f.n_franquia)) continue;
    const unitCards = porRede.get(f.rede_franqueado_id) ?? [];
    if (unitCards.length === 0) continue;
    blocos.push(montarBlocoMetaUnidadePipeline(f, unitCards, chamados));
  }

  blocos.sort(
    (a, b) =>
      Number(b.temTagEspecial) - Number(a.temTagEspecial) ||
      b.alertas.atrasados - a.alertas.atrasados ||
      b.alertas.chamadosTrava - a.alertas.chamadosTrava ||
      a.sortPriority - b.sortPriority ||
      a.label.localeCompare(b.label, 'pt-BR'),
  );
  return blocos;
}
