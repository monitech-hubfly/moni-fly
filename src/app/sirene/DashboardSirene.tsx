'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  aggregatePorPrioridadeAbertosFromBreakdown,
  aggregatePorStatusFromBreakdown,
  aggregatePorTipoFromBreakdown,
  type DashboardAtividadeBreakdownRow,
  type DashboardChamadoBreakdownRow,
} from './dashboard-breakdown';

type PorStatus = { status: string; count: number; pct: number };
type PorTipo = { tipo: string; count: number; pct: number };
type PorPrioridade = { prioridade: string; count: number; pct: number };
type ChamadoListaItem = {
  id: number;
  numero: number;
  time_abertura: string | null;
  incendio: string;
  dias_aberto: number;
};
type AguardandoJulgamentoItem = {
  id: number;
  numero: number;
  tema: string;
  franqueado_nome: string | null;
  dias_desde_fechamento_bombeiro: number;
};
type TopicoPorStatus = { status: string; count: number };
type AbertosGrupo = { nome: string; count: number };
type TopTema = { tema: string; count: number };
type PessoaMetrica = {
  nome: string;
  abertos: number;
  atrasados: number;
  com_trava?: number;
  sem_julgamento?: number;
};
type BreakdownTab = 'todos' | 'com_trava' | 'atrasados';

type Props = {
  emAberto: number;
  emAndamento: number;
  concluidos: number;
  tempoMedioPrimeiroAtendimento: string | null;
  slaAtrasados: number;
  slaVenceHoje: number;
  aguardandoJulgamento: number;
  porStatus: PorStatus[];
  por_tipo: PorTipo[];
  por_prioridade_abertos: PorPrioridade[];
  chamadosBreakdown: DashboardChamadoBreakdownRow[];
  atividadesBreakdown: DashboardAtividadeBreakdownRow[];
  satisfacaoPct: number;
  satisfacao_total: number;
  satisfacao_aprovados: number;
  chamadosComTrava: number;
  recentesComTrava: ChamadoListaItem[];
  chamadosAtrasados: ChamadoListaItem[];
  aguardando_julgamento_lista: AguardandoJulgamentoItem[];
  topicos_por_status: TopicoPorStatus[];
  por_responsavel: PessoaMetrica[];
  por_criador: PessoaMetrica[];
  abertos_por_time: AbertosGrupo[];
  abertos_por_funil: AbertosGrupo[];
  top_franqueados: AbertosGrupo[];
  top_temas: TopTema[];
  filtroTipo: 'todos' | 'padrao' | 'hdm';
};

const statusLabel: Record<string, string> = {
  nao_iniciado: 'Não iniciados',
  em_andamento: 'Em andamento',
  concluido: 'Concluídos',
};

const statusColor: Record<string, string> = {
  nao_iniciado: 'text-red-700',
  em_andamento: 'text-amber-700',
  concluido: 'text-emerald-700',
};

const statusBarColor: Record<string, string> = {
  nao_iniciado: 'bg-red-500',
  em_andamento: 'bg-amber-500',
  concluido: 'bg-emerald-500',
};

const topicoStatusLabel: Record<string, string> = {
  nao_iniciado: 'Não iniciados',
  em_andamento: 'Em andamento',
  concluido: 'Concluídos',
  aprovado: 'Aprovados',
};

const topicoStatusColor: Record<string, string> = {
  nao_iniciado: 'text-red-700',
  em_andamento: 'text-amber-700',
  concluido: 'text-emerald-700',
  aprovado: 'text-blue-700',
};

const tipoLabel: Record<string, string> = {
  chamado_padrao: 'Chamado padrão',
  chamado_hdm: 'Chamado HDM',
  atividade: 'Atividade',
  duvida: 'Dúvida',
};

const tipoColor: Record<string, string> = {
  chamado_padrao: 'text-blue-700',
  chamado_hdm: 'text-violet-700',
  atividade: 'text-amber-700',
  duvida: 'text-stone-700',
};

const tipoBarColor: Record<string, string> = {
  chamado_padrao: 'bg-blue-500',
  chamado_hdm: 'bg-violet-500',
  atividade: 'bg-amber-500',
  duvida: 'bg-stone-500',
};

