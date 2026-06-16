const APIFY_BASE = 'https://api.apify.com/v2';
const PUPPETEER_ACTOR_ID = 'apify~puppeteer-scraper';

const PAGE_FUNCTION = `async function pageFunction(context) {
  const { page, request, response } = context;
  await page.waitForSelector('body', { timeout: 20000 }).catch(function() {});
  await page.waitForFunction(function() {
    var html = document.documentElement.innerHTML.toLowerCase();
    return html.indexOf('application/ld+json') >= 0
      || html.indexOf('nao encontramos') >= 0
      || html.indexOf('não encontramos') >= 0
      || html.indexOf('postingnotfound') >= 0
      || html.indexOf('aviso finalizado') >= 0
      || html.indexOf('listingnotfound') >= 0
      || html.indexOf('imovel indisponivel') >= 0
      || html.indexOf('imóvel indisponível') >= 0;
  }, { timeout: 12000 }).catch(function() {});
  await new Promise(function(r) { setTimeout(r, 1500); });
  const html = await page.content();
  const status = response && typeof response.status === 'function' ? response.status() : 200;
  return {
    url: request.loadedUrl || request.url,
    html: html,
    status: status,
  };
}`;

export type PaginaAnuncioFetch = {
  html: string;
  status: number;
  url: string;
};

function apifyToken(): string | null {
  return process.env.VITE_APIFY_TOKEN || process.env.APIFY_API_TOKEN || null;
}

async function aguardarRunApify(
  token: string,
  runId: string,
  timeoutMs: number,
): Promise<{ ok: true; datasetId: string } | { ok: false; error: string }> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
    const statusText = await statusRes.text();
    if (!statusRes.ok) {
      return { ok: false, error: `Falha ao consultar run Apify: ${statusRes.status}` };
    }
    const statusData = JSON.parse(statusText) as {
      data: { status: string; defaultDatasetId?: string };
    };
    const runStatus = statusData.data.status;
    if (runStatus === 'SUCCEEDED') {
      const datasetId = statusData.data.defaultDatasetId;
      if (!datasetId) return { ok: false, error: 'Run Apify sem dataset.' };
      return { ok: true, datasetId };
    }
    if (runStatus === 'FAILED' || runStatus === 'ABORTED' || runStatus === 'TIMED-OUT') {
      return { ok: false, error: `Run Apify ${runStatus.toLowerCase()}.` };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { ok: false, error: 'Timeout ao aguardar Apify.' };
}

function registrarPagina(
  map: Map<string, PaginaAnuncioFetch>,
  chave: string,
  pagina: PaginaAnuncioFetch,
): void {
  const k = chave.trim();
  if (!k) return;
  map.set(k, pagina);
}

/**
 * Busca HTML de URLs de anúncio via Apify Puppeteer (proxy residencial BR).
 * Usado quando portais como Viva Real / ImovelWeb bloqueiam fetch direto (Cloudflare).
 */
export async function fetchPaginasAnuncioViaApify(
  urls: string[],
  opts?: { timeoutMs?: number; maxUrls?: number },
): Promise<Map<string, PaginaAnuncioFetch>> {
  const token = apifyToken();
  const result = new Map<string, PaginaAnuncioFetch>();
  if (!token) return result;

  const limite = opts?.maxUrls ?? 25;
  const unicas = [...new Set(urls.map((u) => u.trim()).filter(Boolean))].slice(0, limite);
  if (unicas.length === 0) return result;

  const timeoutMs = opts?.timeoutMs ?? 180_000;
  const runPayload = {
    startUrls: unicas.map((url) => ({ url })),
    pageFunction: PAGE_FUNCTION,
    maxRequestsPerCrawl: unicas.length,
    maxConcurrency: 2,
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL'],
      apifyProxyCountry: 'BR',
    },
    launchContext: {
      launchOptions: {
        headless: true,
      },
    },
  };

  try {
    const runRes = await fetch(`${APIFY_BASE}/acts/${PUPPETEER_ACTOR_ID}/runs?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(runPayload),
    });
    if (!runRes.ok) return result;

    const runData = (await runRes.json()) as { data: { id: string } };
    const waited = await aguardarRunApify(token, runData.data.id, timeoutMs);
    if (!waited.ok) return result;

    const datasetRes = await fetch(
      `${APIFY_BASE}/datasets/${waited.datasetId}/items?token=${token}`,
    );
    if (!datasetRes.ok) return result;

    const items = (await datasetRes.json()) as Array<{
      url?: string;
      html?: string;
      status?: number;
    }>;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const html = item.html ?? '';
      if (!html) continue;
      const fetchResult: PaginaAnuncioFetch = {
        html,
        status: item.status ?? 200,
        url: item.url?.trim() || unicas[i] || '',
      };
      const requested = unicas[i];
      if (requested) registrarPagina(result, requested, fetchResult);
      if (item.url) registrarPagina(result, item.url, fetchResult);
    }
  } catch {
    return result;
  }

  return result;
}

export function apifyDisponivelParaFetchAnuncio(): boolean {
  return !!apifyToken();
}
