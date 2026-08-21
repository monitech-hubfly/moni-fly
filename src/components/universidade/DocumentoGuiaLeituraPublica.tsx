'use client';

import Link from 'next/link';
import { DocumentoInternoIframe } from '@/components/universidade/DocumentoInternoIframe';
import { CopiarLinkPublicoGuia } from '@/components/universidade/CopiarLinkPublicoGuia';
import {
  type GuiaPublicoSlug,
  guiaPublicoIframeSrc,
  GUIAS_PUBLICOS,
} from '@/lib/universidade/documentos-publicos';

type Props = {
  slug: GuiaPublicoSlug;
  /** Cabeçalho igual ao Hub (breadcrumb, título, copiar + voltar). */
  layoutHub?: boolean;
  voltarHref?: string;
};

/** Leitura pública do guia HTML (sem menu lateral do Hub). */
export function DocumentoGuiaLeituraPublica({ slug, layoutHub = false, voltarHref }: Props) {
  const meta = GUIAS_PUBLICOS[slug];
  const iframeSrc = guiaPublicoIframeSrc(slug);
  const voltar = voltarHref ?? '/universidade/ferramentas';

  if (layoutHub) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-stone-50">
        <header className="shrink-0 border-b border-stone-200 bg-white px-4 py-3 md:px-6">
          <nav className="text-xs text-stone-500" aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <Link href="/universidade" className="hover:text-moni-primary hover:underline">
                  Universidade
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/universidade/ferramentas" className="hover:text-moni-primary hover:underline">
                  Ferramentas
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium text-stone-800">{meta.titulo}</li>
            </ol>
          </nav>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-lg font-semibold text-stone-900 md:text-xl">{meta.titulo}</h1>
            <CopiarLinkPublicoGuia slug={slug} voltarHref={voltar} />
          </div>
        </header>
        <DocumentoInternoIframe src={iframeSrc} title={meta.titulo} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-stone-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-800">{meta.titulo}</p>
          <p className="truncate text-xs text-stone-500">Modo leitura · sem menu do Hub</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <CopiarLinkPublicoGuia slug={slug} />
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
