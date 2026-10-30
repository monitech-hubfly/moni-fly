'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isoWeek } from '@/utils/periodos';
import { listarAreas } from '@/utils/areasOrder';
import { proximoMes, getMonthLabel, getMonthOptions } from '@/hooks/useFechamentoBoneDay';

export { proximoMes, getMonthLabel, getMonthOptions };

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type GrupoId = 'verde-escuro' | 'verde-claro' | 'amarelo' | 'vermelho';

export type MetaSimples = {
  id: string;
  descricao: string;
  is_chave: boolean;
  tipo: string | null;
  meta_unidade: string | null;
};

export type BlockerSimples = {
  id: string;
  descricao: string;
};

export type AreaRelatorio = {
  id: string;
  nome: string;
  scores: { indicadores: number | null; engajamento: number | null; sirene: number | null };
  grupo: GrupoId | 'sem-dados';
  metasConcluidas: MetaSimples[];
  metasEmAberto: MetaSimples[];
  blockers: BlockerSimples[];
  comentario: string;
  fechamentoId: string | null;
};

export type GrupoRelatorio = {
  id: GrupoId;
  label: string;
  corFundo: string;
  corTexto: string;
  areas: AreaRelatorio[];
};

// ── Thresholds — idênticos ao sistema (MeuCarometroCard, fechamento-bone-day) ─
function calcularGrupo(indScore: number | null): GrupoId | 'sem-dados' {
  if (indScore === null) return 'sem-dados';
  if (indScore >= 75) return 'verde-escuro';
  if (indScore >= 60) return 'verde-claro';
  if (indScore >= 30) return 'amarelo';
  return 'vermelho';
}

