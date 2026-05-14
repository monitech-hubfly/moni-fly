'use client';

import { Check } from 'lucide-react';
import type { ConteudoVideo } from '@/lib/universidade/types';

export function ModuloVideo({
  tituloModulo,
  conteudo,
  concluido,
  onConcluir,
}: {
  tituloModulo: string;
  conteudo: ConteudoVideo;
  concluido: boolean;
  onConcluir: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
      {conteudo.thumbnail ? (
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-stone-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={conteudo.thumbnail} alt="" className="h-full w-full object-cover" />
        </div>
      ) : null}
      <div>
        <h4 className="text-sm font-semibold text-stone-800">{tituloModulo}</h4>
        <p className="mt-1 text-xs text-stone-500">{conteudo.duracao_min} min</p>
        <a
          href={conteudo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm font-medium text-moni-primary hover:underline"
        >
          Abrir vídeo
        </a>
      </div>
      {concluido ? (
        <p className="flex items-center gap-2 text-sm font-medium text-green-700">
          <Check className="h-4 w-4" aria-hidden /> Assistido
        </p>
      ) : (
        <button
          type="button"
          onClick={onConcluir}
          className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Marcar como assistido
        </button>
      )}
    </div>
  );
}
