import { buildNativeFaseTimeline } from '@/lib/kanban/kanban-card-timeline';
import { periodSinceMs } from '@/lib/kanban/painel-performance-compute';
import {
  DADOS_CONDOMINIOS_FASE_SLUGS,
  HIPOTESES_FASE_SLUGS,
  MAPA_COMPETIDORES_FASE_SLUGS,
  LOTES_DISPONIVEIS_FASE_SLUGS,
} from '@/lib/kanban/stepone-fase-slugs';
import type {
  PainelCardDTO,
  PainelCarometroFranquiaCount,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelPeriodKey,
  PainelStepOnePortfolioFilhoDTO,
} from '@/lib/kanban/painel-performance-types';

const CAMPOS_LOTE: (keyof PainelCardDTO)[] = ['nome_condominio', 'quadra', 'lote'];

function detStr(d: Record<string, unknown> | null | undefined, key: string): string {
  if (!d) return '';
  const v = d[key];
  return typeof v === 'string' ? v.trim() : '';
}

function campoDisponivel(cards: PainelCardDTO[], key: keyof PainelCardDTO): boolean {
  return cards.some((c) => c[key] !== undefined);
}

function faseIdsPorSlugs(fases: PainelFaseDTO[], slugs: readonly string[]): string[] {
  const want = new Set(slugs.map((s) => s.trim()));
  return fases.filter((f) => want.has(String(f.slug ?? '').trim())).map((f) => f.id);
}

function buildHistoricoPorCard(
  rows: PainelHistoricoMovimentoDTO[],
): Map<string, PainelHistoricoMovimentoDTO[]> {
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
  faseIds: Set<string>,
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): boolean {
  if (faseIds.has(card.fase_id)) return true;
  for (const h of historicoPorCard.get(card.id) ?? []) {
    const d = h.detalhe;
    if (faseIds.has(detStr(d, 'fase_nova_id'))) return true;
    if (faseIds.has(detStr(d, 'fase_anterior_id'))) return true;
    if (h.acao === 'card_criado' && faseIds.has(detStr(d, 'fase_id'))) return true;
  }
  return false;
}

function cardEntrouFunilNoPeriodo(card: PainelCardDTO, sinceMs: number | null): boolean {
  if (sinceMs === null) return true;
  const cr = new Date(card.created_at).getTime();
  return Number.isFinite(cr) && cr >= sinceMs;
}

function franquiaKeyLabel(c: PainelCardDTO): { key: string; label: string } | null {
  const redeId = c.rede_franqueado_id?.trim();
  if (!redeId) return null;
  const nFranq = c.n_franquia?.trim();
  const nomeRede = c.franqueado_rede_nome?.trim();
  const label = [nFranq, nomeRede].filter(Boolean).join(' · ') || redeId.slice(0, 8);
  return { key: redeId, label };
}

