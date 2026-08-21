'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

type Props = {
  titulo: string;
  sectionId: string;
  vazio?: boolean;
  children?: React.ReactNode;
  /** Por padrão as seções iniciam recolhidas. */
  defaultOpen?: boolean;
  /** Tipografia e padding reduzidos (ex.: sidebar do card no Funil Loteadores). */
  compact?: boolean;
};

export function RedeDocsSecaoColapsavel({
  titulo,
  sectionId,
  vazio,
  children,
  defaultOpen = false,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `rede-docs-panel-${sectionId}`;

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <section
      className={
        compact
          ? 'rounded-md border border-stone-200 bg-white'
          : 'rounded-xl border border-stone-200 bg-white shadow-sm'
      }
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className={
          compact
            ? 'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition hover:bg-stone-50/80'
            : 'flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left transition hover:bg-stone-50/80'
        }
      >
        <h2
          className={
            compact
              ? 'text-[11px] font-semibold leading-snug text-stone-700'
              : 'text-base font-semibold text-stone-900'
          }
        >
          {titulo}
        </h2>
        {open ? (
          <ChevronDown
            className={compact ? 'h-3.5 w-3.5 shrink-0 text-stone-500' : 'h-5 w-5 shrink-0 text-stone-500'}
            aria-hidden
          />
        ) : (
          <ChevronRight
            className={compact ? 'h-3.5 w-3.5 shrink-0 text-stone-500' : 'h-5 w-5 shrink-0 text-stone-500'}
            aria-hidden
          />
        )}
      </button>
      {open ? (
        <div
          id={panelId}
          className={
            compact
              ? 'border-t border-stone-100 px-2.5 pb-2.5 pt-2'
              : 'border-t border-stone-100 px-5 pb-5 pt-3'
          }
        >
          {vazio ? (
            <p className={compact ? 'text-[11px] text-stone-500' : 'text-sm text-stone-500'}>
              Nenhum documento padrão cadastrado nesta seção ainda.
            </p>
          ) : (
            <div className={compact ? 'space-y-2' : 'space-y-4'}>{children}</div>
          )}
        </div>
      ) : null}
    </section>
  );
}

type SubsecaoProps = {
  titulo: string;
  sectionId: string;
  children: React.ReactNode;
  /** Por padrão as subseções iniciam recolhidas. */
  defaultOpen?: boolean;
};

/** Subseção colapsável (ex.: Incorporadora / Gestora dentro da seção 2). */
export function RedeDocsSubsecaoColapsavel({
  titulo,
  sectionId,
  children,
  defaultOpen = false,
}: SubsecaoProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `rede-docs-sub-${sectionId}`;

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/40">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left transition hover:bg-stone-100/60"
      >
        <h3 className="text-sm font-semibold text-stone-800">{titulo}</h3>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-stone-500" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-stone-500" aria-hidden />
        )}
      </button>
      {open ? (
        <div id={panelId} className="border-t border-stone-200/80 px-4 pb-4 pt-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
