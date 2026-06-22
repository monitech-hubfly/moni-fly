import type { KanbanFase } from '@/components/kanban-shared/types';
import { calcularDiasCorridos, formatLocalYmd, isDiaUtil, parseIsoDateOnlyLocal, normalizarSlaTipo, type SlaTipo } from '@/lib/dias-uteis';
import { addBusinessDays, type FaseTimelineStatus } from '@/lib/kanban/previsibilidade-operacoes';
import { lastVisitPerFase, type FaseVisit } from '@/lib/kanban/kanban-card-timeline';

export type { FaseTimelineStatus };

export type CalculadoraFaseLinha = {
  faseId: string;
  faseNome: string;
  ordem: number;
  faseAtiva: boolean;
  slaDias: number | null;
  slaTipo: SlaTipo;
  dataInicioReal: string | null;
  dataFimEstimada: string | null;
  dataFimReal: string | null;
  /** Atraso na unidade do SLA da fase (d.u. ou d.c.). */
  atrasoDias: number | null;
  status: FaseTimelineStatus;
  /** Funil da esteira principal (Step One / Portfólio / Pré Obra e Obra). */
  funilLabel?: string;
};

export type CalculadoraStatusGeral = 'ok' | 'atencao' | 'atrasado' | 'concluido';

export type CalculadoraMaiorGargalo = {
  faseNome: string;
  motivo: 'atraso' | 'permanencia';
  dias: number;
  unidade: SlaTipo;
};

export type CalculadoraResumoExecutivo = {
  faseAtualNome: string | null;
  diasNaFase: number | null;
  diasNaFaseTipo: SlaTipo;
  statusGeral: CalculadoraStatusGeral;
  statusGeralLabel: string;
  atrasoAcumuladoUteis: number;
  atrasoAcumuladoCorridos: number;
  percentualConcluido: number;
  fasesConcluidas: number;
  fasesTotal: number;
  maiorGargalo: CalculadoraMaiorGargalo | null;
  previsaoConclusao: string | null;
  dadosParciais: boolean;
};

export type CalculadoraFasesInput = {
  fases: KanbanFase[];
  card: {
    fase_id: string;
    created_at: string;
    entered_fase_at?: string | null;
    concluido?: boolean;
    concluido_em?: string | null;
  };
  visits: FaseVisit[];
  /** Referência para fase atual atrasada (default: hoje). */
  hoje?: Date;
};

export const CALCULADORA_STATUS_LABEL: Record<FaseTimelineStatus, string> = {
  futura: 'Futura',
  atual: 'Em andamento',
  atual_atrasada: 'Em andamento (atraso)',
  concluida: 'Passada',
  concluida_atraso: 'Passada (atraso)',
};

export const CALCULADORA_STATUS_GERAL_LABEL: Record<CalculadoraStatusGeral, string> = {
  ok: 'No prazo',
  atencao: 'Atenção',
  atrasado: 'Em atraso',
  concluido: 'Concluído',
};

function addDiasPorTipo(baseYmd: string, dias: number, slaTipo: SlaTipo): string {
  if (dias <= 0) return baseYmd;
  const base = parseIsoDateOnlyLocal(baseYmd);
  if (!base) return baseYmd;
  if (slaTipo === 'corridos') {
    const fim = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    fim.setDate(fim.getDate() + dias);
    return formatLocalYmd(fim);
  }
  return formatLocalYmd(addBusinessDays(base, dias));
}

function diasDecorridosNaFase(inicioYmd: string, hoje: string): number {
  const a = parseIsoDateOnlyLocal(inicioYmd);
  const b = parseIsoDateOnlyLocal(hoje);
  if (!a || !b) return 0;
  if (b.getTime() < a.getTime()) return 0;
  return calcularDiasCorridos(a, b);
}

function diasNaFasePorTipo(inicioYmd: string, hoje: string, slaTipo: SlaTipo): number {
  if (slaTipo === 'corridos') return diasDecorridosNaFase(inicioYmd, hoje);
  return businessDaysBetween(inicioYmd, hoje);
}

