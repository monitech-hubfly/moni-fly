'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import type { GraficosData } from './actions';
import { buscarDadosGraficos } from './actions';
import { registerDashboardCharts } from '@/lib/charts/registerCharts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function labelData(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function mesLabel(ym: string): string {
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

const CHART_FONT = "'Inter', sans-serif";

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { font: { family: CHART_FONT, size: 11 }, color: 'rgba(44,44,42,0.7)', boxWidth: 12, padding: 16 } },
    tooltip: { titleFont: { family: CHART_FONT, size: 11 }, bodyFont: { family: CHART_FONT, size: 11 } },
  },
  scales: {
    x: { ticks: { font: { family: CHART_FONT, size: 10 }, color: 'rgba(44,44,42,0.5)' }, grid: { color: 'rgba(0,0,0,0.04)' } },
    y: { ticks: { font: { family: CHART_FONT, size: 10 }, color: 'rgba(44,44,42,0.5)' }, grid: { color: 'rgba(0,0,0,0.04)' } },
  },
};

// Cores alinhadas ao design system Moní (sem laranja)
const C = {
  navy:        'rgba(12, 38, 51, 0.85)',
  navyLight:   'rgba(12, 38, 51, 0.15)',
  green:       'rgba(47, 74, 58, 0.85)',
  greenLight:  'rgba(47, 74, 58, 0.15)',
  gold:        'rgba(212, 173, 104, 0.85)',
  goldLight:   'rgba(212, 173, 104, 0.20)',
  red:         'rgba(180, 60, 60, 0.80)',
  redLight:    'rgba(180, 60, 60, 0.12)',
  slate:       'rgba(90, 108, 136, 0.80)',
  slateLight:  'rgba(90, 108, 136, 0.12)',
  purple:      'rgba(120, 90, 160, 0.80)',
  purpleLight: 'rgba(120, 90, 160, 0.12)',
  teal:        'rgba(42, 120, 138, 0.80)',
  tealLight:   'rgba(42, 120, 138, 0.12)',
};

// Paleta sequencial para múltiplas séries (funis, áreas)
const PALETTE_SEQ = [C.navy, C.green, C.gold, C.slate, C.purple, C.teal, C.red,
  'rgba(160,120,80,0.80)', 'rgba(80,130,100,0.80)', 'rgba(100,80,140,0.80)'];

// ─── Componentes de UI base ───────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-1 text-base font-semibold text-[color:var(--moni-text-primary)]">
      {children}
    </h2>
  );
}

function SectionSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-xs text-[color:var(--moni-text-tertiary)]">{children}</p>
  );
}

function ChartCard({ title, subtitle, height = 220, children }: {
  title: string; subtitle?: string; height?: number; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
      <div className="mb-0.5 text-sm font-semibold text-[color:var(--moni-text-primary)]">{title}</div>
      {subtitle && <div className="mb-3 text-[11px] text-[color:var(--moni-text-tertiary)]">{subtitle}</div>}
      <div style={{ height }}>{children}</div>
    </div>
  );
}

function KpiCard({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
      <div className={`text-3xl font-bold tabular-nums ${color ?? 'text-[color:var(--moni-text-primary)]'}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-[color:var(--moni-text-tertiary)]">{label}</div>
    </div>
  );
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--moni-surface-100)]">
        <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="min-w-[30px] text-right text-[11px] font-semibold tabular-nums" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

function SlaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[11px] text-[color:var(--moni-text-tertiary)]">—</span>;
  const cls = pct >= 80 ? 'text-green-700 bg-green-50 border-green-200'
    : pct >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-red-700 bg-red-50 border-red-200';
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{pct}%</span>
  );
}

function DiasBadge({ dias }: { dias: number }) {
  const cls = dias > 30 ? 'text-red-700 bg-red-50 border-red-200'
    : dias > 7 ? 'text-amber-700 bg-amber-50 border-amber-200'
    : 'text-[color:var(--moni-text-secondary)] bg-[var(--moni-surface-50)] border-[color:var(--moni-border-default)]';
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${cls}`}>{dias} d.u.</span>
  );
}

