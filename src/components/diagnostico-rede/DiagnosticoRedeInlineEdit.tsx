'use client';

import { useMemo, type Dispatch, type SetStateAction } from 'react';
import {
  calcEngajamento,
  calcIndicador,
} from '@/lib/rede-diagnostico-engine';
import {
  redeDiagnosticoDraftToRowPreview,
  type RedeDiagnosticoDraft,
  type RedeDiagnosticoSource,
} from '@/lib/rede-diagnostico-form';
import {
  AdimplenciaCell,
  CsatCell,
  DimCell,
  GrupoCell,
  NpsCell,
  PerfilCell,
  PriorityBadge,
  ScoreCell,
} from '@/components/diagnostico-rede/cells';

const inputCls =
  'w-full min-w-0 rounded-md border border-stone-300 bg-white px-1.5 py-1 text-xs text-stone-800';
const selectCls = `${inputCls} pr-6`;

const DIM_OPTS = [
  { value: '', label: '— Não aferido' },
  { value: '0', label: '0 · Não tem' },
  { value: '1', label: '1 · Moderado' },
  { value: '2', label: '2 · Tem' },
];

const DIM_DESC_KEY: Record<'diag_d' | 'diag_c' | 'diag_k', 'diag_d_desc' | 'diag_c_desc' | 'diag_k_desc'> = {
  diag_d: 'diag_d_desc',
  diag_c: 'diag_c_desc',
  diag_k: 'diag_k_desc',
};

const ADIMPL_OPTS = [
  { value: '', label: '—' },
  { value: 'true', label: 'OK' },
  { value: 'false', label: 'Inad.' },
];

function parseAdimplDraft(raw: string): boolean | null {
  const t = raw.trim();
  if (!t) return null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  return null;
}

function parseDimDraftValue(raw: string): number | null {
  const t = raw.trim();
  if (!t || !['0', '1', '2'].includes(t)) return null;
  return Number(t);
}

const TEND_OPTS = [
  { value: '', label: '—' },
  { value: '↑', label: '↑' },
  { value: '→', label: '→' },
  { value: '↓', label: '↓' },
];

type SetDiagDraft = Dispatch<SetStateAction<RedeDiagnosticoDraft>>;

function setField<K extends keyof RedeDiagnosticoDraft>(
  setDraft: SetDiagDraft,
  key: K,
  value: RedeDiagnosticoDraft[K],
) {
  setDraft((d) => ({ ...d, [key]: value }));
}

export function DiagnosticoInlineScore({
  row,
  draft,
  internalView,
}: {
  row: RedeDiagnosticoSource;
  draft: RedeDiagnosticoDraft;
  internalView?: boolean;
}) {
  const preview = useMemo(() => redeDiagnosticoDraftToRowPreview(row, draft), [row, draft]);
  return <ScoreCell score={calcEngajamento(preview)} internalView={internalView ?? false} />;
}

