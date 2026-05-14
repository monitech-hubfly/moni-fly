'use client';

import ReactMarkdown from 'react-markdown';
import { Check } from 'lucide-react';
import type { ConteudoLeitura } from '@/lib/universidade/types';

export function ModuloLeitura({
  conteudo,
  concluido,
  onConcluir,
}: {
  conteudo: ConteudoLeitura;
  concluido: boolean;
  onConcluir: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs text-stone-500">Leitura estimada: {conteudo.tempo_leitura_min} min</p>
      <div className="max-w-none space-y-2 text-sm leading-relaxed text-stone-800 [&_h1]:text-lg [&_h1]:font-semibold [&_p]:mt-2">
        <ReactMarkdown>{conteudo.markdown}</ReactMarkdown>
      </div>
      {concluido ? (
        <p className="flex items-center gap-2 text-sm font-medium text-green-700">
          <Check className="h-4 w-4" aria-hidden /> Leitura concluída
        </p>
      ) : (
        <button
          type="button"
          onClick={onConcluir}
          className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Concluir esta leitura
        </button>
      )}
    </div>
  );
}
