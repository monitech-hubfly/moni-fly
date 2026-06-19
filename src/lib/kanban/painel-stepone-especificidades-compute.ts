import { buildNativeFaseTimeline } from '@/lib/kanban/kanban-card-timeline';
import { periodSinceMs } from '@/lib/kanban/painel-performance-compute';
import {
  DADOS_CANDIDATO_FASE_SLUGS,
  DADOS_CIDADE_FASE_SLUGS,
  DADOS_CONDOMINIOS_FASE_SLUGS,
  HIPOTESES_FASE_SLUGS,
  MAPA_COMPETIDORES_FASE_SLUGS,
  LOTES_DISPONIVEIS_FASE_SLUGS,
} from '@/lib/kanban/stepone-fase-slugs';
import type {
  PainelCardDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelPeriodKey,
  PainelStepOnePortfolioFilhoDTO,
} from '@/lib/kanban/painel-performance-types';

const LIMITE_PARADO_DIAS = 15;

const FASES_PARADOS_SLUGS = [
  ...DADOS_CANDIDATO_FASE_SLUGS,
  ...DADOS_CIDADE_FASE_SLUGS,
  ...MAPA_COMPETIDORES_FASE_SLUGS,
  ...DADOS_CONDOMINIOS_FASE_SLUGS,
  ...LOTES_DISPONIVEIS_FASE_SLUGS,
] as const;

