'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, useTransition } from 'react';
import { salvarProximaAtividade } from '@/lib/actions/card-actions';

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
  if (prazo < hoje) return 'Atrasada';
  if (prazo === hoje) return 'Vence hoje';
  const [y, m, d] = prazo.split('-');
  return `${d}/${m}/${y}`;
}

export function FundingAtividadeDot({ cardId, proximaAtividade, prazoAtividade, basePath }: Props) {
  const [aberto, setAberto] = useState(false);
  const [concluida, setConcluida] = useState(false);
  const [novaAtividade, setNovaAtividade] = useState('');
  const [novoPrazo, setNovoPrazo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const dotRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const semAtividade = !proximaAtividade;
  const variante = varianteDot(prazoAtividade);
  const dotCls = semAtividade
    ? 'bg-yellow-400 hover:bg-yellow-500'
    : variante === 'red' ? 'bg-red-500 hover:bg-red-600'
    : variante === 'green' ? 'bg-green-500 hover:bg-green-600'
    : 'bg-stone-400 hover:bg-stone-500';
  const prazoLabel = labelPrazo(prazoAtividade);
  const prazoCorTexto =
    variante === 'red' ? 'text-red-600'
    : variante === 'green' ? 'text-green-600'
    : 'text-stone-500';
  const tooltipTitle = semAtividade
    ? 'Próxima atividade não definida'
    : prazoLabel ? `${proximaAtividade} · ${prazoLabel}` : proximaAtividade!;

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
      const popW = 256;
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
    const popW = 256;
    const left = Math.max(4, Math.min(rect.right - popW, window.innerWidth - popW - 8));
    setPos({ top: rect.top - 8, left });
    setConcluida(false);
    setNovaAtividade('');
    setNovoPrazo('');
    setErro(null);
    setAberto(true);
  }

  function handleSalvar() {
    setErro(null);
    startTransition(async () => {
      const res = await salvarProximaAtividade({
        cardId,
        proxima_atividade: concluida ? null : novaAtividade.trim() || null,
        prazo_atividade: concluida ? null : novoPrazo || null,
        basePath,
      });
      if (!res.ok) { setErro(res.error); return; }
      setAberto(false);
    });
  }

  const popover = aberto && pos ? (
    <div
      ref={popoverRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, transform: 'translateY(-100%)' }}
      className="w-64 rounded-lg border border-stone-200 bg-white p-3 text-left shadow-xl"
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
        Próxima atividade
      </p>

      {/* Modo: atividade já definida */}
      {!semAtividade && (
        <>
          <p className="mb-1 text-xs font-medium text-stone-800">{proximaAtividade}</p>
          {prazoLabel && (
            <p className={`mb-3 text-[11px] ${prazoCorTexto}`}>{prazoLabel}</p>
          )}
          <label className="mb-3 flex cursor-pointer select-none items-center gap-2 text-xs text-stone-700">
            <input
              type="checkbox"
              checked={concluida}
              onChange={e => setConcluida(e.target.checked)}
              className="rounded border-stone-300"
            />
            Marcar como concluída
          </label>
          {concluida && !novaAtividade.trim() && (
            <p className="mb-2 text-[11px] text-amber-600">
              Defina a próxima atividade para manter o acompanhamento do card.
            </p>
          )}
        </>
      )}

      {/* Modo: sem atividade definida */}
      {semAtividade && (
        <p className="mb-3 text-[11px] text-amber-600">
          Nenhuma atividade definida. Preencha abaixo para retomar o acompanhamento.
        </p>
      )}

      {/* Formulário de nova atividade — visível quando não está só concluindo */}
      {(!concluida || semAtividade) && (
        <div className="mb-3 space-y-2">
          <div>
            <label className="mb-0.5 block text-[10px] font-medium text-stone-500">
              {semAtividade ? 'Próxima atividade' : 'Nova atividade'}
            </label>
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
        </div>
      )}

      {erro && <p className="mb-2 text-[11px] text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSalvar}
          disabled={pending}
          className="flex-1 rounded bg-moni-primary px-2 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Salvando…' : (concluida && !semAtividade) ? 'Concluir' : 'Salvar'}
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
        className={`h-3 w-3 rounded-full border border-white/80 shadow-sm transition-transform hover:scale-125 focus:outline-none ${dotCls}`}
      />
      {typeof document !== 'undefined' && popover
        ? createPortal(popover, document.body)
        : null}
    </>
  );
}
