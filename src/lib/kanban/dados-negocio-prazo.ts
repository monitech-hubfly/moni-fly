import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import type { SlaTipo } from '@/lib/dias-uteis';
import {
  adicionarDiasCorridos,
  adicionarDiasUteis,
  formatLocalYmd,
  parseIsoDateOnlyLocal,
} from '@/lib/dias-uteis';
import type { CalculadoraFaseLinha } from '@/lib/kanban/calculadora-fases';
import { ESTEIRA_COLUNAS } from '@/lib/kanban/pipeline-esteira-datas';
import { ESTEIRA_TRES_ETAPAS } from '@/lib/kanban/pipeline-esteira-tres-etapas';

export type NegocioPrazoModo = 'fase' | 'data';

export type NegocioPrazoValores = {
  dias: number | null;
  slaTipo: SlaTipo | null;
  modo: NegocioPrazoModo | null;
  faseId: string | null;
  data: string | null;
};

export type NegocioPrazoDraft = {
  modo: '' | NegocioPrazoModo;
  dias: string;
  slaTipo: SlaTipo;
  faseId: string;
  data: string;
};

export const NEGOCIO_PRAZO_DRAFT_VAZIO: NegocioPrazoDraft = {
  modo: '',
  dias: '',
  slaTipo: 'uteis',
  faseId: '',
  data: '',
};

export type FaseNegocioPrazoOpcao = {
  id: string;
  label: string;
};

/** Slug da fase âncora padrão do Prazo Opção (Funil Portfólio — Opção). */
export const NEGOCIO_PRAZO_OPCAO_FASE_SLUG = 'step_3';

export const NEGOCIO_PRAZO_OPCAO_DRAFT_PADRAO: NegocioPrazoDraft = {
  modo: 'fase',
  dias: '30',
  slaTipo: 'corridos',
  faseId: '',
  data: '',
};

export const NEGOCIO_PRAZO_OPCAO_VALORES_PADRAO: NegocioPrazoValores = {
  dias: 30,
  slaTipo: 'corridos',
  modo: 'fase',
  faseId: null,
  data: null,
};

export function resolverFaseIdPrazoOpcaoPadrao(opcoes: FaseNegocioPrazoOpcao[]): string {
  const porLabel = opcoes.find((o) => /portf[oó]lio\s*—\s*op[cç][aã]o/i.test(o.label));
  if (porLabel) return porLabel.id;
  return '';
}

export function negocioPrazoOpcaoDraftPadrao(opcoes: FaseNegocioPrazoOpcao[] = []): NegocioPrazoDraft {
  const faseId = resolverFaseIdPrazoOpcaoPadrao(opcoes);
  return {
    ...NEGOCIO_PRAZO_OPCAO_DRAFT_PADRAO,
    faseId,
  };
}

export function negocioPrazoOpcaoValoresPadrao(opcoes: FaseNegocioPrazoOpcao[] = []): NegocioPrazoValores {
  const faseId = resolverFaseIdPrazoOpcaoPadrao(opcoes) || null;
  return {
    ...NEGOCIO_PRAZO_OPCAO_VALORES_PADRAO,
    faseId,
  };
}

function prazoOpcaoProcessoVazio(proc: {
  prazo_opcao_dias?: number | null;
  prazo_opcao_sla_tipo?: SlaTipo | null;
  prazo_opcao_modo?: NegocioPrazoModo | null;
  prazo_opcao_fase_id?: string | null;
  prazo_opcao_data?: string | null;
} | null | undefined): boolean {
  if (!proc) return true;
  return proc.prazo_opcao_modo == null;
}

export function negocioPrazoOpcaoDraftFromProcesso(
  proc: {
    prazo_opcao_dias?: number | null;
    prazo_opcao_sla_tipo?: SlaTipo | null;
    prazo_opcao_modo?: NegocioPrazoModo | null;
    prazo_opcao_fase_id?: string | null;
    prazo_opcao_data?: string | null;
  } | null | undefined,
  opcoes: FaseNegocioPrazoOpcao[] = [],
): NegocioPrazoDraft {
  if (prazoOpcaoProcessoVazio(proc)) {
    return negocioPrazoOpcaoDraftPadrao(opcoes);
  }
  return negocioPrazoDraftFromValores({
    dias: proc?.prazo_opcao_dias ?? null,
    slaTipo: proc?.prazo_opcao_sla_tipo ?? null,
    modo: proc?.prazo_opcao_modo ?? null,
    faseId: proc?.prazo_opcao_fase_id ?? null,
    data: proc?.prazo_opcao_data ?? null,
  });
}

