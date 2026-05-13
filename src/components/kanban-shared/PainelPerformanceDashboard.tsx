'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { calcularStatusSLA } from '@/lib/dias-uteis';
import {
  aggregateRetrocesso,
  atividadeAtrasada,
  atividadeInPeriod,
  buildFaseMaps,
  isDuvidaTipo,
  periodSinceMs,
} from '@/lib/kanban/painel-performance-compute';
import type { PainelCardDTO, PainelPerformanceDataset, PainelPeriodKey } from '@/lib/kanban/painel-performance-types';
import { getChartConstructor, loadChartJsFromCdn } from './chartjs-cdn';

/**
 * Hex espelhando `:root` em `src/styles/moni-tokens.css` (Chart.js não lê CSS variables).
 * Escala sem `--moni-navy-700` / `--moni-navy-500` / `--moni-earth-700`: usamos navy-600, navy-400 e earth-600.
 */
const MONI = {
  navy900: '#071820',
  navy700: '#0e3a4e',
  navy500: '#3e7490',
  green600: '#365848',
  green400: '#4d7a62',
  gold600: '#b08a3e',
  gold400: '#d4ad68',
  gold200: '#e6ce96',
  earth700: '#5e473a',
  overdue: '#8c2a1e',
  overdueBg: '#fdf0ee',
  overdueBorder: '#c24b3a',
  attention: '#faf4e8',
  attentionText: '#7a5f22',
  attentionBorder: '#d4ad68',
  surface100: '#f2ede8',
  surface200: '#e8e2da',
  textMuted: '#7a6e65',
  textSecondary: '#4a3929',
  textPrimary: '#0c2633',
  white: '#ffffff',
  activeBg: '#e8eef1',
  activeText: '#0e3a4e',
  activeBorder: '#3e7490',
} as const;

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  if (![r, g, b].every((x) => Number.isFinite(x))) return hex;
  return `rgba(${r},${g},${b},${alpha})`;
}

const R_PANEL = 12;

function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n);
}

function formatDec(n: number, frac = 1): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: frac }).format(n);
}

function initials(name: string): string {
  const p = name
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return `${p[0][0] ?? ''}${p[p.length - 1][0] ?? ''}`.toUpperCase();
}

type Tone = 'good' | 'bad' | 'warn' | 'neutral';

function toneHex(t: Tone): string {
  if (t === 'good') return MONI.green600;
  if (t === 'bad') return MONI.overdue;
  if (t === 'warn') return MONI.attentionText;
  return MONI.textMuted;
}

function KpiTile({
  label,
  value,
  subtext,
  tone,
}: {
  label: string;
  value: string | number;
  subtext: string;
  tone: Tone;
}) {
  const sub = subtext.trim() ? subtext : 'Sem dados ainda';
  const subTone: Tone = subtext.trim() ? tone : 'neutral';
  return (
    <div
      className="flex min-h-[118px] min-w-[140px] flex-1 flex-col justify-between px-4 py-3"
      style={{
        borderRadius: R_PANEL,
        background: 'var(--color-background-secondary, #f2ede8)',
      }}
    >
      <p className="text-[11px] font-medium leading-tight" style={{ color: MONI.textSecondary }}>
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums leading-none" style={{ color: MONI.navy900 }}>
        {value}
      </p>
      <p className="mt-2 min-h-[2.5rem] text-xs font-medium leading-snug" style={{ color: toneHex(subTone) }}>
        {sub}
      </p>
    </div>
  );
}

function PanelCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="bg-white px-4 py-4 shadow-sm"
      style={{
        borderRadius: R_PANEL,
        border: `0.5px solid ${MONI.surface200}`,
      }}
    >
      <h3 className="text-sm font-semibold" style={{ color: MONI.navy900 }}>
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ChartCanvas({
  canvasRef,
  heightPx,
  ariaLabel,
}: {
  canvasRef: React.Ref<HTMLCanvasElement>;
  heightPx: number;
  ariaLabel: string;
}) {
  return (
    <div className="relative w-full" style={{ height: heightPx }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
      style={{
        background: MONI.surface200,
        color: MONI.navy900,
        border: `0.5px solid ${MONI.surface200}`,
      }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

const PERIOD_OPTIONS: { key: PainelPeriodKey; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'all', label: 'Tudo' },
];

const chartTickFont = { family: 'Inter, system-ui, sans-serif', size: 11 };

/** Valores ao fim das barras horizontais (Chart.js CDN). */
const barEndLabelsHorizontal = {
  id: 'barValueLabelsH',
  afterDatasetsDraw(chart: {
    ctx: CanvasRenderingContext2D;
    data: { datasets: Array<{ data?: unknown }> };
    getDatasetMeta: (i: number) => { data?: Array<{ x?: number; y?: number }> };
  }) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, di) => {
      const meta = chart.getDatasetMeta(di);
      if (!meta?.data) return;
      const dataArr = (dataset.data ?? []) as number[];
      meta.data.forEach((element, index) => {
        const value = dataArr[index];
        if (typeof value !== 'number' || value === 0) return;
        const x = element.x ?? 0;
        const y = element.y ?? 0;
        ctx.save();
        ctx.fillStyle = MONI.textMuted;
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(value), x + 6, y);
        ctx.restore();
      });
    });
  },
};

