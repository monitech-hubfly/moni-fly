'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isoWeek, isoWeekYear } from '@/utils/periodos';
import { useSimulacaoUsuario } from '@/components/carometro/todo/SeletorUsuarioAdmin';
import { calcularSlaKanbanCard } from '@/lib/kanban/kanban-card-sla';

export type DiaStatus = {
  data: string;
  score: number | null;
  detalhe?: Record<string, number | string | null>;
};

export type SemanaStatusInd = {
  label: string;
  semana: number;
  score: number | null;
  indicadores: Array<{ nome: string; valor: string | null; percentual: number }>;
};

export type SireneSnapshot = {
  atrasados:  number;
  abertos:    number;
  venceHoje:  number;
  futuras:    number;
  relevantes: number;
  concluidos: number;
  semPrazo:   number;
  score:      number | null;
};

export type EngajamentoSnapshot = {
  atividades: { agendadas: number; realizadas: number; atrasadas: number; score: number | null };
  cards:      { comSLA: number; emDia: number; atrasados: number; score: number | null };
  proximas:   { concluidos: number; venceHoje: number; atrasadas: number; relevantes: number; score: number | null };
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
  semanasIndicadores: SemanaStatusInd[];
  semanaAtual: number;
  isLoading: boolean;
  error: string | null;
};

