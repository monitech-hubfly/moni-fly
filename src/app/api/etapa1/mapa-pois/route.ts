import { NextResponse } from 'next/server';

export const maxDuration = 60;

const OVERPASS_HEADERS = {
  'Content-Type': 'text/plain',
  Accept: 'application/json',
  'User-Agent': 'MoniFly/1.0 (viabilidade; +https://monitech.com.br)',
} as const;

/** Mirrors rápidos primeiro; overpass-api.de costuma dar timeout em áreas grandes. */
const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
] as const;

const OVERPASS_REQUEST_MS = 18_000;

const POI_CATEGORIES = [
  { key: 'school', tagKey: 'amenity', tagValue: 'school' },
  { key: 'hospital', tagKey: 'amenity', tagValue: 'hospital' },
  { key: 'clinic', tagKey: 'amenity', tagValue: 'clinic' },
  { key: 'mall', tagKey: 'shop', tagValue: 'mall' },
  { key: 'supermarket', tagKey: 'shop', tagValue: 'supermarket' },
  { key: 'park', tagKey: 'leisure', tagValue: 'park' },
  { key: 'square', tagKey: 'place', tagValue: 'square' },
  { key: 'bank', tagKey: 'amenity', tagValue: 'bank' },
  { key: 'pharmacy', tagKey: 'amenity', tagValue: 'pharmacy' },
] as const;

type PoiCategory = (typeof POI_CATEGORIES)[number]['key'];

export type Poi = { lat: number; lon: number; name: string; category: PoiCategory };

/** Via (avenida/rodovia): polyline em [lat, lon][] e nome opcional. */
export type Road = { name: string; coordinates: [number, number][] };

type CityArea = {
  south: number;
  west: number;
  north: number;
  east: number;
  centerLat: number;
  centerLon: number;
  searchRadiusM: number;
};

/** Raio urbano em torno do centro — evita bbox municipal enorme (timeout no Overpass). */
const POI_SEARCH_RADIUS_M = 10_000;

async function getCityArea(cidade: string, estado: string | null): Promise<CityArea | null> {
  const query = estado ? `${cidade}, ${estado}, Brazil` : `${cidade}, Brazil`;
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
    {
      headers: {
        'Accept-Language': 'pt-BR',
        'User-Agent': 'MoniFly/1.0 (viabilidade; +https://monitech.com.br)',
      },
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { boundingbox?: string[] }[];
  if (!data?.[0]?.boundingbox) return null;
  const [south, north, west, east] = data[0].boundingbox.map(Number);
  const centerLat = (south + north) / 2;
  const centerLon = (west + east) / 2;
  return {
    south,
    west,
    north,
    east,
    centerLat,
    centerLon,
    searchRadiusM: POI_SEARCH_RADIUS_M,
  };
}

type OverpassElement = {
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements?: OverpassElement[]; remark?: string; error?: string };

function parseOverpassBody(text: string, status: number): OverpassResponse | null {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('{')) return null;
  try {
    const json = JSON.parse(text) as OverpassResponse;
    if (json.error && !(json.elements?.length ?? 0)) return null;
    if (json.remark && !(json.elements?.length ?? 0)) return null;
    if (!String(status).startsWith('2') && !(json.elements?.length ?? 0)) return null;
    return json;
  } catch {
    return null;
  }
}

