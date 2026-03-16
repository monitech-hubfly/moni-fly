import { NextResponse } from "next/server";

const CATEGORIES = [
  { key: "school", overpassTag: "amenity=school" },
  { key: "hospital", overpassTag: "amenity=hospital" },
  { key: "clinic", overpassTag: "amenity=clinic" },
  { key: "mall", overpassTag: "shop=mall" },
  { key: "supermarket", overpassTag: "shop=supermarket" },
  { key: "park", overpassTag: "leisure=park" },
  { key: "square", overpassTag: "place=square" },
  { key: "bank", overpassTag: "amenity=bank" },
  { key: "pharmacy", overpassTag: "amenity=pharmacy" },
] as const;

type PoiCategory = (typeof CATEGORIES)[number]["key"];

export type Poi = { lat: number; lon: number; name: string; category: PoiCategory };

/** Via (avenida/rodovia): polyline em [lat, lon][] e nome opcional. */
export type Road = { name: string; coordinates: [number, number][] };

async function getBbox(
  cidade: string,
  estado: string | null
): Promise<[number, number, number, number] | null> {
  const query = estado ? `${cidade}, ${estado}, Brazil` : `${cidade}, Brazil`;
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
    { headers: { "Accept-Language": "pt-BR", "User-Agent": "ViabilidadeApp/1.0" } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { boundingbox?: string[] }[];
  if (!data?.[0]?.boundingbox) return null;
  const [south, north, west, east] = data[0].boundingbox.map(Number);
  return [south, west, north, east];
}

async function fetchOverpass(
  bbox: [number, number, number, number],
  tag: string,
  category: PoiCategory
): Promise<Poi[]> {
  const [south, west, north, east] = bbox;
  const query = `
    [out:json][timeout:25];
    (
      node[${tag}](${south},${west},${north},${east});
      way[${tag}](${south},${west},${north},${east});
    );
    out center;
  `;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
    headers: { "Content-Type": "text/plain" },
  });
  const text = await res.text();
  type OverpassElement = {
    type: string;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: { name?: string };
  };
  type OverpassResponse = { elements?: OverpassElement[]; remark?: string; error?: string };
  let json: OverpassResponse;
  try {
    json = JSON.parse(text) as OverpassResponse;
  } catch {
    return [];
  }
  if (json.remark) {
    throw new Error(json.remark);
  }
  if (!res.ok) {
    const msg = json.error ?? `Overpass ${res.status}`;
    throw new Error(msg);
  }
  const elements = json.elements ?? [];
  const pois: Poi[] = [];
  for (const el of elements) {
    let lat: number | undefined;
    let lon: number | undefined;
    if (el.type === "node") {
      lat = el.lat;
      lon = el.lon;
    } else if (el.center) {
      lat = el.center.lat;
      lon = el.center.lon;
    }
    if (lat != null && lon != null) {
      pois.push({ lat, lon, name: el.tags?.name ?? "", category });
    }
  }
  return pois;
}

type OverpassWayElement = {
  type: "way";
  id: number;
  nodes?: number[];
  geometry?: { lat: number; lon: number }[];
  tags?: { name?: string; highway?: string };
};

async function fetchRoads(bbox: [number, number, number, number]): Promise<Road[]> {
  const [south, west, north, east] = bbox;
  const query = `
    [out:json][timeout:20];
    way(${south},${west},${north},${east})["highway"~"^(primary|secondary|trunk|motorway)$"];
    out geom;
  `;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
    headers: { "Content-Type": "text/plain" },
  });
  const text = await res.text();
  let json: { elements?: OverpassWayElement[]; remark?: string };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    return [];
  }
  if (json.remark) return [];
  const ways = json.elements ?? [];
  const roads: Road[] = [];
  for (const w of ways) {
    const geom = w.geometry;
    if (!geom || geom.length < 2) continue;
    const coordinates = geom.map((g) => [g.lat, g.lon] as [number, number]);
    roads.push({ name: w.tags?.name ?? "", coordinates });
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
    const cidade = searchParams.get("cidade")?.trim() ?? "";
    const estado = searchParams.get("estado")?.trim() || null;

    if (!cidade) {
      return NextResponse.json(
        { error: "Informe o parâmetro cidade." },
        { status: 400 }
      );
    }

    const bbox = await getBbox(cidade, estado);
    if (!bbox) {
      return NextResponse.json(
        { error: "Não foi possível obter a área do município. Verifique cidade e estado." },
        { status: 404 }
      );
    }

    const [poisResults, roads] = await Promise.all([
      Promise.all(CATEGORIES.map((cat) => fetchOverpass(bbox, cat.overpassTag, cat.key))),
      fetchRoads(bbox),
    ]);
    const pois: Poi[] = poisResults.flat();

    const [south, west, north, east] = bbox;
    const centerLat = (south + north) / 2;
    const centerLon = (west + east) / 2;

    return NextResponse.json({
      pois,
      roads,
      bbox: { south, west, north, east, centerLat, centerLon },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao carregar equipamentos.";
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
