'use client';

import { useState, useTransition } from 'react';
import { CheckSquare, Trash2, Plus, Square } from 'lucide-react';
import {
  listarChecklistCard,
  criarChecklistItem,
  toggleChecklistItem,
  deletarChecklistItem,
  type ChecklistItem,
} from '@/lib/actions/card-actions';

type Props = {
  cardId: string;
  userId: string | null;
  isFrank: boolean;
  responsaveisOpcoes: { id: string; nome: string }[];
  basePath?: string;
};

export function ChecklistCard({ cardId, userId, isFrank, responsaveisOpcoes, basePath }: Props) {
  const [itens, setItens] = useState<ChecklistItem[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [novoTexto, setNovoTexto] = useState('');
  const [novoResponsavel, setNovoResponsavel] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroAdd, setErroAdd] = useState('');
  const [, startTransition] = useTransition();

  async function abrir() {
    if (aberto) {
      setAberto(false);
      return;
    }
    setAberto(true);
    if (itens === null) {
      const data = await listarChecklistCard(cardId);
      const filtrados = isFrank ? data.filter((i) => i.responsavel_id === userId) : data;
      setItens(filtrados);
    }
  }

  async function handleToggle(item: ChecklistItem) {
    if (!itens) return;
    const novoFeito = !item.feito;
    setItens((prev) => prev?.map((i) => (i.id === item.id ? { ...i, feito: novoFeito } : i)) ?? null);
    startTransition(async () => {
      await toggleChecklistItem({ id: item.id, feito: novoFeito, basePath });
    });
  }

  async function handleAdicionar() {
    if (!novoTexto.trim()) return;
    setSalvando(true);
    setErroAdd('');
    const res = await criarChecklistItem({
      card_id: cardId,
      texto: novoTexto.trim(),
      responsavel_id: novoResponsavel || null,
      basePath,
    });
    setSalvando(false);
    if (!res.ok) {
      setErroAdd(res.error ?? 'Erro ao adicionar.');
      return;
    }
    if (res.item) {
      setItens((prev) => [...(prev ?? []), res.item!]);
    }
    setNovoTexto('');
    setNovoResponsavel('');
  }

  async function handleDeletar(id: string) {
    setItens((prev) => prev?.filter((i) => i.id !== id) ?? null);
    startTransition(async () => {
      await deletarChecklistItem({ id, basePath });
    });
  }

  const concluidos = itens?.filter((i) => i.feito).length ?? 0;
  const total = itens?.length ?? 0;

  return (
    <div
      className="mb-2 overflow-hidden rounded-lg bg-white"
      style={{ border: '0.5px solid var(--moni-border-default)', boxShadow: 'var(--moni-shadow-sm)' }}
    >
      <button
        type="button"
        onClick={abrir}
        className="flex w-full items-center gap-2 p-2 text-left text-xs transition hover:bg-stone-50"
      >
        <CheckSquare className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
        <span className="flex-1 text-xs font-semibold text-stone-800">Checklist</span>
        {itens !== null && total > 0 && (
          <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
            {concluidos}/{total}
          </span>
        )}
      </button>

      {aberto && (
        <div className="border-t px-2 pb-2 pt-1.5" style={{ borderColor: 'var(--moni-border-subtle)' }}>
          {itens === null ? (
            <p className="text-xs text-stone-400">Carregando…</p>
          ) : itens.length === 0 ? (
            <p className="text-xs text-stone-400">Nenhum item ainda.</p>
          ) : (
            <ul className="mb-2 space-y-1">
              {itens.map((item) => (
                <li key={item.id} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggle(item)}
                    className="shrink-0 text-stone-500 hover:text-stone-800"
                    title={item.feito ? 'Desmarcar' : 'Marcar como feito'}
                  >
                    {item.feito ? (
                      <CheckSquare className="h-3.5 w-3.5 text-green-600" aria-hidden />
                    ) : (
                      <Square className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </button>
                  <span
                    className={`flex-1 text-xs leading-snug ${item.feito ? 'text-stone-400 line-through' : 'text-stone-800'}`}
                  >
                    {item.texto}
                  </span>
                  {item.responsavel?.full_name && (
                    <span className="shrink-0 text-[10px] text-stone-400">{item.responsavel.full_name}</span>
                  )}
                  {!isFrank && (
                    <button
                      type="button"
                      onClick={() => handleDeletar(item.id)}
                      className="shrink-0 text-stone-300 hover:text-red-500"
                      title="Remover item"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!isFrank && (
            <div className="space-y-1">
              <input
                type="text"
                placeholder="Novo item…"
                value={novoTexto}
                onChange={(e) => setNovoTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdicionar(); }}
                className="w-full rounded border border-stone-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-stone-400"
              />
              <select
                value={novoResponsavel}
                onChange={(e) => setNovoResponsavel(e.target.value)}
                className="w-full rounded border border-stone-200 px-2 py-1 text-xs text-stone-600 focus:outline-none focus:ring-1 focus:ring-stone-400"
              >
                <option value="">Responsável (opcional)</option>
                {responsaveisOpcoes.map((r) => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
              {erroAdd && <p className="text-[10px] text-red-500">{erroAdd}</p>}
              <button
                type="button"
                onClick={handleAdicionar}
                disabled={salvando || !novoTexto.trim()}
                className="flex items-center gap-1 rounded bg-stone-800 px-2 py-1 text-[10px] text-white hover:bg-stone-700 disabled:opacity-40"
              >
                <Plus className="h-3 w-3" aria-hidden />
                {salvando ? 'Salvando…' : 'Adicionar'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
