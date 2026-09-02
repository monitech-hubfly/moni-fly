'use client';

import Link from 'next/link';
import { Loader2, X } from 'lucide-react';
import {
  formatKanbanNomeVinculoHeader,
  statusVinculoCard,
  type KanbanVinculoCardItem,
  type KanbanVinculoGrupo,
} from '@/lib/kanban/kanban-vinculos-display';

export type { KanbanVinculoCardItem, KanbanVinculoGrupo };

export type KanbanCardVinculosSectionProps = {
  grupos: KanbanVinculoGrupo[];
  loading?: boolean;
  emptyMessage?: string | null;
  /** Sidebar do modal: tipografia compacta. */
  variant?: 'default' | 'sidebar';
  className?: string;
};

function VinculoCardItem({
  item,
  variant,
}: {
  item: KanbanVinculoCardItem;
  variant: 'default' | 'sidebar';
}) {
  const sidebar = variant === 'sidebar';
  const st = statusVinculoCard({
    arquivado: item.status === 'arquivado',
    concluido: item.status === 'concluido',
  });

  const content = (
    <>
      <span
        className={
          sidebar
            ? 'min-w-0 font-semibold leading-snug'
            : 'min-w-0 font-semibold leading-snug sm:text-sm'
        }
        style={{ color: 'var(--moni-text-primary)' }}
      >
        {item.titulo}
      </span>
      <span
        className={sidebar ? 'text-[10px] leading-snug' : 'text-xs leading-snug'}
        style={{ color: 'var(--moni-text-secondary)' }}
      >
        {item.faseNome}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`shrink-0 uppercase ${st.tagClass} ${sidebar ? 'text-[9px]' : 'text-[10px]'}`}>
          {st.rotulo}
        </span>
        {item.dataLabel ? (
          <span
            className={`shrink-0 tabular-nums ${sidebar ? 'text-[10px]' : 'text-xs'}`}
            style={{ color: 'var(--moni-text-tertiary)' }}
          >
            {item.dataLabel}
          </span>
        ) : null}
      </div>
    </>
  );

  return (
    <li className="moni-vinculos-item">
      <div
        className={
          sidebar
            ? 'flex items-start justify-between gap-2 rounded-lg px-2.5 py-2'
            : 'flex items-start justify-between gap-2 rounded-lg px-3 py-2.5 sm:px-3.5'
        }
        style={{
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          background: 'var(--moni-surface-100)',
          borderRadius: 'var(--moni-radius-lg)',
        }}
      >
        <Link
          href={item.href}
          className="min-w-0 flex-1 space-y-0.5 transition hover:opacity-90"
        >
          {content}
        </Link>
        {item.onRemove ? (
          <button
            type="button"
            onClick={item.onRemove}
            className="moni-vinculos-remove shrink-0 rounded-md p-1 transition"
            style={{ color: 'var(--moni-text-tertiary)' }}
            aria-label="Remover vínculo"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function KanbanCardVinculosSection({
  grupos,
  loading = false,
  emptyMessage = null,
  variant = 'sidebar',
  className = '',
}: KanbanCardVinculosSectionProps) {
  const sidebar = variant === 'sidebar';

  if (loading) {
    return (
      <div
        className={`moni-vinculos-section flex items-center gap-2 ${sidebar ? 'py-2 text-xs' : 'py-4 text-sm'} ${className}`}
        style={{ color: 'var(--moni-text-tertiary)' }}
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando vínculos…
      </div>
    );
  }

  const totalItens = grupos.reduce((acc, g) => acc + g.items.length, 0);
  if (totalItens === 0) {
    if (!emptyMessage) return null;
    return (
      <p
        className={`moni-vinculos-section ${sidebar ? 'text-xs' : 'text-sm'} ${className}`}
        style={{ color: 'var(--moni-text-tertiary)' }}
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={`moni-vinculos-section space-y-3 ${className}`}>
      {grupos.map((grupo) => (
        <section key={grupo.kanbanNome}>
          <h3
            className={
              sidebar
                ? 'mb-1.5 text-[10px] font-semibold uppercase tracking-wide'
                : 'mb-2 text-xs font-semibold uppercase tracking-wide'
            }
            style={{ color: 'var(--moni-text-tertiary)' }}
          >
            {formatKanbanNomeVinculoHeader(grupo.kanbanNome)}
          </h3>
          <ul className={sidebar ? 'space-y-1.5' : 'space-y-2'}>
            {grupo.items.map((item) => (
              <VinculoCardItem key={item.key} item={item} variant={variant} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
