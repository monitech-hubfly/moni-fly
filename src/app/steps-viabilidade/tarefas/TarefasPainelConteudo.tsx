'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { getAtividadesChecklistPainel, updateChecklistItemStatus } from '../card-actions';
import { PAINEL_COLUMNS } from '../painelColumns';
import {
  aplicarFiltrosTarefasPainel,
  defaultPainelTarefasFiltros,
  getPrazoTagAtividade,
  mergeTimesDisponiveis,
  painelTarefasFiltrosTemAlgumAtivo,
  PAINEL_TAREFAS_SEARCH_CLASS,
  PAINEL_TAREFAS_SELECT_CLASS,
  type PainelTarefasFiltrosState,
} from '@/lib/painel-tarefas-filtros';

type Tarefa = {
  id: string;
  processo_id: string;
  etapa_painel: string;
  titulo: string;
  time_nome: string | null;
  responsavel_nome: string | null;
  prazo: string | null;
  status: string;
  processo_cidade: string;
  processo_estado: string | null;
  numero_franquia?: string | null;
  nome_franqueado?: string | null;
  nome_condominio?: string | null;
};

type TarefasPainelConteudoProps = { basePath?: string };

function parsePrazoOrdenacao(v: string | null): number {
  if (!v) return Number.POSITIVE_INFINITY;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
    const time = d.getTime();
    return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
  }
  const d = new Date(v);
  const time = d.getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

