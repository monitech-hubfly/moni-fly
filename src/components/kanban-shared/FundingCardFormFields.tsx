'use client';

import type { FundingCardDraft } from '@/lib/kanban/funding-card-fields';

export type FundingCardFormFieldsProps = {
  draft: FundingCardDraft;
  onChange: (patch: Partial<FundingCardDraft>) => void;
  disabled?: boolean;
  /** Exibe campo Nome (criação / edição do título do card). */
  showNome?: boolean;
};

const labelCls =
  'block text-[10px] font-semibold uppercase tracking-wide text-[var(--moni-text-secondary)]';
const reqMark = 'text-[var(--moni-status-overdue-text)]';
const inputCls =
  'mt-1 w-full rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-[var(--moni-border-default)] bg-white px-2.5 py-2 text-xs font-[family-name:var(--moni-font-sans)] text-[var(--moni-text-primary)] min-h-[44px] placeholder:text-[var(--moni-text-tertiary)] disabled:opacity-60';

export function FundingCardFormFields({
  draft,
  onChange,
  disabled = false,
  showNome = true,
}: FundingCardFormFieldsProps) {
  return (
    <div className="space-y-4 moni-form-novo-card">
      <label className="block min-w-0">
        <span className={labelCls}>
          Tipo <span className={reqMark}>*</span>
        </span>
        <select
          value={draft.funding_tipo}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              funding_tipo:
                e.target.value === 'Investidor' || e.target.value === 'Broker' ? e.target.value : '',
            })
          }
          className={inputCls}
        >
          <option value="">Selecione…</option>
          <option value="Investidor">Investidor</option>
          <option value="Broker">Broker</option>
        </select>
      </label>

      <div className={`grid gap-3${showNome ? ' sm:grid-cols-2' : ''}`}>
        {showNome ? (
          <label className="block min-w-0">
            <span className={labelCls}>
              Nome <span className={reqMark}>*</span>
            </span>
            <input
              type="text"
              value={draft.funding_nome}
              disabled={disabled}
              placeholder="Nome ou empresa"
              onChange={(e) => onChange({ funding_nome: e.target.value })}
              className={inputCls}
            />
          </label>
        ) : null}
        <label className={`block min-w-0${showNome ? '' : ' sm:col-span-2'}`}>
          <span className={labelCls}>
            Localização <span className={reqMark}>*</span>
          </span>
          <input
            type="text"
            value={draft.funding_localizacao}
            disabled={disabled}
            placeholder="Cidade, UF"
            onChange={(e) => onChange({ funding_localizacao: e.target.value })}
            className={inputCls}
          />
        </label>
      </div>

      <label className="block min-w-0">
        <span className={labelCls}>Descritivo</span>
        <textarea
          value={draft.funding_descritivo}
          disabled={disabled}
          rows={4}
          placeholder="Origem, contexto, observações…"
          onChange={(e) => onChange({ funding_descritivo: e.target.value })}
          className={`${inputCls} min-h-[88px] resize-y`}
        />
      </label>

      <label className="block min-w-0">
        <span className={labelCls}>Próxima atividade</span>
        <input
          type="text"
          value={draft.funding_proxima_atividade}
          disabled={disabled}
          placeholder="Ex: Enviar apresentação do fundo"
          onChange={(e) => onChange({ funding_proxima_atividade: e.target.value })}
          className={inputCls}
        />
      </label>

      <label className="block min-w-0">
        <span className={labelCls}>Prazo</span>
        <input
          type="date"
          value={draft.funding_prazo_atividade}
          disabled={disabled}
          onChange={(e) => onChange({ funding_prazo_atividade: e.target.value })}
          className={inputCls}
        />
      </label>
    </div>
  );
}
