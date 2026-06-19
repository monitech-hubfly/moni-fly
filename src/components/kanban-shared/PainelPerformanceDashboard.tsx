'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDown,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  deriveFluxoMetrics,
  deriveQualidadeMetrics,
  deriveQualidadeOperacional,
  deriveConversaoPorCidade,
  gargalosBaixos,
  gargalosVisiveis,
  insightSeveridade,
  maxFunnelBar,
  pastelariaPorFaseId,
  semMotivoNaFase,
  tempoMedioConversaoPorResponsavel,
} from '@/lib/kanban/painel-dashboard-derive';
import { computePainelPerformance } from '@/lib/kanban/painel-performance-compute';
import {
  applyPainelFiltros,
  buildPainelFiltrosOpcoes,
  PAINEL_FILTROS_INICIAL,
  type PainelFiltrosState,
} from '@/lib/kanban/painel-filtros';
import type {
  ConversionFunnelTreeNode,
  GargaloClassificacao,
  GargaloScoreFase,
  PainelCarometroFranquiaCount,
  PainelCarometroIndicadores,
  PainelInsight,
  PainelPerformanceDataset,
  PainelPeriodKey,
} from '@/lib/kanban/painel-performance-types';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  computePortfolioEspecificidades,
  type PainelPortfolioEspecificidades,
} from '@/lib/kanban/painel-portfolio-especificidades-compute';
import {
  computeStepOneEspecificidades,
  type PainelStepOneEspecificidades,
} from '@/lib/kanban/painel-stepone-especificidades-compute';
import {
  computeAcoplamentoEspecificidades,
  type PainelAcoplamentoEspecificidades,
} from '@/lib/kanban/painel-acoplamento-especificidades-compute';
import {
  computeOperacoesEspecificidades,
  type PainelOperacoesEspecificidades,
} from '@/lib/kanban/painel-operacoes-especificidades-compute';
import {
  computeLoteadoresEspecificidades,
  type PainelLoteadoresEspecificidades,
} from '@/lib/kanban/painel-loteadores-especificidades-compute';
import {
  computeCreditoObraEspecificidades,
  type PainelCreditoObraEspecificidades,
} from '@/lib/kanban/painel-credito-obra-especificidades-compute';
import {
  computeContabilidadeEspecificidades,
  type PainelContabilidadeEspecificidades,
} from '@/lib/kanban/painel-contabilidade-especificidades-compute';
import { buildPainelArquivadosDrawerRows } from '@/lib/kanban/painel-arquivados-drawer';
import { PainelArquivadosDrawer } from './PainelArquivadosDrawer';
import { PainelQualidadeMotivoAlert } from './PainelQualidadeMotivoAlert';
import {
  buildRetrocessoDiasByCardId,
  FunnelVolumeBar,
  GargaloPrincipalFactor,
  GargaloScoreBar,
  insightSeverityAccent,
  resolveFunnelBarTone,
  SlaProgressBar,
} from './PainelPerformanceVisualParts';

const PERIOD_OPTIONS: { key: PainelPeriodKey; label: string }[] = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: 'all', label: 'Tudo' },
];

type DashboardTab = 'operacao' | 'qualidade';

function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n);
}

function formatPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

function formatDec(n: number | null, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function formatDias(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${Math.round(n)} d.u.`;
}

function formatDiasCorridos(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${Math.round(n)} dias`;
}

function DegradeNote({ children }: { children: string }) {
  return (
    <p className="mt-2 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
      {children}
    </p>
  );
}

function gargaloClassificacaoLabel(c: GargaloClassificacao): string {
  if (c === 'critico') return 'Crítico';
  if (c === 'atencao') return 'Atenção';
  return 'Baixo';
}

function gargaloTagClass(c: GargaloClassificacao): string {
  if (c === 'critico') return 'moni-tag-atrasado';
  if (c === 'atencao') return 'moni-tag-atencao';
  return 'moni-tag-concluido';
}

function GargaloScoreBadge({ classificacao }: { classificacao: GargaloClassificacao }) {
  return (
    <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium ${gargaloTagClass(classificacao)}`}>
      {gargaloClassificacaoLabel(classificacao)}
    </span>
  );
}

function buildOpenCardHref(basePath: string, cardId: string): string {
  const sep = basePath.includes('?') ? '&' : '?';
  return `${basePath}${sep}tab=kanban&card=${encodeURIComponent(cardId)}`;
}

const panelStyle: React.CSSProperties = {
  borderRadius: 'var(--moni-radius-lg)',
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
};

const selectStyle: React.CSSProperties = {
  borderRadius: 'var(--moni-radius-md)',
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
  color: 'var(--moni-text-primary)',
  fontFamily: 'var(--moni-font-sans)',
};

function KpiCard({
  label,
  value,
  hint,
  progressPct,
}: {
  label: string;
  value: string | number;
  hint?: string;
  progressPct?: number | null;
}) {
  return (
    <div className="flex min-h-[88px] flex-col justify-between px-3 py-3" style={panelStyle}>
      <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
        {label}
      </p>
      <div>
        <p
          className="mt-1 text-xl font-semibold tabular-nums tracking-tight"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
        >
          {value}
        </p>
        {progressPct != null ? <SlaProgressBar pct={progressPct} /> : null}
      </div>
      {hint ? (
        <p className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--moni-text-tertiary)' }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 flex-1 px-2 py-2" style={{ ...panelStyle, borderRadius: 'var(--moni-radius-md)' }}>
      <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tabular-nums" style={{ color: 'var(--moni-navy-800)' }}>
        {value}
      </p>
    </div>
  );
}

function conversionPct(from: number, to: number): number | null {
  if (from <= 0) return null;
  return (to / from) * 100;
}

function MiniConfirmacaoFunnel({
  opcao,
  comite,
  contrato,
}: {
  opcao: number;
  comite: number;
  contrato: number;
}) {
  const steps = [
    { label: 'Opção', value: opcao },
    { label: 'Comitê', value: comite },
    { label: 'Contrato', value: contrato },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {steps.map((step, idx) => (
        <Fragment key={step.label}>
          <div
            className="flex min-w-[88px] flex-col items-center px-3 py-2.5 text-center"
            style={{ ...panelStyle, borderRadius: 'var(--moni-radius-md)' }}
          >
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              {step.label}
            </p>
            <p
              className="mt-1 text-lg font-semibold tabular-nums"
              style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
            >
              {formatInt(step.value)}
            </p>
          </div>
          {idx < steps.length - 1 ? (
            <div className="flex flex-col items-center gap-0.5 px-1">
              <ArrowRight className="h-4 w-4 shrink-0" style={{ color: 'var(--moni-text-tertiary)' }} aria-hidden />
              <span className="text-[10px] tabular-nums" style={{ color: 'var(--moni-text-secondary)' }}>
                {formatPct(conversionPct(steps[idx]!.value, steps[idx + 1]!.value))}
              </span>
            </div>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

function DualLargeStat({
  left,
  right,
}: {
  left: { label: string; value: string; sub?: string; tone: 'verde' | 'ambar' | 'neutro' };
  right: { label: string; value: string; sub?: string; tone: 'verde' | 'ambar' | 'neutro' };
}) {
  const toneStyle = (tone: 'verde' | 'ambar' | 'neutro'): React.CSSProperties => {
    if (tone === 'verde') {
      return {
        background: 'var(--moni-status-done-bg)',
        border: '0.5px solid var(--moni-status-done-border)',
      };
    }
    if (tone === 'ambar') {
      return {
        background: 'var(--moni-status-attention-bg)',
        border: '0.5px solid var(--moni-status-attention-border)',
      };
    }
    return panelStyle;
  };

  const renderStat = (stat: { label: string; value: string; sub?: string; tone: 'verde' | 'ambar' | 'neutro' }) => (
    <div className="flex min-h-[88px] flex-1 flex-col justify-center px-4 py-4" style={{ ...toneStyle(stat.tone), borderRadius: 'var(--moni-radius-lg)' }}>
      <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
        {stat.label}
      </p>
      <p
        className="mt-1 text-2xl font-semibold tabular-nums tracking-tight"
        style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
      >
        {stat.value}
      </p>
      {stat.sub ? (
        <p className="mt-0.5 text-[11px]" style={{ color: 'var(--moni-text-secondary)' }}>
          {stat.sub}
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {renderStat(left)}
      {renderStat(right)}
    </div>
  );
}

function ProportionalBarRow({
  label,
  value,
  max,
  suffix,
  barColor,
  trailing,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  barColor?: string;
  trailing?: React.ReactNode;
}) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="min-w-0 flex-1 truncate text-[11px]" style={{ color: 'var(--moni-text-secondary)' }} title={label}>
        {label}
      </span>
      <div className="flex min-w-[120px] flex-[2] items-center gap-2">
        <div
          className="h-2 flex-1 overflow-hidden rounded-full"
          style={{ background: 'var(--moni-surface-200)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: barColor ?? 'var(--moni-navy-800)' }}
          />
        </div>
        <span className="w-14 shrink-0 text-right text-[11px] tabular-nums" style={{ color: 'var(--moni-text-primary)' }}>
          {suffix ?? formatInt(value)}
        </span>
      </div>
      {trailing}
    </div>
  );
}

function RedDaysBadge({ dias }: { dias: number }) {
  return (
    <span className="moni-tag-atrasado inline-flex rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums">
      {formatInt(dias)} dias
    </span>
  );
}

function CountRiskBadge({ count, threshold = 3 }: { count: number; threshold?: number }) {
  const isRisk = count >= threshold;
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold tabular-nums ${isRisk ? 'moni-tag-atrasado' : 'moni-tag-concluido'}`}
    >
      {formatInt(count)}
    </span>
  );
}

function PanelBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-4" style={panelStyle}>
      <h3 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function CollapsiblePanelBox({
  title,
  expanded,
  onToggle,
  expandLabel,
  collapseLabel = 'Ocultar',
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  expandLabel: string;
  collapseLabel?: string;
  children: React.ReactNode;
}) {
  const linkClass =
    'min-h-[44px] text-[11px] font-medium underline sm:min-h-[32px]';

  return (
    <div className="px-4 py-4" style={panelStyle}>
      <h3 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
        {title}
      </h3>
      {expanded ? (
        <>
          <div className="mt-3">{children}</div>
          <button
            type="button"
            className={`mt-3 ${linkClass}`}
            style={{ color: 'var(--moni-text-secondary)' }}
            onClick={onToggle}
          >
            {collapseLabel}
          </button>
        </>
      ) : (
        <button
          type="button"
          className={`mt-3 ${linkClass}`}
          style={{ color: 'var(--moni-navy-800)' }}
          onClick={onToggle}
        >
          {expandLabel}
        </button>
      )}
    </div>
  );
}

