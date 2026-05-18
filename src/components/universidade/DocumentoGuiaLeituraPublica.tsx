'use client';

import { DocumentoInternoIframe } from '@/components/universidade/DocumentoInternoIframe';
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
      <DocumentoInternoIframe src={iframeSrc} title={meta.titulo} />
    </div>
  );
}
