export type StatusLinkAnuncio = 'a_venda' | 'despublicado' | 'indeterminado';

export type VerificarLinkDiretoResult = {
  status: StatusLinkAnuncio;
  /** Portal bloqueou bot (Cloudflare etc.) — tentar Apify. */
  bloqueado: boolean;
  html: string;
  statusHttp: number;
  finalUrl: string;
};

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
  'publicação finalizada',
  'publicacao finalizada',
  'publicação encerrada',
  'publicacao encerrada',
  'aviso não está disponível',
  'aviso nao esta disponivel',
  'imóvel vendido',
  'imovel vendido',
  'imóvel alugado',
  'imovel alugado',
  'anúncio finalizado',
  'anuncio finalizado',
  'no longer available',
  'posting unavailable',
  'imóvel indisponível',
  'imovel indisponivel',
  'anúncio não está mais ativo',
  'anuncio nao esta mais ativo',
  'não encontramos a página',
  'nao encontramos a pagina',
  'ops! não encontramos',
  'ops! nao encontramos',
  'listingnotfound',
  'listing unavailable',
  'aviso finalizado',
  'aviso excluído',
  'aviso excluido',
  'aviso encerrado',
  'ops! o imóvel',
  'ops! o imovel',
  'não existe mais',
  'nao existe mais',
  'imóvel que você buscou',
  'imovel que voce buscou',
  'imóvel que voce buscou',
  'este aviso não está',
  'este aviso nao esta',
  'publicacion finalizada',
  'publicacion encerrada',
  'postingnotfound',
  'posting not found',
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
  'postingdetail',
  'posting-card',
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

