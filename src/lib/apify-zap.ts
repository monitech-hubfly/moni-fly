/**
 * Integração com o Apify Actor "ZAP Imóveis Scraper" (fatihtahta/zap-imoveis-scraper).
 * Gera startUrl a partir de cidade/estado/condomínio, chama a API do Apify, faz polling até SUCCEEDED e devolve itens.
 * Token: VITE_APIFY_TOKEN ou APIFY_API_TOKEN no .env.local. Opcional: APIFY_ACTOR_ZAP_ID.
 */

const DEFAULT_ACTOR_ID = "fatihtahta/zap-imoveis-scraper";
const APIFY_BASE = "https://api.apify.com/v2";

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Slug do condomínio como a ZAP usa: "Loteamento X" vira "lot-x".
 */
function condominioSlug(nome: string): string {
  const t = nome.trim();
  if (!t) return "";
  const match = t.match(/^loteamento\s+(.+)$/i);
  if (match) return "lot-" + slugify(match[1]);
  return slugify(t);
}

/** Remove acentos para o trecho BR>... do parâmetro onde. */
function noAccent(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

/** Nome completo do estado a partir da UF (para o parâmetro onde). */
const UF_TO_STATE: Record<string, string> = {
  sp: "São Paulo",
  rj: "Rio de Janeiro",
  mg: "Minas Gerais",
  pr: "Paraná",
  rs: "Rio Grande do Sul",
  sc: "Santa Catarina",
  ba: "Bahia",
  go: "Goiás",
  pe: "Pernambuco",
  df: "Distrito Federal",
};

/** Coordenadas aproximadas (lat,lng) por cidade para o parâmetro onde. Fallback: capital SP. */
const CITY_COORDS: Record<string, string> = {
  campinas: "-22.863555,-47.014484",
  "santana de parnaiba": "-23.476859,-46.866202",
  "são paulo": "-23.550520,-46.633308",
  "sao paulo": "-23.550520,-46.633308",
  "rio de janeiro": "-22.906847,-43.172897",
  "belo horizonte": "-19.916681,-43.934493",
};

function getCoords(cidade: string, uf: string): string {
  const key = cidade.trim().toLowerCase();
  const keyNorm = key.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  return (
    CITY_COORDS[key] ??
    CITY_COORDS[keyNorm] ??
    (uf.toLowerCase() === "sp" ? "-23.550520,-46.633308" : "0,0")
  );
}

/**
 * Monta o parâmetro "onde" da ZAP (estado, cidade, bairro/condomínio, coordenadas).
 * O Actor do Apify usa isso para "derive location filters"; sem ele retorna 0 resultados.
 */
function buildOndeParam(cidade: string, estado: string, condominio?: string): string {
  const uf = estado.replace(/\s/g, "").slice(0, 2).toLowerCase();
  const stateName = UF_TO_STATE[uf] ?? estado;
  const city = cidade.trim();
  const neighborhood = (condominio || "").trim();
  const coords = getCoords(cidade, estado);
  const stateNoAccent = noAccent(stateName);
  const cityNoAccent = noAccent(city);
  const neighborhoodNoAccent = neighborhood ? noAccent(neighborhood) : "";
  const ondeRaw = `,${stateName},${city},,${neighborhood},,,neighborhood,BR>${stateNoAccent}>NULL>${cityNoAccent}>Barrios>${neighborhoodNoAccent},${coords},`;
  return encodeURIComponent(ondeRaw);
}

/**
 * Monta a URL de busca ZAP igual à que retorna resultados na ZAP (Sobrados + Casa + Casa de condomínio):
 * - path: /venda/sobrados/{uf}+{cidade}++{condominio}
 * - onde: parâmetro que o Actor do Apify usa para extrair location filters (obrigatório para não dar 0 resultados)
 * - tipos + preço mínimo: R$ 4.000.000
 */
const ZAP_TIPOS = "sobrado_residencial%2Ccondominio_residencial%2Ccasa_residencial";

export function buildZapSearchUrl(cidade: string, estado: string, condominio?: string): string {
  const uf = estado.replace(/\s/g, "").slice(0, 2).toLowerCase();
  const citySlug = slugify(cidade || "");
  if (!citySlug || !uf) {
    return "";
  }
  const condSlug = condominio ? condominioSlug(condominio) : "";
  const pathSegment = condSlug ? `${uf}+${citySlug}++${condSlug}` : `${uf}+${citySlug}`;
  const onde = buildOndeParam(cidade.trim(), estado, condominio?.trim());
  const base = `https://www.zapimoveis.com.br/venda/sobrados/${pathSegment}/?transacao=venda&onde=${onde}&tipos=${ZAP_TIPOS}&precoMinimo=4000000`;
  return base;
}

export type ZapListingItem = {
  url?: string;
  title?: string;
  price?: string;
  location?: string;
  street?: string;
  area?: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  listingId?: string;
  medias?: Array<{ url?: string }>;
  listing?: Record<string, unknown>;
  createdAt?: string; // data do levantamento (Apify)
};

/** Debug temporário: para inspecionar token, URL e resposta do Apify no console do navegador (F12). */
export type ZapRunDebug = {
  tokenPresent: boolean;
  urlSent: string;
  runStatus?: string;
  apiResponse?: unknown;
  apiError?: string;
};

export type RunZapResult =
  | { ok: true; items: ZapListingItem[]; runId: string; debug: ZapRunDebug }
  | { ok: false; error: string; debug: ZapRunDebug };

/**
 * Dispara o actor ZAP no Apify, espera terminar (até timeoutMs) e retorna os itens do dataset.
 */
export async function runZapScraper(
  cidade: string,
  estado: string,
  condominio?: string,
  limit = 300,
  timeoutMs = 120_000
): Promise<RunZapResult> {
  const token = process.env.VITE_APIFY_TOKEN || process.env.APIFY_API_TOKEN;
  const tokenPresent = !!token;

  const actorId = (process.env.APIFY_ACTOR_ZAP_ID || DEFAULT_ACTOR_ID).replace(/\//g, "~");
  const startUrl = buildZapSearchUrl(cidade, estado, condominio);

  const baseDebug: ZapRunDebug = {
    tokenPresent,
    urlSent: startUrl || "(URL não gerada – falta cidade/estado)",
  };

  if (!token) {
    return {
      ok: false,
      error: "Token Apify não configurado. Defina VITE_APIFY_TOKEN ou APIFY_API_TOKEN no .env.local.",
      debug: { ...baseDebug, apiError: "Token ausente" },
    };
  }
  if (!startUrl) {
    return {
      ok: false,
      error: "Cidade e estado são obrigatórios para montar a busca ZAP.",
      debug: { ...baseDebug, apiError: "URL não gerada" },
    };
  }

  return runZapScraperWithUrl(startUrl, limit, timeoutMs);
}

/**
 * Dispara o actor ZAP no Apify com a URL já montada (para uso em API Route, server-side, sem CORS).
 * Recebe a URL do ZAP, faz run → polling SUCCEEDED → GET datasets/{defaultDatasetId}/items e retorna os itens.
 */
export async function runZapScraperWithUrl(
  startUrl: string,
  limit = 300,
  timeoutMs = 120_000
): Promise<RunZapResult> {
  const token = process.env.VITE_APIFY_TOKEN || process.env.APIFY_API_TOKEN;
  const baseDebug: ZapRunDebug = {
    tokenPresent: !!token,
    urlSent: startUrl,
  };

  if (!token) {
    return {
      ok: false,
      error: "Token Apify não configurado.",
      debug: { ...baseDebug, apiError: "Token ausente" },
    };
  }

  const actorId = (process.env.APIFY_ACTOR_ZAP_ID || DEFAULT_ACTOR_ID).replace(/\//g, "~");
  const runPayload = {
    startUrls: [{ url: startUrl }],
    proxyConfiguration: {
      useApifyProxy: true,
      apifyProxyGroups: ["RESIDENTIAL"],
      apifyProxyCountry: "BR",
    },
  };

  const runsUrl = `${APIFY_BASE}/acts/${actorId}/runs?token=${token}`;
  try {
    const runRes = await fetch(runsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runPayload),
    });

    const runResText = await runRes.text();
    if (!runRes.ok) {
      return {
        ok: false,
        error: `Apify run: ${runRes.status} ${runResText}`,
        debug: { ...baseDebug, runStatus: String(runRes.status), apiResponse: runResText, apiError: runResText },
      };
    }

    const runData = JSON.parse(runResText) as { data: { id: string } };
    const runId = runData.data.id;
    console.log("[APIFY-ZAP] runId:", runId);

    let runStatus = "RUNNING";
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
      const statusText = await statusRes.text();
      if (!statusRes.ok) {
        return {
          ok: false,
          error: `Falha ao consultar status: ${statusRes.status}`,
          debug: { ...baseDebug, runStatus, apiResponse: statusText, apiError: statusText },
        };
      }
      const statusData = JSON.parse(statusText) as { data: { status: string; defaultDatasetId?: string } };
      runStatus = statusData.data.status;
      if (runStatus === "SUCCEEDED") {
        const defaultDatasetId = statusData.data.defaultDatasetId;
        console.log("[APIFY-ZAP] defaultDatasetId:", defaultDatasetId ?? "(ausente)");
        if (!defaultDatasetId) {
          return {
            ok: false,
            error: "Run SUCCEEDED mas a resposta não trouxe defaultDatasetId. Tente novamente.",
            debug: { ...baseDebug, runStatus, apiResponse: statusData },
          };
        }
        const datasetRes = await fetch(
          `${APIFY_BASE}/datasets/${defaultDatasetId}/items?token=${token}`
        );
        const datasetText = await datasetRes.text();
        if (!datasetRes.ok) {
          console.log("[APIFY-ZAP] dataset/items status:", datasetRes.status, "| body:", datasetText.slice(0, 200));
          return {
            ok: false,
            error: `Falha ao obter itens do dataset: ${datasetRes.status}. Resposta: ${datasetText.slice(0, 200)}`,
            debug: { ...baseDebug, runStatus, apiResponse: datasetText, apiError: datasetText },
          };
        }
        let items: ZapListingItem[];
        try {
          items = JSON.parse(datasetText) as ZapListingItem[];
        } catch {
          return {
            ok: false,
            error: "Resposta do dataset não é JSON válido.",
            debug: { ...baseDebug, runStatus, apiResponse: datasetText.slice(0, 300) },
          };
        }
        const itemList = Array.isArray(items) ? items : [];
        console.log("[APIFY-ZAP] quantidade de itens retornados pelo dataset:", itemList.length);
        console.log("[APIFY-ZAP] primeiro item completo:", itemList[0] ?? "(nenhum)");
        return {
          ok: true,
          items: itemList,
          runId,
          debug: { ...baseDebug, runStatus, apiResponse: { itemCount: itemList.length, runId, defaultDatasetId } },
        };
      }
      if (runStatus === "FAILED" || runStatus === "ABORTED" || runStatus === "TIMED-OUT") {
        return {
          ok: false,
          error: `Apify terminou com status ${runStatus}. Veja o run no painel Apify (Runs) para mais detalhes.`,
          debug: { ...baseDebug, runStatus, apiResponse: statusData },
        };
      }
      await new Promise((r) => setTimeout(r, 3000)); // polling a cada 3 segundos
    }

    return {
      ok: false,
      error: "Timeout: o run do Apify não terminou a tempo.",
      debug: { ...baseDebug, runStatus: "TIMEOUT" },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: message,
      debug: { ...baseDebug, apiError: message },
    };
  }
}