function buildOpenCardHref(basePath: string, cardId: string): string {
  const sep = basePath.includes('?') ? '&' : '?';
  return `${basePath}${sep}tab=kanban&card=${encodeURIComponent(cardId)}`;
}

function linhaStatusCard(c: PainelCardDTO): string {
  if (c.arquivado) return 'Arquivado';
  if (c.concluido) return 'Concluído';
  return c.status || 'Ativo';
}

export function PainelPerformanceDashboard({ dataset }: { dataset: PainelPerformanceDataset }) {
  const pathname = usePathname();
  const [period, setPeriod] = useState<PainelPeriodKey>('30d');
  const [cdnError, setCdnError] = useState<string | null>(null);
  const [cdnReady, setCdnReady] = useState(false);
  const [drawerFaseId, setDrawerFaseId] = useState<string | null>(null);

  const funnelRef = useRef<HTMLCanvasElement>(null);
  const tempoRef = useRef<HTMLCanvasElement>(null);
  const slaCompareRef = useRef<HTMLCanvasElement>(null);
  const faseChamadosRef = useRef<HTMLCanvasElement>(null);
  const doughnutRef = useRef<HTMLCanvasElement>(null);
  const chartInstances = useRef<Array<{ destroy: () => void }>>([]);

  useEffect(() => {
    let alive = true;
    loadChartJsFromCdn()
      .then(() => {
        if (alive) setCdnReady(true);
      })
      .catch(() => {
        if (alive) setCdnError('Não foi possível carregar Chart.js (CDN).');
      });
    return () => {
      alive = false;
    };
  }, []);

  const orderedFases = useMemo(
    () => [...dataset.fases].sort((a, b) => a.ordem - b.ordem),
    [dataset.fases],
  );

  const faseById = useMemo(() => new Map(orderedFases.map((f) => [f.id, f])), [orderedFases]);

  const sinceMs = useMemo(() => periodSinceMs(period), [period]);

  const atividadesScoped = useMemo(
    () => dataset.atividades.filter((a) => atividadeInPeriod(a, sinceMs)),
    [dataset.atividades, sinceMs],
  );

  const cardsAtivosFunil = useMemo(
    () => dataset.cards.filter((c) => !c.arquivado && !c.concluido),
    [dataset.cards],
  );

  const tituloById = useMemo(() => new Map(dataset.cards.map((c) => [c.id, c.titulo])), [dataset.cards]);

  const { totalPorFase, atrasadosPorFase, tempoMedioDiasPorFase, diasUteisMedioPorFase, slaPorFase } = useMemo(
    () => buildFaseMaps(orderedFases, cardsAtivosFunil),
    [orderedFases, cardsAtivosFunil],
  );

  const slaRows = cardsAtivosFunil;
  let slaDentro = 0;
  for (const c of slaRows) {
    const fase = faseById.get(c.fase_id);
    const slaDias = fase?.sla_dias ?? 999;
    const created = new Date(c.created_at);
    if (Number.isFinite(created.getTime()) && calcularStatusSLA(created, slaDias).status !== 'atrasado') {
      slaDentro += 1;
    }
  }
  const pctSlaDentro = slaRows.length === 0 ? 0 : (slaDentro / slaRows.length) * 100;
  const pctSlaFora = Math.max(0, 100 - pctSlaDentro);

  const fasesMaisAtraso = useMemo(() => {
    return [...orderedFases]
      .map((f) => ({ f, n: atrasadosPorFase.get(f.id) ?? 0 }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 6);
  }, [orderedFases, atrasadosPorFase]);

  const totalNoFunil = cardsAtivosFunil.length;
  const emAndamento = cardsAtivosFunil.filter((c) => String(c.status).toLowerCase() !== 'concluido').length;

  const concluidosKpi = useMemo(() => {
    return dataset.cards.filter((c) => {
      if (!c.concluido || !c.concluido_em) return false;
      if (sinceMs === null) return true;
      return new Date(c.concluido_em).getTime() >= sinceMs;
    }).length;
  }, [dataset.cards, sinceMs]);

  const arquivadosKpi = useMemo(() => dataset.cards.filter((c) => c.arquivado).length, [dataset.cards]);

  let leadSum = 0;
  let leadN = 0;
  for (const c of dataset.cards) {
    if (!c.concluido || !c.concluido_em) continue;
    if (sinceMs !== null && new Date(c.concluido_em).getTime() < sinceMs) continue;
    const a = new Date(c.created_at).getTime();
    const b = new Date(c.concluido_em).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
      leadSum += b - a;
      leadN += 1;
    }
  }
  const leadMedioDias = leadN === 0 ? null : leadSum / leadN / (1000 * 60 * 60 * 24);

  let chamadosAbertos = 0;
  let chamadosTrava = 0;
  let countDuvidas = 0;
  let countAtividades = 0;
  for (const a of atividadesScoped) {
    const st = String(a.status ?? '').toLowerCase();
    const aberta = st !== 'concluida' && st !== 'cancelada';
    if (!aberta) continue;
    chamadosAbertos += 1;
    if (a.trava) chamadosTrava += 1;
    if (isDuvidaTipo(a.tipo)) countDuvidas += 1;
    else countAtividades += 1;
  }

  const retroAggs = useMemo(
    () => aggregateRetrocesso(dataset.retrocessoRows, tituloById),
    [dataset.retrocessoRows, tituloById],
  );
  const retrabalhoN = new Set(dataset.retrocessoRows.map((r) => r.card_id)).size;

  const porFaseChamados = new Map<string, number>();
  const porCardCount = new Map<string, number>();
  const chamadosPorResp = new Map<string, number>();
  const respDuvidas = new Map<string, number>();
  const respAtrasos = new Map<string, number>();

  const cardFase = new Map(dataset.cards.map((c) => [c.id, c.fase_id]));

  for (const a of atividadesScoped) {
    porCardCount.set(a.card_id, (porCardCount.get(a.card_id) ?? 0) + 1);
    const fid = cardFase.get(a.card_id);
    if (fid) porFaseChamados.set(fid, (porFaseChamados.get(fid) ?? 0) + 1);

    const ids =
      Array.isArray(a.responsaveis_ids) && a.responsaveis_ids.length > 0
        ? a.responsaveis_ids
        : a.responsavel_id
          ? [a.responsavel_id]
          : [];
    const seen = new Set<string>();
    for (const rid of ids) {
      if (!rid || seen.has(rid)) continue;
      seen.add(rid);
      chamadosPorResp.set(rid, (chamadosPorResp.get(rid) ?? 0) + 1);
      if (isDuvidaTipo(a.tipo)) respDuvidas.set(rid, (respDuvidas.get(rid) ?? 0) + 1);
      if (atividadeAtrasada(a)) respAtrasos.set(rid, (respAtrasos.get(rid) ?? 0) + 1);
    }
  }

  const topCards = [...porCardCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, n]) => ({ id, n, titulo: tituloById.get(id) ?? 'Card' }));

  const cardsPorFranqueado = new Map<string, number>();
  const franqAtrasos = new Map<string, number>();
  const franqSlaOk = new Map<string, number>();
  const franqSlaTotal = new Map<string, number>();

  for (const c of cardsAtivosFunil) {
    cardsPorFranqueado.set(c.franqueado_id, (cardsPorFranqueado.get(c.franqueado_id) ?? 0) + 1);
    const fase = faseById.get(c.fase_id);
    const slaDias = fase?.sla_dias ?? 999;
    const st = calcularStatusSLA(new Date(c.created_at), slaDias).status;
    franqSlaTotal.set(c.franqueado_id, (franqSlaTotal.get(c.franqueado_id) ?? 0) + 1);
    if (st !== 'atrasado') franqSlaOk.set(c.franqueado_id, (franqSlaOk.get(c.franqueado_id) ?? 0) + 1);
    else franqAtrasos.set(c.franqueado_id, (franqAtrasos.get(c.franqueado_id) ?? 0) + 1);
  }

  const labelsFases = orderedFases.map((f) => f.nome);
  const dataFunil = orderedFases.map((f) => totalPorFase.get(f.id) ?? 0);
  const dataTempoFase = orderedFases.map((f) => Math.round((tempoMedioDiasPorFase.get(f.id) ?? 0) * 10) / 10);
  const dataDuMedio = orderedFases.map((f) => Math.round((diasUteisMedioPorFase.get(f.id) ?? 0) * 10) / 10);
  const dataSlaMeta = orderedFases.map((f) => slaPorFase.get(f.id) ?? 0);
  const dataChamadosFase = orderedFases.map((f) => porFaseChamados.get(f.id) ?? 0);

  const maxTimeFase = Math.max(1, ...orderedFases.map((f) => tempoMedioDiasPorFase.get(f.id) ?? 0));

  const timeRows = [...cardsPorFranqueado.entries()].sort((a, b) => b[1] - a[1]);
  const maxFranqCards = Math.max(1, ...[...cardsPorFranqueado.values()], 0);
  const respRows = [...chamadosPorResp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  const drawerFase = useMemo(
    () => (drawerFaseId ? orderedFases.find((f) => f.id === drawerFaseId) ?? null : null),
    [drawerFaseId, orderedFases],
  );

  const cardsListaDrawer = useMemo(() => {
    if (!drawerFaseId) return [];
    return cardsAtivosFunil.filter((c) => c.fase_id === drawerFaseId);
  }, [cardsAtivosFunil, drawerFaseId]);

  const totalCardsBase = Math.max(1, dataset.cards.length);
  const pctArquivados = (arquivadosKpi / totalCardsBase) * 100;
  const motivosArq = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of dataset.cards) {
      if (!c.arquivado) continue;
      const key = (c.motivo_arquivamento ?? 'Sem motivo').trim() || 'Sem motivo';
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [dataset.cards]);
  const mediaChamadosPorCard =
    dataset.cards.length === 0 ? 0 : atividadesScoped.length / Math.max(1, dataset.cards.length);

  const abertosMix = countAtividades + countDuvidas;
  const pctAtivMix = abertosMix === 0 ? 0 : (countAtividades / abertosMix) * 100;
  const pctDuvMix = abertosMix === 0 ? 0 : (countDuvidas / abertosMix) * 100;

  const chartDepsKey = useMemo(
    () =>
      JSON.stringify({
        period,
        labelsFases,
        dataFunil,
        dataTempoFase,
        dataDuMedio,
        dataSlaMeta,
        dataChamadosFase,
        dough: [countAtividades, countDuvidas],
        kanban: dataset.kanbanNome,
      }),
    [
      period,
      labelsFases,
      dataFunil,
      dataTempoFase,
      dataDuMedio,
      dataSlaMeta,
      dataChamadosFase,
      countAtividades,
      countDuvidas,
      dataset.kanbanNome,
    ],
  );

  useEffect(() => {
    if (!cdnReady) return;
    const Chart = getChartConstructor();
    if (!Chart) return;

    chartInstances.current.forEach((c) => c.destroy());
    chartInstances.current = [];

    const baseOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    };

    const scaleX = {
      beginAtZero: true,
      grid: { color: MONI.surface200 },
      ticks: { color: MONI.textSecondary, font: chartTickFont },
    };

    /** Eixo X do funil (contagens): só inteiros visíveis. */
    const scaleXFunnelCounts = {
      ...scaleX,
      ticks: {
        ...scaleX.ticks,
        color: MONI.textMuted,
        stepSize: 1,
        callback(raw: number | string) {
          const v = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
          return Number.isFinite(v) && Number.isInteger(v) ? formatInt(v) : '';
        },
      },
    };
    const scaleY = {
      grid: { display: false },
      ticks: { color: MONI.textSecondary, font: chartTickFont },
    };
    const scaleYFunnel = {
      ...scaleY,
      ticks: { ...scaleY.ticks, color: MONI.textMuted },
    };

    const mk = (canvas: HTMLCanvasElement | null, cfg: unknown) => {
      if (!canvas) return;
      const inst = new Chart(canvas, cfg as never);
      chartInstances.current.push(inst);
    };

    mk(funnelRef.current, {
      type: 'bar',
      data: {
        labels: labelsFases,
        datasets: [
          {
            data: dataFunil,
            backgroundColor: MONI.navy700,
            hoverBackgroundColor: MONI.navy900,
            borderRadius: 4,
            maxBarThickness: 22,
          },
        ],
      },
      options: {
        ...baseOpts,
        indexAxis: 'y',
        interaction: { mode: 'index' as const, intersect: false },
        scales: { x: scaleXFunnelCounts, y: scaleYFunnel },
        plugins: {
          ...baseOpts.plugins,
          tooltip: {
            callbacks: {
              label(ctx: { parsed?: { x?: number } }) {
                const x = ctx.parsed?.x ?? 0;
                return `${formatInt(x)} cards`;
              },
            },
          },
        },
        onClick: (_evt: unknown, elements: { index: number; datasetIndex?: number }[]) => {
          if (!elements?.length) return;
          const idx = elements[0].index;
          if (typeof idx !== 'number' || idx < 0) return;
          const fase = orderedFases[idx];
          if (!fase) return;
          setDrawerFaseId(fase.id);
        },
      },
      plugins: [barEndLabelsHorizontal],
    });

    mk(tempoRef.current, {
      type: 'bar',
      data: {
        labels: labelsFases,
        datasets: [
          {
            data: dataTempoFase,
            backgroundColor(ctx: { dataIndex: number }) {
              const i = ctx.dataIndex;
              const sla = dataSlaMeta[i] ?? 0;
              const du = dataDuMedio[i] ?? 0;
              if (sla <= 0) return MONI.green600;
              return du <= sla ? MONI.green600 : MONI.overdue;
            },
            hoverBackgroundColor(ctx: { dataIndex: number }) {
              const i = ctx.dataIndex;
              const sla = dataSlaMeta[i] ?? 0;
              const du = dataDuMedio[i] ?? 0;
              if (sla <= 0) return hexAlpha(MONI.green600, 0.88);
              return du <= sla ? hexAlpha(MONI.green600, 0.88) : hexAlpha(MONI.overdue, 0.88);
            },
            borderRadius: 4,
            maxBarThickness: 14,
          },
        ],
      },
      options: {
        ...baseOpts,
        indexAxis: 'y',
        scales: {
          x: { ...scaleX, suggestedMax: maxTimeFase * 1.1 || 1 },
          y: scaleY,
        },
        plugins: {
          ...baseOpts.plugins,
          tooltip: {
            callbacks: {
              label(ctx: { parsed?: { x?: number } }) {
                const x = ctx.parsed?.x ?? 0;
                return `${formatDec(x, 1)} dias`;
              },
            },
          },
        },
      },
      plugins: [barEndLabelsHorizontal],
    });

    mk(slaCompareRef.current, {
      type: 'bar',
      data: {
        labels: labelsFases,
        datasets: [
          {
            label: 'Dias úteis (média)',
            data: dataDuMedio,
            backgroundColor: MONI.navy700,
            borderRadius: 4,
            maxBarThickness: 14,
          },
          {
            label: 'SLA (d.u.)',
            data: dataSlaMeta,
            backgroundColor: MONI.gold600,
            borderRadius: 4,
            maxBarThickness: 14,
          },
        ],
      },
      options: {
        ...baseOpts,
        indexAxis: 'y',
        scales: { x: scaleX, y: scaleY },
        plugins: { ...baseOpts.plugins, tooltip: { enabled: true } },
      },
      plugins: [barEndLabelsHorizontal],
    });

    mk(faseChamadosRef.current, {
      type: 'bar',
      data: {
        labels: labelsFases,
        datasets: [
          {
            data: dataChamadosFase,
            backgroundColor: MONI.earth700,
            borderRadius: 4,
            maxBarThickness: 18,
          },
        ],
      },
      options: {
        ...baseOpts,
        indexAxis: 'y',
        scales: { x: scaleX, y: scaleY },
      },
      plugins: [barEndLabelsHorizontal],
    });

    const d1 = Math.max(0, countAtividades);
    const d2 = Math.max(0, countDuvidas);
    if (d1 + d2 > 0) {
      mk(doughnutRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Atividade', 'Dúvida'],
          datasets: [
            {
              data: [d1, d2],
              backgroundColor: [hexAlpha(MONI.navy700, 0.9), hexAlpha(MONI.gold600, 0.9)],
              borderWidth: 0.5,
              borderColor: MONI.surface200,
            },
          ],
        },
        options: {
          ...baseOpts,
          cutout: '58%',
          plugins: {
            ...baseOpts.plugins,
            tooltip: { enabled: true },
          },
        },
      });
    }

    return () => {
      chartInstances.current.forEach((c) => c.destroy());
      chartInstances.current = [];
    };
  }, [cdnReady, chartDepsKey, maxTimeFase, orderedFases, dataset.kanbanNome, setDrawerFaseId]);

  const kpiRow = (
    <div className="flex flex-wrap gap-3">
      <KpiTile
        label="Total no funil"
        value={formatInt(totalNoFunil)}
        subtext="Ativos no funil"
        tone={totalNoFunil ? 'neutral' : 'warn'}
      />
      <KpiTile
        label="Em andamento"
        value={formatInt(emAndamento)}
        subtext="Em progresso"
        tone={emAndamento ? 'neutral' : 'warn'}
      />
      <KpiTile
        label="Concluídos"
        value={formatInt(concluidosKpi)}
        subtext={concluidosKpi ? 'No período' : 'Nenhum'}
        tone={concluidosKpi ? 'good' : 'neutral'}
      />
      <KpiTile
        label="Arquivados"
        value={formatInt(arquivadosKpi)}
        subtext="No histórico"
        tone={arquivadosKpi ? 'warn' : 'good'}
      />
      <KpiTile
        label="% SLA"
        value={`${formatDec(pctSlaDentro, 1)}%`}
        subtext="No funil"
        tone={
          slaRows.length === 0 ? 'neutral' : pctSlaDentro >= 75 ? 'good' : pctSlaDentro >= 50 ? 'warn' : 'bad'
        }
      />
      <KpiTile
        label="Lead time médio"
        value={leadMedioDias === null ? '—' : `${formatDec(leadMedioDias, 1)} d`}
        subtext="Prazo médio"
        tone={leadMedioDias === null ? 'neutral' : leadMedioDias <= 14 ? 'good' : 'warn'}
      />
    </div>
  );

  const openCardBase = (pathname ?? '/').trim() || '/';

  return (
    <div className="space-y-10 pb-10">
      <header className="flex flex-col gap-4 pb-6" style={{ borderBottom: `0.5px solid ${MONI.surface200}` }}>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
              {dataset.kanbanNome}
            </h1>
          </div>
          <div
            className="inline-flex rounded-full p-0.5"
            style={{ background: MONI.surface200, border: `0.5px solid ${MONI.surface200}` }}
            role="tablist"
            aria-label="Período"
          >
            {PERIOD_OPTIONS.map(({ key, label }) => {
              const on = period === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: on ? MONI.navy900 : 'transparent',
                    color: on ? MONI.white : MONI.textSecondary,
                    border: '0.5px solid transparent',
                  }}
                  onClick={() => setPeriod(key)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        {cdnError ? (
          <p className="text-sm" style={{ color: MONI.overdue }}>
            {cdnError}
          </p>
        ) : null}
        {dataset.mode === 'legado' ? (
          <p className="max-w-2xl text-sm" style={{ color: MONI.textSecondary }}>
            Modo legado: métricas limitadas aos cards carregados nesta página.
          </p>
        ) : null}
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold" style={{ color: MONI.navy900 }}>
          Visão geral
        </h2>
        {kpiRow}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PanelCard title="Cards por fase">
          <div className="space-y-4">
            <div className="cursor-pointer">
              <ChartCanvas canvasRef={funnelRef} heightPx={240} ariaLabel="Gráfico de barras horizontais: volume de cards por fase" />
            </div>
            <p className="text-xs font-medium" style={{ color: MONI.textMuted }}>
              Tempo médio por fase
            </p>
            <ChartCanvas
              canvasRef={tempoRef}
              heightPx={200}
              ariaLabel="Gráfico de barras horizontais: tempo médio em dias por fase"
            />
          </div>
        </PanelCard>

        <PanelCard title="SLA">
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-xs" style={{ color: MONI.textSecondary }}>
                <span>Dentro do SLA</span>
                <span className="tabular-nums font-semibold" style={{ color: MONI.navy900 }}>
                  {formatDec(pctSlaDentro, 1)}%
                </span>
              </div>
              <div className="relative flex h-3 overflow-hidden rounded-full" style={{ background: MONI.surface200 }}>
                <div
                  className="h-full"
                  style={{
                    width: `${pctSlaDentro}%`,
                    background: MONI.green600,
                    transition: 'width 0.35s ease',
                  }}
                />
                <div
                  className="h-full"
                  style={{
                    width: `${pctSlaFora}%`,
                    background: MONI.overdue,
                    transition: 'width 0.35s ease',
                  }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[11px]" style={{ color: MONI.textMuted }}>
                <span>Fora: {formatDec(pctSlaFora, 1)}%</span>
                <span>Ativos: {formatInt(slaRows.length)}</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold" style={{ color: MONI.navy900 }}>
                Fases com mais atraso
              </p>
              <ul className="mt-2 space-y-2">
                {fasesMaisAtraso.length === 0 ? (
                  <li className="text-sm" style={{ color: MONI.textMuted }}>
                    Nenhum atraso
                  </li>
                ) : (
                  fasesMaisAtraso.map(({ f, n }) => (
                    <li key={f.id} className="flex items-center justify-between text-sm">
                      <span style={{ color: MONI.textSecondary }}>{f.nome}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{
                          background: MONI.overdue,
                          color: MONI.white,
                          border: `0.5px solid ${MONI.overdueBorder}`,
                        }}
                      >
                        {n} atrasados
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div
              className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium"
              style={{ color: MONI.textSecondary }}
            >
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-2.5 w-3 shrink-0 rounded-sm" style={{ background: MONI.navy700 }} />
                Tempo real (d.u.)
              </span>
              <span style={{ color: MONI.textMuted }} aria-hidden>
                |
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-2.5 w-3 shrink-0 rounded-sm" style={{ background: MONI.gold600 }} />
                SLA configurado (d.u.)
              </span>
            </div>
            <ChartCanvas
              canvasRef={slaCompareRef}
              heightPx={220}
              ariaLabel="Gráfico comparativo: dias úteis médios versus SLA por fase"
            />
          </div>
        </PanelCard>

        <PanelCard title="Time">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-medium" style={{ color: MONI.textMuted }}>
                Cards por franqueado
              </p>
              <ul className="mt-2 space-y-3">
                {timeRows.length === 0 ? (
                  <li className="text-sm" style={{ color: MONI.textMuted }}>
                    Sem dados
                  </li>
                ) : (
                  timeRows.map(([id, n]) => {
                    const name = dataset.profiles[id] ?? id.slice(0, 8);
                    const pct = Math.round((n / maxFranqCards) * 100);
                    return (
                      <li key={id} className="flex items-center gap-3">
                        <Avatar name={name} />
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between gap-2 text-sm">
                            <span className="truncate font-medium" style={{ color: MONI.navy900 }}>
                              {name}
                            </span>
                            <span className="tabular-nums" style={{ color: MONI.textSecondary }}>
                              {n}
                            </span>
                          </div>
                          <div className="relative mt-1 h-2 overflow-hidden rounded-full" style={{ background: MONI.surface200 }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: MONI.navy700 }} />
                          </div>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold" style={{ color: MONI.navy900 }}>
                Atrasos por pessoa
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {[...franqAtrasos.entries()]
                  .filter(([, n]) => n > 0)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([id, n]) => (
                    <li
                      key={id}
                      className="rounded-full px-2 py-1 text-[11px] font-semibold"
                      style={{
                        background: MONI.overdue,
                        color: MONI.white,
                        border: `0.5px solid ${MONI.overdueBorder}`,
                      }}
                    >
                      {(dataset.profiles[id] ?? '').split(' ')[0] || '—'} · {n}
                    </li>
                  ))}
                {![...franqAtrasos.values()].some((n) => n > 0) ? (
                  <li className="text-sm" style={{ color: MONI.textMuted }}>
                    Sem atrasos por dono
                  </li>
                ) : null}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold" style={{ color: MONI.navy900 }}>
                % SLA por pessoa
              </p>
              <ul className="mt-2 space-y-2">
                {[...franqSlaTotal.entries()]
                  .filter(([, t]) => t > 0)
                  .map(([id, t]) => {
                    const ok = franqSlaOk.get(id) ?? 0;
                    const pctP = (ok / t) * 100;
                    return (
                      <li key={id} className="flex items-center justify-between text-sm">
                        <span className="truncate" style={{ color: MONI.textSecondary }}>
                          {dataset.profiles[id] ?? id.slice(0, 8)}
                        </span>
                        <span className="tabular-nums font-medium" style={{ color: MONI.navy900 }}>
                          {formatDec(pctP, 0)}%
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>
        </PanelCard>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold" style={{ color: MONI.navy900 }}>
          Qualidade e chamados
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PanelCard title="Qualidade">
            <div className="space-y-4 text-sm" style={{ color: MONI.textSecondary }}>
              <div className="flex justify-between gap-2">
                <span>Arquivados (% do total)</span>
                <strong className="tabular-nums" style={{ color: MONI.navy900 }}>
                  {formatDec(pctArquivados, 1)}% · {formatInt(arquivadosKpi)} card(s)
                </strong>
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: MONI.navy900 }}>
                  Motivos de arquivamento (top)
                </p>
                <ul className="mt-2 space-y-1.5">
                  {motivosArq.length === 0 ? (
                    <li className="text-sm" style={{ color: MONI.textMuted }}>
                      Nenhum arquivamento com motivo registrado
                    </li>
                  ) : (
                    motivosArq.map(([mot, n]) => (
                      <li key={mot} className="flex justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate">{mot}</span>
                        <span className="shrink-0 tabular-nums font-medium" style={{ color: MONI.navy900 }}>
                          {formatInt(n)}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="flex justify-between gap-2">
                <span>Retrabalho (cards com retrocesso)</span>
                <strong className="tabular-nums" style={{ color: retrabalhoN ? MONI.overdue : MONI.navy900 }}>
                  {formatInt(retrabalhoN)}
                </strong>
              </div>
              <div className="flex justify-between gap-2">
                <span>Chamados por card (média no período)</span>
                <strong className="tabular-nums" style={{ color: MONI.navy900 }}>
                  {formatDec(mediaChamadosPorCard, 2)}
                </strong>
              </div>
            </div>
          </PanelCard>

          <PanelCard title="Chamados — visão geral">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 text-sm" style={{ color: MONI.textSecondary }}>
                <div className="flex justify-between">
                  <span>Total</span>
                  <strong style={{ color: MONI.navy900 }}>{formatInt(atividadesScoped.length)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Em aberto</span>
                  <strong style={{ color: MONI.navy900 }}>{formatInt(chamadosAbertos)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Com trava</span>
                  <strong style={{ color: chamadosTrava ? MONI.overdue : MONI.navy900 }}>{formatInt(chamadosTrava)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Dúvidas</span>
                  <strong style={{ color: MONI.navy900 }}>{formatInt(countDuvidas)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Atividades</span>
                  <strong style={{ color: MONI.navy900 }}>{formatInt(countAtividades)}</strong>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center">
                {atividadesScoped.length === 0 ? (
                  <p className="text-sm" style={{ color: MONI.textMuted }}>
                    Sem dados
                  </p>
                ) : countAtividades + countDuvidas === 0 ? (
                  <p className="text-center text-sm" style={{ color: MONI.textMuted }}>
                    Nenhum chamado em aberto no período
                  </p>
                ) : (
                  <>
                    <div className="relative h-44 w-44">
                      <ChartCanvas canvasRef={doughnutRef} heightPx={176} ariaLabel="Gráfico rosca: atividades versus dúvidas em aberto" />
                    </div>
                    <div
                      className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs leading-snug"
                      style={{ color: MONI.textSecondary }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: MONI.navy700 }} />
                        Atividade {formatInt(countAtividades)} ({formatDec(pctAtivMix, 0)}%)
                      </span>
                      <span className="hidden sm:inline" style={{ color: MONI.textMuted }}>
                        |
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: MONI.gold600 }} />
                        Dúvida {formatInt(countDuvidas)} ({formatDec(pctDuvMix, 0)}%)
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </PanelCard>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold" style={{ color: MONI.navy900 }}>
          Distribuição e retrabalho
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <PanelCard title="Chamados por fase">
              <div className="space-y-3">
                <ChartCanvas canvasRef={faseChamadosRef} heightPx={220} ariaLabel="Chamados por fase do card" />
                <div>
                  <p className="text-xs font-semibold" style={{ color: MONI.navy900 }}>
                    Cards mais pesados
                  </p>
                  <ul className="mt-2 space-y-2">
                    {topCards.length === 0 ? (
                      <li className="text-sm" style={{ color: MONI.textMuted }}>
                        Sem dados
                      </li>
                    ) : (
                      topCards.map((t) => (
                        <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate" style={{ color: MONI.textSecondary }}>
                            {t.titulo}
                          </span>
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                            style={{
                              background: MONI.activeBg,
                              color: MONI.activeText,
                              border: `0.5px solid ${MONI.activeBorder}`,
                            }}
                          >
                            {t.n}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </PanelCard>

            <PanelCard title="Chamados por responsável">
              <ul className="space-y-3">
                {respRows.length === 0 ? (
                  <li className="text-sm" style={{ color: MONI.textMuted }}>
                    Sem dados
                  </li>
                ) : (
                  respRows.map(([id, n]) => {
                    const name = dataset.profiles[id] ?? id.slice(0, 8);
                    const maxR = respRows[0]?.[1] ?? 1;
                    const pct = Math.round((n / maxR) * 100);
                    return (
                      <li key={id} className="flex items-center gap-3">
                        <Avatar name={name} />
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between gap-2 text-sm">
                            <span className="truncate font-medium" style={{ color: MONI.navy900 }}>
                              {name}
                            </span>
                            <span className="tabular-nums" style={{ color: MONI.textSecondary }}>
                              {n}
                            </span>
                          </div>
                          <div className="relative mt-1 h-2 overflow-hidden rounded-full" style={{ background: MONI.surface200 }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: MONI.navy700 }} />
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                            {(respAtrasos.get(id) ?? 0) > 0 ? (
                              <span
                                className="rounded-full px-1.5 py-0.5 font-semibold"
                                style={{
                                  background: MONI.overdue,
                                  color: MONI.white,
                                  border: `0.5px solid ${MONI.overdueBorder}`,
                                }}
                              >
                                {respAtrasos.get(id)} atraso(s)
                              </span>
                            ) : null}
                            {(respDuvidas.get(id) ?? 0) > 0 ? (
                              <span
                                className="rounded-full px-1.5 py-0.5 font-semibold"
                                style={{
                                  background: MONI.attention,
                                  color: MONI.navy900,
                                  border: `0.5px solid ${MONI.gold200}`,
                                }}
                              >
                                {respDuvidas.get(id)} dúvida(s)
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </PanelCard>
          </div>

          <div className="bg-white px-5 py-5 shadow-sm" style={{ borderRadius: R_PANEL, border: `0.5px solid ${MONI.surface200}` }}>
            <h3 className="text-sm font-semibold" style={{ color: MONI.navy900 }}>
              Retrabalho
            </h3>
            <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-medium" style={{ color: MONI.textMuted }}>
                  Cards com retrocesso
                </p>
                <p className="text-4xl font-semibold tabular-nums" style={{ color: MONI.gold600 }}>
                  {formatInt(retrabalhoN)}
                </p>
              </div>
            </div>
            <ul className="mt-6 divide-y" style={{ borderColor: MONI.surface200 }}>
              {retroAggs.length === 0 ? (
                <li className="py-6 text-center text-sm" style={{ color: MONI.textMuted }}>
                  Sem dados
                </li>
              ) : (
                retroAggs.slice(0, 20).map((r) => (
                  <li key={r.cardId} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium" style={{ color: MONI.navy900 }}>
                        {r.titulo}
                      </p>
                      <p className="text-xs" style={{ color: MONI.textMuted }}>
                        {r.fasesLabel}
                      </p>
                    </div>
                    <span
                      className="w-fit rounded-full px-2 py-1 text-xs font-semibold tabular-nums"
                      style={{
                        background: MONI.attention,
                        color: MONI.attentionText,
                        border: `0.5px solid ${MONI.gold200}`,
                      }}
                    >
                      {r.count}×
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>

      {drawerFaseId ? (
        <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="painel-cards-fase-titulo">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/35"
            aria-label="Fechar painel"
            onClick={() => setDrawerFaseId(null)}
          />
          <aside
            className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl"
            style={{ borderLeft: `4px solid ${MONI.navy900}` }}
          >
            <div className="flex items-start justify-between gap-3 border-b px-4 py-4" style={{ borderColor: MONI.surface200 }}>
              <h2 id="painel-cards-fase-titulo" className="pr-8 text-base font-semibold leading-snug" style={{ color: MONI.navy900 }}>
                Cards em {drawerFase?.nome ?? 'fase'}
              </h2>
              <button
                type="button"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-lg leading-none transition hover:bg-[var(--moni-surface-200)]"
                style={{ color: MONI.textMuted }}
                aria-label="Fechar"
                onClick={() => setDrawerFaseId(null)}
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {cardsListaDrawer.length === 0 ? (
                <p className="text-sm" style={{ color: MONI.textMuted }}>
                  Nenhum card ativo nesta fase.
                </p>
              ) : (
                <ul className="space-y-2">
                  {cardsListaDrawer.map((c) => {
                    const f = faseById.get(c.fase_id);
                    const slaDias = f?.sla_dias ?? 0;
                    const slaSt = slaDias > 0 ? calcularStatusSLA(new Date(c.created_at), slaDias) : null;
                    const slaMetaLine = slaDias > 0 ? `SLA ${slaDias} d.u.` : 'Sem meta de SLA nesta fase';
                    const slaBadgeStyle =
                      slaSt?.status === 'atrasado'
                        ? { background: MONI.overdue, color: MONI.white, border: `0.5px solid ${MONI.overdueBorder}` }
                        : slaSt?.status === 'atencao'
                          ? { background: MONI.attention, color: MONI.navy900, border: `0.5px solid ${MONI.attentionBorder}` }
                          : slaSt?.status === 'ok'
                            ? { background: MONI.green600, color: MONI.white, border: `0.5px solid ${MONI.green400}` }
                            : null;
                    const resp = dataset.profiles[c.franqueado_id] ?? c.franqueado_id.slice(0, 8);
                    return (
                      <li key={c.id}>
                        <Link
                          href={buildOpenCardHref(openCardBase, c.id)}
                          className="block rounded-lg border px-3 py-2.5 transition hover:bg-[var(--moni-surface-100)]"
                          style={{ borderColor: MONI.surface200 }}
                          onClick={() => setDrawerFaseId(null)}
                        >
                          <p className="font-medium leading-snug" style={{ color: MONI.navy900 }}>
                            {c.titulo}
                          </p>
                          <p className="mt-1 text-xs" style={{ color: MONI.textSecondary }}>
                            Responsável: {resp}
                          </p>
                          <p className="mt-0.5 text-xs" style={{ color: MONI.textMuted }}>
                            {slaMetaLine}
                          </p>
                          {slaSt && slaBadgeStyle ? (
                            <span
                              className="mt-1 inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={slaBadgeStyle}
                            >
                              {slaSt.label}
                            </span>
                          ) : null}
                          <p className="mt-1 text-[11px] font-semibold" style={{ color: MONI.textSecondary }}>
                            Status: {linhaStatusCard(c)}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
