'use client';

import Link from 'next/link';
import { DocumentoInternoIframe } from '@/components/universidade/DocumentoInternoIframe';
import { CopiarLinkPublicoGuia } from '@/components/universidade/CopiarLinkPublicoGuia';
import {
  type GuiaPublicoSlug,
  guiaPublicoIframeSrc,
  GUIAS_PUBLICOS,
} from '@/lib/universidade/documentos-publicos';

type Props = { slug: GuiaPublicoSlug };

/** Leitura pública do guia HTML (sem menu do Hub). */
export function DocumentoGuiaLeituraPublica({ slug }: Props) {
  const meta = GUIAS_PUBLICOS[slug];
  const iframeSrc = guiaPublicoIframeSrc(slug);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-stone-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-800">{meta.titulo}</p>
          <p className="truncate text-xs text-stone-500">Modo leitura · sem menu do Hub</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <CopiarLinkPublicoGuia slug={slug} mostrarUrl={false} />
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 sm:min-h-0 sm:py-1.5"
          >
            Entrar no Hub
          </Link>
        </div>
      </header>
      <DocumentoInternoIframe src={iframeSrc} title={meta.titulo} />
    </div>
  );
}
