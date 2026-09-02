'use client';

import { useMemo } from 'react';
import type { PastelariaCardView } from '@/lib/pastelaria/api-client';
import type { PastelariaColuna, PastelariaHorasRow } from '@/lib/pastelaria/types';
import {
  responsavelAvatarStyle,
  responsavelDisplayNome,
  responsavelIniciais,
  responsavelNomeEhDoUsuario,
  SEM_RESPONSAVEL_LABEL,
  sortResponsavelLabels,
} from '@/lib/pastelaria/responsavel';
import { PastelariaCard } from '@/components/carometro/pastelaria/PastelariaCard';

export type PastelariaColunaConfig = {
  id: PastelariaColuna;
  title: string;
  color: string;
  border: string;
  badge?: string;
  showAdd: boolean;
};

type PastelariaKanbanProps = {
  columns: PastelariaColunaConfig[];
  cardsByColuna: Record<PastelariaColuna, PastelariaCardView[]>;
  loggedUserName?: string;
  groupByResponsavel?: boolean;
  horasMap: Record<string, PastelariaHorasRow | undefined>;
  dragCardId: string | null;
  onDragStart: (cardId: string, fromColuna: PastelariaColuna) => void;
  onDragEnd: () => void;
  onDrop: (toColuna: PastelariaColuna) => void;
  onAceitar: (card: PastelariaCardView) => void;
  onReclassificar: (card: PastelariaCardView) => void;
  onOpenHoras: (card: PastelariaCardView) => void;
  onOpenDetail: (card: PastelariaCardView) => void;
  onAdd: (coluna: PastelariaColuna) => void;
};

function groupCardsByResponsavel(
  cards: PastelariaCardView[],
  loggedUserName: string,
): { label: string; cards: PastelariaCardView[] }[] {
  const map = new Map<string, PastelariaCardView[]>();
  for (const card of cards) {
    const label = responsavelDisplayNome(card) ?? SEM_RESPONSAVEL_LABEL;
    const list = map.get(label) ?? [];
    list.push(card);
    map.set(label, list);
  }
  const labels = sortResponsavelLabels(Array.from(map.keys()), loggedUserName);
  return labels.map((label) => ({ label, cards: map.get(label) ?? [] }));
}

function ResponsavelGroupHeader({
  label,
  count,
  loggedUserName,
}: {
  label: string;
  count: number;
  loggedUserName: string;
}) {
  const isMeu = responsavelNomeEhDoUsuario(label, loggedUserName);
  const displayNome = label === SEM_RESPONSAVEL_LABEL ? label : label;
  const avatarNome = label === SEM_RESPONSAVEL_LABEL ? '?' : label;

  return (
    <div className="pastelaria-kanban-grupo">
      {label !== SEM_RESPONSAVEL_LABEL ? (
        <span
          className="pastelaria-resp-avatar pastelaria-resp-avatar--sm"
          style={responsavelAvatarStyle(avatarNome)}
          aria-hidden
        >
          {responsavelIniciais(avatarNome)}
        </span>
      ) : null}
      <span className="pastelaria-kanban-grupo__nome">{displayNome}</span>
      <span className="pastelaria-kanban-grupo__count">· {count}</span>
      {isMeu ? <span className="pastelaria-resp-badge-meu">meu</span> : null}
    </div>
  );
}

function ColumnBody({
  colId,
  cards,
  loggedUserName,
  groupByResponsavel,
  horasMap,
  onAceitar,
  onReclassificar,
  onOpenHoras,
  onOpenDetail,
  onDragStart,
  onDragEnd,
}: {
  colId: PastelariaColuna;
  cards: PastelariaCardView[];
  loggedUserName: string;
  groupByResponsavel: boolean;
  horasMap: Record<string, PastelariaHorasRow | undefined>;
  onAceitar: (card: PastelariaCardView) => void;
  onReclassificar: (card: PastelariaCardView) => void;
  onOpenHoras: (card: PastelariaCardView) => void;
  onOpenDetail: (card: PastelariaCardView) => void;
  onDragStart: (cardId: string, fromColuna: PastelariaColuna) => void;
  onDragEnd: () => void;
}) {
  const groups = useMemo(() => {
    if (!groupByResponsavel) return null;
    return groupCardsByResponsavel(cards, loggedUserName);
  }, [cards, groupByResponsavel, loggedUserName]);

  const renderCard = (card: PastelariaCardView) => (
    <PastelariaCard
      key={card.id}
      card={card}
      coluna={colId}
      loggedUserName={loggedUserName}
      horasSemanaAtual={horasMap[card.id]}
      onAceitar={() => onAceitar(card)}
      onReclassificar={() => onReclassificar(card)}
      onOpenHoras={() => onOpenHoras(card)}
      onOpenDetail={() => onOpenDetail(card)}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', card.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(card.id, colId);
      }}
      onDragEnd={onDragEnd}
    />
  );

  if (!groupByResponsavel || !groups) {
    return <>{cards.map(renderCard)}</>;
  }

  return (
    <>
      {groups.map((grupo, idx) => (
        <div key={`${colId}-${grupo.label}`} className="pastelaria-kanban-grupo-wrap">
          {idx > 0 ? <div className="pastelaria-kanban-grupo-divider" role="separator" /> : null}
          <ResponsavelGroupHeader
            label={grupo.label}
            count={grupo.cards.length}
            loggedUserName={loggedUserName}
          />
          {grupo.cards.map(renderCard)}
        </div>
      ))}
    </>
  );
}

export function PastelariaKanban({
  columns,
  cardsByColuna,
  loggedUserName = '',
  groupByResponsavel = true,
  horasMap,
  dragCardId,
  onDragStart,
  onDragEnd,
  onDrop,
  onAceitar,
  onReclassificar,
  onOpenHoras,
  onOpenDetail,
  onAdd,
}: PastelariaKanbanProps) {
  return (
    <div className="pastelaria-kanban">
      {columns.map((col) => (
        <section
          key={col.id}
          className="pastelaria-kanban-col"
          style={{
            ['--pastelaria-col-accent' as string]: col.color,
            ['--pastelaria-col-border' as string]: col.border,
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => onDrop(col.id)}
        >
          <header className="pastelaria-kanban-col__head">
            <h2 className="pastelaria-kanban-col__title">{col.title}</h2>
            <span className="pastelaria-kanban-col__count">
              {(cardsByColuna[col.id] ?? []).length}
            </span>
          </header>
          {col.badge ? <p className="pastelaria-kanban-col__badge">{col.badge}</p> : null}

          <div className="pastelaria-kanban-col__body">
            <ColumnBody
              colId={col.id}
              cards={cardsByColuna[col.id] ?? []}
              loggedUserName={loggedUserName}
              groupByResponsavel={groupByResponsavel}
              horasMap={horasMap}
              onAceitar={onAceitar}
              onReclassificar={onReclassificar}
              onOpenHoras={onOpenHoras}
              onOpenDetail={onOpenDetail}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          </div>

          {col.showAdd ? (
            <button
              type="button"
              className="pastelaria-kanban-col__add"
              onClick={() => onAdd(col.id)}
              aria-label={`Adicionar pastel em ${col.title}`}
            >
              + Adicionar
            </button>
          ) : null}
        </section>
      ))}
    </div>
  );
}
