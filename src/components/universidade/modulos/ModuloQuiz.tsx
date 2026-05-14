'use client';

import { useState } from 'react';
import type { ConteudoQuiz } from '@/lib/universidade/types';

export function ModuloQuiz({
  conteudo,
  onConcluir,
}: {
  conteudo: ConteudoQuiz;
  onConcluir: (nota: number) => void;
}) {
  const perguntas = conteudo.perguntas ?? [];
  const [idx, setIdx] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [finalizado, setFinalizado] = useState(false);
  const [nota, setNota] = useState<number | null>(null);

  const atual = perguntas[idx];

  function escolher(op: string) {
    if (!atual) return;
    setRespostas((r) => ({ ...r, [atual.id]: op }));
  }

  function proxima() {
    if (idx < perguntas.length - 1) setIdx(idx + 1);
    else finalizar();
  }

  function finalizar() {
    let certas = 0;
    for (const p of perguntas) {
      if (respostas[p.id] === p.correta) certas++;
    }
    const n = perguntas.length > 0 ? Math.round((certas / perguntas.length) * 100) : 0;
    setNota(n);
    setFinalizado(true);
    if (n >= 70) onConcluir(n);
  }

  if (finalizado && nota != null) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <p className="text-sm font-semibold text-stone-800">Resultado: {nota}%</p>
        {nota < 70 ? (
          <p className="mt-2 text-sm text-amber-800">Nota mínima 70%. Refaça o quiz para concluir.</p>
        ) : (
          <p className="mt-2 text-sm text-green-800">Parabéns — módulo concluído.</p>
        )}
      </div>
    );
  }

  if (!atual) {
    return <p className="text-sm text-stone-500">Quiz sem perguntas.</p>;
  }

  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs text-stone-500">
        Pergunta {idx + 1} / {perguntas.length}
      </p>
      <p className="text-sm font-medium text-stone-800">{atual.texto}</p>
      <div className="flex flex-col gap-2">
        {atual.opcoes.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => escolher(op)}
            className={`rounded-lg border px-3 py-2 text-left text-sm ${
              respostas[atual.id] === op ? 'border-moni-primary bg-moni-light' : 'border-stone-200 hover:bg-stone-50'
            }`}
          >
            {op}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={!respostas[atual.id]}
        onClick={proxima}
        className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {idx < perguntas.length - 1 ? 'Próxima' : 'Finalizar'}
      </button>
    </div>
  );
}
