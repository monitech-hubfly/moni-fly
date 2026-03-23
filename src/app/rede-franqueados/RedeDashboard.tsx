'use client';

import { useMemo, useState } from 'react';
import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';
import { parseAreaAtuacao } from '@/lib/rede-area-atuacao';
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

export function RedeDashboard({ rows }: { rows: RedeFranqueadoRowDb[] }) {
  const [filtro, setFiltro] = useState<FiltroStatus>('todos');
  const [listaModal, setListaModal] = useState<{ titulo: string; rows: RedeFranqueadoRowDb[] } | null>(null);
  const [filtroEstadoCidadeAtuacao, setFiltroEstadoCidadeAtuacao] = useState<string>('');

  const filteredRows = useMemo(() => {
    if (filtro === 'todos') return rows;
    if (filtro === 'encerrados') return rows.filter((r) => isOperacaoEncerrada(norm(r.status_franquia)));
    return rows.filter((r) => isEmOperacao(norm(r.status_franquia)));
  }, [rows, filtro]);

  const total = filteredRows.length;

  const operacao = filteredRows.filter((r) => isEmOperacao(norm(r.status_franquia))).length;
  const encerradas = filteredRows.filter((r) => isOperacaoEncerrada(norm(r.status_franquia))).length;

  const incompletos = filteredRows
    .map((r) => ({ r, missing: missingFields(r) }))
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
  for (const r of filteredRows) {
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
  for (const r of filteredRows) {
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
  for (const r of filteredRows) {
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
  for (const r of filteredRows) {
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

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-stone-600">Filtro:</span>
        <button
          type="button"
          onClick={() => setFiltro('todos')}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
            filtro === 'todos' ? 'border-moni-primary bg-moni-primary text-white' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
          }`}
        >
          Todos ({totalGeral})
        </button>
        <button
          type="button"
          onClick={() => setFiltro('em_operacao')}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
            filtro === 'em_operacao' ? 'border-green-600 bg-green-600 text-white' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
          }`}
        >
          Em operação ({operacaoGeral})
        </button>
        <button
          type="button"
          onClick={() => setFiltro('encerrados')}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
            filtro === 'encerrados' ? 'border-red-600 bg-red-600 text-white' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
          }`}
        >
          Encerradas ({encerradasGeral})
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <button
          type="button"
          onClick={() => setListaModal({ titulo: `Total de franquias (${total})`, rows: filteredRows })}
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-left text-stone-900 transition hover:bg-green-100/80 focus:outline-none focus:ring-2 focus:ring-moni-primary focus:ring-offset-2"
        >
          <p className="text-xs text-stone-600">Total de franquias</p>
          <p className="mt-1 text-3xl font-bold">{total}</p>
          <p className="mt-1 text-xs text-stone-500">Clique para ver a lista</p>
        </button>
        <button
          type="button"
          onClick={() => setListaModal({ titulo: `Em operação (${operacao})`, rows: rowsEmOperacao })}
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-left text-stone-900 transition hover:bg-green-100/80 focus:outline-none focus:ring-2 focus:ring-moni-primary focus:ring-offset-2"
        >
          <p className="text-xs text-stone-600">Em operação</p>
          <p className="mt-1 text-3xl font-bold text-green-700">{operacao}</p>
          <p className="mt-1 text-xs text-stone-600">{pct(operacao, total)} da rede</p>
          <p className="mt-1 text-xs text-stone-500">Clique para ver a lista</p>
        </button>
        <button
          type="button"
          onClick={() => setListaModal({ titulo: `Encerradas (${encerradas})`, rows: rowsEncerradas })}
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-left text-stone-900 transition hover:bg-green-100/80 focus:outline-none focus:ring-2 focus:ring-moni-primary focus:ring-offset-2"
        >
          <p className="text-xs text-stone-600">Encerradas</p>
          <p className="mt-1 text-3xl font-bold text-red-600">{encerradas}</p>
          <p className="mt-1 text-xs text-stone-500">Clique para ver a lista</p>
        </button>
        <button
          type="button"
          onClick={() => setListaModal({ titulo: `Cadastros incompletos (${incompletos.length})`, rows: incompletos.map((x) => x.r) })}
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-left text-stone-900 transition hover:bg-green-100/80 focus:outline-none focus:ring-2 focus:ring-moni-primary focus:ring-offset-2"
        >
          <p className="text-xs text-stone-600">Cadastros incompletos</p>
          <p className="mt-1 text-3xl font-bold text-yellow-700">{incompletos.length}</p>
          <p className="mt-1 text-xs text-stone-600">
            {incompletos.slice(0, 5).map(({ r }) => norm(r.n_franquia)).filter(Boolean).join(', ') || '—'}
          </p>
          <p className="mt-1 text-xs text-stone-500">Clique para ver a lista</p>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-stone-900">
          <p className="text-sm font-semibold text-stone-900">Classificação dos franqueados</p>
          <p className="mt-1 text-xs text-stone-500">Clique na barra para ver a lista.</p>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex-1">
              <button
                type="button"
                onClick={() => setListaModal({ titulo: `Pagante (${pagantes})`, rows: rowsPagante })}
                className="w-full cursor-pointer text-left hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-moni-primary focus:ring-offset-2 rounded"
              >
                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span>Pagante</span><span>{pct(pagantes, total)} — {pagantes}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-green-200">
                  <div className="h-2 rounded bg-green-600" style={{ width: barWidth(pagantes, total) }} />
                </div>
              </button>
              <button
                type="button"
                onClick={() => setListaModal({ titulo: `Beta (${beta})`, rows: rowsBeta })}
                className="mt-3 w-full cursor-pointer text-left hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-moni-primary focus:ring-offset-2 rounded"
              >
                <div className="flex items-center justify-between text-xs text-stone-600">
                  <span>Beta</span><span>{pct(beta, total)} — {beta}</span>
                </div>
                <div className="mt-1 h-2 rounded bg-green-200">
                  <div className="h-2 rounded bg-yellow-700" style={{ width: barWidth(beta, total) }} />
                </div>
              </button>
            </div>
            <div className="text-right text-xs text-stone-600">
              <p>Pagante: <span className="text-stone-900">{pagantes}</span></p>
              <p>Beta: <span className="text-stone-900">{beta}</span></p>
              <p className="mt-2">Encerradas pagantes: <span className="text-stone-900">{statusByClass.pagante.encerrada}</span></p>
              <p>Encerradas beta: <span className="text-stone-900">{statusByClass.beta.encerrada}</span></p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-stone-900">
          <p className="text-sm font-semibold text-stone-900">Franquias por regional</p>
          <p className="mt-1 text-xs text-stone-500">Clique na linha para ver a lista.</p>
          <div className="mt-3 space-y-2">
            {regionalArr.slice(0, 8).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => setListaModal({ titulo: `Regional: ${k} (${v})`, rows: rowsPorRegional.get(k) ?? [] })}
                className="flex w-full items-center gap-3 rounded py-1 text-left hover:bg-green-100/50 focus:outline-none focus:ring-2 focus:ring-moni-primary focus:ring-offset-2"
              >
                <div className="w-32 text-xs text-stone-600">{k}</div>
                <div className="flex-1">
                  <div className="h-2 rounded bg-green-200">
                    <div className="h-2 rounded bg-green-600" style={{ width: barWidth(v, maxRegional) }} />
                  </div>
                </div>
                <div className="w-8 text-right text-xs text-stone-600">{v}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-stone-900">
          <p className="text-sm font-semibold text-stone-900">Franquias por cidade de atuação</p>
          <p className="mt-1 text-xs text-stone-600">Área de atuação (UF - Cidade). Clique na linha para ver a lista.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-xs text-stone-600">Filtro por estado:</label>
            <select
              value={filtroEstadoCidadeAtuacao}
              onChange={(e) => setFiltroEstadoCidadeAtuacao(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700"
            >
              <option value="">Todos</option>
              {estadoAtuacaoArr.map(([uf]) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {cidadeAtuacaoArr.length === 0 ? (
              <p className="text-xs text-stone-500">
                {filtroEstadoCidadeAtuacao ? `Nenhuma cidade no estado ${filtroEstadoCidadeAtuacao}.` : 'Nenhum dado de área de atuação.'}
              </p>
            ) : (
              cidadeAtuacaoArr.slice(0, 20).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setListaModal({ titulo: `Cidade de atuação: ${k} (${v})`, rows: rowsPorCidadeAtuacao.get(k) ?? [] })}
                  className="flex w-full items-center gap-3 rounded py-1 text-left hover:bg-green-100/50 focus:outline-none focus:ring-2 focus:ring-moni-primary focus:ring-offset-2"
                >
                  <div className="min-w-0 flex-1 truncate text-left text-xs text-stone-600" title={k}>{k}</div>
                  <div className="h-4 w-40 shrink-0 rounded bg-green-200">
                    <div className="h-4 rounded bg-yellow-700" style={{ width: barWidth(v, maxCidadeAtuacao) }} />
                  </div>
                  <div className="w-8 shrink-0 text-right text-xs font-medium text-stone-600">{v}</div>
                </button>
              ))
            )}
          </div>
        </div>
        <MapBrazilCidadesAtuacao rows={filteredRows} filtroEstado={filtroEstadoCidadeAtuacao} />
      </div>

      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-stone-900">
        <p className="text-sm font-semibold text-stone-900">Crescimento mensal — novas franquias assinadas</p>
        <p className="mt-1 text-xs text-stone-600">Contratos assinados por mês (Data de Ass. Contrato). Clique na barra para ver a lista.</p>
        <div className="mt-4 flex items-end gap-2 overflow-x-auto pb-2">
          {mesArr.length === 0 ? (
            <p className="text-sm text-stone-600">Sem datas de contrato suficientes.</p>
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
                  <span className="text-xs font-medium text-stone-700">{v}</span>
                  <div className="w-full rounded bg-green-200">
                    <div className="w-full rounded bg-green-600" style={{ height: `${h}px` }} />
                  </div>
                  <div className="text-[10px] text-stone-600">{monthLabel(k)}</div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {listaModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setListaModal(null)}
        >
          <div className="max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <h3 className="font-semibold text-stone-900">{listaModal.titulo}</h3>
              <button
                type="button"
                onClick={() => setListaModal(null)}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
              >
                Fechar
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {listaModal.rows.length === 0 ? (
                <p className="text-sm text-stone-500">Nenhum franqueado nesta seleção.</p>
              ) : (
                <ul className="space-y-2">
                  {listaModal.rows.map((row) => (
                    <li key={row.id} className="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50/50 px-3 py-2 text-sm">
                      <span className="font-medium text-stone-800">{norm(row.n_franquia) || '—'}</span>
                      <span className="text-stone-600">{norm(row.nome_completo) || '—'}</span>
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

