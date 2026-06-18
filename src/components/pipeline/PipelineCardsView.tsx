'use client';



import { useMemo, useState } from 'react';

import { ChevronDown } from 'lucide-react';

import type {

  PipelineCardDisplay,

  PipelineCardRow,

  PipelineCardsDataset,

  PipelineCardsFiltros,

  PipelineCardsKpis,

  PipelineCardsKpisUnidade,

  PipelineFranqueadoUnidade,

  PipelineGroupBy,

} from '@/lib/kanban/pipeline-cards-types';

import { PIPELINE_CARDS_FILTROS_DEFAULT } from '@/lib/kanban/pipeline-cards-types';

import {

  agruparPipelineCards,

  calcularKpisPipelineFranqueadora,

  calcularKpisPipelineUnidade,

  enriquecerPipelineCard,

  filtrarPipelineCards,

  labelFranqueadoPipeline,

} from '@/lib/kanban/pipeline-cards-utils';

import { PipelineCardMiniDrawer } from '@/components/pipeline/PipelineCardMiniDrawer';

import { PipelineProgressCard } from '@/components/pipeline/PipelineProgressCard';
import { PIPELINE_READONLY_NOTA } from '@/lib/kanban/pipeline-card-readonly';



export type PipelineCardsViewProps = {

  mode: 'franqueadora' | 'unidade';

  /** UUID em `rede_franqueados.id` — obrigatório em `mode="unidade"`. */

  franqueadoId?: string;

  showFranchiseGroups?: boolean;

  /** Incluir unidades sem cards no agrupamento por franquia (padrão: false na franqueadora). */

  incluirUnidadesVazias?: boolean;

  showFilters?: boolean;

  showKpis?: boolean;

  defaultGroupBy?: PipelineGroupBy;

  /** Dataset pré-carregado (kanban como fonte oficial). */

  dataset: PipelineCardsDataset;

  className?: string;

};



const kpiCardStyle: React.CSSProperties = {

  border: '0.5px solid var(--moni-border-default)',

  background: 'var(--moni-surface-50, #fff)',

  borderRadius: 'var(--moni-radius-lg, 12px)',

};



function PipelineKpisBarFranqueadora({ kpis }: { kpis: PipelineCardsKpis }) {

  const items: { label: string; value: number; hint?: string }[] = [

    { label: 'Unidades com cards ativos', value: kpis.unidadesComCardsAtivos },

    { label: 'Cards ativos', value: kpis.cardsAtivos },

    { label: 'Cards atrasados', value: kpis.cardsAtrasados },

    { label: 'Sem movimentação', value: kpis.cardsSemMovimentacao, hint: '7+ dias' },

    { label: 'Vencendo em breve', value: kpis.cardsVencendoEmBreve },

  ];



  return (

    <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">

      {items.map((item) => (

        <div key={item.label} className="rounded-xl p-4" style={kpiCardStyle}>

          <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>

            {item.label}

          </p>

          <p

            className="mt-2 text-3xl font-medium leading-none"

            style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}

          >

            {item.value}

          </p>

          {item.hint ? (

            <p className="mt-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>

              {item.hint}

            </p>

          ) : null}

        </div>

      ))}

    </div>

  );

}



function PipelineKpisBarUnidade({ kpis }: { kpis: PipelineCardsKpisUnidade }) {

  const items: { label: string; value: number; hint?: string }[] = [

    { label: 'Cards ativos', value: kpis.cardsAtivos },

    { label: 'Cards atrasados', value: kpis.cardsAtrasados },

    { label: 'Sem movimentação', value: kpis.cardsSemMovimentacao, hint: '7+ dias' },

    { label: 'Próximos vencimentos', value: kpis.proximosVencimentos },

  ];



  return (

    <div className="mb-6 space-y-3">

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">

        {items.map((item) => (

          <div key={item.label} className="rounded-xl p-4" style={kpiCardStyle}>

            <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>

              {item.label}

            </p>

            <p

              className="mt-2 text-3xl font-medium leading-none"

              style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}

            >

              {item.value}

            </p>

            {item.hint ? (

              <p className="mt-1 text-[11px]" style={{ color: 'var(--moni-text-tertiary)' }}>

                {item.hint}

              </p>

            ) : null}

          </div>

        ))}

      </div>



      <div className="rounded-xl p-4" style={kpiCardStyle}>

        <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>

          Cards por funil

        </p>

        {kpis.cardsPorFunil.length === 0 ? (

          <p className="mt-2 text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>

            Nenhum card ativo nesta unidade.

          </p>

        ) : (

          <ul className="mt-3 flex flex-wrap gap-2">

            {kpis.cardsPorFunil.map((f) => (

              <li

                key={f.kanbanId}

                className="rounded-lg px-3 py-2 text-sm"

                style={{

                  border: '0.5px solid var(--moni-border-default)',

                  background: 'var(--moni-surface-50)',

                  color: 'var(--moni-text-secondary)',

                }}

              >

                <span className="font-medium" style={{ color: 'var(--moni-text-primary)' }}>

                  {f.kanbanNome}

                </span>

                <span className="ml-2 tabular-nums">{f.total}</span>

              </li>

            ))}

          </ul>

        )}

      </div>

    </div>

  );

}



