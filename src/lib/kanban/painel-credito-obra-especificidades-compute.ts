import { buildNativeFaseTimeline } from '@/lib/kanban/kanban-card-timeline';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import { calcularStatusSLA } from '@/lib/dias-uteis';
import type {
  PainelCardDTO,
  PainelCreditoObraOperacoesIrmaoDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelPeriodKey,
  PainelRetrocessoDTO,
} from '@/lib/kanban/painel-performance-types';

const MS_15_DIAS = 15 * 24 * 60 * 60 * 1000;

const CO_FASE_SLUGS = (Object.values(FASE_SLUGS) as string[]).filter((v) => v.startsWith('co_'));

const TRANCHE_BLOCOS = [
  {
    label: '1ª tranche',
    inicio: FASE_SLUGS.CO_AGUARDANDO_1A_TRANCHE,
    fim: FASE_SLUGS.CO_ACOMPANHAMENTO_TRANCHE,
  },
  {
    label: '3ª tranche',
    inicio: FASE_SLUGS.CO_NECESSIDADE_3A_TRANCHE,
    fim: FASE_SLUGS.CO_ACOMPANHAMENTO_3A,
  },
  {
    label: '4ª tranche',
    inicio: FASE_SLUGS.CO_NECESSIDADE_4A_TRANCHE,
    fim: FASE_SLUGS.CO_ACOMPANHAMENTO_4A,
  },
  {
    label: '5ª tranche',
    inicio: FASE_SLUGS.CO_NECESSIDADE_5A_TRANCHE,
    fim: FASE_SLUGS.CO_ACOMPANHAMENTO_5A,
  },
  {
    label: '6ª tranche',
    inicio: FASE_SLUGS.CO_NECESSIDADE_6A_TRANCHE,
    fim: FASE_SLUGS.CO_ACOMPANHAMENTO_6A,
  },
] as const;

const PRIMEIRA_TRANCHE_FASE_SLUGS = [
  FASE_SLUGS.CO_AGUARDANDO_1A_TRANCHE,
  FASE_SLUGS.CO_SOLICITACAO_TRANCHE,
  FASE_SLUGS.CO_SHAREPOINT_CASHME,
] as const;

function periodWindows(key: PainelPeriodKey): {
  currentSince: number | null;
  previousSince: number | null;
  previousUntil: number | null;
} {
  if (key === 'all') {
    return { currentSince: null, previousSince: null, previousUntil: null };
  }
  const days = key === '7d' ? 7 : key === '30d' ? 30 : 90;
  const now = Date.now();
  const ms = days * 86400000;
  return {
    currentSince: now - ms,
    previousSince: now - 2 * ms,
    previousUntil: now - ms,
  };
}

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

