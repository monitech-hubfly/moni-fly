import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import type { SlaTipo } from '@/lib/dias-uteis';

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
