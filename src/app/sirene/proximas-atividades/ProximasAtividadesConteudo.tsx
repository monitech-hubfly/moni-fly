'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { listarComentariosKanbanCard, type KanbanComentarioListItem } from '@/lib/actions/kanban-comentarios';
import { ComentarioConteudoHtml } from '@/components/kanban-shared/ComentarioConteudoHtml';
import {
  classificarProximaAtividadeTier,
  sortKanbanCardsPorProximaAtividade,
  type ProximaAtividadeTier,
} from '@/lib/kanban/kanban-proxima-atividade-ordem';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import {
  buscarProximaAtividadeHistorico,
  buscarChamadosDosCards,
  buscarAtividadesConcluidasCards,
  type HistoricoAtividadeItem,
  type ChamadoCardItem,
} from '@/lib/actions/card-actions';

type CardRow = {
  id: string;
  titulo: string;
  atividades: { id: string; descricao: string; prazo: string | null }[];
  franqueado_id: string | null;
  franqueado_nome: string | null;
  kanban_id: string;
  kanban_nome: string;
  fase_nome: string | null;
  especial: boolean;
  comentarios_count: number;
};

type Props = {
  cards: CardRow[];
  kanbanNames: string[];
};

// Alinhado com ProximaAtividadeDot: vermelho=atrasada, verde=hoje, cinza=futura, oculto=sem_atividade
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
      <span className="inline-flex items-center rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
        Vence hoje
      </span>
    );
  }
  if (tier === 'futura' && prazo) {
    const [y, m, d] = prazo.split('-');
    return (
      <span className="inline-flex items-center rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-600">
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

function tierCard(atividades: { descricao: string; prazo: string | null }[], hoje: string): ProximaAtividadeTier {
  if (atividades.length === 0) return 'sem_atividade';
  const tiers = atividades.map(a => classificarProximaAtividadeTier(a.descricao, a.prazo, hoje));
  if (tiers.includes('atrasada')) return 'atrasada';
  if (tiers.includes('hoje')) return 'hoje';
  if (tiers.includes('futura')) return 'futura';
  return 'sem_atividade';
}

function labelStatusChamado(status: string): string {
  if (status === 'concluido') return 'Concluído';
  if (status === 'em_andamento') return 'Em andamento';
  return 'Não iniciado';
}

function corStatusChamado(status: string): string {
  if (status === 'concluido') return 'text-green-700 bg-green-50 border-green-200';
  if (status === 'em_andamento') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-stone-500 bg-stone-50 border-stone-200';
}

export function ProximasAtividadesConteudo({ cards, kanbanNames }: Props) {
  const [filtroFunil, setFiltroFunil] = useState('todos');
  const [filtroPrazo, setFiltroPrazo] = useState('todos');
  const [filtroTag, setFiltroTag] = useState('todos');

  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);
  const [mostrarChamados, setMostrarChamados] = useState(false);

  const [historico, setHistorico] = useState<HistoricoAtividadeItem[]>([]);
  const [chamadosPorCard, setChamadosPorCard] = useState<Map<string, ChamadoCardItem[]>>(new Map());
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [loadingChamados, setLoadingChamados] = useState(false);

  const [chamadosExpandidos, setChamadosExpandidos] = useState<Set<string>>(new Set());

  function toggleChamadoExpansao(cardId: string) {
    setChamadosExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  const [comentariosAbertos, setComentariosAbertos] = useState<string | null>(null);
  const [comentariosPorCard, setComentariosPorCard] = useState<Map<string, KanbanComentarioListItem[]>>(new Map());
  const [loadingComentarios, setLoadingComentarios] = useState<string | null>(null);

  const hoje = new Date().toISOString().slice(0, 10);

  const filtradas = cards.filter(c => {
    if (filtroFunil !== 'todos' && c.kanban_nome !== filtroFunil) return false;
    if (filtroTag === 'especial' && !c.especial) return false;
    if (filtroPrazo !== 'todos') {
      const tier = tierCard(c.atividades, hoje);
      if (filtroPrazo === 'atrasada' && tier !== 'atrasada') return false;
      if (filtroPrazo === 'hoje' && tier !== 'hoje') return false;
      if (filtroPrazo === 'futura' && (tier !== 'futura' || !c.atividades[0]?.prazo)) return false;
      if (filtroPrazo === 'sem_prazo' && (tier !== 'futura' || c.atividades[0]?.prazo != null)) return false;
    }
    return true;
  });

  const ordenadas = sortKanbanCardsPorProximaAtividade(
    filtradas.map(c => ({
      ...c,
      proxima_atividade: c.atividades[0]?.descricao ?? null,
      prazo_atividade: c.atividades[0]?.prazo ?? null,
    }))
  );

  async function handleMostrarConcluidas(checked: boolean) {
    setMostrarConcluidas(checked);
    if (checked && historico.length === 0) {
      setLoadingHistorico(true);
      const [legado, novas] = await Promise.all([
        buscarProximaAtividadeHistorico(),
        buscarAtividadesConcluidasCards(cards.map(c => c.id)),
      ]);
      const novasComoHistorico: HistoricoAtividadeItem[] = novas.map(a => ({
        id: a.id,
        card_id: a.card_id,
        card_titulo: cards.find(c => c.id === a.card_id)?.titulo ?? '—',
        kanban_nome: cards.find(c => c.id === a.card_id)?.kanban_nome ?? '',
        descricao: a.descricao,
        prazo_original: a.prazo,
        concluido_em: a.concluido_em,
      }));
      const unified = [...legado, ...novasComoHistorico]
        .filter(h => h.concluido_em)
        .sort((a, b) => new Date(b.concluido_em).getTime() - new Date(a.concluido_em).getTime());
      setHistorico(unified);
      setLoadingHistorico(false);
    }
  }

  async function handleMostrarChamados(checked: boolean) {
    setMostrarChamados(checked);
    if (checked && chamadosPorCard.size === 0) {
      setLoadingChamados(true);
      const allCardIds = cards.map(c => c.id);
      const data = await buscarChamadosDosCards(allCardIds);
      const map = new Map<string, ChamadoCardItem[]>();
      data.forEach(ch => {
        const lista = map.get(ch.card_id) ?? [];
        lista.push(ch);
        map.set(ch.card_id, lista);
      });
      setChamadosPorCard(map);
      setLoadingChamados(false);
    }
  }

  async function handleVerComentarios(cardId: string) {
    if (comentariosAbertos === cardId) {
      setComentariosAbertos(null);
      return;
    }
    if (comentariosPorCard.has(cardId)) {
      setComentariosAbertos(cardId);
      return;
    }
    setLoadingComentarios(cardId);
    const res = await listarComentariosKanbanCard(cardId);
    setLoadingComentarios(null);
    if (res.ok) {
      setComentariosPorCard(prev => new Map(prev).set(cardId, res.items));
      setComentariosAbertos(cardId);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Filtros */}
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

        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-stone-600">
          <input
            type="checkbox"
            checked={mostrarChamados}
            onChange={e => handleMostrarChamados(e.target.checked)}
            className="rounded border-stone-300"
          />
          {loadingChamados ? 'Carregando…' : 'Mostrar chamados'}
        </label>

        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-stone-600">
          <input
            type="checkbox"
            checked={mostrarConcluidas}
            onChange={e => handleMostrarConcluidas(e.target.checked)}
            className="rounded border-stone-300"
          />
          {loadingHistorico ? 'Carregando…' : 'Mostrar concluídas'}
        </label>
      </div>

      <div className="mb-3 text-[11px] text-stone-500">{ordenadas.length} card{ordenadas.length !== 1 ? 's' : ''}</div>

      {/* Lista de atividades ativas */}
      <div className="space-y-2">
        {ordenadas.map(c => {
          const chamadosDoCard = mostrarChamados ? (chamadosPorCard.get(c.id) ?? []) : [];
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
              {/* Atividades */}
              {c.atividades.map((a, idx) => {
                const aTier = classificarProximaAtividadeTier(a.descricao, a.prazo, hoje);
                return (
                  <div key={a.id} className={`flex flex-wrap items-center gap-2 px-4 py-2 text-xs${idx > 0 ? ' border-t border-stone-50' : ''}`}>
                    <ProximaAtividadeTag tier={aTier} prazo={a.prazo} />
                    <span className="flex-1 text-stone-700">{a.descricao}</span>
                    {idx === 0 && (
                      <>
                        <span className="text-stone-500">{c.franqueado_nome ?? '—'}</span>
                        {c.comentarios_count > 0 && (
                          <button
                            type="button"
                            onClick={() => void handleVerComentarios(c.id)}
                            title={`${c.comentarios_count} comentário${c.comentarios_count !== 1 ? 's' : ''}`}
                            className="flex items-center gap-1 text-stone-400 hover:text-blue-600 transition-colors"
                          >
                            {loadingComentarios === c.id
                              ? <span className="text-[10px]">…</span>
                              : <><MessageCircle className="h-3.5 w-3.5" /><span className="text-[10px]">{c.comentarios_count}</span></>
                            }
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              {/* Comentários inline */}
              {comentariosAbertos === c.id && (
                <div className="border-t border-stone-100 px-4 py-2">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">Comentários</p>
                  <div className="space-y-2">
                    {(comentariosPorCard.get(c.id) ?? []).map(com => (
                      <div key={com.id} className="text-xs text-stone-700">
                        {com.autor_nome && (
                          <span className="font-medium text-stone-600">{com.autor_nome}: </span>
                        )}
                        <ComentarioConteudoHtml conteudo={com.conteudo} className="inline" />
                        <span className="ml-1.5 text-[10px] text-stone-400">
                          {com.created_at.slice(0, 10).split('-').reverse().join('/')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Chamados vinculados (visível quando checkbox marcada) */}
              {mostrarChamados && chamadosDoCard.length > 0 && (
                <div className="border-t border-stone-100 px-4 py-2">
                  <button
                    type="button"
                    onClick={() => toggleChamadoExpansao(c.id)}
                    className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400 hover:text-stone-600"
                  >
                    <span>{chamadosExpandidos.has(c.id) ? '▼' : '▶'}</span>
                    <span>Chamados Sirene ({chamadosDoCard.length})</span>
                  </button>
                  {chamadosExpandidos.has(c.id) && (
                    <div className="mt-1.5 space-y-1">
                      {chamadosDoCard.map(ch => (
                        <div key={ch.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="font-medium text-stone-700">#{ch.numero}</span>
                          <span className="flex-1 text-stone-600 line-clamp-1">{ch.incendio}</span>
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] ${corStatusChamado(ch.status)}`}>
                            {labelStatusChamado(ch.status)}
                          </span>
                          {ch.data_abertura && (
                            <span className="text-stone-400">
                              {ch.data_abertura.slice(0, 10).split('-').reverse().join('/')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {mostrarChamados && chamadosDoCard.length === 0 && !loadingChamados && (
                <div className="border-t border-stone-100 px-4 py-1.5 text-[11px] text-stone-400">
                  Nenhum chamado em aberto vinculado
                </div>
              )}
            </div>
          );
        })}
        {ordenadas.length === 0 && (
          <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400">
            Nenhum card com próxima atividade nos filtros atuais.
          </div>
        )}
      </div>

      {/* Seção de atividades concluídas (historico) */}
      {mostrarConcluidas && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-stone-600">
            Atividades concluídas ({historico.length})
          </h2>
          {loadingHistorico ? (
            <div className="text-sm text-stone-400">Carregando…</div>
          ) : historico.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-6 text-center text-sm text-stone-400">
              Nenhum registro de atividade concluída ainda.
            </div>
          ) : (
            <div className="space-y-1.5">
              {historico.map(h => {
                const prazoFmt = h.prazo_original
                  ? h.prazo_original.slice(0, 10).split('-').reverse().join('/')
                  : null;
                const concluidoFmt = h.concluido_em.slice(0, 10).split('-').reverse().join('/');
                return (
                  <div key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-100 bg-white px-4 py-2 text-xs">
                    <span className="font-medium text-stone-700 min-w-0 flex-1">{h.descricao}</span>
                    <span className="text-stone-400">{h.card_titulo}</span>
                    <span className="text-stone-300">·</span>
                    <span className="text-stone-400">{h.kanban_nome}</span>
                    {prazoFmt && (
                      <>
                        <span className="text-stone-300">·</span>
                        <span className="text-stone-400">Prazo: {prazoFmt}</span>
                      </>
                    )}
                    <span className="text-stone-300">·</span>
                    <span className="text-stone-500">Concluída {concluidoFmt}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
