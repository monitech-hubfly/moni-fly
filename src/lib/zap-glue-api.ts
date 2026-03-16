/**
 * Chamada direta à API interna do ZAP (glue-api.zapimoveis.com.br).
 * Substitui o Apify para buscar listings com cidade, estado e condomínio.
 */

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

function noAccent(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

/** Coordenadas por cidade para addressPointLat/Lon (por enquanto só Campinas). */
const CITY_POINTS: Record<string, { lat: number; lon: number }> = {
  campinas: { lat: -22.863555, lon: -47.014484 },
};

/**
 * Monta a URL da glue-api v2 com parâmetros fixos (venda, casa/sobrado/condomínio, 4M) e dinâmicos (cidade/estado/condomínio).
 * Por enquanto usa valores fixos de Campinas/Loteamento Artesano para testar; depois generalizar.
 */
export function buildGlueApiUrl(
  cidade: string,
  estado: string,
  condominio: string | undefined,
  from: number,
  size: number
): string {
  const uf = estado.replace(/\s/g, "").slice(0, 2).toLowerCase();
  const stateName = UF_TO_STATE[uf] ?? estado.trim();
  const city = cidade.trim();
  const neighborhood = (condominio ?? "").trim();

  const stateNoAccent = noAccent(stateName);
  const cityNoAccent = noAccent(city);
  const neighborhoodNoAccent = noAccent(neighborhood);

  const addressLocationId = neighborhood
    ? `BR>${stateNoAccent}>NULL>${cityNoAccent}>Barrios>${neighborhoodNoAccent}`
    : `BR>${stateNoAccent}>NULL>${cityNoAccent}`;

  const cityKey = city.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const point = CITY_POINTS[cityKey] ?? { lat: -22.863555, lon: -47.014484 };

  return `https://glue-api.zapimoveis.com.br/v2/listings?business=SALE&parentId=null&listingType=USED%2CDEVELOPMENT&__zt=mtc%3Adeduplication2023&priceMin=4000000&addressCity=${encodeURIComponent(city || stateName)}&addressZone=&addressStreet=&addressLocationId=${encodeURIComponent(addressLocationId)}&addressState=${encodeURIComponent(stateName)}&addressNeighborhood=${encodeURIComponent(neighborhood)}&addressPointLat=${point.lat}&addressPointLon=${point.lon}&addressType=neighborhood&unitTypes=HOME%2CHOME%2CHOME&unitTypesV3=TWO_STORY_HOUSE%2CCONDOMINIUM%2CHOME&unitSubTypes=TWO_STORY_HOUSE%7CCONDOMINIUM%7CUnitSubType_NONE%2CTWO_STORY_HOUSE%2CSINGLE_STOREY_HOUSE%2CKITNET&usageTypes=RESIDENTIAL%2CRESIDENTIAL%2CRESIDENTIAL&page=1&size=${size}&from=${from}&images=webp&categoryPage=RESULT&includeFields=search%2Cpage%2Clistings`;
}

/** Headers para chamar a glue-api do browser (evita 403). Exportado para uso no frontend. */
export const GLUE_API_HEADERS: Record<string, string> = {
  accept: "*/*",
  "accept-encoding": "gzip, deflate, br, zstd",
  "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  origin: "https://www.zapimoveis.com.br",
  referer: "https://www.zapimoveis.com.br/",
  "sec-ch-ua": '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-site",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  "x-domain": ".zapimoveis.com.br",
};

/**
 * Formato esperado pelo restante do app (compatível com ZapListingItem e mapZapItemToCasa).
 */
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
  createdAt?: string;
};

/**
 * Mapeia um item do JSON da glue-api para ZapListingItem (campos que mapZapItemToCasa usa).
 * A glue-api pode retornar estruturas como: listingUrl, pricing/totalPrice, address, details, media/gallery.
 */
