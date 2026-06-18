import { calcularDiasUteis, calcularStatusSLA } from '@/lib/dias-uteis';
import { computePainelChamados } from '@/lib/kanban/painel-chamados-compute';
import { computeConversionFunnelTree } from '@/lib/kanban/painel-funnel-tree-compute';
import { computeGargaloScoreRanking } from '@/lib/kanban/painel-gargalo-score-compute';
import { computePainelInsights } from '@/lib/kanban/painel-insights-compute';
import {
  buildMotivoHistoricoPorCard,
  computeMotivosArquivamento,
  MOTIVO_ARQUIVAMENTO_SEM_INFORMADO,
} from '@/lib/kanban/painel-motivo-arquivamento';
import { buildQualidadeMotivoArquivamento } from '@/lib/kanban/painel-qualidade-dados';
import {
  arquivamentoNaConversao,
  arquivamentoPerdaAntesConversao,
  arquivamentoPosConversao,
  buildConversaoContext,
  cardConverteuPorRegras,
  classificarConversaoCard,
} from '@/lib/kanban/painel-conversao-classify';
import type {
  PainelAtividadeDTO,
  PainelCardDTO,
  PainelChamadoUnificadoDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelPerformanceResult,
  PainelPeriodKey,
  PainelRetrocessoDTO,
} from '@/lib/kanban/painel-performance-types';

export function periodSinceMs(key: PainelPeriodKey): number | null {
  if (key === 'all') return null;
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 90;
  return Date.now() - days * 86400000;
}

/** Card entrou no recorte temporal (criação, conclusão ou arquivamento no período). */
export function cardInPeriod(c: PainelCardDTO, sinceMs: number | null): boolean {
  if (sinceMs === null) return true;
  const cr = new Date(c.created_at).getTime();
  if (Number.isFinite(cr) && cr >= sinceMs) return true;
  if (c.concluido_em) {
    const cl = new Date(c.concluido_em).getTime();
    if (Number.isFinite(cl) && cl >= sinceMs) return true;
  }
  if (c.arquivado && c.arquivado_em) {
    const ar = new Date(c.arquivado_em).getTime();
    if (Number.isFinite(ar) && ar >= sinceMs) return true;
  }
  return false;
}

/** Card arquivado teve movimentação registrada no período. */
export function cardTeveMovimentacaoNoPeriodo(
  cardId: string,
  sinceMs: number,
  historicoAnalisePorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): boolean {
  for (const h of historicoAnalisePorCard.get(cardId) ?? []) {
    const t = new Date(h.criado_em).getTime();
    if (Number.isFinite(t) && t >= sinceMs) return true;
  }
  return false;
}

/**
 * Card entra na análise do funil no período:
 * - ativos/concluídos: criação ou conclusão no período;
 * - arquivados: também arquivamento ou movimentação no período.
 */
export function cardInAnalysisPeriod(
  c: PainelCardDTO,
  sinceMs: number | null,
  historicoAnalisePorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): boolean {
  if (sinceMs === null) return true;
  if (cardInPeriod(c, sinceMs)) return true;
  if (!c.arquivado) return false;
  return cardTeveMovimentacaoNoPeriodo(c.id, sinceMs, historicoAnalisePorCard);
}

export function atividadeInPeriod(a: PainelAtividadeDTO, sinceMs: number | null): boolean {
  if (sinceMs === null) return true;
  const t = new Date(a.created_at).getTime();
  return Number.isFinite(t) && t >= sinceMs;
}

export function hojeMeiaNoite(): Date {
  const h = new Date();
  h.setHours(0, 0, 0, 0);
  return h;
}

export function diasUteisDecorridos(createdAt: string): number {
  const criacao = new Date(createdAt);
  criacao.setHours(0, 0, 0, 0);
  return calcularDiasUteis(criacao, hojeMeiaNoite());
}

export type RetrocessoAgg = {
  cardId: string;
  titulo: string;
  count: number;
  fasesLabel: string;
};

export function aggregateRetrocesso(
  rows: PainelRetrocessoDTO[],
  tituloByCardId: Map<string, string>,
): RetrocessoAgg[] {
  const m = new Map<string, { count: number; lastLabel: string }>();
  for (const r of rows) {
    const d = r.detalhe;
    const label =
      d?.fase_anterior_nome && d?.fase_nova_nome
        ? `${d.fase_anterior_nome} → ${d.fase_nova_nome}`
        : 'Retrocesso de fase';
    const cur = m.get(r.card_id) ?? { count: 0, lastLabel: label };
    cur.count += 1;
    cur.lastLabel = label;
    m.set(r.card_id, cur);
  }
  return [...m.entries()]
    .map(([cardId, v]) => ({
      cardId,
      titulo: tituloByCardId.get(cardId) ?? 'Card',
      count: v.count,
      fasesLabel: v.lastLabel,
    }))
    .sort((a, b) => b.count - a.count);
}

