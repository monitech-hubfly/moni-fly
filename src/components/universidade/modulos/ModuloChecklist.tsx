'use client';

import { useEffect, useState } from 'react';
import type { ConteudoChecklist } from '@/lib/universidade/types';

export function ModuloChecklist({
  conteudo,
  dados,
  onAtualizar,
  onConcluir,
}: {
  conteudo: ConteudoChecklist;
  dados: Record<string, boolean>;
  onAtualizar: (dados: Record<string, boolean>) => void;
  onConcluir: (dados: Record<string, boolean>) => void;
}) {
  const [local, setLocal] = useState(dados);

  useEffect(() => {
    setLocal(dados);
  }, [dados]);

  const itens = conteudo.itens ?? [];
  const allChecked = itens.length > 0 && itens.every((i) => local[i.id]);

  function toggle(id: string) {
    const next = { ...local, [id]: !local[id] };
    setLocal(next);
    onAtualizar(next);
  }

  return (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
      <ul className="space-y-2">
        {itens.map((it) => (
          <li key={it.id} className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-stone-300"
              checked={Boolean(local[it.id])}
              onChange={() => toggle(it.id)}
            />
            <div>
              <span className="text-sm text-stone-800">{it.texto}</span>
              {it.dica ? <p className="text-xs text-stone-500">{it.dica}</p> : null}
            </div>
          </li>
        ))}
      </ul>
      {allChecked ? (
        <button
          type="button"
          onClick={() => onConcluir(local)}
          className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Concluir
        </button>
      ) : null}
    </div>
  );
}
