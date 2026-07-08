'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';

type Atividade = {
  id: string;
  card_id: string | null;
  chamado_numero: number | null;
  card_titulo: string | null;
  kanban_nome: string;
  kanban_id: string;
  responsavel_id: string | null;
  responsaveis_ids: string[];
  responsavel_nome: string | null;
  tipo: string;
  titulo: string;
  descricao: string | null;
  atividade_status: string;
  data_vencimento: string | null;
  time_nome: string | null;
  franqueado_nome: string | null;
  criado_em: string;
  sla_status: string | null;
  fase_nome: string | null;
  diffDias: number | null;
  urgencia: 'atrasado' | 'alerta' | 'ok' | 'sem_prazo';
  especial: boolean;
  origemDado: 'kanban' | 'sirene';
  /** Sirene only: incendio/tipo do chamado pai — usado no sub-header do agrupamento 3 níveis. */
  chamado_titulo?: string | null;
};

type Stats = { atrasadas: number; alerta: number; total: number; especial: number };

type Props = {
  atividades: Atividade[];
  stats: Stats;
  currentUserId: string;
  isAdmin: boolean;
  searchParams?: { visao?: string; funil?: string; card?: string; prazo?: string; tag?: string; resp?: string };
};

function PrazoTag({ urgencia, diffDias }: { urgencia: string; diffDias: number | null }) {
  if (diffDias === null) return null;
  if (urgencia === 'atrasado') return <span className="inline-flex items-center rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">Atrasado {Math.abs(diffDias)} d.u.</span>;
  if (urgencia === 'alerta') return <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Vence em {diffDias} d.u.</span>;
  return <span className="inline-flex items-center rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Vence em {diffDias} d.u.</span>;
}

function StatusTag({ status }: { status: string }) {
  if (status === 'concluido' || status === 'aprovado' || status === 'concluida') return <span className="inline-flex items-center rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Concluído</span>;
  if (status === 'em_andamento') return <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">Em andamento</span>;
  if (status === 'pendente') return <span className="inline-flex items-center rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">A fazer</span>;
  return <span className="inline-flex items-center rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] font-medium text-stone-600">{status}</span>;
}

