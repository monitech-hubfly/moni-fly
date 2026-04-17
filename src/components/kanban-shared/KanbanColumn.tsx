'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { calcularStatusSLA } from '@/lib/dias-uteis';
import type { KanbanCardBrief, KanbanFase } from './types';

export type KanbanColumnProps = {
  fase: KanbanFase;
  cards: KanbanCardBrief[];
  /** Coluna tinha cards no pool atual, mas nenhum passou nos filtros do board. */
  listaVaziaPorFiltro?: boolean;
  /** Ex.: `/funil-stepone` — abre o modal com `?card=` */
  basePath: string;
  /** Query param do card (padrão `card`). */
  cardQueryParam?: string;
  userRole: string;
  /** Cor da faixa superior da coluna (CSS). */
  columnAccent?: string;
};

function hrefAbrirCard(
  basePath: string,
  cardId: string,
  param: string,
  origem?: KanbanCardBrief['origem'],
) {
  const [path, qs] = basePath.split('?');
  const sp = new URLSearchParams(qs ?? '');
  /** Sem isso, `?tab=painel` pode persistir (ex. histórico) e o RSC não renderiza o board — modal some ou falha o load. */
  sp.delete('tab');
  sp.set(param, cardId);
  if (origem === 'legado') {
    sp.set('origem', 'legado');
  } else {
    sp.delete('origem');
  }
  const tail = sp.toString();
  return tail ? `${path}?${tail}` : `${path}?${param}=${encodeURIComponent(cardId)}`;
}

function cardArquivadoVisual(card: KanbanCardBrief): boolean {
  return card.origem !== 'legado' && Boolean(card.arquivado);
}

function cardConcluidoVisual(card: KanbanCardBrief): boolean {
  return card.origem !== 'legado' && Boolean(card.concluido);
}

export function KanbanColumn({
  fase,
  cards,
  listaVaziaPorFiltro = false,
  basePath,
  cardQueryParam = 'card',
  userRole,
  columnAccent = 'var(--moni-kanban-stepone)',
}: KanbanColumnProps) {
  const router = useRouter();
  const isAdmin =
    userRole === 'admin' ||
    userRole === 'consultor' ||
    userRole === 'supervisor' ||
    userRole === 'team';

  const accent = useMemo(() => columnAccent, [columnAccent]);

  return (
    <div
      className="moni-kanban-column w-80 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm"
      style={{
        border: '0.5px solid var(--moni-border-default)',
        borderTop: `3px solid ${accent}`,
      }}
    >
      <div
        className="border-b px-4 py-3"
        style={{
          background: 'var(--moni-navy-50)',
          borderBottom: '0.5px solid var(--moni-border-default)',
        }}
      >
        <h2 className="font-semibold" style={{ color: 'var(--moni-navy-800)' }}>
          {fase.nome}
        </h2>
        <div className="mt-0.5 flex items-center justify-between">
          <p className="text-xs" style={{ color: 'var(--moni-navy-600)' }}>
            {cards.length} card(s)
          </p>
          {fase.sla_dias ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                color: 'var(--moni-navy-800)',
                border: '0.5px solid var(--moni-navy-200)',
              }}
            >
              SLA: {fase.sla_dias}d
            </span>
          ) : null}
        </div>
      </div>

      <div className="max-h-[70vh] space-y-2 overflow-y-auto p-3">
        {cards.map((card) => {
          const createdDate = new Date(card.created_at);
          const slaDiasUteis = fase.sla_dias ?? 999;
          const sla = calcularStatusSLA(createdDate, slaDiasUteis);
          const arquivado = cardArquivadoVisual(card);
          const concluido = cardConcluidoVisual(card);
          const motivo = (card.motivo_arquivamento ?? '').trim();
          const opacidadeCard = arquivado || concluido ? 'opacity-60' : '';
          const paddingTitulo = arquivado || concluido ? 'pr-20' : '';

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => router.push(hrefAbrirCard(basePath, card.id, cardQueryParam, card.origem))}
              className={`relative block w-full p-3 text-left shadow-sm transition hover:shadow-md ${opacidadeCard}`}
              style={{
                border: arquivado
                  ? '1px dashed var(--moni-status-archived-border)'
                  : concluido
                    ? '1px dashed var(--moni-green-400)'
                    : '0.5px solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-lg)',
                background: 'var(--moni-surface-0)',
              }}
            >
              {arquivado ? (
                <span
                  className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                  style={{
                    background: 'var(--moni-status-archived-bg)',
                    color: 'var(--moni-status-archived-text)',
                    border: '0.5px solid var(--moni-status-archived-border)',
                  }}
                >
                  ARQUIVADO
                </span>
              ) : concluido ? (
                <span
                  className="absolute right-2 top-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                  style={{
                    background: 'var(--moni-green-50)',
                    color: 'var(--moni-green-800)',
                    border: '0.5px solid var(--moni-green-400)',
                  }}
                >
                  CONCLUÍDO
                </span>
              ) : null}
              <p className={`line-clamp-2 text-sm font-medium text-stone-800 ${paddingTitulo}`}>{card.titulo}</p>
              {arquivado && motivo ? (
                <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  {motivo}
                </p>
              ) : null}
              {isAdmin && card.profiles?.full_name ? (
                <p className="mt-1 line-clamp-1 text-xs text-stone-500">{card.profiles.full_name}</p>
              ) : null}
              <p className="mt-1 text-xs text-stone-400">Criado: {createdDate.toLocaleDateString('pt-BR')}</p>
              {sla.label && sla.status !== 'ok' ? (
                <div className="mt-2">
                  <span className={sla.classe}>{sla.label}</span>
                </div>
              ) : null}
            </button>
          );
        })}

        {cards.length === 0 ? (
          <div
            className="p-6 text-center text-sm text-stone-400"
            style={{
              border: '0.5px dashed var(--moni-border-default)',
              borderRadius: 'var(--moni-radius-lg)',
            }}
          >
            {listaVaziaPorFiltro ? 'Nenhum card com estes filtros' : 'Nenhum card nesta fase'}
          </div>
        ) : null}
      </div>
    </div>
  );
}
