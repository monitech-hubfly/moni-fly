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

function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="flex min-h-[88px] flex-col justify-between px-3 py-3" style={panelStyle}>
      <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
        {label}
      </p>
      <p
        className="mt-1 text-xl font-semibold tabular-nums tracking-tight"
        style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
      >
        {value}
      </p>
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

function FunnelBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className="h-2 w-full min-w-[48px] overflow-hidden rounded-full"
      style={{ background: 'var(--moni-surface-200)' }}
    >
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: 'var(--moni-navy-800)' }}
      />
    </div>
  );
}

function FunnelConversionGrid({
  nodes,
  faseConversaoConfigurada,
}: {
  nodes: ConversionFunnelTreeNode[];
  faseConversaoConfigurada: boolean;
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
      {!faseConversaoConfigurada ? (
        <p
          className="mb-3 rounded-md px-3 py-2 text-[11px]"
          style={{
            color: 'var(--moni-text-secondary)',
            background: 'var(--moni-surface-100)',
            border: '0.5px solid var(--moni-border-subtle)',
          }}
        >
          Fase de conversão não configurada — configure em Admin → Fases de conversão para destacar a etapa de
          conversão.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-[11px]">
          <thead>
            <tr style={{ borderBottom: '0.5px solid var(--moni-border-subtle)' }}>
              {['Fase', 'Volume', 'N', '%', 'Perda', 'Tempo'].map((h) => (
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
              return (
                <Fragment key={node.faseId}>
                  {showPerda ? (
                    <tr>
                      <td colSpan={6} className="py-1">
                        <div
                          className="flex items-center justify-center gap-1 text-[10px]"
                          style={{ color: 'var(--moni-text-tertiary)' }}
                        >
                          <ArrowDown className="h-3 w-3" aria-hidden />
                          Perda {formatPct(node.perdaAnteriorPct)}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  <tr
                    className="transition-colors hover:bg-[var(--moni-surface-50)]"
                    style={{
                      borderBottom: '0.5px solid var(--moni-border-subtle)',
                      background: node.faseConversao ? 'var(--moni-gold-50)' : undefined,
                    }}
                  >
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span style={{ color: 'var(--moni-text-secondary)' }}>{node.faseNome}</span>
                        {node.faseConversao ? <Pill label="Conversão" tone="ambar" /> : null}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <FunnelBar value={node.alcancaram} max={maxBar} />
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatInt(node.alcancaram)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{formatPct(node.pctSobreEntradas)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      {idx === 0 ? '—' : formatPct(node.perdaAnteriorPct)}
                    </td>
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
          Especificidades do Portfólio
        </h2>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Confirmações de fase (migration 389) e histórico de movimentação
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data.taxaAprovacaoComite != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Taxa de aprovação em Comitê
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Aprovados no Comitê ÷ cards que chegaram à fase Comitê no período — distinto da taxa de
              conversão geral do funil.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Chegaram ao Comitê" value={formatInt(data.taxaAprovacaoComite.chegaramComite)} />
              <MiniKpi label="Aprovados" value={formatInt(data.taxaAprovacaoComite.aprovados)} />
              <MiniKpi label="Taxa" value={formatPct(data.taxaAprovacaoComite.percentual)} />
            </div>
          </div>
        ) : null}

        {data.taxaComiteVirandoContrato != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Comitê aprovado → Contrato assinado
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Contratos assinados ÷ comitês aprovados no período (confirmações registradas no card).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi
                label="Comitês aprovados"
                value={formatInt(data.taxaComiteVirandoContrato.comitesAprovados)}
              />
              <MiniKpi
                label="Contratos assinados"
                value={formatInt(data.taxaComiteVirandoContrato.contratosAssinados)}
              />
              <MiniKpi label="Taxa" value={formatPct(data.taxaComiteVirandoContrato.percentual)} />
            </div>
          </div>
        ) : null}

        {data.tempoOpcaoAteComite != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Tempo Opção assinada → Comitê
            </h4>
            <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
              Mediana entre opcao_assinada_em e comite_aprovado_em.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi
                label="Mediana"
                value={formatDias(data.tempoOpcaoAteComite.medianaDiasUteis)}
              />
              <MiniKpi label="Amostras" value={formatInt(data.tempoOpcaoAteComite.amostras)} />
            </div>
            {data.tempoOpcaoAteComite.amostras === 0 ? (
              <p className="mt-2 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                Sem pares de datas de confirmação no recorte.
              </p>
            ) : null}
          </div>
        ) : null}

        {data.moniCapitalPctContrato != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Passagem por Moní Capital
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Cards que passaram pela fase Captação Moní Capital entre os que chegaram a Contrato no período.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Chegaram a Contrato" value={formatInt(data.moniCapitalPctContrato.chegaramContrato)} />
              <MiniKpi label="Com Captação Capital" value={formatInt(data.moniCapitalPctContrato.comCaptacaoCapital)} />
              <MiniKpi label="%" value={formatPct(data.moniCapitalPctContrato.percentual)} />
            </div>
          </div>
        ) : null}
      </div>

      {data.perdaDecisao != null ? (
        <PanelBox title="Perda por decisão (arquivamentos)">
          <p className="mb-3 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
            Classificação por motivo de arquivamento: interna (Moní reprova) vs externa (terrenista/franqueado
            desiste).
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <MiniKpi label="Decisão interna (Moní)" value={formatInt(data.perdaDecisao.internaMoni)} />
            <MiniKpi label="Decisão externa" value={formatInt(data.perdaDecisao.externaTerrenista)} />
            <MiniKpi label="Outros / sem classificação" value={formatInt(data.perdaDecisao.outros)} />
          </div>
          <DataTable
            headers={['Tipo', 'Qtd.', '% do total']}
            emptyMessage="Sem arquivamentos classificáveis."
            rows={[
              [
                'Interna — Moní reprova',
                formatInt(data.perdaDecisao.internaMoni),
                formatPct(
                  data.perdaDecisao.totalComMotivo === 0
                    ? null
                    : (data.perdaDecisao.internaMoni / data.perdaDecisao.totalComMotivo) * 100,
                ),
              ],
              [
                'Externa — terrenista / franqueado desiste',
                formatInt(data.perdaDecisao.externaTerrenista),
                formatPct(
                  data.perdaDecisao.totalComMotivo === 0
                    ? null
                    : (data.perdaDecisao.externaTerrenista / data.perdaDecisao.totalComMotivo) * 100,
                ),
              ],
              [
                'Outros / sem motivo canônico',
                formatInt(data.perdaDecisao.outros),
                formatPct(
                  data.perdaDecisao.totalComMotivo === 0
                    ? null
                    : (data.perdaDecisao.outros / data.perdaDecisao.totalComMotivo) * 100,
                ),
              ],
            ]}
          />
        </PanelBox>
      ) : null}
    </section>
  );
}

function StepOneEspecificidadesSection({ data }: { data: PainelStepOneEspecificidades }) {
  return (
    <section className="space-y-3">
      <div>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Especificidades do Step One
        </h2>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Histórico de fases, campos de lote no card e bastão para o Portfólio
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data.taxaAprovacaoHipoteses != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Taxa de aprovação em Hipóteses
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Cards que chegaram à fase Hipóteses ÷ entradas no funil no período.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Entradas no funil" value={formatInt(data.taxaAprovacaoHipoteses.entradasFunil)} />
              <MiniKpi label="Chegaram a Hipóteses" value={formatInt(data.taxaAprovacaoHipoteses.entraramHipoteses)} />
              <MiniKpi label="Taxa" value={formatPct(data.taxaAprovacaoHipoteses.percentual)} />
            </div>
          </div>
        ) : null}

        {data.conversaoPortfolio != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Conversão Step One → Portfólio
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Cards que saíram de Hipóteses e geraram card filho no Funil Portfólio (`origem_card_id`).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Saíram de Hipóteses" value={formatInt(data.conversaoPortfolio.sairamHipoteses)} />
              <MiniKpi label="Geraram Portfólio" value={formatInt(data.conversaoPortfolio.geraramPortfolio)} />
              <MiniKpi label="Taxa" value={formatPct(data.conversaoPortfolio.percentual)} />
            </div>
            {data.conversaoPortfolio.portfolioIndisponivel ? (
              <DegradeNote>
                Vínculo com Portfólio indisponível no momento — taxa pode estar subestimada.
              </DegradeNote>
            ) : null}
          </div>
        ) : null}

        {data.qualidadeDadosLotes != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Qualidade dos dados de lotes
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Preenchimento de nome do condomínio, quadra e lote nos cards que passaram por pesquisa de lotes.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Campos preenchidos" value={formatInt(data.qualidadeDadosLotes.camposPreenchidos)} />
              <MiniKpi label="Campos estimados" value={formatInt(data.qualidadeDadosLotes.camposEstimados)} />
              <MiniKpi label="%" value={formatPct(data.qualidadeDadosLotes.percentual)} />
            </div>
            {data.qualidadeDadosLotes.camposIndisponiveis ? (
              <DegradeNote>
                Campos de lote não retornados pelo servidor — métrica indisponível para parte do recorte.
              </DegradeNote>
            ) : data.qualidadeDadosLotes.cardsAnalisados === 0 ? (
              <DegradeNote>Sem cards na fase de lotes no recorte analisado.</DegradeNote>
            ) : null}
          </div>
        ) : null}

        {data.tempoFasesPesquisa != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Tempo médio nas fases de pesquisa
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Permanência na fase a partir do histórico de movimentação (`kanban_historico` + `entered_fase_at`).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.tempoFasesPesquisa.mapaCompetidores != null ? (
                <>
                  <MiniKpi
                    label="Mapa de Competidores"
                    value={formatDiasCorridos(data.tempoFasesPesquisa.mapaCompetidores.mediaDias)}
                  />
                  <MiniKpi
                    label="Amostras (mapa)"
                    value={formatInt(data.tempoFasesPesquisa.mapaCompetidores.amostras)}
                  />
                </>
              ) : null}
              {data.tempoFasesPesquisa.dadosCondominios != null ? (
                <>
                  <MiniKpi
                    label="Dados dos Condomínios"
                    value={formatDiasCorridos(data.tempoFasesPesquisa.dadosCondominios.mediaDias)}
                  />
                  <MiniKpi
                    label="Amostras (cond.)"
                    value={formatInt(data.tempoFasesPesquisa.dadosCondominios.amostras)}
                  />
                </>
              ) : null}
            </div>
            {data.tempoFasesPesquisa.historicoParcial ? (
              <DegradeNote>
                Histórico de movimentação incompleto em parte dos cards — tempos são aproximados.
              </DegradeNote>
            ) : null}
            {data.tempoFasesPesquisa.mapaCompetidores?.amostras === 0 &&
            data.tempoFasesPesquisa.dadosCondominios?.amostras === 0 ? (
              <DegradeNote>Sem visitas registradas às fases de pesquisa no recorte.</DegradeNote>
            ) : null}
          </div>
        ) : null}
      </div>

      {data.conversaoPortfolio != null && data.conversaoPortfolio.porFranquia.length > 0 ? (
        <PanelBox title="Conversão Step One → Portfólio por franquia">
          <DataTable
            headers={['Franquia', 'Cards no Portfólio']}
            emptyMessage="Sem conversões com vínculo de franquia."
            rows={data.conversaoPortfolio.porFranquia.slice(0, 12).map((p) => [p.label, formatInt(p.quantidade)])}
            alignRightFrom={1}
          />
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
          Especificidades do Acoplamento
        </h2>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Retrocessos, origem do card e permanência nas fases de modelagem
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data.taxaAprovacaoTentativa != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Aprovação: 1ª tentativa vs com revisões
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Entre cards que chegaram a Aprovado — revisões = passagem por Alterações antes da
              aprovação (via `is_retrocesso` no histórico).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi
                label="1ª tentativa"
                value={formatInt(data.taxaAprovacaoTentativa.aprovadosPrimeiraTentativa)}
              />
              <MiniKpi
                label="Com revisões"
                value={formatInt(data.taxaAprovacaoTentativa.aprovadosComRevisoes)}
              />
              <MiniKpi label="Total aprovados" value={formatInt(data.taxaAprovacaoTentativa.totalAprovados)} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <MiniKpi label="% 1ª tentativa" value={formatPct(data.taxaAprovacaoTentativa.pctPrimeiraTentativa)} />
              <MiniKpi label="% com revisões" value={formatPct(data.taxaAprovacaoTentativa.pctComRevisoes)} />
            </div>
            {data.taxaAprovacaoTentativa.totalAprovados === 0 ? (
              <DegradeNote>Nenhum card aprovado no recorte analisado.</DegradeNote>
            ) : null}
          </div>
        ) : null}

        {data.paralisadosPct != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Cards em Paralisados
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Cards ativos na fase Paralisados (reprovado) em relação ao total de cards ativos no funil.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Em Paralisados" value={formatInt(data.paralisadosPct.emParalisados)} />
              <MiniKpi label="Ativos no funil" value={formatInt(data.paralisadosPct.totalCards)} />
              <MiniKpi label="%" value={formatPct(data.paralisadosPct.percentual)} />
            </div>
          </div>
        ) : null}

        {data.tempoModelagemTerrenoCasa != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Tempo médio — Modelagem Terreno + Casa
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Soma da permanência em Modelagem do Terreno e Modelagem da Casa + GBox (dias corridos).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Média" value={formatDiasCorridos(data.tempoModelagemTerrenoCasa.mediaDias)} />
              <MiniKpi label="Amostras" value={formatInt(data.tempoModelagemTerrenoCasa.amostras)} />
            </div>
            {data.tempoModelagemTerrenoCasa.historicoParcial ? (
              <DegradeNote>
                Histórico de movimentação incompleto em parte dos cards — tempos são aproximados.
              </DegradeNote>
            ) : null}
            {data.tempoModelagemTerrenoCasa.amostras === 0 ? (
              <DegradeNote>Sem visitas registradas às fases de modelagem no recorte.</DegradeNote>
            ) : null}
          </div>
        ) : null}
      </div>

      {data.acoplamentosPorOrigem != null ? (
        <PanelBox title="Acoplamentos por funil de origem">
          {data.acoplamentosPorOrigem.origemIndisponivel ? (
            <DegradeNote>
              Campo origem_kanban_nome indisponível — distribuição por origem pode estar incompleta.
            </DegradeNote>
          ) : null}
          <DataTable
            headers={['Origem', 'Qtd.', '% do total']}
            emptyMessage="Sem cards com origem identificada no recorte."
            rows={data.acoplamentosPorOrigem.linhas.slice(0, 15).map((r) => [
              r.origem,
              formatInt(r.quantidade),
              formatPct(r.percentual),
            ])}
            alignRightFrom={1}
          />
        </PanelBox>
      ) : null}
    </section>
  );
}

