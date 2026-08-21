'use client';

import type { SlaTipo } from '@/lib/dias-uteis';
import { fmtPrazoAprovacaoLabel, type CondominioPrazosAprovacaoDraft } from '@/lib/kanban/condominio-prazos-aprovacao';
import type { CondominioRow } from '@/lib/condominios';

const labelCls = 'text-[11px] font-medium text-[var(--moni-text-secondary)]';
const valueCls = 'text-xs text-[var(--moni-text-primary)]';
const inputCls =
  'w-full min-w-0 bg-[var(--moni-surface-0)] px-2 py-1 text-xs tabular-nums text-[var(--moni-text-primary)] min-h-[44px] sm:min-h-0';
const inputStyle = {
  border: '0.5px solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-md)',
} as const;

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
      <div className={labelCls}>{label}</div>
      <div className={valueCls}>{value || '—'}</div>
    </div>
  );
}

function SlaToggle({
  value,
  onChange,
  disabled,
}: {
  value: SlaTipo;
  onChange: (v: SlaTipo) => void;
  disabled?: boolean;
}) {
  const btn = (tipo: SlaTipo, label: string) => {
    const ativo = value === tipo;
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(tipo)}
        className="min-h-[44px] px-2 py-1 text-[11px] font-medium transition disabled:opacity-50 sm:min-h-0"
        style={{
          color: ativo ? 'var(--moni-text-inverse)' : 'var(--moni-text-secondary)',
          background: ativo ? 'var(--moni-navy-800)' : 'transparent',
        }}
        aria-pressed={ativo}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className="inline-flex shrink-0 overflow-hidden"
      style={{
        border: '0.5px solid var(--moni-border-default)',
        borderRadius: 'var(--moni-radius-md)',
      }}
      role="group"
      aria-label="Tipo de contagem"
    >
      {btn('uteis', 'd.u.')}
      {btn('corridos', 'd.c.')}
    </div>
  );
}

function PrazoEditRow({
  label,
  dias,
  slaTipo,
  onDiasChange,
  onSlaChange,
  disabled,
  placeholder,
}: {
  label: string;
  dias: string;
  slaTipo: SlaTipo;
  onDiasChange: (v: string) => void;
  onSlaChange: (v: SlaTipo) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  return (
    <label className="block min-w-0">
      <span className={labelCls}>{label}</span>
      <div className="mt-0.5 flex items-center gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={dias}
          onChange={(e) => onDiasChange(e.target.value.replace(/\D/g, ''))}
          placeholder={placeholder}
          className={`${inputCls} flex-1`}
          style={inputStyle}
        />
        <SlaToggle value={slaTipo} onChange={onSlaChange} disabled={disabled} />
      </div>
    </label>
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
      <PrazoEditRow
        label="Prazo de Aprovação no Condomínio"
        dias={draft.prazo_aprovacao_condominio_dias}
        slaTipo={draft.prazo_aprovacao_condominio_sla_tipo}
        onDiasChange={(v) => onChange({ prazo_aprovacao_condominio_dias: v })}
        onSlaChange={(v) => onChange({ prazo_aprovacao_condominio_sla_tipo: v })}
        disabled={disabled}
        placeholder="Ex.: 45"
      />
      <PrazoEditRow
        label="Prazo de Aprovação na Prefeitura"
        dias={draft.prazo_aprovacao_prefeitura_dias}
        slaTipo={draft.prazo_aprovacao_prefeitura_sla_tipo}
        onDiasChange={(v) => onChange({ prazo_aprovacao_prefeitura_dias: v })}
        onSlaChange={(v) => onChange({ prazo_aprovacao_prefeitura_sla_tipo: v })}
        disabled={disabled}
        placeholder="Ex.: 60"
      />
    </div>
  );
}
