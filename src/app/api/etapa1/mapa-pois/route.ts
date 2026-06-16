import { NextResponse } from 'next/server';

const OVERPASS_HEADERS = {
  'Content-Type': 'text/plain',
  Accept: 'application/json',
  'User-Agent': 'MoniFly/1.0 (viabilidade; +https://monitech.com.br)',
} as const;

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
] as const;

const POI_CATEGORIES = [
  { key: 'school', overpassTag: 'amenity=school' },
  { key: 'hospital', overpassTag: 'amenity=hospital' },
  { key: 'clinic', overpassTag: 'amenity=clinic' },
  { key: 'mall', overpassTag: 'shop=mall' },
  { key: 'supermarket', overpassTag: 'shop=supermarket' },
  { key: 'park', overpassTag: 'leisure=park' },
  { key: 'square', overpassTag: 'place=square' },
  { key: 'bank', overpassTag: 'amenity=bank' },
  { key: 'pharmacy', overpassTag: 'amenity=pharmacy' },
] as const;

type PoiCategory = (typeof POI_CATEGORIES)[number]['key'];

export type Poi = { lat: number; lon: number; name: string; category: PoiCategory };

/** Via (avenida/rodovia): polyline em [lat, lon][] e nome opcional. */
export type Road = { name: string; coordinates: [number, number][] };

async function getBbox(
  cidade: string,
  estado: string | null,
): Promise<[number, number, number, number] | null> {
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
  return [south, west, north, east];
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
    if (json.remark && !(json.elements?.length ?? 0)) return null;
    if (!status.toString().startsWith('2') && !(json.elements?.length ?? 0)) return null;
    return json;
  } catch {
    return null;
  }
}

async function overpassQuery(query: string): Promise<OverpassResponse | null> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: query,
        headers: OVERPASS_HEADERS,
      });
      const text = await res.text();
      const json = parseOverpassBody(text, res.status);
      if (json) return json;
    } catch {
      /* tenta próximo mirror */
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

function elementsToPois(elements: OverpassElement[] | undefined): Poi[] {
  const pois: Poi[] = [];
  for (const el of elements ?? []) {
    const category = categoryFromTags(el.tags);
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

function buildPoiChunkQueries(bbox: [number, number, number, number]): string[] {
  const [south, west, north, east] = bbox;
  const box = `${south},${west},${north},${east}`;
  return [
    `[out:json][timeout:40];
(
  node["amenity"~"^(school|hospital|clinic|bank|pharmacy)$"](${box});
  way["amenity"~"^(school|hospital|clinic|bank|pharmacy)$"](${box});
);
out center;`,
    `[out:json][timeout:40];
(
  node["shop"~"^(mall|supermarket)$"](${box});
  way["shop"~"^(mall|supermarket)$"](${box});
);
out center;`,
    `[out:json][timeout:40];
(
  node["leisure"="park"](${box});
  way["leisure"="park"](${box});
  node["place"="square"](${box});
  way["place"="square"](${box});
);
out center;`,
  ];
}

async function fetchAllPois(
  bbox: [number, number, number, number],
): Promise<{ pois: Poi[]; warning?: string }> {
  const queries = buildPoiChunkQueries(bbox);
  const pois: Poi[] = [];
  let failedChunks = 0;

  for (const query of queries) {
    const json = await overpassQuery(query);
    if (!json) {
      failedChunks += 1;
      continue;
    }
    pois.push(...elementsToPois(json.elements));
  }

  if (pois.length === 0 && failedChunks === queries.length) {
    return {
      pois: [],
      warning:
        'Equipamentos urbanos temporariamente indisponíveis. O mapa da região continua disponível.',
    };
  }
  if (failedChunks > 0) {
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

async function fetchRoads(bbox: [number, number, number, number]): Promise<Road[]> {
  const [south, west, north, east] = bbox;
  const query = `
    [out:json][timeout:25];
    way(${south},${west},${north},${east})["highway"~"^(primary|secondary|trunk|motorway)$"];
    out geom;
  `;
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

/**
 * GET /api/etapa1/mapa-pois?cidade=Campinas&estado=SP
 * Retorna equipamentos urbanos (POIs), principais vias (avenidas/rodovias) e bbox. Executa no servidor.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cidade = searchParams.get('cidade')?.trim() ?? '';
    const estado = searchParams.get('estado')?.trim() || null;

    if (!cidade) {
      return NextResponse.json({ error: 'Informe o parâmetro cidade.' }, { status: 400 });
    }

    const bbox = await getBbox(cidade, estado);
    if (!bbox) {
      return NextResponse.json(
        { error: 'Não foi possível obter a área do município. Verifique cidade e estado.' },
        { status: 404 },
      );
    }

    const { pois, warning: poisWarning } = await fetchAllPois(bbox);
    const roads = await fetchRoads(bbox);

    const [south, west, north, east] = bbox;
    const centerLat = (south + north) / 2;
    const centerLon = (west + east) / 2;

    return NextResponse.json({
      pois,
      roads,
      bbox: { south, west, north, east, centerLat, centerLon },
      ...(poisWarning ? { warning: poisWarning } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao carregar equipamentos.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