function PipelineGrupoSection({

  grupo,

  groupBy,

  showUnidade,

  defaultExpanded,

  onHistorico,

}: {

  grupo: { id: string; label: string; cards: PipelineCardDisplay[] };

  groupBy: PipelineGroupBy;

  showUnidade: boolean;

  defaultExpanded: boolean;

  onHistorico: (card: PipelineCardDisplay) => void;

}) {

  const [expanded, setExpanded] = useState(defaultExpanded);

  const hasCards = grupo.cards.length > 0;



  return (

    <section

      className="overflow-hidden rounded-xl"

      style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-50)' }}

    >

      <button

        type="button"

        onClick={() => setExpanded((v) => !v)}

        className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-stone-50/60"

        aria-expanded={expanded}

      >

        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-2">

          <h2

            className="text-sm font-semibold"

            style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}

          >

            {grupo.label}

          </h2>

          <span className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>

            {grupo.cards.length} card{grupo.cards.length === 1 ? '' : 's'}

          </span>

        </div>

        <ChevronDown

          className="h-4 w-4 shrink-0 transition-transform"

          style={{

            color: 'var(--moni-text-tertiary)',

            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',

          }}

        />

      </button>



      {expanded ? (

        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--moni-border-default)' }}>

          {!hasCards && groupBy === 'franquia' ? (

            <p className="text-xs italic" style={{ color: 'var(--moni-text-tertiary)' }}>

              Sem cards ativos nesta unidade.

            </p>

          ) : (

            <ul className="space-y-3">

              {grupo.cards.map((card) => (

                <li key={card.id}>

                  <PipelineProgressCard

                    card={card}

                    showUnidade={showUnidade}

                    onHistorico={onHistorico}

                  />

                </li>

              ))}

            </ul>

          )}

        </div>

      ) : null}

    </section>

  );

}



function filtrarDatasetPorModo(

  dataset: PipelineCardsDataset,

  mode: PipelineCardsViewProps['mode'],

  franqueadoId?: string,

): { cards: PipelineCardRow[]; franqueados: PipelineFranqueadoUnidade[] } {

  const redeId = String(franqueadoId ?? '').trim();

  if (mode === 'unidade') {

    if (!redeId) return { cards: [], franqueados: [] };

    return {

      cards: dataset.cards.filter((c) => String(c.rede_franqueado_id ?? '') === redeId),

      franqueados: dataset.franqueados.filter((f) => f.rede_franqueado_id === redeId),

    };

  }

  return dataset;

}



const selectClass =

  'min-h-[44px] rounded-lg px-3 text-sm w-full sm:w-auto';

const selectStyle = { border: '0.5px solid var(--moni-border-default)', fontFamily: 'var(--moni-font-sans)' };



