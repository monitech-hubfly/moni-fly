import { formatLocalYmd, parseIsoDateOnlyLocal } from '@/lib/dias-uteis';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';

/** Status de fase na timeline de previsibilidade (Calculadora de Fases — futuro). */
export type FaseTimelineStatus =
  | 'concluida'
  | 'concluida_atraso'
  | 'atual'
  | 'atual_atrasada'
  | 'futura';

export type PrevisibilidadeOperacoesCampos = {
  prev_aprovacao_condominio: string | null;
  prev_aprovacao_prefeitura: string | null;
  prev_emissao_alvara: string | null;
  prev_envio_credito_obra: string | null;
  prev_inicio_obra: string | null;
};

export type PrevisibilidadeOperacoesInput = {
  condominio_aprovada_em: string | null;
  prefeitura_aprovada_em: string | null;
  alvara_emitido_em: string | null;
  /** Entrada na fase aprovacao_condominio (ISO date ou timestamptz). */
  entrada_aprovacao_condominio: string | null;
  /** Entrada na fase aprovacao_prefeitura (ISO date ou timestamptz). */
  entrada_aprovacao_prefeitura: string | null;
  sla_aprovacao_condominio: number | null;
  sla_aprovacao_prefeitura: number | null;
};

const DIAS_ALVARA_APOS_PREFEITURA = 3;
const DIAS_ANTECEDENCIA_ENVIO_CREDITO = 30;
const DIAS_APOS_ALVARA_INICIO_OBRA = 30;

/** Seg–sex apenas; sem feriados (espelha fn_add_business_days no Postgres). */
export function addBusinessDays(base: Date, businessDays: number): Date {
  if (businessDays <= 0) return new Date(base.getFullYear(), base.getMonth(), base.getDate());

  const result = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  let added = 0;

  while (added < businessDays) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      added += 1;
    }
  }

  return result;
}

function toDateOnly(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const head = String(iso).trim().slice(0, 10);
  return parseIsoDateOnlyLocal(/^\d{4}-\d{2}-\d{2}$/.test(head) ? head : null);
}

function toYmd(iso: string | null | undefined): string | null {
  const d = toDateOnly(iso);
  return d ? formatLocalYmd(d) : null;
}

