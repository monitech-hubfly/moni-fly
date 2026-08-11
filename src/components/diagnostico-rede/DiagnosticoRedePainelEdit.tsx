'use client';

import { useMemo, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
  calcEngajamento,
  calcGrupo,
  calcPerfil,
  calcPriority,
  calcRelacao,
  calcIndicador,
  GA_NOME,
  type DiagGrupo,
} from '@/lib/rede-diagnostico-engine';
import {
  parseRedeDiagnosticoDraft,
  redeDiagnosticoDraftToRowPreview,
  redeRowToDiagnosticoDraft,
  type RedeDiagnosticoDraft,
} from '@/lib/rede-diagnostico-form';
import type { RedeDiagnosticoSource } from '@/lib/rede-diagnostico-form';
import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';
import { atualizarRedeFranqueadoDiagnostico } from '@/app/rede-franqueados/actions';
import {
  CsatCell,
  DimCell,
  GrupoCell,
  IndCell,
  NpsCell,
  PerfilCell,
  PriorityBadge,
  ScoreCell,
  TendCell,
} from '@/components/diagnostico-rede/cells';
import { redeAlertError, redeAlertSuccess, redeBtnGhost, redeBtnPrimary } from '@/app/rede-franqueados/rede-ui';

const DIM_OPTS = [
  { value: '', label: '— Não aferido' },
  { value: '0', label: '0 — Não tem' },
  { value: '2', label: '2 — Moderado' },
  { value: '3', label: '3 — Tem' },
];

const TEND_OPTS = [
  { value: '', label: '—' },
  { value: '↑', label: '↑ Subindo' },
  { value: '→', label: '→ Estável' },
  { value: '↓', label: '↓ Caindo' },
];

const GA_OPTS: { value: string; label: string }[] = [
  { value: '', label: '— Automático' },
  ...(['GA1', 'GA2', 'GA3', 'GA4', 'GA5', 'GA6', 'GA7'] as DiagGrupo[]).map((g) => ({
    value: g,
    label: `${g} — ${GA_NOME[g]}`,
  })),
];

const fieldClass =
  'mt-0.5 w-full rounded-lg border border-[color:var(--moni-border-default,#e8e2da)] bg-white px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)]';
const labelClass = 'text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]';

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className={labelClass}>{label}</span>
      {children}
      {hint ? <span className="mt-0.5 block text-[10px] text-[color:var(--moni-text-tertiary)]">{hint}</span> : null}
    </label>
  );
}

type Props = {
  row: RedeDiagnosticoSource;
  internalView?: boolean;
  onCancel?: () => void;
  onSaved?: () => void;
  compact?: boolean;
};