export function extrairIdListingUrl(url: string): string | null {
  const patterns = [
    /-id-(\d+)/i,
    /[?&]id=(\d+)/i,
    /-(\d+)\.html(?:\?|#|$)/i,
    /\/(\d+)\.html(?:\?|#|$)/i,
    /\/propriedades\/[^/]+-(\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function normalizeLinkParaComparacao(link: string): string {
  const trimmed = link.trim();
  if (!trimmed) return '';
  try {
    const u = new URL(trimmed);
    u.hash = '';
    u.search = '';
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.protocol}//${u.host.toLowerCase()}${path}`;
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '').split('?')[0].split('#')[0];
  }
}

export function isPaginaBloqueadaBot(html: string, statusHttp: number): boolean {
  const lower = html.toLowerCase();
  if (
    lower.includes('just a moment') ||
    lower.includes('cloudflare') ||
    lower.includes('cf-challenge') ||
    lower.includes('performing security verification') ||
    lower.includes('attention required') ||
    lower.includes('captcha') ||
    lower.includes('access denied') ||
    lower.includes('datadome') ||
    lower.includes('captcha-delivery') ||
    lower.includes('please enable javascript')
  ) {
    return true;
  }
  if ((statusHttp === 403 || statusHttp === 429 || statusHttp === 503) && html.length < 20_000) {
    return true;
  }
  return false;
}

function isUrlDetalheAnuncioNavent(url: string): boolean {
  const u = url.toLowerCase();
  return (
    /imovelweb\.com\.br\/propriedades\/[^/]+\.html/.test(u) ||
    /vivareal\.com\.br\/imovel\/.+-id-\d+/.test(u) ||
    /zapimoveis\.com\.br\/imovel\/.+-id-\d+/.test(u)
  );
}

/** Anúncio ativo no Navent/ImovelWeb costuma trazer JSON-LD House/Apartment com offers e preço. */
function temJsonLdImovelAtivo(html: string): boolean {
  const lower = html.toLowerCase();
  if (!lower.includes('application/ld+json')) return false;
  const temTipoImovel =
    /"@type"\s*:\s*"(house|apartment|singlefamilyresidence|residence)"/i.test(html) ||
    lower.includes('"@type":"house"') ||
    lower.includes('"@type":"apartment"');
  const temPreco =
    /"offers"/i.test(html) ||
    (/"price"\s*:\s*\d+/i.test(html) && /"pricecurrency"\s*:\s*"brl"/i.test(html));
  return temTipoImovel && temPreco;
}

export function inferirStatusAnuncioPorHtml(
  html: string,
  statusHttp: number,
  finalUrl: string,
  originalUrl?: string,
): StatusLinkAnuncio {
  if (statusHttp === 404 || statusHttp === 410) return 'despublicado';

  const lower = html.toLowerCase();
  const urlLower = finalUrl.toLowerCase();
  const origem = originalUrl?.trim() || finalUrl;

  if (
    urlLower.includes('/404') ||
    urlLower.includes('not-found') ||
    urlLower.includes('nao-encontrado') ||
    urlLower.includes('nao-encontrada')
  ) {
    return 'despublicado';
  }

  const idOrig = extrairIdListingUrl(origem);
  const portalNavent = /imovelweb\.com\.br|vivareal\.com\.br|zapimoveis\.com\.br|olx\.com\.br/i.test(
    origem,
  );

  if (portalNavent && /\/imovel\//i.test(origem) && !/\/imovel\//i.test(finalUrl)) {
    return 'despublicado';
  }

  if (
    /imovelweb\.com\.br/i.test(origem) &&
    /\/propriedades\/[^/]+\.html/i.test(origem) &&
    !/\/propriedades\/[^/]+\.html/i.test(finalUrl)
  ) {
    return 'despublicado';
  }

  if (idOrig && portalNavent) {
    const idNoHtml =
      html.includes(idOrig) ||
      html.includes(`"id":"${idOrig}"`) ||
      html.includes(`"listingId":"${idOrig}"`) ||
      html.includes(`"postingId":"${idOrig}"`) ||
      html.includes(`-id-${idOrig}`);
    if (!finalUrl.includes(idOrig) && !idNoHtml) {
      return 'despublicado';
    }
  }

  if (
    /"notFound"\s*:\s*true/i.test(html) ||
    /"listingNotFound"\s*:\s*true/i.test(html) ||
    /"postingNotFound"\s*:\s*true/i.test(html) ||
    /"__typename"\s*:\s*"(NotFound|PostingNotFound)"/i.test(html) ||
    /"accountPublishabilityStatus"\s*:\s*"UNPUBLISHED"/i.test(html) ||
    /"listingStatus"\s*:\s*"(INACTIVE|OFFLINE|DELETED|UNPUBLISHED)"/i.test(html) ||
    /"postingAvailability"\s*:\s*"UNAVAILABLE"/i.test(html) ||
    /"publicationStatus"\s*:\s*"(FINISHED|UNPUBLISHED|INACTIVE)"/i.test(html) ||
    /"isPublished"\s*:\s*false/i.test(html)
  ) {
    return 'despublicado';
  }

  if (
    /"status"\s*:\s*"(OFFLINE|FINISHED|DELETED|UNPUBLISHED|INACTIVE)"/i.test(html) ||
    /"postingStatus"\s*:\s*"(offline|finished|deleted|inactive)"/i.test(html) ||
    /"postingState"\s*:\s*"(OFFLINE|FINISHED|DELETED)"/i.test(html)
  ) {
    return 'despublicado';
  }

  for (const frase of FRASES_DESPUBLICADO) {
    if (lower.includes(frase)) return 'despublicado';
  }

  if (statusHttp >= 200 && statusHttp < 400) {
    const sinaisAtivo =
      FRASES_A_VENDA.some((f) => lower.includes(f)) || temJsonLdImovelAtivo(html);
    if (sinaisAtivo) return 'a_venda';

    // ImovelWeb/Viva Real/ZAP: detalhe sem JSON-LD de imóvel ativo = aviso fora do ar
    if (isUrlDetalheAnuncioNavent(origem) && portalNavent && !temJsonLdImovelAtivo(html)) {
      return 'despublicado';
    }
  }

  return 'indeterminado';
}

/** Fetch direto (sem proxy) — pode ser bloqueado por Cloudflare. */
export async function verificarStatusLinkAnuncioDireto(
  link: string,
): Promise<VerificarLinkDiretoResult> {
  const vazio: VerificarLinkDiretoResult = {
    status: 'indeterminado',
    bloqueado: false,
    html: '',
    statusHttp: 0,
    finalUrl: link,
  };
  if (!urlAnuncioPermitida(link)) return vazio;

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
    const finalUrl = res.url || link;

    if (isPaginaBloqueadaBot(html, res.status)) {
      return {
        status: 'indeterminado',
        bloqueado: true,
        html,
        statusHttp: res.status,
        finalUrl,
      };
    }

    return {
      status: inferirStatusAnuncioPorHtml(html, res.status, finalUrl, link),
      bloqueado: false,
      html,
      statusHttp: res.status,
      finalUrl,
    };
  } catch {
    return vazio;
  } finally {
    clearTimeout(timeout);
  }
}

/** Acessa o link do anúncio e infere se ainda está publicado. */
export async function verificarStatusLinkAnuncio(link: string): Promise<StatusLinkAnuncio> {
  const direct = await verificarStatusLinkAnuncioDireto(link);
  return direct.status;
}