const prioridadeColor: Record<string, string> = {
  Urgente: 'text-red-700',
  Alta: 'text-orange-700',
  Média: 'text-amber-700',
  Baixa: 'text-emerald-700',
};

const prioridadeBarColor: Record<string, string> = {
  Urgente: 'bg-red-500',
  Alta: 'bg-orange-500',
  Média: 'bg-amber-500',
  Baixa: 'bg-emerald-500',
};

function pillDiasJulgamentoClass(dias: number): string {
  if (dias > 7) return 'bg-red-100 text-red-800';
  if (dias >= 3) return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-100 text-emerald-800';
}

function pillDiasAbertoClass(dias: number): string {
  if (dias > 7) return 'bg-red-100 text-red-700';
  if (dias >= 3) return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
}

function MetricLegend({ tertiaryLabel }: { tertiaryLabel: string }) {
  return (
    <div className="mb-3 flex flex-wrap gap-3 text-xs text-[color:var(--moni-text-tertiary)]">
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800">0</span>
        Abertos
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">0</span>
        Atrasados
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">0</span>
        {tertiaryLabel}
      </span>
    </div>
  );
}

function MetricBadges({
  abertos,
  atrasados,
  tertiary,
}: {
  abertos: number;
  atrasados: number;
  tertiary: number;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
        {abertos}
      </span>
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
        {atrasados}
      </span>
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        {tertiary}
      </span>
    </span>
  );
}