/** Slug da fase âncora padrão do Prazo Instrumento Garantidor (Pré Obra e Obra — Aprov. Pref.). */
export const NEGOCIO_PRAZO_INSTRUMENTO_FASE_SLUG = 'aprovacao_prefeitura';

export const NEGOCIO_PRAZO_INSTRUMENTO_DRAFT_PADRAO: NegocioPrazoDraft = {
  modo: 'fase',
  dias: '90',
  slaTipo: 'corridos',
  faseId: '',
  data: '',
};

export const NEGOCIO_PRAZO_INSTRUMENTO_VALORES_PADRAO: NegocioPrazoValores = {
  dias: 90,
  slaTipo: 'corridos',
  modo: 'fase',
  faseId: null,
  data: null,
};

export function resolverFaseIdPrazoInstrumentoPadrao(opcoes: FaseNegocioPrazoOpcao[]): string {
  const porLabel = opcoes.find((o) => /pr[eé]\s*obra e obra\s*—\s*aprov\.?\s*pref\.?/i.test(o.label));
  if (porLabel) return porLabel.id;
  const col = ESTEIRA_COLUNAS.find((c) => c.slug === NEGOCIO_PRAZO_INSTRUMENTO_FASE_SLUG);
  return col?.faseId ?? '';
}

export function negocioPrazoInstrumentoDraftPadrao(opcoes: FaseNegocioPrazoOpcao[] = []): NegocioPrazoDraft {
  return {
    ...NEGOCIO_PRAZO_INSTRUMENTO_DRAFT_PADRAO,
    faseId: resolverFaseIdPrazoInstrumentoPadrao(opcoes),
  };
}

export function negocioPrazoInstrumentoValoresPadrao(opcoes: FaseNegocioPrazoOpcao[] = []): NegocioPrazoValores {
  const faseId = resolverFaseIdPrazoInstrumentoPadrao(opcoes) || null;
  return {
    ...NEGOCIO_PRAZO_INSTRUMENTO_VALORES_PADRAO,
    faseId,
  };
}

function prazoInstrumentoProcessoVazio(proc: {
  prazo_instrumento_garantidor_dias?: number | null;
  prazo_instrumento_garantidor_sla_tipo?: SlaTipo | null;
  prazo_instrumento_garantidor_modo?: NegocioPrazoModo | null;
  prazo_instrumento_garantidor_fase_id?: string | null;
  prazo_instrumento_garantidor_data?: string | null;
} | null | undefined): boolean {
  if (!proc) return true;
  return proc.prazo_instrumento_garantidor_modo == null;
}

export function negocioPrazoInstrumentoDraftFromProcesso(
  proc: {
    prazo_instrumento_garantidor_dias?: number | null;
    prazo_instrumento_garantidor_sla_tipo?: SlaTipo | null;
    prazo_instrumento_garantidor_modo?: NegocioPrazoModo | null;
    prazo_instrumento_garantidor_fase_id?: string | null;
    prazo_instrumento_garantidor_data?: string | null;
  } | null | undefined,
  opcoes: FaseNegocioPrazoOpcao[] = [],
): NegocioPrazoDraft {
  if (prazoInstrumentoProcessoVazio(proc)) {
    return negocioPrazoInstrumentoDraftPadrao(opcoes);
  }
  return negocioPrazoDraftFromValores({
    dias: proc?.prazo_instrumento_garantidor_dias ?? null,
    slaTipo: proc?.prazo_instrumento_garantidor_sla_tipo ?? null,
    modo: proc?.prazo_instrumento_garantidor_modo ?? null,
    faseId: proc?.prazo_instrumento_garantidor_fase_id ?? null,
    data: proc?.prazo_instrumento_garantidor_data ?? null,
  });
}