export function RelatorioConteudo({ atividades, stats, currentUserId, isAdmin, searchParams }: Props) {
  const [visao, setVisao] = useState<'atividade' | 'chamado' | 'card'>(
    searchParams?.visao === 'atividade' ? 'atividade' : searchParams?.visao === 'card' ? 'card' : 'chamado'
  );
  const [filtroResp, setFiltroResp] = useState(searchParams?.resp ?? 'todos');
  const [filtroFunil, setFiltroFunil] = useState(searchParams?.funil ?? 'todos');
  const [filtroCard, setFiltroCard] = useState(searchParams?.card ?? 'todos');
  const [filtroPrazo, setFiltroPrazo] = useState(searchParams?.prazo ?? 'todos');
  const [filtroTag, setFiltroTag] = useState(searchParams?.tag ?? 'todos');
  const [filtroSituacao, setFiltroSituacao] = useState('aberto');
  const [filtroOrigem, setFiltroOrigem] = useState('todos');

  const funis = useMemo(() => [...new Set(atividades.map((a) => a.kanban_nome))].sort(), [atividades]);
  // Dropdown de cards: chave = card_id (UUID estável), label = card_titulo — exclui nulos (chamados diretos sem card)
  const cards = useMemo(() => {
    const base = filtroFunil === 'todos' ? atividades : atividades.filter((a) => a.kanban_nome === filtroFunil);
    const seen = new Map<string, string>();
    for (const a of base) {
      if (a.card_id && !seen.has(a.card_id)) {
        seen.set(a.card_id, a.card_titulo ?? a.card_id);
      }
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  }, [atividades, filtroFunil]);

  const filtradas = useMemo(() => {
    return atividades.filter((a) => {
      if (filtroResp === 'minhas' && a.responsavel_id !== currentUserId && !a.responsaveis_ids.includes(currentUserId)) return false;
      if (filtroFunil !== 'todos' && a.kanban_nome !== filtroFunil) return false;
      if (filtroCard !== 'todos' && a.card_id !== filtroCard) return false;
      if (filtroTag === 'especial' && !a.especial) return false;
      if (filtroPrazo === 'atrasado' && a.urgencia !== 'atrasado') return false;
      if (filtroPrazo === 'alerta' && a.urgencia !== 'alerta') return false;
      if (filtroPrazo === 'sem_prazo' && a.urgencia !== 'sem_prazo') return false;
      if (filtroSituacao === 'aberto' && (a.atividade_status === 'concluido' || a.atividade_status === 'concluida' || a.atividade_status === 'aprovado')) return false;
      if (filtroSituacao === 'concluido' && a.atividade_status !== 'concluido' && a.atividade_status !== 'concluida' && a.atividade_status !== 'aprovado') return false;
      if (filtroOrigem !== 'todos' && a.origemDado !== filtroOrigem) return false;
      return true;
    });
  }, [atividades, filtroResp, filtroFunil, filtroCard, filtroTag, filtroPrazo, filtroSituacao, filtroOrigem, currentUserId]);

  const atrasadas = filtradas.filter((a) => a.urgencia === 'atrasado');
  const alerta = filtradas.filter((a) => a.urgencia === 'alerta');
  const ok = filtradas.filter((a) => a.urgencia === 'ok' || a.urgencia === 'sem_prazo');

  // Visão "Por card": Card → Chamado(s) → Atividades (3 níveis)
  const porCard = useMemo(() => {
    type ChamadoGroup = { chamadoNumero: number | null; chamadoTitulo: string | null; atividades: Atividade[] };
    type CardGroup = { cardKey: string; cardId: string | null; cardTitulo: string | null; kanbanNome: string; kanbanId: string; especial: boolean; chamados: ChamadoGroup[] };

    const byCard = new Map<string, { cardId: string | null; cardTitulo: string | null; kanbanNome: string; kanbanId: string; especial: boolean; items: Atividade[] }>();

    for (const a of filtradas) {
      const cardKey = a.card_id
        ?? (a.origemDado === 'sirene' && a.chamado_numero != null ? `sirene-direto-${a.chamado_numero}` : a.card_titulo ?? 'sem-card');
      if (!byCard.has(cardKey)) {
        byCard.set(cardKey, { cardId: a.card_id, cardTitulo: a.card_titulo, kanbanNome: a.kanban_nome, kanbanId: a.kanban_id, especial: false, items: [] });
      }
      const entry = byCard.get(cardKey)!;
      entry.items.push(a);
      if (a.especial) entry.especial = true;
    }

    const result: CardGroup[] = [];
    for (const [cardKey, cardData] of byCard.entries()) {
      const byChamado = new Map<string, ChamadoGroup>();
      for (const a of cardData.items) {
        const chKey = a.chamado_numero != null ? `${a.chamado_numero}` : 'kanban';
        if (!byChamado.has(chKey)) {
          byChamado.set(chKey, { chamadoNumero: a.chamado_numero, chamadoTitulo: a.chamado_titulo ?? null, atividades: [] });
        }
        byChamado.get(chKey)!.atividades.push(a);
      }
      result.push({ cardKey, cardId: cardData.cardId, cardTitulo: cardData.cardTitulo, kanbanNome: cardData.kanbanNome, kanbanId: cardData.kanbanId, especial: cardData.especial, chamados: [...byChamado.values()] });
    }
    return result;
  }, [filtradas]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 grid grid-cols-4 gap-3">
        {[
          { num: stats.atrasadas, label: 'Atividades atrasadas', color: 'text-red-600' },
          { num: stats.alerta, label: 'Vencem em ≤3 d.u.', color: 'text-amber-600' },
          { num: stats.total, label: 'Atividades abertas', color: '' },
          { num: stats.especial, label: 'Cards especiais', color: 'text-green-700' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-stone-50 p-3">
            <div className={`text-xl font-medium ${s.color}`}>{s.num}</div>
            <div className="mt-1 text-[11px] text-stone-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={filtroResp} onChange={(e) => setFiltroResp(e.target.value)} className="h-8 rounded border border-stone-300 bg-white px-2 text-xs text-stone-700">
          <option value="todos">Todos</option>
          <option value="minhas">Minhas atividades</option>
        </select>
        <select value={filtroFunil} onChange={(e) => { setFiltroFunil(e.target.value); setFiltroCard('todos'); }} className="h-8 rounded border border-stone-300 bg-white px-2 text-xs text-stone-700">
          <option value="todos">Todos os funis</option>
          {funis.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filtroCard} onChange={(e) => setFiltroCard(e.target.value)} className="h-8 rounded border border-stone-300 bg-white px-2 text-xs text-stone-700">
          <option value="todos">Todos os cards</option>
          {cards.map(([id, titulo]) => <option key={id} value={id}>{titulo}</option>)}
        </select>
        <select value={filtroPrazo} onChange={(e) => setFiltroPrazo(e.target.value)} className="h-8 rounded border border-stone-300 bg-white px-2 text-xs text-stone-700">
          <option value="todos">Qualquer prazo</option>
          <option value="atrasado">Atrasadas</option>
          <option value="alerta">Vence em 3 d.u.</option>
          <option value="sem_prazo">Sem prazo</option>
        </select>
        <select value={filtroTag} onChange={(e) => setFiltroTag(e.target.value)} className="h-8 rounded border border-stone-300 bg-white px-2 text-xs text-stone-700">
          <option value="todos">Todas as tags</option>
          <option value="especial">⭐ Especial</option>
        </select>
        <select value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value)} className="h-8 rounded border border-stone-300 bg-white px-2 text-xs text-stone-700">
          <option value="aberto">Em aberto</option>
          <option value="concluido">Concluídas</option>
          <option value="todos">Todas</option>
        </select>
        <select value={filtroOrigem} onChange={(e) => { setFiltroOrigem(e.target.value); setFiltroFunil('todos'); setFiltroCard('todos'); }} className="h-8 rounded border border-stone-300 bg-white px-2 text-xs text-stone-700">
          <option value="todos">Atividades + Chamados</option>
          <option value="kanban">Só atividades do card</option>
          <option value="sirene">Só chamados Sirene</option>
        </select>
        <div className="ml-auto flex overflow-hidden rounded border border-stone-300">
          <button type="button" onClick={() => setVisao('atividade')} className={`px-3 py-1 text-xs ${visao === 'atividade' ? 'bg-stone-100 font-medium text-stone-800' : 'bg-white text-stone-500'}`}>Por atividade</button>
          <button type="button" onClick={() => setVisao('chamado')} className={`border-l border-stone-300 px-3 py-1 text-xs ${visao === 'chamado' ? 'bg-stone-100 font-medium text-stone-800' : 'bg-white text-stone-500'}`}>Por chamado</button>
          <button type="button" onClick={() => setVisao('card')} className={`border-l border-stone-300 px-3 py-1 text-xs ${visao === 'card' ? 'bg-stone-100 font-medium text-stone-800' : 'bg-white text-stone-500'}`}>Por card</button>
        </div>
      </div>

      <div className="mb-3 text-[11px] text-stone-500">{filtradas.length} atividades</div>

      {visao === 'atividade' ? (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-stone-50">
                <th className="border-b border-stone-200 px-3 py-2 text-left font-medium text-stone-500">Atividade</th>
                <th className="border-b border-stone-200 px-3 py-2 text-left font-medium text-stone-500">Chamado / Card</th>
                <th className="border-b border-stone-200 px-3 py-2 text-left font-medium text-stone-500">Funil</th>
                <th className="border-b border-stone-200 px-3 py-2 text-left font-medium text-stone-500">Aberto por</th>
                <th className="border-b border-stone-200 px-3 py-2 text-left font-medium text-stone-500">Responsável</th>
                <th className="border-b border-stone-200 px-3 py-2 text-left font-medium text-stone-500">Prazo</th>
                <th className="border-b border-stone-200 px-3 py-2 text-left font-medium text-stone-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {[...atrasadas, ...alerta, ...ok].map((a) => (
                <tr key={a.id} className="border-b border-stone-100 hover:bg-stone-50">
                  <td className={`px-3 py-2.5 ${a.urgencia === 'atrasado' ? 'border-l-2 border-l-red-400' : a.urgencia === 'alerta' ? 'border-l-2 border-l-amber-400' : 'border-l-2 border-l-green-400'}`}>
                    <div className="font-medium text-stone-800">{a.titulo}</div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {a.especial && <span className="rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-700">⭐ Especial</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    {a.chamado_numero && a.card_id
                      ? <Link href={hrefAbrirCardKanban(a.kanban_nome, a.card_id)} className="mr-1 text-[10px] text-blue-600 hover:underline">#{a.chamado_numero}</Link>
                      : a.chamado_numero
                        ? <span className="mr-1 text-[10px] text-stone-400">#{a.chamado_numero}</span>
                        : null}
                    <span className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-600">
                      {a.origemDado === 'sirene' ? (a.chamado_titulo ?? a.card_titulo ?? '—') : (a.card_titulo ?? '—')}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-stone-600">{a.kanban_nome}</td>
                  <td className="px-3 py-2.5 text-stone-600">{a.franqueado_nome ?? '—'}</td>
                  <td className="px-3 py-2.5 text-stone-600">{a.responsavel_nome ?? '—'}</td>
                  <td className="px-3 py-2.5"><PrazoTag urgencia={a.urgencia} diffDias={a.diffDias} /></td>
                  <td className="px-3 py-2.5"><StatusTag status={a.atividade_status} /></td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-stone-400">Nenhuma atividade com os filtros atuais.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : visao === 'card' ? (
        <div className="space-y-2">
          {porCard.map((card) => {
            const totalAtivs = card.chamados.reduce((s, c) => s + c.atividades.length, 0);
            return (
              <div key={card.cardKey} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                {/* Nível 1 — Card */}
                <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-2.5">
                  {card.cardId ? (
                    <Link href={hrefAbrirCardKanban(card.kanbanNome, card.cardId)} className="text-sm font-semibold text-blue-600 hover:underline">
                      {card.cardTitulo ?? '—'}
                    </Link>
                  ) : card.chamados[0]?.chamadoNumero != null ? (
                    <span className="text-sm font-semibold text-stone-700">
                      #{card.chamados[0].chamadoNumero}
                      <span className="ml-1 text-xs font-normal text-stone-400">(chamado direto)</span>
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-stone-700">{card.cardTitulo ?? '—'}</span>
                  )}
                  {card.kanbanNome && card.kanbanNome !== 'Sirene' && (
                    <><span className="text-stone-400">·</span><span className="text-xs text-stone-500">{card.kanbanNome}</span></>
                  )}
                  {card.especial && <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">⭐ Especial</span>}
                  <span className="ml-auto text-xs text-stone-400">{totalAtivs} atividade{totalAtivs !== 1 ? 's' : ''}</span>
                </div>
                {/* Níveis 2 e 3 */}
                {card.chamados.map((ch) => {
                  const comNivel2 = ch.chamadoNumero != null && card.cardId != null;
                  return comNivel2 ? (
                    <div key={`ch-${ch.chamadoNumero}`}>
                      {/* Nível 2 — Chamado sub-header */}
                      <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 bg-stone-50 px-6 py-1.5">
                        <span className="text-xs font-semibold text-stone-600">#{ch.chamadoNumero}</span>
                        {ch.chamadoTitulo && <span className="text-xs text-stone-500">{ch.chamadoTitulo}</span>}
                        <span className="ml-auto text-[10px] text-stone-400">{ch.atividades.length} atividade{ch.atividades.length !== 1 ? 's' : ''}</span>
                      </div>
                      {/* Nível 3 — Atividades */}
                      <div className="divide-y divide-stone-100">
                        {ch.atividades.map((a) => (
                          <div key={a.id} className="flex flex-wrap items-center gap-2 px-8 py-2 text-xs">
                            <PrazoTag urgencia={a.urgencia} diffDias={a.diffDias} />
                            <span className="flex-1 font-medium text-stone-700">{a.titulo}</span>
                            {a.especial && <span className="rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-700">⭐</span>}
                            <span className="text-stone-500">{a.responsavel_nome ?? '—'}</span>
                            <StatusTag status={a.atividade_status} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    // Sem nível 2: chamado direto ou atividade kanban pura
                    <div key={`direct-${ch.chamadoNumero ?? 'kanban'}`} className="divide-y divide-stone-100">
                      {ch.atividades.map((a) => (
                        <div key={a.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs">
                          <PrazoTag urgencia={a.urgencia} diffDias={a.diffDias} />
                          <span className="flex-1 font-medium text-stone-700">{a.titulo}</span>
                          {a.especial && <span className="rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-700">⭐</span>}
                          <span className="text-stone-500">{a.responsavel_nome ?? '—'}</span>
                          <StatusTag status={a.atividade_status} />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {filtradas.length === 0 && (
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400">Nenhuma atividade com os filtros atuais.</div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(
            filtradas.reduce<Record<string, Atividade[]>>((acc, a) => {
              // Sirene: chamado pai é sempre a unidade de agrupamento (nunca card_id)
              // Kanban/legado: agrupa por card
              const key = a.origemDado === 'sirene' && a.chamado_numero != null
                ? `chamado-${a.chamado_numero}`
                : a.card_id ?? a.card_titulo ?? 'sem-id';
              if (!acc[key]) acc[key] = [];
              acc[key].push(a);
              return acc;
            }, {})
          ).map(([, ativs]) => {
            const isSirene = ativs[0]?.origemDado === 'sirene';
            const temEspecial = ativs.some(a => a.especial);

            if (isSirene) {
              const ref = ativs[0]!;
              const funil = ref.kanban_nome !== 'Sirene' ? ref.kanban_nome : null;
              return (
                <div key={`chamado-${ref.chamado_numero ?? ref.id}`} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  {/* Chamado pai — cabeçalho */}
                  <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-2.5">
                    {ref.chamado_numero && ref.card_id
                      ? <Link href={hrefAbrirCardKanban(ref.kanban_nome, ref.card_id)} className="text-sm font-semibold text-blue-600 hover:underline">#{ref.chamado_numero}</Link>
                      : ref.chamado_numero
                        ? <span className="text-sm font-semibold text-stone-700">#{ref.chamado_numero}</span>
                        : null}
                    {ref.chamado_titulo && (
                      <span className="font-medium text-stone-800">{ref.chamado_titulo}</span>
                    )}
                    {temEspecial && <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">⭐ Especial</span>}
                    {funil && <><span className="text-stone-400">·</span><span className="text-xs text-stone-500">{funil}</span></>}
                    <span className="ml-auto text-xs text-stone-400">{ativs.length} atividade{ativs.length !== 1 ? 's' : ''}</span>
                  </div>
                  {/* Atividades filhos */}
                  <div className="divide-y divide-stone-100">
                    {ativs.map((a) => (
                      <div key={a.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs">
                        <PrazoTag urgencia={a.urgencia} diffDias={a.diffDias} />
                        <span className="flex-1 font-medium text-stone-700">{a.titulo}</span>
                        {a.especial && <span className="rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-700">⭐</span>}
                        <span className="text-stone-500">{a.responsavel_nome ?? '—'}</span>
                        <StatusTag status={a.atividade_status} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            // Kanban/legado: 1 bloco por card
            const cardTitulo = ativs[0]?.card_titulo ?? '—';
            const kanbanNome = ativs[0]?.kanban_nome ?? '';
            return (
              <div key={ativs[0]?.card_id ?? cardTitulo} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-2.5">
                  <span className="font-medium text-stone-800">{cardTitulo}</span>
                  <span className="text-stone-400">·</span>
                  <span className="text-xs text-stone-500">{kanbanNome}</span>
                  {temEspecial && <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">⭐ Especial</span>}
                  <span className="ml-auto text-xs text-stone-400">{ativs.length} atividade{ativs.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-stone-100">
                  {ativs.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs">
                      <PrazoTag urgencia={a.urgencia} diffDias={a.diffDias} />
                      <span className="flex-1 font-medium text-stone-700">{a.titulo}</span>
                      <span className="text-stone-500">{a.responsavel_nome ?? '—'}</span>
                      <StatusTag status={a.atividade_status} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {filtradas.length === 0 && (
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-400">Nenhuma atividade com os filtros atuais.</div>
          )}
        </div>
      )}
    </div>
  );
}
