import {
  arquivamentoPerdaAntesConversao,
  buildConversaoContext,
  cardConverteuPorRegras,
  classificarConversaoCard,
  type ConversaoContext,
} from '@/lib/kanban/painel-conversao-classify';
import {
  buildMotivoHistoricoPorCard,
  MOTIVO_ARQUIVAMENTO_SEM_INFORMADO,
  resolveMotivoArquivamento,
} from '@/lib/kanban/painel-motivo-arquivamento';
import type {
  PainelCardDTO,
  PainelChamadoUnificadoDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelPerformanceDataset,
  PainelRetrocessoDTO,
} from '@/lib/kanban/painel-performance-types';

export type PainelCardStatusFiltro = 'all' | 'ativo' | 'arquivado' | 'concluido';
export type PainelChamadosFiltro = 'all' | 'com' | 'sem';
export type PainelTravaFiltro = 'all' | 'com' | 'sem';
export type PainelArquivamentoFiltro = 'all' | 'antes_conversao' | 'depois_conversao';
export type PainelMotivoInformadoFiltro = 'all' | 'com' | 'sem';

export type PainelFiltrosState = {
  franquiaId: string | null;
  responsavelKey: string | null;
  /** Fase atual do card (ativos e demais). */
  faseId: string | null;
  status: PainelCardStatusFiltro;
  chamados: PainelChamadosFiltro;
  trava: PainelTravaFiltro;
  arquivamento: PainelArquivamentoFiltro;
  motivoArquivamento: string | null;
  motivoInformado: PainelMotivoInformadoFiltro;
  /** Fase em que o card estava ao ser arquivado. */
  faseArquivamentoId: string | null;
};

export const PAINEL_FILTROS_INICIAL: PainelFiltrosState = {
  franquiaId: null,
  responsavelKey: null,
  faseId: null,
  status: 'all',
  chamados: 'all',
  trava: 'all',
  arquivamento: 'all',
  motivoArquivamento: null,
  motivoInformado: 'all',
  faseArquivamentoId: null,
};

export type PainelFiltrosResult = {
  cards: PainelCardDTO[];
  cardsAnalise: PainelCardDTO[];
  chamados: PainelChamadoUnificadoDTO[];
  retrocessoRows: PainelRetrocessoDTO[];
  historicoMovimentos: PainelHistoricoMovimentoDTO[];
  historicoAnalise: PainelHistoricoMovimentoDTO[];
  /** Status = Ativos: arquivados entram só na conversão/perdas. */
  ocultandoArquivados: boolean;
};

function cardAtivo(c: PainelCardDTO): boolean {
  return !c.arquivado && !c.concluido;
}

function buildHistoricoPorCard(rows: PainelHistoricoMovimentoDTO[]): Map<string, PainelHistoricoMovimentoDTO[]> {
  const m = new Map<string, PainelHistoricoMovimentoDTO[]>();
  for (const r of rows) {
    const list = m.get(r.card_id) ?? [];
    list.push(r);
    m.set(r.card_id, list);
  }
  return m;
}

type ArquivamentoCtx = {
  conversaoCtx: ConversaoContext;
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>;
  motivoHistoricoPorCard: Map<string, string>;
};

function buildArquivamentoCtx(
  fases: PainelFaseDTO[],
  historico: PainelHistoricoMovimentoDTO[],
): ArquivamentoCtx {
  return {
    conversaoCtx: buildConversaoContext(fases),
    historicoPorCard: buildHistoricoPorCard(historico),
    motivoHistoricoPorCard: buildMotivoHistoricoPorCard(historico),
  };
}

export function filtrosArquivamentoAtivos(f: PainelFiltrosState): boolean {
  return (
    f.arquivamento !== 'all' ||
    f.motivoArquivamento != null ||
    f.motivoInformado !== 'all' ||
    f.faseArquivamentoId != null
  );
}

function cardPassaChamadosFiltro(
  cardId: string,
  filtro: PainelChamadosFiltro,
  porCard: Map<string, PainelChamadoUnificadoDTO[]>,
): boolean {
  if (filtro === 'all') return true;
  const abertos = (porCard.get(cardId) ?? []).some((c) => c.aberto);
  return filtro === 'com' ? abertos : !abertos;
}

