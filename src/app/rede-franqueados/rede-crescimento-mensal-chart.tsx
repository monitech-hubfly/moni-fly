'use client';

import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';

export type RedeMesCrescimentoStat = {
  key: string;
  total: number;
  pagante: number;
  beta: number;
  outros: number;
  rows: RedeFranqueadoRowDb[];
};

type FiltroAno = 'tudo' | '2025' | '2026';

function monthLabelShort(key: string): string {
  const [y, m] = key.split('-');
  const month = Number(m);
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${names[Math.max(1, Math.min(12, month)) - 1]} '${String(y).slice(-2)}`;
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-4 py-1.5 text-xs font-medium transition hover:opacity-90"
      style={
        active
          ? {
              backgroundColor: 'var(--moni-green-800)',
              color: 'var(--moni-text-inverse)',
              border: '1px solid transparent',
            }
          : {
              backgroundColor: 'transparent',
              color: 'var(--moni-text-tertiary)',
              border: '1px solid var(--moni-border-default)',
            }
      }
    >
      {children}
    </button>
  );
}

type Props = {
  months: RedeMesCrescimentoStat[];
  filtroAno: FiltroAno;
  onFiltroAno: (ano: FiltroAno) => void;
  onOpenLista: (titulo: string, rows: RedeFranqueadoRowDb[]) => void;
};

const chartCardStyle: React.CSSProperties = {
  borderColor: 'var(--moni-rede-chart-border)',
  backgroundColor: 'var(--moni-surface-0)',
};

export function RedeCrescimentoMensalChart({ months, filtroAno, onFiltroAno, onOpenLista }: Props) {
  const totalRede = months.reduce((s, m) => s + m.total, 0);

  return (
    <div className="rounded-xl border p-4" style={chartCardStyle}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium" style={{ color: 'var(--moni-text-primary)' }}>
            Crescimento mensal — novas franquias assinadas
          </p>
          <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
            Contratos assinados por mês (Data de Ass. Contrato).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterPill active={filtroAno === 'tudo'} onClick={() => onFiltroAno('tudo')}>
            Tudo
          </FilterPill>
          <FilterPill active={filtroAno === '2025'} onClick={() => onFiltroAno('2025')}>
            2025
          </FilterPill>
          <FilterPill active={filtroAno === '2026'} onClick={() => onFiltroAno('2026')}>
            2026
          </FilterPill>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px]" style={{ color: 'var(--moni-text-secondary)' }}>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--moni-green-800)' }} />
          Pagante
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--moni-green-400)' }} />
          Beta
        </span>
      </div>

      {months.length === 0 ? (
        <p className="py-6 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
          Sem datas de contrato no período selecionado.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[min(100%,32rem)]" role="img" aria-label="Gráfico horizontal — contratos por mês">
            <div className="flex w-full min-w-0">
              {months.map((m) => (
                <div
                  key={`lbl-${m.key}`}
                  className="min-w-[2.75rem] shrink-0 px-0.5 text-center"
                  style={{ flex: `${m.total} 1 0` }}
                >
                  <span
                    className="whitespace-nowrap text-[10px] font-medium leading-tight"
                    style={{ color: 'var(--moni-text-tertiary)' }}
                  >
                    {monthLabelShort(m.key)}
                  </span>
                </div>
              ))}
            </div>

            <div
              className="mt-1 flex h-11 w-full min-w-0 overflow-hidden rounded-lg border"
              style={{ borderColor: 'var(--moni-border-subtle)' }}
            >
              {months.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  title={`${monthLabelShort(m.key)}: ${m.total} franquia(s) — Pagante ${m.pagante}, Beta ${m.beta}`}
                  onClick={() => onOpenLista(`${monthLabelShort(m.key)} — ${m.total} franquia(s)`, m.rows)}
                  className="flex h-full min-w-[2.75rem] shrink-0 border-r border-white/20 transition last:border-r-0 hover:brightness-95"
                  style={{ flex: `${m.total} 1 0` }}
                >
                  {m.pagante > 0 ? (
                    <span
                      className="flex min-w-0 items-center justify-center text-[11px] font-semibold tabular-nums text-white"
                      style={{ flex: m.pagante, backgroundColor: 'var(--moni-green-800)' }}
                    >
                      {m.pagante}
                    </span>
                  ) : null}
                  {m.beta > 0 ? (
                    <span
                      className="flex min-w-0 items-center justify-center text-[11px] font-semibold tabular-nums text-white"
                      style={{ flex: m.beta, backgroundColor: 'var(--moni-green-400)' }}
                    >
                      {m.beta}
                    </span>
                  ) : null}
                  {m.outros > 0 ? (
                    <span
                      className="flex min-w-0 items-center justify-center text-[11px] font-semibold tabular-nums"
                      style={{
                        flex: m.outros,
                        backgroundColor: 'var(--moni-rede-map-tier-0)',
                        color: 'var(--moni-text-secondary)',
                      }}
                    >
                      {m.outros}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="mt-1.5 flex w-full min-w-0">
              {months.map((m) => (
                <div
                  key={`tot-${m.key}`}
                  className="min-w-[2.75rem] shrink-0 px-0.5 text-center"
                  style={{ flex: `${m.total} 1 0` }}
                >
                  <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--moni-text-primary)' }}>
                    {m.total}
                  </span>
                </div>
              ))}
            </div>

            {totalRede > 0 ? (
              <p className="mt-3 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
                Barra horizontal única: cada segmento é um mês, dividido por classificação (Pagante / Beta). A largura
                de cada mês é proporcional ao total de franquias assinadas naquele período.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
