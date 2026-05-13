'use client';

import { useMemo, useState } from 'react';
import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';
import { parseAreaAtuacao } from '@/lib/rede-area-atuacao';
import { ocultarRegionalEAtuacaoNaVisaoFranqueado } from '@/lib/rede-visibilidade-franqueado';
import { MapBrazilCidadesAtuacao } from './MapBrazilCidadesAtuacao';

type FiltroStatus = 'todos' | 'encerrados' | 'em_operacao';

function norm(s: string | null | undefined) {
  return (s ?? '').toString().trim();
}

/** Normaliza para comparação (remove acentos e ç). */
function normStatus(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .toLowerCase();
}

function isOperacaoEncerrada(status: string) {
  return /encerrad/.test(normStatus(status));
}

/** Considera "Em Operação" (valor do formulário); puxa da coluna status_franquia da tabela. */
function isEmOperacao(status: string) {
  const raw = norm(status);
  if (!raw) return false;
  const n = normStatus(raw);
  if (/encerrad/.test(n)) return false;
  // Aceita "Em Operação" / "em operação" / "em operacao" (com ou sem acento)
  if (n === 'em operacao' || n.startsWith('em operacao ')) return true;
  const low = raw.toLowerCase();
  return low.includes('em operação') || low.includes('em operacao');
}

function monthKey(dateStr: string): string | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const month = Number(m);
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${names[Math.max(1, Math.min(12, month)) - 1]}/${String(y).slice(-2)}`;
}

function pct(n: number, total: number): string {
  if (!total) return '0%';
  return `${((n / total) * 100).toFixed(1).replace('.', ',')}%`;
}

function barWidth(n: number, max: number): string {
  if (!max) return '0%';
  return `${Math.round((n / max) * 100)}%`;
}

function missingFields(row: RedeFranqueadoRowDb): string[] {
  const missing: string[] = [];
  if (!norm(row.regional)) missing.push('Regional');
  if (!norm(row.area_atuacao)) missing.push('Área de Atuação');
  if (!norm(row.data_ass_contrato)) missing.push('Data Contrato');
  return missing;
}

/** Portal Frank: sem data de contrato na query — só pendências visíveis na rede “pública”. */
function missingFieldsFrank(row: RedeFranqueadoRowDb): string[] {
  const missing: string[] = [];
  if (!norm(row.regional)) missing.push('Regional');
  if (!norm(row.area_atuacao)) missing.push('Área de Atuação');
  return missing;
}

const redeKpiCardStyle: React.CSSProperties = {
  borderColor: 'var(--moni-rede-chart-border)',
  backgroundColor: 'var(--moni-rede-chart-surface)',
  color: 'var(--moni-text-primary)',
};

function KpiShell({
  modoAggregado,
  onOpen,
  children,
}: {
  modoAggregado: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const cls =
    'h-full rounded-xl border p-4 text-left transition hover:bg-[var(--moni-surface-100)]';
  if (modoAggregado) {
    return (
      <div className={cls} style={redeKpiCardStyle}>
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${cls} focus:outline-none focus:ring-2 focus:ring-moni-primary focus:ring-offset-2`}
      style={redeKpiCardStyle}
    >
      {children}
    </button>
  );
}

