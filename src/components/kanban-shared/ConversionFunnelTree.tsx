'use client';

import type { ConversionFunnelTreeData } from '@/lib/kanban/painel-performance-types';

function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n);
}

function formatPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${Math.round(n)}%`;
}

function formatDias(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${Math.round(n)} dias`;
}

function ArrowConnector() {
  return (
    <div
      className="flex shrink-0 items-center justify-center px-1 py-2 sm:px-2 sm:py-0"
      aria-hidden
    >
      <span
        className="hidden text-lg font-light sm:inline"
        style={{ color: 'var(--moni-text-tertiary)' }}
      >
        →
      </span>
      <span
        className="inline text-lg font-light sm:hidden"
        style={{ color: 'var(--moni-text-tertiary)' }}
      >
        ↓
      </span>
    </div>
  );
}

function FunnelNode({ node, isFirst }: { node: ConversionFunnelTreeData['nodes'][number]; isFirst: boolean }) {
  const conversao = isFirst ? null : node.conversaoAnteriorPct;
  const perda = isFirst ? null : node.perdaAnteriorPct;

  return (
    <div
      className="flex min-w-[200px] flex-1 flex-col gap-2 px-4 py-4 sm:min-w-[180px] sm:max-w-[220px]"
      style={{
        borderRadius: 'var(--moni-radius-lg)',
        border: node.faseConversao
          ? '0.5px solid var(--moni-gold-400)'
          : '0.5px solid var(--moni-border-default)',
        background: node.faseConversao ? 'var(--moni-kanban-credito-light)' : 'var(--moni-surface-100)',
        boxShadow: node.faseConversao ? 'var(--moni-shadow-card)' : undefined,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4
          className="text-sm font-semibold leading-snug"
          style={{
            fontFamily: node.faseConversao ? 'var(--moni-font-display)' : undefined,
            color: 'var(--moni-text-primary)',
          }}
        >
          {node.faseNome}
        </h4>
        {node.faseConversao ? (
          <span className="moni-tag-atencao shrink-0 text-[10px]">conversão</span>
        ) : null}
      </div>

      <p className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--moni-navy-800)' }}>
        {formatInt(node.alcancaram)}
      </p>

      <p className="text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
        {formatPct(node.pctSobreEntradas)} das entradas
      </p>

      {!isFirst && conversao != null && perda != null ? (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--moni-text-secondary)' }}>
          <span style={{ color: 'var(--moni-kanban-portfolio)' }}>conversão {formatPct(conversao)}</span>
          {' · '}
          <span style={{ color: 'var(--moni-text-tertiary)' }}>perda {formatPct(perda)}</span>
        </p>
      ) : null}

      <p className="mt-auto text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        Tempo médio: {formatDias(node.tempoMedioDias)}
      </p>
    </div>
  );
}

export type ConversionFunnelTreeProps = {
  data: ConversionFunnelTreeData;
};

export function ConversionFunnelTree({ data }: ConversionFunnelTreeProps) {
  if (data.nodes.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
        Nenhuma fase configurada neste funil.
      </p>
    );
  }

  if (data.entradasNoFunil === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
        Nenhum card entrou no funil no período selecionado.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {data.historicoParcial ? (
        <p className="inline-flex items-center gap-2 text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
          <span
            className="rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
            style={{
              background: 'var(--moni-surface-200)',
              border: '0.5px solid var(--moni-border-subtle)',
              borderRadius: 'var(--moni-radius-md)',
              color: 'var(--moni-text-tertiary)',
            }}
          >
            histórico parcial
          </span>
          Posição atual dos cards usada como aproximação onde o histórico não está completo.
        </p>
      ) : null}

      <div
        className="flex flex-col items-stretch gap-0 sm:flex-row sm:items-stretch sm:overflow-x-auto sm:pb-2"
        role="list"
        aria-label="Funil de conversão por fase"
      >
        {data.nodes.map((node, idx) => (
          <div key={node.faseId} className="flex flex-col sm:flex-row sm:items-stretch" role="listitem">
            <FunnelNode node={node} isFirst={idx === 0} />
            {idx < data.nodes.length - 1 ? <ArrowConnector /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