function OperacoesEspecificidadesSection({ data }: { data: PainelOperacoesEspecificidades }) {
  return (
    <section className="space-y-3">
      <div>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Especificidades de Operações
        </h2>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Tempos de aprovação, retrabalho BCA e gargalos de crédito no funil Pré Obra e Obra
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data.taxaRetrabalhoBca != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Retrabalho em Revisão do BCA
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Cards que retornaram à fase Revisão do BCA mais de uma vez (`is_retrocesso` no histórico).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Com retrabalho" value={formatInt(data.taxaRetrabalhoBca.comRetrabalho)} />
              <MiniKpi
                label="Visitaram Revisão BCA"
                value={formatInt(data.taxaRetrabalhoBca.visitaramRevisaoBca)}
              />
              <MiniKpi label="Taxa" value={formatPct(data.taxaRetrabalhoBca.percentual)} />
            </div>
            {data.taxaRetrabalhoBca.visitaramRevisaoBca === 0 ? (
              <DegradeNote>Sem cards na fase Revisão do BCA no recorte.</DegradeNote>
            ) : null}
          </div>
        ) : null}

        {data.aguardandoCredito30Dias != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Aguardando Crédito há mais de 30 dias
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Cards ativos na fase Aguardando Crédito com `entered_fase_at` acima de 30 dias corridos.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="> 30 dias" value={formatInt(data.aguardandoCredito30Dias.acima30Dias)} />
              <MiniKpi label="Na fase agora" value={formatInt(data.aguardandoCredito30Dias.totalNaFase)} />
              <MiniKpi label="%" value={formatPct(data.aguardandoCredito30Dias.percentual)} />
            </div>
            {data.aguardandoCredito30Dias.totalNaFase === 0 ? (
              <DegradeNote>Nenhum card ativo em Aguardando Crédito no recorte.</DegradeNote>
            ) : null}
          </div>
        ) : null}
      </div>

      {data.tempoAprovacaoCondominio != null ? (
        <PanelBox title="Tempo médio — Aprovação no Condomínio (por condomínio)">
          {data.tempoAprovacaoCondominio.localIndisponivel ? (
            <DegradeNote>
              Condomínio/cidade indisponíveis no fetch — agrupamento pode usar rótulos genéricos.
            </DegradeNote>
          ) : null}
          <DataTable
            headers={['Condomínio', 'Média', 'Amostras']}
            emptyMessage="Sem permanência registrada na fase Aprovação no Condomínio."
            rows={data.tempoAprovacaoCondominio.porCondominio.slice(0, 12).map((r) => [
              r.label,
              formatDiasCorridos(r.mediaDias),
              formatInt(r.amostras),
            ])}
            alignRightFrom={1}
          />
        </PanelBox>
      ) : null}

      {data.tempoAprovacaoPrefeitura != null ? (
        <PanelBox title="Tempo médio — Aprovação na Prefeitura (por cidade)">
          {data.tempoAprovacaoPrefeitura.localIndisponivel ? (
            <DegradeNote>
              Praça/cidade indisponível em rede_franqueados ou projeto_negocio — agrupamento parcial.
            </DegradeNote>
          ) : null}
          <DataTable
            headers={['Cidade', 'Média', 'Amostras']}
            emptyMessage="Sem permanência registrada na fase Aprovação na Prefeitura."
            rows={data.tempoAprovacaoPrefeitura.porCidade.slice(0, 12).map((r) => [
              r.label,
              formatDiasCorridos(r.mediaDias),
              formatInt(r.amostras),
            ])}
            alignRightFrom={1}
          />
        </PanelBox>
      ) : null}
    </section>
  );
}