export function DiagnosticoRedePainelEdit({
  row,
  internalView = false,
  onCancel,
  onSaved,
  compact = false,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<RedeDiagnosticoDraft>(() => redeRowToDiagnosticoDraft(row));
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const previewRow = useMemo(() => redeDiagnosticoDraftToRowPreview(row, draft), [row, draft]);

  function setField<K extends keyof RedeDiagnosticoDraft>(key: K, value: RedeDiagnosticoDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setMsg(null);
  }

  function handleSave() {
    const parsed = parseRedeDiagnosticoDraft(draft);
    if (!parsed.ok) {
      setMsg({ tipo: 'erro', texto: parsed.error });
      return;
    }
    startTransition(async () => {
      const res = await atualizarRedeFranqueadoDiagnostico(row.id, parsed.patch);
      if (!res.ok) {
        setMsg({ tipo: 'erro', texto: res.error });
        return;
      }
      setMsg({ tipo: 'ok', texto: res.mensagem });
      router.refresh();
      onSaved?.();
    });
  }

  return (
    <div
      className={`rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0,#fff)] ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--moni-navy-800)]">Diagnóstico da unidade</h3>
          <p className="text-xs text-[color:var(--moni-text-secondary)]">
            D = Dinheiro · C = Comportamento · K = Conhecimento. Score e prioridade são calculados ao salvar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onCancel ? (
            <button type="button" onClick={onCancel} disabled={pending} className={redeBtnGhost}>
              Fechar
            </button>
          ) : null}
          <button type="button" onClick={handleSave} disabled={pending} className={redeBtnPrimary}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Salvar diagnóstico
          </button>
        </div>
      </div>

      {msg ? (
        <div className={`mb-3 ${msg.tipo === 'ok' ? redeAlertSuccess : redeAlertError}`} role="status">
          {msg.texto}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Engajamento */}
        <section className="rounded-lg border border-green-200/80 bg-green-50/30 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-green-800">Engajamento</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(['diag_d', 'diag_c', 'diag_k'] as const).map((key, i) => (
              <Field key={key} label={['D — Dinheiro', 'C — Comportamento', 'K — Conhecimento'][i]}>
                <select
                  value={draft[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  className={fieldClass}
                >
                  {DIM_OPTS.map((o) => (
                    <option key={o.value || 'na'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <Field label="Nota D (opcional)">
              <input
                type="text"
                value={draft.diag_d_desc}
                onChange={(e) => setField('diag_d_desc', e.target.value)}
                className={fieldClass}
                placeholder="Observação"
              />
            </Field>
            <Field label="Nota C (opcional)">
              <input
                type="text"
                value={draft.diag_c_desc}
                onChange={(e) => setField('diag_c_desc', e.target.value)}
                className={fieldClass}
                placeholder="Observação"
              />
            </Field>
            <Field label="Nota K (opcional)">
              <input
                type="text"
                value={draft.diag_k_desc}
                onChange={(e) => setField('diag_k_desc', e.target.value)}
                className={fieldClass}
                placeholder="Observação"
              />
            </Field>
          </div>
        </section>

        {/* Relação */}
        <section className="rounded-lg border border-rose-200/80 bg-rose-50/30 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-rose-800">Relação</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="NPS (0–10)" hint="≤6 detrator · ≤8 neutro · >8 promotor">
              <input
                type="number"
                min={0}
                max={10}
                step={1}
                value={draft.diag_nps}
                onChange={(e) => setField('diag_nps', e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="CSAT (1,0–5,0)">
              <input
                type="number"
                min={1}
                max={5}
                step={0.1}
                value={draft.diag_csat}
                onChange={(e) => setField('diag_csat', e.target.value)}
                className={fieldClass}
              />
            </Field>
          </div>
        </section>

        {/* Indicador */}
        <section className="rounded-lg border border-blue-200/80 bg-blue-50/30 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-800">Indicador</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Contratos 12m">
              <input
                type="number"
                min={0}
                step={1}
                value={draft.diag_contratos_12m}
                onChange={(e) => setField('diag_contratos_12m', e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="Meta anual">
              <input
                type="number"
                min={1}
                max={99}
                step={1}
                value={draft.diag_ano_meta}
                onChange={(e) => setField('diag_ano_meta', e.target.value)}
                className={fieldClass}
              />
            </Field>
          </div>
        </section>

        {/* Gestão */}
        <section className="rounded-lg border border-stone-200 bg-stone-50/80 p-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-stone-600">Gestão</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(['diag_tend_eng', 'diag_tend_rel', 'diag_tend_ind'] as const).map((key, i) => (
              <Field key={key} label={['Tend. engaj.', 'Tend. relação', 'Tend. indicador'][i]}>
                <select
                  value={draft[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  className={fieldClass}
                >
                  {TEND_OPTS.map((o) => (
                    <option key={o.value || 'na'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <Field label="Grupo secundário (override)">
              <select
                value={draft.diag_grupo_sec}
                onChange={(e) => setField('diag_grupo_sec', e.target.value)}
                className={fieldClass}
              >
                {GA_OPTS.map((o) => (
                  <option key={o.value || 'auto'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Adormecido">
              <label className="mt-2 flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.diag_adormecido}
                  onChange={(e) => setField('diag_adormecido', e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300"
                />
                Marcar como adormecido
              </label>
            </Field>
          </div>
          <div className="mt-2">
            <Field label="Próxima ação">
              <textarea
                value={draft.diag_proxima_acao}
                onChange={(e) => setField('diag_proxima_acao', e.target.value)}
                rows={2}
                className={`${fieldClass} resize-y`}
                placeholder="Próxima melhor ação com este franqueado"
              />
            </Field>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <Field label="Último contato">
              <input
                type="date"
                value={draft.diag_ultimo_contato}
                onChange={(e) => setField('diag_ultimo_contato', e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="Última avaliação">
              <input
                type="date"
                value={draft.diag_ultima_aval}
                onChange={(e) => setField('diag_ultima_aval', e.target.value)}
                className={fieldClass}
              />
            </Field>
            <Field label="Avaliado por">
              <input
                type="text"
                value={draft.diag_avaliado_por}
                onChange={(e) => setField('diag_avaliado_por', e.target.value)}
                className={fieldClass}
              />
            </Field>
          </div>
        </section>
      </div>

      {/* Preview calculado */}
      <div className="mt-4 rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[color:var(--moni-text-tertiary)]">
          Prévia (calculado)
        </p>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div>
            <span className="text-[10px] text-stone-500">Score</span>
            <div className="mt-0.5">
              <ScoreCell score={calcEngajamento(previewRow)} internalView={internalView} />
            </div>
          </div>
          <div>
            <span className="text-[10px] text-stone-500">D / C / K</span>
            <div className="mt-0.5 flex gap-2">
              <DimCell val={previewRow.diag_d ?? null} />
              <DimCell val={previewRow.diag_c ?? null} />
              <DimCell val={previewRow.diag_k ?? null} />
            </div>
          </div>
          <div>
            <span className="text-[10px] text-stone-500">NPS / CSAT</span>
            <div className="mt-0.5 flex gap-2">
              <NpsCell nps={previewRow.diag_nps} />
              <CsatCell csat={previewRow.diag_csat} />
            </div>
          </div>
          <div>
            <span className="text-[10px] text-stone-500">Indicador</span>
            <div className="mt-0.5">
              <IndCell row={previewRow} />
            </div>
          </div>
          <div>
            <span className="text-[10px] text-stone-500">Prioridade</span>
            <div className="mt-0.5">
              <PriorityBadge row={previewRow} />
            </div>
          </div>
          <div>
            <span className="text-[10px] text-stone-500">Perfil</span>
            <div className="mt-0.5 max-w-[160px]">
              <PerfilCell row={previewRow} internalView={internalView} />
            </div>
          </div>
          <div>
            <span className="text-[10px] text-stone-500">Grupo</span>
            <div className="mt-0.5">
              <GrupoCell row={previewRow} />
            </div>
          </div>
          <div>
            <span className="text-[10px] text-stone-500">Tendências</span>
            <div className="mt-0.5">
              <TendCell row={previewRow} />
            </div>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-[color:var(--moni-text-tertiary)]">
          Relação: {calcRelacao(previewRow)} · Indicador: {calcIndicador(previewRow) ?? '—'} · Grupo calc:{' '}
          {calcGrupo(previewRow) ?? '—'} · Perfil: {calcPerfil(previewRow, internalView)}
        </p>
      </div>
    </div>
  );
}
