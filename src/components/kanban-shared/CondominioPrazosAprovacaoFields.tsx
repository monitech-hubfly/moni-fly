'use client';

import type { SlaTipo } from '@/lib/dias-uteis';
import { fmtPrazoAprovacaoLabel, type CondominioPrazosAprovacaoDraft } from '@/lib/kanban/condominio-prazos-aprovacao';
import type { CondominioRow } from '@/lib/condominios';

const inputCls =
  'mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 min-h-[44px] sm:min-h-0';

type Props = {
  draft: CondominioPrazosAprovacaoDraft;
  onChange: (patch: Partial<CondominioPrazosAprovacaoDraft>) => void;
  readOnly?: boolean;
  row?: CondominioRow | null;
  disabled?: boolean;
};

function FieldView({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-stone-500">{label}</div>
      <div className="text-xs text-stone-800">{value || '—'}</div>
    </div>
  );
}

function SlaSelect({
  value,
  onChange,
  disabled,
}: {
  value: SlaTipo;
  onChange: (v: SlaTipo) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === 'uteis' ? 'uteis' : 'corridos')}
      className={`${inputCls} max-w-[88px]`}
    >
      <option value="corridos">d.c.</option>
      <option value="uteis">d.u.</option>
    </select>
  );
}

export function CondominioPrazosAprovacaoFields({
  draft,
  onChange,
  readOnly = false,
  row,
  disabled = false,
}: Props) {
  if (readOnly && row) {
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FieldView
          label="Prazo de Aprovação no Condomínio"
          value={fmtPrazoAprovacaoLabel(
            row.prazo_aprovacao_condominio_dias,
            row.prazo_aprovacao_condominio_sla_tipo,
          )}
        />
        <FieldView
          label="Prazo de Aprovação na Prefeitura"
          value={fmtPrazoAprovacaoLabel(
            row.prazo_aprovacao_prefeitura_dias,
            row.prazo_aprovacao_prefeitura_sla_tipo,
          )}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <label className="block min-w-0">
        <span className="text-[11px] font-medium text-stone-500">Prazo de Aprovação no Condomínio</span>
        <div className="mt-0.5 flex gap-1">
          <input
            type="text"
            inputMode="numeric"
            disabled={disabled}
            value={draft.prazo_aprovacao_condominio_dias}
            onChange={(e) => onChange({ prazo_aprovacao_condominio_dias: e.target.value.replace(/\D/g, '') })}
            placeholder="Ex.: 45"
            className={`${inputCls} flex-1`}
          />
          <SlaSelect
            value={draft.prazo_aprovacao_condominio_sla_tipo}
            onChange={(v) => onChange({ prazo_aprovacao_condominio_sla_tipo: v })}
            disabled={disabled}
          />
        </div>
      </label>
      <label className="block min-w-0">
        <span className="text-[11px] font-medium text-stone-500">Prazo de Aprovação na Prefeitura</span>
        <div className="mt-0.5 flex gap-1">
          <input
            type="text"
            inputMode="numeric"
            disabled={disabled}
            value={draft.prazo_aprovacao_prefeitura_dias}
            onChange={(e) => onChange({ prazo_aprovacao_prefeitura_dias: e.target.value.replace(/\D/g, '') })}
            placeholder="Ex.: 60"
            className={`${inputCls} flex-1`}
          />
          <SlaSelect
            value={draft.prazo_aprovacao_prefeitura_sla_tipo}
            onChange={(v) => onChange({ prazo_aprovacao_prefeitura_sla_tipo: v })}
            disabled={disabled}
          />
        </div>
      </label>
    </div>
  );
}