function PessoaMetricasCard({
  titulo,
  tertiaryLabel,
  rows,
  getTertiary,
}: {
  titulo: string;
  tertiaryLabel: string;
  rows: PessoaMetrica[];
  getTertiary: (row: PessoaMetrica) => number;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
      <h2 className="text-lg font-semibold text-[color:var(--moni-text-primary)]">{titulo}</h2>
      <MetricLegend tertiaryLabel={tertiaryLabel} />
      <ul className="space-y-2">
        {rows.length === 0 ? (
          <li className="text-sm text-[color:var(--moni-text-tertiary)]">Nenhum dado no escopo</li>
        ) : (
          rows.map((row) => (
            <li
              key={row.nome}
              className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] px-3 py-2"
            >
              <span className="truncate text-sm font-medium text-[color:var(--moni-text-secondary)]">
                {row.nome}
              </span>
              <MetricBadges
                abertos={row.abertos}
                atrasados={row.atrasados}
                tertiary={getTertiary(row)}
              />
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

const BREAKDOWN_TABS: { key: BreakdownTab; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'com_trava', label: 'Com trava' },
  { key: 'atrasados', label: 'Atrasados' },
];

function filterByTab<T extends { comTrava: boolean; atrasado: boolean }>(
  rows: T[],
  tab: BreakdownTab,
): T[] {
  if (tab === 'com_trava') return rows.filter((r) => r.comTrava);
  if (tab === 'atrasados') return rows.filter((r) => r.atrasado);
  return rows;
}

function HorizontalBars<T extends { count: number; pct: number }>({
  items,
  getKey,
  getLabel,
  labelColor,
  barColor,
}: {
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  labelColor: Record<string, string>;
  barColor: Record<string, string>;
}) {
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const key = getKey(item);
        return (
          <li key={key}>
            <div className="flex items-center justify-between text-sm">
              <span className={labelColor[key] ?? 'text-[color:var(--moni-text-tertiary)]'}>
                {getLabel(item)}: {item.count} ({item.pct.toFixed(1)}%)
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--moni-surface-200)]">
              <div
                className={`h-full rounded-full ${barColor[key] ?? 'bg-stone-400'}`}
                style={{ width: `${Math.min(100, item.pct)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function AbertosLegend() {
  return (
    <div className="mb-3 flex flex-wrap gap-3 text-xs text-[color:var(--moni-text-tertiary)]">
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800">0</span>
        Abertos
      </span>
    </div>
  );
}

function AbertosGrupoListCard({ titulo, items }: { titulo: string; items: AbertosGrupo[] }) {
  return (
    <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
      <h2 className="text-lg font-semibold text-[color:var(--moni-text-primary)]">{titulo}</h2>
      <AbertosLegend />
      <ul className="space-y-2">
        {items.length === 0 ? (
          <li className="text-sm text-[color:var(--moni-text-tertiary)]">Nenhum dado no escopo</li>
        ) : (
          items.map((item) => (
            <li
              key={item.nome}
              className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] px-3 py-2"
            >
              <span className="truncate text-sm font-medium text-[color:var(--moni-text-secondary)]">
                {item.nome}
              </span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                {item.count}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function TopFranqueadosCard({ items }: { items: AbertosGrupo[] }) {
  return (
    <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
      <h2 className="text-lg font-semibold text-[color:var(--moni-text-primary)]">
        Top franqueados com abertos
      </h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[color:var(--moni-text-tertiary)]">Nenhum</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.nome}
              className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] px-3 py-2"
            >
              <span className="truncate text-sm text-[color:var(--moni-text-secondary)]">{item.nome}</span>
              <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                {item.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TopTemasCard({ items }: { items: TopTema[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
      <h2 className="text-lg font-semibold text-[color:var(--moni-text-primary)]">Temas mais frequentes</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[color:var(--moni-text-tertiary)]">Nenhum</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.tema}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-[color:var(--moni-text-secondary)]">{item.tema}</span>
                <span className="shrink-0 tabular-nums text-[color:var(--moni-text-tertiary)]">{item.count}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--moni-surface-200)]">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${Math.min(100, (item.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DashboardSirene({
  emAberto,
  emAndamento,
  concluidos,
  tempoMedioPrimeiroAtendimento,
  slaAtrasados,
  slaVenceHoje,
  aguardandoJulgamento,
  chamadosBreakdown,
  atividadesBreakdown,
  satisfacaoPct,
  satisfacao_total,
  satisfacao_aprovados,
  chamadosComTrava,
  recentesComTrava,
  chamadosAtrasados,
  aguardando_julgamento_lista,
  topicos_por_status,
  por_responsavel,
  por_criador,
  abertos_por_time,
  abertos_por_funil,
  top_franqueados,
  top_temas,
  filtroTipo,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [breakdownTab, setBreakdownTab] = useState<BreakdownTab>('todos');
  const [showAtrasados, setShowAtrasados] = useState(false);

  const listaTravaCard = useMemo(
    () => (showAtrasados ? chamadosAtrasados : recentesComTrava),
    [showAtrasados, recentesComTrava, chamadosAtrasados],
  );

  const filteredChamados = useMemo(
    () => filterByTab(chamadosBreakdown, breakdownTab),
    [chamadosBreakdown, breakdownTab],
  );
  const filteredAtividades = useMemo(
    () => filterByTab(atividadesBreakdown, breakdownTab),
    [atividadesBreakdown, breakdownTab],
  );

  const porStatusFiltrado = useMemo(
    () => aggregatePorStatusFromBreakdown(filteredChamados),
    [filteredChamados],
  );
  const porTipoFiltrado = useMemo(
    () => aggregatePorTipoFromBreakdown(filteredAtividades),
    [filteredAtividades],
  );
  const porPrioridadeFiltrado = useMemo(
    () => aggregatePorPrioridadeAbertosFromBreakdown(filteredChamados),
    [filteredChamados],
  );

  const setFiltroTipo = (value: 'todos' | 'padrao' | 'hdm') => {
    const p = new URLSearchParams(searchParams.toString());
    if (value === 'todos') p.delete('tipo');
    else p.set('tipo', value);
    const qs = p.toString();
    router.push(qs ? `/sirene?${qs}` : '/sirene');
  };

  return (
    <div
      className="min-h-screen text-[color:var(--moni-text-primary)]"
      style={{ background: 'var(--moni-surface-50)' }}
    >
      <div className="mb-6 flex items-center gap-2">
        <span className="text-sm font-medium text-[color:var(--moni-text-tertiary)]">Tipo:</span>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value as 'todos' | 'padrao' | 'hdm')}
          className="rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-3 py-1.5 text-sm text-[color:var(--moni-text-secondary)]"
        >
          <option value="todos">Todos</option>
          <option value="padrao">Padrão</option>
          <option value="hdm">HDM</option>
        </select>
      </div>

      {/* KPIs — linha 1 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-4">
          <p className="text-3xl font-bold text-red-700">{emAberto}</p>
          <p className="mt-1 text-sm text-[color:var(--moni-text-tertiary)]">Em aberto</p>
        </div>
        <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-4">
          <p className="text-3xl font-bold text-amber-700">{emAndamento}</p>
          <p className="mt-1 text-sm text-[color:var(--moni-text-tertiary)]">Em andamento</p>
        </div>
        <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-4">
          <p className="text-3xl font-bold text-emerald-700">{concluidos}</p>
          <p className="mt-1 text-sm text-[color:var(--moni-text-tertiary)]">Concluídos</p>
        </div>
        <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-4">
          <p className="text-3xl font-bold text-blue-700">
            {tempoMedioPrimeiroAtendimento ?? '—'}
          </p>
          <p className="mt-1 text-sm text-[color:var(--moni-text-tertiary)]">Tempo médio 1º atendimento</p>
        </div>
      </div>

      {/* KPIs — linha 2 (SLA + satisfação) */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-4">
          <p className="text-3xl font-bold text-red-700">{slaAtrasados}</p>
          <p className="mt-1 text-sm text-[color:var(--moni-text-tertiary)]">SLA atrasados</p>
        </div>
        <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-4">
          <p className="text-3xl font-bold text-amber-700">{slaVenceHoje}</p>
          <p className="mt-1 text-sm text-[color:var(--moni-text-tertiary)]">SLA vence hoje</p>
        </div>
        <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-4">
          <p className="text-3xl font-bold text-violet-700">{aguardandoJulgamento}</p>
          <p className="mt-1 text-sm text-[color:var(--moni-text-tertiary)]">Aguardando julgamento</p>
        </div>
        <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-4">
          <p className="text-3xl font-bold text-emerald-700">{satisfacaoPct}%</p>
          <p className="mt-1 text-sm text-[color:var(--moni-text-tertiary)]">Satisfação 1º atendimento</p>
          <p className="mt-0.5 text-xs text-[color:var(--moni-text-tertiary)]">
            {satisfacao_aprovados} de {satisfacao_total} sem reincidência
          </p>
        </div>
      </div>

      {/* Duas colunas: breakdowns | lateral (trava, julgamento, tópicos) */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(380px,7fr)]">
        <div className="space-y-6 rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[color:var(--moni-text-primary)]">Chamados por status</h2>
            <div className="flex rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] p-0.5">
              {BREAKDOWN_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setBreakdownTab(tab.key)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    breakdownTab === tab.key
                      ? 'bg-[var(--moni-surface-0)] text-[color:var(--moni-text-primary)] shadow-sm'
                      : 'text-[color:var(--moni-text-tertiary)] hover:text-[color:var(--moni-text-secondary)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <HorizontalBars
            items={porStatusFiltrado}
            getKey={(item) => item.status}
            getLabel={(item) => statusLabel[item.status] ?? item.status}
            labelColor={statusColor}
            barColor={statusBarColor}
          />

          <div className="border-t border-[color:var(--moni-border-default)] pt-4">
            <h3 className="text-sm font-semibold text-[color:var(--moni-text-primary)]">Por tipo</h3>
            <div className="mt-3">
              <HorizontalBars
                items={porTipoFiltrado}
                getKey={(item) => item.tipo}
                getLabel={(item) => tipoLabel[item.tipo] ?? item.tipo}
                labelColor={tipoColor}
                barColor={tipoBarColor}
              />
            </div>
          </div>

          <div className="border-t border-[color:var(--moni-border-default)] pt-4">
            <h3 className="text-sm font-semibold text-[color:var(--moni-text-primary)]">
              Em aberto por prioridade
            </h3>
            <div className="mt-3">
              <HorizontalBars
                items={porPrioridadeFiltrado}
                getKey={(item) => item.prioridade}
                getLabel={(item) => item.prioridade}
                labelColor={prioridadeColor}
                barColor={prioridadeBarColor}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
        <div className="space-y-4 rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[color:var(--moni-text-primary)]">Chamados com trava</h2>
            <div className="flex rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] p-0.5">
              <button
                type="button"
                onClick={() => setShowAtrasados((v) => !v)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  showAtrasados
                    ? 'bg-[var(--moni-surface-0)] text-[color:var(--moni-text-primary)] shadow-sm'
                    : 'text-[color:var(--moni-text-tertiary)] hover:text-[color:var(--moni-text-secondary)]'
                }`}
              >
                Atrasados
              </button>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-red-700">{chamadosComTrava}</span>
            <span className="text-sm text-red-700/90">chamados ativos travam o avanço</span>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-[color:var(--moni-text-tertiary)]">
              {showAtrasados ? 'Chamados com SLA atrasado' : 'Chamados recentes com trava'}
            </p>
            <ul className="space-y-2">
              {listaTravaCard.length === 0 ? (
                <li className="text-sm text-[color:var(--moni-text-tertiary)]">Nenhum</li>
              ) : (
                listaTravaCard.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/sirene/${c.id}`}
                      className="flex items-start justify-between gap-2 rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] p-3 transition hover:border-red-400 hover:bg-[var(--moni-surface-100)]"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-red-700">#{c.numero}</span>
                        {c.time_abertura && (
                          <span className="ml-2 text-[color:var(--moni-text-tertiary)]"> — {c.time_abertura}</span>
                        )}
                        <p className="mt-0.5 truncate text-sm text-[color:var(--moni-text-secondary)]">
                          {c.incendio}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${pillDiasAbertoClass(c.dias_aberto)}`}
                        title={`${c.dias_aberto} ${c.dias_aberto === 1 ? 'dia' : 'dias'} em aberto`}
                      >
                        {c.dias_aberto}d
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--moni-text-primary)]">
            Aguardando julgamento do criador
          </h2>
          <ul className="mt-4 space-y-2">
            {aguardando_julgamento_lista.length === 0 ? (
              <li className="text-sm text-[color:var(--moni-text-tertiary)]">Nenhum</li>
            ) : (
              aguardando_julgamento_lista.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/sirene/${c.id}`}
                    className="block rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] p-3 transition hover:border-amber-400 hover:bg-[var(--moni-surface-100)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-amber-800">#{c.numero}</span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${pillDiasJulgamentoClass(c.dias_desde_fechamento_bombeiro)}`}
                      >
                        {c.dias_desde_fechamento_bombeiro}d
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-[color:var(--moni-text-secondary)]">
                      {c.tema}
                      {c.franqueado_nome ? (
                        <span className="text-[color:var(--moni-text-tertiary)]"> — {c.franqueado_nome}</span>
                      ) : null}
                    </p>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--moni-text-primary)]">Tópicos / sub-atividades</h2>
          <table className="mt-4 w-full text-sm">
            <tbody>
              {topicos_por_status.map((row) => (
                <tr
                  key={row.status}
                  className="border-t border-[color:var(--moni-border-default)] first:border-t-0"
                >
                  <td className={`py-2 pr-4 ${topicoStatusColor[row.status] ?? 'text-[color:var(--moni-text-secondary)]'}`}>
                    {topicoStatusLabel[row.status] ?? row.status}
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums text-[color:var(--moni-text-primary)]">
                    {row.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>

      {/* Por responsável | Por criador */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <PessoaMetricasCard
          titulo="Por responsável"
          tertiaryLabel="Com trava"
          rows={por_responsavel}
          getTertiary={(row) => row.com_trava ?? 0}
        />
        <PessoaMetricasCard
          titulo="Por criador"
          tertiaryLabel="Sem julgamento"
          rows={por_criador}
          getTertiary={(row) => row.sem_julgamento ?? 0}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(360px,1.35fr)]">
        <AbertosGrupoListCard titulo="Abertos por time" items={abertos_por_time} />
        <AbertosGrupoListCard titulo="Abertos por funil" items={abertos_por_funil} />
        <div className="min-w-0 space-y-6">
          <TopFranqueadosCard items={top_franqueados} />
          <TopTemasCard items={top_temas} />
        </div>
      </div>
    </div>
  );
}
