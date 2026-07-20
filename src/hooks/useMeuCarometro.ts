'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isoWeek, isoWeekYear } from '@/utils/periodos';
import { useSimulacaoUsuario } from '@/components/carometro/todo/SeletorUsuarioAdmin';
import { calcularSlaKanbanCard } from '@/lib/kanban/kanban-card-sla';

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

// Mapeamento cor semáforo → score 0-100
const COR_PARA_SCORE: Record<string, number> = {
  '#1e7a3a': 100,
  '#52b36f': 75,
  '#f2c94c': 50,
  '#d24141': 0,
};

type SemaforoFaixa = { cor: string; limite: string | number; comparacao?: string };

function scoreDeValorESemaforo(valor: unknown, semaforo_faixas: unknown): number {
  if (valor == null || valor === '') return 50;
  const faixas = (semaforo_faixas as { faixas?: SemaforoFaixa[] } | null)?.faixas;
  if (!faixas?.length) return 50;

  const n = Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(n)) return 50;

  for (const f of faixas) {
    const limite = Number(String(f.limite ?? '').replace(',', '.'));
    if (!Number.isFinite(limite)) continue;
    const op = f.comparacao ?? 'gte';
    let match = false;
    if (op === 'gte') match = n >= limite;
    else if (op === 'gt')  match = n > limite;
    else if (op === 'lte') match = n <= limite;
    else if (op === 'lt')  match = n < limite;
    else if (op === 'eq')  match = n === limite;
    if (match) return COR_PARA_SCORE[f.cor?.toLowerCase()] ?? 50;
  }
  return 50;
}

