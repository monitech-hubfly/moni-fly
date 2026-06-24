'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isoWeek } from '@/utils/periodos';
import { listarAreas } from '@/utils/areasOrder';

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type DiaDetalhe = {
  data: string;
  sirene: number | null;
  engajamento: number | null;
  indicadores: number | null;
  score: number | null;
};

export type SemanaData = {
  score: number | null;
  dias: DiaDetalhe[];
};

export type AreaDashboard = {
  id: string;
  nome: string;
  scoreAcumulado: number | null;
  porSemana: Record<number, SemanaData>;
};

export type UseDashboardGeralResult = {
  areas: AreaDashboard[];
  semanas: number[];       // ISO week numbers em ordem crescente
  semanaAtual: number;
  isLoading: boolean;
  error: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function extractNum(obj: unknown, key: string): number | null {
  if (!obj || typeof obj !== 'object') return null;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : null;
}

function calcDayScore(sirene: unknown, engajamento: unknown, indicadores: unknown): number | null {
  const vals = [
    extractNum(sirene,      'score'),
    extractNum(engajamento, 'score'),
    extractNum(indicadores, 'media'),
  ].filter((v): v is number => v !== null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function avgOrNull(nums: (number | null)[]): number | null {
  const valid = nums.filter((v): v is number => v !== null);
  if (!valid.length) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

function calcSemanasRange(nSemanas: number): { semanas: number[]; startStr: string; endStr: string } {
  const hoje = new Date();
  const semanas: number[] = [];
  for (let i = nSemanas - 1; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() - i * 7);
    const w = isoWeek(d);
    if (!semanas.includes(w)) semanas.push(w);
  }
  const start = new Date(hoje);
  start.setDate(hoje.getDate() - (nSemanas - 1) * 7);
  return { semanas, startStr: toDateStr(start), endStr: toDateStr(hoje) };
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useDashboardGeral(nSemanas = 8): UseDashboardGeralResult {
  const supabase = useMemo(() => createClient(), []);
  const [areas,     setAreas]     = useState<AreaDashboard[]>([]);
  const [semanas,   setSemanas]   = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const semanaAtual = useMemo(() => isoWeek(new Date()), []);

  const carregar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Listar áreas
      const areasRes = await (listarAreas as (
        supabase: unknown, fields: string
      ) => Promise<{ data: { id: string; nome: string }[] | null; error: unknown }>)(
        supabase, 'id, nome'
      );
      if (areasRes.error) throw areasRes.error;
      const listaAreas = areasRes.data ?? [];

      // 2. Calcular intervalo de datas
      const { semanas: semList, startStr, endStr } = calcSemanasRange(nSemanas);
      setSemanas(semList);

      if (!listaAreas.length) { setAreas([]); return; }

      const areaIds = listaAreas.map(a => a.id);

      // 3. Buscar carometro_status_diario no intervalo
      console.log('[useDashboardGeral] query carometro_status_diario', { areaIds: areaIds.length, startStr, endStr });
      const { data: rows, error: rowsErr } = await supabase
        .from('carometro_status_diario')
        .select('area_id, data, sirene, engajamento, indicadores')
        .in('area_id', areaIds)
        .gte('data', startStr)
        .lte('data', endStr);

      if (rowsErr) throw rowsErr;

      // 4. Agrupar por área + semana
      type StatusRow = {
        area_id: string; data: string;
        sirene: unknown; engajamento: unknown; indicadores: unknown;
      };
      const statusRows = (rows ?? []) as StatusRow[];

      // Mapa: areaId → semana → DiaDetalhe[]
      const mapa = new Map<string, Map<number, DiaDetalhe[]>>();
      for (const a of listaAreas) mapa.set(a.id, new Map());

      for (const r of statusRows) {
        const semana = isoWeek(new Date(`${r.data}T12:00:00`));
        const areaMap = mapa.get(r.area_id);
        if (!areaMap) continue;
        if (!areaMap.has(semana)) areaMap.set(semana, []);
        const dia: DiaDetalhe = {
          data:         r.data,
          sirene:       extractNum(r.sirene,      'score'),
          engajamento:  extractNum(r.engajamento, 'score'),
          indicadores:  extractNum(r.indicadores, 'media'),
          score:        calcDayScore(r.sirene, r.engajamento, r.indicadores),
        };
        areaMap.get(semana)!.push(dia);
      }

      // 5. Construir AreaDashboard[]
      const areasResult: AreaDashboard[] = listaAreas.map(a => {
        const areaMap = mapa.get(a.id) ?? new Map<number, DiaDetalhe[]>();
        const porSemana: Record<number, SemanaData> = {};

        for (const sem of semList) {
          const dias = areaMap.get(sem) ?? [];
          dias.sort((x, y) => x.data.localeCompare(y.data));
          porSemana[sem] = {
            score: avgOrNull(dias.map(d => d.score)),
            dias,
          };
        }

        const allScores = semList.map(s => porSemana[s]?.score ?? null);
        return {
          id:              a.id,
          nome:            a.nome,
          scoreAcumulado:  avgOrNull(allScores),
          porSemana,
        };
      });

      setAreas(areasResult);
    } catch (e) {
      console.error('[useDashboardGeral]', e);
      setError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      setIsLoading(false);
    }
  }, [supabase, nSemanas]);

  useEffect(() => { carregar(); }, [carregar]);

  return { areas, semanas, semanaAtual, isLoading, error };
}