function LoteadoresEspecificidadesSection({ data }: { data: PainelLoteadoresEspecificidades }) {
  return (
    <section className="space-y-3">
      <div>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Especificidades de Loteadores
        </h2>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Conversão por parceiro, ciclo R1 → Contrato e gargalos em Viabilidade
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data.tempoR1AteContrato != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Tempo médio R1 → Contrato de Parceria
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Entre a primeira entrada em R1 Executada — Conceito e Contrato de Parceria (dias corridos).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Média" value={formatDiasCorridos(data.tempoR1AteContrato.mediaDias)} />
              <MiniKpi label="Amostras" value={formatInt(data.tempoR1AteContrato.amostras)} />
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
              Cards ativos em Viabilidade com `entered_fase_at` acima de 15 dias corridos.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi
                label="> 15 dias"
                value={formatInt(data.viabilidadeSemMovimentacao15Dias.acima15Dias)}
              />
              <MiniKpi
                label="Na fase agora"
                value={formatInt(data.viabilidadeSemMovimentacao15Dias.totalNaFase)}
              />
              <MiniKpi label="%" value={formatPct(data.viabilidadeSemMovimentacao15Dias.percentual)} />
            </div>
            {data.viabilidadeSemMovimentacao15Dias.totalNaFase === 0 ? (
              <DegradeNote>Nenhum card ativo em Viabilidade no recorte.</DegradeNote>
            ) : null}
          </div>
        ) : null}
      </div>

      {data.conversaoPorLoteador != null ? (
        <PanelBox title="Taxa de conversão por loteador">
          {data.conversaoPorLoteador.loteadorIndisponivel ? (
            <DegradeNote>
              Campo rede_loteador_id indisponível — agrupamento usa título do card como fallback.
            </DegradeNote>
          ) : null}
          <DataTable
            headers={['Loteador', 'Entradas', 'Conv.', 'Taxa']}
            emptyMessage="Sem cards no recorte."
            rows={data.conversaoPorLoteador.linhas.slice(0, 12).map((r) => [
              r.label,
              formatInt(r.entradas),
              formatInt(r.converteram),
              formatPct(r.taxaConversaoPct),
            ])}
            alignRightFrom={1}
          />
        </PanelBox>
      ) : null}

      {data.loteadoresComMaisDe2Ativos != null ? (
        <PanelBox title="Loteadores com mais de 2 cards ativos simultâneos">
          {data.loteadoresComMaisDe2Ativos.loteadorIndisponivel ? (
            <DegradeNote>Vínculo rede_loteador_id parcial — contagem pode estar incompleta.</DegradeNote>
          ) : null}
          <DataTable
            headers={['Loteador', 'Cards ativos']}
            emptyMessage="Nenhum loteador com mais de 2 cards ativos no recorte."
            rows={data.loteadoresComMaisDe2Ativos.linhas.slice(0, 12).map((r) => [
              r.label,
              formatInt(r.cardsAtivos),
            ])}
            alignRightFrom={1}
          />
        </PanelBox>
      ) : null}
    </section>
  );
}

