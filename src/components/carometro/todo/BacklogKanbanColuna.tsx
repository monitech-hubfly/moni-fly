'use client';

import { useState, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useBacklogKanban, KanbanCardItem, PrioridadeGrupo } from '@/hooks/useBacklogKanban';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import { tagSlaKanbanParaExibicao } from '@/lib/kanban/kanban-card-sla';

import type { SlaKanbanResult } from '@/lib/kanban/kanban-card-sla';

function DraggableKanbanCard({ card, children }: { card: KanbanCardItem; children: ReactNode }) {
  const subtitulo = [card.kanban_nome, card.fase_nome].filter(Boolean).join(' / ');
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `kanban::${card.id}`,
    data: { type: 'kanban', id: card.id, titulo: card.titulo ?? '', subtitulo },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Transform.toString(transform),
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
      }}
    >
      {children}
    </div>
  );
}

function slaDotCor(sla: SlaKanbanResult | null): string {
  if (!sla || sla.status === 'ok') return 'bg-gray-400';
  if (sla.status === 'atrasado') return 'bg-red-500';
  return 'bg-green-500';
}

const ORIGEM_BADGE: Record<string, string> = {
  franqueado:        'bg-purple-100 text-purple-700',
  atividade:         'bg-blue-100 text-blue-700',
  checklist:         'bg-orange-100 text-orange-700',
  proxima_atividade: 'bg-teal-100 text-teal-700',
  sem_atividade:     'bg-gray-100 text-gray-600',
};

const ORIGEM_LABEL: Record<string, string> = {
  franqueado:        'Franqueado',
  atividade:         'Atividade',
  checklist:         'Checklist',
  proxima_atividade: 'Próx. atividade',
  sem_atividade:     'Sem atividade',
};

const P_COLORS: Record<PrioridadeGrupo, string> = {
  P1: 'bg-red-100 text-red-700',
  P2: 'bg-orange-100 text-orange-700',
  P3: 'bg-red-100 text-red-600',
  P4: 'bg-amber-100 text-amber-700',
  P5: 'bg-yellow-100 text-yellow-700',
  P6: 'bg-gray-100 text-gray-500',
};

const P_TOOLTIPS: Record<PrioridadeGrupo, string> = {
  P1: 'SLA atrasado · sem atividade preenchida',
  P2: 'SLA em dia · sem atividade preenchida',
  P3: 'SLA atrasado · atividade atrasada',
  P4: 'SLA atrasado · próxima atividade em dia/futura',
  P5: 'SLA em dia · atividade atrasada',
  P6: 'SLA em dia · próxima atividade em dia/futura',
};

function PrioridadeBadge({ prioridade }: { prioridade: PrioridadeGrupo }) {
  return (
    <span
      className={`text-[9px] font-bold px-1 py-px rounded shrink-0 ${P_COLORS[prioridade]}`}
      title={P_TOOLTIPS[prioridade]}
    >
      {prioridade}
    </span>
  );
}

function KanbanCard({ card }: { card: KanbanCardItem }) {
  const href      = hrefAbrirCardKanban(card.kanban_nome ?? '', card.id);
  const badgeCls  = ORIGEM_BADGE[card.origem] ?? 'bg-gray-100 text-gray-600';
  const slaBadge  = card.sla ? tagSlaKanbanParaExibicao(card.sla) : null;

  return (
    <div
      className="rounded-md bg-white border border-gray-200 px-3 py-2 text-sm shadow-sm transition-all"
    >
      {/* Título + badge P + estrela Especial + dot status */}
      <div className="flex items-start justify-between gap-1 min-w-0">
        <div className="flex items-start gap-1 flex-1 min-w-0">
          {card.prioridade && <PrioridadeBadge prioridade={card.prioridade} />}
          <span
            className="text-gray-800 leading-snug min-w-0"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {card.titulo ?? '(sem título)'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {card.especial && (
            <span className="text-[11px]" title="Especial">⭐</span>
          )}
          <span className={`h-2 w-2 rounded-full ${slaDotCor(card.sla ?? null)}`} />
          <a
            href={href}
            title="Abrir card"
            onClick={(e) => e.stopPropagation()}
            className="text-gray-300 hover:text-gray-500 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
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
  const { cards, sndCards, orphanCards, isLoading, error } = useBacklogKanban();
  const [sndAberto,    setSndAberto]    = useState(false);
  const [orphanAberto, setOrphanAberto] = useState(false);

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
        <>
          <div className="flex flex-col gap-1.5 max-h-[22rem] overflow-y-auto pr-0.5">
            {cards.map(card => (
              <DraggableKanbanCard key={card.id} card={card}>
                <KanbanCard card={card} />
              </DraggableKanbanCard>
            ))}
          </div>
          {sndCards.length > 0 && (
            <div className="mt-2 border-t border-gray-200 pt-2">
              <button
                type="button"
                onClick={() => setSndAberto(v => !v)}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 w-full text-left"
              >
                <span>{sndAberto ? '▾' : '▸'}</span>
                <span>SND — SLA Não Definido ({sndCards.length})</span>
              </button>
              {sndAberto && (
                <div className="flex flex-col gap-1.5 mt-1.5 max-h-[12rem] overflow-y-auto">
                  {sndCards.map(card => (
                    <DraggableKanbanCard key={card.id} card={card}>
                      <KanbanCard card={card} />
                    </DraggableKanbanCard>
                  ))}
                </div>
              )}
            </div>
          )}
          {orphanCards.length > 0 && (
            <div className="mt-2 border-t border-gray-200 pt-2">
              <button
                type="button"
                onClick={() => setOrphanAberto(v => !v)}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 w-full text-left"
              >
                <span>{orphanAberto ? '▾' : '▸'}</span>
                <span className="text-amber-600 font-medium">Sem responsável ({orphanCards.length})</span>
              </button>
              {orphanAberto && (
                <div className="flex flex-col gap-1.5 mt-1.5 max-h-[12rem] overflow-y-auto">
                  {orphanCards.map(card => (
                    <DraggableKanbanCard key={card.id} card={card}>
                      <KanbanCard card={card} />
                    </DraggableKanbanCard>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
