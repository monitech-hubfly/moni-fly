import { buildNativeFaseTimeline } from '@/lib/kanban/kanban-card-timeline';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import { calcularStatusSLA } from '@/lib/dias-uteis';
import type {
  PainelCardDTO,
  PainelCreditoObraOperacoesIrmaoDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelRetrocessoDTO,
} from '@/lib/kanban/painel-performance-types';

const MS_15_DIAS = 15 * 24 * 60 * 60 * 1000;

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

const ENTRE_TRANCHES_FASE_SLUGS = [
  FASE_SLUGS.CO_NECESSIDADE_3A_TRANCHE,
  FASE_SLUGS.CO_NECESSIDADE_4A_TRANCHE,
  FASE_SLUGS.CO_NECESSIDADE_5A_TRANCHE,
  FASE_SLUGS.CO_NECESSIDADE_6A_TRANCHE,
] as const;

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

export type PainelCreditoObraTrancheTempoRow = {
  tranche: string;
  mediaDias: number | null;
  amostras: number;
};

export type PainelCreditoObraEspecificidades = {
  tempoMedioPorTranche: {
    linhas: PainelCreditoObraTrancheTempoRow[];
    historicoParcial: boolean;
  } | null;
  taxaAprovacaoPrimeiraTranche: {
    aprovadosPrimeiraTentativa: number;
    aprovadosComRevisoes: number;
    totalAprovados: number;
    pctPrimeiraTentativa: number | null;
    pctComRevisoes: number | null;
  } | null;
  paradosEntreTranches15Dias: {
    acima15Dias: number;
    totalNaFase: number;
    percentual: number | null;
  } | null;
  correlacaoAtrasoOperacoes: {
    projetosComPar: number;
    ambosAtrasados: number;
    soCreditoAtrasado: number;
    soOperacoesAtrasado: number;
    pctAmbosEntrePares: number | null;
    pctAmbosEntreAtrasados: number | null;
    operacoesIndisponivel: boolean;
    projetoIndisponivel: boolean;
  } | null;
};

/** Métricas específicas do Funil Crédito Obra. Degrada por bloco quando dados ausentes. */
export function computeCreditoObraEspecificidades(input: {
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
  const fasesOrd = [...input.fases].sort((a, b) => a.ordem - b.ordem);

  let tempoMedioPorTranche: PainelCreditoObraEspecificidades['tempoMedioPorTranche'] = null;
  try {
    const linhas: PainelCreditoObraTrancheTempoRow[] = [];
    let historicoParcial = false;

    for (const bloco of TRANCHE_BLOCOS) {
      const inicioId = faseIdPorSlug(input.fases, bloco.inicio);
      const fimId = faseIdPorSlug(input.fases, bloco.fim);
      if (!inicioId || !fimId) continue;

      const tempos: number[] = [];
      for (const c of input.cards) {
        const historico = historicoPorCard.get(c.id) ?? [];
        const temMov = historico.some(
          (h) =>
            h.acao === 'fase_avancada' || h.acao === 'fase_retrocedida' || h.acao === 'card_criado',
        );
        if (!temMov) historicoParcial = true;
        const dias = diasEntreFases(c, inicioId, fimId, fasesOrd, historico);
        if (dias != null) tempos.push(dias);
      }

      linhas.push({
        tranche: bloco.label,
        mediaDias:
          tempos.length === 0 ? null : tempos.reduce((s, n) => s + n, 0) / tempos.length,
        amostras: tempos.length,
      });
    }

    if (linhas.length > 0) {
      tempoMedioPorTranche = { linhas, historicoParcial };
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
          totalAprovados,
          pctPrimeiraTentativa:
            totalAprovados === 0 ? null : (aprovadosPrimeiraTentativa / totalAprovados) * 100,
          pctComRevisoes:
            totalAprovados === 0 ? null : (aprovadosComRevisoes / totalAprovados) * 100,
        };
      }
    }
  } catch {
    taxaAprovacaoPrimeiraTranche = null;
  }

  let paradosEntreTranches15Dias: PainelCreditoObraEspecificidades['paradosEntreTranches15Dias'] =
    null;
  try {
    const entreTranchesIds = new Set(faseIdsPorSlugs(input.fases, ENTRE_TRANCHES_FASE_SLUGS));
    if (entreTranchesIds.size > 0) {
      const now = Date.now();
      let acima15Dias = 0;
      let totalNaFase = 0;

      for (const c of input.cards) {
        if (!entreTranchesIds.has(c.fase_id)) continue;
        if (!cardAtivo(c)) continue;
        totalNaFase += 1;

        const historico = historicoPorCard.get(c.id) ?? [];
        let entered = c.entered_fase_at?.trim() || null;
        if (!entered) {
          entered = primeiraEntradaFase(c, c.fase_id, fasesOrd, historico);
        }
        if (!entered) continue;
        const t = new Date(entered).getTime();
        if (Number.isFinite(t) && now - t > MS_15_DIAS) acima15Dias += 1;
      }

      paradosEntreTranches15Dias = {
        acima15Dias,
        totalNaFase,
        percentual: totalNaFase === 0 ? null : (acima15Dias / totalNaFase) * 100,
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

      let projetosComPar = 0;
      let ambosAtrasados = 0;
      let soCreditoAtrasado = 0;
      let soOperacoesAtrasado = 0;

      for (const c of input.cards) {
        if (!cardAtivo(c)) continue;
        const pid = c.projeto_id?.trim();
        if (!pid) continue;
        const irmao = irmaosPorProjeto.get(pid);
        if (!irmao || !cardAtivo(irmao)) continue;

        projetosComPar += 1;
        const credAtras = cardAtrasadoNaFase(c, input.fases);
        const opAtras = cardAtrasadoNaFase(irmao, input.operacoesFases ?? []);

        if (credAtras && opAtras) ambosAtrasados += 1;
        else if (credAtras) soCreditoAtrasado += 1;
        else if (opAtras) soOperacoesAtrasado += 1;
      }

      const totalAtrasados = ambosAtrasados + soCreditoAtrasado + soOperacoesAtrasado;

      correlacaoAtrasoOperacoes = {
        projetosComPar,
        ambosAtrasados,
        soCreditoAtrasado,
        soOperacoesAtrasado,
        pctAmbosEntrePares:
          projetosComPar === 0 ? null : (ambosAtrasados / projetosComPar) * 100,
        pctAmbosEntreAtrasados:
          totalAtrasados === 0 ? null : (ambosAtrasados / totalAtrasados) * 100,
        operacoesIndisponivel: false,
        projetoIndisponivel: false,
      };
    } else if (!projetoIndisponivel || input.operacoesIrmaosAvailable === false) {
      correlacaoAtrasoOperacoes = {
        projetosComPar: 0,
        ambosAtrasados: 0,
        soCreditoAtrasado: 0,
        soOperacoesAtrasado: 0,
        pctAmbosEntrePares: null,
        pctAmbosEntreAtrasados: null,
        operacoesIndisponivel: operacoesIndisponivel,
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