export function DiagnosticoInlineDim({
  field,
  draft,
  setDraft,
}: {
  field: 'diag_d' | 'diag_c' | 'diag_k';
  draft: RedeDiagnosticoDraft;
  setDraft: SetDiagDraft;
}) {
  const val = parseDimDraftValue(draft[field]);
  const desc = draft[DIM_DESC_KEY[field]] || null;

  return (
    <div className="flex min-w-[52px] flex-col gap-1">
      <DimCell val={val} desc={desc} />
      <select
        value={draft[field]}
        onChange={(e) => setField(setDraft, field, e.target.value)}
        className={`${selectCls} min-w-[52px] text-center font-semibold tabular-nums`}
        aria-label={field}
      >
        {DIM_OPTS.map((o) => (
          <option key={o.value || 'na'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DiagnosticoInlineNps({
  draft,
  setDraft,
}: {
  draft: RedeDiagnosticoDraft;
  setDraft: SetDiagDraft;
}) {
  const raw = draft.diag_nps.trim();
  const preview = raw !== '' && Number.isInteger(Number(raw)) ? Number(raw) : null;

  return (
    <div className="flex min-w-[72px] flex-col gap-1">
      <NpsCell nps={preview} />
      <input
        type="number"
        min={0}
        max={10}
        step={1}
        value={draft.diag_nps}
        onChange={(e) => setField(setDraft, 'diag_nps', e.target.value)}
        className={`${inputCls} w-14 tabular-nums`}
        placeholder="—"
        aria-label="NPS"
      />
    </div>
  );
}

export function DiagnosticoInlineCsat({
  draft,
  setDraft,
}: {
  draft: RedeDiagnosticoDraft;
  setDraft: SetDiagDraft;
}) {
  const raw = draft.diag_csat.trim().replace(',', '.');
  const n = raw !== '' ? Number(raw) : NaN;
  const preview = Number.isFinite(n) ? n : null;

  return (
    <div className="flex min-w-[72px] flex-col gap-1">
      <CsatCell csat={preview} />
      <input
        type="number"
        min={1}
        max={5}
        step={0.1}
        value={draft.diag_csat}
        onChange={(e) => setField(setDraft, 'diag_csat', e.target.value)}
        className={`${inputCls} w-14 tabular-nums`}
        placeholder="—"
        aria-label="CSAT"
      />
    </div>
  );
}

export function DiagnosticoInlineIndicador({
  draft,
  setDraft,
  row,
}: {
  draft: RedeDiagnosticoDraft;
  setDraft: SetDiagDraft;
  row: RedeDiagnosticoSource;
}) {
  const preview = useMemo(() => redeDiagnosticoDraftToRowPreview(row, draft), [row, draft]);
  const ind = calcIndicador(preview);
  const labels: Record<string, string> = {
    ritmo: 'No ritmo',
    proximo: 'Próximo',
    regular: 'Regular',
    abaixo: 'Abaixo',
  };
  return (
    <div className="flex min-w-[88px] flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          step={1}
          value={draft.diag_contratos_12m}
          onChange={(e) => setField(setDraft, 'diag_contratos_12m', e.target.value)}
          className={`${inputCls} w-10`}
          aria-label="Contratos 12m"
        />
        <span className="text-xs text-stone-400">/</span>
        <input
          type="number"
          min={1}
          max={99}
          step={1}
          value={draft.diag_ano_meta}
          onChange={(e) => setField(setDraft, 'diag_ano_meta', e.target.value)}
          className={`${inputCls} w-10`}
          aria-label="Meta anual"
        />
      </div>
      {ind ? (
        <span className="text-[9px] font-semibold text-stone-500">{labels[ind] ?? ind}</span>
      ) : null}
    </div>
  );
}

export function DiagnosticoInlineAdimplencia({
  draft,
  setDraft,
}: {
  draft: RedeDiagnosticoDraft;
  setDraft: SetDiagDraft;
}) {
  const preview = parseAdimplDraft(draft.diag_adimplente);

  return (
    <div className="flex min-w-[56px] flex-col gap-1">
      <AdimplenciaCell adimplente={preview} />
      <select
        value={draft.diag_adimplente}
        onChange={(e) => setField(setDraft, 'diag_adimplente', e.target.value)}
        className={`${selectCls} min-w-[56px] text-center text-xs font-semibold`}
        aria-label="Adimplência"
      >
        {ADIMPL_OPTS.map((o) => (
          <option key={o.value || 'na'} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function DiagnosticoInlineComputed({
  row,
  draft,
  kind,
  internalView,
}: {
  row: RedeDiagnosticoSource;
  draft: RedeDiagnosticoDraft;
  kind: 'prio' | 'perfil' | 'grupo';
  internalView?: boolean;
}) {
  const preview = useMemo(() => redeDiagnosticoDraftToRowPreview(row, draft), [row, draft]);
  if (kind === 'prio') return <PriorityBadge row={preview} />;
  if (kind === 'perfil') return <PerfilCell row={preview} internalView={internalView ?? false} />;
  return (
    <div>
      <GrupoCell row={preview} />
    </div>
  );
}

export function DiagnosticoInlineTendencias({
  draft,
  setDraft,
}: {
  draft: RedeDiagnosticoDraft;
  setDraft: SetDiagDraft;
}) {
  return (
    <div className="flex min-w-[72px] flex-col gap-1">
      {(
        [
          ['diag_tend_eng', 'Eng.'],
          ['diag_tend_rel', 'Rel.'],
          ['diag_tend_ind', 'Ind.'],
        ] as const
      ).map(([key, lab]) => (
        <label key={key} className="flex items-center gap-1 text-[9px] text-stone-500">
          <span className="w-6 shrink-0">{lab}</span>
          <select
            value={draft[key]}
            onChange={(e) => setField(setDraft, key, e.target.value)}
            className={`${selectCls} flex-1 py-0.5`}
          >
            {TEND_OPTS.map((o) => (
              <option key={o.value || 'na'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

export function DiagnosticoInlineProximaAcao({
  draft,
  setDraft,
}: {
  draft: RedeDiagnosticoDraft;
  setDraft: SetDiagDraft;
}) {
  return (
    <textarea
      value={draft.diag_proxima_acao}
      onChange={(e) => setField(setDraft, 'diag_proxima_acao', e.target.value)}
      rows={2}
      className={`${inputCls} min-w-[120px] resize-y`}
      placeholder="Próxima ação…"
      aria-label="Próxima ação"
    />
  );
}

export function DiagnosticoInlineExtras({
  draft,
  setDraft,
}: {
  draft: RedeDiagnosticoDraft;
  setDraft: SetDiagDraft;
}) {
  const gaOpts = ['', 'GA1', 'GA2', 'GA3', 'GA4', 'GA5', 'GA6', 'GA7'] as const;
  return (
    <div className="mt-1 flex flex-col gap-1">
      <select
        value={draft.diag_grupo_sec}
        onChange={(e) => setField(setDraft, 'diag_grupo_sec', e.target.value)}
        className={`${selectCls} max-w-[130px] text-[10px]`}
        aria-label="Grupo secundário"
      >
        {gaOpts.map((g) => (
          <option key={g || 'auto'} value={g}>
            {g ? `${g}` : 'GA auto'}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-[10px] text-stone-600">
        <input
          type="checkbox"
          checked={draft.diag_adormecido}
          onChange={(e) => setField(setDraft, 'diag_adormecido', e.target.checked)}
          className="h-3.5 w-3.5"
        />
        Adormecido
      </label>
    </div>
  );
}
