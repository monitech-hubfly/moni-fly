import type { KanbanFase } from '@/components/kanban-shared/types';
import { calcularDiasCorridos, formatLocalYmd, isDiaUtil, parseIsoDateOnlyLocal, normalizarSlaTipo, type SlaTipo } from '@/lib/dias-uteis';
import { addBusinessDays, type FaseTimelineStatus } from '@/lib/kanban/previsibilidade-operacoes';
import { lastVisitPerFase, type FaseVisit } from '@/lib/kanban/kanban-card-timeline';
import { tipoResponsavelDaFasePorSlug } from '@/lib/kanban/responsavel-da-fase-padrao-por-slug';
import {
  isValorResponsavelDaFaseLista,
  labelResponsavelDaFasePorTipo,
} from '@/lib/kanban/responsavel-fase-checklist';
import { custoPadraoPorSlug } from '@/lib/kanban/custo-padrao-por-slug';
import { resolverSlaCalculadoraFase } from '@/lib/kanban/sla-fallback-calculadora-por-slug';
import type { CondominioPrazosAprovacaoSla } from '@/lib/kanban/condominio-prazos-aprovacao';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';

export type { FaseTimelineStatus };

export type CalculadoraFaseLinha = {
  faseId: string;
  faseNome: string;
  /** Slug da fase (para responsável da fase e integrações). */
  faseSlug?: string;
  ordem: number;
  faseAtiva: boolean;
  slaDias: number | null;
  slaTipo: SlaTipo;
  /** SLA inferido por fallback (fase sem prazo no banco). */
  slaPrazoNaoDefinido?: boolean;
  dataInicioReal: string | null;
  dataFimEstimada: string | null;
  dataFimReal: string | null;
  /** Atraso na unidade do SLA da fase (d.u. ou d.c.). */
  atrasoDias: number | null;
  status: FaseTimelineStatus;
  /** Moní ou Franqueado — quem executa a fase. */
  responsavelDaFase?: string | null;
  /** Quem arca com custos da fase (padrão por slug). */
  custo?: string | null;
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

/** Âncora manual: fim real de uma fase; etapas anteriores sem datas; recálculo a partir daí. */
export type CalculadoraAncora = {
  faseSlug: string;
  dataFim: string;
};

export type CalculadoraFaseDataManualOverride = {
  dataInicio?: string | null;
  dataFim?: string | null;
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
  ancora?: CalculadoraAncora | null;
  /** Overrides manuais por fase_id — recalculam estimativas das fases posteriores. */
  overrides?: Map<string, CalculadoraFaseDataManualOverride>;
  /** SLA customizado do cadastro de condomínio (aprovacao_condominio / aprovacao_prefeitura). */
  slaCondominio?: CondominioPrazosAprovacaoSla | null;
};

export function calculadoraAncoraFromProcesso(proc: {
  calculadora_ancora_fase_slug?: string | null;
  calculadora_ancora_data_fim?: string | null;
} | null | undefined): CalculadoraAncora | null {
  const slug = String(proc?.calculadora_ancora_fase_slug ?? '').trim();
  const dataFim = toYmd(proc?.calculadora_ancora_data_fim);
  if (!slug || !dataFim) return null;
  return { faseSlug: slug, dataFim };
}

export const CALCULADORA_STATUS_LABEL: Record<FaseTimelineStatus, string> = {
  futura: 'Futura',
  atual: 'Em andamento',
  atual_atrasada: 'Em andamento (atraso)',
  concluida: 'Concluída',
  concluida_atraso: 'Concluída (atraso)',
};

export const CALCULADORA_STATUS_GERAL_LABEL: Record<CalculadoraStatusGeral, string> = {
  ok: 'No prazo',
  atencao: 'Atenção',
  atrasado: 'Em atraso',
  concluido: 'Concluído',
};

/** Sufixo de coluna de data na calculadora: est. (previsão) ou real (registrada). */
export function labelSufixoDataCalculadora(temDataReal: boolean): 'est.' | 'real' {
  return temDataReal ? 'real' : 'est.';
}

/** Sufixo de data por status da fase: futura → est.; concluída → real; em andamento → início real, fim est. até sair. */
export function labelSufixoDataCalculadoraFase(
  status: FaseTimelineStatus,
  coluna: 'inicio' | 'fim',
  temDataRealRegistrada: boolean,
): 'est.' | 'real' {
  if (status === 'futura') return 'est.';
  if (status === 'concluida' || status === 'concluida_atraso') return 'real';
  if (coluna === 'inicio') return 'real';
  return temDataRealRegistrada ? 'real' : 'est.';
}

/** Fase ultrapassou o SLA estimado (inclui futuras com previsão vencida). */
export function faseUltrapassouSlaCalculadora(
  status: FaseTimelineStatus,
  dataFimEstimada: string | null,
  dataFimReal: string | null,
  hoje: string,
): boolean {
  if (!dataFimEstimada) return false;
  if (status === 'atual_atrasada' || status === 'concluida_atraso') return true;
  if (status === 'atual' && !dataFimReal && hoje > dataFimEstimada) return true;
  if (status === 'futura' && hoje > dataFimEstimada) return true;
  return false;
}

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

function detectarDadosParciais(
  linhas: CalculadoraFaseLinha[],
  visits: FaseVisit[],
  ancora?: CalculadoraAncora | null,
): boolean {
  if (linhas.length === 0) return false;

  const ancoraIdx = ancora
    ? linhas.findIndex((l) => String(l.faseSlug ?? '').trim() === ancora.faseSlug)
    : -1;
  const ordemAncora = ancoraIdx >= 0 ? (linhas[ancoraIdx]?.ordem ?? -1) : -1;

  const ordemAtual =
    linhas.find((l) => l.status === 'atual' || l.status === 'atual_atrasada')?.ordem ??
    linhas.find((l) => l.status === 'futura')?.ordem ??
    Number.MAX_SAFE_INTEGER;

  for (const row of linhas) {
    if (ordemAncora >= 0 && row.ordem < ordemAncora) continue;
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
  if (!fim) return null;
  const parsed = parseIsoDateOnlyLocal(fim);
  if (!parsed) return null;
  const next = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  next.setDate(next.getDate() + 1);
  return primeiroDiaUtilDe(formatLocalYmd(next));
}

/**
 * Quando início propagado ultrapassa fim real (histórico/manual), prioriza entrada da visita
 * ou limita início ao fim — fim real é a saída autoritativa da fase.
 */
function reconciliarInicioComFimReal(
  dataInicioReal: string | null,
  dataFimReal: string | null,
  dataEntrouVisita?: string | null,
): string | null {
  if (!dataInicioReal || !dataFimReal || dataInicioReal <= dataFimReal) {
    return dataInicioReal;
  }
  const entrou = dataEntrouVisita ? toYmd(dataEntrouVisita) : null;
  if (entrou && entrou <= dataFimReal) {
    const inicioEntrou = primeiroDiaUtilDe(entrou);
    if (inicioEntrou <= dataFimReal) return inicioEntrou;
  }
  return dataFimReal;
}

/** Garante dataInicioReal <= dataFimReal em todas as linhas; recalcula status/atraso se card informado. */
export function normalizarIntervaloDatasCalculadoraLinhas(
  linhas: CalculadoraFaseLinha[],
  card?: CalculadoraFasesInput['card'],
  hojeRef?: Date,
): CalculadoraFaseLinha[] {
  if (linhas.length === 0) return linhas;

  const out = linhas.map((linha) => {
    let { dataInicioReal, dataFimReal, dataFimEstimada } = linha;
    if (!dataInicioReal || !dataFimReal || dataInicioReal <= dataFimReal) {
      return linha;
    }
    dataInicioReal = dataFimReal;
    if (
      dataFimEstimada &&
      dataFimEstimada < dataInicioReal &&
      linha.slaDias != null &&
      linha.slaDias > 0
    ) {
      dataFimEstimada = fimEstimadaPorSla(dataInicioReal, linha.slaDias, linha.slaTipo);
    }
    return { ...linha, dataInicioReal, dataFimEstimada };
  });

  if (card) {
    return recomputarStatusAtrasoLinhasCalculadora(out, card, hojeRef);
  }
  return out;
}

function hojeYmd(ref?: Date): string {
  const d = ref ?? new Date();
  return formatLocalYmd(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Data de hoje (YYYY-MM-DD) para edição manual na calculadora. */
export function calculadoraHojeYmd(ref?: Date): string {
  return hojeYmd(ref);
}

/** Dias úteis (seg–sex) entre duas datas — contagem a partir do dia seguinte ao início. */
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

function diasDecorridosPorSla(inicioYmd: string, fimYmd: string, slaTipo: SlaTipo): number {
  return slaTipo === 'corridos'
    ? calendarDaysBetween(inicioYmd, fimYmd)
    : businessDaysBetween(inicioYmd, fimYmd);
}

/** Fase ultrapassou o SLA com base nos dias decorridos (contagem a partir do dia seguinte ao início). */
function faseUltrapassouSla(
  dataInicioReal: string | null,
  dataFimReal: string | null,
  dataFimEstimada: string | null,
  slaDias: number | null,
  slaTipo: SlaTipo,
): boolean {
  if (dataInicioReal && dataFimReal && slaDias != null && slaDias > 0) {
    return diasDecorridosPorSla(dataInicioReal, dataFimReal, slaTipo) > slaDias;
  }
  return Boolean(dataFimReal && dataFimEstimada && dataFimReal > dataFimEstimada);
}

function faseEmAtrasoPorSlaAberta(
  dataInicioReal: string | null,
  dataFimEstimada: string | null,
  hoje: string,
  slaDias: number | null,
  slaTipo: SlaTipo,
): boolean {
  if (dataInicioReal && slaDias != null && slaDias > 0) {
    return diasDecorridosPorSla(dataInicioReal, hoje, slaTipo) > slaDias;
  }
  return Boolean(dataFimEstimada && hoje > dataFimEstimada);
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
  slaDias: number | null = null,
  slaTipo: SlaTipo = 'uteis',
): FaseTimelineStatus {
  const isCurrent = faseId === card.fase_id;
  const cardAtivo = !card.concluido;

  if (isCurrent && cardAtivo) {
    if (
      dataFimReal &&
      faseUltrapassouSla(dataInicioReal, dataFimReal, dataFimEstimada, slaDias, slaTipo)
    ) {
      return 'atual_atrasada';
    }
    if (!dataFimReal && faseEmAtrasoPorSlaAberta(dataInicioReal, dataFimEstimada, hoje, slaDias, slaTipo)) {
      return 'atual_atrasada';
    }
    return 'atual';
  }

  if (isCurrent && !cardAtivo) {
    if (
      dataFimEstimada &&
      card.concluido_em &&
      faseUltrapassouSla(
        dataInicioReal,
        toYmd(card.concluido_em),
        dataFimEstimada,
        slaDias,
        slaTipo,
      )
    ) {
      return 'concluida_atraso';
    }
    return 'concluida';
  }

  /** Fases anteriores à atual na ordem do funil já foram percorridas — nunca "futura". */
  if (faseOrdem < ordemAtual) {
    if (faseUltrapassouSla(dataInicioReal, dataFimReal, dataFimEstimada, slaDias, slaTipo)) {
      return 'concluida_atraso';
    }
    return 'concluida';
  }

  if (faseOrdem > ordemAtual) {
    if (dataFimReal) {
      if (faseUltrapassouSla(dataInicioReal, dataFimReal, dataFimEstimada, slaDias, slaTipo)) {
        return 'concluida_atraso';
      }
      return 'concluida';
    }
    return 'futura';
  }

  return 'futura';
}

/** Fase posterior à atual do card, marcada como concluída manualmente (data fim real). */
export function faseConcluidaManualmente(
  linha: Pick<CalculadoraFaseLinha, 'ordem' | 'dataFimReal'>,
  ordemAtual: number,
): boolean {
  return linha.ordem > ordemAtual && Boolean(linha.dataFimReal);
}

function ordemAtualCalculadoraLinhas(
  linhas: CalculadoraFaseLinha[],
  card: CalculadoraFasesInput['card'],
): number {
  return (
    linhas.find((l) => l.faseId === card.fase_id)?.ordem ??
    linhas.find((l) => l.status === 'atual' || l.status === 'atual_atrasada')?.ordem ??
    linhas.find((l) => l.status === 'futura')?.ordem ??
    Number.MAX_SAFE_INTEGER
  );
}

/** Reaplica status e atraso em todas as linhas após alterações de datas. */
export function recomputarStatusAtrasoLinhasCalculadora(
  linhas: CalculadoraFaseLinha[],
  card: CalculadoraFasesInput['card'],
  hojeRef?: Date,
): CalculadoraFaseLinha[] {
  if (linhas.length === 0) return linhas;
  const hoje = hojeYmd(hojeRef);
  const ordemAtual = ordemAtualCalculadoraLinhas(linhas, card);

  return linhas.map((linha) => {
    const status = resolveStatus(
      linha.faseId,
      card,
      linha.dataInicioReal,
      linha.dataFimReal,
      linha.dataFimEstimada,
      linha.ordem,
      ordemAtual,
      hoje,
      linha.slaDias,
      linha.slaTipo,
    );
    const atrasoDias = resolveAtraso(
      status,
      linha.dataInicioReal,
      linha.dataFimEstimada,
      linha.dataFimReal,
      hoje,
      linha.slaTipo,
      linha.slaDias,
    );
    return { ...linha, status, atrasoDias };
  });
}

function resolveAtraso(
  status: FaseTimelineStatus,
  dataInicioReal: string | null,
  dataFimEstimada: string | null,
  dataFimReal: string | null,
  hoje: string,
  slaTipo: SlaTipo = 'uteis',
  slaDias: number | null = null,
): number | null {
  const diff = slaTipo === 'corridos' ? calendarDaysBetween : businessDaysBetween;

  if (status === 'atual_atrasada') {
    if (dataFimReal) {
      if (dataInicioReal && slaDias != null && slaDias > 0) {
        const elapsed = diasDecorridosPorSla(dataInicioReal, dataFimReal, slaTipo);
        const atraso = elapsed - slaDias;
        if (atraso > 0) return atraso;
      } else if (dataFimEstimada) {
        const dias = diff(dataFimEstimada, dataFimReal);
        if (dias > 0) return dias;
      }
    }
    if (dataInicioReal && slaDias != null && slaDias > 0) {
      const elapsed = diasDecorridosPorSla(dataInicioReal, hoje, slaTipo);
      const atraso = elapsed - slaDias;
      if (atraso > 0) return atraso;
    }
    if (dataFimEstimada) {
      const dias = diff(dataFimEstimada, hoje);
      return dias > 0 ? dias : null;
    }
    return null;
  }

  if (status === 'concluida_atraso' && dataFimReal) {
    if (dataInicioReal && slaDias != null && slaDias > 0) {
      const elapsed = diasDecorridosPorSla(dataInicioReal, dataFimReal, slaTipo);
      const atraso = elapsed - slaDias;
      return atraso > 0 ? atraso : null;
    }
    if (dataFimEstimada) {
      const dias = diff(dataFimEstimada, dataFimReal);
      return dias > 0 ? dias : null;
    }
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
      const entrouVisita = toYmd(last?.entrou);

      if (!dataInicioReal) {
        dataInicioReal = entrouVisita;
        if (!dataInicioReal && fase.id === card.fase_id) {
          dataInicioReal = toYmd(card.entered_fase_at) ?? toYmd(card.created_at);
        }
        if (!dataInicioReal && fase.ordem === sorted[0]?.ordem) {
          dataInicioReal = toYmd(card.created_at);
        }
        if (dataInicioReal) {
          dataInicioReal = primeiroDiaUtilDe(dataInicioReal);
        }
      } else {
        dataInicioReal = reconciliarInicioComFimReal(dataInicioReal, dataFimReal, entrouVisita);
      }

      const slug = String(fase.slug ?? '').trim();
      const slaResolvido = resolverSlaCalculadoraFase(
        slug,
        fase.sla_dias,
        fase.sla_tipo,
        input.slaCondominio,
      );
      const { slaDias, slaTipo, slaPrazoNaoDefinido } = slaResolvido;
      const dataFimEstimada = dataInicioReal
        ? fimEstimadaPorSla(dataInicioReal, slaDias, slaTipo)
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
        slaDias,
        slaTipo,
      );

      const atrasoDias = resolveAtraso(
        status,
        dataInicioReal,
        dataFimEstimada,
        dataFimReal,
        hoje,
        slaTipo,
        slaDias,
      );

      linhas.push({
        faseId: fase.id,
        faseNome: fase.nome,
        faseSlug: slug || undefined,
        ordem: fase.ordem,
        faseAtiva: faseEhAtiva(fase),
        slaDias,
        slaTipo,
        slaPrazoNaoDefinido,
        dataInicioReal,
        dataFimEstimada,
        dataFimReal,
        atrasoDias,
        status,
      });

      fimFaseAnteriorReal = dataFimReal;
      fimFaseAnteriorEstimado = dataFimEstimada;
    }

    const comAncora = aplicarAncoraCalculadoraLinhas(linhas, input.ancora, card, input.hoje);
    const comInferencia = inferirFimRealPorProximaFase(comAncora);
    const comDatasManuais = aplicarDatasManuaisCalculadoraLinhas(
      comInferencia,
      input.overrides ?? new Map(),
      card,
      input.hoje,
    );
    return normalizarIntervaloDatasCalculadoraLinhas(comDatasManuais, card, input.hoje);
  } catch {
    return [];
  }
}

/**
 * Aplica âncora manual: limpa datas das etapas anteriores, fixa fim real na fase âncora
 * e recalcula início/estimativa (e mantém fim real de visitas) das etapas posteriores.
 */
export function aplicarAncoraCalculadoraLinhas(
  linhas: CalculadoraFaseLinha[],
  ancora: CalculadoraAncora | null | undefined,
  card: CalculadoraFasesInput['card'],
  hojeRef?: Date,
): CalculadoraFaseLinha[] {
  if (!ancora?.faseSlug || !ancora.dataFim) return linhas;

  const idx = linhas.findIndex((l) => String(l.faseSlug ?? '').trim() === ancora.faseSlug);
  if (idx < 0) return linhas;

  const hoje = hojeYmd(hojeRef);
  const ordemAtual =
    linhas.find((l) => l.faseId === card.fase_id)?.ordem ??
    linhas.find((l) => l.status === 'atual' || l.status === 'atual_atrasada')?.ordem ??
    linhas.find((l) => l.status === 'futura')?.ordem ??
    Number.MAX_SAFE_INTEGER;

  const out = linhas.map((l) => ({ ...l }));

  for (let i = 0; i < idx; i++) {
    const row = out[i]!;
    out[i] = {
      ...row,
      dataInicioReal: null,
      dataFimReal: null,
      dataFimEstimada: null,
      atrasoDias: null,
      status: row.ordem < ordemAtual ? 'concluida' : row.status,
    };
  }

  const ancRow = out[idx]!;
  const ancStatus = resolveStatus(
    ancRow.faseId,
    card,
    null,
    ancora.dataFim,
    null,
    ancRow.ordem,
    ordemAtual,
    hoje,
    ancRow.slaDias,
    ancRow.slaTipo,
  );
  out[idx] = {
    ...ancRow,
    dataInicioReal: null,
    dataFimReal: ancora.dataFim,
    dataFimEstimada: null,
    atrasoDias: resolveAtraso(
      ancStatus,
      null,
      null,
      ancora.dataFim,
      hoje,
      ancRow.slaTipo,
      ancRow.slaDias,
    ),
    status: ancStatus,
  };

  let fimFaseAnteriorReal: string | null = ancora.dataFim;
  let fimFaseAnteriorEstimado: string | null = null;

  for (let i = idx + 1; i < out.length; i++) {
    const row = out[i]!;
    let dataInicioReal = inicioPorFimFaseAnterior(fimFaseAnteriorReal, fimFaseAnteriorEstimado);
    const dataFimEstimada = dataInicioReal
      ? fimEstimadaPorSla(dataInicioReal, row.slaDias, row.slaTipo)
      : null;

    const concluidaPorOrdem = row.ordem < ordemAtual;
    const concluidaManual = faseConcluidaManualmente(row, ordemAtual);
    const dataFimReal =
      concluidaPorOrdem || concluidaManual ? row.dataFimReal : null;

    dataInicioReal = reconciliarInicioComFimReal(dataInicioReal, dataFimReal);

    const status = resolveStatus(
      row.faseId,
      card,
      dataInicioReal,
      dataFimReal,
      dataFimEstimada,
      row.ordem,
      ordemAtual,
      hoje,
      row.slaDias,
      row.slaTipo,
    );
    const atrasoDias = resolveAtraso(
      status,
      dataInicioReal,
      dataFimEstimada,
      dataFimReal,
      hoje,
      row.slaTipo,
      row.slaDias,
    );

    out[i] = {
      ...row,
      dataInicioReal,
      dataFimEstimada,
      dataFimReal,
      status,
      atrasoDias,
    };

    fimFaseAnteriorReal = dataFimReal ?? dataFimEstimada;
    fimFaseAnteriorEstimado = dataFimEstimada;
  }

  return inferirFimRealPorProximaFase(out);
}

/** Índice da fase atual do card na timeline (fase_id ou status em andamento). */
export function idxFaseAtualCalculadoraLinhas(
  linhas: CalculadoraFaseLinha[],
  card: CalculadoraFasesInput['card'],
): number {
  const porId = linhas.findIndex((l) => l.faseId === card.fase_id);
  if (porId >= 0) return porId;
  return linhas.findIndex((l) => l.status === 'atual' || l.status === 'atual_atrasada');
}

/**
 * Recalcula estimativas das fases futuras a partir da fase atual — corrige quebra de encadeamento
 * após o marco Contrato (ex.: Pré Obra com datas desalinhadas).
 */
export function sincronizarEstimativasFuturasAPartirFaseAtual(
  linhas: CalculadoraFaseLinha[],
  card: CalculadoraFasesInput['card'],
  hojeRef?: Date,
): CalculadoraFaseLinha[] {
  if (linhas.length === 0) return linhas;
  const idxAtual = idxFaseAtualCalculadoraLinhas(linhas, card);
  if (idxAtual < 0 || idxAtual >= linhas.length - 1) return linhas;

  const hoje = hojeYmd(hojeRef);
  const ordemAtual =
    linhas.find((l) => l.faseId === card.fase_id)?.ordem ??
    linhas.find((l) => l.status === 'atual' || l.status === 'atual_atrasada')?.ordem ??
    linhas.find((l) => l.status === 'futura')?.ordem ??
    Number.MAX_SAFE_INTEGER;

  const propagadas = propagarLinhasCalculadoraForward(linhas, idxAtual, card, ordemAtual, hoje);
  return recomputarStatusAtrasoLinhasCalculadora(propagadas, card, hojeRef);
}

/** Recalcula início/estimativa (e fim real de concluídas) a partir de uma fase âncora. */
export function propagarLinhasCalculadoraForward(
  linhas: CalculadoraFaseLinha[],
  desdeIdx: number,
  card: CalculadoraFasesInput['card'],
  ordemAtual: number,
  hoje: string,
): CalculadoraFaseLinha[] {
  const out = linhas.map((l) => ({ ...l }));
  const ancRow = out[desdeIdx]!;
  const fimAncoraEfetivo = ancRow.dataFimReal ?? ancRow.dataFimEstimada;
  let fimFaseAnteriorReal: string | null = ancRow.dataFimReal;
  let fimFaseAnteriorEstimado: string | null = ancRow.dataFimReal
    ? ancRow.dataFimEstimada
    : fimAncoraEfetivo;

  for (let i = desdeIdx + 1; i < out.length; i++) {
    const row = out[i]!;
    let dataInicioReal = inicioPorFimFaseAnterior(fimFaseAnteriorReal, fimFaseAnteriorEstimado);
    const dataFimEstimada = dataInicioReal
      ? fimEstimadaPorSla(dataInicioReal, row.slaDias, row.slaTipo)
      : null;

    const concluidaPorOrdem = row.ordem < ordemAtual;
    const concluidaManual = faseConcluidaManualmente(row, ordemAtual);
    const dataFimReal =
      concluidaPorOrdem || concluidaManual ? row.dataFimReal : null;

    dataInicioReal = reconciliarInicioComFimReal(dataInicioReal, dataFimReal);

    const status = resolveStatus(
      row.faseId,
      card,
      dataInicioReal,
      dataFimReal,
      dataFimEstimada,
      row.ordem,
      ordemAtual,
      hoje,
      row.slaDias,
      row.slaTipo,
    );
    const atrasoDias = resolveAtraso(
      status,
      dataInicioReal,
      dataFimEstimada,
      dataFimReal,
      hoje,
      row.slaTipo,
      row.slaDias,
    );

    out[i] = {
      ...row,
      dataInicioReal,
      dataFimEstimada,
      dataFimReal,
      status,
      atrasoDias,
    };

    fimFaseAnteriorReal = dataFimReal ?? dataFimEstimada;
    fimFaseAnteriorEstimado = dataFimEstimada;
  }

  return inferirFimRealPorProximaFase(out);
}

function aplicarOverrideManualEmLinhaCalculadora(
  linha: CalculadoraFaseLinha,
  ov: CalculadoraFaseDataManualOverride,
  card: CalculadoraFasesInput['card'],
  ordemAtual: number,
  hoje: string,
): CalculadoraFaseLinha {
  let dataInicioReal = linha.dataInicioReal;
  let dataFimReal = linha.dataFimReal;
  let dataFimEstimada = linha.dataFimEstimada;

  if ('dataInicio' in ov) {
    dataInicioReal = ov.dataInicio ? toYmd(ov.dataInicio) : null;
    if (dataInicioReal && linha.slaDias != null && linha.slaDias > 0) {
      dataFimEstimada = fimEstimadaPorSla(dataInicioReal, linha.slaDias, linha.slaTipo);
    }
  }

  if ('dataFim' in ov) {
    const fimManual = ov.dataFim ? toYmd(ov.dataFim) : null;
    const editarEstimada =
      !dataFimReal &&
      (linha.status === 'atual' ||
        linha.status === 'atual_atrasada' ||
        linha.status === 'futura');
    if (editarEstimada) {
      dataFimEstimada = fimManual;
    } else if (fimManual) {
      dataFimReal = fimManual;
    } else {
      dataFimReal = null;
    }
  }

  dataInicioReal = reconciliarInicioComFimReal(dataInicioReal, dataFimReal);

  const status = resolveStatus(
    linha.faseId,
    card,
    dataInicioReal,
    dataFimReal,
    dataFimEstimada,
    linha.ordem,
    ordemAtual,
    hoje,
    linha.slaDias,
    linha.slaTipo,
  );
  const atrasoDias = resolveAtraso(
    status,
    dataInicioReal,
    dataFimEstimada,
    dataFimReal,
    hoje,
    linha.slaTipo,
    linha.slaDias,
  );

  return {
    ...linha,
    dataInicioReal,
    dataFimReal,
    dataFimEstimada,
    status,
    atrasoDias,
  };
}

/** Aplica overrides manuais de datas e recalcula estimativas das fases posteriores. */
export function aplicarDatasManuaisCalculadoraLinhas(
  linhas: CalculadoraFaseLinha[],
  overrides: Map<string, CalculadoraFaseDataManualOverride>,
  card: CalculadoraFasesInput['card'],
  hojeRef?: Date,
): CalculadoraFaseLinha[] {
  if (overrides.size === 0 || linhas.length === 0) return linhas;

  const hoje = hojeYmd(hojeRef);
  const ordemAtual =
    linhas.find((l) => l.faseId === card.fase_id)?.ordem ??
    linhas.find((l) => l.status === 'atual' || l.status === 'atual_atrasada')?.ordem ??
    linhas.find((l) => l.status === 'futura')?.ordem ??
    Number.MAX_SAFE_INTEGER;

  let out = linhas.map((linha) => {
    const ov = overrides.get(linha.faseId);
    if (!ov) return linha;
    return aplicarOverrideManualEmLinhaCalculadora(linha, ov, card, ordemAtual, hoje);
  });

  const indicesOverride = out
    .map((l, i) => (overrides.has(l.faseId) ? i : -1))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);

  for (const idx of indicesOverride) {
    const ov = overrides.get(out[idx]!.faseId);
    if (ov) {
      out[idx] = aplicarOverrideManualEmLinhaCalculadora(out[idx]!, ov, card, ordemAtual, hoje);
    }
    out = propagarLinhasCalculadoraForward(out, idx, card, ordemAtual, hoje);
  }

  return recomputarStatusAtrasoLinhasCalculadora(out, card, hojeRef);
}

type EncadeamentoMarcoContratoInput = { contrato_assinado_em?: string | null };

/**
 * Fim real do marco M0 (Contrato): saída da fase no histórico ou edição manual após sair.
 * Não usa contrato_assinado_em — essa data é registro de assinatura, não saída da fase.
 */
export function resolverFimRealMarcoContrato(
  linhaContrato: CalculadoraFaseLinha,
  idxContrato: number,
  linhas: CalculadoraFaseLinha[],
  visits: FaseVisit[] | undefined,
  overrides?: Map<string, CalculadoraFaseDataManualOverride>,
): string | null {
  if (visits?.length) {
    const visitSaiu = toYmd(lastVisitPerFase(visits).get(linhaContrato.faseId)?.saiu);
    if (visitSaiu) return visitSaiu;
  }

  const ov = overrides?.get(linhaContrato.faseId);
  if (ov && 'dataFim' in ov && ov.dataFim) {
    const fimManual = toYmd(ov.dataFim);
    if (fimManual) return fimManual;
  }

  if (linhaContrato.dataFimReal) return linhaContrato.dataFimReal;

  for (let i = idxContrato + 1; i < linhas.length; i++) {
    const prox = linhas[i]!;
    if (prox.status === 'futura') continue;
    const inicio = prox.dataInicioReal;
    if (inicio) return inicio;
  }

  return null;
}

function idxFasePorSlugOuNome(
  linhas: CalculadoraFaseLinha[],
  slugs: Map<string, string | null | undefined>,
  match: (slug: string | null | undefined, nome: string) => boolean,
): number {
  for (let i = 0; i < linhas.length; i++) {
    const row = linhas[i]!;
    const slug = slugs.get(row.faseId) ?? row.faseSlug;
    if (match(slug, row.faseNome)) return i;
  }
  return -1;
}

/**
 * Encadeia M0 (Contrato) após Diligência e recalcula fases posteriores.
 */
export function aplicarEncadeamentoMarcoContratoNasLinhas(
  linhas: CalculadoraFaseLinha[],
  fases: KanbanFase[],
  marcosInput: EncadeamentoMarcoContratoInput,
  card: CalculadoraFasesInput['card'],
  visits?: FaseVisit[],
  hojeRef?: Date,
  overrides?: Map<string, CalculadoraFaseDataManualOverride>,
): CalculadoraFaseLinha[] {
  if (linhas.length === 0) return linhas;

  const slugs = new Map(fases.map((f) => [f.id, f.slug]));
  const idxContrato = idxFasePorSlugOuNome(
    linhas,
    slugs,
    (slug, nome) => slug === FASE_SLUGS.STEP_7 || /^contrato$/i.test(nome.trim()),
  );
  if (idxContrato < 0) return linhas;

  const idxDiligencia = idxFasePorSlugOuNome(
    linhas,
    slugs,
    (slug, nome) => slug === 'step_6' || /dilig[eê]ncia/i.test(nome.trim()),
  );

  const hoje = hojeYmd(hojeRef);
  const ordemAtual =
    linhas.find((l) => l.faseId === card.fase_id)?.ordem ??
    linhas.find((l) => l.status === 'atual' || l.status === 'atual_atrasada')?.ordem ??
    linhas.find((l) => l.status === 'futura')?.ordem ??
    Number.MAX_SAFE_INTEGER;

  const out = linhas.map((l) => ({ ...l }));
  const rowContrato = out[idxContrato]!;

  let inicioContrato: string | null = null;
  if (idxDiligencia >= 0) {
    const dil = out[idxDiligencia]!;
    inicioContrato = inicioPorFimFaseAnterior(dil.dataFimReal, dil.dataFimEstimada);
  } else if (idxContrato > 0) {
    const ant = out[idxContrato - 1]!;
    inicioContrato = inicioPorFimFaseAnterior(ant.dataFimReal, ant.dataFimEstimada);
  }

  const realFim = resolverFimRealMarcoContrato(
    rowContrato,
    idxContrato,
    out,
    visits,
    overrides,
  );
  const inicioContratoReconciliado = reconciliarInicioComFimReal(
    inicioContrato ?? rowContrato.dataInicioReal,
    realFim,
  );
  const fimEstimado =
    inicioContratoReconciliado && rowContrato.slaDias != null && rowContrato.slaDias > 0
      ? fimEstimadaPorSla(inicioContratoReconciliado, rowContrato.slaDias, rowContrato.slaTipo)
      : rowContrato.dataFimEstimada;

  const status = resolveStatus(
    rowContrato.faseId,
    card,
    inicioContratoReconciliado,
    realFim,
    fimEstimado,
    rowContrato.ordem,
    ordemAtual,
    hoje,
    rowContrato.slaDias,
    rowContrato.slaTipo,
  );
  const atrasoDias = resolveAtraso(
    status,
    inicioContratoReconciliado,
    fimEstimado,
    realFim,
    hoje,
    rowContrato.slaTipo,
    rowContrato.slaDias,
  );

  out[idxContrato] = {
    ...rowContrato,
    dataInicioReal: inicioContratoReconciliado,
    dataFimReal: realFim,
    dataFimEstimada: fimEstimado,
    status,
    atrasoDias,
  };

  const propagadas = propagarLinhasCalculadoraForward(out, idxContrato, card, ordemAtual, hoje);
  let result = recomputarStatusAtrasoLinhasCalculadora(propagadas, card, hojeRef);
  if (overrides && overrides.size > 0) {
    let overridesPosEncadeamento = overrides;
    const visitSaiuContrato = toYmd(
      visits?.length ? lastVisitPerFase(visits).get(rowContrato.faseId)?.saiu : null,
    );
    if (visitSaiuContrato && overrides.has(rowContrato.faseId)) {
      overridesPosEncadeamento = new Map(overrides);
      const ovContrato = overridesPosEncadeamento.get(rowContrato.faseId);
      if (ovContrato && 'dataFim' in ovContrato) {
        const { dataFim: _omit, ...rest } = ovContrato;
        if (Object.keys(rest).length > 0) overridesPosEncadeamento.set(rowContrato.faseId, rest);
        else overridesPosEncadeamento.delete(rowContrato.faseId);
      }
    }
    result = aplicarDatasManuaisCalculadoraLinhas(result, overridesPosEncadeamento, card, hojeRef);
  }
  return normalizarIntervaloDatasCalculadoraLinhas(result, card, hojeRef);
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

/** Preenche coluna «Responsável da fase» (Moní/Franqueado) — valor salvo ou padrão por slug. */
export function enriquecerLinhasCalculadoraComResponsavelDaFase(
  linhas: CalculadoraFaseLinha[],
  faseSlugPorId: Map<string, string> = new Map(),
  valorSalvoPorFaseId: Map<string, string> = new Map(),
): CalculadoraFaseLinha[] {
  return linhas.map((linha) => {
    const slug = faseSlugPorId.get(linha.faseId) ?? linha.faseSlug ?? '';
    const salvo = valorSalvoPorFaseId.get(linha.faseId);
    const tipo = tipoResponsavelDaFasePorSlug(slug);
    const responsavelDaFase = isValorResponsavelDaFaseLista(salvo)
      ? salvo
      : tipo
        ? labelResponsavelDaFasePorTipo(tipo)
        : null;
    return {
      ...linha,
      faseSlug: slug || linha.faseSlug,
      responsavelDaFase,
    };
  });
}

/** Preenche coluna «Custo» a partir do slug da fase. */
export function enriquecerLinhasCalculadoraComCusto(
  linhas: CalculadoraFaseLinha[],
  faseSlugPorId: Map<string, string> = new Map(),
): CalculadoraFaseLinha[] {
  return linhas.map((linha) => {
    const slug = faseSlugPorId.get(linha.faseId) ?? linha.faseSlug ?? '';
    return {
      ...linha,
      faseSlug: slug || linha.faseSlug,
      custo: custoPadraoPorSlug(slug),
    };
  });
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
  opts?: { cardConcluido?: boolean; hoje?: Date; visits?: FaseVisit[]; ancora?: CalculadoraAncora | null },
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

    const linhaAtual = linhas.find(
      (l) => l.status === 'atual' || l.status === 'atual_atrasada',
    );
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

    const dadosParciais = detectarDadosParciais(linhas, opts?.visits ?? [], opts?.ancora);

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