export function negocioPrazoDraftFromValores(v: NegocioPrazoValores | null | undefined): NegocioPrazoDraft {
  if (!v?.modo) return { ...NEGOCIO_PRAZO_DRAFT_VAZIO };
  return {
    modo: v.modo,
    dias: v.dias != null && v.dias > 0 ? String(v.dias) : '',
    slaTipo: v.slaTipo === 'corridos' ? 'corridos' : 'uteis',
    faseId: v.faseId ?? '',
    data: v.data?.slice(0, 10) ?? '',
  };
}

export function negocioPrazoValoresFromDraft(draft: NegocioPrazoDraft): NegocioPrazoValores {
  if (!draft.modo) {
    return { dias: null, slaTipo: null, modo: null, faseId: null, data: null };
  }
  if (draft.modo === 'data') {
    const data = draft.data.trim().slice(0, 10);
    return {
      dias: null,
      slaTipo: null,
      modo: 'data',
      faseId: null,
      data: /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null,
    };
  }
  const dias = parseInt(draft.dias.trim(), 10);
  const faseId = draft.faseId.trim();
  return {
    dias: Number.isFinite(dias) && dias > 0 ? dias : null,
    slaTipo: draft.slaTipo,
    modo: 'fase',
    faseId: faseId || null,
    data: null,
  };
}

export function formatNegocioPrazoDisplay(
  v: NegocioPrazoValores | null | undefined,
  faseLabel?: string | null,
): string {
  if (!v?.modo) return '—';
  if (v.modo === 'data') {
    if (!v.data) return '—';
    return formatIsoDateOnlyPtBr(v.data) ?? v.data;
  }
  if (!v.dias || v.dias <= 0) return '—';
  const un = v.slaTipo === 'corridos' ? 'd.c.' : 'd.u.';
  const fase = faseLabel?.trim();
  return fase ? `${v.dias} ${un} a partir de ${fase}` : `${v.dias} ${un} (fase não definida)`;
}

export type NegocioPrazoDbPatch = {
  dias: number | null;
  slaTipo: SlaTipo | null;
  modo: NegocioPrazoModo | null;
  faseId: string | null;
  data: string | null;
};

export function negocioPrazoValoresFromProcessoRow(
  row: Record<string, unknown> | null | undefined,
  prefix: 'prazo_opcao' | 'prazo_instrumento_garantidor',
): NegocioPrazoValores {
  if (!row) {
    return { dias: null, slaTipo: null, modo: null, faseId: null, data: null };
  }
  const modoRaw = row[`${prefix}_modo`];
  const modo = modoRaw === 'fase' || modoRaw === 'data' ? modoRaw : null;
  const diasRaw = row[`${prefix}_dias`];
  const dias =
    diasRaw != null && diasRaw !== '' && Number.isFinite(Number(diasRaw)) ? Number(diasRaw) : null;
  const slaRaw = row[`${prefix}_sla_tipo`];
  const slaTipo = slaRaw === 'corridos' ? 'corridos' : slaRaw === 'uteis' ? 'uteis' : null;
  const faseRaw = row[`${prefix}_fase_id`];
  const faseId = faseRaw != null && String(faseRaw).trim() ? String(faseRaw) : null;
  const dataRaw = row[`${prefix}_data`];
  const data = dataRaw != null && String(dataRaw).trim() ? String(dataRaw).slice(0, 10) : null;
  return { dias, slaTipo, modo, faseId, data };
}

export function negocioPrazoDbPatchFromValores(v: NegocioPrazoValores, prefix: 'prazo_opcao' | 'prazo_instrumento_garantidor') {
  return {
    [`${prefix}_dias`]: v.modo === 'fase' ? v.dias : null,
    [`${prefix}_sla_tipo`]: v.modo === 'fase' ? v.slaTipo : null,
    [`${prefix}_modo`]: v.modo,
    [`${prefix}_fase_id`]: v.modo === 'fase' ? v.faseId : null,
    [`${prefix}_data`]: v.modo === 'data' ? v.data : null,
  };
}

