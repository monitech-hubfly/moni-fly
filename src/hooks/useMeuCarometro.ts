'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isoWeek } from '@/utils/periodos';

export type DiaStatus = {
  data: string;
  score: number | null;
};

export type SireneSnapshot = {
  atrasados: number;
  abertos: number;
  semPrazo: number;
  score: number | null;
};

export type EngajamentoSnapshot = {
  atividadesAtrasadas: number;
  acumuladoDias: number;
  cards: { atrasados: number; abertos: number };
  score: number | null;
};

export type IndicadorItem = {
  nome: string;
  valor: number;
  meta: number;
  percentual: number;
};

export type IndicadoresSnapshot = {
  porIndicador: IndicadorItem[];
  media: number | null;
};

export type UseMeuCarometroResult = {
  sirene: SireneSnapshot | null;
  engajamento: EngajamentoSnapshot | null;
  indicadores: IndicadoresSnapshot | null;
  diasSirene: DiaStatus[];
  diasEngajamento: DiaStatus[];
  diasIndicadores: DiaStatus[];
  semanaAtual: number;
  isLoading: boolean;
  error: string | null;
};

function getDiasSemanAtual(): string[] {
  const hoje = new Date();
  const dow = hoje.getDay() || 7; // 1=Seg … 7=Dom
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() - (dow - 1));
  const dias: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(segunda);
    d.setDate(segunda.getDate() + i);
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