/**
 * Extrai cidade, estado e condomínio:
 * - Primeiro tenta pelo campo location (ex.: "Loteamento Artesano, Campinas - SP").
 * - Se não achar condomínio ali, tenta em campos internos do listing (condominium, project, etc.).
 */
function parseLocation(
  location: string | undefined,
  listing?: Record<string, unknown>
): { cidade: string; estado: string; condominio: string | null } {
  let cidade = "";
  let estado = "";
  let condominio: string | null = null;

  if (location && location.trim()) {
    const loc = location.trim();
    const dashIdx = loc.lastIndexOf(" - ");
    estado = dashIdx >= 0 ? loc.slice(dashIdx + 3).trim() : "";
    const beforeState = dashIdx >= 0 ? loc.slice(0, dashIdx).trim() : loc;
    const parts = beforeState.split(",").map((p) => p.trim()).filter(Boolean);
    cidade = parts.length >= 2 ? parts[parts.length - 1] : parts[0] || "";
    condominio = parts.length >= 2 ? parts.slice(0, -1).join(", ") : null;
  }

  if (!condominio && listing && typeof listing === "object") {
    const addr = listing.address as Record<string, unknown> | undefined;
    const candidates: unknown[] = [];
    if (addr) {
      candidates.push(
        addr.neighborhood,
        (addr as Record<string, unknown>).condominium,
        (addr as Record<string, unknown>).condominiumName
      );
    }
    const anyListing = listing as Record<string, unknown>;
    candidates.push(
      anyListing.condominium,
      anyListing.condominiumName,
      anyListing.project,
      (anyListing.project as Record<string, unknown> | undefined)?.name
    );

    const found = candidates
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .find((v) => v.length > 0);
    if (found) condominio = found;
  }

  // Heurística extra: se em qualquer texto aparecer "Artesano", forçamos nome do condomínio.
  if (!condominio) {
    const textos: string[] = [];
    if (location) textos.push(location);
    if (listing && typeof listing === "object") {
      const anyListing = listing as Record<string, unknown>;
      const addr = anyListing.address as Record<string, unknown> | undefined;
      if (addr) {
        textos.push(
          String(addr.neighborhood ?? ""),
          String((addr as Record<string, unknown>).condominium ?? ""),
          String((addr as Record<string, unknown>).condominiumName ?? "")
        );
      }
      textos.push(
        String(anyListing.condominium ?? ""),
        String(anyListing.condominiumName ?? ""),
        String(anyListing.project ?? ""),
        String((anyListing.project as Record<string, unknown> | undefined)?.name ?? ""),
        String(anyListing.title ?? "")
      );
    }
    const hasArtesano = textos.some((t) =>
      t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().includes("artesano")
    );
    if (hasArtesano) {
      condominio = "Loteamento Artesano";
    }
  }

  return { cidade, estado, condominio };
}