function CreditoObraEspecificidadesSection({ data }: { data: PainelCreditoObraEspecificidades }) {
  return (
    <section className="space-y-3">
      <div>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Especificidades de Crédito Obra
        </h2>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Ciclo por tranche, aprovação da 1ª tranche, espera entre tranches e correlação com Operações
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data.taxaAprovacaoPrimeiraTranche != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              1ª tranche aprovada na primeira tentativa
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Cards que chegaram a Acompanhamento de Tranche sem retrocesso às fases da 1ª tranche.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi
                label="1ª tentativa"
                value={formatPct(data.taxaAprovacaoPrimeiraTranche.pctPrimeiraTentativa)}
              />
              <MiniKpi
                label="Com revisões"
                value={formatPct(data.taxaAprovacaoPrimeiraTranche.pctComRevisoes)}
              />
              <MiniKpi
                label="Total aprovados"
                value={formatInt(data.taxaAprovacaoPrimeiraTranche.totalAprovados)}
              />
            </div>
            {data.taxaAprovacaoPrimeiraTranche.totalAprovados === 0 ? (
              <DegradeNote>Nenhum card com 1ª tranche concluída no recorte.</DegradeNote>
            ) : null}
          </div>
        ) : null}

        {data.paradosEntreTranches15Dias != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Parados entre tranches há 15+ dias
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Cards ativos em Necessidade de tranche (3ª–6ª) com `entered_fase_at` acima de 15 dias corridos.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="> 15 dias" value={formatInt(data.paradosEntreTranches15Dias.acima15Dias)} />
              <MiniKpi
                label="Na fase agora"
                value={formatInt(data.paradosEntreTranches15Dias.totalNaFase)}
              />
              <MiniKpi label="%" value={formatPct(data.paradosEntreTranches15Dias.percentual)} />
            </div>
            {data.paradosEntreTranches15Dias.totalNaFase === 0 ? (
              <DegradeNote>Nenhum card ativo aguardando próxima tranche no recorte.</DegradeNote>
            ) : null}
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
            headers={['Tranche', 'Média', 'Amostras']}
            emptyMessage="Sem ciclos de tranche registrados no recorte."
            rows={data.tempoMedioPorTranche.linhas.map((r) => [
              r.tranche,
              formatDiasCorridos(r.mediaDias),
              formatInt(r.amostras),
            ])}
            alignRightFrom={1}
          />
        </PanelBox>
      ) : null}

      {data.correlacaoAtrasoOperacoes != null ? (
        <PanelBox title="Relação atraso Crédito Obra × Operações">
          {data.correlacaoAtrasoOperacoes.projetoIndisponivel ? (
            <DegradeNote>
              Campo projeto_id indisponível — correlação cross-funil não calculada.
            </DegradeNote>
          ) : null}
          {data.correlacaoAtrasoOperacoes.operacoesIndisponivel ? (
            <DegradeNote>
              Cards Operações vinculados ao mesmo projeto não disponíveis — correlação parcial.
            </DegradeNote>
          ) : null}
          {!data.correlacaoAtrasoOperacoes.projetoIndisponivel &&
          !data.correlacaoAtrasoOperacoes.operacoesIndisponivel ? (
            <>
              <p className="mb-3 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
                Projetos com card ativo nos dois funis e SLA vencido na fase atual (dias úteis).
              </p>
              <div className="mb-3 flex flex-wrap gap-2">
                <MiniKpi
                  label="Pares ativos"
                  value={formatInt(data.correlacaoAtrasoOperacoes.projetosComPar)}
                />
                <MiniKpi
                  label="Ambos atrasados"
                  value={formatInt(data.correlacaoAtrasoOperacoes.ambosAtrasados)}
                />
                <MiniKpi
                  label="% entre pares"
                  value={formatPct(data.correlacaoAtrasoOperacoes.pctAmbosEntrePares)}
                />
                <MiniKpi
                  label="% entre atrasados"
                  value={formatPct(data.correlacaoAtrasoOperacoes.pctAmbosEntreAtrasados)}
                />
              </div>
              <DataTable
                headers={['Situação', 'Projetos']}
                emptyMessage="Nenhum par Crédito Obra + Operações ativo no recorte."
                rows={[
                  ['Atrasados nos dois funis', formatInt(data.correlacaoAtrasoOperacoes.ambosAtrasados)],
                  ['Só Crédito Obra atrasado', formatInt(data.correlacaoAtrasoOperacoes.soCreditoAtrasado)],
                  ['Só Operações atrasado', formatInt(data.correlacaoAtrasoOperacoes.soOperacoesAtrasado)],
                ]}
                alignRightFrom={1}
              />
            </>
          ) : null}
        </PanelBox>
      ) : null}
    </section>
  );
}

