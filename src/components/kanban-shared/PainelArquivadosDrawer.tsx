'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { PainelArquivadoDrawerRow } from '@/lib/kanban/painel-performance-types';

type Props = {
  open: boolean;
  onClose: () => void;
  rows: PainelArquivadoDrawerRow[];
};

function momentoTagClass(momento: PainelArquivadoDrawerRow['momentoConversao']): string {
  if (momento === 'antes') return 'moni-tag-atrasado';
  if (momento === 'na_conversao') return 'moni-tag-atencao';
  if (momento === 'depois') return 'moni-tag-concluido';
  return 'moni-tag-arquivado';
}

export function PainelArquivadosDrawer({ open, onClose, rows }: Props) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[120] ${entered ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
      aria-hidden={!entered}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-3xl flex-col bg-white shadow-xl transition-transform duration-200 ${
          entered ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          borderLeft: '0.5px solid var(--moni-border-default)',
          background: 'var(--moni-surface-0)',
        }}
        role="dialog"
        aria-labelledby="painel-arquivados-drawer-title"
      >
        <header
          className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: 'var(--moni-border-default)' }}
        >
          <div className="min-w-0">
            <h2
              id="painel-arquivados-drawer-title"
              className="text-xl font-semibold tracking-tight"
              style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
            >
              Cards Arquivados
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
              {rows.length} card(s) no recorte · somente leitura para auditoria de perda do funil.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-md p-2"
            style={{ color: 'var(--moni-text-secondary)' }}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {rows.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
              Nenhum card arquivado no recorte atual.
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li
                  key={row.cardId}
                  className="rounded-lg px-4 py-4"
                  style={{
                    border: '0.5px solid var(--moni-border-default)',
                    borderRadius: 'var(--moni-radius-lg)',
                    boxShadow: 'var(--moni-shadow-card)',
                  }}
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className="font-mono text-[10px] tracking-wide"
                        style={{ color: 'var(--moni-text-tertiary)' }}
                      >
                        {row.cardId}
                      </p>
                      <p
                        className="mt-1 font-medium leading-snug"
                        style={{ color: 'var(--moni-text-primary)' }}
                      >
                        {row.titulo}
                      </p>
                      <p className="mt-0.5 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                        {row.classificacaoRotulo}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs ${momentoTagClass(row.momentoConversao)}`}>
                      {row.momentoConversaoLabel}
                    </span>
                  </div>

                  <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 text-xs sm:grid-cols-2">
                    <div>
                      <dt style={{ color: 'var(--moni-text-tertiary)' }}>Funil</dt>
                      <dd className="mt-0.5 font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                        {row.funilNome}
                      </dd>
                    </div>
                    <div>
                      <dt style={{ color: 'var(--moni-text-tertiary)' }}>Fase de arquivamento</dt>
                      <dd className="mt-0.5 font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                        {row.faseArquivamentoNome}
                      </dd>
                    </div>
                    <div>
                      <dt style={{ color: 'var(--moni-text-tertiary)' }}>Data de arquivamento</dt>
                      <dd className="mt-0.5 tabular-nums font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                        {row.arquivadoEm ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt style={{ color: 'var(--moni-text-tertiary)' }}>Responsável</dt>
                      <dd className="mt-0.5 font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                        {row.responsavelNome}
                      </dd>
                    </div>
                    {row.unidadeLabel ? (
                      <div className="sm:col-span-2">
                        <dt style={{ color: 'var(--moni-text-tertiary)' }}>Franquia / unidade</dt>
                        <dd className="mt-0.5 font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                          {row.unidadeLabel}
                        </dd>
                      </div>
                    ) : null}
                    <div className="sm:col-span-2">
                      <dt style={{ color: 'var(--moni-text-tertiary)' }}>Motivo do arquivamento</dt>
                      <dd className="mt-0.5 leading-relaxed" style={{ color: 'var(--moni-text-secondary)' }}>
                        {row.motivo}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--moni-border-subtle)' }}>
                    <Link
                      href={row.openHref}
                      className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium hover:underline"
                      style={{ color: 'var(--moni-navy-800)' }}
                    >
                      Abrir card original
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer
          className="shrink-0 border-t px-5 py-3 text-[11px]"
          style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-text-tertiary)' }}
        >
          Painel somente leitura. Para alterar motivo ou status, abra o card no Kanban.
        </footer>
      </aside>
    </div>
  );
}
