'use client';

import { formatDataPtBr } from '@/lib/kanban/kanban-card-datas';
import { displayOrDash } from '@/lib/kanban/kanban-card-modal-detalhes';
import { FundingCardFormFields } from './FundingCardFormFields';
import type { FundingCardDraft } from '@/lib/kanban/funding-card-fields';

type Props = {
  draft: FundingCardDraft;
  onChange: (patch: Partial<FundingCardDraft>) => void;
  onSalvar: () => void;
  salvando: boolean;
  podeEditar: boolean;
  editando: boolean;
  onEditar: () => void;
  onCancelar: () => void;
};

function fmtPrazoFunding(iso: string): string {
  const s = String(iso ?? '').trim();
  if (!s) return '—';
  const fmt = formatDataPtBr(s);
  return fmt || s;
}

export function KanbanCardModalDadosFunding({
  draft,
  onChange,
  onSalvar,
  salvando,
  podeEditar,
  editando,
  onEditar,
  onCancelar,
}: Props) {
  if (!editando) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-x-2 gap-y-2">
          <div>
            <div className="text-[11px] font-medium text-stone-500">Tipo</div>
            <div className="text-xs text-stone-800">{displayOrDash(draft.funding_tipo)}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-stone-500">Nome</div>
            <div className="text-xs text-stone-800">{displayOrDash(draft.funding_nome)}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[11px] font-medium text-stone-500">Localização</div>
            <div className="text-xs text-stone-800">{displayOrDash(draft.funding_localizacao)}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[11px] font-medium text-stone-500">Descritivo</div>
            <div className="whitespace-pre-wrap text-xs text-stone-800">
              {displayOrDash(draft.funding_descritivo)}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-stone-500">Próxima atividade</div>
            <div className="text-xs text-stone-800">{displayOrDash(draft.funding_proxima_atividade)}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-stone-500">Prazo</div>
            <div className="text-xs text-stone-800">{fmtPrazoFunding(draft.funding_prazo_atividade)}</div>
          </div>
        </div>
        {podeEditar ? (
          <button
            type="button"
            onClick={onEditar}
            className="mt-1 rounded border border-stone-200 px-3 py-1 text-xs text-stone-600 hover:bg-stone-50"
          >
            Editar dados do negócio
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <FundingCardFormFields draft={draft} onChange={onChange} disabled={!podeEditar || salvando} />
      {podeEditar ? (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => void onSalvar()}
            disabled={salvando}
            className="rounded bg-moni-primary px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={onCancelar}
            disabled={salvando}
            className="rounded border border-stone-200 px-3 py-1 text-xs text-stone-600 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      ) : null}
    </div>
  );
}
