'use client';

import { useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, ChevronDown, Circle, Clock } from 'lucide-react';

export type SetupTaskItemStatus = 'pendente' | 'em_andamento' | 'concluido';

export type SetupTaskItemProps = {
  itemId: string;
  titulo: string;
  descricao: string;
  orientacoes: string[];
  status: SetupTaskItemStatus;
  /**
   * Avanço no checkbox (ciclo: pendente → em_andamento → concluido → pendente).
   * Inclui `pendente` para fechar o ciclo; o pai pode mapear só `em_andamento` | `concluido` se preferir.
   */
  onToggle: (itemId: string, novoStatus: SetupTaskItemStatus) => void;
  obrigatorio?: boolean;
  subtexto?: string;
};

function nextStatus(current: SetupTaskItemStatus): SetupTaskItemStatus {
  if (current === 'pendente') return 'em_andamento';
  if (current === 'em_andamento') return 'concluido';
  return 'pendente';
}

function SubtextoLine({ text }: { text: string }) {
  const trimmed = text.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return (
      <a
        href={trimmed}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 block text-xs font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
      >
        {trimmed}
      </a>
    );
  }
  return (
    <p className="mt-1 text-xs text-slate-500" tabIndex={-1}>
      {text}
    </p>
  );
}

export function SetupTaskItem({
  itemId,
  titulo,
  descricao,
  orientacoes,
  status,
  onToggle,
  obrigatorio = false,
  subtexto,
}: SetupTaskItemProps) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  /** Pico da animação ao concluir: ~75ms em 1,02, depois ~75ms volta a 1 (150ms total). */
  const [popPeak, setPopPeak] = useState(false);
  const prevStatus = useRef<SetupTaskItemStatus | null>(null);

  useEffect(() => {
    const prev = prevStatus.current;
    prevStatus.current = status;

    if (status === 'concluido' && prev !== null && prev !== 'concluido') {
      setPopPeak(true);
      const down = window.setTimeout(() => setPopPeak(false), 75);
      return () => window.clearTimeout(down);
    }
    return undefined;
  }, [status]);

  const shellClass = clsx(
    'rounded-xl border text-left shadow-sm transition-[transform,background-color,border-color] duration-150 ease-out',
    popPeak && 'scale-[1.02]',
    status === 'concluido' && 'border-emerald-200 bg-emerald-50/90',
    status === 'em_andamento' && 'border-amber-200 bg-amber-50/90',
    status === 'pendente' && 'border-slate-200 bg-slate-50',
  );

  const tituloClass = clsx(
    'text-sm font-semibold transition-colors',
    status === 'concluido' && 'text-emerald-900 line-through decoration-emerald-700/50 decoration-1',
    status === 'em_andamento' && 'text-amber-950',
    status === 'pendente' && 'text-slate-900',
  );

  const descClass = clsx(
    'mt-0.5 text-xs leading-relaxed',
    status === 'concluido' && 'text-emerald-800/90 line-through decoration-emerald-700/40 decoration-1',
    status === 'em_andamento' && 'text-amber-900/85',
    status === 'pendente' && 'text-slate-600',
  );

  const Icon =
    status === 'concluido' ? Check : status === 'em_andamento' ? Clock : Circle;

  const iconWrap = clsx(
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
    status === 'concluido' && 'border-emerald-300 bg-emerald-100 text-emerald-700',
    status === 'em_andamento' && 'border-amber-300 bg-amber-100 text-amber-700',
    status === 'pendente' && 'border-slate-200 bg-white text-slate-400',
  );

  return (
    <div className={shellClass}>
      <div className="flex gap-3 p-4">
        <button
          type="button"
          role="checkbox"
          aria-checked={status === 'concluido' ? true : status === 'em_andamento' ? 'mixed' : false}
          aria-label={`Status da tarefa: ${status}. Clique para avançar.`}
          className={clsx(
            iconWrap,
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(itemId, nextStatus(status));
          }}
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="flex w-full items-start gap-2 text-left"
            aria-expanded={expanded}
            aria-controls={orientacoes.length > 0 ? panelId : undefined}
            onClick={() => orientacoes.length > 0 && setExpanded((v) => !v)}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={tituloClass}>{titulo}</span>
                {obrigatorio ? (
                  <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 ring-1 ring-red-100">
                    Obrigatório
                  </span>
                ) : null}
              </div>
              <p className={descClass}>{descricao}</p>
              {subtexto ? <SubtextoLine text={subtexto} /> : null}
            </div>
            {orientacoes.length > 0 ? (
              <ChevronDown
                className={clsx(
                  'mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200',
                  expanded && 'rotate-180',
                )}
                aria-hidden
              />
            ) : null}
          </button>

          {orientacoes.length > 0 && expanded ? (
            <ul id={panelId} className="mt-3 space-y-2 border-t border-black/5 pt-3 text-xs text-slate-700">
              {orientacoes.map((o, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                  <span className="leading-relaxed">{o}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
