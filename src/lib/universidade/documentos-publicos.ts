import { iframeSrcDocumentoInterno } from '@/lib/universidade/biblioteca-documentos';

/** Guias HTML em public/documentos com link público fixo (sem login). */
export const GUIAS_PUBLICOS = {
  'carta-fianca': {
    titulo: 'Carta Fiança',
    descricao: 'Guia operacional Moní sobre carta fiança na pré-obra.',
  },
  'moni-capital': {
    titulo: 'Moní Capital',
    descricao: 'Guia da plataforma de captação privada da rede Moní.',
  },
} as const;

export type GuiaPublicoSlug = keyof typeof GUIAS_PUBLICOS;

const GUIA_SLUGS = Object.keys(GUIAS_PUBLICOS) as GuiaPublicoSlug[];

export function isGuiaPublicoSlug(slug: string): slug is GuiaPublicoSlug {
  return (GUIA_SLUGS as string[]).includes(slug);
}

/** URL canónica compartilhável (sem query). */
export function hrefGuiaPublicoLeitura(slug: GuiaPublicoSlug): string {
  return `/${slug}/leitura`;
}

export function isGuiaPublicoLeituraPath(pathname: string): boolean {
  return GUIA_SLUGS.some(
    (s) => pathname === `/${s}/leitura` || pathname.startsWith(`/${s}/leitura/`),
  );
}

export function guiaPublicoIframeSrc(slug: GuiaPublicoSlug): string {
  return iframeSrcDocumentoInterno(slug);
}
