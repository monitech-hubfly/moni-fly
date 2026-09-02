'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  adicionarProximaAtividadeItem,
  concluirProximaAtividadeItem,
  buscarAtividadesAbertasCard,
  salvarProximaAtividade,
} from '@/lib/actions/card-actions';
import type { KanbanProximaAtividadeAberta } from './types';

export type ProximaAtividadeBoardSync = {
  proxima_atividade: string | null;
  prazo_atividade: string | null;
  atividadesAbertas?: KanbanProximaAtividadeAberta[];
};

type Props = {
  cardId: string;
  proximaAtividade: string | null;
  prazoAtividade: string | null;
  basePath: string;
  /** Batch do board — evita server action ao abrir o popover. */
  atividadesCache?: KanbanProximaAtividadeAberta[];
  atividadesBatchPronto?: boolean;
  /** Atualiza o card no board sem router.refresh. */
  onBoardSync?: (cardId: string, sync: ProximaAtividadeBoardSync) => void;
};

function varianteDot(prazo: string | null): 'gray' | 'green' | 'red' {
  if (!prazo) return 'gray';
  const hoje = new Date().toISOString().slice(0, 10);
  if (prazo < hoje) return 'red';
  if (prazo === hoje) return 'green';
  return 'gray';
}

function labelPrazo(prazo: string | null): string {
  if (!prazo) return '';
  const hoje = new Date().toISOString().slice(0, 10);
  const [y, m, d] = prazo.split('-');
  const dataFormatada = `${d}/${m}/${y}`;
  if (prazo < hoje) return `Atrasada · ${dataFormatada}`;
  if (prazo === hoje) return `Vence hoje · ${dataFormatada}`;
  return `Futura · ${dataFormatada}`;
}

type AtividadeAberta = KanbanProximaAtividadeAberta;

function legadoAtividadeAberta(
  proximaAtividade: string | null,
  prazoAtividade: string | null,
): AtividadeAberta[] {
  const descricao = String(proximaAtividade ?? '').trim();
  if (!descricao) return [];
  return [{ id: 'legado', descricao, prazo: prazoAtividade }];
}

function pickProximaFromLista(lista: AtividadeAberta[]): {
  proxima_atividade: string | null;
  prazo_atividade: string | null;
} {
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasadas = lista.filter((a) => a.prazo && a.prazo < hoje);
  const hojeItems = lista.filter((a) => a.prazo === hoje);
  const futuras = lista.filter((a) => !a.prazo || a.prazo > hoje);
  const proxima = [...atrasadas, ...hojeItems, ...futuras][0] ?? null;
  return {
    proxima_atividade: proxima?.descricao ?? null,
    prazo_atividade: proxima?.prazo ?? null,
  };
}

function resolverListaInicial(
  cache: KanbanProximaAtividadeAberta[] | undefined,
  batchPronto: boolean,
  proximaAtividade: string | null,
  prazoAtividade: string | null,
): { lista: AtividadeAberta[]; aguardandoFetch: boolean } {
  const legado = legadoAtividadeAberta(proximaAtividade, prazoAtividade);
  if (cache && cache.length > 0) {
    return { lista: cache, aguardandoFetch: false };
  }
  if (batchPronto) {
    return { lista: legado, aguardandoFetch: false };
  }
  if (legado.length > 0) {
    return { lista: legado, aguardandoFetch: true };
  }
  return { lista: [], aguardandoFetch: true };
}

