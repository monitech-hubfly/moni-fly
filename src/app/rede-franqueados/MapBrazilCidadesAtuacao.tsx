'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';
import { parseAreaAtuacao } from '@/lib/rede-area-atuacao';
import redeMapBrazilOutline from '@/data/rede-map-brazil-outline.json';
import redeMapBrazilStates from '@/data/rede-map-brazil-states.json';

// Projeção: Brasil lng ~-74 a -35, lat ~-33.7 a 5.3 -> SVG 0 0 400 500
function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng + 74) / 39) * 400;
  const y = ((5.3 - lat) / 39) * 500;
  return { x, y };
}

function buildPathFromRing(ring: [number, number][]): string {
  if (!ring.length) return '';
  const [lng0, lat0] = ring[0];
  let path = `M ${project(lat0, lng0).x} ${project(lat0, lng0).y}`;
  for (let i = 1; i < ring.length; i++) {
    const [lng, lat] = ring[i];
    const { x, y } = project(lat, lng);
    path += ` L ${x} ${y}`;
  }
  return path + ' Z';
}

function buildPathFromGeometry(geom: { type?: string; coordinates?: unknown }): string {
  if (!geom?.coordinates || !Array.isArray(geom.coordinates)) return '';
  const c = geom.coordinates;
  if (geom.type === 'Polygon') {
    return (c as [number, number][][]).map((ring) => buildPathFromRing(ring)).join(' ');
  }
  if (geom.type === 'MultiPolygon') {
    return (c as [number, number][][][])
      .map((poly) => (poly as [number, number][][]).map((ring) => buildPathFromRing(ring)).join(' '))
      .join(' ');
  }
  return '';
}

type XY = { x: number; y: number };

function getSegDistSq(p: XY, a: XY, b: XY): number {
  let x = a.x;
  let y = a.y;
  let dx = b.x - x;
  let dy = b.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b.x;
      y = b.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p.x - x;
  dy = p.y - y;
  return dx * dx + dy * dy;
}

function pointToPolygonDist(p: XY, polygon: XY[][]): number {
  // sinal: positivo se dentro; negativo se fora. magnitude = distância até a borda
  let inside = false;
  let minDistSq = Infinity;

  for (const ring of polygon) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i];
      const b = ring[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
        inside = !inside;
      }
      minDistSq = Math.min(minDistSq, getSegDistSq(p, a, b));
    }
  }

  const dist = Math.sqrt(minDistSq);
  return inside ? dist : -dist;
}

function bboxOfPolygon(polygon: XY[][]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const ring of polygon) {
    for (const p of ring) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY };
}

type Cell = {
  x: number;
  y: number;
  h: number;
  d: number;
  max: number;
};

function makeCell(x: number, y: number, h: number, polygon: XY[][]): Cell {
  const d = pointToPolygonDist({ x, y }, polygon);
  return { x, y, h, d, max: d + h * Math.SQRT2 };
}

function polylabel(polygon: XY[][], precision = 2): XY {
  // Algoritmo “visual center” (polylabel). Retorna ponto dentro do polígono.
  const { minX, minY, maxX, maxY } = bboxOfPolygon(polygon);
  const width = maxX - minX;
  const height = maxY - minY;
  const cellSize = Math.min(width, height);
  let h = cellSize / 2;

  // fallback: centro do bbox
  if (!isFinite(h) || h === 0) return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

  const cellQueue: Cell[] = [];
  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      cellQueue.push(makeCell(x + h, y + h, h, polygon));
    }
  }

  // melhor chute inicial: centro do bbox
  let bestCell = makeCell((minX + maxX) / 2, (minY + maxY) / 2, 0, polygon);
  // se o centro do bbox cair fora, ainda assim o algoritmo converge

  // ordena por melhor “max” primeiro (sem heap para manter simples, N é pequeno)
  while (cellQueue.length) {
    cellQueue.sort((a, b) => b.max - a.max);
    const cell = cellQueue.shift()!;

    if (cell.d > bestCell.d) bestCell = cell;
    if (cell.max - bestCell.d <= precision) continue;

    h = cell.h / 2;
    cellQueue.push(makeCell(cell.x - h, cell.y - h, h, polygon));
    cellQueue.push(makeCell(cell.x + h, cell.y - h, h, polygon));
    cellQueue.push(makeCell(cell.x - h, cell.y + h, h, polygon));
    cellQueue.push(makeCell(cell.x + h, cell.y + h, h, polygon));
  }

  return { x: bestCell.x, y: bestCell.y };
}

function projectRingToXY(ring: [number, number][]): XY[] {
  return ring.map(([lng, lat]) => {
    const { x, y } = project(lat, lng);
    return { x, y };
  });
}