function getDiasSemanAtual(): string[] {
  const hoje = new Date();
  const dow = hoje.getDay() || 7;
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

const ADMIN_EMAIL = 'danilo.n@moni.casa';

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
  const callIdRef = useRef(0);

  const { simulacao } = useSimulacaoUsuario();
  const simProfileId = simulacao?.profileId ?? null;
  const simAreaId    = simulacao?.areaId ?? null;
  const simNome      = simulacao?.nomeUsuario ?? null;

  const carregar = useCallback(async () => {
    const callId = ++callIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const isAdmin = user.email === ADMIN_EMAIL;
      const hoje = new Date();
      const semana = isoWeek(hoje);
      const anoISO = isoWeekYear(hoje);
      setSemanaAtual(semana);
      const hojeStr = hoje.toISOString().slice(0, 10);
      const diasSemana = getDiasSemanAtual();

      // ── Resolve identidade efetiva (simulação admin ou usuário real) ───────────
      let effectiveProfileId = user.id;
      let areaId: string | null = null;
      let nomeUsuario: string | null = null;

      if (isAdmin && simProfileId) {
        effectiveProfileId = simProfileId;
        areaId   = simAreaId;
        nomeUsuario = simNome;
      } else {
        const { data: areaPessoa } = await supabase
          .from('area_pessoas')
          .select('area_id, nome')
          .eq('profile_id', user.id)
          .maybeSingle();
        areaId      = (areaPessoa?.area_id as string | null) ?? null;
        nomeUsuario = (areaPessoa?.nome    as string | null) ?? null;
      }

      // ── Snapshots armazenados para os dias da semana atual ───────────────────
      const { data: snapshots } = await supabase
        .from('carometro_status_diario')
        .select('data, sirene, engajamento, indicadores')
        .eq('profile_id', effectiveProfileId)
        .in('data', diasSemana);

      type SnapRow = { data: string; sirene: unknown; engajamento: unknown; indicadores: unknown };
      const snapshotMap = new Map<string, SnapRow>(
        ((snapshots ?? []) as SnapRow[]).map(s => [s.data, s])
      );

      // ── Sirene (fallback runtime) ────────────────────────────────────────────
      // Inclui responsáveis secundários (responsaveis_ids)
      const { data: topicos } = await supabase
        .from('sirene_topicos')
        .select('id, data_fim, prazo_proposto')
        .or(`responsavel_id.eq.${effectiveProfileId},responsaveis_ids.cs.{${effectiveProfileId}}`)
        .in('status', ['nao_iniciado', 'em_andamento'])
        .eq('arquivado', false);

      const topicosArr = topicos ?? [];
      const topicosSemPrazo  = topicosArr.filter(t => !t.data_fim && !t.prazo_proposto).length;
      const topicosAtrasados = topicosArr.filter(t => {
        const prazo = (t.data_fim || t.prazo_proposto) as string | null;
        if (!prazo) return false;
        return new Date(prazo) < hoje;
      }).length;
      // Score: % de abertos que estão no prazo
      const sireneScore =
        topicosArr.length === 0
          ? 100
          : Math.max(0, Math.round(((topicosArr.length - topicosAtrasados) / topicosArr.length) * 100));

      const sireneRuntime: SireneSnapshot = {
        atrasados: topicosAtrasados,
        abertos:   topicosArr.length,
        semPrazo:  topicosSemPrazo,
        score:     sireneScore,
      };

      // ── Engajamento (Atividades Planejadas + Cards/Kanban) ───────────────────
      let engajamentoRuntime: EngajamentoSnapshot = {
        atividadesAtrasadas: 0,
        acumuladoDias: 0,
        cards: { atrasados: 0, abertos: 0 },
        score: null,
      };

      {
        // Atividades Planejadas (gantt) — janela ±4 semanas
        const semanaJanela = [
          semana - 4, semana - 3, semana - 2, semana - 1,
          semana, semana + 1, semana + 2,
        ];
        const ganttQuery = supabase
          .from('gantt_planejamento')
          .select('id, semana_ano_inicio, semana_ano_fim, semanas_selecionadas')
          .or(`profile_id.eq.${effectiveProfileId}${nomeUsuario ? `,responsavel.ilike.%${nomeUsuario}%` : ''}`)
          .is('data_conclusao_real', null)
          .overlaps('semanas_selecionadas', semanaJanela);

        // Cards/Kanban abertos — responsável explícito OU dono sem responsável
        const kanbanQuery = supabase
          .from('kanban_cards')
          .select('id, created_at, entered_fase_at, sla_iniciado_em, fase:kanban_fases(sla_dias, sla_tipo, slug)')
          .or(`responsavel_id.eq.${effectiveProfileId},responsaveis_ids.cs.{${effectiveProfileId}},and(franqueado_id.eq.${effectiveProfileId},responsavel_id.is.null)`)
          .eq('arquivado', false)
          .eq('concluido', false);

        const [ganttRes, kanbanRes] = await Promise.all([ganttQuery, kanbanQuery]);

        const ganttArr = ganttRes.data ?? [];
        const kanbanArr = (kanbanRes.data ?? []) as Array<{
          id: string;
          created_at: string;
          entered_fase_at: string | null;
          sla_iniciado_em: string | null;
          fase: { sla_dias: number | null; sla_tipo: string | null; slug: string | null } | Array<{ sla_dias: number | null; sla_tipo: string | null; slug: string | null }> | null;
        }>;

        // Atividades atrasadas: semana_ano_fim < semana atual
        const atividadesAtrasadas = ganttArr.filter(g => {
          const sf = g.semana_ano_fim ?? (
            Array.isArray(g.semanas_selecionadas) && g.semanas_selecionadas.length
              ? Math.max(...(g.semanas_selecionadas as number[]))
              : null
          );
          return sf != null && Number(sf) < semana;
        }).length;

        // Cards atrasados: usa SLA real (mesmo cálculo do BacklogKanban)
        const cardsAtrasados = kanbanArr.filter(c => {
          const fase = Array.isArray(c.fase) ? c.fase[0] : c.fase;
          const sla = calcularSlaKanbanCard({
            created_at: c.created_at,
            entered_fase_at: c.entered_fase_at,
            sla_iniciado_em: c.sla_iniciado_em,
            sla_dias: fase?.sla_dias ?? null,
            sla_tipo: fase?.sla_tipo ?? null,
            faseSlug: fase?.slug ?? null,
          });
          return sla.status === 'atrasado';
        }).length;

        const totalAtiv      = ganttArr.length;
        const totalCards     = kanbanArr.length;
        const totalGeral     = totalAtiv + totalCards;
        const totalAtrasados = atividadesAtrasadas + cardsAtrasados;

        const engScore = totalGeral === 0
          ? null
          : Math.max(0, Math.round(((totalGeral - totalAtrasados) / totalGeral) * 100));

        engajamentoRuntime = {
          atividadesAtrasadas,
          acumuladoDias: totalAtiv,
          cards: { atrasados: cardsAtrasados, abertos: totalCards },
          score: engScore,
        };
      }

      // ── Indicadores com score via semáforo ──────────────────────────────────
      let indicadoresRuntime: IndicadoresSnapshot = { porIndicador: [], media: null };

      if (areaId) {
        const { data: indsData } = await supabase
          .from('indicadores')
          .select('id, nome, semaforo_faixas')
          .eq('area_id', areaId);

        const indsTyped = ((indsData ?? []) as { id: string; nome: string; semaforo_faixas: unknown }[]);
        const indIds = indsTyped.map(i => i.id);

        if (indIds.length > 0) {
          // Período ativo via data_inicio/data_fim (a tabela não tem semana_inicio/semana_fim)
          const { data: periodo } = await supabase
            .from('periodos')
            .select('id, data_inicio, data_fim')
            .lte('data_inicio', hojeStr)
            .gte('data_fim', hojeStr)
            .eq('ano', anoISO)
            .order('data_fim', { ascending: true })
            .limit(1)
            .maybeSingle();

          const semanaRelativa = periodo
            ? isoWeek(new Date((periodo as { data_inicio: string }).data_inicio))
            : semana;

          const { data: lancamentos } = await supabase
            .from('indicador_lancamentos')
            .select('indicador_id, valor')
            .in('indicador_id', indIds)
            .eq('semana', semanaRelativa);

          const lancMap = new Map<string, unknown>(
            ((lancamentos ?? []) as { indicador_id: string; valor: unknown }[]).map(l => [
              l.indicador_id,
              l.valor,
            ])
          );

          const porIndicador: IndicadorItem[] = indsTyped
            .filter(ind => lancMap.has(ind.id))
            .map(ind => {
              const valor = lancMap.get(ind.id);
              const score = scoreDeValorESemaforo(valor, ind.semaforo_faixas);
              return {
                nome:       ind.nome || ind.id,
                valor:      Number(valor) || 0,
                meta:       0,
                percentual: score,
              };
            });

          const scores = porIndicador.map(i => i.percentual);
          const media  = scores.length > 0
            ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
            : null;

          indicadoresRuntime = { porIndicador, media };
        }
      }

      // ── Dias da semana com scores (snapshot > runtime de hoje) ───────────────
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

      if (callId !== callIdRef.current) return;
      setSirene(sireneRuntime);
      setEngajamento(engajamentoRuntime);
      setIndicadores(indicadoresRuntime);
      setDiasSirene(buildDias('sirene', 'score', sireneScore));
      setDiasEngajamento(buildDias('engajamento', 'score', engajamentoRuntime.score));
      setDiasIndicadores(buildDias('indicadores', 'media', indicadoresRuntime.media));
    } catch (e) {
      if (callId !== callIdRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (callId === callIdRef.current) setIsLoading(false);
    }
  }, [supabase, simProfileId, simAreaId, simNome]);

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
