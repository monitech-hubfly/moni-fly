'use client';

import { ExternalLink, Download } from 'lucide-react';
import type { ConteudoTemplate } from '@/lib/universidade/types';

export function ModuloTemplate({
  conteudo,
  onConcluir,
}: {
  conteudo: ConteudoTemplate;
  onConcluir: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-stone-800">{conteudo.titulo}</h4>
      <div className="flex flex-wrap gap-2">
        <a
          href={conteudo.url_drive}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-moni-primary hover:bg-stone-50"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          Abrir no Drive
        </a>
        {conteudo.url_download ? (
          <a
            href={conteudo.url_download}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download
          </a>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onConcluir}
        className="rounded-lg bg-moni-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Baixei o template
      </button>
    </div>
  );
}