function cardPassaTravaFiltro(
  cardId: string,
  filtro: PainelTravaFiltro,
  porCard: Map<string, PainelChamadoUnificadoDTO[]>,
): boolean {
  if (filtro === 'all') return true;
  const comTrava = (porCard.get(cardId) ?? []).some((c) => c.trava && c.aberto);
  return filtro === 'com' ? comTrava : !comTrava;
}

function cardPassaStatus(c: PainelCardDTO, status: PainelCardStatusFiltro): boolean {
  if (status === 'all') return true;
  if (status === 'ativo') return cardAtivo(c);
  if (status === 'arquivado') return c.arquivado;
  return c.concluido;
}

function cardPassaResponsavel(c: PainelCardDTO, key: string | null): boolean {
  if (!key) return true;
  if (key.startsWith('id:')) {
    return c.responsavel_fase_id === key.slice(3);
  }
  if (key.startsWith('nome:')) {
    const nome = key.slice(5);
    return (c.responsavel_fase_nome ?? '').trim() === nome;
  }
  return true;
}

function cardPassaFiltrosArquivamento(
  c: PainelCardDTO,
  filtros: PainelFiltrosState,
  ctx: ArquivamentoCtx,
): boolean {
  if (!c.arquivado) {
    return !filtrosArquivamentoAtivos(filtros);
  }

  if (filtros.faseArquivamentoId && c.fase_id !== filtros.faseArquivamentoId) {
    return false;
  }

  const cl = classificarConversaoCard(c, ctx.conversaoCtx);
  const perdaAntes = arquivamentoPerdaAntesConversao(cl);
  const converteu = cardConverteuPorRegras(c, ctx.conversaoCtx);

  if (filtros.arquivamento === 'antes_conversao' && !perdaAntes) return false;
  if (filtros.arquivamento === 'depois_conversao' && !converteu) return false;

  const motivo = resolveMotivoArquivamento(c, ctx.motivoHistoricoPorCard);
  const semMotivo = motivo === MOTIVO_ARQUIVAMENTO_SEM_INFORMADO;

  if (filtros.motivoInformado === 'com' && semMotivo) return false;
  if (filtros.motivoInformado === 'sem' && !semMotivo) return false;

  if (filtros.motivoArquivamento && motivo !== filtros.motivoArquivamento) {
    return false;
  }

  return true;
}

function filterCardsBase(
  cards: PainelCardDTO[],
  filtros: PainelFiltrosState,
  chamadosPorCard: Map<string, PainelChamadoUnificadoDTO[]>,
  ctx: ArquivamentoCtx,
  statusOverride?: PainelCardStatusFiltro,
): PainelCardDTO[] {
  const status = statusOverride ?? filtros.status;
  return cards.filter((c) => {
    if (filtros.franquiaId && c.rede_franqueado_id !== filtros.franquiaId) return false;
    if (filtros.faseId && c.fase_id !== filtros.faseId) return false;
    if (!cardPassaStatus(c, status)) return false;
    if (!cardPassaResponsavel(c, filtros.responsavelKey)) return false;
    if (!cardPassaChamadosFiltro(c.id, filtros.chamados, chamadosPorCard)) return false;
    if (!cardPassaTravaFiltro(c.id, filtros.trava, chamadosPorCard)) return false;
    if (!cardPassaFiltrosArquivamento(c, filtros, ctx)) return false;
    return true;
  });
}

function filterRelated<T extends { card_id?: string; cardId?: string }>(
  rows: T[],
  cardIds: Set<string>,
  idKey: 'card_id' | 'cardId',
): T[] {
  return rows.filter((r) => cardIds.has(String(r[idKey] ?? '')));
}

