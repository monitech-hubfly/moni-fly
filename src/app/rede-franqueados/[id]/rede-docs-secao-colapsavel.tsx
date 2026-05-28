'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

type Props = {
  titulo: string;
  sectionId: string;
  vazio?: boolean;
  children?: React.ReactNode;
  /** Por padrão as seções iniciam recolhidas. */
  defaultOpen?: boolean;
};

export function RedeDocsSecaoColapsavel({
  titulo,
  sectionId,
  vazio,
  children,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `rede-docs-panel-${sectionId}`;

  return (
    <section className="rounded-xl border border-stone-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left transition hover:bg-stone-50/80"
      >
        <h2 className="text-base font-semibold text-stone-900">{titulo}</h2>
        {open ? (
          <ChevronDown className="h-5 w-5 shrink-0 text-stone-500" aria-hidden />
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0 text-stone-500" aria-hidden />
        )}
      </button>
      {open ? (
        <div id={panelId} className="border-t border-stone-100 px-5 pb-5 pt-3">
          {vazio ? (
            <p className="text-sm text-stone-500">Nenhum documento padrão cadastrado nesta seção ainda.</p>
          ) : (
            <div className="space-y-4">{children}</div>
          )}
        </div>
      ) : null}
    </section>
  );
}