export function PipelineCardsView({

  mode,

  franqueadoId,

  showFranchiseGroups = mode === 'franqueadora',

  incluirUnidadesVazias = false,

  showFilters = true,

  showKpis = true,

  defaultGroupBy = 'franquia',

  dataset,

  className,

}: PipelineCardsViewProps) {

  const [groupBy, setGroupBy] = useState<PipelineGroupBy>(defaultGroupBy);

  const [filtros, setFiltros] = useState<PipelineCardsFiltros>(PIPELINE_CARDS_FILTROS_DEFAULT);

  const [drawerCard, setDrawerCard] = useState<PipelineCardDisplay | null>(null);



  const scoped = useMemo(

    () => filtrarDatasetPorModo(dataset, mode, franqueadoId),

    [dataset, mode, franqueadoId],

  );



  const cardsEnriquecidos = useMemo(

    () => scoped.cards.map(enriquecerPipelineCard),

    [scoped.cards],

  );



  const cardsFiltrados = useMemo(

    () => filtrarPipelineCards(cardsEnriquecidos, filtros),

    [cardsEnriquecidos, filtros],

  );



  const kpisFranqueadora = useMemo(

    () => (showKpis && mode === 'franqueadora' ? calcularKpisPipelineFranqueadora(cardsFiltrados) : null),

    [showKpis, mode, cardsFiltrados],

  );



  const kpisUnidade = useMemo(

    () => (showKpis && mode === 'unidade' ? calcularKpisPipelineUnidade(cardsFiltrados) : null),

    [showKpis, mode, cardsFiltrados],

  );



  const grupos = useMemo(

    () =>

      agruparPipelineCards(

        cardsFiltrados,

        groupBy,

        scoped.franqueados,

        showFranchiseGroups && groupBy === 'franquia' && incluirUnidadesVazias,

      ),

    [cardsFiltrados, groupBy, scoped.franqueados, showFranchiseGroups, incluirUnidadesVazias],

  );



  const opcoesUnidade = useMemo(() => {

    const m = new Map<string, string>();

    for (const f of scoped.franqueados) {

      m.set(f.rede_franqueado_id, labelFranqueadoPipeline(f));

    }

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

      if (filtros.kanban === 'todos' || c.kanban_id === filtros.kanban) {

        m.set(c.fase_id, c.fase_nome);

      }

    }

    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));

  }, [cardsEnriquecidos, filtros.kanban]);



  const opcoesResponsavel = useMemo(() => {

    const m = new Map<string, string>();

    let sem = false;

    for (const c of cardsEnriquecidos) {

      const id = String(c.responsavel_fase_id ?? '').trim();

      const nome = String(c.responsavel_fase_nome ?? '').trim();

      if (id) {

        m.set(id, nome || id.slice(0, 8));

      } else if (nome) {

        m.set(`nome:${nome}`, nome);

      } else {

        sem = true;

      }

    }

    const list = [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));

    return { list, sem };

  }, [cardsEnriquecidos]);



  const showUnidadeCol = mode !== 'unidade' && groupBy !== 'franquia';



  if (mode === 'unidade' && !String(franqueadoId ?? '').trim()) {

    return (

      <p

        className="rounded-xl border px-4 py-6 text-sm"

        style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-text-secondary)' }}

      >

        Informe a unidade de franquia (`franqueadoId`) para exibir os cards.

      </p>

    );

  }



  return (

    <div className={className}>

      {showKpis && mode === 'franqueadora' && kpisFranqueadora ? (

        <PipelineKpisBarFranqueadora kpis={kpisFranqueadora} />

      ) : null}

      {showKpis && mode === 'unidade' && kpisUnidade ? <PipelineKpisBarUnidade kpis={kpisUnidade} /> : null}



      {showFilters ? (

        <div

          className="mb-6 flex flex-col gap-3 rounded-xl border p-4"

          style={{ borderColor: 'var(--moni-border-default)', background: 'var(--moni-surface-50)' }}

        >

          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs">

            <span style={{ color: 'var(--moni-text-tertiary)' }}>Buscar</span>

            <input

              type="search"

              value={filtros.busca}

              onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}

              placeholder="Título, funil, fase, franquia, responsável…"

              className="min-h-[44px] rounded-lg px-3 text-sm"

              style={selectStyle}

            />

          </label>



          <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-end">

            {mode === 'franqueadora' ? (

              <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs sm:max-w-[14rem]">

                <span style={{ color: 'var(--moni-text-tertiary)' }}>Unidade de Franquia</span>

                <select

                  value={filtros.unidade}

                  onChange={(e) => setFiltros((f) => ({ ...f, unidade: e.target.value }))}

                  className={selectClass}

                  style={selectStyle}

                >

                  <option value="todas">Todas</option>

                  {opcoesUnidade.map(([id, nome]) => (

                    <option key={id} value={id}>

                      {nome}

                    </option>

                  ))}

                </select>

              </label>

            ) : null}



            <label className="flex min-w-[10rem] flex-col gap-1 text-xs sm:max-w-[12rem]">

              <span style={{ color: 'var(--moni-text-tertiary)' }}>Funil / Kanban</span>

              <select

                value={filtros.kanban}

                onChange={(e) =>

                  setFiltros((f) => ({

                    ...f,

                    kanban: e.target.value,

                    fase: 'todas',

                  }))

                }

                className={selectClass}

                style={selectStyle}

              >

                <option value="todos">Todos</option>

                {opcoesKanban.map(([id, nome]) => (

                  <option key={id} value={id}>

                    {nome}

                  </option>

                ))}

              </select>

            </label>



            <label className="flex min-w-[10rem] flex-col gap-1 text-xs sm:max-w-[12rem]">

              <span style={{ color: 'var(--moni-text-tertiary)' }}>Fase</span>

              <select

                value={filtros.fase}

                onChange={(e) => setFiltros((f) => ({ ...f, fase: e.target.value }))}

                className={selectClass}

                style={selectStyle}

              >

                <option value="todas">Todas</option>

                {opcoesFase.map(([id, nome]) => (

                  <option key={id} value={id}>

                    {nome}

                  </option>

                ))}

              </select>

            </label>



            <label className="flex min-w-[10rem] flex-col gap-1 text-xs sm:max-w-[12rem]">

              <span style={{ color: 'var(--moni-text-tertiary)' }}>Status</span>

              <select

                value={filtros.status}

                onChange={(e) =>

                  setFiltros((f) => ({

                    ...f,

                    status: e.target.value as PipelineCardsFiltros['status'],

                  }))

                }

                className={selectClass}

                style={selectStyle}

              >

                <option value="todos">Todos</option>

                <option value="atrasados">SLA atrasado</option>

                <option value="vence_hoje">Vence hoje</option>

                <option value="vencendo_breve">Vencendo em breve</option>

                <option value="sem_movimentacao">Sem movimentação</option>

                <option value="dentro_prazo">Dentro do prazo</option>

              </select>

            </label>



            <label className="flex min-w-[10rem] flex-col gap-1 text-xs sm:max-w-[14rem]">

              <span style={{ color: 'var(--moni-text-tertiary)' }}>Responsável</span>

              <select

                value={filtros.responsavel}

                onChange={(e) => setFiltros((f) => ({ ...f, responsavel: e.target.value }))}

                className={selectClass}

                style={selectStyle}

              >

                <option value="todos">Todos</option>

                {opcoesResponsavel.sem ? <option value="__sem__">Sem responsável</option> : null}

                {opcoesResponsavel.list.map(([id, nome]) => (

                  <option key={id} value={id}>

                    {nome}

                  </option>

                ))}

              </select>

            </label>



            <label className="flex min-w-[10rem] flex-col gap-1 text-xs sm:max-w-[12rem]">

              <span style={{ color: 'var(--moni-text-tertiary)' }}>Agrupar por</span>

              <select

                value={groupBy}

                onChange={(e) => setGroupBy(e.target.value as PipelineGroupBy)}

                className={selectClass}

                style={selectStyle}

              >
                {mode === 'franqueadora' ? <option value="franquia">Unidade de Franquia</option> : null}
                <option value="funil">Funil</option>
                <option value="fase">Fase</option>
                <option value="status">Status SLA</option>
              </select>

            </label>

          </div>

        </div>

      ) : null}



      <p className="mb-4 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>

        {cardsFiltrados.length} card{cardsFiltrados.length === 1 ? '' : 's'} · {PIPELINE_READONLY_NOTA}

      </p>



      {grupos.length === 0 ? (

        <p

          className="rounded-xl border border-dashed px-4 py-10 text-center text-sm"

          style={{ borderColor: 'var(--moni-border-default)', color: 'var(--moni-text-tertiary)' }}

        >

          Nenhum card encontrado com os filtros atuais.

        </p>

      ) : (

        <div className="space-y-3">

          {grupos.map((grupo) => (

            <PipelineGrupoSection

              key={grupo.id}

              grupo={grupo}

              groupBy={groupBy}

              showUnidade={showUnidadeCol}

              defaultExpanded={grupo.cards.length > 0}

              onHistorico={setDrawerCard}

            />

          ))}

        </div>

      )}



      <PipelineCardMiniDrawer card={drawerCard} onClose={() => setDrawerCard(null)} />

    </div>

  );

}

