import { diasUteisDecorridos } from '@/lib/kanban/painel-performance-compute';
import type {
  GargaloClassificacao,
  GargaloMotivoTipo,
  GargaloScoreFase,
  PainelCardDTO,
  PainelFaseDTO,
  PainelHistoricoMovimentoDTO,
} from '@/lib/kanban/painel-performance-types';

const DIAS_INATIVIDADE_MIN = 5;

const PESO_VOLUME = 15;
const PESO_ATRASO = 20;
const PESO_INATIVIDADE = 15;
const PESO_PERDA = 20;
const PESO_CHAMADOS = 15;
const PESO_ARQUIVAMENTO = 15;

const MOTIVO_LABEL: Record<GargaloMotivoTipo, string> = {
  volume: 'Volume',
  atraso: 'Atraso',
  inatividade: 'Inatividade',
  perda_conversao: 'Perda de conversão',
  chamados: 'Chamados',
  arquivamento: 'Arquivamento',
  arquivamento_sem_motivo: 'Arquivamento sem motivo',
};

const MOTIVO_PESO: Record<GargaloMotivoTipo, number> = {
  volume: PESO_VOLUME,
  atraso: PESO_ATRASO,
  inatividade: PESO_INATIVIDADE,
  perda_conversao: PESO_PERDA,
  chamados: PESO_CHAMADOS,
  arquivamento: PESO_ARQUIVAMENTO,
  arquivamento_sem_motivo: PESO_ARQUIVAMENTO,
};

function buildHistoricoPorCard(rows: PainelHistoricoMovimentoDTO[]): Map<string, PainelHistoricoMovimentoDTO[]> {
  const m = new Map<string, PainelHistoricoMovimentoDTO[]>();
  for (const r of rows) {
    const list = m.get(r.card_id) ?? [];
    list.push(r);
    m.set(r.card_id, list);
  }
  return m;
}

function cardAtivo(c: PainelCardDTO): boolean {
  return !c.arquivado && !c.concluido;
}

function cardSemMovimentacao(
  card: PainelCardDTO,
  historicoPorCard: Map<string, PainelHistoricoMovimentoDTO[]>,
): boolean {
  const ref = card.entered_fase_at ?? card.updated_at ?? card.created_at;
  const diasNaFase = diasUteisDecorridos(ref);
  if (diasNaFase < DIAS_INATIVIDADE_MIN) return false;

  const refMs = new Date(ref).getTime();
  const movs = historicoPorCard.get(card.id) ?? [];
  const houveMovimentacao = movs.some((h) => {
    if (h.acao !== 'fase_avancada' && h.acao !== 'fase_retrocedida') return false;
    const t = new Date(h.criado_em).getTime();
    return Number.isFinite(t) && t >= refMs;
  });
  return !houveMovimentacao;
}

function normalizeMinMax(values: number[]): number[] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === min) return values.map(() => 0);
  return values.map((v) => ((v - min) / (max - min)) * 100);
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function classificarScore(score: number): GargaloClassificacao {
  if (score >= 70) return 'critico';
  if (score >= 40) return 'atencao';
  return 'baixo';
}

function classificacaoLabel(c: GargaloClassificacao): string {
  if (c === 'critico') return 'crítico';
  if (c === 'atencao') return 'de atenção';
  return 'operacional';
}

function pickPrincipalMotivo(input: {
  volume: number;
  atraso: number;
  inatividade: number;
  perdaConversao: number;
  chamados: number;
  arquivamento: number;
  arquivamentoSemMotivo: number;
}): { tipo: GargaloMotivoTipo; label: string; valor: number } {
  const candidatos: Array<{ tipo: GargaloMotivoTipo; label: string; valor: number }> = [
    { tipo: 'volume', label: MOTIVO_LABEL.volume, valor: input.volume },
    { tipo: 'atraso', label: MOTIVO_LABEL.atraso, valor: input.atraso },
    { tipo: 'inatividade', label: MOTIVO_LABEL.inatividade, valor: input.inatividade },
    { tipo: 'perda_conversao', label: MOTIVO_LABEL.perda_conversao, valor: input.perdaConversao },
    { tipo: 'chamados', label: MOTIVO_LABEL.chamados, valor: input.chamados },
    { tipo: 'arquivamento', label: MOTIVO_LABEL.arquivamento, valor: input.arquivamento },
    {
      tipo: 'arquivamento_sem_motivo',
      label: MOTIVO_LABEL.arquivamento_sem_motivo,
      valor: input.arquivamentoSemMotivo,
    },
  ];
  candidatos.sort(
    (a, b) => b.valor * MOTIVO_PESO[b.tipo] - a.valor * MOTIVO_PESO[a.tipo],
  );
  return candidatos[0] ?? { tipo: 'volume', label: MOTIVO_LABEL.volume, valor: 0 };
}

