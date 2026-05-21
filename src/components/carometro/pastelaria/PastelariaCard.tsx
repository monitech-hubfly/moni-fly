'use client';

import type { DragEvent } from 'react';
import type { PastelariaCardView } from '@/lib/pastelaria/api-client';
import { formatEstimativa } from '@/lib/pastelaria/api-client';
import {
  horasConvertidasNoDia,
  PASTELARIA_DIAS_HORAS,
  totalHorasConvertidas,
} from '@/lib/pastelaria/converter';
import type { PastelariaColuna, PastelariaHorasRow } from '@/lib/pastelaria/types';
import {
  responsavelAvatarStyle,
  responsavelDisplayNome,
  responsavelEhDoUsuario,
  responsavelIniciais,
} from '@/lib/pastelaria/responsavel';
import { semanaAtualLabel } from '@/lib/pastelaria/week';

function IconUser() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

type PastelariaCardProps = {
  card: PastelariaCardView;
  coluna: PastelariaColuna;
  loggedUserName?: string;
  horasSemanaAtual?: PastelariaHorasRow | null;
  onAceitar?: () => void;
  onReclassificar?: () => void;
  onOpenHoras?: () => void;
  onOpenDetail?: () => void;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
};

function formatHorasTotal(total: number): string {
  return `${Number(total.toFixed(2))}h`;
}

export function PastelariaCard({
  card,
  coluna,
  loggedUserName,
  horasSemanaAtual,
  onAceitar,
  onReclassificar,
  onOpenHoras,
  onOpenDetail,
  onDragStart,
  onDragEnd,
}: PastelariaCardProps) {
  const maxBar = 8;
  const total = totalHorasConvertidas(horasSemanaAtual);
  const semanaLabel = semanaAtualLabel();
  const responsavelNome = responsavelDisplayNome(card);
  const isMeu = responsavelEhDoUsuario(card, loggedUserName);

  const respBorderClass = responsavelNome
    ? isMeu
      ? 'pastelaria-kanban-card--resp-meu'
      : 'pastelaria-kanban-card--resp-outro'
    : '';

  return (
    <article
      className={`pastelaria-kanban-card pastelaria-kanban-card--${coluna}${respBorderClass}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="pastelaria-kanban-card__head">
        <h3 className="pastelaria-kanban-card__nome" title={card.nome}>
          {card.nome}
        </h3>
        <button
          type="button"
          className="pastelaria-kanban-card__menu"
          onClick={onOpenDetail}
          aria-label={`Detalhes de ${card.nome}`}
        >
          ⋯
        </button>
      </div>

      <div className="pastelaria-kanban-card__responsavel">
        {responsavelNome ? (
          <>
            <span
              className="pastelaria-resp-avatar"
              style={responsavelAvatarStyle(responsavelNome)}
              aria-hidden
            >
              {responsavelIniciais(responsavelNome)}
            </span>
            <span className="pastelaria-resp-nome">{responsavelNome}</span>
            {isMeu ? <span className="pastelaria-resp-badge-meu">meu</span> : null}
          </>
        ) : (
          <span className="pastelaria-resp-vazio">
            <IconUser />
            <span>Sem responsável</span>
          </span>
        )}
      </div>

      <div className="pastelaria-kanban-card__pills">
        <span className="pastelaria-pill pastelaria-pill--estimativa">
          {formatEstimativa(card.estimativa_valor, card.estimativa_unidade)}
        </span>
        {card.source ? (
          <span className="pastelaria-pill pastelaria-pill--source">{card.source}</span>
        ) : null}
      </div>

      {card.opened_by ? (
        <p className="pastelaria-kanban-card__opened">Aberto por: {card.opened_by}</p>
      ) : null}

      {coluna === 'done' && card.completed_week ? (
        <span className="pastelaria-pill pastelaria-pill--done">✓ {card.completed_week}</span>
      ) : null}

      {coluna === 'doing' ? (
        <button
          type="button"
          className="pastelaria-horas-mini"
          onClick={onOpenHoras}
          aria-label={`Registrar horas de ${card.nome} na ${semanaLabel}`}
        >
          <span className="pastelaria-horas-mini__label">{semanaLabel}</span>
          <div className="pastelaria-horas-mini__bars">
            {PASTELARIA_DIAS_HORAS.map(({ key, label }) => {
              const v = horasConvertidasNoDia(horasSemanaAtual, key);
              const h = maxBar > 0 ? Math.min(100, (v / maxBar) * 100) : 0;
              return (
                <span
                  key={key}
                  className="pastelaria-horas-mini__bar"
                  style={{ height: `${h}%` }}
                  title={`${label}: ${formatHorasTotal(v)}`}
                />
              );
            })}
          </div>
          <span className="pastelaria-horas-mini__total">{formatHorasTotal(total)}</span>
        </button>
      ) : null}

      {coluna === 'inbox' ? (
        <div className="pastelaria-kanban-card__actions">
          <button
            type="button"
            className="pastelaria-btn pastelaria-btn--aceitar"
            onClick={onAceitar}
            aria-label={`Aceitar ${card.nome}`}
          >
            Aceitar
          </button>
          <button
            type="button"
            className="pastelaria-btn pastelaria-btn--reclass"
            onClick={onReclassificar}
            aria-label={`Reclassificar ${card.nome}`}
          >
            Reclassificar
          </button>
        </div>
      ) : null}
    </article>
  );
}