function MesSeletor({ meses, value, onChange }: {
  meses: string[]; value: string; onChange: (v: string) => void;
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

// ─── Seção: KPIs do dia ───────────────────────────────────────────────────────

function KpisSection({ data, mediaAceite }: { data: GraficosData; mediaAceite: number | null }) {
  const diff = data.concluidosHoje - data.abriosHoje;
  const diffLabel = diff > 0 ? `+${diff} resolvidos` : diff < 0 ? `${diff} acumulados` : 'Neutro';
  const diffColor = diff > 0 ? 'text-green-700' : diff < 0 ? 'text-red-600' : 'text-amber-600';
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
      <KpiCard value={data.abriosHoje} label="Abertos hoje" />
      <KpiCard value={data.concluidosHoje} label="Concluídos hoje" color="text-green-700" />
      <KpiCard value={diffLabel} label="Saldo do dia" color={diffColor} />
      <KpiCard value={data.totalAberto} label="Total em aberto" color={data.totalAberto > 80 ? 'text-amber-600' : undefined} />
      <KpiCard
        value={mediaAceite !== null ? `${mediaAceite}h` : '—'}
        label="Média de aceite (h úteis)"
      />
    </div>
  );
}

// ─── Seção: Chamados sem aceite ───────────────────────────────────────────────

function SemAceiteSection({ rows }: { rows: GraficosData['semAceite'] }) {
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const totalArquivados = rows.filter((r) => r.arquivado).length;
  const filtered = useMemo(() => {
    const list = mostrarArquivados ? rows : rows.filter((r) => !r.arquivado);
    return [...list].sort((a, b) => b.dias_uteis - a.dias_uteis);
  }, [rows, mostrarArquivados]);
  const ativos = filtered.filter((r) => !r.arquivado && r.dias_uteis >= 1);
  const f1  = ativos.filter((r) => r.dias_uteis === 1).length;
  const f2  = ativos.filter((r) => r.dias_uteis === 2).length;
  const f35 = ativos.filter((r) => r.dias_uteis >= 3 && r.dias_uteis <= 5).length;
  const f5p = ativos.filter((r) => r.dias_uteis > 5).length;
  const total = ativos.length;

  return (
    <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="font-semibold text-[color:var(--moni-text-primary)]">Chamados sem aceite</span>
        <span className="text-xs text-[color:var(--moni-text-tertiary)]">Meta: 0 · Finais de semana e feriados não contam</span>
        <div className="flex-1" />
        {totalArquivados > 0 && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[color:var(--moni-text-tertiary)]">
            <input type="checkbox" checked={mostrarArquivados} onChange={(e) => setMostrarArquivados(e.target.checked)} className="h-3 w-3 rounded" />
            Mostrar arquivados ({totalArquivados})
          </label>
        )}
      </div>

      {/* Contadores de urgência */}
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <span className={`text-5xl font-bold tabular-nums ${total === 0 ? 'text-green-600' : 'text-red-600'}`}>{total}</span>
          <div className="mt-0.5 text-[11px] text-[color:var(--moni-text-tertiary)]">chamados</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {f1  > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-center"><div className="text-lg font-bold text-amber-700">{f1}</div><div className="text-[10px] text-amber-600">1 d.u.</div></div>}
          {f2  > 0 && <div className="rounded-lg border border-amber-300 bg-amber-100 px-3 py-1.5 text-center"><div className="text-lg font-bold text-amber-800">{f2}</div><div className="text-[10px] text-amber-700">2 d.u.</div></div>}
          {f35 > 0 && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-center"><div className="text-lg font-bold text-red-700">{f35}</div><div className="text-[10px] text-red-600">3–5 d.u.</div></div>}
          {f5p > 0 && <div className="rounded-lg border border-red-300 bg-red-100 px-3 py-1.5 text-center"><div className="text-lg font-bold text-red-900">{f5p}</div><div className="text-[10px] text-red-700">+5 d.u.</div></div>}
        </div>
        {total > 0 && (
          <div className="min-w-[160px] flex-1">
            <div className="mb-1 text-xs text-[color:var(--moni-text-secondary)]">Meta: 0 | Atual: {total}</div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--moni-surface-100)]">
              <div className="h-1.5 rounded-full bg-red-500" style={{ width: '100%' }} />
            </div>
          </div>
        )}
      </div>

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
              {filtered.map((r) => (
                <tr key={r.id} className={`border-b border-[color:var(--moni-border-default)] last:border-b-0 hover:bg-[var(--moni-surface-50)] ${r.arquivado ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-1.5 font-mono text-[color:var(--moni-text-tertiary)]">#{String(r.numero).padStart(4, '0')}</td>
                  <td className="max-w-[200px] truncate px-3 py-1.5 text-[color:var(--moni-text-primary)]">
                    {r.arquivado && <span className="mr-1 rounded border border-amber-200 bg-amber-50 px-1 text-[9px] text-amber-700">Arq</span>}
                    {r.titulo ?? '(sem título)'}
                  </td>
                  <td className="px-3 py-1.5 text-[color:var(--moni-text-secondary)]">{r.aberto_por_nome ?? '—'}</td>
                  <td className="px-3 py-1.5 text-[color:var(--moni-text-secondary)]">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</td>
                  <td className="px-3 py-1.5 text-right"><DiasBadge dias={r.dias_uteis} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Seção: Fluxo do mês ─────────────────────────────────────────────────────

function FluxoSection({ data, mes }: { data: GraficosData; mes: string }) {
  const labels = data.porDia.map((d) => labelData(d.data));

  const barData = {
    labels,
    datasets: [
      { label: 'Abertos', data: data.porDia.map((d) => d.abertos), backgroundColor: C.red, borderRadius: 3 },
      { label: 'Concluídos', data: data.porDia.map((d) => d.concluidos), backgroundColor: C.green, borderRadius: 3 },
    ],
  };

  const lineData = {
    labels,
    datasets: [{
      label: 'Acumulado em aberto',
      data: data.porDia.map((d) => d.acumulado),
      borderColor: C.navy,
      backgroundColor: C.navyLight,
      fill: true,
      tension: 0.3,
      pointRadius: 3,
    }],
  };

  const barOpts = {
    ...CHART_DEFAULTS,
    plugins: {
      ...CHART_DEFAULTS.plugins,
      legend: { ...CHART_DEFAULTS.plugins.legend, position: 'bottom' as const },
    },
  };

  const lineOpts = {
    ...CHART_DEFAULTS,
    plugins: {
      ...CHART_DEFAULTS.plugins,
      legend: { display: false },
    },
    scales: {
      ...CHART_DEFAULTS.scales,
      y: { ...CHART_DEFAULTS.scales.y, beginAtZero: false },
    },
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <SectionTitle>Fluxo de chamados — {mesLabel(mes)}</SectionTitle>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <ChartCard title="Abertos e concluídos por dia" subtitle="Barras agrupadas por dia do mês" height={220}>
          <Bar data={barData} options={barOpts} />
        </ChartCard>
        <ChartCard title="Acumulado em aberto" subtitle="Evolução do estoque de chamados não concluídos" height={220}>
          <Line data={lineData} options={lineOpts} />
        </ChartCard>
      </div>
    </div>
  );
}

// ─── Seção: SLA de aceite ─────────────────────────────────────────────────────

function SlaSection({ data, mes }: { data: GraficosData; mes: string }) {
  const labels = data.porDia.map((d) => labelData(d.data));
  const totalDentro = data.slaPorDia.reduce((s, d) => s + d.dentro, 0);
  const totalFora   = data.slaPorDia.reduce((s, d) => s + d.fora, 0);
  const totalAceitos = totalDentro + totalFora;
  const pctMes = totalAceitos > 0 ? Math.round((totalDentro / totalAceitos) * 100) : 100;

  const hasSla = data.slaPorDia.some((d) => d.dentro > 0 || d.fora > 0);

  const doughnutData = {
    labels: ['Dentro de 24h úteis', 'Fora de 24h úteis'],
    datasets: [{
      data: [pctMes, 100 - pctMes],
      backgroundColor: [C.green, C.red],
      borderWidth: 0,
    }],
  };

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { family: CHART_FONT, size: 11 }, color: 'rgba(44,44,42,0.7)', boxWidth: 10, padding: 12 } },
      tooltip: { callbacks: { label: (ctx: { parsed: number }) => ` ${ctx.parsed}%` } },
    },
  };

  const barData = {
    labels,
    datasets: [
      { label: 'Dentro de 24h úteis', data: data.slaPorDia.map((d) => d.dentro), backgroundColor: C.green, borderRadius: 3 },
      { label: 'Fora de 24h úteis',   data: data.slaPorDia.map((d) => d.fora),   backgroundColor: C.red,   borderRadius: 3 },
    ],
  };

  const lineData = {
    labels,
    datasets: [{
      label: '% no prazo',
      data: data.slaPorDia.map((d) => d.pct),
      borderColor: C.purple,
      backgroundColor: C.purpleLight,
      fill: true,
      tension: 0.3,
      pointRadius: 3,
    }],
  };

  const stackedOpts = {
    ...CHART_DEFAULTS,
    plugins: { ...CHART_DEFAULTS.plugins, legend: { ...CHART_DEFAULTS.plugins.legend, position: 'bottom' as const } },
    scales: {
      x: CHART_DEFAULTS.scales.x,
      y: { ...CHART_DEFAULTS.scales.y, stacked: true },
    },
  };

  const lineOpts = {
    ...CHART_DEFAULTS,
    plugins: { ...CHART_DEFAULTS.plugins, legend: { display: false } },
    scales: {
      x: CHART_DEFAULTS.scales.x,
      y: { ...CHART_DEFAULTS.scales.y, min: 0, max: 100, ticks: { ...CHART_DEFAULTS.scales.y.ticks, callback: (v: number | string) => `${v}%` } },
    },
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <SectionTitle>SLA de Aceite — {mesLabel(mes)}</SectionTitle>
        <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${pctMes >= 80 ? 'border-green-200 bg-green-50 text-green-700' : pctMes >= 60 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {pctMes}% no mês
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {/* Donut */}
        <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
          <div className="mb-2 text-sm font-semibold text-[color:var(--moni-text-primary)]">Distribuição mensal</div>
          <div className="mb-4" style={{ height: 160 }}>
            <Doughnut data={doughnutData} options={doughnutOpts} />
          </div>
          <div className="space-y-2 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--moni-text-secondary)]">Dentro do prazo</span>
              <span className="font-semibold text-green-700">{totalDentro} ({pctMes}%)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[color:var(--moni-text-secondary)]">Fora do prazo</span>
              <span className="font-semibold text-red-700">{totalFora}</span>
            </div>
            <div className="border-t border-[color:var(--moni-border-default)] pt-2 flex items-center justify-between">
              <span className="text-[color:var(--moni-text-secondary)]">Meta</span>
              <span className="font-semibold text-[color:var(--moni-text-primary)]">100% em 24h úteis</span>
            </div>
          </div>
        </div>

        {/* Barras empilhadas */}
        <ChartCard
          title="Tópicos aceitos por dia"
          subtitle={hasSla ? undefined : 'Sem dados de aceite neste período'}
          height={hasSla ? 220 : 80}
        >
          {hasSla ? <Bar data={barData} options={stackedOpts} /> : null}
        </ChartCard>

        {/* Linha de % */}
        <ChartCard title="% SLA cumprido por dia" subtitle="Meta: 80%" height={220}>
          <Line data={lineData} options={lineOpts} />
        </ChartCard>
      </div>
    </div>
  );
}

// ─── Seção: Por funil ─────────────────────────────────────────────────────────

function FunilSection({ porFunil, topEtapas }: { porFunil: GraficosData['porFunil']; topEtapas: GraficosData['topEtapas'] }) {
  if (porFunil.length === 0) return null;

  const top = porFunil.slice(0, 10);

  const doughnutData = {
    labels: top.map((f) => f.funil_nome),
    datasets: [{
      data: top.map((f) => f.total),
      backgroundColor: PALETTE_SEQ.slice(0, top.length),
      borderWidth: 0,
    }],
  };

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { family: CHART_FONT, size: 10 }, color: 'rgba(44,44,42,0.7)', boxWidth: 10, padding: 8 } },
    },
  };

  const hBarData = {
    labels: top.map((f) => f.funil_nome),
    datasets: [
      { label: 'Em aberto',  data: top.map((f) => f.abertos),    backgroundColor: C.gold,  borderRadius: 3 },
      { label: 'Concluídos', data: top.map((f) => f.concluidos), backgroundColor: C.green, borderRadius: 3 },
    ],
  };

  const hBarOpts = {
    ...CHART_DEFAULTS,
    indexAxis: 'y' as const,
    plugins: { ...CHART_DEFAULTS.plugins, legend: { ...CHART_DEFAULTS.plugins.legend, position: 'bottom' as const } },
    scales: {
      x: CHART_DEFAULTS.scales.x,
      y: { ticks: { font: { family: CHART_FONT, size: 10 }, color: 'rgba(44,44,42,0.6)' }, grid: { display: false } },
    },
  };

  // Top etapas
  const topEtapasBar = {
    labels: topEtapas.map((e) => `${e.etapa_nome} (${e.funil_nome.replace('Funil ', '')})`),
    datasets: [
      { label: 'Total',     data: topEtapas.map((e) => e.total),   backgroundColor: C.navy,  borderRadius: 3 },
      { label: 'Em aberto', data: topEtapas.map((e) => e.abertos), backgroundColor: C.gold,  borderRadius: 3 },
    ],
  };

  const topEtapasOpts = {
    ...CHART_DEFAULTS,
    indexAxis: 'y' as const,
    plugins: { ...CHART_DEFAULTS.plugins, legend: { ...CHART_DEFAULTS.plugins.legend, position: 'bottom' as const } },
    scales: {
      x: CHART_DEFAULTS.scales.x,
      y: { ticks: { font: { family: CHART_FONT, size: 10 }, color: 'rgba(44,44,42,0.6)' }, grid: { display: false } },
    },
  };

  const totalChamados = porFunil.reduce((s, f) => s + f.total, 0);

  return (
    <div>
      <SectionTitle>Análise por funil</SectionTitle>
      <SectionSubtitle>
        {totalChamados} chamados vinculados a funis via kanban · quais funis e etapas geram mais atrito
      </SectionSubtitle>

      {/* Linha 1: donut + barras horizontais */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-5">
        <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
          <div className="mb-2 text-sm font-semibold text-[color:var(--moni-text-primary)]">Distribuição por funil</div>
          <div style={{ height: 220 }}>
            <Doughnut data={doughnutData} options={doughnutOpts} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <ChartCard
            title="Volume por funil — abertos vs concluídos"
            subtitle="Ordenado pelo maior volume total"
            height={Math.max(200, top.length * 28)}
          >
            <Bar data={hBarData} options={hBarOpts} />
          </ChartCard>
        </div>
      </div>

      {/* Top etapas */}
      {topEtapas.length > 0 && (
        <div className="mb-5">
          <ChartCard
            title="Top etapas que mais geram chamados"
            subtitle="Fase atual do card vinculado ao chamado"
            height={Math.max(200, topEtapas.length * 28)}
          >
            <Bar data={topEtapasBar} options={topEtapasOpts} />
          </ChartCard>
        </div>
      )}

      {/* Tabela de funis */}
      <div className="overflow-x-auto rounded-xl border border-[color:var(--moni-border-default)]">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)]">
              <th className="px-3 py-2 text-left font-semibold text-[color:var(--moni-text-secondary)]">Funil</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">Total</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">Em aberto</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">Concluídos</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">% Resolvidos</th>
            </tr>
          </thead>
          <tbody>
            {porFunil.map((f) => {
              const pctResolvido = f.total > 0 ? Math.round((f.concluidos / f.total) * 100) : 0;
              return (
                <tr key={f.funil_id} className="border-b border-[color:var(--moni-border-default)] last:border-b-0 hover:bg-[var(--moni-surface-50)]">
                  <td className="px-3 py-2 font-medium text-[color:var(--moni-text-primary)]">{f.funil_nome}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[color:var(--moni-text-secondary)]">{f.total}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-700">{f.abertos}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-green-700">{f.concluidos}</td>
                  <td className="px-3 py-2">
                    <MiniBar pct={pctResolvido} color={pctResolvido >= 60 ? C.green : C.gold} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Seção: Por área ──────────────────────────────────────────────────────────

function AreaSection({ porArea }: { porArea: GraficosData['porArea'] }) {
  if (porArea.length === 0) return null;

  const top = porArea.slice(0, 10);

  const doughnutData = {
    labels: top.map((a) => a.time),
    datasets: [{
      data: top.map((a) => a.total),
      backgroundColor: PALETTE_SEQ.slice(0, top.length),
      borderWidth: 0,
    }],
  };

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { family: CHART_FONT, size: 10 }, color: 'rgba(44,44,42,0.7)', boxWidth: 10, padding: 8 } },
    },
  };

  const hBarData = {
    labels: top.map((a) => a.time),
    datasets: [
      { label: 'Dentro SLA', data: top.map((a) => a.dentro),   backgroundColor: C.green,  borderRadius: 3 },
      { label: 'Fora SLA',   data: top.map((a) => a.fora),     backgroundColor: C.red,    borderRadius: 3 },
      { label: 'Pendente',   data: top.map((a) => a.pendente), backgroundColor: C.gold,   borderRadius: 3 },
    ],
  };

  const hBarOpts = {
    ...CHART_DEFAULTS,
    indexAxis: 'y' as const,
    plugins: { ...CHART_DEFAULTS.plugins, legend: { ...CHART_DEFAULTS.plugins.legend, position: 'bottom' as const } },
    scales: {
      x: { ...CHART_DEFAULTS.scales.x, stacked: true },
      y: { ticks: { font: { family: CHART_FONT, size: 10 }, color: 'rgba(44,44,42,0.6)' }, grid: { display: false }, stacked: true },
    },
  };

  return (
    <div>
      <SectionTitle>Análise por área</SectionTitle>
      <SectionSubtitle>
        Agrupado pelo campo <strong>time</strong> do perfil — mesmo critério do Boné Day.
        Métricas sobre tópicos (atividades) atribuídos a cada área.
      </SectionSubtitle>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-5">
        <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
          <div className="mb-2 text-sm font-semibold text-[color:var(--moni-text-primary)]">Tópicos por área</div>
          <div style={{ height: 220 }}>
            <Doughnut data={doughnutData} options={doughnutOpts} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <ChartCard
            title="SLA por área — dentro / fora / pendente"
            subtitle="Tópicos atribuídos a cada time"
            height={Math.max(200, top.length * 32)}
          >
            <Bar data={hBarData} options={hBarOpts} />
          </ChartCard>
        </div>
      </div>

      {/* Tabela por área */}
      <div className="overflow-x-auto rounded-xl border border-[color:var(--moni-border-default)]">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)]">
              <th className="px-3 py-2 text-left font-semibold text-[color:var(--moni-text-secondary)]">Área (time)</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">Tópicos</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">Dentro SLA</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">Fora SLA</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">Pendente</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">Média aceite</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">% SLA</th>
              <th className="px-3 py-2 text-left font-semibold text-[color:var(--moni-text-secondary)]">Saúde</th>
            </tr>
          </thead>
          <tbody>
            {porArea.map((a) => (
              <tr key={a.time} className="border-b border-[color:var(--moni-border-default)] last:border-b-0 hover:bg-[var(--moni-surface-50)]">
                <td className="px-3 py-2 font-medium text-[color:var(--moni-text-primary)]">{a.time}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[color:var(--moni-text-secondary)]">{a.total}</td>
                <td className="px-3 py-2 text-right tabular-nums text-green-700">{a.dentro}</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-600">{a.fora}</td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-600">{a.pendente}</td>
                <td className="px-3 py-2 text-right tabular-nums text-[color:var(--moni-text-secondary)]">
                  {a.media_horas !== null ? `${a.media_horas}h úteis` : '—'}
                </td>
                <td className="px-3 py-2 text-right"><SlaBadge pct={a.sla_pct} /></td>
                <td className="px-3 py-2 min-w-[100px]">
                  {a.sla_pct !== null ? (
                    <MiniBar pct={a.sla_pct} color={a.sla_pct >= 80 ? C.green : a.sla_pct >= 60 ? C.gold : C.red} />
                  ) : <span className="text-[color:var(--moni-text-tertiary)]">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Seção: Responsáveis ──────────────────────────────────────────────────────

function ResponsaveisSection({ slaResponsaveis }: { slaResponsaveis: GraficosData['slaResponsaveis'] }) {
  if (slaResponsaveis.length === 0) return null;
  return (
    <div>
      <SectionTitle>Desempenho por responsável</SectionTitle>
      <SectionSubtitle>Todos os tópicos não arquivados · ordenado por total de atribuições</SectionSubtitle>
      <div className="overflow-x-auto rounded-xl border border-[color:var(--moni-border-default)]">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)]">
              <th className="px-3 py-2 text-left font-semibold text-[color:var(--moni-text-secondary)]">Responsável</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">Total</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">Dentro</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">Fora</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">Pendente</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">% SLA</th>
              <th className="px-3 py-2 text-right font-semibold text-[color:var(--moni-text-secondary)]">Média aceite</th>
              <th className="px-3 py-2 text-left font-semibold text-[color:var(--moni-text-secondary)]">Desempenho</th>
            </tr>
          </thead>
          <tbody>
            {slaResponsaveis.map((r) => {
              const aceitos = r.dentro + r.fora;
              const pct = aceitos > 0 ? Math.round((r.dentro / aceitos) * 100) : null;
              const barColor = pct !== null
                ? (pct >= 80 ? C.green : pct >= 60 ? C.gold : C.red)
                : 'rgba(0,0,0,0.1)';
              return (
                <tr key={r.responsavel_id} className="border-b border-[color:var(--moni-border-default)] last:border-b-0 hover:bg-[var(--moni-surface-50)]">
                  <td className="px-3 py-2 font-medium text-[color:var(--moni-text-primary)]">{r.nome}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[color:var(--moni-text-secondary)]">{r.total}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-green-700">{r.dentro}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600">{r.fora}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-600">{r.pendente}</td>
                  <td className="px-3 py-2 text-right"><SlaBadge pct={pct} /></td>
                  <td className="px-3 py-2 text-right tabular-nums text-[color:var(--moni-text-secondary)]">
                    {r.media_horas !== null ? `${r.media_horas}h úteis` : '—'}
                  </td>
                  <td className="px-3 py-2 min-w-[100px]">
                    {pct !== null ? <MiniBar pct={pct} color={barColor} /> : <span className="text-[color:var(--moni-text-tertiary)]">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

  useEffect(() => {
    registerDashboardCharts();
  }, []);

  function onMesChange(m: string) {
    setMesSelecionado(m);
    startTransition(async () => {
      const res = await buscarDadosGraficos(m);
      if (res.ok) setData(res.data);
    });
  }

  return (
    <div className={`mx-auto w-full min-w-0 max-w-[1200px] space-y-8 px-6 py-8 transition-opacity ${isPending ? 'pointer-events-none opacity-60' : ''}`}>

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--moni-text-primary)]">Gráficos</h1>
          <p className="mt-1 text-sm text-[color:var(--moni-text-tertiary)]">Visão executiva dos chamados Sirene.</p>
        </div>
        <div className="flex-1" />
        <MesSeletor meses={data.mesesDisponiveis} value={mesSelecionado} onChange={onMesChange} />
      </div>

      {/* KPIs do dia */}
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[color:var(--moni-text-tertiary)]">
          Hoje — {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
        </p>
        <KpisSection data={data} mediaAceite={data.mediaAceiteHoras} />
      </div>

      {/* Sem aceite */}
      <SemAceiteSection rows={data.semAceite} />

      {/* Separador */}
      <div className="border-t border-[color:var(--moni-border-default)]" />

      {/* Fluxo do mês */}
      <FluxoSection data={data} mes={mesSelecionado} />

      {/* SLA */}
      <SlaSection data={data} mes={mesSelecionado} />

      {/* Separador */}
      <div className="border-t border-[color:var(--moni-border-default)]" />

      {/* Por funil */}
      <FunilSection porFunil={data.porFunil} topEtapas={data.topEtapas} />

      {/* Separador */}
      {data.porFunil.length > 0 && <div className="border-t border-[color:var(--moni-border-default)]" />}

      {/* Por área */}
      <AreaSection porArea={data.porArea} />

      {/* Separador */}
      {data.porArea.length > 0 && <div className="border-t border-[color:var(--moni-border-default)]" />}

      {/* Responsáveis */}
      <ResponsaveisSection slaResponsaveis={data.slaResponsaveis} />

      {/* Rodapé */}
      <p className="pb-4 text-[11px] text-[color:var(--moni-text-tertiary)]">
        SLA calculado sobre tópicos com atribuição registrada · finais de semana e feriados excluídos ·
        Funil/etapa via kanban_atividades → kanban_cards → kanbans ·
        Área via profiles.time (mesmo critério do Boné Day)
      </p>
    </div>
  );
}
