'use client';

import React from 'react';

/** Layout do PDF de prospecção cidade (título, linha, texto, grid de imagens) — como nos anexos PROSPECÇÃO CIDADE / Vila Velha. */
export function ProspeccaoCidadePDFContent(props: {
  titulo: string;
  subtitulo?: string;
  texto: string;
  imagens: string[];
}) {
  const { titulo, subtitulo, texto, imagens } = props;
  const slice4 = imagens.slice(0, 4);
  const pad = 4 - slice4.length;

  return (
    <div
      className="bg-white text-stone-800"
      style={{ width: '210mm', minHeight: '297mm', padding: '20mm', boxSizing: 'border-box' }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-stone-300 pb-3">
        <div>
          <h1 className="text-2xl font-bold uppercase tracking-tight text-stone-900">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-base font-medium text-stone-700">{subtitulo}</p>}
        </div>
        <div className="h-12 w-12 shrink-0 rounded bg-amber-100" title="Logo" aria-hidden />
      </div>
      <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-stone-700">
        {texto || '—'}
      </div>
      {slice4.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-4">
          {slice4.map((src, i) => (
            <div key={i} className="aspect-video overflow-hidden rounded bg-stone-100">
              <img
                src={src}
                alt=""
                className="h-full w-full object-cover"
                crossOrigin="anonymous"
              />
            </div>
          ))}
          {pad > 0 &&
            Array.from({ length: pad }).map((_, i) => (
              <div key={`pad-${i}`} className="aspect-video rounded bg-stone-100" />
            ))}
        </div>
      )}
    </div>
  );
}
