'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isoWeek } from '@/utils/periodos';
import { listarAreas } from '@/utils/areasOrder';

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type DiaDetalhe = {
  data: string;
  sireneScore: number | null;
  atividadesScore: number | null;
  cardsScore: number | null;
};

export type SemanaData = {
  sireneScore: number | null;
  atividadesScore: number | null;
  cardsScore: number | null;
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

function extractSireneScore(sirene: unknown): number | null {
  if (!sirene || typeof sirene !== 'object') return null;
  const v = (sirene as Record<string, unknown>)['score'];
  return typeof v === 'number' ? v : null;
}

function extractAtividadesScore(engajamento: unknown): number | null {
  if (!engajamento || typeof engajamento !== 'object') return null;
  const eng = engajamento as Record<string, unknown>;
  const atv = eng['atividades'] as Record<string, unknown> | null;
  if (!atv) return null;
  const concluidas = typeof atv['concluidas'] === 'number' ? atv['concluidas'] : 0;
  const atrasadas  = typeof atv['atrasadas']  === 'number' ? atv['atrasadas']  : 0;
  const denom = concluidas + atrasadas;
  if (denom === 0) return null;
  return Math.round((concluidas / denom) * 100);
}

function extractCardsScore(engajamento: unknown): number | null {
  if (!engajamento || typeof engajamento !== 'object') return null;
  const eng = engajamento as Record<string, unknown>;
  const cards = eng['cards'] as Record<string, unknown> | null;
  if (!cards) return null;
  const concluidos = typeof cards['concluidos'] === 'number' ? cards['concluidos'] : 0;
  const atrasados  = typeof cards['atrasados']  === 'number' ? cards['atrasados']  : 0;
  const denom = concluidos + atrasados;
  if (denom === 0) return null;
  return Math.round((concluidos / denom) * 100);
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

      // 3. Buscar carometro_status_diario no intervalo (inclui profile_id)
      const { data: rows, error: rowsErr } = await supabase
        .from('carometro_status_diario')
        .select('area_id, profile_id, data, sirene, engajamento')
        .in('area_id', areaIds)
        .gte('data', startStr)
        .lte('data', endStr);

      if (rowsErr) throw rowsErr;

      // 4. Coletar todos os profile_ids únicos
      type StatusRow = {
        area_id: string; profile_id: string; data: string;
        sirene: unknown; engajamento: unknown;
      };
      const statusRows = (rows ?? []) as StatusRow[];
      const profileIds = [...new Set(statusRows.map(r => r.profile_id).filter(Boolean))];

      // 5. Buscar nomes dos usuários em area_pessoas
      const nomesPorProfile = new Map<string, string>();
      if (profileIds.length > 0) {
        const { data: pessoas } = await supabase
          .from('area_pessoas')
          .select('profile_id, nome')
          .in('profile_id', profileIds);
        for (const p of (pessoas ?? []) as { profile_id: string; nome: string }[]) {
          if (p.profile_id && p.nome) nomesPorProfile.set(p.profile_id, p.nome);
        }
      }

      // 6. Agrupar por area_id → profile_id → semana → DiaDetalhe[]
      // mapa: areaId → profileId → semana → DiaDetalhe[]
      const mapa = new Map<string, Map<string, Map<number, DiaDetalhe[]>>>();
      for (const a of listaAreas) mapa.set(a.id, new Map());

      for (const r of statusRows) {
        const semana = isoWeek(new Date(`${r.data}T12:00:00`));
        const areaMap = mapa.get(r.area_id);
        if (!areaMap) continue;
        if (!areaMap.has(r.profile_id)) areaMap.set(r.profile_id, new Map());
        const profMap = areaMap.get(r.profile_id)!;
        if (!profMap.has(semana)) profMap.set(semana, []);

        const dia: DiaDetalhe = {
          data:            r.data,
          sireneScore:     extractSireneScore(r.sirene),
          atividadesScore: extractAtividadesScore(r.engajamento),
          cardsScore:      extractCardsScore(r.engajamento),
        };
        profMap.get(semana)!.push(dia);
      }

      // 7. Construir AreaDashboard[]
      const areasResult: AreaDashboard[] = listaAreas.map(a => {
        const areaMap = mapa.get(a.id) ?? new Map<string, Map<number, DiaDetalhe[]>>();

        const usuarios: UsuarioDashboard[] = [];
        for (const [profileId, profMap] of areaMap) {
          const porSemana: Record<number, SemanaData> = {};

          for (const sem of semList) {
            const dias = profMap.get(sem) ?? [];
            dias.sort((x, y) => x.data.localeCompare(y.data));
            porSemana[sem] = {
              sireneScore:     avgOrNull(dias.map(d => d.sireneScore)),
              atividadesScore: avgOrNull(dias.map(d => d.atividadesScore)),
              cardsScore:      avgOrNull(dias.map(d => d.cardsScore)),
              dias,
            };
          }

          usuarios.push({
            profileId,
            nome: nomesPorProfile.get(profileId) ?? profileId.slice(0, 8),
            porSemana,
          });
        }

        // Ordenar usuários por nome
        usuarios.sort((a, b) => a.nome.localeCompare(b.nome));

        return { id: a.id, nome: a.nome, usuarios };
      });

      // Filtrar áreas sem usuários com dados
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
