'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useTransition } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  adicionarProximaAtividadeItem,
  concluirProximaAtividadeItem,
  buscarAtividadesAbertasCard,
  salvarProximaAtividade,
} from '@/lib/actions/card-actions';

type Props = {
  cardId: string;
  proximaAtividade: string | null;
  prazoAtividade: string | null;
  basePath: string;
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
  return dataFormatada;
}

export function ProximaAtividadeDot({ cardId, proximaAtividade, prazoAtividade, basePath }: Props) {
  const [aberto, setAberto] = useState(false);
  const [atividadesAbertas, setAtividadesAbertas] = useState<{ id: string; descricao: string; prazo: string | null }[]>([]);
  const [novaAtividade, setNovaAtividade] = useState('');
  const [novoPrazo, setNovoPrazo] = useState('');
  const [confirmarSemProxima, setConfirmarSemProxima] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
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
    setAberto(true);
    void buscarAtividadesAbertasCard(cardId).then((abertas) => {
      if (abertas.length === 0 && proximaAtividade) {
        setAtividadesAbertas([{
          id: 'legado',
          descricao: proximaAtividade,
          prazo: prazoAtividade,
        }]);
      } else {
        setAtividadesAbertas(abertas);
      }
    });
  }

  function concluirItem(itemId: string) {
    const restante = atividadesAbertas.filter(a => a.id !== itemId);
    if (restante.length === 0 && !novaAtividade.trim()) {
      setPendingItemId(itemId);
      setConfirmarSemProxima(true);
      return;
    }
    executarConclusao(itemId);
  }

  function executarConclusao(itemId: string) {
    startTransition(async () => {
      if (itemId === 'legado') {
        await salvarProximaAtividade({
          cardId,
          proxima_atividade: null,
          prazo_atividade: null,
          basePath,
        });
      } else {
        await concluirProximaAtividadeItem({ itemId, cardId, basePath });
      }
      setAtividadesAbertas(prev => prev.filter(a => a.id !== itemId));
      setConfirmarSemProxima(false);
      setPendingItemId(null);
    });
  }

  function adicionarAtividade() {
    if (!novaAtividade.trim()) return;
    setErro(null);
    startTransition(async () => {
      const res = await adicionarProximaAtividadeItem({
        cardId,
        descricao: novaAtividade.trim(),
        prazo: novoPrazo || null,
        basePath,
      });
      if (!res.ok) { setErro(res.error); return; }
      const novas = await buscarAtividadesAbertasCard(cardId);
      setAtividadesAbertas(novas);
      setNovaAtividade('');
      setNovoPrazo('');
    });
  }

  const popover = aberto && pos ? (
    <div
      ref={popoverRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, transform: 'translateY(-100%)' }}
      className="w-72 rounded-lg border border-stone-200 bg-white p-3 text-left shadow-xl"
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
        Próximas Atividades
      </p>

      {/* Lista de atividades abertas */}
      {atividadesAbertas.length > 0 ? (
        <ul className="mb-3 space-y-1.5">
          {atividadesAbertas.map(a => {
            const prazoLabel = labelPrazo(a.prazo);
            const variante = varianteDot(a.prazo);
            const prazoCorTexto = variante === 'red' ? 'text-red-600' : variante === 'green' ? 'text-green-600' : 'text-stone-400';
            return (
              <li key={a.id} className="flex items-start gap-2 rounded border border-stone-100 bg-stone-50 px-2 py-1.5">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-stone-300 cursor-pointer"
                  disabled={pending}
                  onChange={() => concluirItem(a.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-stone-800 leading-snug">{a.descricao}</p>
                  {prazoLabel && <p className={`text-[10px] ${prazoCorTexto}`}>{prazoLabel}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-3 text-[11px] text-amber-600">Nenhuma atividade em aberto.</p>
      )}

      {/* Alerta sem próxima atividade */}
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
              onClick={() => pendingItemId && executarConclusao(pendingItemId)}
              disabled={pending}
              className="flex-1 rounded bg-amber-500 px-2 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Concluir mesmo assim
            </button>
          </div>
        </div>
      )}

      {/* Adicionar nova */}
      {!confirmarSemProxima && (
        <div className="space-y-2">
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-stone-500">+ Nova atividade</label>
            <input
              type="text"
              value={novaAtividade}
              onChange={e => setNovaAtividade(e.target.value)}
              placeholder="Ex: Enviar proposta atualizada"
              className="w-full rounded border border-stone-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-moni-primary"
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-stone-500">Prazo</label>
            <input
              type="date"
              value={novoPrazo}
              onChange={e => setNovoPrazo(e.target.value)}
              className="w-full rounded border border-stone-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-moni-primary"
            />
          </div>
          {erro && <p className="text-[11px] text-red-600">{erro}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={adicionarAtividade}
              disabled={pending || !novaAtividade.trim()}
              className="flex-1 rounded bg-moni-primary px-2 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'Salvando…' : '+ Adicionar'}
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
        onMouseDown={e => e.stopPropagation()}
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