function mapGlueListingToItem(raw: Record<string, unknown>, index: number): ZapListingItem {
  const address = raw.address as Record<string, unknown> | undefined;
  const addrStreet = address?.street != null ? String(address.street) : undefined;
  const addrNeighborhood = address?.neighborhood != null ? String(address.neighborhood) : undefined;
  const addrCity = address?.city != null ? String(address.city) : undefined;

  const usableAreas = raw.usableAreas as string[] | number[] | undefined;
  const area = usableAreas?.[0] != null ? String(usableAreas[0]) : undefined;

  const bedroomsArr = raw.bedrooms as number[] | undefined;
  const bedroomsVal = bedroomsArr?.[0];
  const bedrooms = bedroomsVal !== undefined && Number.isFinite(Number(bedroomsVal)) ? Number(bedroomsVal) : undefined;

  const bathroomsArr = raw.bathrooms as number[] | undefined;
  const bathroomsVal = bathroomsArr?.[0];
  const bathrooms = bathroomsVal !== undefined && Number.isFinite(Number(bathroomsVal)) ? Number(bathroomsVal) : undefined;

  const parkingArr = raw.parkingSpaces as number[] | undefined;
  const parkingVal = parkingArr?.[0];
  const parking = parkingVal !== undefined && Number.isFinite(Number(parkingVal)) ? Number(parkingVal) : undefined;

  const pricingInfos = raw.pricingInfos as Array<{ price?: string | number }> | undefined;
  const priceStr =
    Array.isArray(pricingInfos) && pricingInfos[0]?.price != null ? String(pricingInfos[0].price) : undefined;

  const url = raw.id != null ? `https://www.zapimoveis.com.br/imovel/${raw.id}` : undefined;

  const mediasRaw = raw.medias as Array<{ url?: string; link?: string }> | undefined;
  const medias = Array.isArray(mediasRaw)
    ? mediasRaw.map((m) => ({ url: m?.url ?? m?.link }))
    : undefined;

  const location = [addrNeighborhood, addrCity].filter(Boolean).join(", ") || addrStreet || undefined;

  return {
    url,
    title: raw.title != null ? String(raw.title) : undefined,
    price: priceStr,
    location,
    street: addrStreet,
    area,
    bedrooms,
    bathrooms,
    parking,
    listingId: raw.id != null ? String(raw.id) : undefined,
    medias,
    listing: raw as Record<string, unknown>,
    createdAt: new Date().toISOString(),
  };
}

/** Mapeia um array de listings brutos da glue-api para ZapListingItem[]. Para uso no frontend. */
export function mapGlueApiListingsToItems(rawListings: Record<string, unknown>[]): ZapListingItem[] {
  return rawListings.map((raw, i) => mapGlueListingToItem(raw, i));
}

export type FetchZapListingsResult =
  | { ok: true; items: ZapListingItem[] }
  | { ok: false; error: string };

/**
 * Busca todos os listings na glue-api: monta URL, GET com headers de browser, pagina e mapeia.
 * Se cookieHeader for passado (ex.: cookies do request vindos do browser), repassa para a glue-api e evita 403 do Cloudflare.
 */
export async function fetchZapListings(
  cidade: string,
  estado: string,
  condominio?: string,
  cookieHeader?: string
): Promise<FetchZapListingsResult> {
  const pageSize = 24;
  const allListings: ZapListingItem[] = [];
  let from = 0;
  let hasMore = true;
  const headers = { ...GLUE_API_HEADERS };
  if (cookieHeader) {
    headers["cookie"] = cookieHeader;
  }

  while (hasMore) {
    const url = buildGlueApiUrl(cidade, estado, condominio, from, pageSize);
    const res = await fetch(url, {
      method: "GET",
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Glue-API ${res.status}: ${text.slice(0, 300)}` };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const result = (data.search as Record<string, unknown> | undefined)?.result as Record<string, unknown> | undefined;
    const rawListings = result?.listings;
    const listingsArray = Array.isArray(rawListings)
      ? (rawListings as Array<{ listing?: Record<string, unknown> }>).map((item) => item.listing).filter((l): l is Record<string, unknown> => l != null)
      : [];

    if (!Array.isArray(rawListings)) {
      return { ok: false, error: "Resposta da glue-api sem array listings (search.result.listings)." };
    }

    listingsArray.forEach((listing, i) => {
      allListings.push(mapGlueListingToItem(listing, from + i));
    });

    if (listingsArray.length < pageSize) {
      hasMore = false;
    } else {
      from += pageSize;
      if (from >= 500) hasMore = false;
    }
  }

  return { ok: true, items: allListings };
}