function franquiaCountsFromMap(
  map: Map<string, { label: string; quantidade: number }>,
): PainelCarometroFranquiaCount[] {
  return [...map.entries()]
    .map(([franqueadoId, v]) => ({
      franqueadoId,
      label: v.label,
      quantidade: v.quantidade,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

function cardSaiuDeHipoteses(
  card: PainelCardDTO,
  hipFaseIds: Set<string>,
  hipOrdem: number | null,
  faseById: Map<string, PainelFaseDTO>,
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
  portfolioOrigemIds: Set<string>,
): boolean {
  if (portfolioOrigemIds.has(card.id)) return true;
  if (!cardVisitouFase(card, hipFaseIds, historicoPorCard)) return false;
  if (hipOrdem == null) return false;
  const ordAtual = faseById.get(card.fase_id)?.ordem;
  if (ordAtual != null && ordAtual > hipOrdem) return true;
  let maxOrd = ordAtual ?? 0;
  for (const h of historicoPorCard.get(card.id) ?? []) {
    for (const key of ['fase_nova_id', 'fase_anterior_id', 'fase_id'] as const) {
      const fid = detStr(h.detalhe, key);
      if (!fid) continue;
      const ord = faseById.get(fid)?.ordem;
      if (ord != null && ord > maxOrd) maxOrd = ord;
    }
  }
  return maxOrd > hipOrdem;
}

function diasNaFaseViaTimeline(
  card: PainelCardDTO,
  faseId: string,
  fases: PainelFaseDTO[],
  historico: PainelHistoricoMovimentoDTO[],
): number | null {
  const linhas = buildNativeFaseTimeline(
    fases,
    { created_at: card.created_at, fase_id: card.fase_id },
    historico.map((h) => ({ acao: h.acao, detalhe: h.detalhe, criado_em: h.criado_em })),
  );
  const linha = linhas.find((l) => l.faseId === faseId);
  if (!linha?.entrouEm) return null;
  const fim = linha.saiuEm ?? new Date().toISOString();
  const a = new Date(linha.entrouEm).getTime();
  const b = new Date(fim).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return (b - a) / (24 * 60 * 60 * 1000);
}

function campoLotePreenchido(c: PainelCardDTO, key: keyof PainelCardDTO): boolean {
  const v = c[key];
  if (v == null) return false;
  return String(v).trim().length > 0;
}

export type PainelStepOneEspecificidades = {
  taxaAprovacaoHipoteses: {
    entraramHipoteses: number;
    entradasFunil: number;
    percentual: number | null;
  } | null;
  conversaoPortfolio: {
    sairamHipoteses: number;
    geraramPortfolio: number;
    percentual: number | null;
    porFranquia: PainelCarometroFranquiaCount[];
    portfolioIndisponivel: boolean;
  } | null;
  qualidadeDadosLotes: {
    camposPreenchidos: number;
    camposEstimados: number;
    percentual: number | null;
    cardsAnalisados: number;
    camposIndisponiveis: boolean;
  } | null;
  tempoFasesPesquisa: {
    mapaCompetidores: { mediaDias: number | null; amostras: number } | null;
    dadosCondominios: { mediaDias: number | null; amostras: number } | null;
    historicoParcial: boolean;
  } | null;
};

export function stepOneEspecificidadesDisponivel(
  kanbanId: string | null | undefined,
  stepOneFieldsAvailable?: boolean,
): boolean {
  if (kanbanId == null) return false;
  return stepOneFieldsAvailable !== false;
}

/** Métricas específicas do Funil Step One (histórico + campos do card). Degrada por bloco. */
export function computeStepOneEspecificidades(input: {
  period: PainelPeriodKey;
  fases: PainelFaseDTO[];
  cards: PainelCardDTO[];
  historicoMovimentos: PainelHistoricoMovimentoDTO[];
  portfolioFilhos?: PainelStepOnePortfolioFilhoDTO[];
  stepOneFieldsAvailable?: boolean;
  portfolioFilhosAvailable?: boolean;
}): PainelStepOneEspecificidades | null {
  const sinceMs = periodSinceMs(input.period);
  const historicoPorCard = buildHistoricoPorCard(input.historicoMovimentos);
  const faseById = new Map(input.fases.map((f) => [f.id, f]));
  const fasesOrd = [...input.fases].sort((a, b) => a.ordem - b.ordem);

  const hipFaseIds = new Set(faseIdsPorSlugs(input.fases, HIPOTESES_FASE_SLUGS));
  const hipOrdem =
    [...hipFaseIds]
      .map((id) => faseById.get(id)?.ordem)
      .find((o): o is number => typeof o === 'number') ?? null;

  const portfolioOrigemIds = new Set(
    (input.portfolioFilhos ?? []).map((f) => f.origem_card_id).filter(Boolean),
  );
  const portfolioPorOrigem = new Map(
    (input.portfolioFilhos ?? []).map((f) => [f.origem_card_id, f.portfolio_card_id]),
  );

  const entradasFunil = input.cards.filter((c) => cardEntrouFunilNoPeriodo(c, sinceMs));

  let taxaAprovacaoHipoteses: PainelStepOneEspecificidades['taxaAprovacaoHipoteses'] = null;
  try {
    if (hipFaseIds.size > 0) {
      let entraramHipoteses = 0;
      for (const c of entradasFunil) {
        if (cardVisitouFase(c, hipFaseIds, historicoPorCard)) entraramHipoteses += 1;
      }
      taxaAprovacaoHipoteses = {
        entraramHipoteses,
        entradasFunil: entradasFunil.length,
        percentual:
          entradasFunil.length === 0 ? null : (entraramHipoteses / entradasFunil.length) * 100,
      };
    }
  } catch {
    taxaAprovacaoHipoteses = null;
  }

  let conversaoPortfolio: PainelStepOneEspecificidades['conversaoPortfolio'] = null;
  try {
    const portfolioIndisponivel = input.portfolioFilhosAvailable === false;
    let sairamHipoteses = 0;
    let geraramPortfolio = 0;
    const porFranquiaMap = new Map<string, { label: string; quantidade: number }>();

    for (const c of input.cards) {
      if (
        !cardSaiuDeHipoteses(
          c,
          hipFaseIds,
          hipOrdem,
          faseById,
          historicoPorCard,
          portfolioOrigemIds,
        )
      ) {
        continue;
      }
      sairamHipoteses += 1;
      if (!portfolioPorOrigem.has(c.id)) continue;
      geraramPortfolio += 1;
      const fk = franquiaKeyLabel(c);
      if (fk) {
        const cur = porFranquiaMap.get(fk.key) ?? { label: fk.label, quantidade: 0 };
        cur.quantidade += 1;
        porFranquiaMap.set(fk.key, cur);
      }
    }

    if (hipFaseIds.size > 0) {
      conversaoPortfolio = {
        sairamHipoteses,
        geraramPortfolio,
        percentual: sairamHipoteses === 0 ? null : (geraramPortfolio / sairamHipoteses) * 100,
        porFranquia: franquiaCountsFromMap(porFranquiaMap),
        portfolioIndisponivel,
      };
    }
  } catch {
    conversaoPortfolio = null;
  }

  let qualidadeDadosLotes: PainelStepOneEspecificidades['qualidadeDadosLotes'] = null;
  try {
    const camposIndisponiveis = !CAMPOS_LOTE.every((k) => campoDisponivel(input.cards, k));
    const fasesLoteIds = new Set([
      ...faseIdsPorSlugs(input.fases, LOTES_DISPONIVEIS_FASE_SLUGS),
      ...faseIdsPorSlugs(input.fases, DADOS_CONDOMINIOS_FASE_SLUGS),
    ]);

    let camposPreenchidos = 0;
    let camposEstimados = 0;
    let cardsAnalisados = 0;

    for (const c of input.cards) {
      if (fasesLoteIds.size > 0 && !cardVisitouFase(c, fasesLoteIds, historicoPorCard)) continue;
      cardsAnalisados += 1;
      camposEstimados += CAMPOS_LOTE.length;
      for (const key of CAMPOS_LOTE) {
        if (campoLotePreenchido(c, key)) camposPreenchidos += 1;
      }
    }

    if (!camposIndisponiveis || cardsAnalisados > 0) {
      qualidadeDadosLotes = {
        camposPreenchidos,
        camposEstimados,
        percentual: camposEstimados === 0 ? null : (camposPreenchidos / camposEstimados) * 100,
        cardsAnalisados,
        camposIndisponiveis,
      };
    }
  } catch {
    qualidadeDadosLotes = null;
  }

  let tempoFasesPesquisa: PainelStepOneEspecificidades['tempoFasesPesquisa'] = null;
  try {
    const mapaIds = faseIdsPorSlugs(input.fases, MAPA_COMPETIDORES_FASE_SLUGS);
    const dadosCondIds = faseIdsPorSlugs(input.fases, DADOS_CONDOMINIOS_FASE_SLUGS);

    const temposMapa: number[] = [];
    const temposDadosCond: number[] = [];
    let historicoParcial = false;

    for (const c of input.cards) {
      const historico = historicoPorCard.get(c.id) ?? [];
      const temMov = historico.some(
        (h) =>
          h.acao === 'fase_avancada' || h.acao === 'fase_retrocedida' || h.acao === 'card_criado',
      );
      if (!temMov) historicoParcial = true;

      for (const faseId of mapaIds) {
        const dias = diasNaFaseViaTimeline(c, faseId, fasesOrd, historico);
        if (dias != null) temposMapa.push(dias);
      }
      for (const faseId of dadosCondIds) {
        const dias = diasNaFaseViaTimeline(c, faseId, fasesOrd, historico);
        if (dias != null) temposDadosCond.push(dias);
      }
    }

    const media = (nums: number[]) =>
      nums.length === 0 ? null : nums.reduce((s, n) => s + n, 0) / nums.length;

    if (mapaIds.length > 0 || dadosCondIds.length > 0) {
      tempoFasesPesquisa = {
        mapaCompetidores:
          mapaIds.length === 0
            ? null
            : { mediaDias: media(temposMapa), amostras: temposMapa.length },
        dadosCondominios:
          dadosCondIds.length === 0
            ? null
            : { mediaDias: media(temposDadosCond), amostras: temposDadosCond.length },
        historicoParcial,
      };
    }
  } catch {
    tempoFasesPesquisa = null;
  }

  const temAlgum =
    taxaAprovacaoHipoteses != null ||
    conversaoPortfolio != null ||
    qualidadeDadosLotes != null ||
    tempoFasesPesquisa != null;

  if (!temAlgum) return null;

  return {
    taxaAprovacaoHipoteses,
    conversaoPortfolio,
    qualidadeDadosLotes,
    tempoFasesPesquisa,
  };
}