export function TarefasPainelConteudo({ basePath = '/painel-novos-negocios' }: TarefasPainelConteudoProps) {
  const router = useRouter();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<PainelTarefasFiltrosState>(() => defaultPainelTarefasFiltros());

  useEffect(() => {
    let cancelled = false;
    getAtividadesChecklistPainel().then((r) => {
      if (!cancelled && r.ok) setTarefas(r.tarefas);
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStatus = async (atividadeId: string, status: string) => {
    const res = await updateChecklistItemStatus(atividadeId, status as 'nao_iniciada' | 'em_andamento' | 'concluido');
    if (res.ok) {
      const r = await getAtividadesChecklistPainel();
      if (r.ok) setTarefas(r.tarefas);
      router.refresh();
    }
  };

  const etapaLabel = (key: string) => PAINEL_COLUMNS.find((c) => c.key === key)?.title ?? key;

  const timesDisponiveis = useMemo(
    () => mergeTimesDisponiveis(tarefas.map((t) => (t.time_nome ?? '').trim()).filter(Boolean)),
    [tarefas],
  );
  const franqueadosDisponiveis = useMemo(
    () =>
      [...new Set(tarefas.map((t) => (t.nome_franqueado ?? '').trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
      ),
    [tarefas],
  );
  const etapasDisponiveis = useMemo(
    () =>
      [...new Set(tarefas.map((t) => (t.etapa_painel ?? '').trim()).filter(Boolean))].sort((a, b) =>
        etapaLabel(a).localeCompare(etapaLabel(b), 'pt-BR', { sensitivity: 'base' }),
      ),
    [tarefas],
  );

  const tarefasFiltradas = useMemo(() => aplicarFiltrosTarefasPainel(tarefas, filtros), [tarefas, filtros]);

  const tarefasOrdenadas = useMemo(() => {
    const copy = [...tarefasFiltradas];
    const keyResp = (t: Tarefa) => (t.responsavel_nome?.trim() ? t.responsavel_nome.trim() : 'Sem responsável');
    copy.sort((a, b) => {
      if (filtros.ordenacao === 'responsavel') {
        const ra = keyResp(a);
        const rb = keyResp(b);
        const c1 = ra.localeCompare(rb, 'pt-BR', { sensitivity: 'base' });
        if (c1 !== 0) return c1;
        return parsePrazoOrdenacao(a.prazo) - parsePrazoOrdenacao(b.prazo);
      }
      const c1 = parsePrazoOrdenacao(a.prazo) - parsePrazoOrdenacao(b.prazo);
      if (c1 !== 0) return c1;
      return keyResp(a).localeCompare(keyResp(b), 'pt-BR', { sensitivity: 'base' });
    });
    return copy;
  }, [tarefasFiltradas, filtros.ordenacao]);

  const agrupadas = useMemo(
    () =>
      tarefasOrdenadas.reduce(
        (acc, t) => {
          const key =
            filtros.ordenacao === 'prazo'
              ? t.prazo?.trim() || 'Sem prazo'
              : t.responsavel_nome?.trim() || 'Sem responsável';
          const list = acc[key] ?? [];
          list.push(t);
          acc[key] = list;
          return acc;
        },
        {} as Record<string, Tarefa[]>,
      ),
    [tarefasOrdenadas, filtros.ordenacao],
  );

  if (loading) return <p className="text-sm text-stone-500">Carregando…</p>;

  return (
    <div className="space-y-4">
      <section
        className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 shadow-sm"
        aria-label="Filtros do painel de tarefas"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Filtros</p>
          {painelTarefasFiltrosTemAlgumAtivo(filtros) && (
            <button
              type="button"
              onClick={() => setFiltros(defaultPainelTarefasFiltros())}
              className="text-xs font-medium text-moni-primary hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        <div className="relative mb-3 w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            value={filtros.busca}
            onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
            placeholder="Buscar por Nº franquia, franqueado ou condomínio"
            className={PAINEL_TAREFAS_SEARCH_CLASS}
            aria-label="Buscar tarefas"
          />
        </div>

        {/* Mesmo padrão da aba Atividades no card: selects em grid, rótulos no prefixo das opções */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <select
            value={filtros.status}
            onChange={(e) =>
              setFiltros((f) => ({
                ...f,
                status: e.target.value as PainelTarefasFiltrosState['status'],
              }))
            }
            className={PAINEL_TAREFAS_SELECT_CLASS}
            aria-label="Filtrar por status"
          >
            <option value="todos">Status: todos</option>
            <option value="nao_iniciada">Status: não iniciada</option>
            <option value="em_andamento">Status: em andamento</option>
            <option value="concluido">Status: concluída</option>
          </select>

          <select
            value={filtros.time}
            onChange={(e) => setFiltros((f) => ({ ...f, time: e.target.value }))}
            className={PAINEL_TAREFAS_SELECT_CLASS}
            aria-label="Filtrar por time"
          >
            <option value="todos">Time: todos</option>
            {timesDisponiveis.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>

          <select
            value={filtros.franqueado}
            onChange={(e) => setFiltros((f) => ({ ...f, franqueado: e.target.value }))}
            className={PAINEL_TAREFAS_SELECT_CLASS}
            aria-label="Filtrar por franqueado"
          >
            <option value="todos">Franqueado: todos</option>
            {franqueadosDisponiveis.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>

          <select
            value={filtros.etapa}
            onChange={(e) => setFiltros((f) => ({ ...f, etapa: e.target.value }))}
            className={PAINEL_TAREFAS_SELECT_CLASS}
            aria-label="Filtrar por etapa do painel"
          >
            <option value="todas">Etapa: todas</option>
            {etapasDisponiveis.map((etapa) => (
              <option key={etapa} value={etapa}>
                {etapaLabel(etapa)}
              </option>
            ))}
          </select>

          <select
            value={filtros.tag}
            onChange={(e) =>
              setFiltros((f) => ({
                ...f,
                tag: e.target.value as PainelTarefasFiltrosState['tag'],
              }))
            }
            className={PAINEL_TAREFAS_SELECT_CLASS}
            aria-label="Filtrar por tag de prazo"
          >
            <option value="todas">Prazo: todas as tags</option>
            <option value="atrasado">Prazo: atrasado</option>
            <option value="atencao">Prazo: atenção (amanhã)</option>
          </select>

          <select
            value={filtros.ordenacao}
            onChange={(e) =>
              setFiltros((f) => ({
                ...f,
                ordenacao: e.target.value as 'responsavel' | 'prazo',
              }))
            }
            className={PAINEL_TAREFAS_SELECT_CLASS}
            aria-label="Ordenação da lista"
          >
            <option value="responsavel">Ordenar por responsável</option>
            <option value="prazo">Ordenar por prazo (menor → maior)</option>
          </select>
        </div>
      </section>

      {tarefasFiltradas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-stone-500">
          Nenhuma tarefa encontrada.
        </p>
      ) : (
        <div className="space-y-6">
          {Object.entries(agrupadas).map(([grupo, list]) => (
            <div key={grupo} className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-sm font-semibold text-stone-800">
                {filtros.ordenacao === 'prazo' ? `Prazo: ${grupo}` : grupo}
              </p>
              <ul className="mt-3 space-y-2">
                {list.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-800">{t.titulo}</p>
                      <p className="text-xs text-stone-500">
                        {etapaLabel(t.etapa_painel)}
                        {filtros.ordenacao === 'responsavel' && t.prazo ? ` · Prazo ${t.prazo}` : ''}
                      </p>
                      {filtros.ordenacao === 'prazo' ? (
                        <p className="text-[11px] text-stone-600">
                          Time: {t.time_nome?.trim() || '—'} · Responsável:{' '}
                          {t.responsavel_nome?.trim() || 'Sem responsável'}
                        </p>
                      ) : (
                        <p className="text-[11px] text-stone-600">Time: {t.time_nome?.trim() || '—'}</p>
                      )}
                      <span className="ml-2 mt-1 inline-block rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
                        {t.status === 'nao_iniciada'
                          ? 'Não iniciada'
                          : t.status === 'em_andamento'
                            ? 'Em andamento'
                            : 'Concluída'}
                      </span>
                      {getPrazoTagAtividade(t.prazo, t.status) === 'atrasado' && (
                        <span className="ml-2 mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800">
                          Atrasado
                        </span>
                      )}
                      {getPrazoTagAtividade(t.prazo, t.status) === 'atencao' && (
                        <span className="ml-2 mt-1 inline-block rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-medium text-yellow-800">
                          Atenção
                        </span>
                      )}
                    </div>
                    <select
                      value={t.status}
                      onChange={(e) => handleStatus(t.id, e.target.value)}
                      className="rounded border border-stone-300 px-2 py-1 text-xs"
                    >
                      <option value="nao_iniciada">Não iniciada</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="concluido">Concluído</option>
                    </select>
                    <Link
                      href={`${basePath}?abrir=${t.processo_id}`}
                      className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100"
                    >
                      Ver card
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
