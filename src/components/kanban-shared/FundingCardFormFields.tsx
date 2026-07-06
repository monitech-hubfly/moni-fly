'use client';

import type { FundingCardDraft } from '@/lib/kanban/funding-card-fields';

export type FundingCardFormFieldsProps = {
  draft: FundingCardDraft;
  onChange: (patch: Partial<FundingCardDraft>) => void;
  disabled?: boolean;
  /** Exibe campo Nome (criação / edição do título do card). */
  showNome?: boolean;
};

const labelCls = 'block text-sm font-medium';
const inputCls =
  'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm disabled:bg-stone-50';

export function FundingCardFormFields({
  draft,
  onChange,
  disabled = false,
  showNome = true,
}: FundingCardFormFieldsProps) {
  return (
    <div className="space-y-5 moni-form-novo-card">
      <label className="block min-w-0">
        <span className={labelCls} style={{ color: 'var(--moni-text-primary)' }}>
          Tipo <span className="text-red-500">*</span>
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
          <option value="">Selecione o tipo</option>
          <option value="Investidor">Investidor</option>
          <option value="Broker">Broker</option>
        </select>
      </label>

      <div className={`grid gap-3${showNome ? ' sm:grid-cols-2' : ''}`}>
        {showNome ? (
          <label className="block min-w-0">
            <span className={labelCls} style={{ color: 'var(--moni-text-primary)' }}>
              Nome <span className="text-red-500">*</span>
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
          <span className={labelCls} style={{ color: 'var(--moni-text-primary)' }}>
            Localização <span className="text-red-500">*</span>
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
        <span className={labelCls} style={{ color: 'var(--moni-text-primary)' }}>
          Descritivo <span className="text-stone-400 text-xs">(opcional)</span>
        </span>
        <textarea
          value={draft.funding_descritivo}
          disabled={disabled}
          rows={4}
          placeholder="Origem, contexto, observações…"
          onChange={(e) => onChange({ funding_descritivo: e.target.value })}
          className={`${inputCls} resize-y`}
        />
      </label>

      <label className="block min-w-0">
        <span className={labelCls} style={{ color: 'var(--moni-text-primary)' }}>
          Próxima atividade <span className="text-stone-400 text-xs">(opcional)</span>
        </span>
        <input
          type="text"
          value={draft.proxima_atividade}
          disabled={disabled}
          placeholder="Ex: Enviar apresentação do fundo"
          onChange={(e) => onChange({ proxima_atividade: e.target.value })}
          className={inputCls}
        />
      </label>

      <label className="block min-w-0">
        <span className={labelCls} style={{ color: 'var(--moni-text-primary)' }}>
          Prazo <span className="text-stone-400 text-xs">(opcional)</span>
        </span>
        <input
          type="date"
          value={draft.prazo_atividade}
          disabled={disabled}
          onChange={(e) => onChange({ prazo_atividade: e.target.value })}
          className={inputCls}
        />
      </label>
    </div>
  );
}