async function overpassQuery(query: string): Promise<OverpassResponse | null> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OVERPASS_REQUEST_MS);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: query,
        headers: OVERPASS_HEADERS,
        signal: controller.signal,
      });
      const text = await res.text();
      const json = parseOverpassBody(text, res.status);
      if (json) return json;
    } catch {
      /* tenta próximo mirror */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function categoryFromTags(tags?: Record<string, string>): PoiCategory | null {
  if (!tags) return null;
  const amenity = tags.amenity;
  if (
    amenity === 'school' ||
    amenity === 'hospital' ||
    amenity === 'clinic' ||
    amenity === 'bank' ||
    amenity === 'pharmacy'
  ) {
    return amenity;
  }
  const shop = tags.shop;
  if (shop === 'mall' || shop === 'supermarket') return shop;
  if (tags.leisure === 'park') return 'park';
  if (tags.place === 'square') return 'square';
  return null;
}

function elementsToPois(elements: OverpassElement[] | undefined, fallbackCategory?: PoiCategory): Poi[] {
  const pois: Poi[] = [];
  for (const el of elements ?? []) {
    const category = categoryFromTags(el.tags) ?? fallbackCategory;
    if (!category) continue;
    let lat: number | undefined;
    let lon: number | undefined;
    if (el.type === 'node') {
      lat = el.lat;
      lon = el.lon;
    } else if (el.center) {
      lat = el.center.lat;
      lon = el.center.lon;
    }
    if (lat != null && lon != null) {
      pois.push({ lat, lon, name: el.tags?.name ?? '', category });
    }
  }
  return pois;
}

function buildPoiQuery(
  centerLat: number,
  centerLon: number,
  radiusM: number,
  tagKey: string,
  tagValue: string,
): string {
  const around = `(around:${radiusM},${centerLat},${centerLon})`;
  return `[out:json][timeout:15];node["${tagKey}"="${tagValue}"]${around};out;`;
}

async function fetchAllPois(area: CityArea): Promise<{ pois: Poi[]; warning?: string }> {
  const pois: Poi[] = [];
  let failedCategories = 0;

  for (const cat of POI_CATEGORIES) {
    const query = buildPoiQuery(
      area.centerLat,
      area.centerLon,
      area.searchRadiusM,
      cat.tagKey,
      cat.tagValue,
    );
    const json = await overpassQuery(query);
    if (!json) {
      failedCategories += 1;
      continue;
    }
    pois.push(...elementsToPois(json.elements, cat.key));
  }

  if (pois.length === 0 && failedCategories === POI_CATEGORIES.length) {
    return {
      pois: [],
      warning:
        'Equipamentos urbanos temporariamente indisponíveis. O mapa da região continua disponível.',
    };
  }
  if (failedCategories > 0) {
    return {
      pois,
      warning: 'Alguns equipamentos urbanos não puderam ser carregados (dados parciais).',
    };
  }
  return { pois };
}

type OverpassWayElement = {
  type: 'way';
  id: number;
  geometry?: { lat: number; lon: number }[];
  tags?: { name?: string; highway?: string };
};

async function fetchRoads(area: CityArea): Promise<Road[]> {
  const { centerLat, centerLon, searchRadiusM } = area;
  const query = `[out:json][timeout:15];
way(around:${searchRadiusM},${centerLat},${centerLon})["highway"~"^(primary|secondary|trunk|motorway)$"];
out geom;`;
  const json = await overpassQuery(query);
  if (!json) return [];
  const ways = (json.elements ?? []).filter(
    (el): el is OverpassWayElement => el.type === 'way' && Array.isArray((el as OverpassWayElement).geometry),
  );
  const roads: Road[] = [];
  for (const w of ways) {
    const geom = w.geometry;
    if (!geom || geom.length < 2) continue;
    const coordinates = geom.map((g) => [g.lat, g.lon] as [number, number]);
    roads.push({ name: w.tags?.name ?? '', coordinates });
  }
  return roads;
}

function jsonFromArea(area: CityArea, pois: Poi[] = [], roads: Road[] = [], warning?: string) {
  const { south, west, north, east, centerLat, centerLon } = area;
  return NextResponse.json({
    pois,
    roads,
    bbox: { south, west, north, east, centerLat, centerLon },
    ...(warning ? { warning } : {}),
  });
}

/**
 * GET /api/etapa1/mapa-pois?cidade=Campinas&estado=SP
 * GET /api/etapa1/mapa-pois?cidade=Campinas&estado=SP&centerOnly=1  — só centro (mapa imediato)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cidade = searchParams.get('cidade')?.trim() ?? '';
    const estado = searchParams.get('estado')?.trim() || null;
    const centerOnly = searchParams.get('centerOnly') === '1';

    if (!cidade) {
      return NextResponse.json({ error: 'Informe o parâmetro cidade.' }, { status: 400 });
    }

    const area = await getCityArea(cidade, estado);
    if (!area) {
      return NextResponse.json(
        { error: 'Não foi possível obter a área do município. Verifique cidade e estado.' },
        { status: 404 },
      );
    }

    if (centerOnly) {
      return jsonFromArea(area);
    }

    const { pois, warning: poisWarning } = await fetchAllPois(area);
    const roads = await fetchRoads(area);

    return jsonFromArea(area, pois, roads, poisWarning);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar equipamentos.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
