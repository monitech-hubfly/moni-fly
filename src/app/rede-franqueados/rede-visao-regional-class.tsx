'use client';

import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';

const chartCardStyle: React.CSSProperties = {
  borderColor: 'var(--moni-rede-chart-border)',
  backgroundColor: 'var(--moni-surface-0)',
};

function barWidth(n: number, max: number): string {
  if (!max) return '0%';
  return `${Math.round((n / max) * 100)}%`;
}

function pct(n: number, total: number): string {
  if (!total) return '0%';
  return `${((n / total) * 100).toFixed(1).replace('.', ',')}%`;
}

type Props = {
  regionalArr: [string, number][];
  maxRegional: number;
  operacao: number;
  total: number;
  modoAggregado: boolean;
  rowsPorRegional: Map<string, RedeFranqueadoRowDb[]>;
  rowsEmOperacao: RedeFranqueadoRowDb[];
  pagantes: number;
  beta: number;
  maxClassificacao: number;
  totalClass: number;
  rowsPagante: RedeFranqueadoRowDb[];
  rowsBeta: RedeFranqueadoRowDb[];
  statusByClass: {
    pagante: { encerrada: number };
    beta: { encerrada: number };
  };
  onOpenLista: (titulo: string, rows: RedeFranqueadoRowDb[]) => void;
};

export function RedeVisaoRegionalClassificacao({
  regionalArr,
  maxRegional,
  operacao,
  total,
  modoAggregado,
  rowsPorRegional,
  rowsEmOperacao,
  pagantes,
  beta,
  maxClassificacao,
  totalClass,
  rowsPagante,
  rowsBeta,
  statusByClass,
  onOpenLista,
}: Props) {
  /** Visão geral: apenas Pagante e Beta (Corporação não entra no gráfico). */
  const classItems = [
    { key: 'pagante', label: 'Pagante', n: pagantes, rows: rowsPagante, fill: 'var(--moni-green-800)' },
    { key: 'beta', label: 'Beta', n: beta, rows: rowsBeta, fill: 'var(--moni-gold-600)' },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
      <div className="flex rounded-xl border p-4" style={chartCardStyle}>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium" style={{ color: 'var(--moni-text-primary)' }}>
            Franquias por regional
          </p>
          <p className="mb-3 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
            Distribuição da rede filtrada.
          </p>
          <div className="space-y-2">
            {regionalArr.slice(0, 8).map(([k, v]) => {
              const inner = (
                <>
                  <div
                    className="w-16 shrink-0 truncate text-right text-[11.5px]"
                    title={k}
                    style={{ color: 'var(--moni-text-tertiary)' }}
                  >
                    {k}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="h-1.5 rounded-sm" style={{ backgroundColor: 'var(--moni-rede-map-tier-0)' }}>
                      <div
                        className="h-1.5 rounded-sm"
                        style={{
                          width: barWidth(v, maxRegional),
                          backgroundColor: 'var(--moni-green-800)',
                        }}
                      />
                    </div>
                  </div>
                  <span
                    className="w-6 shrink-0 text-right text-xs font-medium tabular-nums"
                    style={{ color: 'var(--moni-text-primary)' }}
                  >
                    {v}
                  </span>
                </>
              );
              if (modoAggregado) {
                return (
                  <div key={k} className="flex w-full items-center gap-2 py-0.5">
                    {inner}
                  </div>
                );
              }
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onOpenLista(`Regional: ${k} (${v})`, rowsPorRegional.get(k) ?? [])}
                  className="flex w-full items-center gap-2 rounded py-0.5 text-left hover:bg-[var(--moni-surface-100)]"
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </div>
        <div className="ml-4 shrink-0 border-l pl-4" style={{ borderColor: 'var(--moni-border-subtle)' }}>
          {modoAggregado ? (
            <div>
              <p className="text-3xl font-medium leading-none" style={{ color: 'var(--moni-text-primary)' }}>
                {operacao}
              </p>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                {pct(operacao, total)} da rede
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
                Em operação
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onOpenLista(`Em operação (${operacao})`, rowsEmOperacao)}
              className="text-left hover:opacity-90"
            >
              <p className="text-3xl font-medium leading-none" style={{ color: 'var(--moni-text-primary)' }}>
                {operacao}
              </p>
              <p className="mt-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                {pct(operacao, total)} da rede
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
                Em operação
              </p>
            </button>
          )}
        </div>
      </div>

      {!modoAggregado ? (
        <div className="rounded-xl border p-4" style={chartCardStyle}>
          <p className="text-[13px] font-medium" style={{ color: 'var(--moni-text-primary)' }}>
            Classificação dos franqueados
          </p>
          <p className="mb-3 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
            Distribuição por tipo na rede filtrada.
          </p>
          <div className="space-y-3">
            {classItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onOpenLista(`${item.label} (${item.n})`, item.rows)}
                className="w-full rounded text-left hover:opacity-90"
              >
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
                  <span>{item.label}</span>
                  <span className="tabular-nums">
                    {item.n} · {pct(item.n, totalClass)}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-sm" style={{ backgroundColor: 'var(--moni-surface-200)' }}>
                  <div
                    className="h-2 rounded-sm"
                    style={{
                      width: barWidth(item.n, maxClassificacao),
                      backgroundColor: item.fill,
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
            {classItems.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: item.fill }} />
                {item.label}: {item.n}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: 'var(--moni-status-overdue-text)' }} />
              Enc. pagante: {statusByClass.pagante.encerrada}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: 'var(--moni-gold-800)' }} />
              Enc. beta: {statusByClass.beta.encerrada}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