function faseContribuiAtrasoAcumulado(status: FaseTimelineStatus): boolean {
  return status === 'concluida_atraso' || status === 'atual_atrasada';
}

function detectarDadosParciais(linhas: CalculadoraFaseLinha[], visits: FaseVisit[]): boolean {
  if (linhas.length === 0) return false;

  const ordemAtual =
    linhas.find((l) => l.status === 'atual' || l.status === 'atual_atrasada')?.ordem ??
    linhas.find((l) => l.status === 'futura')?.ordem ??
    Number.MAX_SAFE_INTEGER;

  for (const row of linhas) {
    if (row.ordem >= ordemAtual) continue;
    if (row.status === 'concluida' || row.status === 'concluida_atraso') {
      if (!row.dataInicioReal || !row.dataFimReal) return true;
    }
  }

  const atual = linhas.find((l) => l.status === 'atual' || l.status === 'atual_atrasada');
  if (atual && !atual.dataInicioReal) return true;

  if (visits.length === 0 && ordemAtual > (linhas[0]?.ordem ?? 0)) return true;

  return false;
}

function faseEhAtiva(fase: KanbanFase): boolean {
  return fase.ativo !== false;
}

function slaRestanteFase(
  inicioYmd: string,
  slaDias: number,
  slaTipo: SlaTipo,
  hoje: string,
): number {
  const elapsed = slaTipo === 'corridos'
    ? diasDecorridosNaFase(inicioYmd, hoje)
    : businessDaysBetween(inicioYmd, hoje);
  return Math.max(0, slaDias - elapsed);
}

function toYmd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const head = String(iso).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
}

/** Primeiro dia útil na data ou após (seg–sex). */
function primeiroDiaUtilDe(ymd: string): string {
  const parsed = parseIsoDateOnlyLocal(ymd);
  if (!parsed) return ymd;
  const cur = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  while (!isDiaUtil(cur)) {
    cur.setDate(cur.getDate() + 1);
  }
  return formatLocalYmd(cur);
}

function inicioPorFimFaseAnterior(fimReal: string | null, fimEstimado: string | null): string | null {
  const fim = fimReal ?? fimEstimado;
  return fim ? primeiroDiaUtilDe(fim) : null;
}