function nomeArea(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

export function ehAreaDiretoria(nome: string): boolean {
  return nomeArea(nome) === 'diretoria';
}

/** Ajustes só desta tela. As outras continuam com o cálculo automático. */
function aplicarAjusteExibicao(area: AreaRelatorio): AreaRelatorio {
  const nome = nomeArea(area.nome);
  if (nome === 'imob') {
    return {
      ...area,
      scores: { indicadores: null, engajamento: null, sirene: null },
      grupo: 'sem-dados',
    };
  }
  if (nome === 'projetos - executivos locais') {
    return {
      ...area,
      scores: { ...area.scores, indicadores: 0 },
      grupo: 'vermelho',
    };
  }
  return area;
}

function ordenarPorIndicador(lista: AreaRelatorio[]): AreaRelatorio[] {
  return [...lista].sort((a, b) => {
    const ia = a.scores.indicadores ?? Number.POSITIVE_INFINITY;
    const ib = b.scores.indicadores ?? Number.POSITIVE_INFINITY;
    if (ia !== ib) return ib - ia;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

// ── Grupos na ordem de exibição ───────────────────────────────────────────────
export const GRUPOS_CONFIG: { id: GrupoId; label: string; corFundo: string; corTexto: string }[] = [
  {
    id: 'verde-escuro',
    label: 'Verde Escuro — Indicadores ≥ 75%',
    corFundo: 'var(--moni-green-800)',
    corTexto: 'var(--moni-text-inverse)',
  },
  {
    id: 'verde-claro',
    label: 'Verde Claro — Indicadores ≥ 60%',
    corFundo: 'var(--moni-green-400)',
    corTexto: 'var(--moni-text-inverse)',
  },
  {
    id: 'amarelo',
    label: 'Amarelo — Indicadores ≥ 30%',
    corFundo: 'var(--moni-gold-400)',
    corTexto: 'var(--moni-earth-800)',
  },
  {
    id: 'vermelho',
    label: 'Vermelho — Indicadores < 30%',
    corFundo: 'var(--moni-status-overdue-text)',
    corTexto: 'var(--moni-text-inverse)',
  },
];

// ── Cálculo de scores — lógica espelhada do useFechamentoBoneDay ─────────────
type StatusRow = {
  area_id: string;
  profile_id: string;
  data: string;
  sirene: unknown;
  engajamento: unknown;
  indicadores: unknown;
};

const INDICADORES_SEMANA_MIN: Record<string, number> = { '2026-08': 34 };

function calcularScoresArea(
  statusArr: StatusRow[],
  mes: string,
): { indicadores: number | null; engajamento: number | null; sirene: number | null } {
  if (statusArr.length === 0) return { indicadores: null, engajamento: null, sirene: null };

  // Snapshot mais recente por pessoa por semana
  const porSemanaProfile = new Map<number, Map<string, StatusRow>>();
  for (const r of statusArr) {
    const semana = isoWeek(new Date(`${r.data}T12:00:00`));
    if (!porSemanaProfile.has(semana)) porSemanaProfile.set(semana, new Map());
    const profMap = porSemanaProfile.get(semana)!;
    const existing = profMap.get(r.profile_id);
    if (!existing || r.data > existing.data) profMap.set(r.profile_id, r);
  }
  const snapshots: StatusRow[] = [];
  for (const profMap of porSemanaProfile.values()) {
    for (const snap of profMap.values()) snapshots.push(snap);
  }

  // Sirene — ΣConcluidos / ΣRelevantes
  let sireneConcluidos = 0;
  let sireneRelevantes = 0;
  for (const r of snapshots) {
    const s = r.sirene as Record<string, unknown> | null;
    if (s && typeof s === 'object') {
      sireneConcluidos += typeof s.concluidos === 'number' ? s.concluidos : 0;
      sireneRelevantes += typeof s.relevantes === 'number' ? s.relevantes : 0;
    }
  }
  const sireneScore =
    sireneRelevantes > 0 ? Math.max(0, Math.round((sireneConcluidos / sireneRelevantes) * 100)) : null;

  // Engajamento — média de 3 sub-scores
  let engAtivReal = 0, engAtivAgend = 0;
  let engCardsEmDia = 0, engCardsComSLA = 0;
  let engProxConc = 0, engProxRel = 0;
  for (const r of snapshots) {
    const e = r.engajamento as Record<string, unknown> | null;
    if (!e || typeof e !== 'object') continue;
    const at = e.atividades as Record<string, unknown> | null;
    if (at) {
      engAtivReal += typeof at.realizadas === 'number' ? at.realizadas : 0;
      engAtivAgend += typeof at.agendadas === 'number' ? at.agendadas : 0;
    }
    const ca = e.cards as Record<string, unknown> | null;
    if (ca) {
      engCardsEmDia += typeof ca.emDia === 'number' ? ca.emDia : 0;
      engCardsComSLA += typeof ca.comSLA === 'number' ? ca.comSLA : 0;
    }
    const pr = e.proximas as Record<string, unknown> | null;
    if (pr) {
      engProxConc += typeof pr.concluidos === 'number' ? pr.concluidos : 0;
      engProxRel += typeof pr.relevantes === 'number' ? pr.relevantes : 0;
    }
  }
  const scoreAtiv = engAtivAgend > 0 ? Math.max(0, Math.round((engAtivReal / engAtivAgend) * 100)) : 0;
  const scoreCards =
    engCardsComSLA > 0
      ? Math.max(0, Math.round((engCardsEmDia / engCardsComSLA) * 100))
      : snapshots.length > 0
      ? 100
      : null;
  const scoreProx = engProxRel > 0 ? Math.max(0, Math.round((engProxConc / engProxRel) * 100)) : 100;
  const engSubs = [scoreAtiv, scoreCards, scoreProx].filter((s): s is number => s !== null);
  const engScore =
    engSubs.length > 0 ? Math.round(engSubs.reduce((a, b) => a + b, 0) / engSubs.length) : null;

  // Indicadores — média das médias (por snapshot)
  const indSemanaMin = INDICADORES_SEMANA_MIN[mes] ?? null;
  const snapshotsInd =
    indSemanaMin !== null
      ? snapshots.filter(r => isoWeek(new Date(`${r.data}T12:00:00`)) >= indSemanaMin)
      : snapshots;
  const indMedias = snapshotsInd
    .map(r => {
      const ind = r.indicadores as Record<string, unknown> | null;
      if (!ind || typeof ind !== 'object') return null;
      const v = ind.media;
      return typeof v === 'number' ? Math.round(v) : null;
    })
    .filter((v): v is number => v !== null);
  const indScore =
    indMedias.length > 0 ? Math.round(indMedias.reduce((a, b) => a + b, 0) / indMedias.length) : null;

  return { indicadores: indScore, engajamento: engScore, sirene: sireneScore };
}

// ── Hook principal ────────────────────────────────────────────────────────────
export function useFechamentoBoneDayPorIndicadores(effectiveProfileId: string | null) {
  const supabase = useMemo(() => createClient(), []);

  const [mes, setMes] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [areas, setAreas] = useState<AreaRelatorio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [y, m] = mes.split('-').map(Number);
      const primeiroDia = `${mes}-01`;
      const ultimoDia = new Date(y, m, 0).toISOString().slice(0, 10);
      const proximo = proximoMes(mes);
      const proxMesInicio = `${proximo}-01`;

      // 1. Todas as áreas ordenadas
      const areasRes = await (
        listarAreas as (s: unknown, f: string) => Promise<{ data: { id: string; nome: string }[] | null }>
      )(supabase, 'id, nome');
      const todasAreas = (areasRes.data ?? []) as { id: string; nome: string }[];

      // 2. Queries em paralelo — sem filtro de área (traz tudo de uma vez)
      const [statusRes, objRes, blockersRes, fechRes] = await Promise.all([
        supabase
          .from('carometro_status_diario')
          .select('area_id, profile_id, data, sirene, engajamento, indicadores')
          .gte('data', primeiroDia)
          .lte('data', ultimoDia),

        // Buscar descricao completa para exibir na tabela
        supabase
          .from('objetivos')
          .select('id, area_id, status, descricao, is_chave, tipo, meta_unidade')
          .eq('mes', mes)
          .in('status', ['ativo', 'concluido', 'relancada', 'arquivado'])
          .is('objetivo_pai_id', null)
          .order('is_chave', { ascending: false })
          .order('ordem', { ascending: true }),

        // Buscar descricao do blocker para exibir na tabela
        supabase
          .from('blockers')
          .select('id, area_id, descricao')
          .eq('resolvido', false)
          .gte('criado_em', primeiroDia)
          .lt('criado_em', proxMesInicio),

        supabase.from('bone_day_fechamento').select('area_id, id, comentario').eq('mes', mes),
      ]);

      // 3. Indexar por area_id
      const statusPorArea = new Map<string, StatusRow[]>();
      for (const r of (statusRes.data ?? []) as StatusRow[]) {
        if (!statusPorArea.has(r.area_id)) statusPorArea.set(r.area_id, []);
        statusPorArea.get(r.area_id)!.push(r);
      }

      type ObjRow = {
        id: string;
        area_id: string;
        status: string;
        descricao: string;
        is_chave: boolean | null;
        tipo: string | null;
        meta_unidade: string | null;
      };
      const metasConcPorArea = new Map<string, MetaSimples[]>();
      const metasAbertoPorArea = new Map<string, MetaSimples[]>();
      for (const o of (objRes.data ?? []) as ObjRow[]) {
        const meta: MetaSimples = {
          id: o.id,
          descricao: o.descricao,
          is_chave: Boolean(o.is_chave),
          tipo: o.tipo,
          meta_unidade: o.meta_unidade,
        };
        if (o.status === 'concluido') {
          if (!metasConcPorArea.has(o.area_id)) metasConcPorArea.set(o.area_id, []);
          metasConcPorArea.get(o.area_id)!.push(meta);
        } else {
          if (!metasAbertoPorArea.has(o.area_id)) metasAbertoPorArea.set(o.area_id, []);
          metasAbertoPorArea.get(o.area_id)!.push(meta);
        }
      }

      type BlockerRow = { id: string; area_id: string; descricao: string };
      const blockersPorArea = new Map<string, BlockerSimples[]>();
      for (const b of (blockersRes.data ?? []) as BlockerRow[]) {
        if (!blockersPorArea.has(b.area_id)) blockersPorArea.set(b.area_id, []);
        blockersPorArea.get(b.area_id)!.push({ id: b.id, descricao: b.descricao });
      }

      type FechRow = { area_id: string; id: string; comentario: string | null };
      const fechPorArea = new Map<string, FechRow>();
      for (const f of (fechRes.data ?? []) as FechRow[]) {
        fechPorArea.set(f.area_id, f);
      }

      // 4. Montar AreaRelatorio por área
      const resultado: AreaRelatorio[] = todasAreas.map(a => {
        const statusArr = statusPorArea.get(a.id) ?? [];
        const scores = calcularScoresArea(statusArr, mes);

        const fechRec = fechPorArea.get(a.id);
        let comentario = '';
        if (fechRec?.comentario) {
          try {
            const parsed = JSON.parse(fechRec.comentario);
            comentario =
              typeof parsed.comentario_por_indicadores === 'string' ? parsed.comentario_por_indicadores : '';
          } catch {
            comentario = '';
          }
        }

        return aplicarAjusteExibicao({
          id: a.id,
          nome: a.nome,
          scores,
          grupo: calcularGrupo(scores.indicadores),
          metasConcluidas: metasConcPorArea.get(a.id) ?? [],
          metasEmAberto: metasAbertoPorArea.get(a.id) ?? [],
          blockers: blockersPorArea.get(a.id) ?? [],
          comentario,
          fechamentoId: fechRec?.id ?? null,
        });
      });

      setAreas(resultado);
    } catch (e) {
      console.error('[useFechamentoBoneDayPorIndicadores]', e);
      setError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      setIsLoading(false);
    }
  }, [supabase, mes]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Salva apenas a chave comentario_por_indicadores, preservando o restante do JSON
  const salvarComentario = useCallback(
    async (areaId: string, texto: string) => {
      const area = areas.find(a => a.id === areaId);
      if (!area) return;

      let parsed: Record<string, unknown> = {};
      if (area.fechamentoId) {
        const { data } = await supabase
          .from('bone_day_fechamento')
          .select('comentario')
          .eq('id', area.fechamentoId)
          .maybeSingle();
        if (data?.comentario) {
          try {
            parsed = JSON.parse(data.comentario as string);
          } catch {
            parsed = {};
          }
        }
      }
      parsed.comentario_por_indicadores = texto;
      const json = JSON.stringify(parsed);

      if (area.fechamentoId) {
        await supabase
          .from('bone_day_fechamento')
          .update({ comentario: json, atualizado_em: new Date().toISOString() })
          .eq('id', area.fechamentoId);
        setAreas(prev => prev.map(a => (a.id === areaId ? { ...a, comentario: texto } : a)));
      } else {
        const { data, error: err } = await supabase
          .from('bone_day_fechamento')
          .insert({ area_id: areaId, mes, comentario: json, criado_por: effectiveProfileId })
          .select('id')
          .maybeSingle();
        if (!err && data) {
          setAreas(prev =>
            prev.map(a =>
              a.id === areaId
                ? { ...a, comentario: texto, fechamentoId: (data as { id: string }).id }
                : a,
            ),
          );
        }
      }
    },
    [supabase, areas, mes, effectiveProfileId],
  );

  const grupos: GrupoRelatorio[] = useMemo(
    () => GRUPOS_CONFIG.map(g => ({
      ...g,
      areas: ordenarPorIndicador(areas.filter(a => a.grupo === g.id)),
    })),
    [areas],
  );

  // Áreas sem dados de Carômetro (score null → não classificáveis nos 4 grupos)
  const areasSemDados = useMemo(() => areas.filter(a => a.grupo === 'sem-dados'), [areas]);

  return { grupos, areasSemDados, mes, setMes, isLoading, error, salvarComentario };
}
