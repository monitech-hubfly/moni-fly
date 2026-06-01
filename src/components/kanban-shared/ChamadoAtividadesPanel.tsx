'use client';

/**
 * Painel reutilizável Chamado + Atividades (card modal e Sirene).
 * Props mínimas para integração gradual — expandir conforme necessário.
 */
import type { SubInteracaoStatusDb } from '@/lib/actions/card-actions';
import type { InteracaoModal, SubInteracaoModal } from './kanban-card-modal-helpers';
import { travaEfetivaParaChamado } from './kanban-card-modal-helpers';

export type ChamadoAtividadesPanelProps = {
  mode: 'card' | 'sirene';
  readOnly: boolean;
  interacao: InteracaoModal;
  subs: SubInteracaoModal[];
  showNumero?: string;
  showTimeAbertura?: string;
  onOpenCard?: () => void;
};

export function ChamadoAtividadesPanel({
  mode,
  readOnly,
  interacao,
  subs,
  showNumero,
  showTimeAbertura,
  onOpenCard,
}: ChamadoAtividadesPanelProps) {
  const trava = travaEfetivaParaChamado(interacao, subs);
  const categoria = interacao.categoria ?? 'chamado';

  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        {showNumero ? (
          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-600">
            {showNumero}
          </span>
        ) : null}
        {trava ? (
          <span className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-700">
            Trava
          </span>
        ) : null}
        {showTimeAbertura ? (
          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">{showTimeAbertura}</span>
        ) : null}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
            categoria === 'melhoria' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-stone-100 text-stone-700'
          }`}
        >
          {categoria === 'melhoria' ? 'Melhoria' : 'Chamado'}
        </span>
        {mode === 'sirene' && onOpenCard ? (
          <button type="button" onClick={onOpenCard} className="text-[10px] font-medium text-moni-primary hover:underline">
            Abrir card
          </button>
        ) : null}
        {readOnly && mode === 'sirene' ? (
          <span className="text-[10px] text-stone-500">Somente leitura — editar no card</span>
        ) : null}
      </div>
      {interacao.descricao ? (
        <p className="whitespace-pre-wrap text-[11px] text-stone-600">{interacao.descricao}</p>
      ) : null}
      {subs.length > 0 ? (
        <ul className="space-y-1 border-t border-stone-100 pt-2">
          {subs.map((sub) => (
            <li key={sub.id} className="rounded border border-stone-200 bg-white/80 px-2 py-1.5">
              <div className="flex flex-wrap items-center gap-1">
                {sub.trava ? (
                  <span className="text-[9px] font-bold uppercase text-red-600">Trava</span>
                ) : null}
                <span className="font-medium text-stone-800">{sub.nome || sub.descricao}</span>
                {sub.historico.some((h) => h.tipo === 'Redirecionado') ? (
                  <span className="rounded border border-amber-300 bg-amber-50 px-1 text-[9px] text-amber-800">
                    Redirecionado
                  </span>
                ) : null}
                <span className="text-[10px] text-stone-500">({sub.status as SubInteracaoStatusDb})</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-stone-500">Nenhuma atividade.</p>
      )}
    </div>
  );
}