function buildPrincipalMotivoTexto(
  faseNome: string,
  classificacao: GargaloClassificacao,
  principalLabel: string,
  ctx: {
    pctArquivamentosAntesConversaoGlobal: number | null;
    pctChamadosTravaGlobal: number | null;
    pctArquivamentosGlobal: number | null;
    pctArquivamentosSemMotivoGlobal: number | null;
  },
): string {
  const cls = classificacaoLabel(classificacao);
  const partes: string[] = [];

  if (
    ctx.pctArquivamentosAntesConversaoGlobal != null &&
    ctx.pctArquivamentosAntesConversaoGlobal >= 20
  ) {
    partes.push(
      `concentra ${Math.round(ctx.pctArquivamentosAntesConversaoGlobal)}% dos arquivamentos antes da conversão`,
    );
  }
  if (ctx.pctChamadosTravaGlobal != null && ctx.pctChamadosTravaGlobal >= 30) {
    partes.push(`${Math.round(ctx.pctChamadosTravaGlobal)}% dos chamados com trava`);
  }
  if (ctx.pctArquivamentosGlobal != null && ctx.pctArquivamentosGlobal >= 25) {
    partes.push(`${Math.round(ctx.pctArquivamentosGlobal)}% dos arquivamentos do período`);
  }
  if (ctx.pctArquivamentosSemMotivoGlobal != null && ctx.pctArquivamentosSemMotivoGlobal >= 25) {
    partes.push(`${Math.round(ctx.pctArquivamentosSemMotivoGlobal)}% dos arquivamentos sem motivo`);
  }

  if (partes.length > 0) {
    return `${faseNome} é gargalo ${cls} porque ${partes.slice(0, 2).join(' e ')}.`;
  }
  return `${faseNome} é gargalo ${cls}: principal fator — ${principalLabel}.`;
}