export function RedeDashboard({
  rows,
  modoAggregado = false,
  visaoFranqueado = false,
}: {
  rows: RedeFranqueadoRowDb[];
  /** Sem modal de lista ao clicar (portal Frank): só totais agregados. */
  modoAggregado?: boolean;
  /**
   * Portal do franqueado: sem barra de filtro; gráficos só com unidades em operação;
   * oculta KPIs de encerradas / incompletos e o bloco de classificação.
   */
  visaoFranqueado?: boolean;
}) {
  const [filtro, setFiltro] = useState<FiltroStatus>('todos');
  const [listaModal, setListaModal] = useState<{ titulo: string; rows: RedeFranqueadoRowDb[] } | null>(null);
  const [filtroEstadoCidadeAtuacao, setFiltroEstadoCidadeAtuacao] = useState<string>('');

  const filteredRows = useMemo(() => {
    if (visaoFranqueado) {
      return rows.filter((r) => isEmOperacao(norm(r.status_franquia)));
    }
    if (filtro === 'todos') return rows;
    if (filtro === 'encerrados') return rows.filter((r) => isOperacaoEncerrada(norm(r.status_franquia)));
    return rows.filter((r) => isEmOperacao(norm(r.status_franquia)));
  }, [rows, filtro, visaoFranqueado]);

  /** Na visão do franqueado, a franquia FK0000 não entra em agregados de regional nem de área de atuação. */
  const linhasRegionalAtuacaoCharts = useMemo(() => {
    if (!visaoFranqueado) return filteredRows;
    return filteredRows.filter((r) => !ocultarRegionalEAtuacaoNaVisaoFranqueado(r.n_franquia));
  }, [filteredRows, visaoFranqueado]);

  const total = filteredRows.length;

  const operacao = filteredRows.filter((r) => isEmOperacao(norm(r.status_franquia))).length;
  const encerradas = filteredRows.filter((r) => isOperacaoEncerrada(norm(r.status_franquia))).length;

  const incompletos = filteredRows
    .map((r) => ({ r, missing: modoAggregado ? missingFieldsFrank(r) : missingFields(r) }))
    .filter((x) => x.missing.length > 0);

  const pagantes = filteredRows.filter((r) => /pagante/i.test(norm(r.classificacao_franqueado))).length;
  const beta = filteredRows.filter((r) => /beta/i.test(norm(r.classificacao_franqueado))).length;

  const statusByClass = {
    pagante: {
      emOperacao: filteredRows.filter((r) => /pagante/i.test(norm(r.classificacao_franqueado)) && isEmOperacao(norm(r.status_franquia))).length,
      encerrada: filteredRows.filter((r) => /pagante/i.test(norm(r.classificacao_franqueado)) && isOperacaoEncerrada(norm(r.status_franquia))).length,
    },
    beta: {
      emOperacao: filteredRows.filter((r) => /beta/i.test(norm(r.classificacao_franqueado)) && isEmOperacao(norm(r.status_franquia))).length,
      encerrada: filteredRows.filter((r) => /beta/i.test(norm(r.classificacao_franqueado)) && isOperacaoEncerrada(norm(r.status_franquia))).length,
    },
  };

  const porRegional = new Map<string, number>();
  for (const r of linhasRegionalAtuacaoCharts) {
    const k = norm(r.regional) || 'Sem regional';
    porRegional.set(k, (porRegional.get(k) ?? 0) + 1);
  }
  const regionalArr = [...porRegional.entries()].sort((a, b) => b[1] - a[1]);
  const maxRegional = regionalArr[0]?.[1] ?? 0;

  const porEstado = new Map<string, number>();
  for (const r of filteredRows) {
    const k = norm(r.estado_casa_frank) || 'Sem estado';
    porEstado.set(k, (porEstado.get(k) ?? 0) + 1);
  }
  const estadoArr = [...porEstado.entries()].sort((a, b) => b[1] - a[1]);
  const maxEstado = estadoArr[0]?.[1] ?? 0;

  const porEstadoAtuacao = new Map<string, number>();
  const porCidadeAtuacao = new Map<string, number>();
  for (const r of linhasRegionalAtuacaoCharts) {
    const areas = parseAreaAtuacao(r.area_atuacao);
    for (const { uf, cidade } of areas) {
      if (uf) porEstadoAtuacao.set(uf, (porEstadoAtuacao.get(uf) ?? 0) + 1);
      const keyCidade = uf && cidade ? `${uf} - ${cidade}` : '';
      if (keyCidade) porCidadeAtuacao.set(keyCidade, (porCidadeAtuacao.get(keyCidade) ?? 0) + 1);
    }
  }
  const estadoAtuacaoArr = [...porEstadoAtuacao.entries()].sort((a, b) => b[1] - a[1]);
  const cidadeAtuacaoArrAll = [...porCidadeAtuacao.entries()].sort((a, b) => b[1] - a[1]);
  const cidadeAtuacaoArr = useMemo(() => {
    if (!filtroEstadoCidadeAtuacao) return cidadeAtuacaoArrAll;
    const uf = filtroEstadoCidadeAtuacao.trim();
    if (!uf) return cidadeAtuacaoArrAll;
    return cidadeAtuacaoArrAll.filter(([k]) => k.startsWith(`${uf} - `));
  }, [cidadeAtuacaoArrAll, filtroEstadoCidadeAtuacao]);
  const maxCidadeAtuacao = Math.max(0, ...cidadeAtuacaoArr.map(([, v]) => v));

  const porMes = new Map<string, number>();
  const rowsPorMes = new Map<string, RedeFranqueadoRowDb[]>();
  for (const r of filteredRows) {
    const d = norm(r.data_ass_contrato);
    if (!d) continue;
    const k = monthKey(d);
    if (!k) continue;
    porMes.set(k, (porMes.get(k) ?? 0) + 1);
    const list = rowsPorMes.get(k) ?? [];
    list.push(r);
    rowsPorMes.set(k, list);
  }
  const mesArr = [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const maxMes = Math.max(0, ...mesArr.map(([, v]) => v));

  const rowsPorRegional = new Map<string, RedeFranqueadoRowDb[]>();
  for (const r of linhasRegionalAtuacaoCharts) {
    const k = norm(r.regional) || 'Sem regional';
    const list = rowsPorRegional.get(k) ?? [];
    list.push(r);
    rowsPorRegional.set(k, list);
  }
  const rowsPorEstado = new Map<string, RedeFranqueadoRowDb[]>();
  for (const r of filteredRows) {
    const k = norm(r.estado_casa_frank) || 'Sem estado';
    const list = rowsPorEstado.get(k) ?? [];
    list.push(r);
    rowsPorEstado.set(k, list);
  }
  const rowsPorEstadoAtuacao = new Map<string, RedeFranqueadoRowDb[]>();
  const rowsPorCidadeAtuacao = new Map<string, RedeFranqueadoRowDb[]>();
  for (const r of linhasRegionalAtuacaoCharts) {
    const areas = parseAreaAtuacao(r.area_atuacao);
    for (const { uf, cidade } of areas) {
      if (uf) {
        const listUf = rowsPorEstadoAtuacao.get(uf) ?? [];
        listUf.push(r);
        rowsPorEstadoAtuacao.set(uf, listUf);
      }
      const keyCidade = uf && cidade ? `${uf} - ${cidade}` : '';
      if (keyCidade) {
        const listCid = rowsPorCidadeAtuacao.get(keyCidade) ?? [];
        listCid.push(r);
        rowsPorCidadeAtuacao.set(keyCidade, listCid);
      }
    }
  }
  const rowsEmOperacao = useMemo(() => filteredRows.filter((r) => isEmOperacao(norm(r.status_franquia))), [filteredRows]);
  const rowsEncerradas = useMemo(() => filteredRows.filter((r) => isOperacaoEncerrada(norm(r.status_franquia))), [filteredRows]);
  const rowsPagante = useMemo(() => filteredRows.filter((r) => /pagante/i.test(norm(r.classificacao_franqueado))), [filteredRows]);
  const rowsBeta = useMemo(() => filteredRows.filter((r) => /beta/i.test(norm(r.classificacao_franqueado))), [filteredRows]);

  const totalGeral = rows.length;
  const operacaoGeral = rows.filter((r) => isEmOperacao(norm(r.status_franquia))).length;
  const encerradasGeral = rows.filter((r) => isOperacaoEncerrada(norm(r.status_franquia))).length;

  const emOperacaoRedeFrank = visaoFranqueado ? operacaoGeral : operacao;

  return (
    <section className="space-y-4">
      {!visaoFranqueado ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
            Filtro:
          </span>
          <button
            type="button"
            onClick={() => setFiltro('todos')}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              filtro === 'todos'
                ? 'border-moni-primary bg-moni-primary text-white'
                : 'hover:bg-[var(--moni-surface-100)]'
            }`}
            style={
              filtro !== 'todos'
                ? {
                    borderColor: 'var(--moni-border-default)',
                    backgroundColor: 'var(--moni-surface-0)',
                    color: 'var(--moni-text-secondary)',
                  }
                : undefined
            }
          >
            Todos ({totalGeral})
          </button>
          <button
            type="button"
            onClick={() => setFiltro('em_operacao')}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-[var(--moni-surface-100)]"
            style={
              filtro === 'em_operacao'
                ? {
                    borderColor: 'var(--moni-green-800)',
                    backgroundColor: 'var(--moni-rede-filter-em-operacao-bg)',
                    color: 'var(--moni-text-inverse)',
                  }
                : {
                    borderColor: 'var(--moni-border-default)',
                    backgroundColor: 'var(--moni-surface-0)',
                    color: 'var(--moni-text-secondary)',
                  }
            }
          >
            Em operação ({operacaoGeral})
          </button>
          <button
            type="button"
            onClick={() => setFiltro('encerrados')}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:bg-[var(--moni-surface-100)]"
            style={
              filtro === 'encerrados'
                ? {
                    borderColor: 'var(--moni-status-overdue-border)',
                    backgroundColor: 'var(--moni-rede-filter-encerradas-bg)',
                    color: 'var(--moni-text-inverse)',
                  }
                : {
                    borderColor: 'var(--moni-border-default)',
                    backgroundColor: 'var(--moni-surface-0)',
                    color: 'var(--moni-text-secondary)',
                  }
            }
          >
            Encerradas ({encerradasGeral})
          </button>
        </div>
      ) : null}

      {visaoFranqueado ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
          <div className="w-full shrink-0 lg:w-44 lg:min-w-[11rem] lg:max-w-[14rem]">
            <KpiShell
              modoAggregado={modoAggregado}
              onOpen={() =>
                setListaModal({
                  titulo: `Em operação (${emOperacaoRedeFrank})`,
                  rows: rows.filter((r) => isEmOperacao(norm(r.status_franquia))),
                })
              }
            >
              <p className="text-base font-semibold leading-tight" style={{ color: 'var(--moni-text-tertiary)' }}>
                Em operação
              </p>
              <p className="mt-2 text-5xl font-bold leading-none tracking-tight" style={{ color: 'var(--moni-rede-kpi-em-operacao)' }}>
                {emOperacaoRedeFrank}
              </p>
            </KpiShell>
          </div>
          <div className="min-w-0 flex-1 rounded-xl border p-4" style={redeKpiCardStyle}>
            <p className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
              Franquias por regional
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
              Somente unidades em operação (totais agregados).
            </p>
            <div className="mt-3 space-y-2">
              {regionalArr.slice(0, 8).map(([k, v]) => (
                <div key={k} className="flex w-full items-center gap-3 rounded py-1 text-left">
                  <div className="w-32 shrink-0 text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
                    {k}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="h-2 rounded" style={{ backgroundColor: 'var(--moni-rede-chart-track)' }}>
                      <div
                        className="h-2 rounded"
                        style={{
                          width: barWidth(v, maxRegional),
                          backgroundColor: 'var(--moni-rede-chart-fill)',
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-8 shrink-0 text-right text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <KpiShell
              modoAggregado={modoAggregado}
              onOpen={() => setListaModal({ titulo: `Total de franquias (${total})`, rows: filteredRows })}
            >
              <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                Total de franquias
              </p>
              <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--moni-text-primary)' }}>
                {total}
              </p>
              {!modoAggregado ? (
                <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Clique para ver a lista
                </p>
              ) : null}
            </KpiShell>
            <KpiShell
              modoAggregado={modoAggregado}
              onOpen={() => setListaModal({ titulo: `Encerradas (${encerradas})`, rows: rowsEncerradas })}
            >
              <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                Encerradas
              </p>
              <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--moni-status-overdue-text)' }}>
                {encerradas}
              </p>
              {!modoAggregado ? (
                <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Clique para ver a lista
                </p>
              ) : null}
            </KpiShell>
            <KpiShell
              modoAggregado={modoAggregado}
              onOpen={() =>
                setListaModal({ titulo: `Cadastros incompletos (${incompletos.length})`, rows: incompletos.map((x) => x.r) })
              }
            >
              <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                Cadastros incompletos
              </p>
              <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--moni-status-attention-text)' }}>
                {incompletos.length}
              </p>
              {!modoAggregado ? (
                <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
                  {incompletos.slice(0, 5).map(({ r }) => norm(r.n_franquia)).filter(Boolean).join(', ') || '—'}
                </p>
              ) : (
                <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Somente totais agregados (sem lista de unidades).
                </p>
              )}
              {!modoAggregado ? (
                <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Clique para ver a lista
                </p>
              ) : null}
            </KpiShell>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <div className="w-full shrink-0 lg:w-44 lg:min-w-[11rem] lg:max-w-[14rem]">
              <KpiShell
                modoAggregado={modoAggregado}
                onOpen={() =>
                  setListaModal({
                    titulo: `Em operação (${operacao})`,
                    rows: rowsEmOperacao,
                  })
                }
              >
                <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Em operação
                </p>
                <p className="mt-1 text-3xl font-bold" style={{ color: 'var(--moni-rede-kpi-em-operacao)' }}>
                  {operacao}
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
                  {`${pct(operacao, total)} da rede`}
                </p>
                {!modoAggregado ? (
                  <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                    Clique para ver a lista
                  </p>
                ) : null}
              </KpiShell>
            </div>
            <div className="min-w-0 flex-1 rounded-xl border p-4" style={redeKpiCardStyle}>
              <p className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                Franquias por regional
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                {modoAggregado
                  ? 'Totais por regional (sem lista de unidades).'
                  : 'Clique na linha para ver a lista.'}
              </p>
              <div className="mt-3 space-y-2">
                {regionalArr.slice(0, 8).map(([k, v]) =>
                  modoAggregado ? (
                    <div key={k} className="flex w-full items-center gap-3 rounded py-1 text-left">
                      <div className="w-32 shrink-0 text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
                        {k}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="h-2 rounded" style={{ backgroundColor: 'var(--moni-rede-chart-track)' }}>
                          <div
                            className="h-2 rounded"
                            style={{
                              width: barWidth(v, maxRegional),
                              backgroundColor: 'var(--moni-rede-chart-fill)',
                            }}
                          />
                        </div>
                      </div>
                      <div className="w-8 shrink-0 text-right text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
                        {v}
                      </div>
                    </div>
                  ) : (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setListaModal({ titulo: `Regional: ${k} (${v})`, rows: rowsPorRegional.get(k) ?? [] })}
                      className="flex w-full items-center gap-3 rounded py-1 text-left hover:bg-[var(--moni-rede-hover-row)] focus:outline-none focus:ring-2 focus:ring-moni-primary focus:ring-offset-2"
                    >
                      <div className="w-32 shrink-0 text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
                        {k}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="h-2 rounded" style={{ backgroundColor: 'var(--moni-rede-chart-track)' }}>
                          <div
                            className="h-2 rounded"
                            style={{
                              width: barWidth(v, maxRegional),
                              backgroundColor: 'var(--moni-rede-chart-fill)',
                            }}
                          />
                        </div>
                      </div>
                      <div className="w-8 shrink-0 text-right text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
                        {v}
                      </div>
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>

          {!modoAggregado ? (
            <div className="rounded-xl border p-4" style={redeKpiCardStyle}>
              <p className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                Classificação dos franqueados
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                Clique na barra para ver a lista.
              </p>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex-1">
                  <button
                    type="button"
                    onClick={() => setListaModal({ titulo: `Pagante (${pagantes})`, rows: rowsPagante })}
                    className="w-full cursor-pointer rounded text-left hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-moni-primary focus:ring-offset-2"
                  >
                    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
                      <span>Pagante</span>
                      <span>
                        {pct(pagantes, total)} — {pagantes}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded" style={{ backgroundColor: 'var(--moni-rede-chart-track)' }}>
                      <div
                        className="h-2 rounded"
                        style={{
                          width: barWidth(pagantes, total),
                          backgroundColor: 'var(--moni-rede-chart-fill)',
                        }}
                      />
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setListaModal({ titulo: `Beta (${beta})`, rows: rowsBeta })}
                    className="mt-3 w-full cursor-pointer rounded text-left hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-moni-primary focus:ring-offset-2"
                  >
                    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
                      <span>Beta</span>
                      <span>
                        {pct(beta, total)} — {beta}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded" style={{ backgroundColor: 'var(--moni-rede-chart-track)' }}>
                      <div
                        className="h-2 rounded"
                        style={{
                          width: barWidth(beta, total),
                          backgroundColor: 'var(--moni-rede-chart-fill-secondary)',
                        }}
                      />
                    </div>
                  </button>
                </div>
                <div className="text-right text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
                  <p>
                    Pagante:{' '}
                    <span style={{ color: 'var(--moni-text-primary)' }}>{pagantes}</span>
                  </p>
                  <p>
                    Beta: <span style={{ color: 'var(--moni-text-primary)' }}>{beta}</span>
                  </p>
                  <p className="mt-2">
                    Encerradas pagantes:{' '}
                    <span style={{ color: 'var(--moni-text-primary)' }}>{statusByClass.pagante.encerrada}</span>
                  </p>
                  <p>
                    Encerradas beta:{' '}
                    <span style={{ color: 'var(--moni-text-primary)' }}>{statusByClass.beta.encerrada}</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="rounded-xl border p-4 text-sm"
              style={{
                borderColor: 'var(--moni-border-default)',
                backgroundColor: 'var(--moni-surface-100)',
                color: 'var(--moni-text-secondary)',
              }}
            >
              <p className="font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                Classificação (Pagante / Beta)
              </p>
              <p className="mt-2">
                No portal do franqueado esta visão usa apenas dados não sensíveis; percentuais por classificação não são
                exibidos aqui.
              </p>
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4" style={redeKpiCardStyle}>
          <p className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
            Franquias por cidade de atuação
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
            Área de atuação (UF - Cidade).
            {visaoFranqueado
              ? ' Somente leitura; totais apenas de unidades em operação.'
              : modoAggregado
                ? ' Totais agregados (sem lista).'
                : ' Clique na linha para ver a lista.'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
              Filtro por estado:
            </label>
            <select
              value={filtroEstadoCidadeAtuacao}
              onChange={(e) => setFiltroEstadoCidadeAtuacao(e.target.value)}
              className="rounded-lg px-3 py-1.5 text-sm"
              style={{
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: 'var(--moni-border-default)',
                backgroundColor: 'var(--moni-surface-0)',
                color: 'var(--moni-text-secondary)',
              }}
            >
              <option value="">Todos</option>
              {estadoAtuacaoArr.map(([uf]) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {cidadeAtuacaoArr.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--moni-text-tertiary)' }}>
                {filtroEstadoCidadeAtuacao ? `Nenhuma cidade no estado ${filtroEstadoCidadeAtuacao}.` : 'Nenhum dado de área de atuação.'}
              </p>
            ) : (
              cidadeAtuacaoArr.slice(0, 20).map(([k, v]) =>
                modoAggregado ? (
                  <div key={k} className="flex w-full items-center gap-3 rounded py-1 text-left">
                    <div
                      className="min-w-0 flex-1 truncate text-left text-xs"
                      title={k}
                      style={{ color: 'var(--moni-text-secondary)' }}
                    >
                      {k}
                    </div>
                    <div className="h-4 w-40 shrink-0 rounded" style={{ backgroundColor: 'var(--moni-rede-chart-track)' }}>
                      <div
                        className="h-4 rounded"
                        style={{
                          width: barWidth(v, maxCidadeAtuacao),
                          backgroundColor: 'var(--moni-rede-chart-fill-secondary)',
                        }}
                      />
                    </div>
                    <div
                      className="w-8 shrink-0 text-right text-xs font-medium"
                      style={{ color: 'var(--moni-text-secondary)' }}
                    >
                      {v}
                    </div>
                  </div>
                ) : (
                  <button
                    key={k}
                    type="button"
                    onClick={() =>
                      setListaModal({ titulo: `Cidade de atuação: ${k} (${v})`, rows: rowsPorCidadeAtuacao.get(k) ?? [] })
                    }
                    className="flex w-full items-center gap-3 rounded py-1 text-left hover:bg-[var(--moni-rede-hover-row)] focus:outline-none focus:ring-2 focus:ring-moni-primary focus:ring-offset-2"
                  >
                    <div
                      className="min-w-0 flex-1 truncate text-left text-xs"
                      title={k}
                      style={{ color: 'var(--moni-text-secondary)' }}
                    >
                      {k}
                    </div>
                    <div className="h-4 w-40 shrink-0 rounded" style={{ backgroundColor: 'var(--moni-rede-chart-track)' }}>
                      <div
                        className="h-4 rounded"
                        style={{
                          width: barWidth(v, maxCidadeAtuacao),
                          backgroundColor: 'var(--moni-rede-chart-fill-secondary)',
                        }}
                      />
                    </div>
                    <div
                      className="w-8 shrink-0 text-right text-xs font-medium"
                      style={{ color: 'var(--moni-text-secondary)' }}
                    >
                      {v}
                    </div>
                  </button>
                ),
              )
            )}
          </div>
        </div>
        <MapBrazilCidadesAtuacao rows={linhasRegionalAtuacaoCharts} filtroEstado={filtroEstadoCidadeAtuacao} />
      </div>

      {!modoAggregado ? (
        <div className="rounded-xl border p-4" style={redeKpiCardStyle}>
          <p className="text-sm font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
            Crescimento mensal — novas franquias assinadas
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
            Contratos assinados por mês (Data de Ass. Contrato). Clique na barra para ver a lista.
          </p>
          <div className="mt-4 flex items-end gap-2 overflow-x-auto pb-2">
            {mesArr.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
                Sem datas de contrato suficientes.
              </p>
            ) : (
              mesArr.map(([k, v]) => {
                const list = rowsPorMes.get(k) ?? [];
                const h = Math.max(8, Math.round((v / (maxMes || 1)) * 120));
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setListaModal({ titulo: `${monthLabel(k)} — ${v} franquia(s)`, rows: list })}
                    className="flex w-12 shrink-0 flex-col items-center gap-1 rounded transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-moni-primary"
                  >
                    <span className="text-xs font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                      {v}
                    </span>
                    <div className="w-full rounded" style={{ backgroundColor: 'var(--moni-rede-chart-track)' }}>
                      <div
                        className="w-full rounded"
                        style={{
                          height: `${h}px`,
                          backgroundColor: 'var(--moni-rede-chart-fill)',
                        }}
                      />
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                      {monthLabel(k)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {!modoAggregado && listaModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setListaModal(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl border bg-[var(--moni-surface-0)] shadow-xl"
            style={{ borderColor: 'var(--moni-border-default)', boxShadow: 'var(--moni-shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: 'var(--moni-border-subtle)' }}
            >
              <h3 className="font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                {listaModal.titulo}
              </h3>
              <button
                type="button"
                onClick={() => setListaModal(null)}
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-[var(--moni-surface-100)]"
                style={{
                  borderColor: 'var(--moni-border-default)',
                  color: 'var(--moni-text-secondary)',
                }}
              >
                Fechar
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {listaModal.rows.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
                  Nenhum franqueado nesta seleção.
                </p>
              ) : (
                <ul className="space-y-2">
                  {listaModal.rows.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor: 'var(--moni-border-subtle)',
                        backgroundColor: 'var(--moni-surface-50)',
                      }}
                    >
                      <span className="font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                        {norm(row.n_franquia) || '—'}
                      </span>
                      <span style={{ color: 'var(--moni-text-secondary)' }}>{norm(row.nome_completo) || '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

