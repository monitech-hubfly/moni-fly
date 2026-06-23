import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import type { SlaTipo } from '@/lib/dias-uteis';
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

export type FaseNegocioPrazoOpcao = {
  id: string;
  label: string;
};

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
