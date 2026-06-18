import { iframeSrcDocumentoInterno } from '@/lib/universidade/biblioteca-documentos';
import { PRE_BATALHA_PUBLIC_LEITURA_PATH } from '@/lib/pre-batalha-secoes';

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
  'pre-batalha-casas': {
    titulo: 'Pré Batalha de Casas',
    descricao: 'Guia da triagem inicial de modelos Moní antes da Batalha completa.',
  },
} as const;

export type GuiaPublicoSlug = keyof typeof GUIAS_PUBLICOS;

const GUIA_SLUGS = Object.keys(GUIAS_PUBLICOS) as GuiaPublicoSlug[];

export function isGuiaPublicoSlug(slug: string): slug is GuiaPublicoSlug {
  return (GUIA_SLUGS as string[]).includes(slug);
}

/** URL canónica compartilhável (sem query). */
export function hrefGuiaPublicoLeitura(slug: GuiaPublicoSlug): string {
  if (slug === 'pre-batalha-casas') return PRE_BATALHA_PUBLIC_LEITURA_PATH;
  return `/${slug}/leitura`;
}

export function isGuiaPublicoLeituraPath(pathname: string): boolean {
  if (
    pathname === PRE_BATALHA_PUBLIC_LEITURA_PATH ||
    pathname.startsWith(`${PRE_BATALHA_PUBLIC_LEITURA_PATH}/`)
  ) {
    return true;
  }
  return GUIA_SLUGS.some(
    (s) => pathname === `/${s}/leitura` || pathname.startsWith(`/${s}/leitura/`),
  );
}

export function guiaPublicoIframeSrc(slug: GuiaPublicoSlug): string {
  if (slug === 'pre-batalha-casas') {
    return '/embed/pre-batalha-casas.html?leitura=1';
  }
  return iframeSrcDocumentoInterno(slug);
}
