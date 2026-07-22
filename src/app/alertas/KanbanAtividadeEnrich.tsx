'use client';
import { useState } from 'react';

export function KanbanAtividadeEnrich({
  linhaCard,
  descricao,
  prazoStr,
}: {
  linhaCard: string;
  descricao: string | null;
  prazoStr: string | null;
}) {
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="mb-3 space-y-1">
      {linhaCard ? (
        <p className="text-xs text-stone-500">{linhaCard}</p>
      ) : null}
      {prazoStr ? (
        <p className="text-xs text-stone-500">{prazoStr}</p>
      ) : null}
      {descricao ? (
        <div>
          <button
            type="button"
            onClick={() => setExpandido(v => !v)}
            className="text-xs text-stone-500 hover:text-stone-700 underline-offset-2 hover:underline"
          >
            {expandido ? '▲ Ocultar descrição' : '▼ Ver descrição'}
          </button>
          {expandido && (
            <p className="mt-1 text-xs text-stone-600 rounded bg-stone-50 border border-stone-100 px-2 py-1.5 leading-relaxed">
              {descricao}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
