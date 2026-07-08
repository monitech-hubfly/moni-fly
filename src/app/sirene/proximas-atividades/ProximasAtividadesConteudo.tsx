'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  classificarProximaAtividadeTier,
  sortKanbanCardsPorProximaAtividade,
  type ProximaAtividadeTier,
} from '@/lib/kanban/kanban-proxima-atividade-ordem';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';

type CardRow = {
  id: string;
  titulo: string;
  proxima_atividade: string | null;
  prazo_atividade: string | null;
  franqueado_id: string | null;
  franqueado_nome: string | null;
  kanban_id: string;
  kanban_nome: string;
  fase_nome: string | null;
  especial: boolean;
};

type Props = {
  cards: CardRow[];
};

function ProximaAtividadeTag({ tier, prazo }: { tier: ProximaAtividadeTier; prazo: string | null }) {
  if (tier === 'sem_atividade') return null;
  if (tier === 'atrasada') {
    const hoje = new Date().toISOString().slice(0, 10);
    const dias = prazo
      ? Math.round((new Date(hoje).getTime() - new Date(prazo).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    return (
      <span className="inline-flex items-center rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
        Atrasada{dias > 0 ? ` ${dias}d` : ''}
      </span>
    );
  }
  if (tier === 'hoje') {
    return (
      <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
        Vence hoje
      </span>
    );
  }
  if (tier === 'futura' && prazo) {
    const [y, m, d] = prazo.split('-');
    return (
      <span className="inline-flex items-center rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
        {`${d}/${m}/${y}`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-500">
      Sem prazo
    </span>
  );
}

export function ProximasAtividadesConteudo({ cards }: Props) {
  const [filtroFunil, setFiltroFunil] = useState('todos');
  const [filtroPrazo, setFiltroPrazo] = useState('todos');
  const [filtroTag, setFiltroTag] = useState('todos');
  const [incluirSirene, setIncluirSirene] = useState(false);

  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const funis = useMemo(() => {
    const base = incluirSirene ? cards : cards.filter(c => c.kanban_nome !== 'Sirene');
    return [...new Set(base.map(c => c.kanban_nome))].sort();
  }, [cards, incluirSirene]);

  const filtradas = useMemo(() => {
    return cards.filter(c => {
      if (!incluirSirene && c.kanban_nome === 'Sirene') return false;
      if (filtroFunil !== 'todos' && c.kanban_nome !== filtroFunil) return false;
      if (filtroTag === 'especial' && !c.especial) return false;
      if (filtroPrazo !== 'todos') {
        const tier = classificarProximaAtividadeTier(c.proxima_atividade, c.prazo_atividade, hoje);
        if (filtroPrazo === 'atrasada' && tier !== 'atrasada') return false;
        if (filtroPrazo === 'hoje' && tier !== 'hoje') return false;
        if (filtroPrazo === 'futura' && (tier !== 'futura' || !c.prazo_atividade)) return false;
        if (filtroPrazo === 'sem_prazo' && (tier !== 'futura' || c.prazo_atividade != null)) return false;
      }
      return true;
    });
  }, [cards, filtroFunil, filtroPrazo, filtroTag, incluirSirene, hoje]);

  const ordenadas = useMemo(() => sortKanbanCardsPorProximaAtividade(filtradas), [filtradas]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={filtroFunil}
          onChange={e => setFiltroFunil(e.target.value)}
          className="h-8 rounded border border-stone-300 bg-white px-2 text-xs text-stone-700"
        >
          <option value="todos">Todos os funis</option>
          {funis.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={filtroPrazo}
          onChange={e => setFiltroPrazo(e.target.value)}
          className="h-8 rounded border border-stone-300 bg-white px-2 text-xs text-stone-700"
        >
          <option value="todos">Qualquer prazo</option>
          <option value="atrasada">Atrasadas</option>
          <option value="hoje">Vence hoje</option>
          <option value="futura">Futuras (com prazo)</option>
          <option value="sem_prazo">Sem prazo definido</option>
        </select>
        <select
          value={filtroTag}
          onChange={e => setFiltroTag(e.target.value)}
          className="h-8 rounded border border-stone-300 bg-white px-2 text-xs text-stone-700"
        >
          <option value="todos">Todas as tags</option>
          <option value="especial">⭐ Especial</option>
        </select>
        <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded border border-stone-300 bg-white px-2 text-xs text-stone-700">
          <input
            type="checkbox"
            checked={incluirSirene}
            onChange={e => { setIncluirSirene(e.target.checked); setFiltroFunil('todos'); }}
            className="h-3.5 w-3.5 rounded border-stone-300"
          />
          Incluir Sirene
        </label>
      </div>

      <div className="mb-3 text-[11px] text-stone-500">{ordenadas.length} card{ordenadas.length !== 1 ? 's' : ''}</div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-stone-50">
              <th className="border-b border-stone-200 px-3 py-2 text-left font-medium text-stone-500">Card</th>
              <th className="border-b border-stone-200 px-3 py-2 text-left font-medium text-stone-500">Funil / Fase</th>
              <th className="border-b border-stone-200 px-3 py-2 text-left font-medium text-stone-500">Próxima Atividade</th>
              <th className="border-b border-stone-200 px-3 py-2 text-left font-medium text-stone-500">Prazo</th>
              <th className="border-b border-stone-200 px-3 py-2 text-left font-medium text-stone-500">Responsável</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map(c => {
              const tier = classificarProximaAtividadeTier(c.proxima_atividade, c.prazo_atividade, hoje);
              const borderCls =
                tier === 'atrasada' ? 'border-l-2 border-l-red-400' :
                tier === 'hoje' ? 'border-l-2 border-l-amber-400' :
                'border-l-2 border-l-stone-200';
              return (
                <tr key={c.id} className="border-b border-stone-100 hover:bg-stone-50">
                  <td className={`px-3 py-2.5 ${borderCls}`}>
                    <Link
                      href={hrefAbrirCardKanban(c.kanban_nome, c.id)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {c.titulo}
                    </Link>
                    {c.especial && (
                      <span className="ml-1 rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-700">
                        ⭐
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-stone-700">{c.kanban_nome}</div>
                    {c.fase_nome && (
                      <div className="text-[10px] text-stone-400">{c.fase_nome}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-stone-700">{c.proxima_atividade}</td>
                  <td className="px-3 py-2.5">
                    <ProximaAtividadeTag tier={tier} prazo={c.prazo_atividade} />
                  </td>
                  <td className="px-3 py-2.5 text-stone-600">{c.franqueado_nome ?? '—'}</td>
                </tr>
              );
            })}
            {ordenadas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-stone-400">
                  Nenhum card com próxima atividade nos filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
