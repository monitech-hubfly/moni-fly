'use client';

import { useMemo, useState } from 'react';
import type {
  PipelineCardDisplay,
  PipelineCardRow,
  PipelineCardsDataset,
  PipelineCardsFiltros,
  PipelineCardsKpis,
  PipelineCardsKpisUnidade,
  PipelineFranqueadoUnidade,
  PipelineFranqueadoraEnrichment,
  PipelineGroupBy,
} from '@/lib/kanban/pipeline-cards-types';
import { PIPELINE_CARDS_FILTROS_DEFAULT } from '@/lib/kanban/pipeline-cards-types';
import {
  enriquecerPipelineCard,
  filtrarPipelineCards,
  labelFranqueadoPipeline,
} from '@/lib/kanban/pipeline-cards-utils';
import {
  calcularKpisPipelineFranqueadoraExtended,
  cardsElegiveisFranqueadora,
  montarBlocosUnidadePipeline,
  sortCardsFranqueadoraPrioridade,
} from '@/lib/kanban/pipeline-franqueadora-compute';
import { computeFunilMesUnidade } from '@/lib/kanban/pipeline-funil-mes-compute';
import {
  calcularKpisPipelineUnidadeExtended,
  montarBlocosDisplayUnidade,
  montarOQueFazerHoje,
  saudeMesUnidadePipeline,
} from '@/lib/kanban/pipeline-unidade-compute';
import { PipelineCardMiniDrawer } from '@/components/pipeline/PipelineCardMiniDrawer';
import { PipelineFranqueadoraUnidadeBloco } from '@/components/pipeline/PipelineFranqueadoraUnidadeBloco';
import { PipelineSaudeMesCondensado } from '@/components/pipeline/PipelineSaudeMesCondensado';
import { PipelineUnidadeResumoLinha } from '@/components/pipeline/PipelineUnidadeResumoLinha';
import { PipelineOQueFazerHoje } from '@/components/pipeline/PipelineOQueFazerHoje';
import { PipelineUnidadeProjetoBloco } from '@/components/pipeline/PipelineUnidadeProjetoBloco';
import { PipelineUnidadeCardSolo } from '@/components/pipeline/PipelineUnidadeCardSolo';
import { PipelineFunilMesRede } from '@/components/pipeline/PipelineFunilMesRede';
import { PipelineFunilMesUnidade } from '@/components/pipeline/PipelineFunilMesUnidade';
import { excluirFranquiaDosGraficosVisaoGeral } from '@/lib/rede-visibilidade-franqueado';
import { PIPELINE_READONLY_NOTA } from '@/lib/kanban/pipeline-card-readonly';

export type PipelineCardsViewProps = {
  mode: 'franqueadora' | 'rede' | 'unidade';
  franqueadoId?: string;
  showFranchiseGroups?: boolean;
  incluirUnidadesVazias?: boolean;
  showFilters?: boolean;
  showKpis?: boolean;
  defaultGroupBy?: PipelineGroupBy;
  dataset: PipelineCardsDataset;
  className?: string;
};

const panelStyle: React.CSSProperties = {
  borderRadius: 'var(--moni-radius-lg)',
  border: '0.5px solid var(--moni-border-default)',
  background: 'var(--moni-surface-0)',
};

