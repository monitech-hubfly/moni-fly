'use client';

import { FundingCardFormFields } from './FundingCardFormFields';
import type { FundingCardDraft } from '@/lib/kanban/funding-card-fields';

type Props = {
  draft: FundingCardDraft;
  onChange: (patch: Partial<FundingCardDraft>) => void;
  onSalvar: () => void;
  salvando: boolean;
  podeEditar: boolean;
};

export function KanbanCardModalDadosFunding({
  draft,
  onChange,
  onSalvar,
  salvando,
  podeEditar,
}: Props) {
  return (
    <div>
      <FundingCardFormFields draft={draft} onChange={onChange} disabled={!podeEditar || salvando} />
      {podeEditar ? (
        <button
          type="button"
          onClick={() => void onSalvar()}
          disabled={salvando}
          className="mt-4 w-full rounded-[var(--moni-radius-md)] px-3 py-2.5 text-xs font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
          style={{ background: 'var(--moni-navy-800)' }}
        >
          {salvando ? 'Salvando…' : 'Salvar dados Funding'}
        </button>
      ) : null}
    </div>
  );
}
