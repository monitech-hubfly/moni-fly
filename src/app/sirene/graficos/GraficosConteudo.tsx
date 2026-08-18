'use client';

import type { GraficosData } from './actions';

// ─── helpers visuais ─────────────────────────────────────────────────────────

function labelData(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function labelMes(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function badgeDu(du: number) {
  if (du <= 1) return { bg: 'bg-amber-50 border-amber-200 text-amber-700', label: `${du} d.u.` };
  if (du <= 3) return { bg: 'bg-orange-50 border-orange-200 text-orange-700', label: `${du} d.u.` };
  return { bg: 'bg-red-50 border-red-200 text-red-800', label: `${du} d.u.` };
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-xs text-[color:var(--moni-text-tertiary)]">{label}</div>
    </div>
  );
}

// ─── Gráfico 1: Sem Aceite ───────────────────────────────────────────────────

function GraficoSemAceite({ rows }: { rows: GraficosData['semAceite'] }) {
  const total = rows.length;

  // breakdown por faixa
  const f1 = rows.filter((r) => r.dias_uteis === 1).length;
  const f2 = rows.filter((r) => r.dias_uteis === 2).length;
  const f3 = rows.filter((r) => r.dias_uteis >= 3 && r.dias_uteis <= 5).length;
  const f5 = rows.filter((r) => r.dias_uteis > 5).length;

  return (
    <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
      <div className="mb-1 font-semibold text-[color:var(--moni-text-primary)]">
        Chamados sem aceite há mais de 1 dia útil
      </div>
      <div className="mb-4 text-xs text-[color:var(--moni-text-tertiary)]">
        Finais de semana não contam — meta: 0
      </div>

      {/* Número principal + barra meta */}
      <div className="mb-5 flex items-center gap-5">
        <div>
          <span className={`text-5xl font-bold ${total === 0 ? 'text-green-600' : 'text-red-600'}`}>
            {total}
          </span>
          <div className="mt-0.5 text-[11px] text-[color:var(--moni-text-tertiary)]">chamados</div>
        </div>
        <div className="flex-1">
          <div className="mb-1 text-xs text-[color:var(--moni-text-secondary)]">
            Meta: 0 &nbsp;|&nbsp; Atual: {total}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--moni-surface-100)]">
            <div
              className={`h-2 rounded-full transition-all ${total === 0 ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: total === 0 ? '4px' : '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Breakdown por faixa */}
      {total > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {f1 > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center">
              <div className="text-lg font-bold text-amber-700">{f1}</div>
              <div className="text-[10px] text-amber-600">1 d.u.</div>
            </div>
          )}
          {f2 > 0 && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-center">
              <div className="text-lg font-bold text-orange-700">{f2}</div>
              <div className="text-[10px] text-orange-600">2 d.u.</div>
            </div>
          )}
          {f3 > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center">
              <div className="text-lg font-bold text-red-700">{f3}</div>
              <div className="text-[10px] text-red-600">3–5 d.u.</div>
            </div>
          )}
          {f5 > 0 && (
            <div className="rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-center">
              <div className="text-lg font-bold text-red-900">{f5}</div>
              <div className="text-[10px] text-red-700">+5 d.u.</div>
            </div>
          )}
        </div>
      )}

      {/* Lista dos chamados */}
      {total > 0 ? (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-[color:var(--moni-border-default)]">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)]">
                <th className="px-3 py-1.5 text-left font-semibold text-[color:var(--moni-text-secondary)]">#</th>
                <th className="px-3 py-1.5 text-left font-semibold text-[color:var(--moni-text-secondary)]">Chamado</th>
                <th className="px-3 py-1.5 text-left font-semibold text-[color:var(--moni-text-secondary)]">Aberto por</th>
                <th className="px-3 py-1.5 text-left font-semibold text-[color:var(--moni-text-secondary)]">Aberto em</th>
                <th className="px-3 py-1.5 text-right font-semibold text-[color:var(--moni-text-secondary)]">Espera</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].sort((a, b) => b.dias_uteis - a.dias_uteis).map((r) => {
                const badge = badgeDu(r.dias_uteis);
                return (
                  <tr key={r.id} className="border-b border-[color:var(--moni-border-default)] last:border-b-0 hover:bg-[var(--moni-surface-50)]">
                    <td className="px-3 py-1.5 font-mono text-[color:var(--moni-text-tertiary)]">
                      #{String(r.numero).padStart(4, '0')}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-1.5 text-[color:var(--moni-text-primary)]">
                      {r.titulo ?? '(sem título)'}
                    </td>
                    <td className="px-3 py-1.5 text-[color:var(--moni-text-secondary)]">
                      {r.aberto_por_nome ?? '—'}
                    </td>
                    <td className="px-3 py-1.5 text-[color:var(--moni-text-secondary)]">
                      {new Date(r.criado_em).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-lg border border-green-200 bg-green-50 py-6">
          <span className="text-sm font-medium text-green-700">✓ Todos os chamados foram aceitos a tempo</span>
        </div>
      )}
    </div>
  );
}

// ─── Gráfico 2: Por Dia (SVG) ─────────────────────────────────────────────────

function GraficoPorDia({ porDia }: { porDia: GraficosData['porDia'] }) {
  if (porDia.length === 0) return null;

  const W = 600;
  const H = 200;
  const PAD = { top: 20, right: 20, bottom: 30, left: 32 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const maxBarra = Math.max(...porDia.map((d) => Math.max(d.abertos, d.concluidos)), 1);
  const maxAcum = Math.max(...porDia.map((d) => d.acumulado), 1);

  const n = porDia.length;
  const slotW = iW / n;
  const bW = Math.min(slotW * 0.35, 12);

  // eixo y esquerdo (barras): 0..maxBarra em 4 intervalos
  // eixo y direito (acumulado): 0..maxAcum
  const yBar = (v: number) => PAD.top + iH - (v / maxBarra) * iH;
  const yAcum = (v: number) => PAD.top + iH - (v / maxAcum) * iH;

  const linhaAcum = porDia
    .map((d, i) => {
      const cx = PAD.left + i * slotW + slotW / 2;
      const cy = yAcum(d.acumulado);
      return `${cx},${cy}`;
    })
    .join(' ');

  // Datas a mostrar no eixo x (a cada ~5 pontos)
  const step = Math.max(1, Math.floor(n / 6));

  return (
    <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
      <div className="mb-1 font-semibold text-[color:var(--moni-text-primary)]">
        Chamados por dia — últimos 30 dias
      </div>
      <div className="mb-4 text-xs text-[color:var(--moni-text-tertiary)]">
        Barras: abertos e concluídos por dia &nbsp;·&nbsp; Linha: acumulado em aberto
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
          {/* grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = PAD.top + iH * (1 - f);
            const val = Math.round(maxBarra * f);
            return (
              <g key={f}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e8e5e0" strokeWidth="1" />
                <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#bbb">{val}</text>
              </g>
            );
          })}

          {/* eixo y direito — acumulado */}
          {[0, 0.5, 1].map((f) => {
            const y = PAD.top + iH * (1 - f);
            const val = Math.round(maxAcum * f);
            return (
              <text key={`r${f}`} x={W - PAD.right + 4} y={y + 4} textAnchor="start" fontSize="9" fill="#93c5fd">{val}</text>
            );
          })}

          {/* barras */}
          {porDia.map((d, i) => {
            const cx = PAD.left + i * slotW + slotW / 2;
            const hAberto = (d.abertos / maxBarra) * iH;
            const hConc = (d.concluidos / maxBarra) * iH;
            const isDow = new Date(d.data + 'T00:00:00').getDay();
            const fds = isDow === 0 || isDow === 6;
            return (
              <g key={d.data}>
                {d.abertos > 0 && (
                  <rect
                    x={cx - bW - 1}
                    y={yBar(d.abertos)}
                    width={bW}
                    height={hAberto}
                    fill={fds ? '#fde8e8' : '#fca5a5'}
                    rx="1"
                  />
                )}
                {d.concluidos > 0 && (
                  <rect
                    x={cx + 1}
                    y={yBar(d.concluidos)}
                    width={bW}
                    height={hConc}
                    fill={fds ? '#dcfce7' : '#86efac'}
                    rx="1"
                  />
                )}
              </g>
            );
          })}

          {/* linha acumulado */}
          <polyline
            points={linhaAcum}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* dots extremos da linha */}
          {porDia.length > 0 && (
            <>
              <circle
                cx={PAD.left + 0 * slotW + slotW / 2}
                cy={yAcum(porDia[0].acumulado)}
                r="3"
                fill="#3b82f6"
              />
              <circle
                cx={PAD.left + (n - 1) * slotW + slotW / 2}
                cy={yAcum(porDia[n - 1].acumulado)}
                r="3"
                fill="#3b82f6"
              />
              <text
                x={PAD.left + (n - 1) * slotW + slotW / 2 + 5}
                y={yAcum(porDia[n - 1].acumulado) + 4}
                fontSize="9"
                fill="#3b82f6"
                fontWeight="bold"
              >
                {porDia[n - 1].acumulado}
              </text>
            </>
          )}

          {/* eixo x */}
          {porDia.map((d, i) => {
            if (i % step !== 0 && i !== n - 1) return null;
            const cx = PAD.left + i * slotW + slotW / 2;
            return (
              <text key={`x${i}`} x={cx} y={H - 4} textAnchor="middle" fontSize="8" fill="#bbb">
                {labelData(d.data)}
              </text>
            );
          })}

          {/* eixo base */}
          <line x1={PAD.left} y1={PAD.top + iH} x2={W - PAD.right} y2={PAD.top + iH} stroke="#d1cdc7" strokeWidth="1" />
        </svg>
      </div>

      {/* legenda */}
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-[color:var(--moni-text-secondary)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded bg-[#fca5a5]" />
          Abertos por dia
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded bg-[#86efac]" />
          Concluídos por dia
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-blue-500" />
          Acumulado em aberto
        </span>
      </div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function GraficosConteudo({ data }: { data: GraficosData }) {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1200px] space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--moni-text-primary)]">Gráficos</h1>
        <p className="mt-1 text-sm text-[color:var(--moni-text-tertiary)]">
          Visão operacional dos chamados Sirene.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          value={data.semAceite.length}
          label="Sem aceite > 1 dia útil"
          color={data.semAceite.length === 0 ? 'text-green-600' : 'text-red-600'}
        />
        <KpiCard
          value={data.totalAberto}
          label="Total em aberto hoje"
          color="text-amber-600"
        />
        <KpiCard value={data.abriosHoje} label="Abertos hoje" color="text-[color:var(--moni-text-primary)]" />
        <KpiCard value={data.concluidosHoje} label="Concluídos hoje" color="text-green-600" />
      </div>

      {/* Gráfico 1: sem aceite */}
      <GraficoSemAceite rows={data.semAceite} />

      {/* Gráfico 2: por dia */}
      <GraficoPorDia porDia={data.porDia} />
    </div>
  );
}
