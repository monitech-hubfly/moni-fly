export type StatusLinkAnuncio = 'a_venda' | 'despublicado' | 'indeterminado';

const FRASES_DESPUBLICADO = [
  'não está mais disponível',
  'nao esta mais disponivel',
  'imóvel não encontrado',
  'imovel nao encontrado',
  'não encontramos este imóvel',
  'nao encontramos este imovel',
  'não encontramos',
  'nao encontramos',
  'anúncio encerrado',
  'anuncio encerrado',
  'este anúncio não existe',
  'este anuncio nao existe',
  'anúncio não está mais',
  'anuncio nao esta mais',
  'listing-not-found',
  'property-not-found',
  'página não encontrada',
  'pagina nao encontrada',
  'ops! imóvel indisponível',
  'ops! imovel indisponivel',
];

const FRASES_A_VENDA = [
  'dormitório',
  'dormitorio',
  'quartos',
  'valor de venda',
  'comprar imóvel',
  'comprar imovel',
  'imóvel para comprar',
  'imovel para comprar',
  'preço do imóvel',
  'preco do imovel',
];

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function hostnameBloqueado(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
    return true;
  }
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    return true;
  }
  if (/^169\.254\./.test(host)) return true;
  return false;
}

/** Valida URL pública http(s) antes de fetch server-side (mitiga SSRF). */
export function urlAnuncioPermitida(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (hostnameBloqueado(parsed.hostname)) return false;
  return true;
}

export function inferirStatusAnuncioPorHtml(
  html: string,
  statusHttp: number,
  finalUrl: string,
): StatusLinkAnuncio {
  if (statusHttp === 404 || statusHttp === 410) return 'despublicado';

  const lower = html.toLowerCase();
  const urlLower = finalUrl.toLowerCase();

  if (
    urlLower.includes('/404') ||
    urlLower.includes('not-found') ||
    urlLower.includes('nao-encontrado') ||
    urlLower.includes('nao-encontrada')
  ) {
    return 'despublicado';
  }

  for (const frase of FRASES_DESPUBLICADO) {
    if (lower.includes(frase)) return 'despublicado';
  }

  if (statusHttp >= 200 && statusHttp < 400) {
    const sinaisAtivo =
      FRASES_A_VENDA.some((f) => lower.includes(f)) ||
      (lower.includes('application/ld+json') &&
        (lower.includes('residence') || lower.includes('apartment') || lower.includes('house')));
    if (sinaisAtivo) return 'a_venda';
  }

  return 'indeterminado';
}

/** Acessa o link do anúncio e infere se ainda está publicado. */
export async function verificarStatusLinkAnuncio(link: string): Promise<StatusLinkAnuncio> {
  if (!urlAnuncioPermitida(link)) return 'indeterminado';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(link.trim(), {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store',
    });

    const html = (await res.text()).slice(0, 120_000);
    return inferirStatusAnuncioPorHtml(html, res.status, res.url || link);
  } catch {
    return 'indeterminado';
  } finally {
    clearTimeout(timeout);
  }
}