export function computeGargaloScoreRanking(input: {
  fases: PainelFaseDTO[];
  cards: PainelCardDTO[];
  historicoMovimentos: PainelHistoricoMovimentoDTO[];
  chamadosAbertosPorFase: Map<
    string,
    { abertos: number; comTrava: number; atrasados: number }
  >;
  perdaConversaoPorFase: Map<string, number | null>;
  arquivamentoPorFase: Map<
    string,
    { total: number; antesConversao: number; semMotivo: number }
  >;
  totalArquivadosPeriodo: number;
  totalArquivamentosAntesConversao: number;
  totalArquivamentosSemMotivo: number;
  totalChamadosComTrava: number;
  cardAtrasadoNaFase: (card: PainelCardDTO, fase: PainelFaseDTO) => boolean;
  /** Pipeline: inatividade via `updated_at` sem carregar histórico. */
  cardSemMovimentacaoFn?: (card: PainelCardDTO) => boolean;
}): GargaloScoreFase[] {
  const fasesOrd = [...input.fases].sort((a, b) => a.ordem - b.ordem);
  const historicoPorCard = buildHistoricoPorCard(input.historicoMovimentos);
  const semMovFn =
    input.cardSemMovimentacaoFn ??
    ((card: PainelCardDTO) => cardSemMovimentacao(card, historicoPorCard));
  const cardsAtivos = input.cards.filter(cardAtivo);

  const raw = fasesOrd.map((fase) => {
    const naFase = cardsAtivos.filter((c) => c.fase_id === fase.id);
    const cardsNaFase = naFase.length;
    const cardsAtrasados = naFase.filter((c) => input.cardAtrasadoNaFase(c, fase)).length;
    const cardsSemMovimentacao = naFase.filter((c) => semMovFn(c)).length;
    const pctAtrasados = cardsNaFase === 0 ? 0 : (cardsAtrasados / cardsNaFase) * 100;
    const pctSemMovimentacao = cardsNaFase === 0 ? 0 : (cardsSemMovimentacao / cardsNaFase) * 100;

    const ch = input.chamadosAbertosPorFase.get(fase.id) ?? {
      abertos: 0,
      comTrava: 0,
      atrasados: 0,
    };
    const arq = input.arquivamentoPorFase.get(fase.id) ?? {
      total: 0,
      antesConversao: 0,
      semMotivo: 0,
    };

    const perdaRaw = input.perdaConversaoPorFase.get(fase.id);
    const perdaConversaoPct = perdaRaw != null ? clampPct(perdaRaw) : 0;
    const chamadosRaw = ch.abertos + ch.comTrava * 2 + ch.atrasados * 1.5;
    const arquivamentoRaw = arq.total + arq.antesConversao * 2 + arq.semMotivo * 1.5;
    const arquivamentoSemMotivoRaw = arq.semMotivo;

    const pctArquivamentoNaFase =
      input.totalArquivadosPeriodo === 0
        ? null
        : clampPct((arq.total / input.totalArquivadosPeriodo) * 100);

    return {
      fase,
      cardsNaFase,
      cardsAtrasados,
      cardsSemMovimentacao,
      pctAtrasados: clampPct(pctAtrasados),
      pctSemMovimentacao: clampPct(pctSemMovimentacao),
      chamadosAbertos: ch.abertos,
      chamadosComTrava: ch.comTrava,
      chamadosAtrasados: ch.atrasados,
      perdaConversaoPct: perdaRaw,
      chamadosRaw,
      cardsArquivados: arq.total,
      arquivamentosAntesConversao: arq.antesConversao,
      arquivamentosSemMotivo: arq.semMotivo,
      pctArquivamentoNaFase,
      arquivamentoRaw,
      arquivamentoSemMotivoRaw,
    };
  });

  const volumesNorm = normalizeMinMax(raw.map((r) => r.cardsNaFase));
  const chamadosNorm = normalizeMinMax(raw.map((r) => r.chamadosRaw));
  const arquivamentoNorm = normalizeMinMax(raw.map((r) => r.arquivamentoRaw));
  const arquivamentoSemMotivoNorm = normalizeMinMax(raw.map((r) => r.arquivamentoSemMotivoRaw));

  const scored = raw.map((row, idx) => {
    const volumeNorm = volumesNorm[idx] ?? 0;
    const atrasoNorm = row.pctAtrasados;
    const inatividadeNorm = row.pctSemMovimentacao;
    const perdaNorm = row.perdaConversaoPct != null ? clampPct(row.perdaConversaoPct) : 0;
    const chamadosNormVal = chamadosNorm[idx] ?? 0;
    const arquivamentoNormVal = arquivamentoNorm[idx] ?? 0;
    const arquivamentoSemMotivoNormVal = arquivamentoSemMotivoNorm[idx] ?? 0;

    const score = Math.round(
      volumeNorm * (PESO_VOLUME / 100) +
        atrasoNorm * (PESO_ATRASO / 100) +
        inatividadeNorm * (PESO_INATIVIDADE / 100) +
        perdaNorm * (PESO_PERDA / 100) +
        chamadosNormVal * (PESO_CHAMADOS / 100) +
        arquivamentoNormVal * (PESO_ARQUIVAMENTO / 100),
    );

    const principal = pickPrincipalMotivo({
      volume: volumeNorm,
      atraso: atrasoNorm,
      inatividade: inatividadeNorm,
      perdaConversao: perdaNorm,
      chamados: chamadosNormVal,
      arquivamento: arquivamentoNormVal,
      arquivamentoSemMotivo: arquivamentoSemMotivoNormVal,
    });

    const pctArquivamentosAntesConversaoGlobal =
      input.totalArquivamentosAntesConversao === 0
        ? null
        : clampPct((row.arquivamentosAntesConversao / input.totalArquivamentosAntesConversao) * 100);
    const pctChamadosTravaGlobal =
      input.totalChamadosComTrava === 0
        ? null
        : clampPct((row.chamadosComTrava / input.totalChamadosComTrava) * 100);
    const pctArquivamentosGlobal = row.pctArquivamentoNaFase;
    const pctArquivamentosSemMotivoGlobal =
      input.totalArquivamentosSemMotivo === 0
        ? null
        : clampPct((row.arquivamentosSemMotivo / input.totalArquivamentosSemMotivo) * 100);

    const classificacao = classificarScore(score);
    const principalMotivoTexto = buildPrincipalMotivoTexto(
      row.fase.nome,
      classificacao,
      principal.label,
      {
        pctArquivamentosAntesConversaoGlobal,
        pctChamadosTravaGlobal,
        pctArquivamentosGlobal,
        pctArquivamentosSemMotivoGlobal,
      },
    );

    return {
      faseId: row.fase.id,
      faseNome: row.fase.nome,
      ordem: row.fase.ordem,
      faseConversao: row.fase.fase_conversao,
      score,
      classificacao,
      principalMotivoTipo: principal.tipo,
      principalMotivo: principal.label,
      principalMotivoTexto,
      cardsNaFase: row.cardsNaFase,
      cardsAtrasados: row.cardsAtrasados,
      cardsSemMovimentacao: row.cardsSemMovimentacao,
      pctAtrasados: row.cardsNaFase === 0 ? null : row.pctAtrasados,
      pctSemMovimentacao: row.cardsNaFase === 0 ? null : row.pctSemMovimentacao,
      chamadosAbertos: row.chamadosAbertos,
      chamadosComTrava: row.chamadosComTrava,
      chamadosAtrasados: row.chamadosAtrasados,
      perdaConversaoPct: row.perdaConversaoPct ?? null,
      cardsArquivados: row.cardsArquivados,
      pctArquivamentoNaFase: row.pctArquivamentoNaFase,
      arquivamentosSemMotivo: row.arquivamentosSemMotivo,
      arquivamentosAntesConversao: row.arquivamentosAntesConversao,
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}
