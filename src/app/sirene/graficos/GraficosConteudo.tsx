'use client';

import { useState, useMemo, useTransition } from 'react';
import type { GraficosData } from './actions';
import { buscarDadosGraficos } from './actions';

// ─── helpers ─────────────────────────────────────────────────────────────────

function labelData(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function mesLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function badgeDu(du: number) {
  if (du <= 1) return { bg: 'border-amber-200 bg-amber-50 text-amber-700', label: `${du} d.u.` };
  if (du <= 3) return { bg: 'border-orange-200 bg-orange-50 text-orange-700', label: `${du} d.u.` };
  return { bg: 'border-red-200 bg-red-50 text-red-800', label: `${du} d.u.` };
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

// ─── Seletor de mês ───────────────────────────────────────────────────────────

function MesSeletor({
  meses,
  value,
  onChange,
}: {
  meses: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[color:var(--moni-text-tertiary)]">Mês</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1 text-xs text-[color:var(--moni-text-secondary)]"
      >
        {[...meses].reverse().map((m) => (
          <option key={m} value={m}>{mesLabel(m)}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Gráfico SVG genérico de barras lado-a-lado + linha ─────────────────────

type BarSerie = { label: string; color: string; values: number[] };
type LineSerie = { label: string; color: string; values: number[]; suffix?: string };

function GraficoBarras({
  dias,
  barras,
  linhas,
  altura = 200,
}: {
  dias: string[];
  barras: BarSerie[];
  linhas?: LineSerie[];
  altura?: number;
}) {
  const W = 600;
  const H = altura;
  const PAD = { top: 24, right: linhas && linhas.length > 0 ? 40 : 20, bottom: 30, left: 32 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;
  const n = dias.length;
  if (n === 0) return <p className="py-6 text-center text-sm text-[color:var(--moni-text-tertiary)]">Sem dados neste período.</p>;

  const allBarVals = barras.flatMap((s) => s.values);
  const maxBar = Math.max(...allBarVals, 1);
  const slotW = iW / n;
  const bW = Math.min(slotW / (barras.length + 0.5), 14);

  const yBar = (v: number) => PAD.top + iH - (v / maxBar) * iH;

  // linha(s)
  const maxLine = linhas && linhas.length > 0
    ? Math.max(...linhas.flatMap((l) => l.values), 1)
    : 1;
  const yLine = (v: number) => PAD.top + iH - (v / maxLine) * iH;

  const gridVals = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
        {/* grid */}
        {gridVals.map((f) => {
          const y = PAD.top + iH * (1 - f);
          const val = Math.round(maxBar * f);
          return (
            <g key={f}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e8e5e0" strokeWidth="1" />
              <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#bbb">{val}</text>
            </g>
          );
        })}

        {/* eixo y direito para linha */}
        {linhas && linhas.length > 0 && [0, 0.5, 1].map((f) => {
          const y = PAD.top + iH * (1 - f);
          const val = Math.round(maxLine * f);
          const suffix = linhas[0]?.suffix ?? '';
          return (
            <text key={`r${f}`} x={W - PAD.right + 4} y={y + 4} textAnchor="start" fontSize="9" fill={linhas[0]?.color ?? '#3b82f6'}>{val}{suffix}</text>
          );
        })}

        {/* barras */}
        {dias.map((d, i) => {
          const cx = PAD.left + i * slotW + slotW / 2;
          return (
            <g key={d}>
              {barras.map((serie, si) => {
                const v = serie.values[i] ?? 0;
                const h = (v / maxBar) * iH;
                const x = cx - (barras.length * bW) / 2 + si * bW;
                return (
                  <g key={serie.label}>
                    {v > 0 && (
                      <rect x={x} y={yBar(v)} width={bW - 1} height={h} fill={serie.color} rx="1" />
                    )}
                    {v > 0 && (
                      <text x={x + (bW - 1) / 2} y={yBar(v) - 2} textAnchor="middle" fontSize="7" fill="#555">{v}</text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* linha(s) */}
        {linhas?.map((l) => {
          const points = l.values
            .map((v, i) => {
              const cx = PAD.left + i * slotW + slotW / 2;
              return `${cx},${yLine(v)}`;
            })
            .join(' ');
          return (
            <g key={l.label}>
              <polyline points={points} fill="none" stroke={l.color} strokeWidth="2" strokeLinejoin="round" />
              {l.values.length > 0 && (
                <>
                  <circle cx={PAD.left + 0 * slotW + slotW / 2} cy={yLine(l.values[0] ?? 0)} r="3" fill={l.color} />
                  <circle cx={PAD.left + (n - 1) * slotW + slotW / 2} cy={yLine(l.values[n - 1] ?? 0)} r="3" fill={l.color} />
                  <text
                    x={PAD.left + (n - 1) * slotW + slotW / 2 + 5}
                    y={yLine(l.values[n - 1] ?? 0) + 4}
                    fontSize="9" fill={l.color} fontWeight="bold"
                  >
                    {l.values[n - 1]}{l.suffix ?? ''}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* eixo x */}
        {dias.map((d, i) => {
          const step = Math.max(1, Math.floor(n / 7));
          if (i % step !== 0 && i !== n - 1) return null;
          const cx = PAD.left + i * slotW + slotW / 2;
          return (
            <text key={`x${i}`} x={cx} y={H - 4} textAnchor="middle" fontSize="8" fill="#bbb">
              {labelData(d)}
            </text>
          );
        })}

        <line x1={PAD.left} y1={PAD.top + iH} x2={W - PAD.right} y2={PAD.top + iH} stroke="#d1cdc7" strokeWidth="1" />
      </svg>
    </div>
  );
}

// ─── Seção: chamados sem aceite ──────────────────────────────────────────────

function SemAceiteSection({ rows }: { rows: GraficosData['semAceite'] }) {
  const [mostrarArquivados, setMostrarArquivados] = useState(false);

  const totalArquivados = rows.filter((r) => r.arquivado).length;
  const filtered = useMemo(() => {
    const list = mostrarArquivados ? rows : rows.filter((r) => !r.arquivado);
    return [...list].sort((a, b) => b.dias_uteis - a.dias_uteis);
  }, [rows, mostrarArquivados]);

  const semAceite1du = filtered.filter((r) => r.dias_uteis >= 1);
  const total = semAceite1du.length;

  const f1 = semAceite1du.filter((r) => r.dias_uteis === 1).length;
  const f2 = semAceite1du.filter((r) => r.dias_uteis === 2).length;
  const f3 = semAceite1du.filter((r) => r.dias_uteis >= 3 && r.dias_uteis <= 5).length;
  const f5 = semAceite1du.filter((r) => r.dias_uteis > 5).length;

  return (
    <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
      <div className="mb-1 font-semibold text-[color:var(--moni-text-primary)]">
        Chamados sem aceite há mais de 1 dia útil
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-xs text-[color:var(--moni-text-tertiary)]">Finais de semana e feriados nacionais não contam — meta: 0</span>
        {totalArquivados > 0 && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[color:var(--moni-text-tertiary)]">
            <input
              type="checkbox"
              checked={mostrarArquivados}
              onChange={(e) => setMostrarArquivados(e.target.checked)}
              className="h-3 w-3 rounded"
            />
            Mostrar arquivados ({totalArquivados})
          </label>
        )}
      </div>

      <div className="mb-5 flex items-center gap-5">
        <div>
          <span className={`text-5xl font-bold ${total === 0 ? 'text-green-600' : 'text-red-600'}`}>{total}</span>
          <div className="mt-0.5 text-[11px] text-[color:var(--moni-text-tertiary)]">chamados</div>
        </div>
        <div className="flex-1">
          <div className="mb-1 text-xs text-[color:var(--moni-text-secondary)]">Meta: 0 | Atual: {total}</div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--moni-surface-100)]">
            <div className={`h-2 rounded-full ${total === 0 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: total === 0 ? '4px' : '100%' }} />
          </div>
        </div>
      </div>

      {total > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {f1 > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center"><div className="text-lg font-bold text-amber-700">{f1}</div><div className="text-[10px] text-amber-600">1 d.u.</div></div>}
          {f2 > 0 && <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-center"><div className="text-lg font-bold text-orange-700">{f2}</div><div className="text-[10px] text-orange-600">2 d.u.</div></div>}
          {f3 > 0 && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center"><div className="text-lg font-bold text-red-700">{f3}</div><div className="text-[10px] text-red-600">3–5 d.u.</div></div>}
          {f5 > 0 && <div className="rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-center"><div className="text-lg font-bold text-red-900">{f5}</div><div className="text-[10px] text-red-700">+5 d.u.</div></div>}
        </div>
      )}

      {/* Lista completa */}
      <div className="max-h-72 overflow-y-auto rounded-lg border border-[color:var(--moni-border-default)]">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-6">
            <span className="text-sm font-medium text-green-700">✓ Todos os chamados foram aceitos a tempo</span>
          </div>
        ) : (
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
              {filtered.map((r) => {
                const badge = r.dias_uteis >= 1 ? badgeDu(r.dias_uteis) : null;
                return (
                  <tr key={r.id} className={`border-b border-[color:var(--moni-border-default)] last:border-b-0 hover:bg-[var(--moni-surface-50)] ${r.arquivado ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-1.5 font-mono text-[color:var(--moni-text-tertiary)]">#{String(r.numero).padStart(4, '0')}</td>
                    <td className="max-w-[180px] truncate px-3 py-1.5 text-[color:var(--moni-text-primary)]">
                      {r.arquivado && <span className="mr-1 rounded border border-amber-200 bg-amber-50 px-1 text-[9px] text-amber-700">Arq</span>}
                      {r.titulo ?? '(sem título)'}
                    </td>
                    <td className="px-3 py-1.5 text-[color:var(--moni-text-secondary)]">{r.aberto_por_nome ?? '—'}</td>
                    <td className="px-3 py-1.5 text-[color:var(--moni-text-secondary)]">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</td>
                    <td className="px-3 py-1.5 text-right">
                      {badge ? (
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${badge.bg}`}>{badge.label}</span>
                      ) : (
                        <span className="text-[10px] text-[color:var(--moni-text-tertiary)]">hoje</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function GraficosConteudo({
  initialData,
  initialMes,
}: {
  initialData: GraficosData;
  initialMes: string;
}) {
  const [data, setData] = useState<GraficosData>(initialData);
  const [mesSelecionado, setMesSelecionado] = useState(initialMes);
  const [isPending, startTransition] = useTransition();

  function onMesChange(m: string) {
    setMesSelecionado(m);
    startTransition(async () => {
      const res = await buscarDadosGraficos(m);
      if (res.ok) setData(res.data);
    });
  }

  const dias = data.porDia.map((d) => d.data);

  return (
    <div className={`mx-auto w-full min-w-0 max-w-[1200px] space-y-6 px-6 py-8 transition-opacity ${isPending ? 'opacity-60 pointer-events-none' : ''}`}>
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--moni-text-primary)]">Gráficos</h1>
        <p className="mt-1 text-sm text-[color:var(--moni-text-tertiary)]">Visão operacional dos chamados Sirene.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard value={data.semAceite.filter((r) => !r.arquivado && r.dias_uteis >= 1).length} label="Sem aceite > 1 dia útil" color={data.semAceite.filter((r) => !r.arquivado && r.dias_uteis >= 1).length === 0 ? 'text-green-600' : 'text-red-600'} />
        <KpiCard value={data.totalAberto} label="Total em aberto hoje" color="text-amber-600" />
        <KpiCard value={data.abriosHoje} label="Abertos hoje" color="text-[color:var(--moni-text-primary)]" />
        <KpiCard value={data.concluidosHoje} label="Concluídos hoje" color="text-green-600" />
      </div>

      {/* Sem aceite */}
      <SemAceiteSection rows={data.semAceite} />

      {/* Filtro de mês (compartilhado pelos dois gráficos abaixo) */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[color:var(--moni-text-primary)]">Métricas do período</h2>
        <MesSeletor meses={data.mesesDisponiveis} value={mesSelecionado} onChange={onMesChange} />
      </div>

      {/* Gráfico: Chamados abertos/concluídos/acumulado */}
      <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
        <div className="mb-1 font-semibold text-[color:var(--moni-text-primary)]">Chamados por dia — {mesLabel(mesSelecionado)}</div>
        <div className="mb-4 text-xs text-[color:var(--moni-text-tertiary)]">Barras: abertos e concluídos por dia · Linha: acumulado em aberto</div>
        <GraficoBarras
          dias={dias}
          barras={[
            { label: 'Abertos', color: '#fca5a5', values: data.porDia.map((d) => d.abertos) },
            { label: 'Concluídos', color: '#86efac', values: data.porDia.map((d) => d.concluidos) },
          ]}
          linhas={[
            { label: 'Acumulado', color: '#3b82f6', values: data.porDia.map((d) => d.acumulado) },
          ]}
        />
        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-[color:var(--moni-text-secondary)]">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded bg-[#fca5a5]" />Abertos por dia</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded bg-[#86efac]" />Concluídos por dia</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-blue-500" />Acumulado em aberto</span>
        </div>
      </div>

      {/* Gráfico: SLA de aceite das atividades */}
      <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
        <div className="mb-1 font-semibold text-[color:var(--moni-text-primary)]">SLA de aceite das atividades — {mesLabel(mesSelecionado)}</div>
        <div className="mb-4 text-xs text-[color:var(--moni-text-tertiary)]">Meta: aceite em até 24h úteis (exclui fins de semana e feriados nacionais) · Linha: % dentro do objetivo</div>
        {data.slaPorDia.every((d) => d.dentro === 0 && d.fora === 0) ? (
          <p className="py-6 text-center text-sm text-[color:var(--moni-text-tertiary)]">Nenhuma atividade com atribuição neste período — coluna <code>atribuicao_aceito_em</code> ainda sem dados históricos suficientes.</p>
        ) : (
          <GraficoBarras
            dias={dias}
            barras={[
              { label: 'Dentro do prazo', color: '#86efac', values: data.slaPorDia.map((d) => d.dentro) },
              { label: 'Fora do prazo', color: '#fca5a5', values: data.slaPorDia.map((d) => d.fora) },
            ]}
            linhas={[
              { label: '% no prazo', color: '#8b5cf6', values: data.slaPorDia.map((d) => d.pct), suffix: '%' },
            ]}
            altura={200}
          />
        )}
        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-[color:var(--moni-text-secondary)]">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded bg-[#86efac]" />Dentro de 24h úteis</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded bg-[#fca5a5]" />Fora de 24h úteis</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 bg-purple-500" />% dentro do objetivo</span>
        </div>
      </div>

      {/* Tabela: SLA por responsável */}
      {data.slaResponsaveis.length > 0 && (
        <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
          <div className="mb-1 font-semibold text-[color:var(--moni-text-primary)]">Tempo de aceite por responsável</div>
          <div className="mb-4 text-xs text-[color:var(--moni-text-tertiary)]">Todos os períodos · ordenado por total de atividades</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)]">
                  <th className="px-3 py-2 text-left font-semibold text-[color:var(--moni-text-secondary)]">Responsável</th>
                  <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">Total</th>
                  <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">✓ Dentro</th>
                  <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">✗ Fora</th>
                  <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">⏳ Pendente</th>
                  <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">% objetivo</th>
                  <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">Média aceite</th>
                </tr>
              </thead>
              <tbody>
                {data.slaResponsaveis.map((r) => {
                  const aceitos = r.dentro + r.fora;
                  const pct = aceitos > 0 ? Math.round((r.dentro / aceitos) * 100) : null;
                  return (
                    <tr key={r.responsavel_id} className="border-b border-[color:var(--moni-border-default)] last:border-b-0 hover:bg-[var(--moni-surface-50)]">
                      <td className="px-3 py-2 font-medium text-[color:var(--moni-text-primary)]">{r.nome}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[color:var(--moni-text-secondary)]">{r.total}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-green-700">{r.dentro}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600">{r.fora}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-600">{r.pendente}</td>
                      <td className="px-3 py-2 text-right">
                        {pct !== null ? (
                          <span className={`font-semibold ${pct >= 80 ? 'text-green-700' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[color:var(--moni-text-secondary)]">
                        {r.media_horas !== null ? `${r.media_horas}h úteis` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
