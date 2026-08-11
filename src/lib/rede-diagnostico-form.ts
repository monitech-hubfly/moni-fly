import type { DiagGrupo } from '@/lib/rede-diagnostico-engine';
import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';

/** Linha mínima para editar/exibir diagnóstico (tabela ou detalhe). */
export type RedeDiagnosticoSource = Pick<
  RedeFranqueadoRowDb,
  | 'id'
  | 'status_franquia'
  | 'ordem'
  | 'diag_d'
  | 'diag_c'
  | 'diag_k'
  | 'diag_d_desc'
  | 'diag_c_desc'
  | 'diag_k_desc'
  | 'diag_nps'
  | 'diag_csat'
  | 'diag_contratos_12m'
  | 'diag_ano_meta'
  | 'diag_tend_eng'
  | 'diag_tend_rel'
  | 'diag_tend_ind'
  | 'diag_proxima_acao'
  | 'diag_adormecido'
  | 'diag_ultimo_contato'
  | 'diag_ultima_aval'
  | 'diag_avaliado_por'
  | 'diag_grupo_sec'
>;

export type RedeDiagnosticoDraft = {
  diag_d: string;
  diag_c: string;
  diag_k: string;
  diag_d_desc: string;
  diag_c_desc: string;
  diag_k_desc: string;
  diag_nps: string;
  diag_csat: string;
  diag_contratos_12m: string;
  diag_ano_meta: string;
  diag_tend_eng: string;
  diag_tend_rel: string;
  diag_tend_ind: string;
  diag_proxima_acao: string;
  diag_adormecido: boolean;
  diag_ultimo_contato: string;
  diag_ultima_aval: string;
  diag_avaliado_por: string;
  diag_grupo_sec: string;
};

export type RedeDiagnosticoPatch = Partial<{
  diag_d: number | null;
  diag_c: number | null;
  diag_k: number | null;
  diag_d_desc: string | null;
  diag_c_desc: string | null;
  diag_k_desc: string | null;
  diag_nps: number | null;
  diag_csat: number | null;
  diag_contratos_12m: number | null;
  diag_ano_meta: number | null;
  diag_tend_eng: '↑' | '→' | '↓' | null;
  diag_tend_rel: '↑' | '→' | '↓' | null;
  diag_tend_ind: '↑' | '→' | '↓' | null;
  diag_proxima_acao: string | null;
  diag_adormecido: boolean;
  diag_ultimo_contato: string | null;
  diag_ultima_aval: string | null;
  diag_avaliado_por: string | null;
  diag_grupo_sec: DiagGrupo | null;
}>;

const DIM_VALUES = new Set(['0', '2', '3']);
const TEND_VALUES = new Set(['↑', '→', '↓']);
const GA_VALUES = new Set(['GA1', 'GA2', 'GA3', 'GA4', 'GA5', 'GA6', 'GA7']);

