import type { UniBibliotecaItem } from '@/lib/universidade/types';
import { hrefGuiaPublicoLeitura, isGuiaPublicoSlug, type GuiaPublicoSlug } from '@/lib/universidade/documentos-publicos';

export type { GuiaPublicoSlug };
export { hrefGuiaPublicoLeitura, isGuiaPublicoSlug };

export const UNI_BIBLIOTECA_TIPO_DOCUMENTO_INTERNO = 'documento-interno' as const;

export function isBibliotecaDocumentoInterno(item: Pick<UniBibliotecaItem, 'tipo' | 'slug'>): boolean {
  return item.tipo === UNI_BIBLIOTECA_TIPO_DOCUMENTO_INTERNO && Boolean(item.slug?.trim());
}

/** @deprecated Use hrefFerramentasDocumentoInterno — /biblioteca redireciona para /ferramentas. */
export function hrefBibliotecaDocumentoInterno(slug: string): string {
  return hrefFerramentasDocumentoInterno(slug);
}

/** Alias de rota usado na UI («Ferramentas»). */
export function hrefFerramentasDocumentoInterno(slug: string): string {
  return `/universidade/ferramentas/${encodeURIComponent(slug.trim())}`;
}

export function iframeSrcDocumentoInterno(slug: string): string {
  return `/documentos/${encodeURIComponent(slug.trim())}.html`;
}
