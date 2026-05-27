/**
 * Busca ZAP via glue-api no servidor Next.js (sem depender da Edge Function zap-search).
 * Espelha supabase/functions/zap-search e zap-search-lotes.
 */

import {
  GLUE_API_HEADERS,
  mapGlueApiListingsToItems,
  type FetchZapListingsResult,
  type ZapListingItem,
} from '@/lib/zap-glue-api';

const UF_TO_STATE: Record<string, string> = {
  sp: 'São Paulo',
  rj: 'Rio de Janeiro',
  mg: 'Minas Gerais',
  pr: 'Paraná',
  rs: 'Rio Grande do Sul',
  sc: 'Santa Catarina',
  ba: 'Bahia',
  go: 'Goiás',
  pe: 'Pernambuco',
  df: 'Distrito Federal',
};

function noAccent(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

const CITY_POINTS: Record<string, { lat: number; lon: number }> = {
  campinas: { lat: -22.863555, lon: -47.014484 },
  'santana de parnaiba': { lat: -23.4442, lon: -46.9178 },
};

function cityPoint(city: string): { lat: number; lon: number } {
  const key = city
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
  return CITY_POINTS[key] ?? { lat: -22.863555, lon: -47.014484 };
}

function buildGlueApiUrlCasas(
  cidade: string,
  estado: string,
  condominio: string | undefined,
  from: number,
  size: number,
  variant: 'used' | 'development',
): string {
  const uf = estado.replace(/\s/g, '').slice(0, 2).toLowerCase();
  const stateName = UF_TO_STATE[uf] ?? estado.trim();
  const city = cidade.trim();
  const neighborhood = (condominio ?? '').trim();

  const stateNoAccent = noAccent(stateName);
  const cityNoAccent = noAccent(city);
  const neighborhoodNoAccent = noAccent(neighborhood);

  const addressLocationId = neighborhood
    ? `BR>${stateNoAccent}>NULL>${cityNoAccent}>Barrios>${neighborhoodNoAccent}`
    : `BR>${stateNoAccent}>NULL>${cityNoAccent}`;

  const point = cityPoint(city);

  const listingType = variant === 'used' ? 'USED' : 'DEVELOPMENT';
  const unitTypesV3 =
    variant === 'used' ? 'TWO_STORY_HOUSE%2CCONDOMINIUM%2CHOME' : 'RESIDENTIAL';

  return `https://glue-api.zapimoveis.com.br/v2/listings?business=SALE&parentId=null&listingType=${listingType}&__zt=mtc%3Adeduplication2023&priceMin=4000000&addressCity=${encodeURIComponent(city || stateName)}&addressZone=&addressStreet=&addressLocationId=${encodeURIComponent(addressLocationId)}&addressState=${encodeURIComponent(stateName)}&addressNeighborhood=${encodeURIComponent(neighborhood)}&addressPointLat=${point.lat}&addressPointLon=${point.lon}&addressType=neighborhood&unitTypes=HOME%2CHOME%2CHOME&unitTypesV3=${unitTypesV3}&unitSubTypes=TWO_STORY_HOUSE%7CCONDOMINIUM%7CUnitSubType_NONE%2CTWO_STORY_HOUSE%2CSINGLE_STOREY_HOUSE%2CKITNET&usageTypes=RESIDENTIAL%2CRESIDENTIAL%2CRESIDENTIAL&page=1&size=${size}&from=${from}&images=webp&categoryPage=RESULT&includeFields=search%2Cpage%2Clistings`;
}

function buildGlueApiUrlLotes(
  cidade: string,
  estado: string,
  condominio: string | undefined,
  from: number,
  size: number,
): string {
  const uf = estado.replace(/\s/g, '').slice(0, 2).toLowerCase();
  const stateName = UF_TO_STATE[uf] ?? estado.trim();
  const city = cidade.trim();
  const neighborhood = (condominio ?? '').trim();

  const stateNoAccent = noAccent(stateName);
  const cityNoAccent = noAccent(city);
  const neighborhoodNoAccent = noAccent(neighborhood);

  const addressLocationId = neighborhood
    ? `BR>${stateNoAccent}>NULL>${cityNoAccent}>Barrios>${neighborhoodNoAccent}`
    : `BR>${stateNoAccent}>NULL>${cityNoAccent}`;

  const point = cityPoint(city);

  return `https://glue-api.zapimoveis.com.br/v2/listings?business=SALE&listingType=USED&__zt=mtc%3Adeduplication2023&addressCity=${encodeURIComponent(city || stateName)}&addressZone=&addressStreet=&addressLocationId=${encodeURIComponent(addressLocationId)}&addressState=${encodeURIComponent(stateName)}&addressNeighborhood=${encodeURIComponent(neighborhood)}&addressPointLat=${point.lat}&addressPointLon=${point.lon}&addressType=neighborhood&unitTypes=ALLOTMENT_LAND&unitTypesV3=ALLOTMENT_LAND&usageTypes=RESIDENTIAL%2CRESIDENTIAL%2CRESIDENTIAL&page=1&size=${size}&from=${from}&images=webp&categoryPage=RESULT&includeFields=search%2Cpage%2Clistings`;
}

function glueHeaders(cookie?: string): Record<string, string> {
  const h = { ...GLUE_API_HEADERS };
  if (cookie) h.cookie = cookie;
  return h;
}

function extractListings(data: Record<string, unknown>): Record<string, unknown>[] {
  const result = (data.search as Record<string, unknown> | undefined)?.result as
    | Record<string, unknown>
    | undefined;
  const rawListings = result?.listings;
  if (!Array.isArray(rawListings)) return [];
  return (rawListings as Array<{ listing?: Record<string, unknown> }>)
    .map((item) => item.listing)
    .filter((l): l is Record<string, unknown> => l != null);
}

async function fetchGlueJson(url: string, cookie?: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { method: 'GET', headers: glueHeaders(cookie) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Glue-API ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/** Uma página de casas (USED + DEVELOPMENT combinados). */
export async function fetchZapCasasGluePage(
  cidade: string,
  estado: string,
  condominio: string | undefined,
  from: number,
  size: number,
  cookie?: string,
): Promise<ZapListingItem[]> {
  const [dataUsed, dataDev] = await Promise.all([
    fetchGlueJson(buildGlueApiUrlCasas(cidade, estado, condominio, from, size, 'used'), cookie),
    fetchGlueJson(
      buildGlueApiUrlCasas(cidade, estado, condominio, from, size, 'development'),
      cookie,
    ),
  ]);

  const listings = [...extractListings(dataUsed), ...extractListings(dataDev)];
  return mapGlueApiListingsToItems(listings);
}

/** Uma página de lotes. */
export async function fetchZapLotesGluePage(
  cidade: string,
  estado: string,
  condominio: string | undefined,
  from: number,
  size: number,
  cookie?: string,
): Promise<Record<string, unknown>[]> {
  const data = await fetchGlueJson(buildGlueApiUrlLotes(cidade, estado, condominio, from, size), cookie);
  return extractListings(data);
}

const PAGE_SIZE = 24;
const MAX_FROM = 500;

/** Todas as casas (paginação). */
export async function fetchAllZapCasas(opts: {
  cidade: string;
  estado: string;
  condominio?: string;
  cookie?: string;
}): Promise<FetchZapListingsResult> {
  const allItems: ZapListingItem[] = [];
  let from = 0;

  try {
    while (from < MAX_FROM) {
      const page = await fetchZapCasasGluePage(
        opts.cidade,
        opts.estado,
        opts.condominio,
        from,
        PAGE_SIZE,
        opts.cookie,
      );
      if (page.length === 0) break;
      allItems.push(...page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return { ok: true, items: allItems };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