function ContabilidadeEspecificidadesSection({ data }: { data: PainelContabilidadeEspecificidades }) {
  return (
    <section className="space-y-3">
      <div>
        <h2
          className="text-base font-semibold"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          Especificidades de Contabilidade
        </h2>
        <p className="mt-1 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
          Tempo de abertura por tipo, bloqueio ao Crédito Obra e cumprimento de SLA
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {data.bloqueandoCreditoObra != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Bloqueando Crédito Obra aguardando
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Cards ativos em abertura contábil com card ativo no Crédito Obra em fase de espera (mesmo
              projeto).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MiniKpi label="Total" value={formatInt(data.bloqueandoCreditoObra.totalBloqueando)} />
            </div>
            {data.bloqueandoCreditoObra.projetoIndisponivel ? (
              <DegradeNote>Campo projeto_id indisponível — cruzamento cross-funil não calculado.</DegradeNote>
            ) : null}
            {data.bloqueandoCreditoObra.creditoObraIndisponivel ? (
              <DegradeNote>
                Cards Crédito Obra vinculados ao mesmo projeto não disponíveis — contagem parcial.
              </DegradeNote>
            ) : null}
            {!data.bloqueandoCreditoObra.projetoIndisponivel &&
            !data.bloqueandoCreditoObra.creditoObraIndisponivel &&
            data.bloqueandoCreditoObra.totalBloqueando === 0 ? (
              <DegradeNote>Nenhum bloqueio identificado no recorte.</DegradeNote>
            ) : null}
          </div>
        ) : null}

        {data.taxaConclusaoSlaPorTipo != null ? (
          <div className="px-4 py-4" style={panelStyle}>
            <h4 className="text-[13px] font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Conclusão dentro do SLA por tipo
            </h4>
            <p className="mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
              Saídas de fase concluídas dentro do SLA configurado (dias úteis), via histórico.
            </p>
            {data.taxaConclusaoSlaPorTipo.semSlaConfigurado ? (
              <DegradeNote>SLA não configurado em parte das fases — taxas podem estar incompletas.</DegradeNote>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              {data.taxaConclusaoSlaPorTipo.linhas.map((r) => (
                <MiniKpi key={r.tipo} label={r.tipo} value={formatPct(r.taxaPct)} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {data.tempoAberturaPorTipo != null ? (
        <PanelBox title="Tempo médio de abertura por tipo">
          {data.tempoAberturaPorTipo.historicoParcial ? (
            <DegradeNote>
              Histórico de movimentação incompleto em parte dos cards — tempos são aproximados.
            </DegradeNote>
          ) : null}
          <DataTable
            headers={['Tipo', 'Média', 'Amostras']}
            emptyMessage="Sem permanência registrada nas fases de abertura."
            rows={data.tempoAberturaPorTipo.linhas.map((r) => [
              r.tipo,
              formatDiasCorridos(r.mediaDias),
              formatInt(r.amostras),
            ])}
            alignRightFrom={1}
          />
        </PanelBox>
      ) : null}

      {data.bloqueandoCreditoObra != null &&
      data.bloqueandoCreditoObra.porTipoAbertura.length > 0 ? (
        <PanelBox title="Bloqueios por tipo de abertura">
          <DataTable
            headers={['Tipo', 'Cards']}
            emptyMessage="Sem bloqueios por tipo no recorte."
            rows={data.bloqueandoCreditoObra.porTipoAbertura.map((r) => [
              r.tipo,
              formatInt(r.amostras),
            ])}
            alignRightFrom={1}
          />
        </PanelBox>
      ) : null}

      {data.taxaConclusaoSlaPorTipo != null ? (
        <PanelBox title="Detalhe SLA por tipo de abertura">
          <DataTable
            headers={['Tipo', 'Dentro SLA', 'Concluídos', 'Taxa']}
            emptyMessage="Sem saídas de fase registradas no histórico."
            rows={data.taxaConclusaoSlaPorTipo.linhas.map((r) => [
              r.tipo,
              formatInt(r.dentroSla),
              formatInt(r.concluidos),
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
    () => (gargalosExpandido ? analise.gargalos.ranking : gargalosTop),
    [gargalosExpandido, analise.gargalos.ranking, gargalosTop],
  );

  const pastelariaPorFase = useMemo(
    () => pastelariaPorFaseId(dadosFiltrados.chamados, dadosFiltrados.cardsAnalise),
    [dadosFiltrados.chamados, dadosFiltrados.cardsAnalise],
  );

  const conversaoPorCidade = useMemo(
    () => deriveConversaoPorCidade(dadosFiltrados.cardsAnalise, dataset.fases, period),
    [dadosFiltrados.cardsAnalise, dataset.fases, period],
  );

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
  ]);

  const contabilidadeEspecificidades = useMemo(() => {
    if (dataset.kanbanId !== KANBAN_IDS.CONTABILIDADE) return null;
    return computeContabilidadeEspecificidades({
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
                    Ver todos os gargalos ({formatInt(gargalosBaixo.length)} classificação baixa)
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
                <FunnelConversionGrid
                  nodes={analise.conversao.funnelTree.nodes}
                  faseConversaoConfigurada={analise.conversao.faseConversaoConfigurada}
                />
                {analise.conversao.funnelTree.historicoParcial ? (
                  <p className="mt-2 text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                    Histórico parcial — tempos aproximados em parte dos cards.
                  </p>
                ) : null}
              </PanelBox>

              <PanelBox title="Tempo médio por fase (coorte)">
                <DataTable
                  headers={['Fase', 'Alcançaram', '% entradas', 'Tempo médio']}
                  emptyMessage="Sem dados de tempo."
                  rows={analise.conversao.funnelTree.nodes.map((n) => [
                    `${n.faseNome}${n.faseConversao ? ' · conv.' : ''}`,
                    formatInt(n.alcancaram),
                    formatPct(n.pctSobreEntradas),
                    formatDias(n.tempoMedioDias),
                  ])}
                />
              </PanelBox>

              <PanelBox title="Transições adjacentes">
                <DataTable
                  headers={['Transição', 'Origem', 'Destino', 'Passagem']}
                  emptyMessage="Funil com uma fase apenas."
                  rows={analise.conversao.entreFases
                    .filter((p) => p.alcancaramOrigem > 0)
                    .map((p) => [
                      `${p.deFaseNome} → ${p.paraFaseNome}`,
                      formatInt(p.alcancaramOrigem),
                      formatInt(p.alcancaramDestino),
                      formatPct(p.taxaPassagemPct),
                    ])}
                />
              </PanelBox>
            </div>

            <div className="space-y-4">
              <PanelBox title="Chamados">
                <div className="mb-3 flex flex-wrap gap-2">
                  <MiniKpi label="Abertos" value={formatInt(analise.chamados.abertos)} />
                  <MiniKpi label="Concluídos" value={formatInt(analise.chamados.concluidos)} />
                  <MiniKpi label="Vencidos" value={formatInt(analise.chamados.vencidos)} />
                  <MiniKpi label="Com trava" value={formatInt(analise.chamados.comTrava)} />
                </div>
                <DataTable
                  headers={['Fase', 'Abertos', 'Trava', 'Vencidos', 'Pastelaria']}
                  emptyMessage="Sem chamados no recorte."
                  rows={analise.chamados.porFase
                    .filter((r) => r.total > 0 || r.abertos > 0)
                    .map((r) => [
                      r.faseNome,
                      formatInt(r.abertos),
                      formatInt(r.comTrava),
                      formatInt(r.vencidos),
                      formatInt(pastelariaPorFase.get(r.faseId) ?? 0),
                    ])}
                />
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

            {analise.arquivamento.qualidadeMotivo ? (
              <PainelQualidadeMotivoAlert
                qualidade={analise.arquivamento.qualidadeMotivo}
                formatInt={formatInt}
                formatPct={formatPct}
              />
            ) : null}

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

                <PanelBox title="Arquivamentos por fase">
                  <DataTable
                    headers={['Fase', 'Arquivados', '% total', 'Principal motivo', 'Antes / depois conv.']}
                    emptyMessage="Nenhum arquivado no período."
                    rows={analise.arquivamento.perdas.tabelaPorFase.map((f) => [
                      f.faseNome,
                      formatInt(f.arquivados),
                      formatPct(f.pctDoTotalArquivado),
                      f.principalMotivo,
                      `${formatInt(f.antesConversao)} / ${formatInt(f.depoisConversao)}`,
                    ])}
                    alignRightFrom={1}
                  />
                </PanelBox>

                {analise.arquivamento.motivos.sugestaoMotivoObrigatorio ? (
                  <DegradeNote>
                    Há arquivamentos sem motivo registrado — recomenda-se tornar o campo obrigatório no modal de
                    arquivamento.
                  </DegradeNote>
                ) : null}

                {analise.arquivamento.motivos.ranking.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <PanelBox title="Motivos mais frequentes">
                      <DataTable
                        headers={['Motivo', 'Total', 'Antes conv.', 'Depois conv.']}
                        emptyMessage="Nenhum arquivado no período."
                        rows={analise.arquivamento.motivos.ranking.slice(0, 10).map((m) => [
                          m.motivo,
                          formatInt(m.total),
                          formatInt(m.antesConversao),
                          formatInt(m.depoisConversao),
                        ])}
                        alignRightFrom={1}
                      />
                    </PanelBox>
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
            </div>
          </section>

          <CarometroIndicadoresSection kanbanId={dataset.kanbanId} carometro={analise.carometro} />

          {portfolioEspecificidades ? (
            <PortfolioEspecificidadesSection data={portfolioEspecificidades} />
          ) : null}

          {stepOneEspecificidades ? (
            <StepOneEspecificidadesSection data={stepOneEspecificidades} />
          ) : null}

          {acoplamentoEspecificidades ? (
            <AcoplamentoEspecificidadesSection data={acoplamentoEspecificidades} />
          ) : null}

          {operacoesEspecificidades ? (
            <OperacoesEspecificidadesSection data={operacoesEspecificidades} />
          ) : null}

          {loteadoresEspecificidades ? (
            <LoteadoresEspecificidadesSection data={loteadoresEspecificidades} />
          ) : null}

          {creditoObraEspecificidades ? (
            <CreditoObraEspecificidadesSection data={creditoObraEspecificidades} />
          ) : null}

          {contabilidadeEspecificidades ? (
            <ContabilidadeEspecificidadesSection data={contabilidadeEspecificidades} />
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
              <PanelBox title="Gargalo × chamados">
                <DataTable
                  headers={['Fase', 'Score', 'Abertos', 'Trava']}
                  emptyMessage="Sem dados."
                  rows={analise.chamados.gargaloRelacao.map((r) => [
                    r.faseNome,
                    String(r.gargaloScore),
                    formatInt(r.chamadosAbertos),
                    formatInt(r.chamadosComTrava),
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
