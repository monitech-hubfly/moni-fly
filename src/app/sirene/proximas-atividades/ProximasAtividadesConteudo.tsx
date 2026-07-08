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
  kanbanNames: string[];
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

export function ProximasAtividadesConteudo({ cards, kanbanNames }: Props) {
  const [filtroFunil, setFiltroFunil] = useState('todos');
  const [filtroPrazo, setFiltroPrazo] = useState('todos');
  const [filtroTag, setFiltroTag] = useState('todos');

  const hoje = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const filtradas = useMemo(() => {
    return cards.filter(c => {
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
  }, [cards, filtroFunil, filtroPrazo, filtroTag, hoje]);

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
          {kanbanNames.map(nome => (
            <option key={nome} value={nome}>{nome}</option>
          ))}
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
      </div>

      <div className="mb-3 text-[11px] text-stone-500">{ordenadas.length} card{ordenadas.length !== 1 ? 's' : ''}</div>

      <div className="space-y-2">
        {ordenadas.map(c => {
          const tier = classificarProximaAtividadeTier(c.proxima_atividade, c.prazo_atividade, hoje);
          return (
            <div key={c.id} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              {/* Cabeçalho — card */}
              <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-2.5">
                <Link
                  href={hrefAbrirCardKanban(c.kanban_nome, c.id)}
                  className="text-sm font-semibold text-blue-600 hover:underline"
                >
                  {c.titulo}
                </Link>
                {c.especial && (
                  <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    ⭐ Especial
                  </span>
                )}
                <span className="text-stone-400">·</span>
                <span className="text-xs text-stone-500">{c.kanban_nome}</span>
                {c.fase_nome && (
                  <>
                    <span className="text-stone-300">/</span>
                    <span className="text-xs text-stone-400">{c.fase_nome}</span>
                  </>
                )}
              </div>
              {/* Conteúdo — próxima atividade */}
              <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs">
                <ProximaAtividadeTag tier={tier} prazo={c.prazo_atividade} />
                <span className="flex-1 text-stone-700">{c.proxima_atividade}</span>
                <span className="text-stone-500">{c.franqueado_nome ?? '—'}</span>
              </div>
            </div>
          );
        })}
        {ordenadas.length === 0 && (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400">
            Nenhum card com próxima atividade nos filtros atuais.
          </div>
        )}
      </div>
    </div>
  );
}
