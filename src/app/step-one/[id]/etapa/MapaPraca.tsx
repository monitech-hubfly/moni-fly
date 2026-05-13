'use client';

import React, { useEffect, useState, useCallback } from 'react';

export type PoiCategory =
  | 'school'
  | 'hospital'
  | 'clinic'
  | 'mall'
  | 'supermarket'
  | 'park'
  | 'square'
  | 'bank'
  | 'pharmacy';

const CATEGORIES: {
  key: PoiCategory;
  label: string;
  overpassTag: string;
  color: string;
  symbol: string;
}[] = [
  { key: 'school', label: 'Escolas', overpassTag: 'amenity=school', color: '#2563eb', symbol: 'E' },
  {
    key: 'hospital',
    label: 'Hospitais',
    overpassTag: 'amenity=hospital',
    color: '#dc2626',
    symbol: 'H',
  },
  { key: 'clinic', label: 'UBS', overpassTag: 'amenity=clinic', color: '#0d9488', symbol: 'U' },
  { key: 'mall', label: 'Shoppings', overpassTag: 'shop=mall', color: '#7c3aed', symbol: 'S' },
  {
    key: 'supermarket',
    label: 'Supermercados',
    overpassTag: 'shop=supermarket',
    color: '#4d7a62',
    symbol: 'M',
  },
  { key: 'park', label: 'Parques', overpassTag: 'leisure=park', color: '#16a34a', symbol: 'P' },
  { key: 'square', label: 'Praças', overpassTag: 'place=square', color: '#84cc16', symbol: 'Q' },
  { key: 'bank', label: 'Bancos', overpassTag: 'amenity=bank', color: '#1e40af', symbol: 'B' },
  {
    key: 'pharmacy',
    label: 'Farmácias',
    overpassTag: 'amenity=pharmacy',
    color: '#059669',
    symbol: 'F',
  },
];

export type Poi = { lat: number; lon: number; name: string; category: PoiCategory };

export type Road = { name: string; coordinates: [number, number][] };

type MapData = {
  pois: Poi[];
  roads: Road[];
  bbox: { centerLat: number; centerLon: number };
};

async function fetchMapData(
  cidade: string,
  estado: string | null,
): Promise<{ data: MapData } | { error: string }> {
  const params = new URLSearchParams({ cidade: cidade.trim() });
  if (estado?.trim()) params.set('estado', estado.trim());
  const res = await fetch(`/api/etapa1/mapa-pois?${params.toString()}`);
  const data = (await res.json()) as {
    pois?: Poi[];
    roads?: Road[];
    bbox?: { centerLat: number; centerLon: number };
    error?: string;
  };
  if (!res.ok) {
    return { error: data.error ?? 'Erro ao carregar equipamentos.' };
  }
  if (!data.bbox?.centerLat || data.bbox?.centerLon == null) {
    return { error: 'Resposta inválida do servidor.' };
  }
  return {
    data: {
      pois: Array.isArray(data.pois) ? data.pois : [],
      roads: Array.isArray(data.roads) ? data.roads : [],
      bbox: { centerLat: data.bbox.centerLat, centerLon: data.bbox.centerLon },
    },
  };
}

type LeafletMap = {
  addLayer: (l: unknown) => void;
  removeLayer: (l: unknown) => void;
  remove: () => void;
};

function MapView({
  cidade,
  estado,
  allPois,
  roads,
  centerLat,
  centerLon,
  visibleCategories,
  showRoads,
}: {
  cidade: string;
  estado: string | null;
  allPois: Poi[];
  roads: Road[];
  centerLat: number;
  centerLon: number;
  visibleCategories: Set<PoiCategory>;
  showRoads: boolean;
}) {
  const [mapEl, setMapEl] = useState<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const layerGroupsRef = React.useRef<
    Partial<Record<PoiCategory, { addTo: (m: LeafletMap) => void; remove: () => void }>>
  >({});
  const roadsLayerRef = React.useRef<{ addTo: (m: LeafletMap) => void; remove: () => void } | null>(
    null,
  );

  useEffect(() => {
    if (!mapEl || !cidade.trim()) return;
    const L = require('leaflet');
    require('leaflet/dist/leaflet.css');

    const map = L.map(mapEl).setView([centerLat, centerLon], 12) as LeafletMap;
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);

    const roadsLayer = L.layerGroup();
    for (const road of roads) {
      const latLngs = road.coordinates.map(([lat, lon]) => [lat, lon] as [number, number]);
      const polyline = L.polyline(latLngs, {
        color: '#b08a3e',
        weight: 4,
        opacity: 0.8,
      });
      if (road.name) {
        polyline.bindTooltip(road.name, {
          permanent: true,
          direction: 'center',
          className: 'mapa-via-label',
          opacity: 0.95,
        });
      }
      roadsLayer.addLayer(polyline);
    }
    roadsLayerRef.current = roadsLayer;
    if (showRoads) map.addLayer(roadsLayer);

    const poisByCat = new Map<PoiCategory, Poi[]>();
    for (const p of allPois) {
      const list = poisByCat.get(p.category) ?? [];
      list.push(p);
      poisByCat.set(p.category, list);
    }

    const layerGroups: Partial<
      Record<PoiCategory, { addTo: (m: LeafletMap) => void; remove: () => void }>
    > = {};
    for (const cat of CATEGORIES) {
      const catConfig = CATEGORIES.find((c) => c.key === cat.key)!;
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:${catConfig.color};color:white;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);">${catConfig.symbol}</span>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const group = L.layerGroup();
      const pois = poisByCat.get(cat.key) ?? [];
      for (const p of pois) {
        const marker = L.marker([p.lat, p.lon], { icon });
        marker.bindTooltip(p.name || catConfig.label, { permanent: false });
        group.addLayer(marker);
      }
      layerGroups[cat.key] = group;
    }
    layerGroupsRef.current = layerGroups;

    // Adicionar todos os grupos ao mapa logo após criar; o effect abaixo só mostra/oculta conforme os checkboxes
    for (const cat of CATEGORIES) {
      const group = layerGroups[cat.key];
      if (group) map.addLayer(group);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupsRef.current = {};
      roadsLayerRef.current = null;
    };
  }, [mapEl, cidade, estado, allPois, roads, centerLat, centerLon]);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroups = layerGroupsRef.current;
    const roadsLayer = roadsLayerRef.current;
    if (!map) return;
    if (roadsLayer) {
      try {
        if (showRoads) map.addLayer(roadsLayer);
        else map.removeLayer(roadsLayer);
      } catch {
        // ignore
      }
    }
    if (!layerGroups || Object.keys(layerGroups).length === 0) return;
    for (const cat of CATEGORIES) {
      const group = layerGroups[cat.key];
      if (!group) continue;
      try {
        if (visibleCategories.has(cat.key)) map.addLayer(group);
        else map.removeLayer(group);
      } catch {
        // layer may already be on map or removed
      }
    }
  }, [visibleCategories, showRoads, allPois.length]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  return (
    <div
      ref={setMapEl}
      className="h-[400px] w-full rounded-lg border border-stone-200 bg-stone-100"
    />
  );
}

