import type { KanbanFase } from '@/components/kanban-shared/types';
import { calcularDiasCorridos, formatLocalYmd, parseIsoDateOnlyLocal, normalizarSlaTipo, type SlaTipo } from '@/lib/dias-uteis';
import { addBusinessDays, type FaseTimelineStatus } from '@/lib/kanban/previsibilidade-operacoes';
import { lastVisitPerFase, type FaseVisit } from '@/lib/kanban/kanban-card-timeline';

export type { FaseTimelineStatus };

export type CalculadoraFaseLinha = {
  faseId: string;
  faseNome: string;
  ordem: number;
  slaDias: number | null;
  dataInicioReal: string | null;
  dataFimEstimada: string | null;
  dataFimReal: string | null;
  atrasoDiasUteis: number | null;
  status: FaseTimelineStatus;
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
  concluida: 'Concluída',
  concluida_atraso: 'Concluída com atraso',
};

function toYmd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const head = String(iso).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null;
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

  if (dataFimReal) {
    if (dataFimEstimada && dataFimReal > dataFimEstimada) return 'concluida_atraso';
    return 'concluida';
  }

  if (dataInicioReal && faseOrdem < ordemAtual) {
    return 'concluida';
  }

  if (faseOrdem > ordemAtual && !dataInicioReal) {
    return 'futura';
  }

  if (isCurrent && !cardAtivo) {
    if (dataFimEstimada && card.concluido_em) {
      const fim = toYmd(card.concluido_em);
      if (fim && fim > dataFimEstimada) return 'concluida_atraso';
    }
    return 'concluida';
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
  const { fases, card, visits } = input;
  const hoje = hojeYmd(input.hoje);

  if (!fases.length) return [];

  const sorted = [...fases].sort((a, b) => a.ordem - b.ordem);
  const lastByFase = lastVisitPerFase(visits);
  const faseAtual = sorted.find((f) => f.id === card.fase_id);
  const ordemAtual = faseAtual?.ordem ?? Number.MAX_SAFE_INTEGER;

  let chainCursor: string | null = toYmd(card.created_at);

  return sorted.map((fase) => {
    const last = lastByFase.get(fase.id);
    let dataInicioReal = toYmd(last?.entrou);

    if (!dataInicioReal && fase.id === card.fase_id) {
      dataInicioReal = toYmd(card.entered_fase_at) ?? toYmd(card.created_at);
    }

    let dataFimReal = toYmd(last?.saiu);
    if (!dataFimReal && fase.id === card.fase_id && card.concluido && card.concluido_em) {
      dataFimReal = toYmd(card.concluido_em);
    }

    let baseInicio = dataInicioReal ?? chainCursor;
    if (!baseInicio && fase.ordem === sorted[0]?.ordem) {
      baseInicio = toYmd(card.created_at);
    }

    const slaTipo = normalizarSlaTipo(fase.sla_tipo);
    const dataFimEstimada = baseInicio ? fimEstimadaPorSla(baseInicio, fase.sla_dias, slaTipo) : null;

    chainCursor = dataFimReal ?? dataFimEstimada ?? chainCursor;

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

    const atrasoDiasUteis = resolveAtraso(status, dataFimEstimada, dataFimReal, hoje, slaTipo);

    return {
      faseId: fase.id,
      faseNome: fase.nome,
      ordem: fase.ordem,
      slaDias: fase.sla_dias,
      dataInicioReal,
      dataFimEstimada,
      dataFimReal,
      atrasoDiasUteis,
      status,
    };
  });
}