// Mapeamento cor semáforo → score 0-100
const COR_PARA_SCORE: Record<string, number> = {
  '#1e7a3a': 100,
  '#52b36f': 67,
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

/**
 * Calcula % esperado de um indicador Atingível/Projeto com base em dias úteis decorridos.
 * Exclui apenas fins de semana (sábado e domingo).
 * Retorna 0 se projeto não iniciado, 100 se já passou do prazo.
 */
function calcularEsperadoPct(dataInicio: string, dataFim: string, diasUteis: number): number {
  if (!dataInicio || !dataFim || !diasUteis || diasUteis <= 0) return 0;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(dataInicio + 'T00:00:00');
  const fim    = new Date(dataFim    + 'T00:00:00');
  if (hoje < inicio) return 0;
  if (hoje > fim)    return 100;
  let count = 0;
  const d = new Date(inicio);
  while (d <= hoje) {
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return Math.min(100, Math.round((count / diasUteis) * 100));
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
  const [semanasIndicadores, setSemanasIndicadores] = useState<SemanaStatusInd[]>([]);
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

      // ── Sirene ────────────────────────────────────────────────────────────────
      // Início da semana (segunda) para filtro de concluídos
      const dowSirene = hoje.getDay() || 7;
      const semanaInicio = new Date(hoje);
      semanaInicio.setDate(hoje.getDate() - (dowSirene - 1));
      const semanaInicioStr = semanaInicio.toISOString().slice(0, 10);

      const [topicosAbertosRes, topicosConcluidosRes] = await Promise.all([
        supabase
          .from('sirene_topicos')
          .select('id, data_fim, prazo_proposto')
          .or(`responsavel_id.eq.${effectiveProfileId},responsaveis_ids.cs.{${effectiveProfileId}}`)
          .in('status', ['nao_iniciado', 'em_andamento'])
          .eq('arquivado', false),
        supabase
          .from('sirene_topicos')
          .select('id, data_fim, prazo_proposto')
          .or(`responsavel_id.eq.${effectiveProfileId},responsaveis_ids.cs.{${effectiveProfileId}}`)
          .in('status', ['concluido', 'aprovado'])
          .eq('arquivado', false)
          .gte('updated_at', semanaInicioStr),
      ]);

      type TopicosRow = { id: unknown; data_fim: string | null; prazo_proposto: string | null };
      const topicosAbertos = (topicosAbertosRes.data ?? []) as TopicosRow[];
      // Concluídos esta semana com prazo <= hoje entram no numerador como "realizados"
      const topicosConcluidos = ((topicosConcluidosRes.data ?? []) as TopicosRow[]).filter(t => {
        const prazo = t.data_fim || t.prazo_proposto;
        return prazo && prazo <= hojeStr;
      });

      const topicosSemPrazo = topicosAbertos.filter(t => !t.data_fim && !t.prazo_proposto).length;
      // Atrasado = prazo < hoje (prazo = hoje ainda não é atrasado)
      const topicosAtrasados = topicosAbertos.filter(t => {
        const prazo = t.data_fim || t.prazo_proposto;
        if (!prazo) return false;
        return prazo < hojeStr;
      }).length;
      // Vence hoje = open com prazo = hoje
      const topicosVenceHoje = topicosAbertos.filter(t => {
        const prazo = t.data_fim || t.prazo_proposto;
        return prazo === hojeStr;
      }).length;
      // Futuras = open com prazo > hoje (não entram no score)
      const topicosFuturas = topicosAbertos.filter(t => {
        const prazo = t.data_fim || t.prazo_proposto;
        return prazo && prazo > hojeStr;
      }).length;

      // Score: concluidos / (concluidos + atrasados + venceHoje). Futuras nunca entram.
      // total = 0 → 100% (em dia, sem pendências)
      const sireneTotal = topicosConcluidos.length + topicosAtrasados + topicosVenceHoje;
      const sireneScore = sireneTotal === 0
        ? 100
        : Math.max(0, Math.round((topicosConcluidos.length / sireneTotal) * 100));

      const sireneRuntime: SireneSnapshot = {
        atrasados:  topicosAtrasados,
        abertos:    topicosAbertos.length,
        venceHoje:  topicosVenceHoje,
        futuras:    topicosFuturas,
        relevantes: sireneTotal,
        concluidos: topicosConcluidos.length,
        semPrazo:   topicosSemPrazo,
        score:      sireneScore,
      };

      // ── Engajamento (3 sub-scores independentes) ────────────────────────────────
      // Fonte de verdade: APENAS responsavel_id (campo "Responsável do Card" na UI).
      // Cards sem responsavel_id ficam com Ingrid (padrão). franqueado_id nunca é usado.
      const engOrKanban = `responsavel_id.eq.${effectiveProfileId},responsaveis_ids.cs.{${effectiveProfileId}}`;

      let engajamentoRuntime: EngajamentoSnapshot = {
        atividades: { agendadas: 0, realizadas: 0, atrasadas: 0, score: null },
        cards:      { comSLA: 0, emDia: 0, atrasados: 0, score: null },
        proximas:   { concluidos: 0, venceHoje: 0, atrasadas: 0, relevantes: 0, score: null },
        score: null,
      };

      {
        const [ganttRes, kanbanRes, proximasAbertosRes, proximasConcluidosRes] = await Promise.all([
          supabase
            .from('gantt_planejamento')
            .select('id, data, data_conclusao_real')
            .eq('profile_id', effectiveProfileId)
            .gte('data', semanaInicioStr)
            .lte('data', hojeStr)
            .is('sirene_chamado_id', null)
            .is('card_id', null)
            .not('objetivo_id', 'is', null),   // exclui "Sem vínculo à meta"
          supabase
            .from('kanban_cards')
            .select('id, created_at, entered_fase_at, sla_iniciado_em, fase:kanban_fases!fase_id(sla_dias, sla_tipo, slug)')
            .or(engOrKanban)
            .eq('arquivado', false)
            .eq('concluido', false),
          supabase
            .from('kanban_cards')
            .select('id, prazo_atividade')
            .or(engOrKanban)
            .eq('arquivado', false)
            .eq('concluido', false)
            .not('prazo_atividade', 'is', null),
          supabase
            .from('kanban_cards')
            .select('id, prazo_atividade')
            .or(engOrKanban)
            .eq('arquivado', false)
            .eq('concluido', true)
            .not('prazo_atividade', 'is', null)
            .lte('prazo_atividade', hojeStr)
            .gte('updated_at', semanaInicioStr),
        ]);

        // Sub-score 1: Atividades da Agenda — esta semana (gantt_planejamento)
        type GanttRow = { id: string; data: string; data_conclusao_real: string | null };
        const ganttArr = (ganttRes.data ?? []) as GanttRow[];
        const atividadesAgendadas = ganttArr.length;
        const atividadesRealizadas = ganttArr.filter(g => !!g.data_conclusao_real).length;
        // Não concluída = agendada sem data_conclusao_real (inclui hoje — afeta score imediatamente)
        const atividadesAtrasadas = ganttArr.filter(g => !g.data_conclusao_real).length;
        const scoreAtividades = atividadesAgendadas === 0
          ? null
          : Math.max(0, Math.round((atividadesRealizadas / atividadesAgendadas) * 100));

        // Sub-score 2: Cards com SLA
        const kanbanArr = (kanbanRes.data ?? []) as Array<{
          id: string; created_at: string; entered_fase_at: string | null;
          sla_iniciado_em: string | null;
          fase: { sla_dias: number | null; sla_tipo: string | null; slug: string | null } | Array<{ sla_dias: number | null; sla_tipo: string | null; slug: string | null }> | null;
        }>;
        const cardsComSLA = kanbanArr.filter(c => {
          const fase = Array.isArray(c.fase) ? c.fase[0] : c.fase;
          return (fase?.sla_dias ?? null) !== null;
        });
        const cardsAtrasados = cardsComSLA.filter(c => {
          const fase = Array.isArray(c.fase) ? c.fase[0] : c.fase;
          return calcularSlaKanbanCard({
            created_at:      c.created_at,
            entered_fase_at: c.entered_fase_at,
            sla_iniciado_em: c.sla_iniciado_em,
            sla_dias:        fase?.sla_dias ?? null,
            sla_tipo:        fase?.sla_tipo ?? null,
            faseSlug:        fase?.slug     ?? null,
          }).status === 'atrasado';
        }).length;
        const cardsEmDia = cardsComSLA.length - cardsAtrasados;
        const scoreCards = cardsComSLA.length === 0
          ? 100
          : Math.max(0, Math.round((cardsEmDia / cardsComSLA.length) * 100));

        // Sub-score 3: Próximas Atividades (kanban_cards.prazo_atividade)
        // Score B: concluidos / (concluidos + atrasados). Vence hoje = contexto, não penaliza.
        type ProximaRow = { id: string; prazo_atividade: string | null };
        const proximasAbertosArr  = (proximasAbertosRes.data  ?? []) as ProximaRow[];
        const proximasConcluidosArr = (proximasConcluidosRes.data ?? []) as ProximaRow[];
        const proxVenceHoje  = proximasAbertosArr.filter(c => c.prazo_atividade === hojeStr).length;
        const proxAtrasadas  = proximasAbertosArr.filter(c => c.prazo_atividade && c.prazo_atividade < hojeStr).length;
        const proxConcluidos = proximasConcluidosArr.length;
        // Cards sem próxima atividade mapeada = penaliza (todo card ativo deveria ter uma)
        const cardsSemProxima = kanbanArr.length - proximasAbertosArr.length;
        // Denominador: concluídos + atrasadas + vence hoje + sem próxima mapeada.
        // Cards com prazo futuro não entram na conta de hoje.
        const proxDenominador = proxConcluidos + proxAtrasadas + proxVenceHoje + cardsSemProxima;
        const scoreProximas = proxDenominador === 0
          ? 100  // sem cards ou todos com próximas futuras = 100%
          : Math.max(0, Math.round((proxConcluidos / proxDenominador) * 100));

        // Score combinado = média dos sub-scores não-null
        const subScores = [scoreAtividades, scoreCards, scoreProximas].filter((s): s is number => s !== null);
        const engScore  = subScores.length === 0
          ? null
          : Math.round(subScores.reduce((s, v) => s + v, 0) / subScores.length);

        engajamentoRuntime = {
          atividades: { agendadas: atividadesAgendadas, realizadas: atividadesRealizadas, atrasadas: atividadesAtrasadas, score: scoreAtividades },
          cards:      { comSLA: cardsComSLA.length, emDia: cardsEmDia, atrasados: cardsAtrasados, score: scoreCards },
          proximas:   { concluidos: proxConcluidos, venceHoje: proxVenceHoje, atrasadas: proxAtrasadas, relevantes: proxConcluidos + proxVenceHoje + proxAtrasadas, score: scoreProximas },
          score:      engScore,
        };
      }

      // ── Indicadores ─────────────────────────────────────────────────────────────
      // Lógica diferenciada por tipo:
      //   Atingível/Projeto (is_projeto_relativo=true):
      //     - esp=0% (nada esperado nesta semana) → SKIP
      //     - esp>0% sem lançamento               → 0%
      //     - esp>0% com lançamento               → ratio=actual/esp; ≥75%→100, ≥60%→75, ≥30%→50, <30%→0
      //   Recorrente (is_projeto_relativo=false/null):
      //     - sem lançamento                      → 0% (penalidade: usuário não reportou)
      //     - com lançamento                      → score via semáforo existente
      let indicadoresRuntime: IndicadoresSnapshot = { porIndicador: [], media: null };

      if (areaId) {
        const { data: indsData } = await supabase
          .from('indicadores')
          .select('id, nome, semaforo_faixas')
          .eq('area_id', areaId)
          .eq('ativo', true);

        type IndRow = { id: string; nome: string; semaforo_faixas: unknown };
        const indsTyped = ((indsData ?? []) as IndRow[]);
        const indIds = indsTyped.map(i => i.id);

        if (indIds.length > 0) {
          // Lançamentos da semana atual (sem fallback S-1 — ausência = 0% é intencional)
          const { data: lancamentosData } = await supabase
            .from('indicador_lancamentos')
            .select('indicador_id, valor')
            .in('indicador_id', indIds)
            .eq('semana', semana);

          const lancMap = new Map<string, unknown>(
            ((lancamentosData ?? []) as { indicador_id: string; valor: unknown }[]).map(l => [
              l.indicador_id,
              l.valor,
            ])
          );

          type SfRaw = { is_projeto_relativo?: boolean; data_inicio?: string; data_fim?: string; dias_uteis?: number };
          const porIndicador: IndicadorItem[] = [];

          for (const ind of indsTyped) {
            const rawSf = ind.semaforo_faixas as SfRaw | null;
            const isProjeto = rawSf != null && typeof rawSf === 'object' && !Array.isArray(rawSf) && rawSf.is_projeto_relativo;

            if (isProjeto) {
              // Atingível/Projeto: score relativo ao % esperado da semana
              const esp = calcularEsperadoPct(
                rawSf!.data_inicio ?? '',
                rawSf!.data_fim    ?? '',
                rawSf!.dias_uteis  ?? 0,
              );
              if (esp <= 0) continue; // Nada esperado nesta semana → SKIP

              const valor   = lancMap.get(ind.id);
              const valStr  = valor != null ? String(valor).trim() : '';

              if (valStr === '' || valStr === '-') {
                // esp > 0, sem lançamento = não entregou o esperado
                porIndicador.push({ nome: ind.nome || ind.id, valor: 0, meta: esp, percentual: 0 });
              } else {
                const n = Number(valStr.replace(',', '.'));
                if (!Number.isFinite(n)) continue;
                const ratio = Math.min(100, (n / esp) * 100);
                let score = 0;
                if (ratio >= 75) score = 100;
                else if (ratio >= 60) score = 75;
                else if (ratio >= 30) score = 50;
                porIndicador.push({ nome: ind.nome || ind.id, valor: n, meta: esp, percentual: score });
              }
            } else {
              // Recorrente: ausência de lançamento = 0% (penalidade)
              const valor  = lancMap.get(ind.id);
              const valStr = valor != null ? String(valor).trim() : '';

              if (valStr === '' || valStr === '-') {
                porIndicador.push({ nome: ind.nome || ind.id, valor: 0, meta: 0, percentual: 0 });
              } else {
                const score = scoreDeValorESemaforo(valor, ind.semaforo_faixas);
                const n     = Number(valStr.replace(',', '.'));
                porIndicador.push({ nome: ind.nome || ind.id, valor: Number.isFinite(n) ? n : 0, meta: 0, percentual: score });
              }
            }
          }

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
        runtimeDetalhe?: Record<string, number | string | null>,
      ): DiaStatus[] =>
        diasSemana.map(data => {
          const snap = snapshotMap.get(data);
          if (snap?.[snapKey]) {
            const s = snap[snapKey] as Record<string, unknown>;
            const score = typeof s[scoreField] === 'number' ? (s[scoreField] as number) : null;
            // flatten detalhe from nested snapshot structure
            const detalhe: Record<string, number | string | null> = {};
            for (const [k, v] of Object.entries(s)) {
              if (k === scoreField) continue;
              if (typeof v === 'number' || typeof v === 'string' || v === null) detalhe[k] = v;
              else if (typeof v === 'object' && v !== null) {
                for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
                  if (typeof v2 === 'number' || typeof v2 === 'string' || v2 === null) {
                    detalhe[`${k}_${k2}`] = v2;
                  }
                }
              }
            }
            return { data, score, detalhe };
          }
          if (data === hojeStr) return { data, score: runtimeScore, detalhe: runtimeDetalhe };
          return { data, score: null };
        });

      // Weekly indicadores: S-1 and S-atual
      const semAnteriorInd = semana > 1 ? semana - 1 : 52;
      const snapPrevWeek = [...snapshotMap.values()].find(s => isoWeek(new Date(s.data + 'T12:00:00')) === semAnteriorInd);
      type IndSnapData = { porMeta?: Array<{ descricao: string; score: number }>; media?: number | null };
      const indSnapPrev = snapPrevWeek?.indicadores as IndSnapData | null;

      if (callId !== callIdRef.current) return;
      setSirene(sireneRuntime);
      setEngajamento(engajamentoRuntime);
      setIndicadores(indicadoresRuntime);
      setDiasSirene(buildDias('sirene', 'score', sireneScore, {
        concluidos: topicosConcluidos.length,
        atrasados:  topicosAtrasados,
        venceHoje:  topicosVenceHoje,
        futuras:    topicosFuturas,
        abertos:    topicosAbertos.length,
        semPrazo:   topicosSemPrazo,
      }));
      setDiasEngajamento(buildDias('engajamento', 'score', engajamentoRuntime.score, {
        atividades_agendadas:  engajamentoRuntime.atividades.agendadas,
        atividades_realizadas: engajamentoRuntime.atividades.realizadas,
        atividades_atrasadas:  engajamentoRuntime.atividades.atrasadas,
        cards_emDia:           engajamentoRuntime.cards.emDia,
        cards_atrasados:       engajamentoRuntime.cards.atrasados,
        proximas_concluidos:   engajamentoRuntime.proximas.concluidos,
        proximas_venceHoje:    engajamentoRuntime.proximas.venceHoje,
        proximas_atrasadas:    engajamentoRuntime.proximas.atrasadas,
      }));
      setSemanasIndicadores([
        {
          label:       `S${String(semAnteriorInd).padStart(2, '0')}`,
          semana:      semAnteriorInd,
          score:       indSnapPrev?.media ?? null,
          indicadores: (indSnapPrev?.porMeta ?? []).map(m => ({
            nome:       m.descricao,
            valor:      null,
            percentual: m.score,
          })),
        },
        {
          label:       `S${String(semana).padStart(2, '0')}`,
          semana:      semana,
          score:       indicadoresRuntime.media,
          indicadores: indicadoresRuntime.porIndicador.map(i => ({
            nome:       i.nome,
            valor:      String(i.valor),
            percentual: i.percentual,
          })),
        },
      ]);
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
    semanasIndicadores,
    semanaAtual,
    isLoading,
    error,
  };
}
