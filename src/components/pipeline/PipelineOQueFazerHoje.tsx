'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { PipelineOQueFazerItem } from '@/lib/kanban/pipeline-cards-types';
import { tituloPipelineCardDisplay } from '@/lib/kanban/pipeline-card-readonly';

const panelStyle: React.CSSProperties = {
  borderRadius: 'var(--moni-radius-lg)',
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
};

export function PipelineOQueFazerHoje({ items }: { items: PipelineOQueFazerItem[] }) {
  return (
    <div className="mb-6 px-4 py-4" style={panelStyle}>
      <h3 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
        O que fazer hoje
      </h3>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        Prioridade: travas → atrasos → parados → chamados vencidos (máx. 10).
      </p>
      {items.length === 0 ? (
        <p className="mt-3 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Nenhuma ação urgente identificada para hoje.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[11px]">
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}>
                {['Título', 'Fase', 'Ação necessária', ''].map((h) => (
                  <th
                    key={h || 'link'}
                    className="pb-2 pr-3 font-semibold uppercase tracking-wide last:pr-0"
                    style={{ color: 'var(--moni-text-tertiary)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={`${item.cardId}-${item.acao}`}
                  style={{ borderBottom: '0.5px solid var(--moni-border-subtle, var(--moni-border-default))' }}
                >
                  <td className="max-w-[14rem] truncate py-2.5 pr-3 font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                    {tituloPipelineCardDisplay({ titulo: item.titulo, n_franquia: null })}
                  </td>
                  <td className="py-2.5 pr-3" style={{ color: 'var(--moni-text-secondary)' }}>
                    {item.fase}
                  </td>
                  <td className="py-2.5 pr-3" style={{ color: 'var(--moni-text-secondary)' }}>
                    {item.acao}
                  </td>
                  <td className="py-2.5">
                    <Link
                      href={item.href}
                      className="inline-flex min-h-[44px] items-center gap-1 text-[11px] font-medium"
                      style={{ color: 'var(--moni-navy-800)' }}
                    >
                      Abrir
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
