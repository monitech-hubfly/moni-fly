'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Link2 } from 'lucide-react';
import {
  hrefGuiaPublicoLeitura,
  type GuiaPublicoSlug,
} from '@/lib/universidade/documentos-publicos';

type Props = {
  slug: GuiaPublicoSlug;
  /** Exibe a URL completa abaixo do botão (padrão: true no Hub). */
  mostrarUrl?: boolean;
  className?: string;
};

export function CopiarLinkPublicoGuia({ slug, mostrarUrl = true, className = '' }: Props) {
  const path = hrefGuiaPublicoLeitura(slug);
  const [copied, setCopied] = useState(false);
  const [urlCompleta, setUrlCompleta] = useState('');

  useEffect(() => {
    setUrlCompleta(`${window.location.origin}${path}`);
  }, [path]);

  const copy = useCallback(async () => {
    try {
      const url = urlCompleta || `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }, [path, urlCompleta]);

  return (
    <div className={`flex flex-col items-end gap-1.5 ${className}`.trim()}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-sm font-medium text-emerald-900 shadow-sm hover:bg-emerald-100/80"
        >
          <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {copied ? 'Link copiado!' : 'Copiar link público'}
        </button>
        <Link
          href={path}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
          title="Abrir em nova aba (modo leitura, sem menu do Hub)"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Abrir público
        </Link>
      </div>
      {mostrarUrl && urlCompleta ? (
        <p className="max-w-md text-right text-[11px] leading-snug text-stone-500">
          Link fixo compartilhável:{' '}
          <span className="font-mono text-stone-600">{urlCompleta.replace(/^https?:\/\//, '')}</span>
        </p>
      ) : null}
    </div>
  );
}
