'use client';

import { useMemo, useState } from 'react';
import { FileText, Link2, Video } from 'lucide-react';
import type { UniBibliotecaItem } from '@/lib/universidade/types';

const FILTROS = ['Todos', 'Jurídico', 'BCA', 'Batalhas', 'Produto', 'Vídeos', 'Templates'] as const;

export function BibliotecaClient({ itens }: { itens: UniBibliotecaItem[] }) {
  const [cat, setCat] = useState<string>('Todos');

  const filtrados = useMemo(() => {
    if (cat === 'Todos') return itens;
    return itens.filter((i) => i.categoria === cat);
  }, [itens, cat]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold text-stone-900">Biblioteca operacional</h1>
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setCat(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              cat === f ? 'bg-moni-primary text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {filtrados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-8 text-center text-sm text-stone-600">
          Nenhum item nesta categoria ainda
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((it) => (
            <article key={it.id} className="flex flex-col rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-stone-600">
                {it.tipo === 'video' ? <Video className="h-4 w-4" /> : it.tipo === 'arquivo' ? <FileText className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                <span className="text-xs uppercase text-stone-500">{it.categoria}</span>
              </div>
              <h2 className="mt-2 text-sm font-semibold text-stone-900">{it.titulo}</h2>
              {it.descricao ? <p className="mt-1 line-clamp-3 text-xs text-stone-600">{it.descricao}</p> : null}
              {it.url ? (
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex text-xs font-semibold text-moni-primary hover:underline"
                >
                  Acessar
                </a>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