export function isDuvidaTipo(tipo: string | null | undefined): boolean {
  const t = String(tipo ?? '')
    .trim()
    .toLowerCase();
  return t === 'duvida' || t === 'dúvida';
}

export function atividadeAtrasada(a: PainelAtividadeDTO): boolean {
  const st = String(a.status ?? '').toLowerCase();
  if (st === 'concluida' || st === 'cancelada') return false;
  if (!a.data_vencimento) return false;
  const d = new Date(`${a.data_vencimento}T23:59:59`);
  return Number.isFinite(d.getTime()) && d.getTime() < Date.now();
}

export function buildFaseMaps(
  fases: PainelFaseDTO[],
  cardsAtivosFunil: PainelCardDTO[],
): {
  totalPorFase: Map<string, number>;
  atrasadosPorFase: Map<string, number>;
  tempoMedioDiasPorFase: Map<string, number>;
  diasUteisMedioPorFase: Map<string, number>;
  slaPorFase: Map<string, number>;
} {
  const faseById = new Map(fases.map((f) => [f.id, f]));
  const totalPorFase = new Map<string, number>();
  const atrasadosPorFase = new Map<string, number>();
  const somaDiasPorFase = new Map<string, number>();
  const somaDuPorFase = new Map<string, number>();
  const slaPorFase = new Map<string, number>();

  for (const f of fases) {
    totalPorFase.set(f.id, 0);
    atrasadosPorFase.set(f.id, 0);
    somaDiasPorFase.set(f.id, 0);
    somaDuPorFase.set(f.id, 0);
    slaPorFase.set(f.id, f.sla_dias ?? 0);
  }

  for (const c of cardsAtivosFunil) {
    const fid = c.fase_id;
    totalPorFase.set(fid, (totalPorFase.get(fid) ?? 0) + 1);
    const fase = faseById.get(fid);
    const slaDias = fase?.sla_dias ?? 999;
    const created = new Date(c.created_at);
    if (Number.isFinite(created.getTime()) && calcularStatusSLA(created, slaDias).status === 'atrasado') {
      atrasadosPorFase.set(fid, (atrasadosPorFase.get(fid) ?? 0) + 1);
    }
    const diasCal = (Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (Number.isFinite(diasCal)) {
      somaDiasPorFase.set(fid, (somaDiasPorFase.get(fid) ?? 0) + diasCal);
    }
    const du = diasUteisDecorridos(c.created_at);
    somaDuPorFase.set(fid, (somaDuPorFase.get(fid) ?? 0) + du);
  }

  const tempoMedioDiasPorFase = new Map<string, number>();
  const diasUteisMedioPorFase = new Map<string, number>();
  for (const f of fases) {
    const n = totalPorFase.get(f.id) ?? 0;
    tempoMedioDiasPorFase.set(f.id, n > 0 ? (somaDiasPorFase.get(f.id) ?? 0) / n : 0);
    diasUteisMedioPorFase.set(f.id, n > 0 ? (somaDuPorFase.get(f.id) ?? 0) / n : 0);
  }

  return { totalPorFase, atrasadosPorFase, tempoMedioDiasPorFase, diasUteisMedioPorFase, slaPorFase };
}

export { computeConversionFunnelTree } from '@/lib/kanban/painel-funnel-tree-compute';
export { computeGargaloScoreRanking } from '@/lib/kanban/painel-gargalo-score-compute';
export { computePainelChamados } from '@/lib/kanban/painel-chamados-compute';
export { computePainelInsights, PAINEL_INSIGHT_TIPO_LABEL } from '@/lib/kanban/painel-insights-compute';

function detStr(d: Record<string, unknown> | null | undefined, key: string): string {
  if (!d) return '';
  const v = d[key];
  return typeof v === 'string' ? v.trim() : '';
}

function cardAtivo(c: PainelCardDTO): boolean {
  return !c.arquivado && !c.concluido;
}

function diasNaFaseAtual(c: PainelCardDTO): number {
  const ref = c.entered_fase_at ?? c.updated_at ?? c.created_at;
  return diasUteisDecorridos(ref);
}

function slaCardNaFase(c: PainelCardDTO, fase: PainelFaseDTO | undefined): 'ok' | 'atencao' | 'atrasado' | 'sem_sla' {
  if (!fase?.sla_dias || fase.sla_dias >= 999) return 'sem_sla';
  const ref = c.entered_fase_at ?? c.created_at;
  const st = calcularStatusSLA(new Date(ref), fase.sla_dias).status;
  return st;
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

function cardVisitouFase(
  card: PainelCardDTO,
  faseId: string,
  historicoAnalisePorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): boolean {
  if (card.fase_id === faseId) return true;
  for (const h of historicoAnalisePorCard.get(card.id) ?? []) {
    const d = h.detalhe;
    if (detStr(d, 'fase_nova_id') === faseId || detStr(d, 'fase_anterior_id') === faseId) return true;
    if (detStr(d, 'fase_id') === faseId) return true;
  }
  return false;
}

function maxOrdemAlcancada(
  card: PainelCardDTO,
  faseById: Map<string, PainelFaseDTO>,
  historicoAnalisePorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): number {
  let max = faseById.get(card.fase_id)?.ordem ?? 0;
  for (const h of historicoAnalisePorCard.get(card.id) ?? []) {
    const d = h.detalhe;
    for (const key of ['fase_nova_id', 'fase_anterior_id', 'fase_id'] as const) {
      const fid = detStr(d, key);
      if (!fid) continue;
      const ord = faseById.get(fid)?.ordem;
      if (ord != null && ord > max) max = ord;
    }
  }
  return max;
}

function cardAlcancouFaseOrdem(
  card: PainelCardDTO,
  fase: PainelFaseDTO,
  faseById: Map<string, PainelFaseDTO>,
  historicoAnalisePorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): boolean {
  if (cardVisitouFase(card, fase.id, historicoAnalisePorCard)) return true;
  return maxOrdemAlcancada(card, faseById, historicoAnalisePorCard) >= fase.ordem;
}

function historicoOrdenado(rows: PainelHistoricoMovimentoDTO[]): PainelHistoricoMovimentoDTO[] {
  return [...rows].sort(
    (a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime(),
  );
}

function eventoEntrouConversao(
  faseId: string,
  convFaseIds: Set<string>,
  maxConvOrdem: number | null,
  faseById: Map<string, PainelFaseDTO>,
): boolean {
  if (convFaseIds.has(faseId)) return true;
  if (maxConvOrdem == null) return false;
  const ord = faseById.get(faseId)?.ordem;
  return ord != null && ord > maxConvOrdem;
}

function dataPrimeiraConversao(
  card: PainelCardDTO,
  convFaseIds: Set<string>,
  maxConvOrdem: number | null,
  faseById: Map<string, PainelFaseDTO>,
  historicoAnalisePorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
  conversaoCtx: ReturnType<typeof buildConversaoContext>,
): string | null {
  if (!cardConverteuPorRegras(card, conversaoCtx)) {
    return null;
  }

  if (convFaseIds.has(card.fase_id)) return card.created_at;
  const ordCriacao = faseById.get(card.fase_id)?.ordem;
  if (maxConvOrdem != null && ordCriacao != null && ordCriacao > maxConvOrdem) {
    return card.created_at;
  }

  const movs = historicoOrdenado(historicoAnalisePorCard.get(card.id) ?? []);
  for (const h of movs) {
    const nov = detStr(h.detalhe, 'fase_nova_id');
    const criacaoFase = h.acao === 'card_criado' ? detStr(h.detalhe, 'fase_id') : '';
    const alvo = nov || criacaoFase;
    if (alvo && eventoEntrouConversao(alvo, convFaseIds, maxConvOrdem, faseById)) {
      return h.criado_em;
    }
    for (const key of ['fase_nova_id', 'fase_anterior_id'] as const) {
      const fid = detStr(h.detalhe, key);
      if (fid && convFaseIds.has(fid)) return h.criado_em;
    }
  }

  return card.entered_fase_at ?? card.updated_at ?? card.created_at;
}

function diasCorridosEntre(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return (b - a) / (24 * 60 * 60 * 1000);
}

function clampPct100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export type ComputePainelPerformanceInput = {
  mode?: 'nativo' | 'legado';
  period: PainelPeriodKey;
  fases: PainelFaseDTO[];
  /** Cards filtrados para operação, gargalos e chamados. */
  cards: PainelCardDTO[];
  /** Cards para conversão, arquivamento e insights (inclui arquivados quando ocultos no status Ativos). */
  cardsAnalise?: PainelCardDTO[];
  chamados: PainelChamadoUnificadoDTO[];
  retrocessoRows: PainelRetrocessoDTO[];
  historicoMovimentos: PainelHistoricoMovimentoDTO[];
  historicoAnalise?: PainelHistoricoMovimentoDTO[];
  profiles: Record<string, string>;
};

/** Métricas principais do painel (operação, conversão, gargalos, chamados, insights). */
export function computePainelPerformance(input: ComputePainelPerformanceInput): PainelPerformanceResult {
  const sinceMs = periodSinceMs(input.period);
  const fasesOrd = [...input.fases].sort((a, b) => a.ordem - b.ordem);
  const faseById = new Map(fasesOrd.map((f) => [f.id, f]));
  const conversaoCtx = buildConversaoContext(fasesOrd);
  const convFases = fasesOrd.filter((f) => f.fase_conversao);
  const convIds = new Set(convFases.map((f) => f.id));
  const maxConvOrdem = convFases.length ? Math.max(...convFases.map((f) => f.ordem)) : null;
  const historicoPorCard = buildHistoricoPorCard(input.historicoMovimentos);
  const cardsAnalise = input.cardsAnalise ?? input.cards;
  const historicoAnalise = input.historicoAnalise ?? input.historicoMovimentos;
  const historicoAnalisePorCard = buildHistoricoPorCard(historicoAnalise);

  const cardsPeriodoOperacao = input.cards.filter((c) =>
    cardInAnalysisPeriod(c, sinceMs, historicoPorCard),
  );
  const cardsPeriodo = cardsAnalise.filter((c) =>
    cardInAnalysisPeriod(c, sinceMs, historicoAnalisePorCard),
  );
  const cardsAtivos = input.cards.filter(cardAtivo);
  const cardsEntraram = cardsPeriodo.filter((c) => {
    if (sinceMs === null) return true;
    const cr = new Date(c.created_at).getTime();
    return Number.isFinite(cr) && cr >= sinceMs;
  });
  const cardsEntraramOperacao = cardsPeriodoOperacao.filter((c) => {
    if (sinceMs === null) return true;
    const cr = new Date(c.created_at).getTime();
    return Number.isFinite(cr) && cr >= sinceMs;
  });

  const concluidosPeriodoOperacao = cardsPeriodoOperacao.filter((c) => c.concluido);
  const arquivadosOperacao = cardsPeriodoOperacao.filter((c) => c.arquivado);
  const arquivadosPeriodo = cardsPeriodo.filter((c) => c.arquivado);

  let slaDentro = 0;
  let slaComMeta = 0;
  for (const c of cardsAtivos) {
    const f = faseById.get(c.fase_id);
    const sla = slaCardNaFase(c, f);
    if (sla === 'sem_sla') continue;
    slaComMeta += 1;
    if (sla !== 'atrasado') slaDentro += 1;
  }
  const pctSla = slaComMeta === 0 ? null : (slaDentro / slaComMeta) * 100;

  const porFaseAtivos = fasesOrd.map((f) => {
    const naFase = cardsAtivos.filter((c) => c.fase_id === f.id);
    const arquivadosNaFase = arquivadosOperacao.filter((c) => c.fase_id === f.id);
    const atrasados = naFase.filter((c) => slaCardNaFase(c, f) === 'atrasado').length;
    const duMedio =
      naFase.length === 0 ? 0 : naFase.reduce((s, c) => s + diasNaFaseAtual(c), 0) / naFase.length;
    return {
      faseId: f.id,
      faseNome: f.nome,
      ordem: f.ordem,
      faseConversao: f.fase_conversao,
      slaDias: f.sla_dias,
      cardsAtivos: naFase.length,
      cardsArquivados: arquivadosNaFase.length,
      atrasados,
      diasUteisMedio: duMedio,
    };
  });

  const naConversaoAgora = cardsAtivos.filter((c) => convIds.has(c.fase_id)).length;
  const cohortEntrada = cardsEntraram;
  const cohortConvertidos = cohortEntrada.filter((c) => cardConverteuPorRegras(c, conversaoCtx));
  const taxaConversao =
    cohortEntrada.length === 0 ? null : (cohortConvertidos.length / cohortEntrada.length) * 100;
  const perdaTotalPct = taxaConversao != null ? 100 - taxaConversao : null;

  const diasAteConversao = cohortConvertidos
    .map((c) => {
      const convEm = dataPrimeiraConversao(
        c,
        convIds,
        maxConvOrdem,
        faseById,
        historicoAnalisePorCard,
        conversaoCtx,
      );
      return convEm ? diasCorridosEntre(c.created_at, convEm) : null;
    })
    .filter((d): d is number => d != null && Number.isFinite(d));
  const tempoMedioConversaoDias =
    diasAteConversao.length === 0
      ? null
      : diasAteConversao.reduce((s, d) => s + d, 0) / diasAteConversao.length;

  const porFaseConversao = fasesOrd.map((f) => {
    const alcancaram = cohortEntrada.filter((c) =>
      cardAlcancouFaseOrdem(c, f, faseById, historicoAnalisePorCard),
    );
    const converteram = alcancaram.filter((c) => cardConverteuPorRegras(c, conversaoCtx));
    return {
      faseId: f.id,
      faseNome: f.nome,
      ordem: f.ordem,
      faseConversao: f.fase_conversao,
      alcancaram: alcancaram.length,
      converteram: converteram.length,
      taxaConversaoPct:
        alcancaram.length === 0 ? null : (converteram.length / alcancaram.length) * 100,
    };
  });

  const entreFasesConversao = fasesOrd.slice(0, -1).map((f, i) => {
    const prox = fasesOrd[i + 1]!;
    const alcancaramOrigem = cohortEntrada.filter((c) =>
      cardAlcancouFaseOrdem(c, f, faseById, historicoAnalisePorCard),
    ).length;
    const alcancaramDestino = cohortEntrada.filter((c) =>
      cardAlcancouFaseOrdem(c, prox, faseById, historicoAnalisePorCard),
    ).length;
    return {
      deFaseId: f.id,
      deFaseNome: f.nome,
      paraFaseId: prox.id,
      paraFaseNome: prox.nome,
      alcancaramOrigem,
      alcancaramDestino,
      taxaPassagemPct:
        alcancaramOrigem === 0 ? null : (alcancaramDestino / alcancaramOrigem) * 100,
    };
  });

  type GrupoConv = { entradas: number; converteram: number; label: string; id: string | null };
  const respMap = new Map<string, GrupoConv>();
  for (const c of cohortEntrada) {
    const rid = c.responsavel_fase_id ?? null;
    const nome =
      c.responsavel_fase_nome?.trim() ||
      (rid ? input.profiles[rid] : null) ||
      'Sem responsável';
    const key = rid ?? `nome:${nome}`;
    const cur = respMap.get(key) ?? { entradas: 0, converteram: 0, label: nome, id: rid };
    cur.entradas += 1;
    if (cardConverteuPorRegras(c, conversaoCtx)) {
      cur.converteram += 1;
    }
    respMap.set(key, cur);
  }
  const porResponsavel = [...respMap.values()]
    .map((g) => ({
      responsavelId: g.id,
      responsavelNome: g.label,
      entradas: g.entradas,
      converteram: g.converteram,
      taxaConversaoPct: g.entradas === 0 ? null : (g.converteram / g.entradas) * 100,
    }))
    .sort((a, b) => b.entradas - a.entradas);

  const franqMap = new Map<string, GrupoConv & { redeFranqueadoId: string }>();
  for (const c of cohortEntrada) {
    const redeId = c.rede_franqueado_id?.trim();
    if (!redeId) continue;
    const nFranq = c.n_franquia?.trim();
    const nomeRede = c.franqueado_rede_nome?.trim();
    const label =
      [nFranq, nomeRede].filter(Boolean).join(' · ') || redeId.slice(0, 8);
    const cur = franqMap.get(redeId) ?? {
      entradas: 0,
      converteram: 0,
      label,
      id: redeId,
      redeFranqueadoId: redeId,
    };
    cur.entradas += 1;
    if (cardConverteuPorRegras(c, conversaoCtx)) {
      cur.converteram += 1;
    }
    franqMap.set(redeId, cur);
  }
  const porFranquia = [...franqMap.values()]
    .map((g) => ({
      redeFranqueadoId: g.redeFranqueadoId,
      label: g.label,
      entradas: g.entradas,
      converteram: g.converteram,
      taxaConversaoPct: g.entradas === 0 ? null : (g.converteram / g.entradas) * 100,
    }))
    .sort((a, b) => b.entradas - a.entradas);

  const arquivadosSemConversao = arquivadosPeriodo.filter((c) =>
    arquivamentoPerdaAntesConversao(classificarConversaoCard(c, conversaoCtx)),
  ).length;
  const arquivadosNaConversao = arquivadosPeriodo.filter((c) =>
    arquivamentoNaConversao(classificarConversaoCard(c, conversaoCtx)),
  ).length;
  const arquivadosDepoisConversao = arquivadosPeriodo.filter((c) =>
    arquivamentoPosConversao(classificarConversaoCard(c, conversaoCtx)),
  ).length;

  const concluidosInconsistentes = cardsPeriodo.filter(
    (c) => classificarConversaoCard(c, conversaoCtx).inconsistencia,
  ).length;

  type ArqGrupo = {
    total: number;
    antesConversao: number;
    naConversao: number;
    depoisConversao: number;
    label: string;
    id: string | null;
  };

  function bumpArquivamentoGrupo(cur: ArqGrupo, c: PainelCardDTO) {
    const cl = classificarConversaoCard(c, conversaoCtx);
    if (arquivamentoPerdaAntesConversao(cl)) cur.antesConversao += 1;
    else if (arquivamentoNaConversao(cl)) cur.naConversao += 1;
    else if (arquivamentoPosConversao(cl)) cur.depoisConversao += 1;
  }

  const arquivamentoPorFase = fasesOrd.map((f) => {
    const naFase = arquivadosPeriodo.filter((c) => c.fase_id === f.id);
    const grp: ArqGrupo = {
      total: naFase.length,
      antesConversao: 0,
      naConversao: 0,
      depoisConversao: 0,
      label: f.nome,
      id: f.id,
    };
    for (const c of naFase) bumpArquivamentoGrupo(grp, c);
    return {
      faseId: f.id,
      faseNome: f.nome,
      ordem: f.ordem,
      total: grp.total,
      antesConversao: grp.antesConversao,
      naConversao: grp.naConversao,
      depoisConversao: grp.depoisConversao,
    };
  });

  const arqRespMap = new Map<string, ArqGrupo>();
  for (const c of arquivadosPeriodo) {
    const rid = c.responsavel_fase_id ?? null;
    const nome =
      c.responsavel_fase_nome?.trim() ||
      (rid ? input.profiles[rid] : null) ||
      'Sem responsável';
    const key = rid ?? `nome:${nome}`;
    const cur = arqRespMap.get(key) ?? {
      total: 0,
      antesConversao: 0,
      naConversao: 0,
      depoisConversao: 0,
      label: nome,
      id: rid,
    };
    cur.total += 1;
    bumpArquivamentoGrupo(cur, c);
    arqRespMap.set(key, cur);
  }
  const arquivamentoPorResponsavel = [...arqRespMap.values()]
    .map((g) => ({
      responsavelId: g.id,
      responsavelNome: g.label,
      total: g.total,
      antesConversao: g.antesConversao,
      naConversao: g.naConversao,
      depoisConversao: g.depoisConversao,
    }))
    .sort((a, b) => b.total - a.total);

  const arqFranqMap = new Map<string, ArqGrupo & { redeFranqueadoId: string }>();
  for (const c of arquivadosPeriodo) {
    const redeId = c.rede_franqueado_id?.trim();
    if (!redeId) continue;
    const nFranq = c.n_franquia?.trim();
    const nomeRede = c.franqueado_rede_nome?.trim();
    const label = [nFranq, nomeRede].filter(Boolean).join(' · ') || redeId.slice(0, 8);
    const cur = arqFranqMap.get(redeId) ?? {
      total: 0,
      antesConversao: 0,
      naConversao: 0,
      depoisConversao: 0,
      label,
      id: redeId,
      redeFranqueadoId: redeId,
    };
    cur.total += 1;
    bumpArquivamentoGrupo(cur, c);
    arqFranqMap.set(redeId, cur);
  }
  const arquivamentoPorFranquia = [...arqFranqMap.values()]
    .map((g) => ({
      redeFranqueadoId: g.redeFranqueadoId,
      label: g.label,
      total: g.total,
      antesConversao: g.antesConversao,
      naConversao: g.naConversao,
      depoisConversao: g.depoisConversao,
    }))
    .sort((a, b) => b.total - a.total);

  const cardsAnalisados = cardsPeriodo.length;
  const taxaArquivamento =
    cardsAnalisados === 0 ? null : (arquivadosPeriodo.length / cardsAnalisados) * 100;

  const motivoHistoricoPorCard = buildMotivoHistoricoPorCard(historicoAnalise);
  const cardAntesConversao = (c: PainelCardDTO) =>
    arquivamentoPerdaAntesConversao(classificarConversaoCard(c, conversaoCtx));
  const motivosArquivamento = computeMotivosArquivamento({
    arquivados: arquivadosPeriodo,
    fases: fasesOrd,
    profiles: input.profiles,
    cardAntesConversao,
    motivoHistoricoPorCard,
  });

  const fasesComArquivados = arquivamentoPorFase.filter((f) => f.total > 0);
  const principalFaseArquivamento =
    fasesComArquivados.length === 0
      ? null
      : [...fasesComArquivados].sort((a, b) => b.total - a.total)[0]!;
  const principalMotivoArquivamento = motivosArquivamento.ranking[0] ?? null;
  const totalArquivados = arquivadosPeriodo.length;

  const perdasArquivamentos = {
    totalArquivados,
    pctDoPeriodo: taxaArquivamento,
    antesConversao: arquivadosSemConversao,
    naConversao: arquivadosNaConversao,
    depoisConversao: arquivadosDepoisConversao,
    principalFaseArquivamento: principalFaseArquivamento
      ? {
          faseId: principalFaseArquivamento.faseId,
          faseNome: principalFaseArquivamento.faseNome,
          total: principalFaseArquivamento.total,
        }
      : null,
    principalMotivoArquivamento: principalMotivoArquivamento
      ? { motivo: principalMotivoArquivamento.motivo, total: principalMotivoArquivamento.total }
      : null,
    pctSemMotivo: motivosArquivamento.pctSemMotivo,
    semMotivoInformado: motivosArquivamento.semMotivoInformado,
    impactoPerdaConversaoPct:
      cohortEntrada.length === 0 ? null : (arquivadosSemConversao / cohortEntrada.length) * 100,
    tabelaPorFase: fasesComArquivados
      .map((f) => {
        const motivosFase = motivosArquivamento.porFase.find((m) => m.faseId === f.faseId);
        const topMotivo = motivosFase?.motivos[0];
        return {
          faseId: f.faseId,
          faseNome: f.faseNome,
          ordem: f.ordem,
          arquivados: f.total,
          pctDoTotalArquivado: totalArquivados === 0 ? null : (f.total / totalArquivados) * 100,
          principalMotivo: topMotivo?.motivo ?? '—',
          antesConversao: f.antesConversao,
          depoisConversao: f.depoisConversao,
        };
      })
      .sort((a, b) => b.arquivados - a.arquivados),
  };

  const qualidadeMotivo = buildQualidadeMotivoArquivamento(motivosArquivamento, totalArquivados);

  const chamadosAbertosFunil = input.chamados.filter((c) => c.aberto);

  const chamadosAbertosPorFase = new Map<
    string,
    { abertos: number; comTrava: number; atrasados: number }
  >();
  for (const f of fasesOrd) {
    const cardIdsNaFase = new Set(cardsAtivos.filter((c) => c.fase_id === f.id).map((c) => c.id));
    const ch = chamadosAbertosFunil.filter((c) => cardIdsNaFase.has(c.cardId));
    chamadosAbertosPorFase.set(f.id, {
      abertos: ch.length,
      comTrava: ch.filter((c) => c.trava).length,
      atrasados: ch.filter((c) => c.vencido).length,
    });
  }

  const perdaConversaoPorFase = new Map<string, number | null>();
  for (const t of entreFasesConversao) {
    perdaConversaoPorFase.set(
      t.deFaseId,
      t.taxaPassagemPct != null ? clampPct100(100 - t.taxaPassagemPct) : null,
    );
  }

  const arquivamentoGargaloPorFase = new Map(
    arquivamentoPorFase.map((f) => {
      const motivosFase = motivosArquivamento.porFase.find((m) => m.faseId === f.faseId);
      const semMotivo =
        motivosFase?.motivos.find((m) => m.motivo === MOTIVO_ARQUIVAMENTO_SEM_INFORMADO)?.total ?? 0;
      return [f.faseId, { total: f.total, antesConversao: f.antesConversao, semMotivo }] as const;
    }),
  );
  const totalChamadosComTrava = [...chamadosAbertosPorFase.values()].reduce(
    (s, c) => s + c.comTrava,
    0,
  );

  const gargaloScores = computeGargaloScoreRanking({
    fases: input.fases,
    cards: input.cards,
    historicoMovimentos: input.historicoMovimentos,
    chamadosAbertosPorFase,
    perdaConversaoPorFase,
    arquivamentoPorFase: arquivamentoGargaloPorFase,
    totalArquivadosPeriodo: arquivadosPeriodo.length,
    totalArquivamentosAntesConversao: arquivadosSemConversao,
    totalArquivamentosSemMotivo: motivosArquivamento.semMotivoInformado,
    totalChamadosComTrava,
    cardAtrasadoNaFase: (card, fase) => slaCardNaFase(card, fase) === 'atrasado',
  });

  const chamadosAnalise = computePainelChamados({
    chamados: input.chamados,
    cards: input.cards,
    fases: input.fases,
    profiles: input.profiles,
    gargaloRanking: gargaloScores,
  });

  const retroAggs = aggregateRetrocesso(
    input.retrocessoRows,
    new Map(input.cards.map((c) => [c.id, c.titulo])),
  );

  const funnelTree = computeConversionFunnelTree({
    mode: input.mode ?? 'nativo',
    period: input.period,
    fases: input.fases,
    cards: cardsAnalise,
    historicoMovimentos: historicoAnalise,
  });

  const insights = computePainelInsights({
    period: input.period,
    mode: input.mode ?? 'nativo',
    fases: input.fases,
    cards: cardsAnalise,
    historicoMovimentos: historicoAnalise,
    operacaoPorFase: porFaseAtivos.map((f) => ({
      faseId: f.faseId,
      faseNome: f.faseNome,
      atrasados: f.atrasados,
    })),
    conversao: {
      faseConversaoConfigurada: convFases.length > 0,
      fasesConversao: convFases.map((f) => ({ id: f.id, nome: f.nome })),
      entradasNoPeriodo: cohortEntrada.length,
      porFranquia,
      porResponsavel,
      chegaramConversao: cohortConvertidos.length,
      entreFases: entreFasesConversao.map((t) => ({
        deFaseNome: t.deFaseNome,
        paraFaseNome: t.paraFaseNome,
        taxaPassagemPct: t.taxaPassagemPct,
      })),
    },
    gargaloRanking: gargaloScores,
    chamados: chamadosAnalise,
    funnelTree,
    arquivamento: {
      noPeriodo: arquivadosPeriodo.length,
      antesConversao: arquivadosSemConversao,
      naConversao: arquivadosNaConversao,
      depoisConversao: arquivadosDepoisConversao,
      arquivados: arquivadosPeriodo,
      porFase: arquivamentoPorFase,
      porFranquia: arquivamentoPorFranquia,
      porResponsavel: arquivamentoPorResponsavel,
      motivos: motivosArquivamento,
    },
  });

  return {
    period: input.period,
    operacao: {
      cardsEntraram: cardsEntraramOperacao.length,
      cardsAtivos: cardsAtivos.length,
      concluidos: concluidosPeriodoOperacao.length,
      arquivados: arquivadosOperacao.length,
      pctSlaDentro: pctSla,
      porFase: porFaseAtivos,
    },
    arquivamento: {
      noPeriodo: arquivadosPeriodo.length,
      antesConversao: arquivadosSemConversao,
      naConversao: arquivadosNaConversao,
      depoisConversao: arquivadosDepoisConversao,
      taxaArquivamentoPct: taxaArquivamento,
      cardsAnalisados,
      porFase: arquivamentoPorFase,
      porResponsavel: arquivamentoPorResponsavel,
      porFranquia: arquivamentoPorFranquia,
      motivos: motivosArquivamento,
      perdas: perdasArquivamentos,
      qualidadeMotivo,
    },
    conversao: {
      faseConversaoConfigurada: convFases.length > 0,
      fasesConversao: convFases.map((f) => ({ id: f.id, nome: f.nome, ordem: f.ordem })),
      entradasNoPeriodo: cohortEntrada.length,
      chegaramConversao: cohortConvertidos.length,
      taxaConversaoPct: taxaConversao,
      perdaTotalPct,
      tempoMedioConversaoDias,
      naConversaoAgora,
      arquivadosSemConversao,
      arquivadosNaConversao,
      arquivadosDepoisConversao,
      concluidosInconsistentesAntesConversao: concluidosInconsistentes,
      porFase: porFaseConversao,
      entreFases: entreFasesConversao,
      porResponsavel,
      porFranquia,
      funnelTree,
    },
    gargalos: {
      ranking: gargaloScores,
      retrocessos: retroAggs.slice(0, 8),
    },
    chamados: chamadosAnalise,
    insights,
  };
}

/** @deprecated Use computePainelPerformance */
export const computePainelAnalise = computePainelPerformance;
