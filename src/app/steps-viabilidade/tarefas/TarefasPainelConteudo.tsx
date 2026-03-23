'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { getAtividadesChecklistPainel, updateChecklistItemStatus } from '../card-actions';
import { PAINEL_COLUMNS } from '../painelColumns';

function normalizarParaBusca(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function parsePrazoBrOrIso(prazo: string | null | undefined): Date | null {
  if (!prazo) return null;
  const raw = String(prazo).trim();
  if (!raw) return null;

  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    const d = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(`${raw}T12:00:00`);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

function getPrazoTag(prazo: string | null | undefined, status: string): 'atrasado' | 'atencao' | null {
  const statusNorm = String(status ?? '').trim().toLowerCase();
  if (statusNorm === 'concluido' || statusNorm === 'concluida') return null;
  const data = parsePrazoBrOrIso(prazo);
  if (!data) return null;
  const hoje = new Date();
  const hojeDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const amanhaDia = new Date(hojeDia.getFullYear(), hojeDia.getMonth(), hojeDia.getDate() + 1);
  const prazoDia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  if (prazoDia.getTime() < hojeDia.getTime()) return 'atrasado';
  if (prazoDia.getTime() === amanhaDia.getTime()) return 'atencao';
  return null;
}

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

export function TarefasPainelConteudo({ basePath = '/painel-novos-negocios' }: TarefasPainelConteudoProps) {
  const router = useRouter();
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<'todas' | 'nao_iniciada' | 'em_andamento' | 'concluido'>('todas');
  const [tagFiltro, setTagFiltro] = useState<'todas' | 'atrasado' | 'atencao'>('todas');
  const [timeFiltro, setTimeFiltro] = useState('todos');
  const [franqueadoFiltro, setFranqueadoFiltro] = useState('todos');
  const [etapaFiltro, setEtapaFiltro] = useState('todas');
  const [ordenacao, setOrdenacao] = useState<'responsavel' | 'prazo'>('responsavel');

  useEffect(() => {
    let cancelled = false;
    getAtividadesChecklistPainel().then((r) => {
      if (!cancelled && r.ok) setTarefas(r.tarefas);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
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

  const timesDisponiveis = [...new Set(tarefas.map((t) => (t.time_nome ?? '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  const franqueadosDisponiveis = [...new Set(tarefas.map((t) => (t.nome_franqueado ?? '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  const etapasDisponiveis = [...new Set(tarefas.map((t) => (t.etapa_painel ?? '').trim()).filter(Boolean))]
    .sort((a, b) => etapaLabel(a).localeCompare(etapaLabel(b), 'pt-BR', { sensitivity: 'base' }));

  if (loading) return <p className="text-sm text-stone-500">Carregando…</p>;

  const tarefasFiltradas = tarefas.filter((t) => {
    if (statusFiltro !== 'todas' && t.status !== statusFiltro) return false;
    const tagPrazo = getPrazoTag(t.prazo, t.status);
    if (tagFiltro !== 'todas' && tagPrazo !== tagFiltro) return false;
    if (timeFiltro !== 'todos' && (t.time_nome ?? '').trim() !== timeFiltro) return false;
    if (franqueadoFiltro !== 'todos' && (t.nome_franqueado ?? '').trim() !== franqueadoFiltro) return false;
    if (etapaFiltro !== 'todas' && (t.etapa_painel ?? '').trim() !== etapaFiltro) return false;
    const buscaNorm = normalizarParaBusca(busca);
    if (!buscaNorm) return true;
    const texto = [t.numero_franquia, t.nome_franqueado, t.nome_condominio].filter(Boolean).join(' ') || '';
    return normalizarParaBusca(texto).includes(buscaNorm);
  });

  const tarefasOrdenadas = (() => {
    const copy = [...tarefasFiltradas];
    const parsePrazo = (v: string | null) => {
      if (!v) return Number.POSITIVE_INFINITY;
      // esperado: DD/MM/YYYY
      const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) {
        const [, dd, mm, yyyy] = m;
        const d = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
        const time = d.getTime();
        return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
      }
      // fallback: pode ser ISO
      const d = new Date(v);
      const time = d.getTime();
      return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
    };
    const keyResp = (t: Tarefa) => (t.responsavel_nome?.trim() ? t.responsavel_nome.trim() : 'Sem responsável');
    copy.sort((a, b) => {
      if (ordenacao === 'responsavel') {
        const ra = keyResp(a);
        const rb = keyResp(b);
        const c1 = ra.localeCompare(rb, 'pt-BR', { sensitivity: 'base' });
        if (c1 !== 0) return c1;
        return parsePrazo(a.prazo) - parsePrazo(b.prazo);
      }
      // ordenação por prazo: grupo fica na ordem da primeira tarefa (menor prazo)
      const c1 = parsePrazo(a.prazo) - parsePrazo(b.prazo);
      if (c1 !== 0) return c1;
      return keyResp(a).localeCompare(keyResp(b), 'pt-BR', { sensitivity: 'base' });
    });
    return copy;
  })();

  const agrupadas = tarefasOrdenadas.reduce(
    (acc, t) => {
      const key =
        ordenacao === 'prazo'
          ? t.prazo?.trim() || 'Sem prazo'
          : t.responsavel_nome?.trim() || 'Sem responsável';
      const list = acc[key] ?? [];
      list.push(t);
      acc[key] = list;
      return acc;
    },
    {} as Record<string, Tarefa[]>,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por Nº franquia, franqueado ou condomínio"
            className="w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3 text-sm text-stone-800 placeholder:text-stone-400 focus:border-moni-primary focus:outline-none focus:ring-1 focus:ring-moni-primary"
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-600">Time</span>
            <select
              value={timeFiltro}
              onChange={(e) => setTimeFiltro(e.target.value)}
              className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700"
            >
              <option value="todos">Todos</option>
              {timesDisponiveis.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-600">Franqueado</span>
            <select
              value={franqueadoFiltro}
              onChange={(e) => setFranqueadoFiltro(e.target.value)}
              className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700"
            >
              <option value="todos">Todos</option>
              {franqueadosDisponiveis.map((franqueado) => (
                <option key={franqueado} value={franqueado}>
                  {franqueado}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-600">Etapa</span>
            <select
              value={etapaFiltro}
              onChange={(e) => setEtapaFiltro(e.target.value)}
              className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700"
            >
              <option value="todas">Todas</option>
              {etapasDisponiveis.map((etapa) => (
                <option key={etapa} value={etapa}>
                  {etapaLabel(etapa)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-600">Status</span>
            <select
              value={statusFiltro}
              onChange={(e) =>
                setStatusFiltro(e.target.value as 'todas' | 'nao_iniciada' | 'em_andamento' | 'concluido')
              }
              className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700"
            >
              <option value="todas">Todas</option>
              <option value="nao_iniciada">Não iniciadas</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluido">Concluídas</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-600">Tag</span>
            <select
              value={tagFiltro}
              onChange={(e) => setTagFiltro(e.target.value as 'todas' | 'atrasado' | 'atencao')}
              className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700"
            >
              <option value="todas">Todas</option>
              <option value="atrasado">Atrasado</option>
              <option value="atencao">Atenção</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-600">Ordenar</span>
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value as 'responsavel' | 'prazo')}
              className="rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700"
            >
              <option value="responsavel">por responsável</option>
              <option value="prazo">por prazo</option>
            </select>
          </div>
        </div>
      </div>

      {tarefasFiltradas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-stone-500">
          Nenhuma tarefa encontrada.
        </p>
      ) : (
        <div className="space-y-6">
          {Object.entries(agrupadas).map(([grupo, list]) => (
            <div key={grupo} className="rounded-xl border border-stone-200 bg-white p-4">
              <p className="text-sm font-semibold text-stone-800">
                {ordenacao === 'prazo' ? `Prazo: ${grupo}` : grupo}
              </p>
              <ul className="mt-3 space-y-2">
                {list.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-800">{t.titulo}</p>
                      <p className="text-xs text-stone-500">
                        {etapaLabel(t.etapa_painel)}
                        {ordenacao === 'responsavel' && t.prazo ? ` · Prazo ${t.prazo}` : ''}
                      </p>
                      {ordenacao === 'prazo' ? (
                        <p className="text-[11px] text-stone-600">
                          Time: {t.time_nome?.trim() || '—'} ·{' '}
                          Responsável: {t.responsavel_nome?.trim() || 'Sem responsável'}
                        </p>
                      ) : (
                        <p className="text-[11px] text-stone-600">
                          Time: {t.time_nome?.trim() || '—'}
                        </p>
                      )}
                      <span className="ml-2 mt-1 inline-block rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
                        {t.status === 'nao_iniciada' ? 'Não iniciada' : t.status === 'em_andamento' ? 'Em andamento' : 'Concluída'}
                      </span>
                      {getPrazoTag(t.prazo, t.status) === 'atrasado' && (
                        <span className="ml-2 mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800">
                          Atrasado
                        </span>
                      )}
                      {getPrazoTag(t.prazo, t.status) === 'atencao' && (
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