function DataTable({
  headers,
  rows,
  emptyMessage,
  alignRightFrom = 1,
}: {
  headers: string[];
  rows: string[][];
  emptyMessage: string;
  alignRightFrom?: number;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        {emptyMessage}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-left text-[11px]">
        <thead>
          <tr style={{ borderBottom: '0.5px solid var(--moni-border-subtle)' }}>
            {headers.map((h) => (
              <th
                key={h}
                className="pb-2 pr-3 font-semibold uppercase tracking-wide last:pr-0"
                style={{ color: 'var(--moni-text-tertiary)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, idx) => (
            <tr
              key={idx}
              className="transition-colors hover:bg-[var(--moni-surface-50)]"
              style={{ borderBottom: '0.5px solid var(--moni-border-subtle)' }}
            >
              {cells.map((cell, ci) => (
                <td
                  key={ci}
                  className={`py-2 pr-3 last:pr-0 ${ci >= alignRightFrom ? 'tabular-nums text-right' : ''}`}
                  style={{ color: ci === 0 ? 'var(--moni-text-secondary)' : 'var(--moni-text-primary)' }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ChamadosPorFaseRow = {
  faseId: string;
  faseNome: string;
  abertos: number;
  comTrava: number;
  vencidos: number;
  gargaloClassificacao: GargaloClassificacao | null;
  pastelaria: number;
};

function ChamadosPorFaseUnifiedTable({ rows }: { rows: ChamadosPorFaseRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        Sem chamados no recorte.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-[11px]">
        <thead>
          <tr style={{ borderBottom: '0.5px solid var(--moni-border-subtle)' }}>
            {['Fase', 'Score gargalo', 'Abertos', 'Trava', 'Vencidos', 'Pastelaria'].map((h, i) => (
              <th
                key={h}
                className={`pb-2 pr-3 font-semibold uppercase tracking-wide last:pr-0 ${i > 0 ? 'text-right' : ''}`}
                style={{ color: 'var(--moni-text-tertiary)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.faseId}
              className="transition-colors hover:bg-[var(--moni-surface-50)]"
              style={{ borderBottom: '0.5px solid var(--moni-border-subtle)' }}
            >
              <td className="py-2 pr-3" style={{ color: 'var(--moni-text-secondary)' }}>
                {r.faseNome}
              </td>
              <td className="py-2 pr-3 text-right">
                {r.gargaloClassificacao ? (
                  <GargaloScoreBadge classificacao={r.gargaloClassificacao} />
                ) : (
                  <span style={{ color: 'var(--moni-text-tertiary)' }}>—</span>
                )}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums" style={{ color: 'var(--moni-text-primary)' }}>
                {formatInt(r.abertos)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums" style={{ color: 'var(--moni-text-primary)' }}>
                {formatInt(r.comTrava)}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums" style={{ color: 'var(--moni-text-primary)' }}>
                {formatInt(r.vencidos)}
              </td>
              <td className="py-2 text-right tabular-nums" style={{ color: 'var(--moni-text-primary)' }}>
                {formatInt(r.pastelaria)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: 'vermelho' | 'ambar' | 'verde' | 'roxo' | 'neutro';
}) {
  const cls =
    tone === 'vermelho'
      ? 'moni-tag-atrasado'
      : tone === 'ambar'
        ? 'moni-tag-atencao'
        : tone === 'verde'
          ? 'moni-tag-concluido'
          : tone === 'roxo'
            ? 'moni-tag-arquivado'
            : 'moni-tag-arquivado';
  const style =
    tone === 'roxo'
      ? {
          background: 'var(--moni-navy-50)',
          color: 'var(--moni-navy-600)',
          border: '0.5px solid var(--moni-navy-200)',
        }
      : undefined;
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${cls}`} style={style}>
      {label}
    </span>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-[140px] flex-1 flex-col gap-1 sm:max-w-[200px]">
      <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
        {label}
      </span>
      <select
        className="min-h-[44px] w-full px-3 py-2 text-[11px] sm:min-h-[36px]"
        style={selectStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function FunnelConversionGrid({
  nodes,
  gargaloClassByFaseId,
  slaDelayByFaseId,
}: {
  nodes: ConversionFunnelTreeNode[];
  gargaloClassByFaseId: Map<string, GargaloClassificacao>;
  slaDelayByFaseId: Map<string, boolean>;
}) {
  if (nodes.length === 0) {
    return (
      <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        Nenhuma fase configurada neste funil.
      </p>
    );
  }

  const maxBar = maxFunnelBar(nodes);

  return (
    <div className="space-y-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-[11px]">
          <thead>
            <tr style={{ borderBottom: '0.5px solid var(--moni-border-subtle)' }}>
              {['Fase', 'Volume', 'N', '%', 'Tempo médio'].map((h) => (
                <th
                  key={h}
                  className={`pb-2 pr-3 font-semibold uppercase tracking-wide last:pr-0 ${h !== 'Fase' && h !== 'Volume' ? 'text-right' : ''}`}
                  style={{ color: 'var(--moni-text-tertiary)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodes.map((node, idx) => {
              const showPerda = idx > 0 && node.perdaAnteriorPct != null && node.perdaAnteriorPct > 0;
              const barTone = resolveFunnelBarTone(
                node,
                gargaloClassByFaseId.get(node.faseId),
                slaDelayByFaseId.get(node.faseId) ?? false,
              );
              return (
                <Fragment key={node.faseId}>
                  {showPerda ? (
                    <tr>
                      <td colSpan={5} className="py-0.5">
                        <div className="flex items-center justify-center">
                          <span
                            className="text-[11px] font-semibold tabular-nums"
                            style={{ color: 'var(--moni-status-overdue-text)' }}
                          >
                            −{formatPct(node.perdaAnteriorPct)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  <tr
                    className="transition-colors hover:bg-[var(--moni-surface-50)]"
                    style={{
                      borderBottom: '0.5px solid var(--moni-border-subtle)',
                      background: node.faseConversao ? 'var(--moni-navy-50)' : undefined,
                    }}
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span style={{ color: 'var(--moni-text-secondary)' }}>{node.faseNome}</span>
                        {node.faseConversao ? <Pill label="Conversão" tone="roxo" /> : null}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <FunnelVolumeBar value={node.alcancaram} max={maxBar} tone={barTone} />
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatInt(node.alcancaram)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatPct(node.pctSobreEntradas)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatDias(node.tempoMedioDias)}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GargaloRow({
  g,
  retornosFase = 0,
  onClick,
}: {
  g: GargaloScoreFase;
  retornosFase?: number;
  onClick?: () => void;
}) {
  const pills: { label: string; tone: 'vermelho' | 'ambar' | 'verde' | 'roxo' | 'neutro' }[] = [
    { label: `${formatInt(g.cardsNaFase)} cards`, tone: 'neutro' },
  ];
  if (g.cardsAtrasados > 0) pills.push({ label: `${formatInt(g.cardsAtrasados)} atrasados`, tone: 'vermelho' });
  if (g.cardsSemMovimentacao > 0) pills.push({ label: `${formatInt(g.cardsSemMovimentacao)} parados`, tone: 'ambar' });
  if (g.chamadosAbertos > 0) pills.push({ label: `${formatInt(g.chamadosAbertos)} chamados`, tone: 'roxo' });
  if (g.chamadosComTrava > 0) pills.push({ label: `${formatInt(g.chamadosComTrava)} trava`, tone: 'vermelho' });
  if (g.arquivamentosAntesConversao > 0)
    pills.push({ label: `${formatInt(g.arquivamentosAntesConversao)} perda`, tone: 'ambar' });
  if (retornosFase > 0) pills.push({ label: `${formatInt(retornosFase)} retorno de fase`, tone: 'roxo' });

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-[var(--moni-surface-50)]"
      style={{
        border: '0.5px solid var(--moni-border-default)',
        borderRadius: 'var(--moni-radius-lg)',
        background: 'var(--moni-surface-0)',
      }}
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium" style={{ color: 'var(--moni-text-primary)' }}>
            {g.faseNome}
          </span>
          <span className={`text-[10px] ${gargaloTagClass(g.classificacao)}`}>
            {gargaloClassificacaoLabel(g.classificacao)}
          </span>
        </div>
        <span className="text-lg font-semibold tabular-nums" style={{ color: 'var(--moni-navy-800)' }}>
          {g.score}
        </span>
      </div>
      <p className="mb-2 text-[11px] leading-relaxed" style={{ color: 'var(--moni-text-secondary)' }}>
        {g.principalMotivoTexto || g.principalMotivo}
      </p>
      <div className="flex flex-wrap gap-1">
        {pills.map((p) => (
          <Pill key={p.label} label={p.label} tone={p.tone} />
        ))}
      </div>
    </button>
  );
}

function InsightIcon({ ins }: { ins: PainelInsight }) {
  const sev = insightSeveridade(ins.tipo);
  if (sev === 'positivo') return <TrendingUp className="h-4 w-4 shrink-0" style={{ color: 'var(--moni-green-800)' }} />;
  if (sev === 'critico')
    return <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--moni-status-overdue-text)' }} />;
  return <TrendingDown className="h-4 w-4 shrink-0" style={{ color: 'var(--moni-gold-800)' }} />;
}

function carometroSecaoVisivel(kanbanId: string, carometro: PainelCarometroIndicadores): boolean {
  if (kanbanId === KANBAN_IDS.PORTFOLIO) {
    return (
      carometro.opcoes_assinadas_no_periodo != null ||
      carometro.contratos_assinados_no_periodo != null ||
      carometro.comite_para_contrato_taxa != null
    );
  }
  if (kanbanId === KANBAN_IDS.STEP_ONE) {
    return carometro.hipoteses_no_periodo != null;
  }
  if (kanbanId === KANBAN_IDS.ACOPLAMENTO) {
    return carometro.acoplamentos_por_origem != null;
  }
  return false;
}

function FranquiaBreakdownTable({
  rows,
  emptyMessage,
}: {
  rows: PainelCarometroFranquiaCount[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="mt-2 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        {emptyMessage}
      </p>
    );
  }
  return (
    <div className="mt-2">
      <DataTable
        headers={['Franquia / unidade', 'Qtd.']}
        emptyMessage={emptyMessage}
        rows={rows.map((r) => [r.label, formatInt(r.quantidade)])}
      />
    </div>
  );
}

function CarometroIndicadorCard({
  title,
  total,
  porFranquia,
  emptyFranquiaMessage,
}: {
  title: string;
  total: number;
  porFranquia: PainelCarometroFranquiaCount[];
  emptyFranquiaMessage: string;
}) {
  return (
    <div className="px-4 py-4" style={panelStyle}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
          {title}
        </h4>
        <span
          className="text-xl font-semibold tabular-nums"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
        >
          {formatInt(total)}
        </span>
      </div>
      <FranquiaBreakdownTable rows={porFranquia} emptyMessage={emptyFranquiaMessage} />
    </div>
  );
}

function CarometroPortfolioBlock({ carometro }: { carometro: PainelCarometroIndicadores }) {
  const taxa = carometro.comite_para_contrato_taxa;
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {carometro.opcoes_assinadas_no_periodo != null ? (
        <CarometroIndicadorCard
          title="Opções assinadas no período"
          total={carometro.opcoes_assinadas_no_periodo.total}
          porFranquia={carometro.opcoes_assinadas_no_periodo.porFranquia}
          emptyFranquiaMessage="Nenhuma opção assinada vinculada a franquia no recorte."
        />
      ) : null}
      {carometro.contratos_assinados_no_periodo != null ? (
        <CarometroIndicadorCard
          title="Contratos assinados no período"
          total={carometro.contratos_assinados_no_periodo.total}
          porFranquia={carometro.contratos_assinados_no_periodo.porFranquia}
          emptyFranquiaMessage="Nenhum contrato assinado vinculado a franquia no recorte."
        />
      ) : null}
      {taxa != null ? (
        <div className="px-4 py-4 lg:col-span-2" style={panelStyle}>
          <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
            Taxa Comitê → Contrato
          </h4>
          <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
            Comitês aprovados ÷ contratos assinados no período (confirmações registradas no card).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <MiniKpi label="Comitês aprovados" value={formatInt(taxa.numerador)} />
            <MiniKpi label="Contratos assinados" value={formatInt(taxa.denominador)} />
            <MiniKpi label="Taxa" value={formatPct(taxa.percentual)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CarometroStepOneBlock({ carometro }: { carometro: PainelCarometroIndicadores }) {
  const hip = carometro.hipoteses_no_periodo;
  if (!hip) return null;
  return (
    <CarometroIndicadorCard
      title="Hipóteses no período"
      total={hip.total}
      porFranquia={hip.porFranquia}
      emptyFranquiaMessage="Nenhuma hipótese vinculada a franquia no recorte."
    />
  );
}

function CarometroAcoplamentoBlock({ carometro }: { carometro: PainelCarometroIndicadores }) {
  const rows = carometro.acoplamentos_por_origem;
  if (!rows) return null;
  return (
    <PanelBox title="Acoplamentos concluídos por origem">
      <DataTable
        headers={['Origem', 'Quantidade']}
        emptyMessage="Nenhum acoplamento concluído (fase aprovada) no recorte."
        rows={rows.map((r) => [r.origem, formatInt(r.quantidade)])}
      />
    </PanelBox>
  );
}

function CarometroIndicadoresSection({
  kanbanId,
  carometro,
}: {
  kanbanId: string;
  carometro: PainelCarometroIndicadores;
}) {
  if (!carometroSecaoVisivel(kanbanId, carometro)) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Conectado ao Carômetro
        </h2>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Alimentado automaticamente pelos dados do funil
        </p>
      </div>

      {kanbanId === KANBAN_IDS.PORTFOLIO ? <CarometroPortfolioBlock carometro={carometro} /> : null}
      {kanbanId === KANBAN_IDS.STEP_ONE ? <CarometroStepOneBlock carometro={carometro} /> : null}
      {kanbanId === KANBAN_IDS.ACOPLAMENTO ? <CarometroAcoplamentoBlock carometro={carometro} /> : null}
    </section>
  );
}

function PortfolioEspecificidadesSection({ data }: { data: PainelPortfolioEspecificidades }) {
  return (
    <section className="space-y-3">
      <div>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Especificidades — Portfólio
        </h2>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Confirmações de fase (migration 389) e histórico de movimentação
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.taxaAprovacaoComite != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Taxa de aprovação em Comitê
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              comite_aprovado no período ÷ cards que chegaram à fase Comitê no período.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Aprovados" value={formatInt(data.taxaAprovacaoComite.aprovados)} />
              <MiniKpi label="Chegaram ao Comitê" value={formatInt(data.taxaAprovacaoComite.chegaramComite)} />
              <MiniKpi label="Taxa" value={formatPct(data.taxaAprovacaoComite.percentual)} />
            </div>
          </div>
        ) : null}

        {data.tempoOpcaoAteComite != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Tempo de Opção até Comitê
            </h4>
            <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
              opcao_assinada_em → comite_aprovado_em (dias úteis).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Mediana" value={formatDias(data.tempoOpcaoAteComite.medianaDiasUteis)} />
              <MiniKpi label="P90" value={formatDias(data.tempoOpcaoAteComite.p90DiasUteis)} />
              <MiniKpi label="Amostras" value={formatInt(data.tempoOpcaoAteComite.amostras)} />
            </div>
            {data.tempoOpcaoAteComite.insuficiente ? (
              <DegradeNote>
                Menos de 3 cards com opcao_assinada_em e comite_aprovado_em — mediana e P90 indisponíveis.
              </DegradeNote>
            ) : data.tempoOpcaoAteComite.amostras === 0 ? (
              <DegradeNote>Sem pares de datas de confirmação no recorte.</DegradeNote>
            ) : null}
          </div>
        ) : null}

        {data.moniCapitalPctContrato != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Cards em Moní Capital
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Ativos ou arquivados em captacao_moni_capital ÷ cards que passaram por step_7 (Contrato).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi
                label="Em Moní Capital"
                value={formatInt(data.moniCapitalPctContrato.emCaptacaoMoniCapital)}
              />
              <MiniKpi
                label="Passaram por Contrato"
                value={formatInt(data.moniCapitalPctContrato.chegaramContrato)}
              />
              <MiniKpi label="%" value={formatPct(data.moniCapitalPctContrato.percentual)} />
            </div>
          </div>
        ) : null}

        {data.taxaComiteVirandoContrato != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Taxa Comitê → Contrato
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              contrato_assinado ÷ comite_aprovado no período. Meta: 100%.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi
                label="Contratos assinados"
                value={formatInt(data.taxaComiteVirandoContrato.contratosAssinados)}
              />
              <MiniKpi
                label="Comitês aprovados"
                value={formatInt(data.taxaComiteVirandoContrato.comitesAprovados)}
              />
              <MiniKpi label="Taxa" value={formatPct(data.taxaComiteVirandoContrato.percentual)} />
            </div>
            <p className="mt-2 text-[10px] italic" style={{ color: 'var(--moni-text-tertiary)' }}>
              meta: 100%
            </p>
          </div>
        ) : null}
      </div>

      {data.perdaDecisao != null ? (
        <PanelBox title="Perda por origem — decisão interna vs. externa">
          <p className="mb-3 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
            Cards arquivados no período, classificados pelo texto de motivo_arquivamento (crédito, produto,
            viabilidade, comitê → interna; desistência, terrenista, parceiro → externa).
          </p>
          <DataTable
            headers={['Origem', 'Qtd.', '% do total arquivado']}
            emptyMessage="Sem arquivamentos no recorte."
            rows={data.perdaDecisao.linhas.map((linha) => [
              linha.origem,
              formatInt(linha.quantidade),
              formatPct(linha.percentual),
            ])}
          />
        </PanelBox>
      ) : null}
    </section>
  );
}

function StepOneEspecificidadesSection({
  data,
  openCardBase,
}: {
  data: PainelStepOneEspecificidades;
  openCardBase: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Especificidades — Step One
        </h2>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Histórico de fases, conversão para o Portfólio e permanência nas etapas intermediárias
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data.taxaAprovacaoHipoteses != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Taxa de aprovação em Hipóteses
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Entradas na fase Hipóteses no período ÷ entradas no funil no período.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Entraram em Hipóteses" value={formatInt(data.taxaAprovacaoHipoteses.entraramHipoteses)} />
              <MiniKpi label="Entradas no funil" value={formatInt(data.taxaAprovacaoHipoteses.entradasFunil)} />
              <MiniKpi label="Taxa" value={formatPct(data.taxaAprovacaoHipoteses.percentual)} />
            </div>
            {data.taxaAprovacaoHipoteses.entradasFunil === 0 ? (
              <DegradeNote>Sem entradas no funil no recorte analisado.</DegradeNote>
            ) : null}
          </div>
        ) : null}

        {data.cardsParadosIntermediarios != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Cards parados em fases intermediárias
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Ativos há mais de {data.cardsParadosIntermediarios.limiteDias} dias em dados_candidato,
              dados_cidade, mapa_competidores, dados_condominios ou lotes_disponiveis.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Total parados" value={formatInt(data.cardsParadosIntermediarios.total)} />
            </div>
            {data.cardsParadosIntermediarios.total === 0 ? (
              <DegradeNote>Nenhum card ativo parado além do limite no recorte.</DegradeNote>
            ) : null}
          </div>
        ) : null}
      </div>

      {data.conversaoPortfolio != null ? (
        <PanelBox title="Conversão Step One → Portfólio por franquia">
          <p className="mb-3 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
            Cards que passaram por Hipóteses e geraram card no Portfólio (via origem_card_id), agrupados
            por n_franquia.
          </p>
          {data.conversaoPortfolio.portfolioIndisponivel ? (
            <DegradeNote>
              Vínculo com Portfólio indisponível — conversões podem estar subestimadas.
            </DegradeNote>
          ) : null}
          <DataTable
            headers={['Franquia', 'Hipóteses', 'Gerou Portfólio', 'Taxa']}
            emptyMessage="Sem cards com franquia identificada no recorte."
            rows={data.conversaoPortfolio.porFranquia.slice(0, 20).map((p) => [
              p.label,
              formatInt(p.hipoteses),
              formatInt(p.gerouPortfolio),
              formatPct(p.taxa),
            ])}
            alignRightFrom={1}
          />
        </PanelBox>
      ) : null}

      {data.tempoFasesPesquisa != null ? (
        <PanelBox title="Tempo médio nas fases de pesquisa">
          <p className="mb-3 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
            Permanência calculada via kanban_historico e entered_fase_at (dias corridos).
          </p>
          <DataTable
            headers={['Fase', 'Tempo médio', 'Cards analisados']}
            emptyMessage="Sem visitas registradas às fases de pesquisa no recorte."
            rows={data.tempoFasesPesquisa.linhas.map((l) => [
              l.faseNome,
              formatDiasCorridos(l.tempoMedioDias),
              formatInt(l.cardsAnalisados),
            ])}
            alignRightFrom={1}
          />
          <p className="mt-3 text-[10px] italic leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
            Fases lentas indicam mercado difícil ou franqueado sem suporte técnico.
          </p>
          {data.tempoFasesPesquisa.historicoParcial ? (
            <DegradeNote>
              Histórico de movimentação incompleto em parte dos cards — tempos são aproximados.
            </DegradeNote>
          ) : null}
        </PanelBox>
      ) : null}

      {data.cardsParadosIntermediarios != null && data.cardsParadosIntermediarios.itens.length > 0 ? (
        <PanelBox title="Lista — cards parados">
          <ul className="divide-y" style={{ borderColor: 'var(--moni-border-subtle)' }}>
            {data.cardsParadosIntermediarios.itens.slice(0, 25).map((item) => (
              <li
                key={item.cardId}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 text-[11px] first:pt-0 last:pb-0"
              >
                <Link
                  href={buildOpenCardHref(openCardBase, item.cardId)}
                  className="min-w-0 truncate font-medium hover:underline"
                  style={{ color: 'var(--moni-navy-800)' }}
                >
                  {item.titulo}
                </Link>
                <span className="shrink-0 tabular-nums" style={{ color: 'var(--moni-text-secondary)' }}>
                  {item.faseNome} · {formatInt(item.diasNaFase)} dias
                </span>
              </li>
            ))}
          </ul>
        </PanelBox>
      ) : null}
    </section>
  );
}

function AcoplamentoEspecificidadesSection({ data }: { data: PainelAcoplamentoEspecificidades }) {
  return (
    <section className="space-y-3">
      <div>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Especificidades — Acoplamento
        </h2>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Aprovação na 1ª tentativa, origem do card e permanência nas fases técnicas
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.taxaAprovacaoTentativa != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Taxa de aprovação na primeira tentativa
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Chegaram a acoplamento_aprovado sem passagem prévia por alteracoes_acoplamento
              (kanban_historico + is_retrocesso).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi
                label="Aprovados direto"
                value={formatInt(data.taxaAprovacaoTentativa.aprovadosPrimeiraTentativa)}
              />
              <MiniKpi
                label="Com revisão"
                value={formatInt(data.taxaAprovacaoTentativa.aprovadosComRevisoes)}
              />
              <MiniKpi
                label="Taxa 1ª tentativa"
                value={formatPct(data.taxaAprovacaoTentativa.pctPrimeiraTentativa)}
              />
            </div>
            {data.taxaAprovacaoTentativa.totalAprovados === 0 ? (
              <DegradeNote>Nenhum card em acoplamento_aprovado no recorte analisado.</DegradeNote>
            ) : null}
          </div>
        ) : null}

        {data.paralisadosPct != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Cards em Paralisados
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Ativos na fase acoplamento_reprovado em relação ao total de cards ativos no funil.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Em Paralisados" value={formatInt(data.paralisadosPct.emParalisados)} />
              <MiniKpi label="Ativos no funil" value={formatInt(data.paralisadosPct.totalCards)} />
              <MiniKpi label="%" value={formatPct(data.paralisadosPct.percentual)} />
            </div>
            {data.paralisadosPct.totalCards === 0 ? (
              <DegradeNote>Sem cards ativos no recorte analisado.</DegradeNote>
            ) : null}
          </div>
        ) : null}
      </div>

      {data.acoplamentosPorOrigem != null ? (
        <PanelBox title="Acoplamentos por funil de origem">
          <p className="mb-3 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
            Distribuição por origem_kanban_nome (migration 389).
          </p>
          {data.acoplamentosPorOrigem.origemIndisponivel ? (
            <DegradeNote>
              Campo origem_kanban_nome indisponível — distribuição por origem pode estar incompleta.
            </DegradeNote>
          ) : null}
          <DataTable
            headers={['Origem', 'Quantidade', '% do total']}
            emptyMessage="Sem cards no recorte analisado."
            rows={data.acoplamentosPorOrigem.linhas.slice(0, 15).map((r) => [
              r.origem,
              formatInt(r.quantidade),
              formatPct(r.percentual),
            ])}
            alignRightFrom={1}
          />
        </PanelBox>
      ) : null}

      {data.tempoFasesTecnicas != null ? (
        <PanelBox title="Tempo médio por fase técnica">
          <p className="mb-3 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
            Permanência em cada fase via kanban_historico (dias corridos).
          </p>
          <DataTable
            headers={['Fase', 'Tempo médio', 'Cards analisados']}
            emptyMessage="Sem visitas registradas às fases técnicas no recorte."
            rows={data.tempoFasesTecnicas.linhas.map((l) => [
              l.faseNome,
              formatDiasCorridos(l.tempoMedioDias),
              formatInt(l.cardsAnalisados),
            ])}
            alignRightFrom={1}
          />
          {data.tempoFasesTecnicas.historicoParcial ? (
            <DegradeNote>
              Histórico de movimentação incompleto em parte dos cards — tempos são aproximados.
            </DegradeNote>
          ) : null}
        </PanelBox>
      ) : null}
    </section>
  );
}

function OperacoesEspecificidadesSection({
  data,
  openCardBase,
}: {
  data: PainelOperacoesEspecificidades;
  openCardBase: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Especificidades — Operações
        </h2>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Tempos de aprovação por praça, retrabalho BCA e gargalos de crédito no funil Pré Obra e Obra
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data.taxaRetrabalhoBca != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Taxa de retrabalho em Revisão do BCA
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Cards que retornaram à fase revisao_bca (is_retrocesso) — passagem mais de uma vez.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Total retrabalho" value={formatInt(data.taxaRetrabalhoBca.comRetrabalho)} />
              <MiniKpi label="Total em obra" value={formatInt(data.taxaRetrabalhoBca.totalEmObra)} />
              <MiniKpi label="%" value={formatPct(data.taxaRetrabalhoBca.percentual)} />
            </div>
            {data.taxaRetrabalhoBca.totalEmObra === 0 ? (
              <DegradeNote>Sem cards ativos em obra no recorte analisado.</DegradeNote>
            ) : data.taxaRetrabalhoBca.comRetrabalho === 0 ? (
              <DegradeNote>Nenhum retrabalho registrado em Revisão do BCA no recorte.</DegradeNote>
            ) : null}
          </div>
        ) : null}

        {data.aguardandoCredito30Dias != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Aguardando Crédito há mais de 30 dias
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Ativos em aguardando_credito com entered_fase_at acima de 30 dias corridos.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Parados > 30 dias" value={formatInt(data.aguardandoCredito30Dias.acima30Dias)} />
            </div>
            {data.aguardandoCredito30Dias.acima30Dias === 0 ? (
              <DegradeNote>Nenhum card ativo em Aguardando Crédito há mais de 30 dias.</DegradeNote>
            ) : null}
          </div>
        ) : null}
      </div>

      {data.tempoAprovacaoCondominio != null ? (
        <PanelBox title="Tempo médio de Aprovação no Condomínio por condomínio">
          <p className="mb-3 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
            Permanência em aprovacao_condominio agrupada por condomínio (projeto_negocio ou card).
          </p>
          {data.tempoAprovacaoCondominio.localIndisponivel ? (
            <DegradeNote>
              Condomínio indisponível no fetch — agrupamento pode usar rótulos genéricos.
            </DegradeNote>
          ) : null}
          <DataTable
            headers={['Condomínio', 'Tempo médio', 'Cards']}
            emptyMessage="Sem permanência registrada na fase Aprovação no Condomínio."
            rows={data.tempoAprovacaoCondominio.porCondominio.slice(0, 12).map((r) => [
              r.label,
              formatDiasCorridos(r.mediaDias),
              formatInt(r.amostras),
            ])}
            alignRightFrom={1}
          />
          <p className="mt-3 text-[10px] italic leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
            Referência para o time de Acoplamento priorizar praças.
          </p>
        </PanelBox>
      ) : null}

      {data.tempoAprovacaoPrefeitura != null ? (
        <PanelBox title="Tempo médio de Aprovação na Prefeitura por cidade">
          <p className="mb-3 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
            Permanência em aprovacao_prefeitura agrupada por cidade (rede_franqueados / projeto_negocio).
          </p>
          {data.tempoAprovacaoPrefeitura.localIndisponivel ? (
            <DegradeNote>
              Cidade indisponível em rede_franqueados ou projeto_negocio — agrupamento parcial.
            </DegradeNote>
          ) : null}
          <DataTable
            headers={['Cidade', 'Tempo médio', 'Cards']}
            emptyMessage="Sem permanência registrada na fase Aprovação na Prefeitura."
            rows={data.tempoAprovacaoPrefeitura.porCidade.slice(0, 12).map((r) => [
              r.label,
              formatDiasCorridos(r.mediaDias),
              formatInt(r.amostras),
            ])}
            alignRightFrom={1}
          />
          <p className="mt-3 text-[10px] italic leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
            Dado estratégico para priorização de praças.
          </p>
        </PanelBox>
      ) : null}

      {data.aguardandoCredito30Dias != null && data.aguardandoCredito30Dias.itens.length > 0 ? (
        <PanelBox title="Lista — Aguardando Crédito > 30 dias">
          <ul className="divide-y" style={{ borderColor: 'var(--moni-border-subtle)' }}>
            {data.aguardandoCredito30Dias.itens.slice(0, 25).map((item) => (
              <li
                key={item.cardId}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 text-[11px] first:pt-0 last:pb-0"
              >
                <Link
                  href={buildOpenCardHref(openCardBase, item.cardId)}
                  className="min-w-0 truncate font-medium hover:underline"
                  style={{ color: 'var(--moni-navy-800)' }}
                >
                  {item.titulo}
                </Link>
                <span className="shrink-0 tabular-nums" style={{ color: 'var(--moni-text-secondary)' }}>
                  {formatInt(item.diasParados)} dias parados
                </span>
              </li>
            ))}
          </ul>
        </PanelBox>
      ) : null}
    </section>
  );
}

function LoteadoresEspecificidadesSection({
  data,
  openCardBase,
}: {
  data: PainelLoteadoresEspecificidades;
  openCardBase: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Especificidades — Loteadores
        </h2>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Conversão por parceiro, ciclo R1 → Contrato e gargalos em Viabilidade
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data.tempoR1AteContrato != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Tempo R1 até Contrato de Parceria
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              r1_conceito_moni_inc → contrato_parceria_moni_inc (dias corridos via kanban_historico).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Mediana" value={formatDiasCorridos(data.tempoR1AteContrato.medianaDias)} />
              <MiniKpi label="P90" value={formatDiasCorridos(data.tempoR1AteContrato.p90Dias)} />
              <MiniKpi label="Cards analisados" value={formatInt(data.tempoR1AteContrato.amostras)} />
            </div>
            {data.tempoR1AteContrato.historicoParcial ? (
              <DegradeNote>
                Histórico de movimentação incompleto em parte dos cards — tempos são aproximados.
              </DegradeNote>
            ) : null}
            {data.tempoR1AteContrato.amostras === 0 ? (
              <DegradeNote>Sem pares R1 → Contrato registrados no recorte.</DegradeNote>
            ) : null}
          </div>
        ) : null}

        {data.viabilidadeSemMovimentacao15Dias != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Viabilidade sem movimentação há 15+ dias
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Ativos em viabilidade_moni_inc há mais de 15 dias sem fase_avancada ou fase_retrocedida.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi
                label="Parados"
                value={formatInt(data.viabilidadeSemMovimentacao15Dias.acima15Dias)}
              />
            </div>
            {data.viabilidadeSemMovimentacao15Dias.acima15Dias === 0 ? (
              <DegradeNote>Nenhum card parado em Viabilidade além do limite no recorte.</DegradeNote>
            ) : null}
          </div>
        ) : null}
      </div>

      {data.conversaoPorLoteador != null ? (
        <PanelBox title="Taxa de conversão por loteador">
          {data.conversaoPorLoteador.loteadorIndisponivel ? (
            <DegradeNote>Vínculo com loteador não disponível neste funil.</DegradeNote>
          ) : (
            <DataTable
              headers={['Loteador', 'Entradas', 'Conversões', 'Taxa']}
              emptyMessage="Sem cards com loteador vinculado no recorte."
              rows={data.conversaoPorLoteador.linhas.slice(0, 15).map((r) => [
                r.label,
                formatInt(r.entradas),
                formatInt(r.converteram),
                formatPct(r.taxaConversaoPct),
              ])}
              alignRightFrom={1}
            />
          )}
        </PanelBox>
      ) : null}

      {data.loteadoresComMaisDe2Ativos != null ? (
        <PanelBox title="Concentração de risco por loteador">
          {data.loteadoresComMaisDe2Ativos.loteadorIndisponivel ? (
            <DegradeNote>Vínculo com loteador não disponível neste funil.</DegradeNote>
          ) : data.loteadoresComMaisDe2Ativos.linhas.length === 0 ? (
            <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
              Nenhum loteador com concentração.
            </p>
          ) : (
            <DataTable
              headers={['Loteador', 'Cards ativos']}
              emptyMessage="Nenhum loteador com concentração."
              rows={data.loteadoresComMaisDe2Ativos.linhas.slice(0, 15).map((r) => [
                r.label,
                formatInt(r.cardsAtivos),
              ])}
              alignRightFrom={1}
            />
          )}
        </PanelBox>
      ) : null}

      {data.viabilidadeSemMovimentacao15Dias != null &&
      data.viabilidadeSemMovimentacao15Dias.itens.length > 0 ? (
        <PanelBox title="Lista — Viabilidade parada">
          <ul className="divide-y" style={{ borderColor: 'var(--moni-border-subtle)' }}>
            {data.viabilidadeSemMovimentacao15Dias.itens.slice(0, 25).map((item) => (
              <li
                key={item.cardId}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 text-[11px] first:pt-0 last:pb-0"
              >
                <Link
                  href={buildOpenCardHref(openCardBase, item.cardId)}
                  className="min-w-0 truncate font-medium hover:underline"
                  style={{ color: 'var(--moni-navy-800)' }}
                >
                  {item.titulo}
                </Link>
                <span className="shrink-0 tabular-nums" style={{ color: 'var(--moni-text-secondary)' }}>
                  {formatInt(item.diasParados)} dias parados
                </span>
              </li>
            ))}
          </ul>
        </PanelBox>
      ) : null}
    </section>
  );
}

function formatVsPeriodoAnterior(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(0)}%`;
}

function CreditoObraEspecificidadesSection({
  data,
  openCardBase,
}: {
  data: PainelCreditoObraEspecificidades;
  openCardBase: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Especificidades — Crédito Obra
        </h2>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Ciclo por tranche, aprovação da 1ª tranche, espera entre fases co_* e correlação com Operações
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data.taxaAprovacaoPrimeiraTranche != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Taxa de aprovação da 1ª tranche na primeira tentativa
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Avançaram da 1ª tranche sem is_retrocesso às fases co_aguardando_1a_tranche,
              co_solicitacao_tranche ou co_sharepoint_cashme.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi
                label="Aprovados direto"
                value={formatInt(data.taxaAprovacaoPrimeiraTranche.aprovadosPrimeiraTentativa)}
              />
              <MiniKpi
                label="Com revisão"
                value={formatInt(data.taxaAprovacaoPrimeiraTranche.aprovadosComRevisoes)}
              />
              <MiniKpi
                label="Taxa"
                value={formatPct(data.taxaAprovacaoPrimeiraTranche.pctPrimeiraTentativa)}
              />
            </div>
            {data.taxaAprovacaoPrimeiraTranche.aprovadosPrimeiraTentativa +
              data.taxaAprovacaoPrimeiraTranche.aprovadosComRevisoes ===
            0 ? (
              <DegradeNote>Nenhum card com 1ª tranche concluída no recorte.</DegradeNote>
            ) : null}
          </div>
        ) : null}

        {data.correlacaoAtrasoOperacoes != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Relação Crédito Obra × Operações
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Projetos com card ativo atrasado (SLA) simultaneamente nos dois funis (projeto_negocio_id).
            </p>
            {data.correlacaoAtrasoOperacoes.projetoIndisponivel ? (
              <DegradeNote>projeto_negocio_id indisponível — correlação cross-funil não calculada.</DegradeNote>
            ) : data.correlacaoAtrasoOperacoes.operacoesIndisponivel ? (
              <DegradeNote>
                Cards de Operações vinculados ao mesmo projeto indisponíveis.
              </DegradeNote>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  <MiniKpi
                    label="Projetos com duplo atraso"
                    value={formatInt(data.correlacaoAtrasoOperacoes.projetosDuploAtraso)}
                  />
                </div>
                <p className="mt-2 text-[10px] italic leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Indica que o atraso no crédito está impactando a obra.
                </p>
              </>
            )}
          </div>
        ) : null}
      </div>

      {data.tempoMedioPorTranche != null ? (
        <PanelBox title="Tempo médio por tranche">
          {data.tempoMedioPorTranche.historicoParcial ? (
            <DegradeNote>
              Histórico de movimentação incompleto em parte dos cards — tempos são aproximados.
            </DegradeNote>
          ) : null}
          <DataTable
            headers={['Tranche', 'Tempo médio', 'Cards', 'vs período anterior']}
            emptyMessage="Sem ciclos de tranche registrados no recorte."
            rows={data.tempoMedioPorTranche.linhas.map((r) => [
              r.acimaMedianaGeral ? `${r.tranche} ↑` : r.tranche,
              formatDiasCorridos(r.mediaDias),
              formatInt(r.amostras),
              formatVsPeriodoAnterior(r.vsPeriodoAnteriorPct),
            ])}
            alignRightFrom={1}
          />
          {data.tempoMedioPorTranche.medianaGeral != null ? (
            <p className="mt-2 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
              ↑ = tempo acima da mediana geral ({formatDiasCorridos(data.tempoMedioPorTranche.medianaGeral)}).
            </p>
          ) : null}
        </PanelBox>
      ) : null}

      {data.paradosEntreTranches15Dias != null ? (
        <PanelBox title={`Cards parados entre tranches — ${formatInt(data.paradosEntreTranches15Dias.acima15Dias)} ativos há mais de 15 dias`}>
          <p className="mb-3 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
            entered_fase_at em fases co_* sem avanço recente.
          </p>
          {data.paradosEntreTranches15Dias.itens.length === 0 ? (
            <DegradeNote>Nenhum card parado além do limite no recorte.</DegradeNote>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'var(--moni-border-subtle)' }}>
              {data.paradosEntreTranches15Dias.itens.slice(0, 25).map((item) => (
                <li
                  key={item.cardId}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 text-[11px] first:pt-0 last:pb-0"
                >
                  <Link
                    href={buildOpenCardHref(openCardBase, item.cardId)}
                    className="min-w-0 truncate font-medium hover:underline"
                    style={{ color: 'var(--moni-navy-800)' }}
                  >
                    {item.titulo}
                  </Link>
                  <span className="shrink-0 tabular-nums" style={{ color: 'var(--moni-text-secondary)' }}>
                    {item.faseNome} · {formatInt(item.diasParados)} dias
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelBox>
      ) : null}
    </section>
  );
}

function formatVsSla(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)} d.u.`;
}

function ContabilidadeEspecificidadesSection({
  data,
  openCardBase,
}: {
  data: PainelContabilidadeEspecificidades;
  openCardBase: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Especificidades — Contabilidade
        </h2>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Tempo de abertura por tipo, bloqueio ao Crédito Obra e cumprimento de SLA
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.bloqueandoCreditoObra != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Cards bloqueando Crédito Obra
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Ativos em abertura contábil com card ativo no Crédito Obra (mesmo projeto_negocio_id).
            </p>
            {data.bloqueandoCreditoObra.projetoIndisponivel ? (
              <DegradeNote>projeto_negocio_id indisponível — cruzamento cross-funil não calculado.</DegradeNote>
            ) : data.bloqueandoCreditoObra.creditoObraIndisponivel ? (
              <DegradeNote>Cards Crédito Obra vinculados indisponíveis.</DegradeNote>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  <MiniKpi
                    label="Projetos bloqueados"
                    value={formatInt(data.bloqueandoCreditoObra.totalBloqueando)}
                  />
                </div>
                <p className="mt-2 text-[10px] italic leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Esses projetos estão aguardando a abertura para liberar o crédito.
                </p>
                {data.bloqueandoCreditoObra.totalBloqueando === 0 ? (
                  <DegradeNote>Nenhum bloqueio identificado no recorte.</DegradeNote>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {data.tempoAberturaPorTipo != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Tipos acima do SLA
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Incorporadora, SPE ou Gestora com tempo médio acima do SLA (fallback 7 d.u.).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi
                label="Tipos acima do SLA"
                value={formatInt(data.tempoAberturaPorTipo.tiposAcimaSla)}
              />
            </div>
          </div>
        ) : null}

        {data.taxaConclusaoSlaPorTipo != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Conclusão dentro do SLA
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Média ponderada no período — tempo em fase ≤ SLA configurado (dias úteis).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Taxa média" value={formatPct(data.taxaConclusaoSlaPorTipo.taxaMediaPct)} />
            </div>
          </div>
        ) : null}
      </div>

      {data.tempoAberturaPorTipo != null ? (
        <PanelBox title="Tempo médio por tipo de abertura">
          {data.tempoAberturaPorTipo.historicoParcial ? (
            <DegradeNote>
              Histórico de movimentação incompleto em parte dos cards — tempos são aproximados.
            </DegradeNote>
          ) : null}
          <DataTable
            headers={['Tipo', 'Tempo médio', 'SLA', 'vs SLA', 'Cards']}
            emptyMessage="Sem permanência registrada nas fases de abertura."
            rows={data.tempoAberturaPorTipo.linhas.map((r) => [
              r.acimaSla ? `${r.tipo} ↑` : r.tipo,
              formatDias(r.mediaDiasUteis),
              formatDias(r.slaDias),
              formatVsSla(r.vsSlaDias),
              formatInt(r.amostras),
            ])}
            alignRightFrom={1}
          />
          <p className="mt-2 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
            ↑ = tempo médio acima do SLA. SLA de kanban_fases.sla_dias ou 7 d.u. de fallback.
          </p>
        </PanelBox>
      ) : null}

      {data.bloqueandoCreditoObra != null &&
      !data.bloqueandoCreditoObra.projetoIndisponivel &&
      !data.bloqueandoCreditoObra.creditoObraIndisponivel &&
      data.bloqueandoCreditoObra.itens.length > 0 ? (
        <PanelBox title="Lista — projetos bloqueados">
          <ul className="divide-y" style={{ borderColor: 'var(--moni-border-subtle)' }}>
            {data.bloqueandoCreditoObra.itens.slice(0, 25).map((item) => (
              <li
                key={`${item.projetoId}-${item.contabilidadeCardId}`}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 text-[11px] first:pt-0 last:pb-0"
              >
                <Link
                  href={buildOpenCardHref(openCardBase, item.contabilidadeCardId)}
                  className="min-w-0 truncate font-medium hover:underline"
                  style={{ color: 'var(--moni-navy-800)' }}
                >
                  {item.titulo}
                </Link>
                <span className="shrink-0 tabular-nums" style={{ color: 'var(--moni-text-secondary)' }}>
                  {item.tipoAbertura}
                </span>
              </li>
            ))}
          </ul>
        </PanelBox>
      ) : null}

      {data.taxaConclusaoSlaPorTipo != null ? (
        <PanelBox title="Taxa de conclusão dentro do SLA por tipo">
          <p className="mb-3 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
            Saídas de fase no período com permanência ≤ SLA (dias úteis).
          </p>
          <DataTable
            headers={['Tipo', 'Concluídos', 'Dentro do SLA', 'Taxa']}
            emptyMessage="Sem saídas de fase registradas no histórico do período."
            rows={data.taxaConclusaoSlaPorTipo.linhas.map((r) => [
              r.tipo,
              formatInt(r.concluidos),
              formatInt(r.dentroSla),
              formatPct(r.taxaPct),
            ])}
            alignRightFrom={1}
          />
        </PanelBox>
      ) : null}
    </section>
  );
}

function InsightCard({ ins }: { ins: PainelInsight }) {
  const sev = insightSeveridade(ins.tipo);
  const border =
    sev === 'critico'
      ? 'var(--moni-status-overdue-border)'
      : sev === 'positivo'
        ? 'var(--moni-status-done-border)'
        : 'var(--moni-status-attention-border)';
  const bg =
    sev === 'critico'
      ? 'var(--moni-status-overdue-bg)'
      : sev === 'positivo'
        ? 'var(--moni-status-done-bg)'
        : 'var(--moni-status-attention-bg)';

  return (
    <li
      className="flex gap-3 rounded-lg px-3 py-3"
      style={{
        border: `0.5px solid ${border}`,
        background: bg,
        borderRadius: 'var(--moni-radius-lg)',
      }}
    >
      <InsightIcon ins={ins} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium leading-snug" style={{ color: 'var(--moni-text-primary)' }}>
          {ins.texto}
        </p>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          {ins.tipoLabel}
        </p>
      </div>
    </li>
  );
}

export function PainelPerformanceDashboard({ dataset }: { dataset: PainelPerformanceDataset }) {
  const pathname = usePathname();
  const [period, setPeriod] = useState<PainelPeriodKey>('30d');
  const [filtros, setFiltros] = useState<PainelFiltrosState>(PAINEL_FILTROS_INICIAL);
  const [tab, setTab] = useState<DashboardTab>('operacao');
  const [arquivadosDrawerOpen, setArquivadosDrawerOpen] = useState(false);
  const [gargalosExpandido, setGargalosExpandido] = useState(false);
  const [tempoMedioFaseExpandido, setTempoMedioFaseExpandido] = useState(false);
  const [transicoesExpandido, setTransicoesExpandido] = useState(false);

  const opcoesFiltros = useMemo(() => buildPainelFiltrosOpcoes(dataset), [dataset]);

  const dadosFiltrados = useMemo(
    () => applyPainelFiltros(dataset, filtros),
    [dataset, filtros],
  );

  const analise = useMemo(
    () =>
      computePainelPerformance({
        mode: dataset.mode,
        kanbanId: dataset.kanbanId,
        period,
        fases: dataset.fases,
        cards: dadosFiltrados.cards,
        cardsAnalise: dadosFiltrados.cardsAnalise,
        chamados: dadosFiltrados.chamados,
        retrocessoRows: dadosFiltrados.retrocessoRows,
        historicoMovimentos: dadosFiltrados.historicoMovimentos,
        historicoAnalise: dadosFiltrados.historicoAnalise,
        profiles: dataset.profiles,
        carometroFieldsAvailable: dataset.carometroFieldsAvailable,
      }),
    [
      dataset.mode,
      dataset.kanbanId,
      dataset.carometroFieldsAvailable,
      dataset.fases,
      dataset.profiles,
      dadosFiltrados,
      period,
    ],
  );

  const fluxo = useMemo(
    () =>
      deriveFluxoMetrics(
        analise,
        dadosFiltrados.cardsAnalise,
        dadosFiltrados.retrocessoRows,
        period,
      ),
    [analise, dadosFiltrados.cardsAnalise, dadosFiltrados.retrocessoRows, period],
  );

  const qualidade = useMemo(
    () =>
      deriveQualidadeMetrics(
        dadosFiltrados.cardsAnalise,
        dadosFiltrados.chamados,
        dataset.fases,
        analise,
      ),
    [dadosFiltrados.cardsAnalise, dadosFiltrados.chamados, dataset.fases, analise],
  );

  const cyclePorResp = useMemo(
    () => tempoMedioConversaoPorResponsavel(dadosFiltrados.cardsAnalise, dataset.profiles),
    [dadosFiltrados.cardsAnalise, dataset.profiles],
  );

  const retornoPorFaseMap = useMemo(
    () => new Map(fluxo.porFase.map((f) => [f.faseId, f.retornosFase])),
    [fluxo.porFase],
  );

  const gargalosTop = useMemo(() => gargalosVisiveis(analise.gargalos.ranking), [analise.gargalos.ranking]);
  const gargalosBaixo = useMemo(() => gargalosBaixos(analise.gargalos.ranking), [analise.gargalos.ranking]);
  const gargalosExibidos = useMemo(
    () => (gargalosExpandido ? [...gargalosTop, ...gargalosBaixo] : gargalosTop),
    [gargalosExpandido, gargalosTop, gargalosBaixo],
  );

  const transicoesAdjacentes = useMemo(
    () => analise.conversao.entreFases.filter((p) => p.alcancaramOrigem > 0),
    [analise.conversao.entreFases],
  );

  const todasTaxasZero = useMemo(() => {
    try {
      const rows = analise.conversao.porFase.filter((p) => p.alcancaram > 0);
      if (rows.length === 0) return true;
      return rows.every((p) => (p.taxaConversaoPct ?? 0) === 0);
    } catch {
      return false;
    }
  }, [analise.conversao.porFase]);

  const pastelariaPorFase = useMemo(
    () => pastelariaPorFaseId(dadosFiltrados.chamados, dadosFiltrados.cardsAnalise),
    [dadosFiltrados.chamados, dadosFiltrados.cardsAnalise],
  );

  const chamadosPorFaseUnificado = useMemo(() => {
    const gargaloMap = new Map(analise.gargalos.ranking.map((g) => [g.faseId, g]));
    return analise.chamados.porFase
      .filter((r) => r.total > 0 || r.abertos > 0)
      .sort((a, b) => b.abertos - a.abertos)
      .map((r) => ({
        faseId: r.faseId,
        faseNome: r.faseNome,
        abertos: r.abertos,
        comTrava: r.comTrava,
        vencidos: r.vencidos,
        gargaloClassificacao: gargaloMap.get(r.faseId)?.classificacao ?? null,
        pastelaria: pastelariaPorFase.get(r.faseId) ?? 0,
      }));
  }, [analise.chamados.porFase, analise.gargalos.ranking, pastelariaPorFase]);

  const arquivamentosPorFaseUnificado = useMemo(
    () =>
      [...analise.arquivamento.perdas.tabelaPorFase]
        .sort((a, b) => b.arquivados - a.arquivados)
        .map((f) => [
          f.faseNome,
          formatInt(f.arquivados),
          formatPct(f.pctDoTotalArquivado),
          f.principalMotivo,
          formatInt(f.antesConversao),
          formatInt(f.depoisConversao),
          formatInt(semMotivoNaFase(analise, f.faseId)),
        ]),
    [analise],
  );

  const conversaoPorCidade = useMemo(
    () => deriveConversaoPorCidade(dadosFiltrados.cardsAnalise, dataset.fases, period),
    [dadosFiltrados.cardsAnalise, dataset.fases, period],
  );

  const semCidadeInformada = useMemo(() => {
    try {
      if (!conversaoPorCidade.campoDisponivel) return false;
      const { linhas } = conversaoPorCidade;
      if (linhas.length === 0) return false;
      return linhas.every((r) => r.cidade === 'Cidade não informada');
    } catch {
      return false;
    }
  }, [conversaoPorCidade]);

  const qualidadeOperacional = useMemo(
    () =>
      deriveQualidadeOperacional(
        dadosFiltrados.cardsAnalise,
        dadosFiltrados.chamados,
        dataset.fases,
        analise,
      ),
    [dadosFiltrados.cardsAnalise, dadosFiltrados.chamados, dataset.fases, analise],
  );

  const portfolioEspecificidades = useMemo(() => {
    if (dataset.kanbanId !== KANBAN_IDS.PORTFOLIO) return null;
    return computePortfolioEspecificidades({
      period,
      fases: dataset.fases,
      cards: dadosFiltrados.cardsAnalise,
      historicoMovimentos: dadosFiltrados.historicoAnalise,
      carometroFieldsAvailable: dataset.carometroFieldsAvailable,
    });
  }, [
    dataset.kanbanId,
    dataset.fases,
    dataset.carometroFieldsAvailable,
    dadosFiltrados.cardsAnalise,
    dadosFiltrados.historicoAnalise,
    period,
  ]);

  const portfolioFilhosFiltrados = useMemo(() => {
    const ids = new Set(dadosFiltrados.cardsAnalise.map((c) => c.id));
    return (dataset.portfolioFilhosOrigem ?? []).filter((f) => ids.has(f.origem_card_id));
  }, [dataset.portfolioFilhosOrigem, dadosFiltrados.cardsAnalise]);

  const stepOneEspecificidades = useMemo(() => {
    if (dataset.kanbanId !== KANBAN_IDS.STEP_ONE) return null;
    return computeStepOneEspecificidades({
      period,
      fases: dataset.fases,
      cards: dadosFiltrados.cardsAnalise,
      historicoMovimentos: dadosFiltrados.historicoAnalise,
      portfolioFilhos: portfolioFilhosFiltrados,
      stepOneFieldsAvailable: dataset.stepOneFieldsAvailable,
      portfolioFilhosAvailable: dataset.portfolioFilhosAvailable,
    });
  }, [
    dataset.kanbanId,
    dataset.fases,
    dataset.stepOneFieldsAvailable,
    dataset.portfolioFilhosAvailable,
    dadosFiltrados.cardsAnalise,
    dadosFiltrados.historicoAnalise,
    portfolioFilhosFiltrados,
    period,
  ]);

  const acoplamentoEspecificidades = useMemo(() => {
    if (dataset.kanbanId !== KANBAN_IDS.ACOPLAMENTO) return null;
    return computeAcoplamentoEspecificidades({
      fases: dataset.fases,
      cards: dadosFiltrados.cardsAnalise,
      historicoMovimentos: dadosFiltrados.historicoAnalise,
      retrocessoRows: dadosFiltrados.retrocessoRows,
      origemKanbanDisponivel: dataset.carometroFieldsAvailable,
    });
  }, [
    dataset.kanbanId,
    dataset.fases,
    dataset.carometroFieldsAvailable,
    dadosFiltrados.cardsAnalise,
    dadosFiltrados.historicoAnalise,
    dadosFiltrados.retrocessoRows,
  ]);

  const operacoesEspecificidades = useMemo(() => {
    if (dataset.kanbanId !== KANBAN_IDS.OPERACOES) return null;
    return computeOperacoesEspecificidades({
      fases: dataset.fases,
      cards: dadosFiltrados.cardsAnalise,
      historicoMovimentos: dadosFiltrados.historicoAnalise,
      retrocessoRows: dadosFiltrados.retrocessoRows,
      operacoesFieldsAvailable: dataset.operacoesFieldsAvailable,
    });
  }, [
    dataset.kanbanId,
    dataset.fases,
    dataset.operacoesFieldsAvailable,
    dadosFiltrados.cardsAnalise,
    dadosFiltrados.historicoAnalise,
    dadosFiltrados.retrocessoRows,
  ]);

  const loteadoresEspecificidades = useMemo(() => {
    if (dataset.kanbanId !== KANBAN_IDS.LOTEADORES) return null;
    return computeLoteadoresEspecificidades({
      fases: dataset.fases,
      cards: dadosFiltrados.cardsAnalise,
      historicoMovimentos: dadosFiltrados.historicoAnalise,
      loteadoresFieldsAvailable: dataset.loteadoresFieldsAvailable,
    });
  }, [
    dataset.kanbanId,
    dataset.fases,
    dataset.loteadoresFieldsAvailable,
    dadosFiltrados.cardsAnalise,
    dadosFiltrados.historicoAnalise,
  ]);

  const creditoObraEspecificidades = useMemo(() => {
    if (dataset.kanbanId !== KANBAN_IDS.CREDITO_OBRA) return null;
    return computeCreditoObraEspecificidades({
      period,
      fases: dataset.fases,
      cards: dadosFiltrados.cardsAnalise,
      historicoMovimentos: dadosFiltrados.historicoAnalise,
      retrocessoRows: dadosFiltrados.retrocessoRows,
      operacoesIrmaos: dataset.operacoesIrmaosPorProjeto,
      operacoesFases: dataset.operacoesFases,
      operacoesIrmaosAvailable: dataset.operacoesIrmaosAvailable,
      creditoObraFieldsAvailable: dataset.creditoObraFieldsAvailable,
    });
  }, [
    dataset.kanbanId,
    dataset.fases,
    dataset.creditoObraFieldsAvailable,
    dataset.operacoesIrmaosPorProjeto,
    dataset.operacoesFases,
    dataset.operacoesIrmaosAvailable,
    dadosFiltrados.cardsAnalise,
    dadosFiltrados.historicoAnalise,
    dadosFiltrados.retrocessoRows,
    period,
  ]);

  const contabilidadeEspecificidades = useMemo(() => {
    if (dataset.kanbanId !== KANBAN_IDS.CONTABILIDADE) return null;
    return computeContabilidadeEspecificidades({
      period,
      fases: dataset.fases,
      cards: dadosFiltrados.cardsAnalise,
      historicoMovimentos: dadosFiltrados.historicoAnalise,
      creditoObraIrmaos: dataset.creditoObraIrmaosPorProjeto,
      creditoObraFases: dataset.creditoObraFases,
      creditoObraIrmaosAvailable: dataset.creditoObraIrmaosAvailable,
      contabilidadeFieldsAvailable: dataset.contabilidadeFieldsAvailable,
    });
  }, [
    dataset.kanbanId,
    dataset.fases,
    dataset.contabilidadeFieldsAvailable,
    dataset.creditoObraIrmaosPorProjeto,
    dataset.creditoObraFases,
    dataset.creditoObraIrmaosAvailable,
    dadosFiltrados.cardsAnalise,
    dadosFiltrados.historicoAnalise,
    period,
  ]);

  const openCardBase = (pathname ?? '/').trim() || '/';
  const periodLabel = PERIOD_OPTIONS.find((p) => p.key === period)?.label ?? period;
  const gargalosCriticos = analise.gargalos.ranking.filter((g) => g.classificacao === 'critico').length;

  const arquivadosDrawerRows = useMemo(
    () =>
      buildPainelArquivadosDrawerRows({
        kanbanNome: dataset.kanbanNome,
        fases: dataset.fases,
        cards: dadosFiltrados.cardsAnalise,
        historico: dadosFiltrados.historicoAnalise,
        profiles: dataset.profiles,
        period,
        openCardHref: (cardId) => buildOpenCardHref(openCardBase, cardId),
      }),
    [
      dataset.kanbanNome,
      dataset.fases,
      dataset.profiles,
      dadosFiltrados.cardsAnalise,
      dadosFiltrados.historicoAnalise,
      period,
      openCardBase,
    ],
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Topo fixo */}
      <header className="space-y-4" style={{ borderBottom: '0.5px solid var(--moni-border-default)', paddingBottom: '1rem' }}>
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
            style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
          >
            {dataset.kanbanNome} — Painel
          </h1>
          <p className="mt-1 text-[11px] sm:text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            Análise operacional · {periodLabel}
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div
            className="inline-flex flex-wrap rounded-full p-0.5"
            style={{ background: 'var(--moni-surface-100)', border: '0.5px solid var(--moni-border-default)' }}
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
                  className="min-h-[44px] rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors sm:min-h-[32px]"
                  style={{
                    background: on ? 'var(--moni-navy-800)' : 'transparent',
                    color: on ? 'var(--moni-text-inverse)' : 'var(--moni-text-secondary)',
                  }}
                  onClick={() => setPeriod(key)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-1 flex-wrap gap-3">
            {opcoesFiltros.temFranquia ? (
              <FilterSelect
                label="Unidade"
                value={filtros.franquiaId ?? ''}
                onChange={(v) => setFiltros((p) => ({ ...p, franquiaId: v || null }))}
              >
                <option value="">Todas</option>
                {opcoesFiltros.franquias.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </FilterSelect>
            ) : null}

            <FilterSelect
              label="Responsável"
              value={filtros.responsavelKey ?? ''}
              onChange={(v) => setFiltros((p) => ({ ...p, responsavelKey: v || null }))}
            >
              <option value="">Todos</option>
              {opcoesFiltros.responsaveis.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </FilterSelect>
          </div>
        </div>

        <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          {formatInt(dadosFiltrados.cards.length)} cards no recorte
          {dadosFiltrados.ocultandoArquivados ? ' · Arquivados ocultos do board, considerados nas métricas de perda' : ''}
        </p>
      </header>

      {dataset.mode === 'legado' ? (
        <p
          className="rounded-lg px-3 py-2 text-[11px]"
          style={{
            border: '0.5px solid var(--moni-border-default)',
            background: 'var(--moni-surface-0)',
            color: 'var(--moni-text-secondary)',
          }}
        >
          Modo legado: histórico de fases limitado; métricas usam posição atual e movimentos disponíveis.
        </p>
      ) : null}

      {!analise.conversao.faseConversaoConfigurada ? (
        <p
          className="rounded-lg px-3 py-2 text-[11px]"
          style={{
            color: 'var(--moni-text-secondary)',
            background: 'var(--moni-surface-100)',
            border: '0.5px solid var(--moni-border-subtle)',
            borderRadius: 'var(--moni-radius-lg)',
          }}
        >
          Fase de conversão não configurada — configure em Admin → Fases de conversão para destacar a etapa de
          conversão.
        </p>
      ) : null}

      {/* KPIs fixos */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Cards ativos" value={formatInt(analise.operacao.cardsAtivos)} hint="Agora no funil" />
        <KpiCard label="Entradas" value={formatInt(analise.operacao.cardsEntraram)} hint="Novos no período" />
        <KpiCard label="Concluídos" value={formatInt(analise.operacao.concluidos)} />
        <KpiCard label="Arquivados" value={formatInt(analise.operacao.arquivados)} />
        <KpiCard
          label="SLA em dia"
          value={formatPct(analise.operacao.pctSlaDentro)}
          hint="Cards ativos com meta de fase"
        />
      </div>

      {/* Abas */}
      <div
        className="inline-flex rounded-lg p-0.5"
        style={{ background: 'var(--moni-surface-100)', border: '0.5px solid var(--moni-border-default)' }}
        role="tablist"
        aria-label="Seções do painel"
      >
        {(
          [
            { id: 'operacao' as const, label: 'Operação + Conversão' },
            { id: 'qualidade' as const, label: 'Qualidade + Insights' },
          ] as const
        ).map(({ id, label }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={on}
              className="min-h-[44px] rounded-md px-4 py-2 text-[11px] font-medium sm:min-h-[36px]"
              style={{
                background: on ? 'var(--moni-surface-0)' : 'transparent',
                color: on ? 'var(--moni-navy-800)' : 'var(--moni-text-secondary)',
                border: on ? '0.5px solid var(--moni-border-default)' : '0.5px solid transparent',
              }}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === 'operacao' ? (
        <div className="space-y-6">
          {/* Seção 1 — Gargalos */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2
                  className="text-base font-semibold"
                  style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
                >
                  Gargalos críticos e de atenção
                </h2>
                <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                  GargaloScore por fase — volume, atraso, inatividade, perda, chamados e arquivamento.
                </p>
              </div>
              {gargalosCriticos > 0 ? (
                <span className="moni-tag-atrasado text-[10px]">{formatInt(gargalosCriticos)} crítico(s)</span>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <PanelBox title="Ranking">
                {gargalosExibidos.length === 0 ? (
                  <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                    Nenhuma fase em atenção ou crítica no recorte.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {gargalosExibidos.map((g) => (
                      <li key={g.faseId}>
                        <GargaloRow
                          g={g}
                          retornosFase={retornoPorFaseMap.get(g.faseId) ?? 0}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                {!gargalosExpandido && gargalosBaixo.length > 0 ? (
                  <button
                    type="button"
                    className="mt-3 min-h-[44px] text-[11px] font-medium underline sm:min-h-[32px]"
                    style={{ color: 'var(--moni-navy-800)' }}
                    onClick={() => setGargalosExpandido(true)}
                  >
                    Ver todos os gargalos ({formatInt(gargalosBaixo.length)} baixo)
                  </button>
                ) : null}
                {gargalosExpandido && gargalosBaixo.length > 0 ? (
                  <button
                    type="button"
                    className="mt-3 min-h-[44px] text-[11px] font-medium underline sm:min-h-[32px]"
                    style={{ color: 'var(--moni-text-secondary)' }}
                    onClick={() => setGargalosExpandido(false)}
                  >
                    Ocultar classificação baixa
                  </button>
                ) : null}
              </PanelBox>

              <PanelBox title="Detalhe">
                <DataTable
                  headers={['Fase', 'Score', 'Cards', 'Atraso', 'Arq.', 'Antes conv.', 'Cham.', 'Trava']}
                  emptyMessage="Sem fases."
                  rows={gargalosExibidos.map((g) => [
                    g.faseNome,
                    String(g.score),
                    formatInt(g.cardsNaFase),
                    g.pctAtrasados != null ? formatPct(g.pctAtrasados) : '—',
                    formatInt(g.cardsArquivados),
                    formatInt(g.arquivamentosAntesConversao),
                    formatInt(g.chamadosAbertos),
                    formatInt(g.chamadosComTrava),
                  ])}
                />
              </PanelBox>
            </div>

            {analise.gargalos.retrocessos.length > 0 ? (
              <PanelBox title="Retrocessos recentes">
                <ul className="space-y-2">
                  {analise.gargalos.retrocessos.slice(0, 5).map((r) => (
                    <li key={r.cardId} className="flex justify-between gap-2 text-[11px]">
                      <Link
                        href={buildOpenCardHref(openCardBase, r.cardId)}
                        className="min-w-0 truncate hover:underline"
                        style={{ color: 'var(--moni-navy-800)' }}
                      >
                        {r.titulo}
                      </Link>
                      <span className="moni-tag-atencao shrink-0 tabular-nums">{r.count}×</span>
                    </li>
                  ))}
                </ul>
              </PanelBox>
            ) : null}
          </section>

          {/* Seção 2 — Operação do funil + Conversão */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="space-y-4">
              <PanelBox title="Funil de conversão">
                <FunnelConversionGrid nodes={analise.conversao.funnelTree.nodes} />
                {analise.conversao.funnelTree.historicoParcial ? (
                  <p className="mt-2 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                    Histórico parcial — tempos aproximados em parte dos cards.
                  </p>
                ) : null}
              </PanelBox>

              <CollapsiblePanelBox
                title="Transições adjacentes"
                expanded={transicoesExpandido}
                onToggle={() => setTransicoesExpandido((v) => !v)}
                expandLabel={`Ver transições (${formatInt(transicoesAdjacentes.length)})`}
              >
                <DataTable
                  headers={['Transição', 'Origem', 'Destino', 'Passagem']}
                  emptyMessage="Funil com uma fase apenas."
                  rows={transicoesAdjacentes.map((p) => [
                    `${p.deFaseNome} → ${p.paraFaseNome}`,
                    formatInt(p.alcancaramOrigem),
                    formatInt(p.alcancaramDestino),
                    formatPct(p.taxaPassagemPct),
                  ])}
                />
              </CollapsiblePanelBox>
            </div>

            <div className="space-y-4">
              <PanelBox title="Chamados">
                <div className="mb-3 flex flex-wrap gap-2">
                  <MiniKpi label="Abertos" value={formatInt(analise.chamados.abertos)} />
                  <MiniKpi label="Concluídos" value={formatInt(analise.chamados.concluidos)} />
                  <MiniKpi label="Vencidos" value={formatInt(analise.chamados.vencidos)} />
                  <MiniKpi label="Com trava" value={formatInt(analise.chamados.comTrava)} />
                </div>
                <ChamadosPorFaseUnifiedTable rows={chamadosPorFaseUnificado} />
              </PanelBox>

              <PanelBox title="Fluxo">
                <div className="mb-3 flex flex-wrap gap-2">
                  <MiniKpi
                    label="Concluídos / semana"
                    value={fluxo.concluidosPorSemana != null ? formatDec(fluxo.concluidosPorSemana) : '—'}
                  />
                  <MiniKpi
                    label="Entradas / semana"
                    value={fluxo.entradasPorSemana != null ? formatDec(fluxo.entradasPorSemana) : '—'}
                  />
                  <MiniKpi label="Cycle time mediano" value={formatDias(fluxo.cycleTimeMediano)} />
                  <MiniKpi label="P90" value={formatDias(fluxo.cycleTimeP90)} />
                </div>
                <DataTable
                  headers={['Fase', 'Mediana', 'vs SLA', 'Retorno de fase']}
                  emptyMessage="Sem dados de fluxo."
                  rows={fluxo.porFase
                    .filter((f) => f.medianaDias != null || f.retornosFase > 0)
                    .map((f) => [
                      f.faseNome,
                      formatDias(f.medianaDias),
                      f.vsSla,
                      formatInt(f.retornosFase),
                    ])}
                />
              </PanelBox>
            </div>
          </div>

          {/* Seção 3 — Arquivamentos */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2
                  className="text-base font-semibold"
                  style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
                >
                  Arquivamentos
                </h2>
                <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Perdas por arquivamento — {periodLabel}
                </p>
              </div>
              {arquivadosDrawerRows.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setArquivadosDrawerOpen(true)}
                  className="min-h-[44px] rounded-md px-3 py-2 text-[11px] font-medium sm:min-h-[36px]"
                  style={{
                    background: 'var(--moni-navy-800)',
                    color: 'var(--moni-text-inverse)',
                    borderRadius: 'var(--moni-radius-md)',
                  }}
                >
                  Ver cards arquivados ({formatInt(arquivadosDrawerRows.length)})
                </button>
              ) : null}
            </div>

            {analise.arquivamento.perdas.totalArquivados === 0 ? (
              <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                Nenhum card arquivado no recorte analisado.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                  <KpiCard label="Total arquivados" value={formatInt(analise.arquivamento.perdas.totalArquivados)} />
                  <KpiCard
                    label="% do período"
                    value={formatPct(analise.arquivamento.perdas.pctDoPeriodo)}
                    hint={`Sobre ${formatInt(analise.arquivamento.cardsAnalisados)} cards`}
                  />
                  <KpiCard
                    label="Antes da conversão"
                    value={formatInt(analise.arquivamento.perdas.antesConversao)}
                    hint="Perda do funil"
                  />
                  <KpiCard
                    label="Na conversão"
                    value={formatInt(analise.arquivamento.perdas.naConversao)}
                  />
                  <KpiCard
                    label="Depois da conversão"
                    value={formatInt(analise.arquivamento.perdas.depoisConversao)}
                  />
                  <KpiCard
                    label="Principal motivo"
                    value={analise.arquivamento.perdas.principalMotivoArquivamento?.motivo ?? '—'}
                  />
                  <KpiCard
                    label="Sem motivo"
                    value={formatPct(analise.arquivamento.perdas.pctSemMotivo)}
                  />
                </div>

                {analise.arquivamento.perdas.impactoPerdaConversaoPct != null &&
                analise.conversao.entradasNoPeriodo > 0 ? (
                  <p className="text-[11px] tabular-nums" style={{ color: 'var(--moni-text-secondary)' }}>
                    Impacto na conversão:{' '}
                    <strong style={{ color: 'var(--moni-text-primary)' }}>
                      {formatPct(analise.arquivamento.perdas.impactoPerdaConversaoPct)}
                    </strong>{' '}
                    das entradas arquivadas antes da conversão.
                  </p>
                ) : null}

                {analise.arquivamento.qualidadeMotivo ? (
                  <PainelQualidadeMotivoAlert
                    qualidade={analise.arquivamento.qualidadeMotivo}
                    formatInt={formatInt}
                    formatPct={formatPct}
                  />
                ) : null}

                <PanelBox title="Arquivamentos por fase">
                  <DataTable
                    headers={[
                      'Fase',
                      'Arquivados',
                      '% total',
                      'Principal motivo',
                      'Antes conv.',
                      'Depois conv.',
                      'Sem motivo',
                    ]}
                    emptyMessage="Nenhum arquivado no período."
                    rows={arquivamentosPorFaseUnificado}
                    alignRightFrom={1}
                  />
                </PanelBox>

                {analise.arquivamento.motivos.sugestaoMotivoObrigatorio ? (
                  <DegradeNote>
                    Há arquivamentos sem motivo registrado — recomenda-se tornar o campo obrigatório no modal de
                    arquivamento.
                  </DegradeNote>
                ) : null}

                {analise.arquivamento.motivos.ranking.length > 0 ||
                analise.arquivamento.motivos.impactoPerdaAntesConversao.length > 0 ||
                analise.arquivamento.motivos.porResponsavel.length > 0 ||
                analise.arquivamento.motivos.porFranquia.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <PanelBox title="Impacto na perda antes da conversão">
                      <DataTable
                        headers={['Motivo', 'Perdas', 'Depois conv.']}
                        emptyMessage="Nenhuma perda por arquivamento."
                        rows={analise.arquivamento.motivos.impactoPerdaAntesConversao.slice(0, 10).map((m) => [
                          m.motivo,
                          formatInt(m.antesConversao),
                          formatInt(m.depoisConversao),
                        ])}
                        alignRightFrom={1}
                      />
                    </PanelBox>
                    <PanelBox title="Motivos por responsável">
                      <DataTable
                        headers={['Responsável', 'Motivo', 'Total', 'Antes conv.']}
                        emptyMessage="Nenhum arquivado no período."
                        rows={analise.arquivamento.motivos.porResponsavel
                          .flatMap((r) =>
                            r.motivos.slice(0, 2).map((m) => [
                              r.responsavelNome,
                              m.motivo,
                              formatInt(m.total),
                              formatInt(m.antesConversao),
                            ]),
                          )
                          .slice(0, 12)}
                        alignRightFrom={2}
                      />
                    </PanelBox>
                    {analise.arquivamento.motivos.porFranquia.length > 0 ? (
                      <PanelBox title="Motivos por franquia / unidade">
                        <DataTable
                          headers={['Unidade', 'Motivo', 'Total', 'Antes conv.']}
                          emptyMessage="Nenhum arquivado no período."
                          rows={analise.arquivamento.motivos.porFranquia
                            .flatMap((f) =>
                              f.motivos.slice(0, 2).map((m) => [
                                f.label,
                                m.motivo,
                                formatInt(m.total),
                                formatInt(m.antesConversao),
                              ]),
                            )
                            .slice(0, 12)}
                          alignRightFrom={2}
                        />
                      </PanelBox>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </section>

          {/* Seção 4 — Conversão detalhada */}
          <section className="space-y-3">
            <h2
              className="text-base font-semibold"
              style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
            >
              Conversão detalhada
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PanelBox title="Conversão por responsável">
                <DataTable
                  headers={['Responsável', 'Entradas', 'Conv.', 'Taxa', 'Cycle time']}
                  emptyMessage="Sem dados de conversão por responsável."
                  rows={analise.conversao.porResponsavel.slice(0, 10).map((p) => {
                    const rid = p.responsavelId ?? '__sem__';
                    const ct = cyclePorResp.get(rid)?.mediana ?? null;
                    return [
                      p.responsavelNome,
                      formatInt(p.entradas),
                      formatInt(p.converteram),
                      formatPct(p.taxaConversaoPct),
                      formatDias(ct),
                    ];
                  })}
                  alignRightFrom={1}
                />
              </PanelBox>

              {!semCidadeInformada ? (
                <PanelBox title="Conversão por praça / cidade">
                  {!conversaoPorCidade.campoDisponivel ? (
                    <DegradeNote>
                      Campo de cidade indisponível no recorte — vincule cards à rede ou projeto com área de atuação.
                    </DegradeNote>
                  ) : null}
                  <DataTable
                    headers={['Cidade', 'Entradas', 'Conv.', 'Taxa', 'Tempo médio']}
                    emptyMessage="Sem entradas no período."
                    rows={conversaoPorCidade.linhas.slice(0, 10).map((r) => [
                      r.cidade,
                      formatInt(r.entradas),
                      formatInt(r.converteram),
                      formatPct(r.taxaConversaoPct),
                      formatDias(r.tempoMedioDias),
                    ])}
                    alignRightFrom={1}
                  />
                </PanelBox>
              ) : null}

              {!todasTaxasZero ? (
                <PanelBox title="Conversão por fase">
                  <DataTable
                    headers={['Fase', 'Alcançaram', 'Converteram', 'Taxa']}
                    emptyMessage="Sem entradas no período."
                    rows={analise.conversao.porFase
                      .filter((p) => p.alcancaram > 0)
                      .map((p) => [
                        `${p.faseNome}${p.faseConversao ? ' · conv.' : ''}`,
                        formatInt(p.alcancaram),
                        formatInt(p.converteram),
                        formatPct(p.taxaConversaoPct),
                      ])}
                    alignRightFrom={1}
                  />
                </PanelBox>
              ) : null}
            </div>
          </section>

          <CarometroIndicadoresSection kanbanId={dataset.kanbanId} carometro={analise.carometro} />

          {portfolioEspecificidades ? (
            <PortfolioEspecificidadesSection data={portfolioEspecificidades} />
          ) : null}

          {stepOneEspecificidades ? (
            <StepOneEspecificidadesSection data={stepOneEspecificidades} openCardBase={openCardBase} />
          ) : null}

          {acoplamentoEspecificidades ? (
            <AcoplamentoEspecificidadesSection data={acoplamentoEspecificidades} />
          ) : null}

          {operacoesEspecificidades ? (
            <OperacoesEspecificidadesSection
              data={operacoesEspecificidades}
              openCardBase={openCardBase}
            />
          ) : null}

          {loteadoresEspecificidades ? (
            <LoteadoresEspecificidadesSection
              data={loteadoresEspecificidades}
              openCardBase={openCardBase}
            />
          ) : null}

          {creditoObraEspecificidades ? (
            <CreditoObraEspecificidadesSection
              data={creditoObraEspecificidades}
              openCardBase={openCardBase}
            />
          ) : null}

          {contabilidadeEspecificidades ? (
            <ContabilidadeEspecificidadesSection
              data={contabilidadeEspecificidades}
              openCardBase={openCardBase}
            />
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          {qualidade.alertaAtivo ? (
            <div
              className="flex gap-3 rounded-lg px-4 py-3"
              style={{
                border: '0.5px solid var(--moni-status-attention-border)',
                background: 'var(--moni-status-attention-bg)',
                borderRadius: 'var(--moni-radius-lg)',
              }}
              role="alert"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--moni-status-attention-text)' }} />
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--moni-status-attention-text)' }}>
                {qualidade.alertaMensagem}
              </p>
            </div>
          ) : null}

          {analise.arquivamento.qualidadeMotivo ? (
            <PainelQualidadeMotivoAlert
              qualidade={analise.arquivamento.qualidadeMotivo}
              formatInt={formatInt}
              formatPct={formatPct}
            />
          ) : null}

          <PanelBox title="Cards por fase">
            <DataTable
              headers={['Fase', 'Ativos', 'Arquivados', 'Atrasados', 'Dias úteis méd.']}
              emptyMessage="Sem fases configuradas."
              rows={analise.operacao.porFase
                .filter((f) => f.cardsAtivos > 0 || f.cardsArquivados > 0 || f.atrasados > 0)
                .map((f) => [
                  `${f.faseNome}${f.faseConversao ? ' · conv.' : ''}`,
                  formatInt(f.cardsAtivos),
                  f.cardsArquivados > 0 ? formatInt(f.cardsArquivados) : '—',
                  formatInt(f.atrasados),
                  f.diasUteisMedio > 0 ? formatDias(f.diasUteisMedio) : '—',
                ])}
              alignRightFrom={1}
            />
          </PanelBox>

          <section className="space-y-3">
            <h2
              className="text-base font-semibold"
              style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
            >
              Qualidade operacional
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PanelBox title="Problemas por responsável">
                <DataTable
                  headers={['Responsável', 'Sem prazo', 'Sem responsável', 'Arquiv. sem motivo']}
                  emptyMessage="Nenhuma lacuna identificada por responsável."
                  rows={qualidadeOperacional.porResponsavel.map((r) => [
                    r.nome,
                    formatInt(r.semPrazo),
                    formatInt(r.semResponsavel),
                    formatInt(r.arquivSemMotivo),
                  ])}
                  alignRightFrom={1}
                />
              </PanelBox>
              <PanelBox title="Problemas por fase">
                <DataTable
                  headers={['Fase', 'Sem prazo', 'Sem responsável', 'Campos incompletos']}
                  emptyMessage="Nenhuma lacuna identificada por fase."
                  rows={qualidadeOperacional.porFase.map((f) => [
                    f.faseNome,
                    formatInt(f.semPrazo),
                    formatInt(f.semResponsavel),
                    formatInt(f.camposIncompletos),
                  ])}
                  alignRightFrom={1}
                />
              </PanelBox>
            </div>
          </section>

          <section className="space-y-3">
            <h2
              className="text-base font-semibold"
              style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
            >
              Chamados — análise completa
            </h2>
            <div className="mb-3 flex flex-wrap gap-2">
              <MiniKpi label="Abertos" value={formatInt(analise.chamados.abertos)} />
              <MiniKpi label="Concluídos" value={formatInt(analise.chamados.concluidos)} />
              <MiniKpi label="Vencidos" value={formatInt(analise.chamados.vencidos)} />
              <MiniKpi label="Com trava" value={formatInt(analise.chamados.comTrava)} />
              <MiniKpi label="Pastelaria" value={formatInt(analise.chamados.emPastelaria)} />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PanelBox title="Por responsável">
                <DataTable
                  headers={['Responsável', 'Abertos', 'Trava']}
                  emptyMessage="Sem dados."
                  rows={analise.chamados.porResponsavel.slice(0, 10).map((r) => [
                    r.responsavelNome,
                    formatInt(r.abertos),
                    formatInt(r.comTrava),
                  ])}
                  alignRightFrom={1}
                />
              </PanelBox>
              <PanelBox title="Por status">
                <DataTable
                  headers={['Status', 'Qtd.']}
                  emptyMessage="Sem chamados."
                  rows={analise.chamados.porStatus.map((r) => [r.status, formatInt(r.total)])}
                  alignRightFrom={1}
                />
              </PanelBox>
            </div>
            <PanelBox title="Chamados por fase">
              <ChamadosPorFaseUnifiedTable rows={chamadosPorFaseUnificado} />
            </PanelBox>
            {analise.chamados.destaque.length > 0 ? (
              <PanelBox title="Prioritários">
                <ul className="space-y-2">
                  {analise.chamados.destaque.slice(0, 8).map((ch) => (
                    <li
                      key={ch.id}
                      className="flex flex-wrap items-center gap-2 border-b pb-2 text-[11px] last:border-0"
                      style={{ borderColor: 'var(--moni-border-subtle)' }}
                    >
                      {ch.editHref ? (
                        <Link
                          href={ch.editHref}
                          className="font-medium hover:underline"
                          style={{ color: 'var(--moni-navy-800)' }}
                        >
                          {ch.titulo}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--moni-text-primary)' }}>{ch.titulo}</span>
                      )}
                      {ch.trava ? <Pill label="Trava" tone="vermelho" /> : null}
                      {ch.atrasado ? <Pill label="Vencido" tone="ambar" /> : null}
                      {ch.emPastelaria ? <Pill label="Pastelaria" tone="roxo" /> : null}
                      <span style={{ color: 'var(--moni-text-tertiary)' }}>· {ch.faseNome}</span>
                    </li>
                  ))}
                </ul>
              </PanelBox>
            ) : null}
          </section>

          <section className="space-y-3">
            <h2
              className="text-base font-semibold"
              style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
            >
              Insights
            </h2>
            <p className="text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
              Leituras automáticas — {periodLabel}
            </p>
            {analise.insights.length === 0 ? (
              <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                Dados insuficientes para insights acionáveis no recorte.
              </p>
            ) : (
              <ul className="space-y-2">
                {[...analise.insights]
                  .sort((a, b) => b.relevancia - a.relevancia)
                  .map((ins) => (
                    <InsightCard key={`${ins.tipo}-${ins.texto.slice(0, 40)}`} ins={ins} />
                  ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <p className="text-center text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
        Somente leitura · dados do funil ativo
      </p>

      <PainelArquivadosDrawer
        open={arquivadosDrawerOpen}
        onClose={() => setArquivadosDrawerOpen(false)}
        rows={arquivadosDrawerRows}
      />
    </div>
  );
}

export { ConversionFunnelTree } from './ConversionFunnelTree';
export type { ConversionFunnelTreeProps } from './ConversionFunnelTree';