export function MapaPraca({ cidade, estado }: { cidade: string; estado: string | null }) {
  const [allPois, setAllPois] = useState<Poi[]>([]);
  const [roads, setRoads] = useState<Road[]>([]);
  const [center, setCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visibleCategories, setVisibleCategories] = useState<Set<PoiCategory>>(
    () => new Set(CATEGORIES.map((c) => c.key)),
  );
  const [showRoads, setShowRoads] = useState(true);

  const toggleCategory = useCallback((key: PoiCategory) => {
    setVisibleCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!cidade.trim()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    fetchMapData(cidade, estado)
      .then((result) => {
        if ('error' in result) {
          setLoadError(result.error);
          setAllPois([]);
          setRoads([]);
          setCenter(null);
        } else {
          setAllPois(result.data.pois);
          setRoads(result.data.roads);
          setCenter({ lat: result.data.bbox.centerLat, lon: result.data.bbox.centerLon });
        }
      })
      .catch(() => {
        setLoadError('Erro de conexão ao carregar equipamentos.');
        setCenter(null);
      })
      .finally(() => setLoading(false));
  }, [cidade, estado]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600">
        Equipamentos urbanos em{' '}
        <strong>
          {cidade}
          {estado ? `, ${estado}` : ''}
        </strong>{' '}
        (OpenStreetMap + Overpass).
      </p>

      <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="w-full text-xs font-semibold uppercase text-stone-500 sm:w-auto">
            Exibir no mapa:
          </span>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showRoads}
              onChange={(e) => setShowRoads(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300"
            />
            <span
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: 'var(--moni-gold-600)' }}
              title="Vias"
            >
              V
            </span>
            <span className="text-stone-700">Vias (avenidas e rodovias)</span>
          </label>
          {CATEGORIES.map((cat) => (
            <label
              key={cat.key}
              className="flex cursor-pointer select-none items-center gap-2 text-sm"
            >
              <input
                type="checkbox"
                checked={visibleCategories.has(cat.key)}
                onChange={() => toggleCategory(cat.key)}
                className="h-4 w-4 rounded border-stone-300"
              />
              <span
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: cat.color }}
                title={cat.label}
              >
                {cat.symbol}
              </span>
              <span className="text-stone-700">{cat.label}</span>
            </label>
          ))}
        </div>
        {roads.length > 0 && (
          <div className="mt-2 border-t border-stone-200 pt-2">
            <p className="mb-1.5 text-xs font-semibold uppercase text-stone-500">
              Principais vias exibidas:
            </p>
            <ul className="flex list-none flex-wrap gap-x-3 gap-y-1 text-sm text-stone-700">
              {roads
                .filter((r) => r.name.trim())
                .map((r, i) => (
                  <li key={`${r.name}-${i}`} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-0.5 w-2 shrink-0 rounded"
                      style={{ backgroundColor: 'var(--moni-gold-600)' }}
                      aria-hidden
                    />
                    <span>{r.name}</span>
                  </li>
                ))}
            </ul>
            {roads.filter((r) => r.name.trim()).length === 0 && (
              <p className="text-sm text-stone-500">Vias sem nome cadastrado no mapa base.</p>
            )}
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-stone-500">Carregando mapa e equipamentos…</p>}
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {!loading && !loadError && center && (
        <MapView
          cidade={cidade}
          estado={estado}
          allPois={allPois}
          roads={roads}
          centerLat={center.lat}
          centerLon={center.lon}
          visibleCategories={visibleCategories}
          showRoads={showRoads}
        />
      )}
    </div>
  );
}