function PipelineKpisBarFranqueadora({ kpis }: { kpis: PipelineCardsKpis }) {
  const items: { label: string; value: number; hint?: string }[] = [
    { label: 'Cards ativos', value: kpis.cardsAtivos },
    { label: 'Cards atrasados', value: kpis.cardsAtrasados },
    { label: 'Sem movimentação', value: kpis.cardsSemMovimentacao, hint: '7+ dias' },
    { label: 'Próx. vencimentos', value: kpis.cardsVencendoEmBreve },
    { label: 'Gargalos críticos', value: kpis.gargalosCriticos, hint: 'GargaloScore > 70' },
    { label: 'Chamados com trava', value: kpis.chamadosComTrava },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="flex min-h-[88px] flex-col justify-between px-3 py-3" style={panelStyle}>
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
            {item.label}
          </p>
          <p
            className="mt-1 text-xl font-semibold tabular-nums tracking-tight"
            style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-navy-800)' }}
          >
            {item.value}
          </p>
          {item.hint ? (
            <p className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--moni-text-tertiary)' }}>
              {item.hint}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PipelineKpisBarUnidade({ kpis }: { kpis: PipelineCardsKpisUnidade }) {
  type KpiVariant = 'neutral' | 'danger' | 'warning';

  const items: { label: string; value: number; hint?: string; variant: KpiVariant }[] = [
    { label: 'Cards ativos', value: kpis.cardsAtivos, variant: 'neutral' },
    { label: 'Cards atrasados', value: kpis.cardsAtrasados, variant: 'danger' },
    { label: 'Sem movimentação', value: kpis.cardsSemMovimentacao, hint: '7+ dias', variant: 'warning' },
    { label: 'Próx. vencimentos', value: kpis.proximosVencimentos, variant: 'neutral' },
    { label: 'Funis ativos', value: kpis.funisAtivos, hint: 'Com ≥1 card', variant: 'neutral' },
    { label: 'Chamados com trava', value: kpis.chamadosComTrava, variant: 'neutral' },
  ];

  const variantStyle = (variant: KpiVariant): React.CSSProperties => {
    if (variant === 'danger') {
      return { ...panelStyle, background: 'var(--moni-status-overdue-bg)' };
    }
    if (variant === 'warning') {
      return { ...panelStyle, background: 'var(--moni-status-attention-bg)' };
    }
    return panelStyle;
  };

  const valueColor = (variant: KpiVariant): string => {
    if (variant === 'danger') return 'var(--moni-status-overdue-text)';
    if (variant === 'warning') return 'var(--moni-status-attention-text)';
    return 'var(--moni-navy-800)';
  };

  return (
    <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="flex min-h-[88px] flex-col justify-between px-3 py-3" style={variantStyle(item.variant)}>
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
            {item.label}
          </p>
          <p
            className="mt-1 text-xl font-semibold tabular-nums tracking-tight"
            style={{ fontFamily: 'var(--moni-font-display)', color: valueColor(item.variant) }}
          >
            {item.value}
          </p>
          {item.hint ? (
            <p className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--moni-text-tertiary)' }}>
              {item.hint}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function resolvePipelineViewMode(mode: PipelineCardsViewProps['mode']): 'franqueadora' | 'unidade' {
  return mode === 'unidade' ? 'unidade' : 'franqueadora';
}

function filtrarDatasetPorModo(
  dataset: PipelineCardsDataset,
  mode: PipelineCardsViewProps['mode'],
  franqueadoId?: string,
): { cards: PipelineCardRow[]; franqueados: PipelineFranqueadoUnidade[] } {
  const redeId = String(franqueadoId ?? '').trim();
  const resolved = resolvePipelineViewMode(mode);
  if (resolved === 'unidade') {
    if (!redeId) return { cards: [], franqueados: [] };
    return {
      cards: dataset.cards.filter((c) => String(c.rede_franqueado_id ?? '') === redeId),
      franqueados: dataset.franqueados.filter((f) => f.rede_franqueado_id === redeId),
    };
  }
  return dataset;
}

const filtersBarStyle: React.CSSProperties = {
  padding: '10px 14px',
  background: 'var(--color-background-secondary)',
  borderRadius: 'var(--moni-radius-md)',
};

const filterSelectStyle: React.CSSProperties = {
  width: '130px',
  flexShrink: 0,
  height: '32px',
  fontSize: '12px',
  padding: '4px 8px',
  border: '0.5px solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-md)',
  background: 'var(--moni-surface-0)',
  fontFamily: 'var(--moni-font-sans)',
  color: 'var(--moni-text-primary)',
};

const filterSearchStyle: React.CSSProperties = {
  flex: 1,
  minWidth: '140px',
  height: '32px',
  fontSize: '12px',
  padding: '4px 8px 4px 32px',
  border: '0.5px solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-md)',
  background: 'var(--moni-surface-0)',
  fontFamily: 'var(--moni-font-sans)',
  color: 'var(--moni-text-primary)',
};

export function PipelineCardsView({
  mode,
  franqueadoId,
  showFranchiseGroups = resolvePipelineViewMode(mode) === 'franqueadora',
  incluirUnidadesVazias = false,
  showFilters = true,
  showKpis = true,
  defaultGroupBy = 'franquia',
  dataset,
  className,
}: PipelineCardsViewProps) {
  const viewMode = resolvePipelineViewMode(mode);
  const [groupBy, setGroupBy] = useState<PipelineGroupBy>(viewMode === 'franqueadora' ? 'franquia' : defaultGroupBy);
  const [filtros, setFiltros] = useState<PipelineCardsFiltros>(PIPELINE_CARDS_FILTROS_DEFAULT);
  const [drawerCard, setDrawerCard] = useState<PipelineCardDisplay | null>(null);

  const scoped = useMemo(() => filtrarDatasetPorModo(dataset, mode, franqueadoId), [dataset, mode, franqueadoId]);
  const cardsEnriquecidos = useMemo(() => scoped.cards.map(enriquecerPipelineCard), [scoped.cards]);
  const cardsFiltrados = useMemo(() => filtrarPipelineCards(cardsEnriquecidos, filtros), [cardsEnriquecidos, filtros]);

  const enrichmentGargalo = dataset.enrichment?.gargaloRanking;
  const enrichmentChamados = dataset.enrichment?.chamados;

  const enrichmentSlim = useMemo((): PipelineFranqueadoraEnrichment | null | undefined => {
    const e = dataset.enrichment;
    if (!e) return e;
    return {
      fases: e.fases,
      chamados: e.chamados,
      gargaloRanking: e.gargaloRanking,
      maxOrdemPorKanban: e.maxOrdemPorKanban,
      historicoMovimentos: [],
    };
  }, [
    dataset.enrichment?.fases,
    dataset.enrichment?.chamados,
    dataset.enrichment?.gargaloRanking,
    dataset.enrichment?.maxOrdemPorKanban,
  ]);

  const kpisFranqueadora = useMemo(
    () =>
      showKpis && viewMode === 'franqueadora'
        ? calcularKpisPipelineFranqueadoraExtended(cardsFiltrados, enrichmentSlim)
        : null,
    [showKpis, viewMode, cardsFiltrados, enrichmentGargalo, enrichmentChamados],
  );

  const kpisUnidade = useMemo(
    () =>
      showKpis && viewMode === 'unidade'
        ? calcularKpisPipelineUnidadeExtended(cardsFiltrados, dataset.enrichment?.chamados ?? [])
        : null,
    [showKpis, viewMode, cardsFiltrados, dataset.enrichment?.chamados],
  );

  const saudeUnidade = useMemo(
    () => (viewMode === 'unidade' ? saudeMesUnidadePipeline(cardsEnriquecidos) : null),
    [viewMode, cardsEnriquecidos],
  );

  const oQueFazerHoje = useMemo(
    () =>
      viewMode === 'unidade'
        ? montarOQueFazerHoje(cardsEnriquecidos, dataset.enrichment?.chamados ?? [])
        : [],
    [viewMode, cardsEnriquecidos, dataset.enrichment?.chamados],
  );

  const blocosUnidade = useMemo(
    () => (viewMode === 'unidade' ? montarBlocosDisplayUnidade(cardsFiltrados) : []),
    [viewMode, cardsFiltrados],
  );

  const blocosFranqueadora = useMemo(() => {
    if (viewMode !== 'franqueadora') return [];
    return montarBlocosUnidadePipeline(
      scoped.franqueados,
      cardsFiltrados,
      dataset.enrichment?.chamados ?? [],
    );
  }, [viewMode, scoped.franqueados, cardsFiltrados, dataset.enrichment?.chamados]);

  const funilRedeCards = useMemo(() => {
    if (viewMode !== 'franqueadora') return [];
    return cardsElegiveisFranqueadora(cardsFiltrados);
  }, [viewMode, cardsFiltrados]);

  const funilRedeFranqueados = useMemo(() => {
    if (viewMode !== 'franqueadora') return [];
    return scoped.franqueados.filter((f) => !excluirFranquiaDosGraficosVisaoGeral(f.n_franquia));
  }, [viewMode, scoped.franqueados]);

  const funilMesUnidade = useMemo(
    () => (viewMode === 'unidade' ? computeFunilMesUnidade(scoped.cards) : null),
    [viewMode, scoped.cards],
  );

  const cardsPorRede = useMemo(() => {
    const baseCards = viewMode === 'franqueadora' ? cardsElegiveisFranqueadora(cardsFiltrados) : cardsFiltrados;
    const m = new Map<string, PipelineCardDisplay[]>();
    for (const c of baseCards) {
      const rid = String(c.rede_franqueado_id ?? '').trim();
      if (!rid) continue;
      const list = m.get(rid) ?? [];
      list.push(c);
      m.set(rid, list);
    }
    for (const [rid, list] of m) {
      m.set(rid, sortCardsFranqueadoraPrioridade(list));
    }
    return m;
  }, [cardsFiltrados, viewMode]);

  const opcoesUnidade = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of scoped.franqueados) m.set(f.rede_franqueado_id, labelFranqueadoPipeline(f));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [scoped.franqueados]);

  const opcoesKanban = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cardsEnriquecidos) m.set(c.kanban_id, c.kanban_nome);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [cardsEnriquecidos]);

  const opcoesFase = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cardsEnriquecidos) {
      if (filtros.kanban === 'todos' || c.kanban_id === filtros.kanban) m.set(c.fase_id, c.fase_nome);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [cardsEnriquecidos, filtros.kanban]);

  const opcoesResponsavel = useMemo(() => {
    const m = new Map<string, string>();
    let sem = false;
    for (const c of cardsEnriquecidos) {
      const id = String(c.responsavel_fase_id ?? '').trim();
      const nome = String(c.responsavel_fase_nome ?? '').trim();
      if (id) m.set(id, nome || id.slice(0, 8));
      else if (nome) m.set(`nome:${nome}`, nome);
      else sem = true;
    }
    return { list: [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')), sem };
  }, [cardsEnriquecidos]);

  if (viewMode === 'unidade' && !String(franqueadoId ?? '').trim()) {
    return (
      <p className="rounded-xl border px-4 py-6 text-[11px]" style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-text-secondary)' }}>
        Informe a unidade de franquia (`franqueadoId`) para exibir os cards.
      </p>
    );
  }

  return (
    <div className={className}>
      {showKpis && viewMode === 'franqueadora' && kpisFranqueadora ? (
        <PipelineKpisBarFranqueadora kpis={kpisFranqueadora} />
      ) : null}
      {showKpis && viewMode === 'unidade' && kpisUnidade ? <PipelineKpisBarUnidade kpis={kpisUnidade} /> : null}

      {viewMode === 'franqueadora' ? (
        <PipelineFunilMesRede cards={funilRedeCards} franqueados={funilRedeFranqueados} />
      ) : null}

      {viewMode === 'unidade' && (saudeUnidade || funilMesUnidade) ? (
        <div className="mb-6 px-4 py-4" style={panelStyle}>
          <PipelineUnidadeResumoLinha
            cards={cardsEnriquecidos}
            chamados={dataset.enrichment?.chamados ?? []}
            className="mb-3"
          />
          {saudeUnidade ? <PipelineSaudeMesCondensado saude={saudeUnidade} /> : null}
          {funilMesUnidade ? <PipelineFunilMesUnidade funil={funilMesUnidade} className="mt-3" /> : null}
        </div>
      ) : null}

      {viewMode === 'unidade' ? <PipelineOQueFazerHoje items={oQueFazerHoje} /> : null}

      {showFilters ? (
        <div className="mb-6 overflow-x-auto px-4">
          <div className="flex min-w-[720px] flex-nowrap items-center gap-2" style={filtersBarStyle}>
            <div className="relative min-w-0 flex-1">
              <i
                className="ti ti-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2"
                style={{ fontSize: 14, color: 'var(--moni-text-tertiary)' }}
                aria-hidden
              />
              <input
                type="search"
                value={filtros.busca}
                onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
                placeholder="Buscar título, funil, fase..."
                aria-label="Buscar cards"
                className="w-full placeholder:text-[var(--moni-text-tertiary)]"
                style={filterSearchStyle}
              />
            </div>
            {viewMode === 'franqueadora' ? (
              <select
                value={filtros.unidade}
                onChange={(e) => setFiltros((f) => ({ ...f, unidade: e.target.value }))}
                aria-label="Unidade"
                style={filterSelectStyle}
              >
                <option value="todas">Unidade</option>
                {opcoesUnidade.map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              value={filtros.kanban}
              onChange={(e) => setFiltros((f) => ({ ...f, kanban: e.target.value, fase: 'todas' }))}
              aria-label="Funil"
              style={filterSelectStyle}
            >
              <option value="todos">Funil</option>
              {opcoesKanban.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </select>
            <select
              value={filtros.fase}
              onChange={(e) => setFiltros((f) => ({ ...f, fase: e.target.value }))}
              aria-label="Fase"
              style={filterSelectStyle}
            >
              <option value="todas">Fase</option>
              {opcoesFase.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </select>
            <select
              value={filtros.status}
              onChange={(e) => setFiltros((f) => ({ ...f, status: e.target.value as PipelineCardsFiltros['status'] }))}
              aria-label="Status"
              style={filterSelectStyle}
            >
              <option value="todos">Status</option>
              <option value="atrasados">SLA atrasado</option>
              <option value="vence_hoje">Vence hoje</option>
              <option value="vencendo_breve">Vencendo em breve</option>
              <option value="sem_movimentacao">Sem movimentação</option>
              <option value="dentro_prazo">Dentro do prazo</option>
            </select>
            <select
              value={filtros.responsavel}
              onChange={(e) => setFiltros((f) => ({ ...f, responsavel: e.target.value }))}
              aria-label="Responsável"
              style={filterSelectStyle}
            >
              <option value="todos">Responsável</option>
              {opcoesResponsavel.sem ? <option value="__sem__">Sem responsável</option> : null}
              {opcoesResponsavel.list.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </select>
            {viewMode === 'franqueadora' ? (
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as PipelineGroupBy)}
                aria-label="Agrupar por"
                style={filterSelectStyle}
              >
                <option value="franquia">Agrupar por</option>
                <option value="funil">Funil</option>
                <option value="fase">Fase</option>
                <option value="status">Status SLA</option>
              </select>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="mb-4 text-[11px]" style={{ color: 'var(--moni-text-secondary)' }}>
        {cardsFiltrados.length} card{cardsFiltrados.length === 1 ? '' : 's'} · {PIPELINE_READONLY_NOTA}
      </p>

      {viewMode === 'franqueadora' ? (
        blocosFranqueadora.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-10 text-center text-[11px]" style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-text-tertiary)' }}>
            Nenhum card encontrado com os filtros atuais.
          </p>
        ) : (
          <div className="space-y-3">
            {blocosFranqueadora.map((meta) => (
              <PipelineFranqueadoraUnidadeBloco
                key={meta.redeId}
                meta={meta}
                cards={cardsPorRede.get(meta.redeId) ?? []}
                enrichment={enrichmentSlim}
                onCardClick={setDrawerCard}
              />
            ))}
          </div>
        )
      ) : blocosUnidade.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-[11px]" style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-text-tertiary)' }}>
          Nenhum card encontrado com os filtros atuais.
        </p>
      ) : (
        <div className="space-y-3">
          {blocosUnidade.map((bloco) =>
            bloco.tipo === 'projeto' ? (
              <PipelineUnidadeProjetoBloco
                key={`projeto-${bloco.grupo.projetoId}`}
                grupo={bloco.grupo}
                enrichment={enrichmentSlim}
                onCardClick={setDrawerCard}
              />
            ) : (
              <PipelineUnidadeCardSolo
                key={bloco.card.id}
                card={bloco.card}
                enrichment={enrichmentSlim}
                onCardClick={setDrawerCard}
              />
            ),
          )}
        </div>
      )}

      <PipelineCardMiniDrawer card={drawerCard} onClose={() => setDrawerCard(null)} />
    </div>
  );
}