function hojeYmd(ref?: Date): string {
  const d = ref ?? new Date();
  return formatLocalYmd(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Dias úteis (seg–sex, sem feriados) entre duas datas inclusive no fim. */
export function businessDaysBetween(inicioYmd: string, fimYmd: string): number {
  const a = parseIsoDateOnlyLocal(inicioYmd);
  const b = parseIsoDateOnlyLocal(fimYmd);
  if (!a || !b) return 0;
  if (b.getTime() <= a.getTime()) return 0;

  let count = 0;
  const cursor = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  cursor.setDate(cursor.getDate() + 1);

  while (cursor.getTime() <= b.getTime()) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function fimEstimadaPorSla(
  inicioYmd: string,
  slaDias: number | null,
  slaTipo: SlaTipo = 'uteis',
): string | null {
  if (!inicioYmd || slaDias == null || slaDias <= 0) return null;
  const base = parseIsoDateOnlyLocal(inicioYmd);
  if (!base) return null;
  if (slaTipo === 'corridos') {
    const fim = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    fim.setDate(fim.getDate() + slaDias);
    return formatLocalYmd(fim);
  }
  return formatLocalYmd(addBusinessDays(base, slaDias));
}

function calendarDaysBetween(inicioYmd: string, fimYmd: string): number {
  const a = parseIsoDateOnlyLocal(inicioYmd);
  const b = parseIsoDateOnlyLocal(fimYmd);
  if (!a || !b) return 0;
  if (b.getTime() <= a.getTime()) return 0;
  return calcularDiasCorridos(a, b);
}

function resolveStatus(
  faseId: string,
  card: CalculadoraFasesInput['card'],
  dataInicioReal: string | null,
  dataFimReal: string | null,
  dataFimEstimada: string | null,
  faseOrdem: number,
  ordemAtual: number,
  hoje: string,
): FaseTimelineStatus {
  const isCurrent = faseId === card.fase_id;
  const cardAtivo = !card.concluido;

  if (isCurrent && cardAtivo) {
    if (dataFimEstimada && hoje > dataFimEstimada) return 'atual_atrasada';
    return 'atual';
  }

  if (isCurrent && !cardAtivo) {
    if (dataFimEstimada && card.concluido_em) {
      const fim = toYmd(card.concluido_em);
      if (fim && fim > dataFimEstimada) return 'concluida_atraso';
    }
    return 'concluida';
  }

  /** Fases anteriores à atual na ordem do funil já foram percorridas — nunca "futura". */
  if (faseOrdem < ordemAtual) {
    if (dataFimReal && dataFimEstimada && dataFimReal > dataFimEstimada) return 'concluida_atraso';
    return 'concluida';
  }

  if (faseOrdem > ordemAtual) {
    return 'futura';
  }

  return 'futura';
}

function resolveAtraso(
  status: FaseTimelineStatus,
  dataFimEstimada: string | null,
  dataFimReal: string | null,
  hoje: string,
  slaTipo: SlaTipo = 'uteis',
): number | null {
  if (!dataFimEstimada) return null;
  const diff = slaTipo === 'corridos' ? calendarDaysBetween : businessDaysBetween;
  if (status === 'atual_atrasada') {
    const dias = diff(dataFimEstimada, hoje);
    return dias > 0 ? dias : null;
  }
  if (status === 'concluida_atraso' && dataFimReal) {
    const dias = diff(dataFimEstimada, dataFimReal);
    return dias > 0 ? dias : null;
  }
  return null;
}

/**
 * Calculadora Global de Fases — timeline por fase com SLA, datas e status.
 * Usa última passagem por fase (retrocessos) e fallback seguro se histórico incompleto.
 */
export function calcularLinhasCalculadoraFases(input: CalculadoraFasesInput): CalculadoraFaseLinha[] {
  try {
    const { fases, card, visits } = input;
    const hoje = hojeYmd(input.hoje);

    if (!fases.length) return [];

    const sorted = [...fases].sort((a, b) => a.ordem - b.ordem);
    const lastByFase = lastVisitPerFase(visits);
    const faseAtual = sorted.find((f) => f.id === card.fase_id);
    const ordemAtual = faseAtual?.ordem ?? Number.MAX_SAFE_INTEGER;

    const linhas: CalculadoraFaseLinha[] = [];
    let fimFaseAnteriorReal: string | null = null;
    let fimFaseAnteriorEstimado: string | null = null;

    for (const fase of sorted) {
      const last = lastByFase.get(fase.id);

      let dataFimReal = toYmd(last?.saiu);
      if (!dataFimReal && fase.id === card.fase_id && card.concluido && card.concluido_em) {
        dataFimReal = toYmd(card.concluido_em);
      }

      let dataInicioReal = inicioPorFimFaseAnterior(fimFaseAnteriorReal, fimFaseAnteriorEstimado);

      if (!dataInicioReal) {
        dataInicioReal = toYmd(last?.entrou);
        if (!dataInicioReal && fase.id === card.fase_id) {
          dataInicioReal = toYmd(card.entered_fase_at) ?? toYmd(card.created_at);
        }
        if (!dataInicioReal && fase.ordem === sorted[0]?.ordem) {
          dataInicioReal = toYmd(card.created_at);
        }
        if (dataInicioReal) {
          dataInicioReal = primeiroDiaUtilDe(dataInicioReal);
        }
      }

      const slaTipo = normalizarSlaTipo(fase.sla_tipo);
      const dataFimEstimada = dataInicioReal
        ? fimEstimadaPorSla(dataInicioReal, fase.sla_dias, slaTipo)
        : null;

      const status = resolveStatus(
        fase.id,
        card,
        dataInicioReal,
        dataFimReal,
        dataFimEstimada,
        fase.ordem,
        ordemAtual,
        hoje,
      );

      const atrasoDias = resolveAtraso(status, dataFimEstimada, dataFimReal, hoje, slaTipo);

      linhas.push({
        faseId: fase.id,
        faseNome: fase.nome,
        ordem: fase.ordem,
        faseAtiva: faseEhAtiva(fase),
        slaDias: fase.sla_dias,
        slaTipo,
        dataInicioReal,
        dataFimEstimada,
        dataFimReal,
        atrasoDias,
        status,
      });

      fimFaseAnteriorReal = dataFimReal;
      fimFaseAnteriorEstimado = dataFimEstimada;
    }

    return inferirFimRealPorProximaFase(linhas);
  } catch {
    return [];
  }
}

/** Preenche fim real a partir da entrada na fase seguinte (quando o histórico não registrou saída). */
export function inferirFimRealPorProximaFase(linhas: CalculadoraFaseLinha[]): CalculadoraFaseLinha[] {
  if (linhas.length === 0) return linhas;

  const out = linhas.map((l) => ({ ...l }));

  for (let i = 0; i < out.length - 1; i++) {
    const row = out[i]!;
    if (row.dataFimReal) continue;
    const concluida = row.status === 'concluida' || row.status === 'concluida_atraso';
    if (!concluida) continue;
    const proximoInicio = out[i + 1]!.dataInicioReal;
    if (proximoInicio) {
      out[i] = { ...row, dataFimReal: proximoInicio };
    }
  }

  return out;
}

function projectarPrevisaoConclusao(linhas: CalculadoraFaseLinha[], hoje: string): string | null {
  if (linhas.length === 0) return null;

  const sorted = [...linhas]
    .filter((l) => l.faseAtiva)
    .sort((a, b) => a.ordem - b.ordem);
  if (sorted.length === 0) return null;

  const idxAtual = sorted.findIndex((l) => l.status === 'atual' || l.status === 'atual_atrasada');
  const todasConcluidas = sorted.every(
    (l) => l.status === 'concluida' || l.status === 'concluida_atraso',
  );

  if (todasConcluidas) {
    const ultimaComFim = [...sorted].reverse().find((l) => l.dataFimReal);
    return ultimaComFim?.dataFimReal ?? null;
  }

  const startIdx = idxAtual >= 0 ? idxAtual : sorted.findIndex((l) => l.status === 'futura');
  if (startIdx < 0) return sorted.at(-1)?.dataFimEstimada ?? null;

  let cursor = hoje;

  for (let i = startIdx; i < sorted.length; i++) {
    const row = sorted[i]!;
    if (row.slaDias == null || row.slaDias <= 0) continue;

    if (i === startIdx) {
      if (row.dataInicioReal) {
        const restante = slaRestanteFase(row.dataInicioReal, row.slaDias, row.slaTipo, hoje);
        cursor = addDiasPorTipo(cursor, restante, row.slaTipo);
      } else {
        cursor = addDiasPorTipo(cursor, row.slaDias, row.slaTipo);
      }
    } else {
      cursor = addDiasPorTipo(cursor, row.slaDias, row.slaTipo);
    }
  }

  return cursor;
}

function resolverMaiorGargalo(linhas: CalculadoraFaseLinha[]): CalculadoraMaiorGargalo | null {
  let melhorAtraso: CalculadoraMaiorGargalo | null = null;

  for (const row of linhas) {
    if (faseContribuiAtrasoAcumulado(row.status) && row.atrasoDias != null && row.atrasoDias > 0) {
      if (!melhorAtraso || row.atrasoDias > melhorAtraso.dias) {
        melhorAtraso = {
          faseNome: row.faseNome,
          motivo: 'atraso',
          dias: row.atrasoDias,
          unidade: row.slaTipo,
        };
      }
    }
  }

  return melhorAtraso;
}

function resolverStatusGeral(
  linhas: CalculadoraFaseLinha[],
  cardConcluido: boolean,
  atrasoUteis: number,
  atrasoCorridos: number,
  hoje: string,
): CalculadoraStatusGeral {
  if (cardConcluido) return 'concluido';
  if (linhas.some((l) => l.status === 'atual_atrasada' || l.status === 'concluida_atraso')) {
    return 'atrasado';
  }
  if (atrasoUteis > 0 || atrasoCorridos > 0) return 'atrasado';

  const atual = linhas.find((l) => l.status === 'atual');
  if (atual?.dataFimEstimada && atual.dataInicioReal) {
    const restante = atual.slaTipo === 'corridos'
      ? calendarDaysBetween(hoje, atual.dataFimEstimada)
      : businessDaysBetween(hoje, atual.dataFimEstimada);
    if (restante <= 1 && atual.dataFimEstimada >= hoje) return 'atencao';
  }

  return 'ok';
}

/** Métricas executivas agregadas a partir das linhas da calculadora. */
export function calcularResumoExecutivoCalculadoraFases(
  linhas: CalculadoraFaseLinha[],
  opts?: { cardConcluido?: boolean; hoje?: Date; visits?: FaseVisit[] },
): CalculadoraResumoExecutivo {
  const empty: CalculadoraResumoExecutivo = {
    faseAtualNome: null,
    diasNaFase: null,
    diasNaFaseTipo: 'uteis',
    statusGeral: 'ok',
    statusGeralLabel: CALCULADORA_STATUS_GERAL_LABEL.ok,
    atrasoAcumuladoUteis: 0,
    atrasoAcumuladoCorridos: 0,
    percentualConcluido: 0,
    fasesConcluidas: 0,
    fasesTotal: 0,
    maiorGargalo: null,
    previsaoConclusao: null,
    dadosParciais: true,
  };

  try {
    const hoje = hojeYmd(opts?.hoje);
    const linhasAtivas = linhas.filter((l) => l.faseAtiva);
    const fasesTotal = linhasAtivas.length;
    const fasesConcluidas = linhasAtivas.filter(
      (l) => l.status === 'concluida' || l.status === 'concluida_atraso',
    ).length;
    const percentualConcluido =
      fasesTotal > 0 ? Math.round((fasesConcluidas / fasesTotal) * 100) : 0;

    let atrasoAcumuladoUteis = 0;
    let atrasoAcumuladoCorridos = 0;
    for (const row of linhasAtivas) {
      if (!faseContribuiAtrasoAcumulado(row.status)) continue;
      if (row.atrasoDias == null || row.atrasoDias <= 0) continue;
      if (row.slaTipo === 'corridos') atrasoAcumuladoCorridos += row.atrasoDias;
      else atrasoAcumuladoUteis += row.atrasoDias;
    }

    const linhaAtual = linhas.find((l) => l.status === 'atual' || l.status === 'atual_atrasada');
    const diasNaFase =
      linhaAtual?.dataInicioReal != null
        ? diasNaFasePorTipo(linhaAtual.dataInicioReal, hoje, linhaAtual.slaTipo)
        : null;

    const statusGeral = resolverStatusGeral(
      linhasAtivas,
      opts?.cardConcluido === true,
      atrasoAcumuladoUteis,
      atrasoAcumuladoCorridos,
      hoje,
    );

    const dadosParciais = detectarDadosParciais(linhas, opts?.visits ?? []);

    return {
      faseAtualNome: linhaAtual?.faseNome ?? null,
      diasNaFase,
      diasNaFaseTipo: linhaAtual?.slaTipo ?? 'uteis',
      statusGeral,
      statusGeralLabel: CALCULADORA_STATUS_GERAL_LABEL[statusGeral],
      atrasoAcumuladoUteis,
      atrasoAcumuladoCorridos,
      percentualConcluido,
      fasesConcluidas,
      fasesTotal,
      maiorGargalo: resolverMaiorGargalo(linhasAtivas),
      previsaoConclusao: projectarPrevisaoConclusao(linhasAtivas, hoje),
      dadosParciais,
    };
  } catch {
    return empty;
  }
}