/**
 * Mapeia item do JSON Apify para a tabela listings_casas (colunas da Etapa 4).
 * Cidade/Estado/Condomínio extraídos de location; Piscina/Móveis em amenities; Data levantamento = createdAt.
 */
export function mapZapItemToCasa(
  item: ZapListingItem,
  _cidadeInput: string,
  _estadoInput: string
): {
  cidade: string;
  estado: string;
  status: string;
  condominio: string | null;
  localizacao_condominio: string | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  piscina: boolean;
  marcenaria: boolean;
  preco: number | null;
  area_casa_m2: number | null;
  preco_m2: number | null;
  link: string | null;
  foto_url: string | null;
  data_publicacao: string | null;
} {
  const priceNum = item.price ? parseInt(String(item.price).replace(/\D/g, ""), 10) : null;
  const areaNum = item.area ? parseFloat(String(item.area).replace(",", ".")) : null;
  const precoM2 =
    priceNum != null && areaNum != null && areaNum > 0 ? priceNum / areaNum : null;

  const listing = item.listing as Record<string, unknown> | undefined;
  const { cidade, estado, condominio } = parseLocation(item.location, listing);
  const cidadeNorm = cidade || _cidadeInput;
  const estadoNorm = estado || _estadoInput.slice(0, 2).toUpperCase();

  const firstMedia = item.medias?.[0];
  const fotoUrl =
    typeof firstMedia === "object" && firstMedia?.url
      ? firstMedia.url
      : Array.isArray(item.medias) && item.medias[0]
        ? (item.medias[0] as { url?: string }).url
        : null;

  let piscina = false;
  let marcenaria = false;
  if (listing && typeof listing === "object") {
    const amenities = listing.amenities as string[] | undefined;
    if (Array.isArray(amenities)) {
      const a = amenities.join(" ").toLowerCase();
      piscina = /piscina|pool/i.test(a);
      marcenaria = /planejad|móveis|moveis|marcenaria/i.test(a);
    }
  }

  const dataLevantamento = item.createdAt ?? null;

  return {
    cidade: cidadeNorm,
    estado: estadoNorm,
    status: "a_venda",
    condominio: condominio || null,
    localizacao_condominio: item.street || item.location || null,
    quartos: item.bedrooms ?? null,
    banheiros: item.bathrooms ?? null,
    vagas: item.parking ?? null,
    piscina,
    marcenaria,
    preco: priceNum,
    area_casa_m2: areaNum,
    preco_m2: precoM2,
    link: item.url || null,
    foto_url: fotoUrl || null,
    data_publicacao: dataLevantamento,
  };
}