function buildResultForCardSets(
  dataset: PainelPerformanceDataset,
  cards: PainelCardDTO[],
  cardsAnalise: PainelCardDTO[],
  ocultandoArquivados: boolean,
): PainelFiltrosResult {
  const cardIds = new Set(cards.map((c) => c.id));
  const analiseIds = new Set(cardsAnalise.map((c) => c.id));

  return {
    cards,
    cardsAnalise,
    chamados: dataset.chamados.filter((ch) => cardIds.has(ch.cardId)),
    retrocessoRows: dataset.retrocessoRows.filter((r) => cardIds.has(r.card_id)),
    historicoMovimentos: dataset.historicoMovimentos.filter((h) => cardIds.has(h.card_id)),
    historicoAnalise: dataset.historicoMovimentos.filter((h) => analiseIds.has(h.card_id)),
    ocultandoArquivados,
  };
}

export function applyPainelFiltros(
  dataset: PainelPerformanceDataset,
  filtros: PainelFiltrosState,
): PainelFiltrosResult {
  const chamadosPorCard = new Map<string, PainelChamadoUnificadoDTO[]>();
  for (const ch of dataset.chamados) {
    const list = chamadosPorCard.get(ch.cardId) ?? [];
    list.push(ch);
    chamadosPorCard.set(ch.cardId, list);
  }

  const ctx = buildArquivamentoCtx(dataset.fases, dataset.historicoMovimentos);
  const cards = filterCardsBase(dataset.cards, filtros, chamadosPorCard, ctx);

  const ocultandoArquivados = filtros.status === 'ativo';
  let cardsAnalise = cards;

  if (ocultandoArquivados) {
    const arquivadosVisiveis = filterCardsBase(
      dataset.cards,
      filtros,
      chamadosPorCard,
      ctx,
      'arquivado',
    );
    const merged = new Map<string, PainelCardDTO>();
    for (const c of cards) merged.set(c.id, c);
    for (const c of arquivadosVisiveis) merged.set(c.id, c);
    cardsAnalise = [...merged.values()];
  }

  return buildResultForCardSets(dataset, cards, cardsAnalise, ocultandoArquivados);
}

export type PainelFiltrosOpcoes = {
  franquias: Array<{ id: string; label: string }>;
  responsaveis: Array<{ key: string; label: string }>;
  motivosArquivamento: Array<{ motivo: string; total: number }>;
  temFranquia: boolean;
};

export function buildPainelFiltrosOpcoes(dataset: PainelPerformanceDataset): PainelFiltrosOpcoes {
  const franqMap = new Map<string, string>();
  for (const c of dataset.cards) {
    const id = c.rede_franqueado_id?.trim();
    if (!id) continue;
    const label =
      [c.n_franquia, c.franqueado_rede_nome].filter(Boolean).join(' · ') || id.slice(0, 8);
    franqMap.set(id, label);
  }

  const respMap = new Map<string, string>();
  for (const c of dataset.cards) {
    const id = c.responsavel_fase_id?.trim();
    const nome = c.responsavel_fase_nome?.trim();
    if (id) respMap.set(`id:${id}`, nome || dataset.profiles[id] || 'Responsável');
    else if (nome) respMap.set(`nome:${nome}`, nome);
  }

  const motivoHistorico = buildMotivoHistoricoPorCard(dataset.historicoMovimentos);
  const motivoCount = new Map<string, number>();
  for (const c of dataset.cards) {
    if (!c.arquivado) continue;
    const motivo = resolveMotivoArquivamento(c, motivoHistorico);
    motivoCount.set(motivo, (motivoCount.get(motivo) ?? 0) + 1);
  }

  const franquias = [...franqMap.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  const responsaveis = [...respMap.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));

  const motivosArquivamento = [...motivoCount.entries()]
    .map(([motivo, total]) => ({ motivo, total }))
    .sort((a, b) => b.total - a.total);

  return { franquias, responsaveis, motivosArquivamento, temFranquia: franquias.length > 0 };
}

export function filtrosAtivos(f: PainelFiltrosState): boolean {
  return (
    f.franquiaId != null ||
    f.responsavelKey != null ||
    f.faseId != null ||
    f.status !== 'all' ||
    f.chamados !== 'all' ||
    f.trava !== 'all' ||
    filtrosArquivamentoAtivos(f)
  );
}
