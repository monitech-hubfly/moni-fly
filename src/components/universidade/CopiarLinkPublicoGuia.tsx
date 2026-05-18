'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Link2 } from 'lucide-react';
import {
  hrefGuiaPublicoLeitura,
  type GuiaPublicoSlug,
} from '@/lib/universidade/documentos-publicos';

type Props = {
  slug: GuiaPublicoSlug;
  /** Botão Voltar na mesma linha do copiar (ex.: Hub). */
  voltarHref?: string;
  voltarLabel?: string;
  className?: string;
};

export function CopiarLinkPublicoGuia({
  slug,
  voltarHref,
  voltarLabel = '← Voltar',
  className = '',
}: Props) {
  const path = hrefGuiaPublicoLeitura(slug);
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      const url = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }, [path]);

  return (
    <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-sm font-medium text-emerald-900 shadow-sm hover:bg-emerald-100/80"
      >
        <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {copied ? 'Link copiado!' : 'Copiar link público'}
      </button>
      {voltarHref ? (
        <Link
          href={voltarHref}
          className="inline-flex items-center rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          {voltarLabel}
        </Link>
      ) : null}
    </div>
  );
}