/** Ponto ideal do rótulo (polylabel) do maior polígono do estado. */
function labelPointFromGeometry(geom: { type?: string; coordinates?: unknown }): XY | null {
  if (!geom?.coordinates || !Array.isArray(geom.coordinates)) return null;
  const c = geom.coordinates as unknown;

  const polygons: [number, number][][][] = [];
  if (geom.type === 'Polygon') {
    polygons.push(c as [number, number][][]);
  } else if (geom.type === 'MultiPolygon') {
    polygons.push(...((c as [number, number][][][]) ?? []));
  } else {
    return null;
  }

  // escolhe o maior polígono por bbox (aprox), depois aplica polylabel nele
  let best: { poly: [number, number][][]; score: number } | null = null;
  for (const poly of polygons) {
    const outer = poly?.[0];
    if (!outer?.length) continue;
    const outerXY = projectRingToXY(outer);
    const bbox = bboxOfPolygon([outerXY]);
    const score = (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY);
    if (!best || score > best.score) best = { poly, score };
  }
  if (!best) return null;

  const polyXY: XY[][] = best.poly.map((ring) => projectRingToXY(ring));
  return polylabel(polyXY, 1.5);
}

function bestOuterRingFromGeometry(geom: { type?: string; coordinates?: unknown }): [number, number][] | null {
  if (!geom?.coordinates || !Array.isArray(geom.coordinates)) return null;
  const c = geom.coordinates as unknown;

  const polygons: [number, number][][][] = [];
  if (geom.type === 'Polygon') polygons.push(c as [number, number][][]);
  else if (geom.type === 'MultiPolygon') polygons.push(...((c as [number, number][][][]) ?? []));
  else return null;

  let best: { outer: [number, number][]; score: number } | null = null;
  for (const poly of polygons) {
    const outer = poly?.[0];
    if (!outer?.length) continue;
    const outerXY = projectRingToXY(outer);
    const bbox = bboxOfPolygon([outerXY]);
    const score = (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY);
    if (!best || score > best.score) best = { outer, score };
  }
  return best?.outer ?? null;
}

function stateBBoxFromGeometry(geom: { type?: string; coordinates?: unknown }):
  | { minX: number; minY: number; maxX: number; maxY: number }
  | null {
  const outer = bestOuterRingFromGeometry(geom);
  if (!outer?.length) return null;
  const outerXY = projectRingToXY(outer);
  return bboxOfPolygon([outerXY]);
}

/** Centro do rótulo do estado; se polylabel falhar, usa o centro do bbox do contorno. */
function labelCenterWithFallback(geom: { type?: string; coordinates?: unknown }): XY | null {
  const fromPoly = labelPointFromGeometry(geom);
  if (fromPoly && Number.isFinite(fromPoly.x) && Number.isFinite(fromPoly.y)) return fromPoly;
  const outer = bestOuterRingFromGeometry(geom);
  if (!outer?.length) return null;
  const xy = projectRingToXY(outer);
  const bb = bboxOfPolygon([xy]);
  return { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 };
}

type GeoFeat = {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: { name?: string; sigla?: string; UF?: string };
};

type StatePathRow = {
  path: string;
  label: string;
  x: number;
  y: number;
  bbox?: { minX: number; minY: number; maxX: number; maxY: number };
};

function firstOuterLngLatRingFromOutline(
  geo: { features?: { geometry?: { type?: string; coordinates?: unknown } }[] },
): [number, number][] | null {
  const g = geo?.features?.[0]?.geometry;
  if (!g?.coordinates) return null;
  const c = g.coordinates as unknown;
  if (g.type === 'Polygon') {
    const rings = c as [number, number][][];
    return rings?.[0] ?? null;
  }
  if (g.type === 'MultiPolygon') {
    const polys = c as [number, number][][][];
    return polys?.[0]?.[0] ?? null;
  }
  return null;
}

function buildBrazilPathsFromBundles(): { outlinePath: string | null; statePaths: StatePathRow[] } {
  const ring = firstOuterLngLatRingFromOutline(redeMapBrazilOutline as { features?: { geometry?: { type?: string; coordinates?: unknown } }[] });
  const outlinePath = ring?.length ? buildPathFromRing(ring) : null;

  const geo = redeMapBrazilStates as { features?: GeoFeat[] };
  const statePaths: StatePathRow[] = [];
  for (const f of geo?.features ?? []) {
    const path = buildPathFromGeometry(f?.geometry ?? {});
    const center = labelCenterWithFallback(f?.geometry ?? {});
    const bbox = stateBBoxFromGeometry(f?.geometry ?? {}) ?? undefined;
    const label = f?.properties?.sigla ?? f?.properties?.UF ?? f?.properties?.name ?? '';
    if (!path || !center || !label) continue;
    statePaths.push({ path, label, x: center.x, y: center.y, bbox });
  }

  return { outlinePath, statePaths };
}