function addCalendarDays(iso: string, days: number): string {
  const d = toDateOnly(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return formatLocalYmd(d);
}

/**
 * Calcula os 5 campos prev_* para Funil Operações.
 * Espelha fn_kanban_cards_apply_prev_operacoes (trigger migration 399).
 */
export function calcularPrevisoesOperacoes(
  input: PrevisibilidadeOperacoesInput,
): PrevisibilidadeOperacoesCampos {
  const condReal = toYmd(input.condominio_aprovada_em);
  const prefReal = toYmd(input.prefeitura_aprovada_em);
  const alvaraReal = toYmd(input.alvara_emitido_em);

  let prevCondominio: string | null;
  if (condReal) {
    prevCondominio = condReal;
  } else {
    const entrada = toYmd(input.entrada_aprovacao_condominio);
    const sla = input.sla_aprovacao_condominio;
    if (entrada && sla != null && sla > 0) {
      const base = toDateOnly(entrada)!;
      prevCondominio = formatLocalYmd(addBusinessDays(base, sla));
    } else {
      prevCondominio = null;
    }
  }

  let prevPrefeitura: string | null;
  if (prefReal) {
    prevPrefeitura = prefReal;
  } else {
    const slaPref = input.sla_aprovacao_prefeitura;
    if (condReal && slaPref != null && slaPref > 0) {
      prevPrefeitura = formatLocalYmd(addBusinessDays(toDateOnly(condReal)!, slaPref));
    } else {
      const entradaPref = toYmd(input.entrada_aprovacao_prefeitura);
      if (entradaPref && slaPref != null && slaPref > 0) {
        prevPrefeitura = formatLocalYmd(addBusinessDays(toDateOnly(entradaPref)!, slaPref));
      } else {
        prevPrefeitura = null;
      }
    }
  }

  let prevAlvara: string | null;
  if (alvaraReal) {
    prevAlvara = alvaraReal;
  } else {
    const basePref = prefReal ?? prevPrefeitura;
    if (basePref) {
      prevAlvara = formatLocalYmd(addBusinessDays(toDateOnly(basePref)!, DIAS_ALVARA_APOS_PREFEITURA));
    } else {
      prevAlvara = null;
    }
  }

  const basePrefEnvio = prefReal ?? prevPrefeitura;
  const prevEnvio = basePrefEnvio ? addCalendarDays(basePrefEnvio, -DIAS_ANTECEDENCIA_ENVIO_CREDITO) : null;

  let prevInicio: string | null;
  if (alvaraReal) {
    prevInicio = addCalendarDays(alvaraReal, DIAS_APOS_ALVARA_INICIO_OBRA);
  } else if (prevAlvara) {
    prevInicio = addCalendarDays(prevAlvara, DIAS_APOS_ALVARA_INICIO_OBRA);
  } else {
    prevInicio = null;
  }

  return {
    prev_aprovacao_condominio: prevCondominio,
    prev_aprovacao_prefeitura: prevPrefeitura,
    prev_emissao_alvara: prevAlvara,
    prev_envio_credito_obra: prevEnvio,
    prev_inicio_obra: prevInicio,
  };
}

/** Slugs de fase usados na previsibilidade do Funil Operações. */
export const PREVISIBILIDADE_OPERACOES_FASE_SLUGS = {
  APROVACAO_CONDOMINIO: FASE_SLUGS.APROVACAO_CONDOMINIO,
  APROVACAO_PREFEITURA: FASE_SLUGS.APROVACAO_PREFEITURA,
} as const;

export type FasePrevisibilidadeMarco = {
  slug: string;
  label: string;
  status: FaseTimelineStatus;
  dataReal: string | null;
  dataPrevista: string | null;
};

/** Formulário Dados Pré Obra no drawer do Funil Operações. */
export type OperacoesPreObraDraft = {
  condominio_aprovada_em: string;
  prefeitura_aprovada_em: string;
  alvara_emitido_em: string;
  prev_aprovacao_condominio: string;
  prev_aprovacao_prefeitura: string;
  prev_emissao_alvara: string;
  prev_envio_credito_obra: string;
  prev_inicio_obra: string;
};

export const OPERACOES_PRE_OBRA_DRAFT_EMPTY: OperacoesPreObraDraft = {
  condominio_aprovada_em: '',
  prefeitura_aprovada_em: '',
  alvara_emitido_em: '',
  prev_aprovacao_condominio: '',
  prev_aprovacao_prefeitura: '',
  prev_emissao_alvara: '',
  prev_envio_credito_obra: '',
  prev_inicio_obra: '',
};

function tsOrDateToInput(iso: string | null | undefined): string {
  const s = String(iso ?? '').trim();
  if (!s) return '';
  const head = s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(head) ? head : '';
}

export function operacoesPreObraDraftFromCard(raw: {
  condominio_aprovada_em?: string | null;
  prefeitura_aprovada_em?: string | null;
  alvara_emitido_em?: string | null;
  prev_aprovacao_condominio?: string | null;
  prev_aprovacao_prefeitura?: string | null;
  prev_emissao_alvara?: string | null;
  prev_envio_credito_obra?: string | null;
  prev_inicio_obra?: string | null;
} | null): OperacoesPreObraDraft {
  if (!raw) return { ...OPERACOES_PRE_OBRA_DRAFT_EMPTY };
  return {
    condominio_aprovada_em: tsOrDateToInput(raw.condominio_aprovada_em),
    prefeitura_aprovada_em: tsOrDateToInput(raw.prefeitura_aprovada_em),
    alvara_emitido_em: tsOrDateToInput(raw.alvara_emitido_em),
    prev_aprovacao_condominio: tsOrDateToInput(raw.prev_aprovacao_condominio),
    prev_aprovacao_prefeitura: tsOrDateToInput(raw.prev_aprovacao_prefeitura),
    prev_emissao_alvara: tsOrDateToInput(raw.prev_emissao_alvara),
    prev_envio_credito_obra: tsOrDateToInput(raw.prev_envio_credito_obra),
    prev_inicio_obra: tsOrDateToInput(raw.prev_inicio_obra),
  };
}
