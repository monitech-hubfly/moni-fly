'use client';

import { useEffect, useState } from 'react';
import { listarLotesDoCondominio } from '@/lib/actions/kanban-lotes-condominio';
import { formatQuadraLote } from '@/lib/condominios-lotes';

type Props = {
  condominioId: string | null;
  cardIdAtual?: string | null;
};

export function CondominioLotesAnexados({ condominioId, cardIdAtual }: Props) {
  const [lotes, setLotes] = useState<
    Array<{
      id: string;
      quadra: string | null;
      lote: string | null;
      area_m2: number | null;
      valor: number | null;
      kanban_card_id: string | null;
    }>
  >([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const id = condominioId?.trim();
    if (!id) {
      setLotes([]);
      return;
    }
    let cancelado = false;
    void (async () => {
      setCarregando(true);
      try {
        const rows = await listarLotesDoCondominio(id);
        if (!cancelado) setLotes(rows as typeof lotes);
      } catch {
        if (!cancelado) setLotes([]);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [condominioId, cardIdAtual]);

  if (!condominioId?.trim()) return null;

  return (
    <div className="mt-3 rounded border border-stone-100 bg-stone-50/80 p-2">
      <p className="mb-1.5 text-[11px] font-semibold text-stone-600">Lotes anexados ao cadastro</p>
      {carregando ? (
        <p className="text-[10px] text-stone-500">Carregando…</p>
      ) : lotes.length === 0 ? (
        <p className="text-[10px] italic text-stone-500">Nenhum lote anexado ainda neste condomínio.</p>
      ) : (
        <ul className="space-y-1">
          {lotes.map((l) => (
            <li
              key={l.id}
              className={`rounded border px-2 py-1 text-[10px] ${
                cardIdAtual && l.kanban_card_id === cardIdAtual
                  ? 'border-violet-200 bg-violet-50 text-violet-900'
                  : 'border-stone-200 bg-white text-stone-700'
              }`}
            >
              <span className="font-medium">{formatQuadraLote(l.quadra, l.lote)}</span>
              {l.area_m2 != null ? (
                <span className="ml-2 text-stone-500">{l.area_m2} m²</span>
              ) : null}
              {l.valor != null ? (
                <span className="ml-2 text-stone-500">
                  {l.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              ) : null}
              {cardIdAtual && l.kanban_card_id === cardIdAtual ? (
                <span className="ml-1 text-violet-700">(este card)</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