function faseIdPorSlug(fases: PainelFaseDTO[], slug: string): string | null {
  const ids = faseIdsPorSlugs(fases, [slug]);
  return ids[0] ?? null;
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

function buildRetrocessoPorCard(rows: PainelRetrocessoDTO[]): Map<string, PainelRetrocessoDTO[]> {
  const m = new Map<string, PainelRetrocessoDTO[]>();
  for (const r of rows) {
    const list = m.get(r.card_id) ?? [];
    list.push(r);
    m.set(r.card_id, list);
  }
  return m;
}

function cardAtivo(c: { arquivado: boolean; concluido: boolean }): boolean {
  return !c.arquivado && !c.concluido;
}

function primeiraEntradaFase(
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
  const entrou = linhas.find((l) => l.faseId === faseId)?.entrouEm ?? null;
  if (entrou) return entrou;
  if (card.fase_id === faseId && card.entered_fase_at) return card.entered_fase_at;
  return null;
}

function entradaNoIntervalo(
  iso: string | null,
  sinceMs: number | null,
  untilMs: number | null,
): boolean {
  if (!iso || sinceMs == null) return sinceMs === null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  if (untilMs != null) return t >= sinceMs && t < untilMs;
  return t >= sinceMs;
}

function diasEntreFases(
  card: PainelCardDTO,
  faseOrigemId: string,
  faseDestinoId: string,
  fasesOrd: PainelFaseDTO[],
  historico: PainelHistoricoMovimentoDTO[],
): number | null {
  const inicio = primeiraEntradaFase(card, faseOrigemId, fasesOrd, historico);
  const fim = primeiraEntradaFase(card, faseDestinoId, fasesOrd, historico);
  if (!inicio || !fim) return null;
  const a = new Date(inicio).getTime();
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

function cardVisitouFase(
  card: PainelCardDTO,
  faseId: string,
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): boolean {
  if (card.fase_id === faseId) return true;
  for (const h of historicoPorCard.get(card.id) ?? []) {
    const d = h.detalhe;
    if (detStr(d, 'fase_nova_id') === faseId) return true;
    if (detStr(d, 'fase_anterior_id') === faseId) return true;
    if (h.acao === 'card_criado' && detStr(d, 'fase_id') === faseId) return true;
  }
  return false;
}

function cardComRetrocessoPrimeiraTranche(
  retrocessos: PainelRetrocessoDTO[],
  primeiraTrancheIds: Set<string>,
): boolean {
  for (const r of retrocessos) {
    const novaId = detStr(r.detalhe, 'fase_nova_id');
    if (primeiraTrancheIds.has(novaId)) return true;
  }
  return false;
}

function cardAtrasadoNaFase(
  c: {
    fase_id: string;
    entered_fase_at: string | null;
    created_at: string;
    arquivado: boolean;
    concluido: boolean;
  },
  fases: PainelFaseDTO[],
): boolean {
  if (!cardAtivo(c)) return false;
  const fase = fases.find((f) => f.id === c.fase_id);
  if (!fase?.sla_dias || fase.sla_dias >= 999) return false;
  const ref = c.entered_fase_at ?? c.created_at;
  return calcularStatusSLA(new Date(ref), fase.sla_dias).status === 'atrasado';
}

function media(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function median(nums: number[]): number | null {
  const sorted = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export type PainelCreditoObraTrancheTempoRow = {
  tranche: string;
  mediaDias: number | null;
  amostras: number;
  mediaDiasPeriodoAnterior: number | null;
  vsPeriodoAnteriorPct: number | null;
  acimaMedianaGeral: boolean;
};

export type PainelCreditoObraEspecificidades = {
  tempoMedioPorTranche: {
    linhas: PainelCreditoObraTrancheTempoRow[];
    medianaGeral: number | null;
    historicoParcial: boolean;
  } | null;
  taxaAprovacaoPrimeiraTranche: {
    aprovadosPrimeiraTentativa: number;
    aprovadosComRevisoes: number;
    pctPrimeiraTentativa: number | null;
  } | null;
  paradosEntreTranches15Dias: {
    acima15Dias: number;
    itens: Array<{ cardId: string; titulo: string; faseNome: string; diasParados: number }>;
  } | null;
  correlacaoAtrasoOperacoes: {
    projetosDuploAtraso: number;
    projetoIndisponivel: boolean;
    operacoesIndisponivel: boolean;
  } | null;
};

/** Métricas específicas do Funil Crédito Obra. Degrada por bloco quando dados ausentes. */
export function computeCreditoObraEspecificidades(input: {
  period: PainelPeriodKey;
  fases: PainelFaseDTO[];
  cards: PainelCardDTO[];
  historicoMovimentos: PainelHistoricoMovimentoDTO[];
  retrocessoRows: PainelRetrocessoDTO[];
  operacoesIrmaos?: PainelCreditoObraOperacoesIrmaoDTO[];
  operacoesFases?: PainelFaseDTO[];
  operacoesIrmaosAvailable?: boolean;
  creditoObraFieldsAvailable?: boolean;
}): PainelCreditoObraEspecificidades | null {
  const historicoPorCard = buildHistoricoPorCard(input.historicoMovimentos);
  const retrocessoPorCard = buildRetrocessoPorCard(input.retrocessoRows);
  const faseById = new Map(input.fases.map((f) => [f.id, f]));
  const fasesOrd = [...input.fases].sort((a, b) => a.ordem - b.ordem);
  const { currentSince, previousSince, previousUntil } = periodWindows(input.period);

  let tempoMedioPorTranche: PainelCreditoObraEspecificidades['tempoMedioPorTranche'] = null;
  try {
    const linhas: PainelCreditoObraTrancheTempoRow[] = [];
    let historicoParcial = false;

    for (const bloco of TRANCHE_BLOCOS) {
      const inicioId = faseIdPorSlug(input.fases, bloco.inicio);
      const fimId = faseIdPorSlug(input.fases, bloco.fim);
      if (!inicioId || !fimId) continue;

      const temposAtual: number[] = [];
      const temposAnterior: number[] = [];

      for (const c of input.cards) {
        const historico = historicoPorCard.get(c.id) ?? [];
        const temMov = historico.some(
          (h) =>
            h.acao === 'fase_avancada' || h.acao === 'fase_retrocedida' || h.acao === 'card_criado',
        );
        if (!temMov) historicoParcial = true;

        const dias = diasEntreFases(c, inicioId, fimId, fasesOrd, historico);
        if (dias == null) continue;

        const fimEm = primeiraEntradaFase(c, fimId, fasesOrd, historico);
        if (currentSince === null) {
          temposAtual.push(dias);
        } else {
          if (entradaNoIntervalo(fimEm, currentSince, null)) temposAtual.push(dias);
          if (entradaNoIntervalo(fimEm, previousSince, previousUntil)) temposAnterior.push(dias);
        }
      }

      const mediaAtual = media(temposAtual);
      const mediaAnterior = media(temposAnterior);
      let vsPeriodoAnteriorPct: number | null = null;
      if (mediaAtual != null && mediaAnterior != null && mediaAnterior > 0) {
        vsPeriodoAnteriorPct = ((mediaAtual - mediaAnterior) / mediaAnterior) * 100;
      }

      linhas.push({
        tranche: bloco.label,
        mediaDias: mediaAtual,
        amostras: temposAtual.length,
        mediaDiasPeriodoAnterior: currentSince === null ? null : mediaAnterior,
        vsPeriodoAnteriorPct: currentSince === null ? null : vsPeriodoAnteriorPct,
        acimaMedianaGeral: false,
      });
    }

    const mediasValidas = linhas
      .map((l) => l.mediaDias)
      .filter((m): m is number => m != null && Number.isFinite(m));
    const medianaGeral = median(mediasValidas);

    for (const linha of linhas) {
      linha.acimaMedianaGeral =
        medianaGeral != null &&
        linha.mediaDias != null &&
        linha.mediaDias > medianaGeral;
    }

    if (linhas.length > 0) {
      tempoMedioPorTranche = { linhas, medianaGeral, historicoParcial };
    }
  } catch {
    tempoMedioPorTranche = null;
  }

  let taxaAprovacaoPrimeiraTranche: PainelCreditoObraEspecificidades['taxaAprovacaoPrimeiraTranche'] =
    null;
  try {
    const acompanhamentoId = faseIdPorSlug(input.fases, FASE_SLUGS.CO_ACOMPANHAMENTO_TRANCHE);
    const primeiraTrancheIds = new Set(faseIdsPorSlugs(input.fases, PRIMEIRA_TRANCHE_FASE_SLUGS));

    if (acompanhamentoId) {
      let aprovadosPrimeiraTentativa = 0;
      let aprovadosComRevisoes = 0;

      for (const c of input.cards) {
        if (!cardVisitouFase(c, acompanhamentoId, historicoPorCard)) continue;
        const retrocessos = retrocessoPorCard.get(c.id) ?? [];
        if (cardComRetrocessoPrimeiraTranche(retrocessos, primeiraTrancheIds)) {
          aprovadosComRevisoes += 1;
        } else {
          aprovadosPrimeiraTentativa += 1;
        }
      }

      const totalAprovados = aprovadosPrimeiraTentativa + aprovadosComRevisoes;
      if (totalAprovados > 0 || primeiraTrancheIds.size > 0) {
        taxaAprovacaoPrimeiraTranche = {
          aprovadosPrimeiraTentativa,
          aprovadosComRevisoes,
          pctPrimeiraTentativa:
            totalAprovados === 0 ? null : (aprovadosPrimeiraTentativa / totalAprovados) * 100,
        };
      }
    }
  } catch {
    taxaAprovacaoPrimeiraTranche = null;
  }

  let paradosEntreTranches15Dias: PainelCreditoObraEspecificidades['paradosEntreTranches15Dias'] =
    null;
  try {
    const coFaseIds = new Set(faseIdsPorSlugs(input.fases, CO_FASE_SLUGS));
    if (coFaseIds.size > 0) {
      const itens: NonNullable<
        PainelCreditoObraEspecificidades['paradosEntreTranches15Dias']
      >['itens'] = [];

      for (const c of input.cards) {
        if (!coFaseIds.has(c.fase_id)) continue;
        if (!cardAtivo(c)) continue;

        const historico = historicoPorCard.get(c.id) ?? [];
        let entered = c.entered_fase_at?.trim() || null;
        if (!entered) {
          entered = primeiraEntradaFase(c, c.fase_id, fasesOrd, historico);
        }
        const dias = diasDesdeEnteredFaseAt(entered);
        if (dias == null || dias <= 15) continue;

        itens.push({
          cardId: c.id,
          titulo: c.titulo?.trim() || c.id.slice(0, 8),
          faseNome: faseById.get(c.fase_id)?.nome ?? '—',
          diasParados: Math.floor(dias),
        });
      }

      itens.sort((a, b) => b.diasParados - a.diasParados);

      paradosEntreTranches15Dias = {
        acima15Dias: itens.length,
        itens,
      };
    }
  } catch {
    paradosEntreTranches15Dias = null;
  }

  let correlacaoAtrasoOperacoes: PainelCreditoObraEspecificidades['correlacaoAtrasoOperacoes'] = null;
  try {
    const projetoIndisponivel =
      input.creditoObraFieldsAvailable === false ||
      (input.creditoObraFieldsAvailable !== true && !campoDisponivel(input.cards, 'projeto_id'));

    const operacoesIndisponivel =
      input.operacoesIrmaosAvailable === false ||
      !input.operacoesFases?.length ||
      !input.operacoesIrmaos?.length;

    if (!projetoIndisponivel && !operacoesIndisponivel) {
      const irmaosPorProjeto = new Map<string, PainelCreditoObraOperacoesIrmaoDTO>();
      for (const irmao of input.operacoesIrmaos ?? []) {
        const pid = irmao.projeto_id.trim();
        if (!pid) continue;
        if (!irmaosPorProjeto.has(pid)) irmaosPorProjeto.set(pid, irmao);
      }

      let projetosDuploAtraso = 0;

      for (const c of input.cards) {
        if (!cardAtivo(c)) continue;
        const pid = c.projeto_id?.trim();
        if (!pid) continue;
        const irmao = irmaosPorProjeto.get(pid);
        if (!irmao || !cardAtivo(irmao)) continue;

        const credAtras = cardAtrasadoNaFase(c, input.fases);
        const opAtras = cardAtrasadoNaFase(irmao, input.operacoesFases ?? []);
        if (credAtras && opAtras) projetosDuploAtraso += 1;
      }

      correlacaoAtrasoOperacoes = {
        projetosDuploAtraso,
        operacoesIndisponivel: false,
        projetoIndisponivel: false,
      };
    } else {
      correlacaoAtrasoOperacoes = {
        projetosDuploAtraso: 0,
        operacoesIndisponivel,
        projetoIndisponivel,
      };
    }
  } catch {
    correlacaoAtrasoOperacoes = null;
  }

  const temAlgum =
    tempoMedioPorTranche != null ||
    taxaAprovacaoPrimeiraTranche != null ||
    paradosEntreTranches15Dias != null ||
    correlacaoAtrasoOperacoes != null;

  if (!temAlgum) return null;

  return {
    tempoMedioPorTranche,
    taxaAprovacaoPrimeiraTranche,
    paradosEntreTranches15Dias,
    correlacaoAtrasoOperacoes,
  };
}