function dimToStr(v: number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function dateToInput(v: string | null | undefined): string {
  if (!v) return '';
  return v.length >= 10 ? v.slice(0, 10) : v;
}

export function redeRowToDiagnosticoDraft(row: RedeDiagnosticoSource): RedeDiagnosticoDraft {
  return {
    diag_d: dimToStr(row.diag_d),
    diag_c: dimToStr(row.diag_c),
    diag_k: dimToStr(row.diag_k),
    diag_d_desc: row.diag_d_desc ?? '',
    diag_c_desc: row.diag_c_desc ?? '',
    diag_k_desc: row.diag_k_desc ?? '',
    diag_nps: row.diag_nps !== null && row.diag_nps !== undefined ? String(row.diag_nps) : '',
    diag_csat: row.diag_csat !== null && row.diag_csat !== undefined ? String(row.diag_csat) : '',
    diag_contratos_12m:
      row.diag_contratos_12m !== null && row.diag_contratos_12m !== undefined
        ? String(row.diag_contratos_12m)
        : '',
    diag_ano_meta:
      row.diag_ano_meta !== null && row.diag_ano_meta !== undefined ? String(row.diag_ano_meta) : '4',
    diag_tend_eng: row.diag_tend_eng ?? '',
    diag_tend_rel: row.diag_tend_rel ?? '',
    diag_tend_ind: row.diag_tend_ind ?? '',
    diag_proxima_acao: row.diag_proxima_acao ?? '',
    diag_adormecido: row.diag_adormecido === true,
    diag_ultimo_contato: dateToInput(row.diag_ultimo_contato),
    diag_ultima_aval: dateToInput(row.diag_ultima_aval),
    diag_avaliado_por: row.diag_avaliado_por ?? '',
    diag_grupo_sec: row.diag_grupo_sec ?? '',
  };
}

export function redeDiagnosticoDraftToRowPreview(
  row: RedeDiagnosticoSource,
  draft: RedeDiagnosticoDraft,
): RedeDiagnosticoSource {
  const patch = parseRedeDiagnosticoDraft(draft);
  if (!patch.ok) return row;
  return { ...row, ...patch.patch };
}

export function parseRedeDiagnosticoDraft(
  draft: RedeDiagnosticoDraft,
): { ok: true; patch: RedeDiagnosticoPatch } | { ok: false; error: string } {
  const patch: RedeDiagnosticoPatch = {};

  for (const key of ['diag_d', 'diag_c', 'diag_k'] as const) {
    const raw = draft[key].trim();
    if (!raw) {
      patch[key] = null;
      continue;
    }
    if (!DIM_VALUES.has(raw)) {
      return { ok: false, error: `${key.toUpperCase()} deve ser 0, 2 ou 3.` };
    }
    patch[key] = Number(raw);
  }

  for (const key of ['diag_d_desc', 'diag_c_desc', 'diag_k_desc', 'diag_proxima_acao', 'diag_avaliado_por'] as const) {
    const raw = draft[key].trim();
    patch[key] = raw || null;
  }

  const npsRaw = draft.diag_nps.trim();
  if (!npsRaw) patch.diag_nps = null;
  else {
    const n = Number(npsRaw);
    if (!Number.isInteger(n) || n < 0 || n > 10) {
      return { ok: false, error: 'NPS deve ser um inteiro entre 0 e 10.' };
    }
    patch.diag_nps = n;
  }

  const csatRaw = draft.diag_csat.trim();
  if (!csatRaw) patch.diag_csat = null;
  else {
    const n = Number(csatRaw.replace(',', '.'));
    if (!Number.isFinite(n) || n < 1 || n > 5) {
      return { ok: false, error: 'CSAT deve estar entre 1,0 e 5,0.' };
    }
    patch.diag_csat = Math.round(n * 10) / 10;
  }

  const ctRaw = draft.diag_contratos_12m.trim();
  if (!ctRaw) patch.diag_contratos_12m = null;
  else {
    const n = Number(ctRaw);
    if (!Number.isInteger(n) || n < 0) {
      return { ok: false, error: 'Contratos 12m deve ser um inteiro ≥ 0.' };
    }
    patch.diag_contratos_12m = n;
  }

  const metaRaw = draft.diag_ano_meta.trim() || '4';
  const meta = Number(metaRaw);
  if (!Number.isInteger(meta) || meta < 1 || meta > 99) {
    return { ok: false, error: 'Meta anual deve ser um inteiro entre 1 e 99.' };
  }
  patch.diag_ano_meta = meta;

  for (const key of ['diag_tend_eng', 'diag_tend_rel', 'diag_tend_ind'] as const) {
    const raw = draft[key].trim();
    if (!raw) {
      patch[key] = null;
      continue;
    }
    if (!TEND_VALUES.has(raw)) {
      return { ok: false, error: 'Tendência inválida.' };
    }
    patch[key] = raw as '↑' | '→' | '↓';
  }

  patch.diag_adormecido = draft.diag_adormecido;

  for (const key of ['diag_ultimo_contato', 'diag_ultima_aval'] as const) {
    const raw = draft[key].trim();
    patch[key] = raw || null;
  }

  const gaRaw = draft.diag_grupo_sec.trim();
  if (!gaRaw) patch.diag_grupo_sec = null;
  else if (!GA_VALUES.has(gaRaw)) {
    return { ok: false, error: 'Grupo secundário inválido.' };
  } else {
    patch.diag_grupo_sec = gaRaw as DiagGrupo;
  }

  return { ok: true, patch };
}