export function faseLabelFromOpcoes(faseId: string | null | undefined, opcoes: FaseNegocioPrazoOpcao[]): string | null {
  if (!faseId) return null;
  const hit = opcoes.find((o) => o.id === faseId)?.label;
  if (hit) return hit;
  const col = ESTEIRA_COLUNAS.find((c) => c.faseId === faseId);
  if (!col) return null;
  const etapa =
    col.ordemGlobal <= 3
      ? ESTEIRA_TRES_ETAPAS[0].label
      : col.ordemGlobal <= 10
        ? ESTEIRA_TRES_ETAPAS[1].label
        : ESTEIRA_TRES_ETAPAS[2].label;
  return `${etapa} — ${col.label}`;
}

/** Resolve data de vencimento do prazo (Dados do Negócio) na timeline da calculadora. */
export function resolverDataPrazoNegocioYmd(
  valores: NegocioPrazoValores | null | undefined,
  linhas: CalculadoraFaseLinha[],
): { data: string | null; isPrevisto: boolean } {
  if (!valores?.modo) return { data: null, isPrevisto: true };

  if (valores.modo === 'data') {
    const d = valores.data?.trim().slice(0, 10) ?? '';
    return {
      data: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null,
      isPrevisto: true,
    };
  }

  if (!valores.dias || valores.dias <= 0 || !valores.faseId) {
    return { data: null, isPrevisto: true };
  }

  const linha = linhas.find((l) => l.faseId === valores.faseId);
  const anchorYmd = linha
    ? linha.dataFimReal ?? linha.dataFimEstimada ?? linha.dataInicioReal
    : null;
  if (!anchorYmd) return { data: null, isPrevisto: true };

  const base = parseIsoDateOnlyLocal(anchorYmd);
  if (!base) return { data: null, isPrevisto: true };

  const tipo: SlaTipo = valores.slaTipo === 'corridos' ? 'corridos' : 'uteis';
  const fim =
    tipo === 'corridos' ? adicionarDiasCorridos(base, valores.dias) : adicionarDiasUteis(base, valores.dias);

  return {
    data: formatLocalYmd(fim),
    isPrevisto: linha?.dataFimReal == null,
  };
}

export function negocioPrazoValoresFromProcessoModal(proc: {
  prazo_opcao_dias?: number | null;
  prazo_opcao_sla_tipo?: SlaTipo | null;
  prazo_opcao_modo?: NegocioPrazoModo | null;
  prazo_opcao_fase_id?: string | null;
  prazo_opcao_data?: string | null;
  prazo_instrumento_garantidor_dias?: number | null;
  prazo_instrumento_garantidor_sla_tipo?: SlaTipo | null;
  prazo_instrumento_garantidor_modo?: NegocioPrazoModo | null;
  prazo_instrumento_garantidor_fase_id?: string | null;
  prazo_instrumento_garantidor_data?: string | null;
} | null | undefined,
  opcoes: FaseNegocioPrazoOpcao[] = [],
): {
  prazo_opcao: NegocioPrazoValores;
  prazo_instrumento_garantidor: NegocioPrazoValores;
} {
  return {
    prazo_opcao: prazoOpcaoProcessoVazio(proc)
      ? negocioPrazoOpcaoValoresPadrao(opcoes)
      : {
          dias: proc?.prazo_opcao_dias ?? null,
          slaTipo: proc?.prazo_opcao_sla_tipo ?? null,
          modo: proc?.prazo_opcao_modo ?? null,
          faseId: proc?.prazo_opcao_fase_id ?? null,
          data: proc?.prazo_opcao_data ?? null,
        },
    prazo_instrumento_garantidor: prazoInstrumentoProcessoVazio(proc)
      ? negocioPrazoInstrumentoValoresPadrao(opcoes)
      : {
          dias: proc?.prazo_instrumento_garantidor_dias ?? null,
          slaTipo: proc?.prazo_instrumento_garantidor_sla_tipo ?? null,
          modo: proc?.prazo_instrumento_garantidor_modo ?? null,
          faseId: proc?.prazo_instrumento_garantidor_fase_id ?? null,
          data: proc?.prazo_instrumento_garantidor_data ?? null,
        },
  };
}