const REDE_MAP_STATIC = buildBrazilPathsFromBundles();

type Props = { rows: RedeFranqueadoRowDb[]; filtroEstado?: string };

export function MapBrazilCidadesAtuacao({ rows, filtroEstado = '' }: Props) {
  const [coords, setCoords] = useState<Record<string, { lat: number; lng: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const brazilPath = REDE_MAP_STATIC.outlinePath;
  const statePaths = REDE_MAP_STATIC.statePaths;

  const { cidadesKeys, countByCity } = useMemo(() => {
    const byKey = new Map<string, number>();
    const ufFilter = filtroEstado?.trim().toUpperCase();
    for (const r of rows) {
      const areas = parseAreaAtuacao(r.area_atuacao);
      for (const { uf, cidade } of areas) {
        if (ufFilter && uf?.toUpperCase() !== ufFilter) continue;
        const key = `${uf} - ${cidade}`;
        if (key) byKey.set(key, (byKey.get(key) ?? 0) + 1);
      }
    }
    const cidadesKeys = [...byKey.keys()];
    const countByCity = Object.fromEntries(byKey);
    return { cidadesKeys, countByCity };
  }, [rows, filtroEstado]);

  useEffect(() => {
    if (cidadesKeys.length === 0) {
      setCoords({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch('/api/rede-franqueados/cidades-coordenadas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cidades: cidadesKeys }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Erro ao carregar coordenadas');
        return res.json();
      })
      .then((data: Record<string, { lat: number; lng: number }>) => {
        setCoords(data ?? {});
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Erro ao carregar mapa.');
        setCoords({});
      })
      .finally(() => setLoading(false));
  }, [cidadesKeys]);

  const pins = useMemo(() => {
    return Object.entries(coords)
      .filter(([, pos]) => pos.lat != null && pos.lng != null)
      .map(([key, pos]) => ({
        key,
        ...project(pos.lat, pos.lng),
        count: countByCity[key] ?? 1,
        label: key.includes(' - ') ? `${key.split(' - ')[1]} (${key.split(' - ')[0]})` : key,
      }));
  }, [coords, countByCity]);

  const viewBox = useMemo(() => {
    const uf = filtroEstado?.trim().toUpperCase();
    if (!uf) return { x: 0, y: 0, w: 400, h: 500 };
    const st = statePaths.find((s) => s.label?.toUpperCase() === uf);
    const b = st?.bbox;
    if (!b) return { x: 0, y: 0, w: 400, h: 500 };
    const pad = 18;
    const x = Math.max(0, b.minX - pad);
    const y = Math.max(0, b.minY - pad);
    const w = Math.min(400 - x, b.maxX - b.minX + pad * 2);
    const h = Math.min(500 - y, b.maxY - b.minY + pad * 2);
    return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
  }, [filtroEstado, statePaths]);

  const callouts = useMemo(() => {
    const uf = filtroEstado?.trim().toUpperCase();
    if (!uf) return [];
    if (pins.length === 0) return [];

    const vb = viewBox;
    const midX = vb.x + vb.w / 2;

    type Item = {
      key: string;
      pinX: number;
      pinY: number;
      label: string;
      side: 'left' | 'right';
      labelX: number;
      labelY: number;
      elbowX: number;
    };

    const left: Item[] = [];
    const right: Item[] = [];

    for (const p of pins) {
      const side: 'left' | 'right' = p.x < midX ? 'left' : 'right';
      const labelX = side === 'right' ? vb.x + vb.w - 10 : vb.x + 10;
      const elbowX = side === 'right' ? labelX - 26 : labelX + 26;
      const item: Item = {
        key: p.key,
        pinX: p.x,
        pinY: p.y,
        label: p.label,
        side,
        labelX,
        labelY: p.y,
        elbowX,
      };
      (side === 'right' ? right : left).push(item);
    }

    const layout = (arr: Item[]) => {
      arr.sort((a, b) => a.pinY - b.pinY);
      const minGap = 11;
      const top = vb.y + 10;
      const bottom = vb.y + vb.h - 10;
      let y = top;
      for (const it of arr) {
        y = Math.max(y, it.pinY);
        it.labelY = Math.min(bottom, y);
        y = it.labelY + minGap;
      }
      // ajuste simples se estourar embaixo
      if (arr.length) {
        const overflow = arr[arr.length - 1].labelY - bottom;
        if (overflow > 0) {
          for (const it of arr) it.labelY -= overflow;
          // garante topo
          const under = top - arr[0].labelY;
          if (under > 0) for (const it of arr) it.labelY += under;
        }
      }
    };

    layout(left);
    layout(right);

    return [...left, ...right];
  }, [filtroEstado, pins, viewBox]);

  const redeMapCardStyle: React.CSSProperties = {
    borderColor: 'var(--moni-rede-chart-border)',
    backgroundColor: 'var(--moni-rede-chart-surface)',
    color: 'var(--moni-text-primary)',
  };

  if (cidadesKeys.length === 0) {
    return (
      <div className="rounded-xl border p-6 text-center text-sm" style={redeMapCardStyle}>
        <p style={{ color: 'var(--moni-text-secondary)' }}>
          {filtroEstado
            ? `Nenhuma cidade de atuação no estado ${filtroEstado}.`
            : 'Nenhuma cidade de atuação cadastrada para exibir no mapa.'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl border p-4 text-sm"
        style={{
          borderColor: 'var(--moni-status-overdue-border)',
          backgroundColor: 'var(--moni-status-overdue-bg)',
          color: 'var(--moni-status-overdue-text)',
        }}
      >
        {error}
      </div>
    );
  }

  const hasCoords = pins.length > 0;

  return (
    <div className="rounded-xl border p-4" style={redeMapCardStyle}>
      {loading ? (
        <div
          className="flex h-[420px] items-center justify-center rounded-lg text-sm"
          style={{
            backgroundColor: 'var(--moni-surface-100)',
            color: 'var(--moni-text-secondary)',
          }}
        >
          Carregando mapa…
        </div>
      ) : !hasCoords ? (
        <div
          className="flex h-[420px] items-center justify-center rounded-lg text-sm"
          style={{
            backgroundColor: 'var(--moni-surface-100)',
            color: 'var(--moni-text-tertiary)',
          }}
        >
          {filtroEstado
            ? `Nenhuma cidade no estado ${filtroEstado}.`
            : 'Não foi possível obter coordenadas para as cidades cadastradas.'}
        </div>
      ) : (
        <div className="relative w-full overflow-hidden" style={{ backgroundColor: 'var(--moni-rede-map-bg)' }}>
          <svg
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            className="h-auto w-full"
            style={{ maxHeight: 420, backgroundColor: 'var(--moni-rede-map-bg)' }}
            preserveAspectRatio="xMidYMid meet"
          >
            {brazilPath ? (
              <path
                d={brazilPath}
                fill="var(--moni-rede-map-land)"
                stroke="var(--moni-rede-map-stroke)"
                strokeWidth={0.8}
              />
            ) : null}
            {statePaths.map((s, i) => (
              <path
                key={i}
                d={s.path}
                fill="var(--moni-rede-map-land)"
                stroke="var(--moni-rede-map-stroke)"
                strokeWidth={0.6}
              />
            ))}
            {statePaths.map((s, i) => (
              <text
                key={`label-${i}`}
                x={s.x}
                y={s.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="select-none pointer-events-none"
                fill="var(--moni-rede-map-label)"
                style={{ fontSize: 8, fontWeight: 600 }}
              >
                {s.label}
              </text>
            ))}
            {callouts.length > 0 && (
              <g>
                {callouts.map((c) => (
                  <g key={`callout-${c.key}`}>
                    <path
                      d={`M ${c.pinX} ${c.pinY} L ${c.elbowX} ${c.pinY} L ${c.labelX} ${c.labelY}`}
                      fill="none"
                      stroke="var(--moni-rede-map-callout)"
                      strokeWidth={0.9}
                      strokeDasharray="3 2"
                      opacity={0.9}
                    />
                    <text
                      x={c.labelX}
                      y={c.labelY}
                      textAnchor={c.side === 'right' ? 'end' : 'start'}
                      dominantBaseline="middle"
                      className="select-none pointer-events-none"
                      fill="var(--moni-text-primary)"
                      style={{ fontSize: 9, fontWeight: 600 }}
                    >
                      {c.label}
                    </text>
                  </g>
                ))}
              </g>
            )}
            {pins.map((p) => (
              <g key={p.key}>
                <title>{p.label} — {p.count} franquia(s)</title>
                <circle cx={p.x} cy={p.y} r={6} fill="var(--moni-rede-map-pin-outer)" />
                <circle cx={p.x} cy={p.y} r={2.5} fill="var(--moni-rede-map-pin-inner)" />
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}
