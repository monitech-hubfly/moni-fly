'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isoWeek } from '@/utils/periodos';
import { listarAreas } from '@/utils/areasOrder';

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type DiaDetalhe = {
  data: string;
  sireneScore: number | null;
  engajamentoScore: number | null;
  indicadoresScore: number | null;
};

export type SemanaData = {
  sireneScore: number | null;
  engajamentoScore: number | null;
  indicadoresScore: number | null;
  dias: DiaDetalhe[];
};

export type UsuarioDashboard = {
  profileId: string;
  nome: string;
  porSemana: Record<number, SemanaData>;
};

export type AreaDashboard = {
  id: string;
  nome: string;
  usuarios: UsuarioDashboard[];
};

export type UseDashboardGeralResult = {
  areas: AreaDashboard[];
  semanas: number[];
  semanaAtual: number;
  isLoading: boolean;
  error: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function extractScore(obj: unknown, key = 'score'): number | null {
  if (!obj || typeof obj !== 'object') return null;
  const v = (obj as Record<string, unknown>)[key];
  if (typeof v === 'number') return Math.round(v);
  return null;
}

function extractSireneScore(sirene: unknown): number | null {
  return extractScore(sirene);
}

function extractEngajamentoScore(engajamento: unknown): number | null {
  return extractScore(engajamento);
}

function extractIndicadoresScore(indicadores: unknown): number | null {
  // stored as { media: number | null, porIndicador: [...] }
  if (!indicadores || typeof indicadores !== 'object') return null;
  const v = (indicadores as Record<string, unknown>)['media'];
  if (typeof v === 'number') return Math.round(v);
  return null;
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

      // 3. Fonte da verdade de membros: area_pessoas ativo + com profile_id
      type PessoaRow = { profile_id: string; area_id: string };
      const { data: pessoasData } = await supabase
        .from('area_pessoas')
        .select('profile_id, area_id')
        .in('area_id', areaIds)
        .eq('ativo', true)
        .not('profile_id', 'is', null);

      // Deduplicar: um profile_id só aparece uma vez por área
      const pessoasPorArea = new Map<string, PessoaRow[]>();
      for (const p of (pessoasData ?? []) as PessoaRow[]) {
        if (!pessoasPorArea.has(p.area_id)) pessoasPorArea.set(p.area_id, []);
        const lista = pessoasPorArea.get(p.area_id)!;
        if (!lista.some(x => x.profile_id === p.profile_id)) lista.push(p);
      }

      // Buscar nome real de profiles (full_name)
      const allProfileIds = [...new Set((pessoasData ?? []).map((p: unknown) => (p as PessoaRow).profile_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', allProfileIds);
      const profileNome = new Map<string, string>(
        ((profilesData ?? []) as { id: string; full_name: string | null }[])
          .map(p => [p.id, p.full_name ?? p.id])
      );

      // 4. Buscar snapshots no intervalo
      const { data: rows, error: rowsErr } = await supabase
        .from('carometro_status_diario')
        .select('area_id, profile_id, data, sirene, engajamento, indicadores')
        .in('area_id', areaIds)
        .gte('data', startStr)
        .lte('data', endStr);

      if (rowsErr) throw rowsErr;

      // 5. Agrupar snapshots: areaId → profileId → semana → DiaDetalhe[]
      type StatusRow = {
        area_id: string; profile_id: string; data: string;
        sirene: unknown; engajamento: unknown; indicadores: unknown;
      };
      const statusRows = (rows ?? []) as StatusRow[];
      const mapa = new Map<string, Map<string, Map<number, DiaDetalhe[]>>>();
      for (const a of listaAreas) mapa.set(a.id, new Map());

      for (const r of statusRows) {
        const semana = isoWeek(new Date(`${r.data}T12:00:00`));
        const areaMap = mapa.get(r.area_id);
        if (!areaMap) continue;
        if (!areaMap.has(r.profile_id)) areaMap.set(r.profile_id, new Map());
        const profMap = areaMap.get(r.profile_id)!;
        if (!profMap.has(semana)) profMap.set(semana, []);
        profMap.get(semana)!.push({
          data:             r.data,
          sireneScore:      extractSireneScore(r.sirene),
          engajamentoScore: extractEngajamentoScore(r.engajamento),
          indicadoresScore: extractIndicadoresScore(r.indicadores),
        });
      }

      // 6. Construir AreaDashboard[] usando area_pessoas como lista oficial
      const areasResult: AreaDashboard[] = listaAreas.map(a => {
        const pessoas = pessoasPorArea.get(a.id) ?? [];
        const areaMap = mapa.get(a.id) ?? new Map<string, Map<number, DiaDetalhe[]>>();

        const usuarios: UsuarioDashboard[] = pessoas.map(p => {
          const profMap = areaMap.get(p.profile_id) ?? new Map<number, DiaDetalhe[]>();
          const porSemana: Record<number, SemanaData> = {};
          for (const sem of semList) {
            const dias = (profMap.get(sem) ?? []).sort((x, y) => x.data.localeCompare(y.data));
            porSemana[sem] = {
              sireneScore:      avgOrNull(dias.map(d => d.sireneScore)),
              engajamentoScore: avgOrNull(dias.map(d => d.engajamentoScore)),
              indicadoresScore: avgOrNull(dias.map(d => d.indicadoresScore)),
              dias,
            };
          }
          return { profileId: p.profile_id, nome: profileNome.get(p.profile_id) ?? p.profile_id, porSemana };
        });

        usuarios.sort((a, b) => a.nome.localeCompare(b.nome));
        return { id: a.id, nome: a.nome, usuarios };
      });

      // Exibir apenas áreas com pelo menos 1 membro ativo
      setAreas(areasResult.filter(a => a.usuarios.length > 0));
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
