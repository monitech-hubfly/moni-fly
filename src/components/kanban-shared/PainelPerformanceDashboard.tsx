'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { computePainelPerformance } from '@/lib/kanban/painel-performance-compute';
import {
  applyPainelFiltros,
  buildPainelFiltrosOpcoes,
  filtrosAtivos,
  PAINEL_FILTROS_INICIAL,
  type PainelArquivamentoFiltro,
  type PainelFiltrosState,
  type PainelMotivoInformadoFiltro,
} from '@/lib/kanban/painel-filtros';
import type { GargaloClassificacao, PainelPerformanceDataset, PainelPeriodKey } from '@/lib/kanban/painel-performance-types';
import { buildPainelArquivadosDrawerRows } from '@/lib/kanban/painel-arquivados-drawer';
import { ConversionFunnelTree } from './ConversionFunnelTree';
import { PainelArquivadosDrawer } from './PainelArquivadosDrawer';
import { PainelQualidadeMotivoAlert } from './PainelQualidadeMotivoAlert';

const PERIOD_OPTIONS: { key: PainelPeriodKey; label: string }[] = [
  { key: '7d', label: '7 dias' },
  { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' },
  { key: 'all', label: 'Tudo' },
];

function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n);
}

function formatPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

function formatDias(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${Math.round(n)} dias`;
}

function gargaloClassificacaoLabel(c: GargaloClassificacao): string {
  if (c === 'critico') return 'Crítico';
  if (c === 'atencao') return 'Atenção';
  return 'Baixo';
}

function gargaloClassificacaoTagClass(c: GargaloClassificacao): string {
  if (c === 'critico') return 'moni-tag-atrasado';
  if (c === 'atencao') return 'moni-tag-atencao';
  return 'moni-tag-concluido';
}

function buildOpenCardHref(basePath: string, cardId: string): string {
  const sep = basePath.includes('?') ? '&' : '?';
  return `${basePath}${sep}tab=kanban&card=${encodeURIComponent(cardId)}`;
}

function ResumoCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div
      className="flex min-h-[108px] flex-col justify-between px-4 py-4"
      style={{
        borderRadius: 'var(--moni-radius-lg)',
        background: 'var(--moni-surface-0)',
        border: '0.5px solid var(--moni-border-default)',
        boxShadow: 'var(--moni-shadow-card)',
      }}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
        {label}
      </p>
      <p
        className="mt-2 text-2xl font-semibold tabular-nums tracking-tight"
        style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[11px] leading-snug" style={{ color: 'var(--moni-text-tertiary)' }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-4">
      <div>
        <h2
          className="text-lg font-semibold tracking-tight"
          style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
        >
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function PanelCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="bg-[var(--moni-surface-0)] px-4 py-4"
      style={{
        borderRadius: 'var(--moni-radius-lg)',
        border: '0.5px solid var(--moni-border-default)',
        boxShadow: 'var(--moni-shadow-card)',
      }}
    >
      <h3 className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MetricTable({
  headers,
  rows,
  emptyMessage,
}: {
  headers: string[];
  rows: string[][];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
        {emptyMessage}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead>
          <tr style={{ borderBottom: '0.5px solid var(--moni-border-subtle)' }}>
            {headers.map((h) => (
              <th
                key={h}
                className="pb-2 pr-4 text-[11px] font-semibold uppercase tracking-wide last:pr-0"
                style={{ color: 'var(--moni-text-tertiary)' }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, idx) => (
            <tr key={idx} style={{ borderBottom: '0.5px solid var(--moni-border-subtle)' }}>
              {cells.map((cell, ci) => (
                <td
                  key={ci}
                  className={`py-2.5 pr-4 last:pr-0 ${ci > 0 ? 'tabular-nums text-right' : ''}`}
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

const selectStyle: React.CSSProperties = {
  borderRadius: 'var(--moni-radius-md)',
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
  color: 'var(--moni-text-primary)',
  fontFamily: 'var(--moni-font-sans)',
};

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
        className="min-h-[44px] w-full px-3 py-2 text-sm sm:min-h-[36px]"
        style={selectStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

export function PainelPerformanceDashboard({ dataset }: { dataset: PainelPerformanceDataset }) {
  const pathname = usePathname();
  const [period, setPeriod] = useState<PainelPeriodKey>('30d');
  const [filtros, setFiltros] = useState<PainelFiltrosState>(PAINEL_FILTROS_INICIAL);
  const [arquivadosDrawerOpen, setArquivadosDrawerOpen] = useState(false);

  const opcoesFiltros = useMemo(() => buildPainelFiltrosOpcoes(dataset), [dataset]);

  const dadosFiltrados = useMemo(
    () => applyPainelFiltros(dataset, filtros),
    [dataset, filtros],
  );

  const analise = useMemo(
    () =>
      computePainelPerformance({
        mode: dataset.mode,
        period,
        fases: dataset.fases,
        cards: dadosFiltrados.cards,
        cardsAnalise: dadosFiltrados.cardsAnalise,
        chamados: dadosFiltrados.chamados,
        retrocessoRows: dadosFiltrados.retrocessoRows,
        historicoMovimentos: dadosFiltrados.historicoMovimentos,
        historicoAnalise: dadosFiltrados.historicoAnalise,
        profiles: dataset.profiles,
      }),
    [dataset.mode, dataset.fases, dataset.profiles, dadosFiltrados, period],
  );

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

  const setF = <K extends keyof PainelFiltrosState>(key: K, value: PainelFiltrosState[K]) => {
    setFiltros((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-10 pb-10">
      {/* Cabeçalho */}
      <header className="space-y-6" style={{ borderBottom: '0.5px solid var(--moni-border-default)', paddingBottom: '1.5rem' }}>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
            {dataset.kanbanNome}
          </p>
          <h1
            className="mt-1 text-3xl font-semibold tracking-tight"
            style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
          >
            Painel do Funil
          </h1>
          <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            Análise padronizada do funil: operação, conversão, gargalos, chamados e insights automáticos.
          </p>
        </div>

        {/* Filtros */}
        <div
          className="space-y-4 rounded-xl p-4"
          style={{
            background: 'var(--moni-surface-100)',
            border: '0.5px solid var(--moni-border-subtle)',
            borderRadius: 'var(--moni-radius-lg)',
          }}
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--moni-text-secondary)' }}>
              Filtros
            </p>
            {filtrosAtivos(filtros) ? (
              <button
                type="button"
                className="min-h-[36px] text-xs font-medium underline-offset-2 hover:underline"
                style={{ color: 'var(--moni-navy-800)' }}
                onClick={() => setFiltros(PAINEL_FILTROS_INICIAL)}
              >
                Limpar filtros
              </button>
            ) : null}
          </div>

          <div
            className="inline-flex flex-wrap rounded-full p-0.5"
            style={{ background: 'var(--moni-surface-200)', border: '0.5px solid var(--moni-border-default)' }}
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
                  className="min-h-[44px] rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-0"
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

          <div className="flex flex-wrap gap-3">
            {opcoesFiltros.temFranquia ? (
              <FilterSelect
                label="Franquia / Unidade"
                value={filtros.franquiaId ?? ''}
                onChange={(v) => setF('franquiaId', v || null)}
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
              onChange={(v) => setF('responsavelKey', v || null)}
            >
              <option value="">Todos</option>
              {opcoesFiltros.responsaveis.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect
              label="Fase"
              value={filtros.faseId ?? ''}
              onChange={(v) => setF('faseId', v || null)}
            >
              <option value="">Todas</option>
              {[...dataset.fases]
                .sort((a, b) => a.ordem - b.ordem)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
            </FilterSelect>

            <FilterSelect label="Status" value={filtros.status} onChange={(v) => setF('status', v as PainelFiltrosState['status'])}>
              <option value="all">Todos</option>
              <option value="ativo">Ativos</option>
              <option value="arquivado">Arquivados</option>
            </FilterSelect>

            <FilterSelect
              label="Arquivamento"
              value={filtros.arquivamento}
              onChange={(v) => setF('arquivamento', v as PainelArquivamentoFiltro)}
            >
              <option value="all">Todos</option>
              <option value="antes_conversao">Antes da conversão</option>
              <option value="depois_conversao">Depois da conversão</option>
            </FilterSelect>

            {opcoesFiltros.motivosArquivamento.length > 0 ? (
              <FilterSelect
                label="Motivo de arquivamento"
                value={filtros.motivoArquivamento ?? ''}
                onChange={(v) => setF('motivoArquivamento', v || null)}
              >
                <option value="">Todos</option>
                {opcoesFiltros.motivosArquivamento.map((m) => (
                  <option key={m.motivo} value={m.motivo}>
                    {m.motivo} ({m.total})
                  </option>
                ))}
              </FilterSelect>
            ) : null}

            <FilterSelect
              label="Motivo informado"
              value={filtros.motivoInformado}
              onChange={(v) => setF('motivoInformado', v as PainelMotivoInformadoFiltro)}
            >
              <option value="all">Todos</option>
              <option value="com">Com motivo</option>
              <option value="sem">Sem motivo</option>
            </FilterSelect>

            <FilterSelect
              label="Fase de arquivamento"
              value={filtros.faseArquivamentoId ?? ''}
              onChange={(v) => setF('faseArquivamentoId', v || null)}
            >
              <option value="">Todas</option>
              {[...dataset.fases]
                .sort((a, b) => a.ordem - b.ordem)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
            </FilterSelect>

            <FilterSelect
              label="Chamados"
              value={filtros.chamados}
              onChange={(v) => setF('chamados', v as PainelFiltrosState['chamados'])}
            >
              <option value="all">Todos</option>
              <option value="com">Com chamados abertos</option>
              <option value="sem">Sem chamados abertos</option>
            </FilterSelect>

            <FilterSelect
              label="Trava"
              value={filtros.trava}
              onChange={(v) => setF('trava', v as PainelFiltrosState['trava'])}
            >
              <option value="all">Todos</option>
              <option value="com">Com trava</option>
              <option value="sem">Sem trava</option>
            </FilterSelect>
          </div>

          <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>
            {formatInt(dadosFiltrados.cards.length)} cards no recorte · Período: {periodLabel}
            {filtrosAtivos(filtros) ? ' · Filtros adicionais aplicados' : ''}
          </p>
          {dadosFiltrados.ocultandoArquivados ? (
            <p
              className="rounded-lg px-3 py-2 text-xs"
              style={{
                color: 'var(--moni-text-secondary)',
                background: 'var(--moni-surface-0)',
                border: '0.5px solid var(--moni-border-subtle)',
                borderRadius: 'var(--moni-radius-md)',
              }}
            >
              Cards arquivados estão ocultos neste filtro. Conversão e perdas por arquivamento continuam
              considerando os arquivados do recorte.
            </p>
          ) : null}
        </div>
      </header>

      {dataset.mode === 'legado' ? (
        <p
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            border: '0.5px solid var(--moni-border-default)',
            background: 'var(--moni-surface-100)',
            color: 'var(--moni-text-secondary)',
            borderRadius: 'var(--moni-radius-lg)',
          }}
        >
          Modo legado: histórico de fases limitado; métricas usam posição atual e movimentos disponíveis.
        </p>
      ) : null}

      {!analise.conversao.faseConversaoConfigurada ? (
        <p
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            color: 'var(--moni-text-secondary)',
            background: 'var(--moni-surface-100)',
            border: '0.5px solid var(--moni-border-subtle)',
            borderRadius: 'var(--moni-radius-lg)',
          }}
        >
          Fase de conversão não configurada
        </p>
      ) : null}

      {/* 1. Operação do funil */}
      <Section
        id="operacao"
        title="1. Operação do funil"
        subtitle={`Volume, SLA e distribuição por fase — ${periodLabel}.`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <ResumoCard label="Cards ativos" value={formatInt(analise.operacao.cardsAtivos)} hint="Agora no funil" />
          <ResumoCard label="Entradas" value={formatInt(analise.operacao.cardsEntraram)} hint="Novos no período" />
          <ResumoCard label="Concluídos" value={formatInt(analise.operacao.concluidos)} />
          <ResumoCard label="Arquivados" value={formatInt(analise.operacao.arquivados)} />
          <ResumoCard
            label="SLA em dia"
            value={formatPct(analise.operacao.pctSlaDentro)}
            hint="Cards ativos com meta de fase"
          />
        </div>
        <PanelCard title="Cards por fase">
          <MetricTable
            headers={['Fase', 'Ativos', 'Arquivados', 'Atrasados', 'Dias úteis méd.']}
            emptyMessage="Sem fases configuradas."
            rows={analise.operacao.porFase
              .filter((f) => f.cardsAtivos > 0 || f.cardsArquivados > 0 || f.atrasados > 0)
              .map((f) => [
                `${f.faseNome}${f.faseConversao ? ' · conv.' : ''}`,
                formatInt(f.cardsAtivos),
                f.cardsArquivados > 0 ? formatInt(f.cardsArquivados) : '—',
                formatInt(f.atrasados),
                f.diasUteisMedio > 0 ? `${Math.round(f.diasUteisMedio)} d.u.` : '—',
              ])}
          />
        </PanelCard>
      </Section>

      {analise.arquivamento.qualidadeMotivo ? (
        <PainelQualidadeMotivoAlert
          qualidade={analise.arquivamento.qualidadeMotivo}
          formatInt={formatInt}
          formatPct={formatPct}
        />
      ) : null}

      {/* Perdas e Arquivamentos */}
      <Section
        id="perdas-arquivamentos"
        title="Perdas e Arquivamentos"
        subtitle={`Onde o funil perde cards por arquivamento — ${periodLabel}. Antes da conversão = perda do funil; depois = perda pós-conversão (não reduz a taxa de conversão).`}
      >
        {analise.arquivamento.perdas.totalArquivados === 0 ? (
          <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
            Nenhum card arquivado no recorte analisado.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setArquivadosDrawerOpen(true)}
                className="min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
                style={{
                  background: 'var(--moni-navy-800)',
                  color: 'var(--moni-text-inverse)',
                  borderRadius: 'var(--moni-radius-md)',
                }}
              >
                Ver cards arquivados ({formatInt(arquivadosDrawerRows.length)})
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              <ResumoCard
                label="Total arquivados"
                value={formatInt(analise.arquivamento.perdas.totalArquivados)}
              />
              <ResumoCard
                label="% do período"
                value={formatPct(analise.arquivamento.perdas.pctDoPeriodo)}
                hint={`Sobre ${formatInt(analise.arquivamento.cardsAnalisados)} cards no recorte`}
              />
              <ResumoCard
                label="Antes da conversão"
                value={formatInt(analise.arquivamento.perdas.antesConversao)}
                hint="Perda do funil"
              />
              <ResumoCard
                label="Na conversão"
                value={formatInt(analise.arquivamento.perdas.naConversao)}
                hint="Converteu e arquivou na fase"
              />
              <ResumoCard
                label="Depois da conversão"
                value={formatInt(analise.arquivamento.perdas.depoisConversao)}
                hint="Pós-conversão"
              />
              <ResumoCard
                label="Principal fase"
                value={
                  analise.arquivamento.perdas.principalFaseArquivamento?.faseNome ?? '—'
                }
                hint={
                  analise.arquivamento.perdas.principalFaseArquivamento
                    ? `${formatInt(analise.arquivamento.perdas.principalFaseArquivamento.total)} arquivados`
                    : undefined
                }
              />
              <ResumoCard
                label="Principal motivo"
                value={
                  analise.arquivamento.perdas.principalMotivoArquivamento?.motivo ?? '—'
                }
                hint={
                  analise.arquivamento.perdas.principalMotivoArquivamento
                    ? `${formatInt(analise.arquivamento.perdas.principalMotivoArquivamento.total)} ocorrências`
                    : undefined
                }
              />
              <ResumoCard
                label="Sem motivo"
                value={formatPct(analise.arquivamento.perdas.pctSemMotivo)}
                hint={
                  analise.arquivamento.perdas.semMotivoInformado > 0
                    ? `${formatInt(analise.arquivamento.perdas.semMotivoInformado)} card(s)`
                    : 'Todos informados'
                }
              />
            </div>

            {analise.arquivamento.perdas.impactoPerdaConversaoPct != null &&
            analise.conversao.entradasNoPeriodo > 0 ? (
              <p className="text-sm tabular-nums" style={{ color: 'var(--moni-text-secondary)' }}>
                Impacto na conversão:{' '}
                <strong style={{ color: 'var(--moni-text-primary)' }}>
                  {formatPct(analise.arquivamento.perdas.impactoPerdaConversaoPct)}
                </strong>{' '}
                das entradas da coorte arquivadas antes da conversão ({formatInt(analise.arquivamento.perdas.antesConversao)}{' '}
                de {formatInt(analise.conversao.entradasNoPeriodo)} entradas).
              </p>
            ) : null}

            <PanelCard title="Arquivamentos por fase">
              <MetricTable
                headers={[
                  'Fase',
                  'Arquivados',
                  '% do total',
                  'Principal motivo',
                  'Antes / depois conv.',
                ]}
                emptyMessage="Nenhum arquivado no período."
                rows={analise.arquivamento.perdas.tabelaPorFase.map((f) => [
                  f.faseNome,
                  formatInt(f.arquivados),
                  formatPct(f.pctDoTotalArquivado),
                  f.principalMotivo,
                  `${formatInt(f.antesConversao)} / ${formatInt(f.depoisConversao)}`,
                ])}
              />
            </PanelCard>

            {analise.arquivamento.motivos.sugestaoMotivoObrigatorio ? (
              <p
                className="rounded-lg px-3 py-2.5 text-sm"
                style={{
                  color: 'var(--moni-text-secondary)',
                  background: 'var(--moni-surface-100)',
                  border: '0.5px solid var(--moni-border-subtle)',
                  borderRadius: 'var(--moni-radius-md)',
                }}
              >
                Há arquivamentos sem motivo registrado. Recomenda-se tornar o campo obrigatório no modal de
                arquivamento para melhorar a análise de perda do funil.
              </p>
            ) : null}

            {analise.arquivamento.motivos.ranking.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <PanelCard title="Motivos mais frequentes">
                  <MetricTable
                    headers={['Motivo', 'Total', 'Antes conv.', 'Depois conv.']}
                    emptyMessage="Nenhum arquivado no período."
                    rows={analise.arquivamento.motivos.ranking.slice(0, 10).map((m) => [
                      m.motivo,
                      formatInt(m.total),
                      formatInt(m.antesConversao),
                      formatInt(m.depoisConversao),
                    ])}
                  />
                </PanelCard>
                <PanelCard title="Impacto na perda antes da conversão">
                  <MetricTable
                    headers={['Motivo', 'Perdas', 'Depois conv.']}
                    emptyMessage="Nenhuma perda por arquivamento no período."
                    rows={analise.arquivamento.motivos.impactoPerdaAntesConversao.slice(0, 10).map((m) => [
                      m.motivo,
                      formatInt(m.antesConversao),
                      formatInt(m.depoisConversao),
                    ])}
                  />
                </PanelCard>
                <PanelCard title="Motivos por responsável">
                  <MetricTable
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
                  />
                </PanelCard>
                {analise.arquivamento.motivos.porFranquia.length > 0 ? (
                  <PanelCard title="Motivos por franquia / unidade">
                    <MetricTable
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
                    />
                  </PanelCard>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </Section>

      {/* 2. Conversão */}
      <Section
        id="conversao"
        title="2. Conversão"
        subtitle="Coorte do período, passagem entre fases e tempo até a conversão configurada."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <ResumoCard label="Entradas" value={formatInt(analise.conversao.entradasNoPeriodo)} hint="Coorte" />
          <ResumoCard label="Conversões" value={formatInt(analise.conversao.chegaramConversao)} />
          <ResumoCard label="Taxa" value={formatPct(analise.conversao.taxaConversaoPct)} />
          <ResumoCard
            label="Tempo médio"
            value={formatDias(analise.conversao.tempoMedioConversaoDias)}
            hint="Até conversão"
          />
          <ResumoCard
            label="Arq. antes conv."
            value={formatInt(analise.conversao.arquivadosSemConversao)}
            hint="Perda por arquivamento"
          />
          <ResumoCard
            label="Arq. na conv."
            value={formatInt(analise.conversao.arquivadosNaConversao)}
            hint="Arquivados na fase de conversão"
          />
          <ResumoCard
            label="Arq. depois conv."
            value={formatInt(analise.conversao.arquivadosDepoisConversao)}
            hint="Perda pós-conversão"
          />
        </div>

        {analise.conversao.concluidosInconsistentesAntesConversao > 0 ? (
          <p
            className="rounded-lg px-4 py-3 text-sm"
            role="status"
            style={{
              border: '0.5px solid var(--moni-status-attention-border)',
              background: 'var(--moni-status-attention-bg)',
              color: 'var(--moni-status-attention-text)',
              borderRadius: 'var(--moni-radius-lg)',
            }}
          >
            {formatInt(analise.conversao.concluidosInconsistentesAntesConversao)} card(s) concluído(s) antes da
            fase de conversão — inconsistência operacional que distorce a taxa de conversão.
          </p>
        ) : null}

        <PanelCard title="Funil de conversão">
          <ConversionFunnelTree data={analise.conversao.funnelTree} />
        </PanelCard>

        {analise.conversao.fasesConversao.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {analise.conversao.fasesConversao.map((f) => (
              <span key={f.id} className="moni-tag-concluido text-xs">
                Conversão: {f.nome}
              </span>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PanelCard title="Transições adjacentes">
            <MetricTable
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
          </PanelCard>
          <PanelCard title="Conversão por fase">
            <MetricTable
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
            />
          </PanelCard>
          <PanelCard title="Por responsável">
            <MetricTable
              headers={['Responsável', 'Entradas', 'Convertidos', 'Taxa']}
              emptyMessage="Sem dados."
              rows={analise.conversao.porResponsavel.slice(0, 8).map((p) => [
                p.responsavelNome,
                formatInt(p.entradas),
                formatInt(p.converteram),
                formatPct(p.taxaConversaoPct),
              ])}
            />
          </PanelCard>
          {analise.conversao.porFranquia.length > 0 ? (
            <PanelCard title="Por franquia / unidade">
              <MetricTable
                headers={['Unidade', 'Entradas', 'Convertidos', 'Taxa']}
                emptyMessage="Sem vínculo com rede."
                rows={analise.conversao.porFranquia.slice(0, 8).map((p) => [
                  p.label,
                  formatInt(p.entradas),
                  formatInt(p.converteram),
                  formatPct(p.taxaConversaoPct),
                ])}
              />
            </PanelCard>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <span className="text-sm tabular-nums" style={{ color: 'var(--moni-text-secondary)' }}>
            Perda total:{' '}
            <strong style={{ color: 'var(--moni-text-primary)' }}>{formatPct(analise.conversao.perdaTotalPct)}</strong>
          </span>
        </div>

        <PanelCard title="Tempo médio por fase (coorte)">
          <MetricTable
            headers={['Fase', 'Alcançaram', '% entradas', 'Tempo médio']}
            emptyMessage="Sem dados de tempo."
            rows={analise.conversao.funnelTree.nodes.map((n) => [
              `${n.faseNome}${n.faseConversao ? ' · conv.' : ''}`,
              formatInt(n.alcancaram),
              formatPct(n.pctSobreEntradas),
              formatDias(n.tempoMedioDias),
            ])}
          />
        </PanelCard>
        {analise.conversao.funnelTree.historicoParcial ? (
          <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
            Tempos parciais: histórico incompleto — aproximação pela posição atual em parte dos cards.
          </p>
        ) : null}
      </Section>

      {/* 3. Gargalos */}
      <Section
        id="gargalos"
        title="3. Gargalos"
        subtitle="GargaloScore por fase — volume, atraso, inatividade, perda de conversão, chamados e arquivamento."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:max-w-md">
          <ResumoCard
            label="Fases críticas"
            value={formatInt(gargalosCriticos)}
            hint={gargalosCriticos > 0 ? 'Score ≥ 70' : 'Nenhuma crítica'}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <PanelCard title="Ranking">
            {analise.gargalos.ranking.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>Sem fases.</p>
            ) : (
              <ul className="space-y-3">
                {analise.gargalos.ranking.map((g, idx) => (
                  <li
                    key={g.faseId}
                    className="rounded-lg px-3 py-3"
                    style={{
                      border: '0.5px solid var(--moni-border-default)',
                      borderRadius: 'var(--moni-radius-lg)',
                      background: idx === 0 && g.score >= 40 ? 'var(--moni-surface-100)' : 'transparent',
                    }}
                  >
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs tabular-nums" style={{ color: 'var(--moni-text-tertiary)' }}>
                          {idx + 1}.
                        </span>
                        <span className="font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                          {g.faseNome}
                        </span>
                        <span className={`text-xs ${gargaloClassificacaoTagClass(g.classificacao)}`}>
                          {gargaloClassificacaoLabel(g.classificacao)}
                        </span>
                      </div>
                      <span className="text-lg font-semibold tabular-nums" style={{ color: 'var(--moni-navy-800)' }}>
                        {g.score}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--moni-text-tertiary)' }}>
                      <span className="moni-tag-arquivado mr-1.5 text-[10px]">{g.principalMotivo}</span>
                      {g.principalMotivoTexto}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>
          <PanelCard title="Detalhe">
            <MetricTable
              headers={['Fase', 'Score', 'Cards', 'Atraso', 'Arq.', 'Antes conv.', 'Cham.', 'Trava']}
              emptyMessage="Sem fases."
              rows={analise.gargalos.ranking.map((g) => [
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
          </PanelCard>
        </div>
        {analise.gargalos.retrocessos.length > 0 ? (
          <PanelCard title="Retrocessos recentes">
            <ul className="space-y-2 text-sm">
              {analise.gargalos.retrocessos.slice(0, 5).map((r) => (
                <li key={r.cardId} className="flex justify-between gap-2">
                  <Link href={buildOpenCardHref(openCardBase, r.cardId)} className="hover:underline" style={{ color: 'var(--moni-navy-800)' }}>
                    {r.titulo}
                  </Link>
                  <span className="moni-tag-atencao shrink-0 text-xs tabular-nums">{r.count}×</span>
                </li>
              ))}
            </ul>
          </PanelCard>
        ) : null}
      </Section>

      {/* 4. Chamados */}
      <Section
        id="chamados"
        title="4. Chamados"
        subtitle="Cruzamento funil + fase + card. Edição via card ou Sirene."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ResumoCard label="Abertos" value={formatInt(analise.chamados.abertos)} />
          <ResumoCard label="Concluídos" value={formatInt(analise.chamados.concluidos)} />
          <ResumoCard label="Vencidos" value={formatInt(analise.chamados.vencidos)} />
          <ResumoCard label="Com trava" value={formatInt(analise.chamados.comTrava)} />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PanelCard title="Por fase">
            <MetricTable
              headers={['Fase', 'Abertos', 'Trava', 'Vencidos']}
              emptyMessage="Sem chamados."
              rows={analise.chamados.porFase.map((r) => [
                r.faseNome,
                formatInt(r.abertos),
                formatInt(r.comTrava),
                formatInt(r.vencidos),
              ])}
            />
          </PanelCard>
          <PanelCard title="Gargalo × chamados">
            <MetricTable
              headers={['Fase', 'Score', 'Abertos', 'Trava']}
              emptyMessage="Sem dados."
              rows={analise.chamados.gargaloRelacao.map((r) => [
                r.faseNome,
                String(r.gargaloScore),
                formatInt(r.chamadosAbertos),
                formatInt(r.chamadosComTrava),
              ])}
            />
          </PanelCard>
          <PanelCard title="Por responsável">
            <MetricTable
              headers={['Responsável', 'Abertos', 'Trava']}
              emptyMessage="Sem dados."
              rows={analise.chamados.porResponsavel.slice(0, 8).map((r) => [
                r.responsavelNome,
                formatInt(r.abertos),
                formatInt(r.comTrava),
              ])}
            />
          </PanelCard>
          <PanelCard title="Por status">
            <MetricTable
              headers={['Status', 'Qtd.']}
              emptyMessage="Sem chamados."
              rows={analise.chamados.porStatus.map((r) => [r.status, formatInt(r.total)])}
            />
          </PanelCard>
        </div>
        {analise.chamados.destaque.length > 0 ? (
          <PanelCard title="Prioritários">
            <ul className="space-y-2 text-sm">
              {analise.chamados.destaque.slice(0, 8).map((ch) => (
                <li
                  key={ch.id}
                  className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-0"
                  style={{ borderColor: 'var(--moni-border-subtle)' }}
                >
                  {ch.editHref ? (
                    <Link href={ch.editHref} className="font-medium hover:underline" style={{ color: 'var(--moni-navy-800)' }}>
                      {ch.titulo}
                    </Link>
                  ) : (
                    <span style={{ color: 'var(--moni-text-primary)' }}>{ch.titulo}</span>
                  )}
                  {ch.trava ? <span className="moni-tag-atrasado text-[10px]">Trava</span> : null}
                  {ch.atrasado ? <span className="moni-tag-atencao text-[10px]">Vencido</span> : null}
                  <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                    · {ch.faseNome}
                  </span>
                </li>
              ))}
            </ul>
          </PanelCard>
        ) : null}
      </Section>

      {/* 5. Insights */}
      <Section
        id="insights"
        title="5. Insights"
        subtitle={`Leituras automáticas sobre operação, conversão, gargalos e chamados — ${periodLabel}.`}
      >
        {analise.insights.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
            Dados insuficientes para insights acionáveis.
          </p>
        ) : (
          <ul className="space-y-3">
            {analise.insights.map((ins) => (
              <li
                key={`${ins.tipo}-${ins.texto.slice(0, 48)}`}
                className="flex gap-3 rounded-lg px-4 py-3"
                style={{
                  border: '0.5px solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-lg)',
                  background: 'var(--moni-surface-0)',
                  boxShadow: 'var(--moni-shadow-card)',
                }}
              >
                <span
                  className="moni-tag-concluido shrink-0 self-start text-[10px]"
                  style={{ borderRadius: 'var(--moni-radius-md)' }}
                >
                  {ins.tipoLabel}
                </span>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--moni-text-secondary)' }}>
                  {ins.texto}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="text-center text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
        Somente leitura · kanban_cards · kanban_fases · kanban_atividades · sirene_chamados
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