function detStr(d: Record<string, unknown> | null | undefined, key: string): string {
  if (!d) return '';
  const v = d[key];
  return typeof v === 'string' ? v.trim() : '';
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

function timestampInPeriod(iso: string | null | undefined, sinceMs: number | null): boolean {
  if (sinceMs === null) return Boolean(iso);
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= sinceMs;
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

function cardChegouFaseNoPeriodo(
  card: PainelCardDTO,
  faseIds: Set<string>,
  sinceMs: number | null,
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): boolean {
  for (const faseId of faseIds) {
    for (const h of historicoPorCard.get(card.id) ?? []) {
      const nov =
        detStr(h.detalhe, 'fase_nova_id') ||
        (h.acao === 'card_criado' ? detStr(h.detalhe, 'fase_id') : '');
      if (nov !== faseId) continue;
      if (sinceMs === null) return true;
      const t = new Date(h.criado_em).getTime();
      if (Number.isFinite(t) && t >= sinceMs) return true;
    }
    if (faseIds.has(card.fase_id) && faseId === card.fase_id && timestampInPeriod(card.entered_fase_at, sinceMs)) {
      return true;
    }
  }
  return false;
}

function cardEntrouFunilNoPeriodo(card: PainelCardDTO, sinceMs: number | null): boolean {
  if (sinceMs === null) return true;
  const cr = new Date(card.created_at).getTime();
  return Number.isFinite(cr) && cr >= sinceMs;
}

function franquiaKeyLabel(c: PainelCardDTO): { key: string; label: string } | null {
  const redeId = c.rede_franqueado_id?.trim() || c.projeto_franqueado_id?.trim();
  if (!redeId) return null;
  const nFranq = c.n_franquia?.trim() || c.projeto_n_franquia?.trim();
  const nomeRede = c.franqueado_rede_nome?.trim() || c.projeto_franqueado_nome?.trim();
  const label = nFranq || [nomeRede].filter(Boolean).join(' · ') || redeId.slice(0, 8);
  return { key: redeId, label };
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

function diasDesdeEnteredFaseAt(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (24 * 60 * 60 * 1000);
}

export type PainelStepOneFranquiaConversaoRow = {
  franqueadoId: string;
  label: string;
  hipoteses: number;
  gerouPortfolio: number;
  taxa: number | null;
};

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
    porFranquia: PainelStepOneFranquiaConversaoRow[];
    portfolioIndisponivel: boolean;
  } | null;
  tempoFasesPesquisa: {
    linhas: Array<{ faseNome: string; tempoMedioDias: number | null; cardsAnalisados: number }>;
    historicoParcial: boolean;
  } | null;
  cardsParadosIntermediarios: {
    total: number;
    limiteDias: number;
    itens: Array<{ cardId: string; titulo: string; faseNome: string; diasNaFase: number }>;
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
  const portfolioPorOrigem = new Set(
    (input.portfolioFilhos ?? []).map((f) => f.origem_card_id).filter(Boolean),
  );

  const entradasFunil = input.cards.filter((c) => cardEntrouFunilNoPeriodo(c, sinceMs));

  let taxaAprovacaoHipoteses: PainelStepOneEspecificidades['taxaAprovacaoHipoteses'] = null;
  try {
    if (hipFaseIds.size > 0) {
      let entraramHipoteses = 0;
      for (const c of entradasFunil) {
        if (cardChegouFaseNoPeriodo(c, hipFaseIds, sinceMs, historicoPorCard)) {
          entraramHipoteses += 1;
        }
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
    const porFranquiaMap = new Map<
      string,
      { label: string; hipoteses: number; gerouPortfolio: number }
    >();

    for (const c of input.cards) {
      const visitouHip = cardVisitouFase(c, hipFaseIds, historicoPorCard);
      const saiuHip = cardSaiuDeHipoteses(
        c,
        hipFaseIds,
        hipOrdem,
        faseById,
        historicoPorCard,
        portfolioOrigemIds,
      );
      if (saiuHip) {
        sairamHipoteses += 1;
        if (portfolioPorOrigem.has(c.id)) geraramPortfolio += 1;
      }

      if (visitouHip) {
        const fk = franquiaKeyLabel(c);
        if (fk) {
          const cur = porFranquiaMap.get(fk.key) ?? {
            label: fk.label,
            hipoteses: 0,
            gerouPortfolio: 0,
          };
          cur.hipoteses += 1;
          if (portfolioPorOrigem.has(c.id)) cur.gerouPortfolio += 1;
          porFranquiaMap.set(fk.key, cur);
        }
      }
    }

    const porFranquia: PainelStepOneFranquiaConversaoRow[] = [...porFranquiaMap.entries()]
      .map(([franqueadoId, v]) => ({
        franqueadoId,
        label: v.label,
        hipoteses: v.hipoteses,
        gerouPortfolio: v.gerouPortfolio,
        taxa: v.hipoteses === 0 ? null : (v.gerouPortfolio / v.hipoteses) * 100,
      }))
      .sort((a, b) => b.hipoteses - a.hipoteses);

    if (hipFaseIds.size > 0) {
      conversaoPortfolio = {
        sairamHipoteses,
        geraramPortfolio,
        percentual: sairamHipoteses === 0 ? null : (geraramPortfolio / sairamHipoteses) * 100,
        porFranquia,
        portfolioIndisponivel,
      };
    }
  } catch {
    conversaoPortfolio = null;
  }

  let tempoFasesPesquisa: PainelStepOneEspecificidades['tempoFasesPesquisa'] = null;
  try {
    const mapaIds = faseIdsPorSlugs(input.fases, MAPA_COMPETIDORES_FASE_SLUGS);
    const dadosCondIds = faseIdsPorSlugs(input.fases, DADOS_CONDOMINIOS_FASE_SLUGS);

    const temposPorFase = new Map<string, number[]>();
    let historicoParcial = false;

    const registrarFase = (faseId: string, dias: number) => {
      const list = temposPorFase.get(faseId) ?? [];
      list.push(dias);
      temposPorFase.set(faseId, list);
    };

    for (const c of input.cards) {
      const historico = historicoPorCard.get(c.id) ?? [];
      const temMov = historico.some(
        (h) =>
          h.acao === 'fase_avancada' || h.acao === 'fase_retrocedida' || h.acao === 'card_criado',
      );
      if (!temMov) historicoParcial = true;

      for (const faseId of mapaIds) {
        const dias = diasNaFaseViaTimeline(c, faseId, fasesOrd, historico);
        if (dias != null) registrarFase(faseId, dias);
      }
      for (const faseId of dadosCondIds) {
        const dias = diasNaFaseViaTimeline(c, faseId, fasesOrd, historico);
        if (dias != null) registrarFase(faseId, dias);
      }
    }

    const media = (nums: number[]) =>
      nums.length === 0 ? null : nums.reduce((s, n) => s + n, 0) / nums.length;

    const linhas: NonNullable<PainelStepOneEspecificidades['tempoFasesPesquisa']>['linhas'] = [];

    for (const faseId of mapaIds) {
      const nums = temposPorFase.get(faseId) ?? [];
      const fase = faseById.get(faseId);
      linhas.push({
        faseNome: fase?.nome ?? 'Mapa de Competidores',
        tempoMedioDias: media(nums),
        cardsAnalisados: nums.length,
      });
    }
    for (const faseId of dadosCondIds) {
      const nums = temposPorFase.get(faseId) ?? [];
      const fase = faseById.get(faseId);
      linhas.push({
        faseNome: fase?.nome ?? 'Dados dos Condomínios',
        tempoMedioDias: media(nums),
        cardsAnalisados: nums.length,
      });
    }

    if (linhas.length > 0) {
      tempoFasesPesquisa = { linhas, historicoParcial };
    }
  } catch {
    tempoFasesPesquisa = null;
  }

  let cardsParadosIntermediarios: PainelStepOneEspecificidades['cardsParadosIntermediarios'] = null;
  try {
    const fasesParadosIds = new Set(faseIdsPorSlugs(input.fases, FASES_PARADOS_SLUGS));
    const itens: NonNullable<PainelStepOneEspecificidades['cardsParadosIntermediarios']>['itens'] =
      [];

    for (const c of input.cards) {
      if (c.arquivado || c.concluido) continue;
      if (!fasesParadosIds.has(c.fase_id)) continue;
      const dias = diasDesdeEnteredFaseAt(c.entered_fase_at);
      if (dias == null || dias <= LIMITE_PARADO_DIAS) continue;
      const faseNome = faseById.get(c.fase_id)?.nome ?? '—';
      itens.push({
        cardId: c.id,
        titulo: c.titulo?.trim() || c.id.slice(0, 8),
        faseNome,
        diasNaFase: Math.floor(dias),
      });
    }

    itens.sort((a, b) => b.diasNaFase - a.diasNaFase);

    cardsParadosIntermediarios = {
      total: itens.length,
      limiteDias: LIMITE_PARADO_DIAS,
      itens,
    };
  } catch {
    cardsParadosIntermediarios = null;
  }

  const temAlgum =
    taxaAprovacaoHipoteses != null ||
    conversaoPortfolio != null ||
    tempoFasesPesquisa != null ||
    cardsParadosIntermediarios != null;

  if (!temAlgum) return null;

  return {
    taxaAprovacaoHipoteses,
    conversaoPortfolio,
    tempoFasesPesquisa,
    cardsParadosIntermediarios,
  };
}
