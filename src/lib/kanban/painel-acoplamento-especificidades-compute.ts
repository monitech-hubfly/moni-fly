import { buildNativeFaseTimeline } from '@/lib/kanban/kanban-card-timeline';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import type {
  PainelCardDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
  PainelRetrocessoDTO,
} from '@/lib/kanban/painel-performance-types';

const ALTERACOES_ACOPLAMENTO_SLUGS = ['alteracoes_acoplamento'] as const;
const MODELAGEM_TERRENO_SLUGS = ['modelagem_terreno'] as const;
const APROVADO_SLUGS = [FASE_SLUGS.ACOPLAMENTO_APROVADO] as const;
const PARALISADOS_SLUGS = [FASE_SLUGS.ACOPLAMENTO_REPROVADO] as const;
const MODELAGEM_CASA_SLUGS = [FASE_SLUGS.MODELAGEM_CASA_GBOX] as const;

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

function buildRetrocessoPorCard(rows: PainelRetrocessoDTO[]): Map<string, PainelRetrocessoDTO[]> {
  const m = new Map<string, PainelRetrocessoDTO[]>();
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
  return linhas.find((l) => l.faseId === faseId)?.entrouEm ?? null;
}

function diasNaFaseViaTimeline(
  card: PainelCardDTO,
  faseId: string,
  fasesOrd: PainelFaseDTO[],
  historico: PainelHistoricoMovimentoDTO[],
): number | null {
  const linhas = buildNativeFaseTimeline(
    fasesOrd,
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

function cardComRevisoesAntesAprovado(
  card: PainelCardDTO,
  alteracoesIds: Set<string>,
  aprovadoId: string,
  fasesOrd: PainelFaseDTO[],
  historico: PainelHistoricoMovimentoDTO[],
  retrocessos: PainelRetrocessoDTO[],
): boolean {
  const aprovadoEm = primeiraEntradaFase(card, aprovadoId, fasesOrd, historico);
  if (!aprovadoEm) return false;

  for (const r of retrocessos) {
    const novaId = detStr(r.detalhe, 'fase_nova_id');
    if (alteracoesIds.has(novaId)) return true;
    const novaNome = detStr(r.detalhe, 'fase_nova_nome').toLowerCase();
    if (novaNome.includes('altera')) return true;
  }

  for (const faseId of alteracoesIds) {
    const entrouAlteracoes = primeiraEntradaFase(card, faseId, fasesOrd, historico);
    if (!entrouAlteracoes) continue;
    if (new Date(entrouAlteracoes).getTime() < new Date(aprovadoEm).getTime()) return true;
  }

  return false;
}

export type PainelAcoplamentoOrigemRow = {
  origem: string;
  quantidade: number;
  percentual: number | null;
};

export type PainelAcoplamentoEspecificidades = {
  taxaAprovacaoTentativa: {
    aprovadosPrimeiraTentativa: number;
    aprovadosComRevisoes: number;
    totalAprovados: number;
    pctPrimeiraTentativa: number | null;
    pctComRevisoes: number | null;
  } | null;
  acoplamentosPorOrigem: {
    linhas: PainelAcoplamentoOrigemRow[];
    total: number;
    origemIndisponivel: boolean;
  } | null;
  paralisadosPct: {
    emParalisados: number;
    totalCards: number;
    percentual: number | null;
  } | null;
  tempoModelagemTerrenoCasa: {
    mediaDias: number | null;
    amostras: number;
    historicoParcial: boolean;
  } | null;
};

/** Métricas específicas do Funil Acoplamento. Degrada por bloco quando dados ausentes. */
export function computeAcoplamentoEspecificidades(input: {
  fases: PainelFaseDTO[];
  cards: PainelCardDTO[];
  historicoMovimentos: PainelHistoricoMovimentoDTO[];
  retrocessoRows: PainelRetrocessoDTO[];
  origemKanbanDisponivel?: boolean;
}): PainelAcoplamentoEspecificidades | null {
  const historicoPorCard = buildHistoricoPorCard(input.historicoMovimentos);
  const retrocessoPorCard = buildRetrocessoPorCard(input.retrocessoRows);
  const fasesOrd = [...input.fases].sort((a, b) => a.ordem - b.ordem);

  const alteracoesIds = new Set(faseIdsPorSlugs(input.fases, ALTERACOES_ACOPLAMENTO_SLUGS));
  const aprovadoIds = faseIdsPorSlugs(input.fases, APROVADO_SLUGS);
  const paralisadosIds = new Set(faseIdsPorSlugs(input.fases, PARALISADOS_SLUGS));
  const terrenoIds = faseIdsPorSlugs(input.fases, MODELAGEM_TERRENO_SLUGS);
  const casaIds = faseIdsPorSlugs(input.fases, MODELAGEM_CASA_SLUGS);

  let taxaAprovacaoTentativa: PainelAcoplamentoEspecificidades['taxaAprovacaoTentativa'] = null;
  try {
    if (aprovadoIds.length > 0 && alteracoesIds.size > 0) {
      const aprovadoId = aprovadoIds[0]!;
      const aprovadoSet = new Set(aprovadoIds);
      let aprovadosPrimeiraTentativa = 0;
      let aprovadosComRevisoes = 0;

      for (const c of input.cards) {
        if (!cardVisitouFase(c, aprovadoSet, historicoPorCard)) continue;
        const historico = historicoPorCard.get(c.id) ?? [];
        const retrocessos = retrocessoPorCard.get(c.id) ?? [];
        if (
          cardComRevisoesAntesAprovado(
            c,
            alteracoesIds,
            aprovadoId,
            fasesOrd,
            historico,
            retrocessos,
          )
        ) {
          aprovadosComRevisoes += 1;
        } else {
          aprovadosPrimeiraTentativa += 1;
        }
      }

      const totalAprovados = aprovadosPrimeiraTentativa + aprovadosComRevisoes;
      taxaAprovacaoTentativa = {
        aprovadosPrimeiraTentativa,
        aprovadosComRevisoes,
        totalAprovados,
        pctPrimeiraTentativa:
          totalAprovados === 0 ? null : (aprovadosPrimeiraTentativa / totalAprovados) * 100,
        pctComRevisoes:
          totalAprovados === 0 ? null : (aprovadosComRevisoes / totalAprovados) * 100,
      };
    }
  } catch {
    taxaAprovacaoTentativa = null;
  }

  let acoplamentosPorOrigem: PainelAcoplamentoEspecificidades['acoplamentosPorOrigem'] = null;
  try {
    const origemIndisponivel =
      input.origemKanbanDisponivel === false ||
      (input.origemKanbanDisponivel !== true && !campoDisponivel(input.cards, 'origem_kanban_nome'));

    if (!origemIndisponivel || campoDisponivel(input.cards, 'origem_kanban_nome')) {
      const porOrigem = new Map<string, number>();
      for (const c of input.cards) {
        const origem = c.origem_kanban_nome?.trim() || 'Origem não informada';
        porOrigem.set(origem, (porOrigem.get(origem) ?? 0) + 1);
      }
      const total = input.cards.length;
      const linhas: PainelAcoplamentoOrigemRow[] = [...porOrigem.entries()]
        .map(([origem, quantidade]) => ({
          origem,
          quantidade,
          percentual: total === 0 ? null : (quantidade / total) * 100,
        }))
        .sort((a, b) => b.quantidade - a.quantidade);

      if (total > 0 || !origemIndisponivel) {
        acoplamentosPorOrigem = { linhas, total, origemIndisponivel };
      }
    }
  } catch {
    acoplamentosPorOrigem = null;
  }

  let paralisadosPct: PainelAcoplamentoEspecificidades['paralisadosPct'] = null;
  try {
    if (paralisadosIds.size > 0) {
      const ativos = input.cards.filter((c) => !c.arquivado && !c.concluido);
      const emParalisados = ativos.filter((c) => paralisadosIds.has(c.fase_id)).length;
      paralisadosPct = {
        emParalisados,
        totalCards: ativos.length,
        percentual: ativos.length === 0 ? null : (emParalisados / ativos.length) * 100,
      };
    }
  } catch {
    paralisadosPct = null;
  }

  let tempoModelagemTerrenoCasa: PainelAcoplamentoEspecificidades['tempoModelagemTerrenoCasa'] = null;
  try {
    if (terrenoIds.length > 0 || casaIds.length > 0) {
      const temposCombinados: number[] = [];
      let historicoParcial = false;

      for (const c of input.cards) {
        const historico = historicoPorCard.get(c.id) ?? [];
        const temMov = historico.some(
          (h) =>
            h.acao === 'fase_avancada' || h.acao === 'fase_retrocedida' || h.acao === 'card_criado',
        );
        if (!temMov) historicoParcial = true;

        let soma = 0;
        let temAlguma = false;
        for (const faseId of terrenoIds) {
          const dias = diasNaFaseViaTimeline(c, faseId, fasesOrd, historico);
          if (dias != null) {
            soma += dias;
            temAlguma = true;
          }
        }
        for (const faseId of casaIds) {
          const dias = diasNaFaseViaTimeline(c, faseId, fasesOrd, historico);
          if (dias != null) {
            soma += dias;
            temAlguma = true;
          }
        }
        if (temAlguma) temposCombinados.push(soma);
      }

      tempoModelagemTerrenoCasa = {
        mediaDias:
          temposCombinados.length === 0
            ? null
            : temposCombinados.reduce((s, n) => s + n, 0) / temposCombinados.length,
        amostras: temposCombinados.length,
        historicoParcial,
      };
    }
  } catch {
    tempoModelagemTerrenoCasa = null;
  }

  const temAlgum =
    taxaAprovacaoTentativa != null ||
    acoplamentosPorOrigem != null ||
    paralisadosPct != null ||
    tempoModelagemTerrenoCasa != null;

  if (!temAlgum) return null;

  return {
    taxaAprovacaoTentativa,
    acoplamentosPorOrigem,
    paralisadosPct,
    tempoModelagemTerrenoCasa,
  };
}
