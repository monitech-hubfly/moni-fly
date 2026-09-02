'use client';

import type { NegocioPrazoDraft, FaseNegocioPrazoOpcao } from '@/lib/kanban/dados-negocio-prazo';
import { SearchableSelect } from '@/components/SearchableSelect';

type Props = {
  label: string;
  draft: NegocioPrazoDraft;
  onChange: (draft: NegocioPrazoDraft) => void;
  faseOpcoes: FaseNegocioPrazoOpcao[];
  disabled?: boolean;
};

const inputClass =
  'mt-0.5 w-full bg-white px-2 py-1 text-xs text-[var(--moni-text-primary)] min-h-[44px] sm:min-h-0';
const inputStyle = {
  border: '0.5px solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-md)',
} as const;

export function KanbanCardModalNegocioPrazoField({
  label,
  draft,
  onChange,
  faseOpcoes,
  disabled = false,
}: Props) {
  const modo = draft.modo;

  return (
    <fieldset
      className="rounded-lg p-2"
      style={{ border: '0.5px solid var(--moni-border-subtle)' }}
      disabled={disabled}
    >
      <legend className="px-1 text-[11px] font-medium text-[var(--moni-text-secondary)]">{label}</legend>

      <div className="mt-1 flex flex-wrap gap-2">
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 text-xs text-[var(--moni-text-secondary)] sm:min-h-0">
          <input
            type="radio"
            name={`${label}-modo`}
            checked={modo === 'fase'}
            onChange={() => onChange({ ...draft, modo: 'fase' })}
          />
          A partir de fase
        </label>
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 text-xs text-[var(--moni-text-secondary)] sm:min-h-0">
          <input
            type="radio"
            name={`${label}-modo`}
            checked={modo === 'data'}
            onChange={() => onChange({ ...draft, modo: 'data' })}
          />
          Data fixa
        </label>
        {modo ? (
          <button
            type="button"
            className="min-h-[44px] text-xs text-[var(--moni-text-tertiary)] underline sm:min-h-0"
            onClick={() =>
              onChange({
                modo: '',
                dias: '',
                slaTipo: 'uteis',
                faseId: '',
                data: '',
              })
            }
          >
            Limpar
          </button>
        ) : null}
      </div>

      {!modo ? (
        <p className="mt-1 text-[11px] text-[var(--moni-text-tertiary)]">Selecione o tipo de prazo ou deixe em branco.</p>
      ) : modo === 'data' ? (
        <label className="mt-2 block">
          <span className="text-[11px] font-medium text-[var(--moni-text-secondary)]">Data de vencimento</span>
          <input
            type="date"
            value={draft.data}
            onChange={(e) => onChange({ ...draft, data: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </label>
      ) : (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--moni-text-secondary)]">Prazo (dias)</span>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={draft.dias}
              onChange={(e) => onChange({ ...draft, dias: e.target.value.replace(/\D/g, '') })}
              className={inputClass}
              style={inputStyle}
              placeholder="Ex.: 30"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--moni-text-secondary)]">Contagem</span>
            <select
              value={draft.slaTipo}
              onChange={(e) =>
                onChange({
                  ...draft,
                  slaTipo: e.target.value === 'corridos' ? 'corridos' : 'uteis',
                })
              }
              className={inputClass}
              style={inputStyle}
            >
              <option value="uteis">Dias úteis</option>
              <option value="corridos">Dias corridos</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[11px] font-medium text-[var(--moni-text-secondary)]">Fase âncora</span>
            <SearchableSelect
              value={draft.faseId}
              onChange={(v: string) => onChange({ ...draft, faseId: v })}
              placeholder="Selecione a fase"
              className="mt-0.5"
              options={faseOpcoes.map((f) => ({ value: f.id, label: f.label }))}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}