export function ProximaAtividadeDot({
  cardId,
  proximaAtividade,
  prazoAtividade,
  basePath,
  atividadesCache,
  atividadesBatchPronto = false,
  onBoardSync,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [atividadesAbertas, setAtividadesAbertas] = useState<AtividadeAberta[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [novaAtividade, setNovaAtividade] = useState('');
  const [novoPrazo, setNovoPrazo] = useState('');
  const [confirmarSemProxima, setConfirmarSemProxima] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const dotRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const semAtividade = !proximaAtividade;
  const variante = varianteDot(prazoAtividade);
  const dotCls =
    variante === 'red' ? 'bg-red-500 hover:bg-red-600'
    : variante === 'green' ? 'bg-green-500 hover:bg-green-600'
    : 'bg-stone-400 hover:bg-stone-500';
  const tooltipTitle = semAtividade
    ? 'Próxima atividade não definida'
    : labelPrazo(prazoAtividade) ? `${proximaAtividade} · ${labelPrazo(prazoAtividade)}` : proximaAtividade!;

  function syncBoard(lista: AtividadeAberta[], override?: { proxima_atividade: string | null; prazo_atividade: string | null }) {
    const fields = override ?? pickProximaFromLista(lista);
    onBoardSync?.(cardId, {
      ...fields,
      atividadesAbertas: lista.filter((a) => a.id !== 'legado' && !a.id.startsWith('temp-')),
    });
  }

  useEffect(() => {
    if (!aberto) return;
    const onDown = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        dotRef.current && !dotRef.current.contains(e.target as Node)
      ) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const reposicionar = () => {
      const rect = dotRef.current?.getBoundingClientRect();
      if (!rect) return;
      const popW = 288;
      const left = Math.max(4, Math.min(rect.right - popW, window.innerWidth - popW - 8));
      setPos({ top: rect.top - 8, left });
    };
    reposicionar();
    window.addEventListener('resize', reposicionar);
    window.addEventListener('scroll', reposicionar, true);
    return () => {
      window.removeEventListener('resize', reposicionar);
      window.removeEventListener('scroll', reposicionar, true);
    };
  }, [aberto]);

  /** Quando o batch do board termina, atualiza a lista se o popover estiver aberto. */
  useEffect(() => {
    if (!aberto) return;
    if (busyItemId || adding) return;
    const { lista, aguardandoFetch } = resolverListaInicial(
      atividadesCache,
      atividadesBatchPronto,
      proximaAtividade,
      prazoAtividade,
    );
    setAtividadesAbertas(lista);
    if (!aguardandoFetch) setCarregandoLista(false);
  }, [aberto, atividadesCache, atividadesBatchPronto, proximaAtividade, prazoAtividade, busyItemId, adding]);

  function abrirPopover(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (aberto) { setAberto(false); return; }
    const rect = dotRef.current?.getBoundingClientRect();
    if (!rect) return;
    const popW = 288;
    const left = Math.max(4, Math.min(rect.right - popW, window.innerWidth - popW - 8));
    setPos({ top: rect.top - 8, left });
    setNovaAtividade('');
    setNovoPrazo('');
    setErro(null);
    setConfirmarSemProxima(false);
    setPendingItemId(null);

    const { lista, aguardandoFetch } = resolverListaInicial(
      atividadesCache,
      atividadesBatchPronto,
      proximaAtividade,
      prazoAtividade,
    );
    setAtividadesAbertas(lista);
    setCarregandoLista(aguardandoFetch);
    setAberto(true);

    if (!aguardandoFetch) return;

    void buscarAtividadesAbertasCard(cardId)
      .then((abertas) => {
        if (abertas.length > 0) {
          setAtividadesAbertas(abertas);
        } else {
          setAtividadesAbertas(legadoAtividadeAberta(proximaAtividade, prazoAtividade));
        }
      })
      .catch(() => {
        const legado = legadoAtividadeAberta(proximaAtividade, prazoAtividade);
        if (legado.length > 0) setAtividadesAbertas(legado);
      })
      .finally(() => setCarregandoLista(false));
  }

  function concluirItem(itemId: string) {
    const restante = atividadesAbertas.filter((a) => a.id !== itemId);
    if (restante.length === 0 && !novaAtividade.trim()) {
      setPendingItemId(itemId);
      setConfirmarSemProxima(true);
      return;
    }
    void executarConclusao(itemId);
  }

  async function executarConclusao(itemId: string) {
    const prevLista = atividadesAbertas;
    const nextLista = prevLista.filter((a) => a.id !== itemId);
    setAtividadesAbertas(nextLista);
    setConfirmarSemProxima(false);
    setPendingItemId(null);
    setBusyItemId(itemId);
    setErro(null);
    syncBoard(nextLista);

    try {
      if (itemId === 'legado') {
        const res = await salvarProximaAtividade({
          cardId,
          proxima_atividade: null,
          prazo_atividade: null,
          basePath,
          skipRevalidate: true,
        });
        if (!res.ok) throw new Error(res.error);
        syncBoard([], { proxima_atividade: null, prazo_atividade: null });
      } else if (itemId.startsWith('temp-')) {
        // item otimista ainda não persistido — só UI
      } else {
        const res = await concluirProximaAtividadeItem({
          itemId,
          cardId,
          basePath,
          skipRevalidate: true,
        });
        if (!res.ok) throw new Error(res.error);
        syncBoard(nextLista, {
          proxima_atividade: res.proxima_atividade,
          prazo_atividade: res.prazo_atividade,
        });
      }
    } catch (err) {
      setAtividadesAbertas(prevLista);
      syncBoard(prevLista);
      setErro(err instanceof Error ? err.message : 'Não foi possível concluir a atividade.');
    } finally {
      setBusyItemId(null);
    }
  }

  function adicionarAtividade() {
    const descricao = novaAtividade.trim();
    if (!descricao || adding) return;
    const prazo = novoPrazo || null;
    const tempId = `temp-${Date.now()}`;
    const prevLista = atividadesAbertas;
    const nextLista = [...prevLista, { id: tempId, descricao, prazo }];
    setAtividadesAbertas(nextLista);
    setNovaAtividade('');
    setNovoPrazo('');
    setErro(null);
    setAdding(true);
    syncBoard(nextLista);

    void (async () => {
      try {
        const res = await adicionarProximaAtividadeItem({
          cardId,
          descricao,
          prazo,
          basePath,
          skipRevalidate: true,
        });
        if (!res.ok) throw new Error(res.error);
        const confirmed = nextLista.map((a) =>
          a.id === tempId ? { id: res.item.id, descricao: res.item.descricao, prazo: res.item.prazo } : a,
        );
        setAtividadesAbertas(confirmed);
        syncBoard(confirmed, {
          proxima_atividade: res.proxima_atividade,
          prazo_atividade: res.prazo_atividade,
        });
      } catch (err) {
        setAtividadesAbertas(prevLista);
        syncBoard(prevLista);
        setNovaAtividade(descricao);
        setNovoPrazo(prazo ?? '');
        setErro(err instanceof Error ? err.message : 'Não foi possível adicionar a atividade.');
      } finally {
        setAdding(false);
      }
    })();
  }

  const popover = aberto && pos ? (
    <div
      ref={popoverRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, transform: 'translateY(-100%)' }}
      className="w-72 rounded-lg border border-stone-200 bg-white p-3 text-left shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
        Próximas Atividades
      </p>

      {carregandoLista && atividadesAbertas.length === 0 ? (
        <p className="mb-3 text-[11px] text-stone-400">Carregando…</p>
      ) : atividadesAbertas.length > 0 ? (
        <ul className="mb-3 space-y-1.5">
          {atividadesAbertas.map((a) => {
            const prazoLabel = labelPrazo(a.prazo);
            const varianteItem = varianteDot(a.prazo);
            const prazoCorTexto = varianteItem === 'red' ? 'text-red-600' : varianteItem === 'green' ? 'text-green-600' : 'text-stone-400';
            return (
              <li key={a.id} className="flex items-start gap-2 rounded border border-stone-100 bg-stone-50 px-2 py-1.5">
                <input
                  type="checkbox"
                  className="mt-0.5 cursor-pointer rounded border-stone-300"
                  disabled={busyItemId === a.id || a.id.startsWith('temp-')}
                  onChange={() => concluirItem(a.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-snug text-stone-800">{a.descricao}</p>
                  {prazoLabel && <p className={`text-[10px] ${prazoCorTexto}`}>{prazoLabel}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-3 text-[11px] text-amber-600">Nenhuma atividade em aberto.</p>
      )}

      {confirmarSemProxima && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-2">
          <p className="mb-2 text-[11px] text-amber-700">
            ⚠ Você está concluindo a última atividade sem definir a próxima. O card ficará sem acompanhamento.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setConfirmarSemProxima(false); setPendingItemId(null); }}
              className="flex-1 rounded border border-stone-200 px-2 py-1 text-[11px] text-stone-600 hover:bg-stone-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => pendingItemId && void executarConclusao(pendingItemId)}
              disabled={Boolean(busyItemId)}
              className="flex-1 rounded bg-amber-500 px-2 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Concluir mesmo assim
            </button>
          </div>
        </div>
      )}

      {!confirmarSemProxima && (
        <div className="space-y-2">
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-stone-500">+ Nova atividade</label>
            <input
              type="text"
              value={novaAtividade}
              onChange={(e) => setNovaAtividade(e.target.value)}
              placeholder="Ex: Enviar proposta atualizada"
              className="w-full rounded border border-stone-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-moni-primary"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-stone-500">Prazo</label>
            <input
              type="date"
              value={novoPrazo}
              onChange={(e) => setNovoPrazo(e.target.value)}
              className="w-full rounded border border-stone-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-moni-primary"
            />
          </div>
          {erro && <p className="text-[11px] text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={adicionarAtividade}
              disabled={adding || !novaAtividade.trim()}
              className="flex-1 rounded bg-moni-primary px-2 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {adding ? 'Salvando…' : '+ Adicionar'}
            </button>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded border border-stone-200 px-2 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={dotRef}
        type="button"
        title={tooltipTitle}
        aria-label={semAtividade ? 'Definir próxima atividade' : `Próxima atividade: ${tooltipTitle}`}
        onClick={abrirPopover}
        onMouseDown={(e) => e.stopPropagation()}
        className={
          semAtividade
            ? 'flex h-3.5 w-3.5 items-center justify-center transition-transform hover:scale-125 focus:outline-none'
            : `h-3.5 w-3.5 rounded-full border border-white/80 shadow-sm transition-transform hover:scale-125 focus:outline-none ${dotCls}`
        }
        style={semAtividade ? { color: 'var(--moni-status-attention-border)' } : undefined}
      >
        {semAtividade && (
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        )}
      </button>
      {typeof document !== 'undefined' && popover
        ? createPortal(popover, document.body)
        : null}
    </>
  );
}
