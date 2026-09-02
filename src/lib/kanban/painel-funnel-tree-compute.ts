import { buildNativeFaseTimeline } from '@/lib/kanban/kanban-card-timeline';
import { cardInPeriod, periodSinceMs } from '@/lib/kanban/painel-performance-compute';
import type {
  ConversionFunnelTreeData,
  PainelCardDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelPeriodKey,
} from '@/lib/kanban/painel-performance-types';

function detStr(d: Record<string, unknown> | null | undefined, key: string): string {
  if (!d) return '';
  const v = d[key];
  return typeof v === 'string' ? v.trim() : '';
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

function cardTemHistoricoMovimentacao(
  cardId: string,
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): boolean {
  const rows = historicoPorCard.get(cardId) ?? [];
  return rows.some(
    (h) => h.acao === 'fase_avancada' || h.acao === 'fase_retrocedida' || h.acao === 'card_criado',
  );
}

function maxOrdemAlcancada(
  card: PainelCardDTO,
  faseById: Map<string, PainelFaseDTO>,
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): number {
  let max = faseById.get(card.fase_id)?.ordem ?? 0;
  for (const h of historicoPorCard.get(card.id) ?? []) {
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

function cardVisitouFase(
  card: PainelCardDTO,
  faseId: string,
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): boolean {
  if (card.fase_id === faseId) return true;
  for (const h of historicoPorCard.get(card.id) ?? []) {
    const d = h.detalhe;
    if (detStr(d, 'fase_nova_id') === faseId || detStr(d, 'fase_anterior_id') === faseId) return true;
    if (detStr(d, 'fase_id') === faseId) return true;
  }
  return false;
}

function diasCorridosEntre(fromIso: string, toIso: string): number {
  const a = new Date(fromIso).getTime();
  const b = new Date(toIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0;
  return (b - a) / (24 * 60 * 60 * 1000);
}

function dataEntradaFaseViaTimeline(
  card: PainelCardDTO,
  faseId: string,
  fasesOrd: PainelFaseDTO[],
  historico: PainelHistoricoMovimentoDTO[],
): string | null {
  const linhas = buildNativeFaseTimeline(
    fasesOrd,
    { created_at: card.created_at, fase_id: card.fase_id },
    historico.map((h) => ({ acao: h.acao, detalhe: h.detalhe, criado_em: h.criado_em })),
  );
  return linhas.find((l) => l.faseId === faseId)?.entrouEm ?? null;
}

function cardAlcancouFaseFunnel(
  card: PainelCardDTO,
  fase: PainelFaseDTO,
  faseById: Map<string, PainelFaseDTO>,
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
  fasesOrd: PainelFaseDTO[],
  usaAproximacao: boolean,
): boolean {
  const historico = historicoPorCard.get(card.id) ?? [];
  const comHistorico = cardTemHistoricoMovimentacao(card.id, historicoPorCard);

  if (comHistorico) {
    if (cardVisitouFase(card, fase.id, historicoPorCard)) return true;
    return dataEntradaFaseViaTimeline(card, fase.id, fasesOrd, historico) != null;
  }

  if (usaAproximacao) {
    return maxOrdemAlcancada(card, faseById, historicoPorCard) >= fase.ordem;
  }
  return false;
}

function dataChegadaFase(
  card: PainelCardDTO,
  fase: PainelFaseDTO,
  faseById: Map<string, PainelFaseDTO>,
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
  fasesOrd: PainelFaseDTO[],
  usaAproximacao: boolean,
): string | null {
  const historico = historicoPorCard.get(card.id) ?? [];
  const comHistorico = cardTemHistoricoMovimentacao(card.id, historicoPorCard);

  if (comHistorico) {
    const viaTimeline = dataEntradaFaseViaTimeline(card, fase.id, fasesOrd, historico);
    if (viaTimeline) return viaTimeline;
    if (card.fase_id === fase.id) return card.entered_fase_at ?? card.created_at;
    return null;
  }

  if (usaAproximacao && maxOrdemAlcancada(card, faseById, historicoPorCard) >= fase.ordem) {
    if (card.fase_id === fase.id) return card.entered_fase_at ?? card.updated_at ?? card.created_at;
    return card.created_at;
  }
  return null;
}

export function computeConversionFunnelTree(input: {
  mode: 'nativo' | 'legado';
  period: PainelPeriodKey;
  fases: PainelFaseDTO[];
  cards: PainelCardDTO[];
  historicoMovimentos: PainelHistoricoMovimentoDTO[];
  /** Sobrescreve a coorte por janela de `created_at` (ex.: período anterior para comparação). */
  cohortCreatedWindow?: { sinceMs: number; untilMs?: number | null };
}): ConversionFunnelTreeData {
  const sinceMs = input.cohortCreatedWindow
    ? input.cohortCreatedWindow.sinceMs
    : periodSinceMs(input.period);
  const untilMs = input.cohortCreatedWindow?.untilMs ?? null;
  const fasesOrd = [...input.fases].sort((a, b) => a.ordem - b.ordem);
  const faseById = new Map(fasesOrd.map((f) => [f.id, f]));
  const historicoPorCard = buildHistoricoPorCard(input.historicoMovimentos);

  const cohort = input.cards.filter((c) => {
    const cr = new Date(c.created_at).getTime();
    if (!Number.isFinite(cr)) return false;
    if (input.cohortCreatedWindow) {
      if (cr < sinceMs!) return false;
      if (untilMs != null && cr >= untilMs) return false;
      return true;
    }
    if (!cardInPeriod(c, sinceMs)) return false;
    if (sinceMs === null) return true;
    return cr >= sinceMs;
  });

  const entradasNoFunil = cohort.length;
  const historicoParcial =
    input.mode === 'legado' ||
    cohort.some((c) => !cardTemHistoricoMovimentacao(c.id, historicoPorCard));

  const alcancaramPorFase = fasesOrd.map((fase, idx) => {
    if (idx === 0) return entradasNoFunil;
    return cohort.filter((c) =>
      cardAlcancouFaseFunnel(c, fase, faseById, historicoPorCard, fasesOrd, historicoParcial),
    ).length;
  });

  const nodes = fasesOrd.map((fase, idx) => {
    const alcancaram = alcancaramPorFase[idx] ?? 0;
    const anterior = idx === 0 ? entradasNoFunil : (alcancaramPorFase[idx - 1] ?? 0);

    const tempos: number[] = [];
    for (const c of cohort) {
      if (idx === 0) {
        tempos.push(0);
        continue;
      }
      if (!cardAlcancouFaseFunnel(c, fase, faseById, historicoPorCard, fasesOrd, historicoParcial)) {
        continue;
      }
      const chegada = dataChegadaFase(c, fase, faseById, historicoPorCard, fasesOrd, historicoParcial);
      if (chegada) tempos.push(diasCorridosEntre(c.created_at, chegada));
    }

    const conversaoAnteriorPct =
      idx === 0 || anterior === 0 ? null : (alcancaram / anterior) * 100;
    const perdaAnteriorPct =
      conversaoAnteriorPct != null ? 100 - conversaoAnteriorPct : null;

    return {
      faseId: fase.id,
      faseNome: fase.nome,
      ordem: fase.ordem,
      faseConversao: fase.fase_conversao,
      alcancaram,
      pctSobreEntradas: entradasNoFunil === 0 ? null : (alcancaram / entradasNoFunil) * 100,
      conversaoAnteriorPct,
      perdaAnteriorPct,
      tempoMedioDias: tempos.length === 0 ? null : tempos.reduce((s, d) => s + d, 0) / tempos.length,
    };
  });

  return { entradasNoFunil, historicoParcial, nodes };
}