export function useMeuCarometro(): UseMeuCarometroResult {
  const supabase = useMemo(() => createClient(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sirene, setSirene] = useState<SireneSnapshot | null>(null);
  const [engajamento, setEngajamento] = useState<EngajamentoSnapshot | null>(null);
  const [indicadores, setIndicadores] = useState<IndicadoresSnapshot | null>(null);
  const [diasSirene, setDiasSirene] = useState<DiaStatus[]>([]);
  const [diasEngajamento, setDiasEngajamento] = useState<DiaStatus[]>([]);
  const [diasIndicadores, setDiasIndicadores] = useState<DiaStatus[]>([]);
  const [semanaAtual, setSemanaAtual] = useState<number>(() => isoWeek(new Date()));

  const carregar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const hoje = new Date();
      const semana = isoWeek(hoje);
      setSemanaAtual(semana);
      const hojeStr = hoje.toISOString().slice(0, 10);
      const diasSemana = getDiasSemanAtual();

      // Dados do usuário na área
      const { data: areaPessoa } = await supabase
        .from('area_pessoas')
        .select('area_id, nome')
        .eq('profile_id', user.id)
        .maybeSingle();

      const areaId = (areaPessoa?.area_id as string | null) ?? null;
      const nomeUsuario = (areaPessoa?.nome as string | null) ?? null;

      // Snapshots armazenados para os dias da semana atual
      const { data: snapshots } = await supabase
        .from('carometro_status_diario')
        .select('data, sirene, engajamento, indicadores')
        .eq('profile_id', user.id)
        .in('data', diasSemana);

      type SnapRow = { data: string; sirene: unknown; engajamento: unknown; indicadores: unknown };
      const snapshotMap = new Map<string, SnapRow>(
        ((snapshots ?? []) as SnapRow[]).map(s => [s.data, s])
      );

      // ── Sirene (fallback runtime) ────────────────────────────────────────────
      const { data: topicos } = await supabase
        .from('sirene_topicos')
        .select('id, data_fim, prazo_proposto')
        .eq('responsavel_id', user.id)
        .in('status', ['nao_iniciado', 'em_andamento'])
        .eq('arquivado', false);

      const topicosArr = topicos ?? [];
      const topicosSemPrazo = topicosArr.filter(
        t => !t.data_fim && !t.prazo_proposto
      ).length;
      const topicosAtrasados = topicosArr.filter(t => {
        const prazo = (t.data_fim || t.prazo_proposto) as string | null;
        if (!prazo) return false;
        return new Date(prazo) < hoje;
      }).length;
      const sireneScore =
        topicosArr.length === 0
          ? 100
          : Math.max(0, Math.round((1 - topicosAtrasados / topicosArr.length) * 100));

      const sireneRuntime: SireneSnapshot = {
        atrasados: topicosAtrasados,
        abertos: topicosArr.length,
        semPrazo: topicosSemPrazo,
        score: sireneScore,
      };

      // ── Engajamento (fallback runtime via gantt_planejamento) ────────────────
      let engajamentoRuntime: EngajamentoSnapshot = {
        atividadesAtrasadas: 0,
        acumuladoDias: 0,
        cards: { atrasados: 0, abertos: 0 },
        score: null,
      };

      if (nomeUsuario) {
        const { data: ganttRows } = await supabase
          .from('gantt_planejamento')
          .select('id, semana_inicio, semana_fim')
          .ilike('responsavel', `%${nomeUsuario}%`);

        const ganttArr = ganttRows ?? [];
        const atividadesAtrasadas = ganttArr.filter(g => {
          const sf = Number(g.semana_fim);
          return Number.isFinite(sf) && sf < semana;
        }).length;
        const atividadesSemana = ganttArr.filter(g => {
          const si = Number(g.semana_inicio);
          const sf = Number(g.semana_fim);
          return Number.isFinite(si) && Number.isFinite(sf) && si <= semana && sf >= semana;
        }).length;
        const engScore =
          ganttArr.length === 0
            ? null
            : Math.max(0, Math.round((1 - atividadesAtrasadas / Math.max(ganttArr.length, 1)) * 100));

        engajamentoRuntime = {
          atividadesAtrasadas,
          acumuladoDias: atividadesSemana,
          cards: { atrasados: 0, abertos: 0 },
          score: engScore,
        };
      }

      // ── Indicadores (fallback runtime) ──────────────────────────────────────
      let indicadoresRuntime: IndicadoresSnapshot = { porIndicador: [], media: null };

      if (areaId) {
        const { data: indsData } = await supabase
          .from('indicadores')
          .select('id, nome')
          .eq('area_id', areaId);

        const indIds = ((indsData ?? []) as { id: string; nome: string }[]).map(i => i.id);

        if (indIds.length > 0) {
          const { data: lancamentos } = await supabase
            .from('indicador_lancamentos')
            .select('indicador_id, valor')
            .in('indicador_id', indIds)
            .eq('semana', semana);

          const lancMap = new Map<string, number>(
            ((lancamentos ?? []) as { indicador_id: string; valor: unknown }[]).map(l => [
              l.indicador_id,
              Number(l.valor) || 0,
            ])
          );

          const indsTyped = (indsData ?? []) as { id: string; nome: string }[];
          const porIndicador: IndicadorItem[] = indsTyped
            .filter(ind => lancMap.has(ind.id))
            .map(ind => {
              const valor = lancMap.get(ind.id) ?? 0;
              return { nome: ind.nome || ind.id, valor, meta: 0, percentual: valor > 0 ? 100 : 0 };
            });

          const comValor = porIndicador.filter(i => i.valor > 0).length;
          const media = indIds.length === 0 ? null : Math.round((comValor / indIds.length) * 100);
          indicadoresRuntime = { porIndicador, media };
        }
      }

      // ── Monta dias da semana com scores (snapshot > runtime de hoje) ─────────
      const buildDias = (
        snapKey: 'sirene' | 'engajamento' | 'indicadores',
        scoreField: string,
        runtimeScore: number | null,
      ): DiaStatus[] =>
        diasSemana.map(data => {
          const snap = snapshotMap.get(data);
          if (snap?.[snapKey]) {
            const s = snap[snapKey] as Record<string, unknown>;
            return { data, score: typeof s[scoreField] === 'number' ? (s[scoreField] as number) : null };
          }
          if (data === hojeStr) return { data, score: runtimeScore };
          return { data, score: null };
        });

      setSirene(sireneRuntime);
      setEngajamento(engajamentoRuntime);
      setIndicadores(indicadoresRuntime);
      setDiasSirene(buildDias('sirene', 'score', sireneScore));
      setDiasEngajamento(buildDias('engajamento', 'score', engajamentoRuntime.score));
      setDiasIndicadores(buildDias('indicadores', 'media', indicadoresRuntime.media));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => { carregar(); }, [carregar]);

  return {
    sirene,
    engajamento,
    indicadores,
    diasSirene,
    diasEngajamento,
    diasIndicadores,
    semanaAtual,
    isLoading,
    error,
  };
}
