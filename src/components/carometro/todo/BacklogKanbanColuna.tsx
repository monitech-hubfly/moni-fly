'use client';

import { useBacklogKanban, KanbanCardItem } from '@/hooks/useBacklogKanban';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import { tagSlaKanbanParaExibicao } from '@/lib/kanban/kanban-card-sla';

const ORIGEM_BADGE: Record<string, string> = {
  franqueado:        'bg-purple-100 text-purple-700',
  atividade:         'bg-blue-100 text-blue-700',
  checklist:         'bg-orange-100 text-orange-700',
  proxima_atividade: 'bg-teal-100 text-teal-700',
};

const ORIGEM_LABEL: Record<string, string> = {
  franqueado:        'Franqueado',
  atividade:         'Atividade',
  checklist:         'Checklist',
  proxima_atividade: 'Próx. atividade',
};

function KanbanCard({ card }: { card: KanbanCardItem }) {
  const href      = hrefAbrirCardKanban(card.kanban_nome ?? '', card.id);
  const badgeCls  = ORIGEM_BADGE[card.origem] ?? 'bg-gray-100 text-gray-600';
  const slaBadge  = card.sla ? tagSlaKanbanParaExibicao(card.sla) : null;

  return (
    <div
      className="rounded-md bg-white border border-gray-200 px-3 py-2 text-sm shadow-sm cursor-pointer hover:shadow-md hover:bg-gray-50 transition-all"
      onClick={() => { window.location.href = href; }}
    >
      {/* Título + estrela Especial */}
      <div className="flex items-start gap-1 min-w-0">
        <span
          className="text-gray-800 leading-snug flex-1 min-w-0"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {card.titulo ?? '(sem título)'}
        </span>
        {card.especial && (
          <span className="shrink-0 text-[11px]" title="Especial">⭐</span>
        )}
      </div>

      {/* Próxima atividade */}
      {card.proxima_atividade ? (
        <div
          className="mt-0.5 text-[11px] text-gray-500"
          style={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {card.proxima_atividade}
        </div>
      ) : null}

      {/* Linha 2: badge SLA + badge origem + funil · fase */}
      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
        {slaBadge ? (
          <span
            className="text-[9px] font-semibold px-1 py-px rounded"
            style={
              slaBadge.variante === 'atrasado'
                ? { background: 'var(--moni-status-overdue-bg)', color: 'var(--moni-status-overdue-text)', border: '1px solid var(--moni-status-overdue-border)' }
                : { background: 'var(--moni-status-attention-bg)', color: 'var(--moni-status-attention-text)', border: '1px solid var(--moni-status-attention-border)' }
            }
          >
            {slaBadge.texto}
          </span>
        ) : null}
        <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${badgeCls}`}>
          {ORIGEM_LABEL[card.origem]}
        </span>
        {card.kanban_nome && (
          <span className="text-[10px] text-gray-400 truncate max-w-[8rem]">{card.kanban_nome}</span>
        )}
        {card.fase_nome && (
          <span className="text-[10px] text-gray-400 truncate">· {card.fase_nome}</span>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-sm text-gray-500">
      <span className="text-green-500 text-xl mb-1">✓</span>
      Nenhum card pendente
    </div>
  );
}

function StatusDot({ cor, count }: { cor: string; count: number }) {
  if (count === 0) return null;
  return (
    <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
      <span className={`h-2 w-2 rounded-full shrink-0 ${cor}`} />
      {count}
    </span>
  );
}

export function BacklogKanbanColuna() {
  const { cards, isLoading, error } = useBacklogKanban();

  const atrasados  = cards.filter(c => c.sla?.status === 'atrasado').length;
  const atencao    = cards.filter(c => c.sla?.status === 'atencao').length;
  const semSla     = cards.filter(c => !c.sla || c.sla.status === 'ok').length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">Cards / Kanban</span>
        <div className="flex items-center gap-2">
          {!isLoading && (
            <div className="flex items-center gap-1.5">
              <StatusDot cor="bg-red-500"   count={atrasados} />
              <StatusDot cor="bg-green-500" count={atencao} />
              <StatusDot cor="bg-gray-400"  count={semSla} />
            </div>
          )}
          <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-2 py-0.5">
            {isLoading ? '…' : cards.length}
          </span>
        </div>
      </div>

      {/* Conteúdo com scroll */}
      {isLoading ? (
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-14 bg-gray-200 animate-pulse rounded-md" />
          ))}
        </div>
      ) : error ? (
        <p className="text-xs text-red-500 break-all">{error}</p>
      ) : cards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-1.5 max-h-[22rem] overflow-y-auto pr-0.5">
          {cards.map(card => <KanbanCard key={card.id} card={card} />)}
        </div>
      )}
    </div>
  );
}
