'use client';

import type { FundingCardDraft } from '@/lib/kanban/funding-card-fields';

type Props = {
  draft: FundingCardDraft;
  onChange: (patch: Partial<FundingCardDraft>) => void;
  onSalvar: () => void;
  salvando: boolean;
  podeEditar: boolean;
};

const labelCls = 'text-[11px] font-medium';
const inputCls =
  'mt-0.5 w-full rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-[var(--moni-border-default)] bg-white px-2 py-1.5 text-xs font-[family-name:var(--moni-font-sans)] text-[var(--moni-text-primary)] min-h-[44px]';

export function KanbanCardModalDadosFunding({
  draft,
  onChange,
  onSalvar,
  salvando,
  podeEditar,
}: Props) {
  return (
    <div className="space-y-3 moni-form-novo-card">
      <label className="block min-w-0">
        <span className={labelCls} style={{ color: 'var(--moni-text-secondary)' }}>
          Tipo
        </span>
        <select
          value={draft.funding_tipo}
          disabled={!podeEditar}
          onChange={(e) =>
            onChange({
              funding_tipo: e.target.value === 'Investidor' || e.target.value === 'Broker' ? e.target.value : '',
            })
          }
          className={inputCls}
        >
          <option value="">Selecione…</option>
          <option value="Investidor">Investidor</option>
          <option value="Broker">Broker</option>
        </select>
      </label>
      <label className="block min-w-0">
        <span className={labelCls} style={{ color: 'var(--moni-text-secondary)' }}>
          Localização
        </span>
        <input
          type="text"
          value={draft.funding_localizacao}
          disabled={!podeEditar}
          onChange={(e) => onChange({ funding_localizacao: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="block min-w-0">
        <span className={labelCls} style={{ color: 'var(--moni-text-secondary)' }}>
          Descritivo
        </span>
        <textarea
          value={draft.funding_descritivo}
          disabled={!podeEditar}
          rows={4}
          onChange={(e) => onChange({ funding_descritivo: e.target.value })}
          className={`${inputCls} min-h-[88px] resize-y`}
        />
      </label>
      <label className="block min-w-0">
        <span className={labelCls} style={{ color: 'var(--moni-text-secondary)' }}>
          Próxima atividade
        </span>
        <input
          type="text"
          value={draft.funding_proxima_atividade}
          disabled={!podeEditar}
          onChange={(e) => onChange({ funding_proxima_atividade: e.target.value })}
          className={inputCls}
        />
      </label>
      <label className="block min-w-0">
        <span className={labelCls} style={{ color: 'var(--moni-text-secondary)' }}>
          Prazo
        </span>
        <input
          type="date"
          value={draft.funding_prazo_atividade}
          disabled={!podeEditar}
          onChange={(e) => onChange({ funding_prazo_atividade: e.target.value })}
          className={inputCls}
        />
      </label>
      {podeEditar ? (
        <button
          type="button"
          onClick={() => void onSalvar()}
          disabled={salvando}
          className="w-full rounded-[var(--moni-radius-md)] px-3 py-2.5 text-xs font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
          style={{ background: 'var(--moni-navy-800)' }}
        >
          {salvando ? 'Salvando…' : 'Salvar dados Funding'}
        </button>
      ) : null}
    </div>
  );
}
