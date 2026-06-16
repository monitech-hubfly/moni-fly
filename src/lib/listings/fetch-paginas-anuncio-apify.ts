const APIFY_BASE = 'https://api.apify.com/v2';
const CHEERIO_ACTOR_ID = 'apify~cheerio-scraper';

const PAGE_FUNCTION = `async function pageFunction(context) {
  const { request, body } = context;
  const status = context.response && context.response.statusCode ? context.response.statusCode : 200;
  return {
    url: request.loadedUrl || request.url,
    html: body,
    status,
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

/**
 * Busca HTML de URLs de anúncio via Apify (proxy residencial BR).
 * Usado quando portais como ImovelWeb bloqueiam fetch direto (Cloudflare).
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

  const timeoutMs = opts?.timeoutMs ?? 120_000;
  const runPayload = {
    startUrls: unicas.map((url) => ({ url })),
    pageFunction: PAGE_FUNCTION,
    maxRequestsPerCrawl: unicas.length,
    maxConcurrency: 3,
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: ['RESIDENTIAL'],
      apifyProxyCountry: 'BR',
    },
  };

  try {
    const runRes = await fetch(`${APIFY_BASE}/acts/${CHEERIO_ACTOR_ID}/runs?token=${token}`, {
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
      if (requested) result.set(requested, fetchResult);
      if (item.url) result.set(item.url.trim(), fetchResult);
    }
  } catch {
    return result;
  }

  return result;
}

export function apifyDisponivelParaFetchAnuncio(): boolean {
  return !!apifyToken();
}
