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
  indicadores: Array<{ nome: string; valor: string | null; percentual: number | null }>;
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
  cards:      { comSLA: number; emDia: number; atrasados: number; bloqueados: number; score: number | null };
  proximas:   { concluidos: number; venceHoje: number; atrasadas: number; semProxima: number; relevantes: number; score: number | null };
  score: number | null;
};

export type IndicadorItem = {
  nome: string;
  valor: number;
  meta: number;
  percentual: number | null; // null = "Nada esperado para essa semana" (Projeto com esp=0)
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
  refetch: () => void;
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
 * Exclui apenas fins de semana. Calcula o total de dias úteis dinamicamente (não depende
 * do campo dias_uteis salvo no banco, que pode estar vazio).
 * Retorna 0 se projeto não iniciado, 100 se já passou do prazo.
 */
function calcularEsperadoPct(dataInicio: string, dataFim: string, refDate?: Date): number {
  if (!dataInicio || !dataFim) return 0;
  const ref  = new Date(refDate ?? new Date()); ref.setHours(0, 0, 0, 0);
  const inicio = new Date(dataInicio + 'T00:00:00');
  const fim    = new Date(dataFim    + 'T00:00:00');
  if (ref < inicio) return 0;

  // Total dias úteis do projeto (data_inicio → data_fim)
  let total = 0;
  const dt = new Date(inicio);
  while (dt <= fim) {
    if (dt.getDay() !== 0 && dt.getDay() !== 6) total++;
    dt.setDate(dt.getDate() + 1);
  }
  if (total === 0) return 0;

  if (ref >= fim) return 100;

  // Dias úteis decorridos (data_inicio → ref)
  let count = 0;
  const d2 = new Date(inicio);
  while (d2 <= ref) {
    if (d2.getDay() !== 0 && d2.getDay() !== 6) count++;
    d2.setDate(d2.getDate() + 1);
  }
  return Math.min(100, Math.round((count / total) * 100));
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

  // Ref para evitar que o useEffect do Realtime recrie o canal a cada render
  const carregarRef = useRef<() => Promise<void>>(async () => {});

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
          .select('id, data_fim, prazo_proposto, chamado_id, interacao_id')
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

      type TopicosRow = { id: unknown; data_fim: string | null; prazo_proposto: string | null; chamado_id?: string | null; interacao_id?: string | null };
      const topicosAbertosRaw = (topicosAbertosRes.data ?? []) as TopicosRow[];

      // Round 2 + Round 3: filtrar tópicos fantasmas (card pai arquivado).
      // Mesma lógica do useBacklog: cards arquivados são escondidos pela RLS,
      // então buscamos apenas os ativos (arquivado=false) — ausência = arquivado.
      const interacaoIdsMetrica = topicosAbertosRaw
        .filter(t => !t.chamado_id && t.interacao_id)
        .map(t => t.interacao_id as string);

      let topicosAbertos: TopicosRow[] = topicosAbertosRaw;

      if (interacaoIdsMetrica.length > 0) {
        type KanbanAtivMinimal = { id: string; card_id: string | null; sirene_chamado_id: number | null };
        const { data: kanbanAtivs } = await supabase
          .from('kanban_atividades')
          .select('id, card_id, sirene_chamado_id')
          .in('id', interacaoIdsMetrica);

        const kanbanAtivMinMap = new Map<string, KanbanAtivMinimal>(
          ((kanbanAtivs ?? []) as KanbanAtivMinimal[]).map(r => [r.id, r]),
        );

        const cardIdsMetrica = [...kanbanAtivMinMap.values()]
          .filter(r => r.sirene_chamado_id == null && r.card_id != null)
          .map(r => r.card_id as string);

        const cardsAtivosSetMetrica = new Set<string>();
        if (cardIdsMetrica.length > 0) {
          const { data: cardsAtivos } = await supabase
            .from('kanban_cards')
            .select('id')
            .in('id', cardIdsMetrica)
            .eq('arquivado', false);
          for (const c of (cardsAtivos ?? []) as { id: string }[]) {
            cardsAtivosSetMetrica.add(c.id);
          }
        }

        topicosAbertos = topicosAbertosRaw.filter(t => {
          if (!t.chamado_id && t.interacao_id) {
            const kativ = kanbanAtivMinMap.get(t.interacao_id);
            if (kativ && kativ.sirene_chamado_id == null && kativ.card_id != null) {
              if (!cardsAtivosSetMetrica.has(kativ.card_id)) return false;
            }
          }
          return true;
        });
      }

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
        cards:      { comSLA: 0, emDia: 0, atrasados: 0, bloqueados: 0, score: null },
        proximas:   { concluidos: 0, venceHoje: 0, atrasadas: 0, semProxima: 0, relevantes: 0, score: null },
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
            .select('id, created_at, entered_fase_at, sla_iniciado_em, sla_pausado_em, fase:kanban_fases!fase_id(sla_dias, sla_tipo, slug)')
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
          ? 0
          : Math.max(0, Math.round((atividadesRealizadas / atividadesAgendadas) * 100));

        // Sub-score 2: Cards com SLA
        const kanbanArr = (kanbanRes.data ?? []) as Array<{
          id: string; created_at: string; entered_fase_at: string | null;
          sla_iniciado_em: string | null;
          sla_pausado_em: string | null;
          fase: { sla_dias: number | null; sla_tipo: string | null; slug: string | null } | Array<{ sla_dias: number | null; sla_tipo: string | null; slug: string | null }> | null;
        }>;
        const cardsComSLA = kanbanArr.filter(c => {
          const fase = Array.isArray(c.fase) ? c.fase[0] : c.fase;
          return (fase?.sla_dias ?? null) !== null;
        });
        // Cards com trava ativa → bloqueados: excluídos do score (nem bônus, nem penalidade)
        const cardsBloqueados = cardsComSLA.filter(c => Boolean(c.sla_pausado_em)).length;
        const cardsNaoBloqueados = cardsComSLA.filter(c => !c.sla_pausado_em);
        const cardsAtrasados = cardsNaoBloqueados.filter(c => {
          const fase = Array.isArray(c.fase) ? c.fase[0] : c.fase;
          return calcularSlaKanbanCard({
            created_at:      c.created_at,
            entered_fase_at: c.entered_fase_at,
            sla_iniciado_em: c.sla_iniciado_em,
            sla_pausado_em:  c.sla_pausado_em,
            sla_dias:        fase?.sla_dias ?? null,
            sla_tipo:        fase?.sla_tipo ?? null,
            faseSlug:        fase?.slug     ?? null,
          }).status === 'atrasado';
        }).length;
        const cardsEmDia = cardsNaoBloqueados.length - cardsAtrasados;
        // Score: apenas sobre os cards sem trava ativa. Nenhum card ativo (todos bloqueados) = 100%.
        const scoreCards = cardsComSLA.length === 0 || cardsNaoBloqueados.length === 0
          ? 100
          : Math.max(0, Math.round((cardsEmDia / cardsNaoBloqueados.length) * 100));

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
          cards:      { comSLA: cardsComSLA.length, emDia: cardsEmDia, atrasados: cardsAtrasados, bloqueados: cardsBloqueados, score: scoreCards },
          proximas:   { concluidos: proxConcluidos, venceHoje: proxVenceHoje, atrasadas: proxAtrasadas, semProxima: cardsSemProxima, relevantes: proxConcluidos + proxVenceHoje + proxAtrasadas + cardsSemProxima, score: scoreProximas },
          score:      engScore,
        };
      }

      // ── Indicadores (S-1 ao vivo + S-atual ao vivo) ─────────────────────────
      // Computa as duas semanas ao vivo a partir de indicador_lancamentos.
      // A semana anterior (S-1) é usada como score principal do card.
      //
      // Lógica diferenciada por tipo:
      //   Atingível/Projeto (is_projeto_relativo=true):
      //     - esp=0% → SKIP
      //     - esp>0% sem lançamento → 0%
      //     - esp>0% com lançamento → ratio=actual/esp; ≥75%→100, ≥60%→75, ≥30%→50, <30%→0
      //   Recorrente (is_projeto_relativo=false/null):
      //     - sem lançamento → 0% (penalidade)
      //     - com lançamento → score via semáforo existente
      // Sexta-feira da semana anterior (referência correta para calcular esp de S-1)
      const hojeRef = new Date(); hojeRef.setHours(0, 0, 0, 0);
      const dowRef  = hojeRef.getDay() || 7; // 1=Seg ... 7=Dom
      const segundaEstaSeamna = new Date(hojeRef);
      segundaEstaSeamna.setDate(hojeRef.getDate() - (dowRef - 1));
      const sextaAnterior = new Date(segundaEstaSeamna);
      sextaAnterior.setDate(segundaEstaSeamna.getDate() - 3); // Seg - 3 = Sex da semana anterior

      const semAnteriorInd = semana > 1 ? semana - 1 : 52;
      let indicadoresAnterior: IndicadoresSnapshot = { porIndicador: [], media: null };
      let indicadoresAtual: IndicadoresSnapshot    = { porIndicador: [], media: null };

      {
        const { data: objRespData } = await supabase
          .from('objetivo_responsaveis')
          .select('objetivo_id')
          .eq('profile_id', effectiveProfileId);

        const objIds = ((objRespData ?? []) as { objetivo_id: string }[])
          .map(o => o.objetivo_id)
          .filter(Boolean);

        if (objIds.length > 0) {
          // Filtra apenas metas do mês vigente com status ativo ou relançado.
          // Metas concluídas e arquivadas não entram no cálculo — não penalizam o score.
          const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
          // Busca nomes dos objetivos para distinguir indicadores homônimos
          const { data: objetivosData } = await supabase
            .from('objetivos')
            .select('id, descricao')
            .in('id', objIds)
            .eq('mes', mesAtual)
            .in('status', ['ativo', 'relancada']);
          const objNomeMap = new Map<string, string>(
            ((objetivosData ?? []) as { id: string; descricao: string }[]).map(o => [o.id, o.descricao])
          );

          const { data: indsData } = await supabase
            .from('indicadores')
            .select('id, nome, semaforo_faixas, objetivo_id')
            .in('objetivo_id', objIds)
            .eq('ativo', true);

          type IndRow = { id: string; nome: string; semaforo_faixas: unknown; objetivo_id: string | null };
          const indsTyped = ((indsData ?? []) as IndRow[]);
          const indIds = indsTyped.map(i => i.id);

          if (indIds.length > 0) {
            // Busca lançamentos das duas semanas em uma única query
            const { data: lancamentosData } = await supabase
              .from('indicador_lancamentos')
              .select('indicador_id, valor, semana')
              .in('indicador_id', indIds)
              .in('semana', [semAnteriorInd, semana]);

            type LancRow = { indicador_id: string; valor: unknown; semana: number };
            const lancRows = (lancamentosData ?? []) as LancRow[];

            const lancMapAnterior = new Map<string, unknown>(
              lancRows.filter(l => l.semana === semAnteriorInd).map(l => [l.indicador_id, l.valor])
            );
            const lancMapAtual = new Map<string, unknown>(
              lancRows.filter(l => l.semana === semana).map(l => [l.indicador_id, l.valor])
            );

            type SfRaw = { is_projeto_relativo?: boolean; data_inicio?: string; data_fim?: string; dias_uteis?: number };

            function calcIndicadores(lancMap: Map<string, unknown>, refDate: Date): IndicadoresSnapshot {
              const porIndicador: IndicadorItem[] = [];
              const metaScoresMap = new Map<string, number[]>();
              for (const ind of indsTyped) {
                const objNome = ind.objetivo_id ? (objNomeMap.get(ind.objetivo_id) ?? '') : '';
                const nomeDisplay = objNome ? `${objNome} — ${ind.nome}` : (ind.nome || ind.id);
                const rawSf = ind.semaforo_faixas as SfRaw | null;
                const isProjeto = rawSf != null && typeof rawSf === 'object' && !Array.isArray(rawSf) && rawSf.is_projeto_relativo;
                const metaKey = ind.objetivo_id ?? ind.id;

                if (isProjeto) {
                  const esp = calcularEsperadoPct(rawSf!.data_inicio ?? '', rawSf!.data_fim ?? '', refDate);

                  if (esp <= 0) {
                    porIndicador.push({ nome: nomeDisplay, valor: 0, meta: 0, percentual: null });
                    continue;
                  }

                  // Cap de 70 pts se refDate ultrapassou a semana do data_fim
                  const dataFimDate = new Date((rawSf!.data_fim ?? '') + 'T00:00:00');
                  const dataFimDow = dataFimDate.getDay() || 7;
                  const endOfDeadlineWeek = new Date(dataFimDate);
                  endOfDeadlineWeek.setDate(dataFimDate.getDate() + (7 - dataFimDow));
                  const isPastDeadlineWeek = refDate > endOfDeadlineWeek;

                  const valor  = lancMap.get(ind.id);
                  const valStr = valor != null ? String(valor).trim() : '';

                  if (valStr === '' || valStr === '-') {
                    porIndicador.push({ nome: nomeDisplay, valor: 0, meta: esp, percentual: 0 });
                    metaScoresMap.set(metaKey, [...(metaScoresMap.get(metaKey) ?? []), 0]);
                  } else {
                    const n = Number(valStr.replace(',', '.'));
                    if (!Number.isFinite(n)) {
                      porIndicador.push({ nome: nomeDisplay, valor: 0, meta: esp, percentual: null });
                      continue;
                    }
                    const ratio = Math.min(100, (n / esp) * 100);
                    let score = 0;
                    if (ratio >= 75) score = 100;
                    else if (ratio >= 60) score = 75;
                    else if (ratio >= 30) score = 50;
                    if (isPastDeadlineWeek && score > 70) score = 70;
                    porIndicador.push({ nome: nomeDisplay, valor: n, meta: esp, percentual: score });
                    metaScoresMap.set(metaKey, [...(metaScoresMap.get(metaKey) ?? []), score]);
                  }
                } else {
                  const valor  = lancMap.get(ind.id);
                  const valStr = valor != null ? String(valor).trim() : '';

                  if (valStr === '' || valStr === '-') {
                    porIndicador.push({ nome: nomeDisplay, valor: 0, meta: 0, percentual: 0 });
                    metaScoresMap.set(metaKey, [...(metaScoresMap.get(metaKey) ?? []), 0]);
                  } else {
                    const score = scoreDeValorESemaforo(valor, ind.semaforo_faixas);
                    const n     = Number(valStr.replace(',', '.'));
                    porIndicador.push({ nome: nomeDisplay, valor: Number.isFinite(n) ? n : 0, meta: 0, percentual: score });
                    metaScoresMap.set(metaKey, [...(metaScoresMap.get(metaKey) ?? []), score]);
                  }
                }
              }
              // Score por meta (média dos seus indicadores), depois média das metas — peso igual por meta
              const metaMedias: number[] = [];
              for (const scores of metaScoresMap.values()) {
                metaMedias.push(Math.round(scores.reduce((s, v) => s + v, 0) / scores.length));
              }
              const media = metaMedias.length > 0
                ? Math.round(metaMedias.reduce((s, v) => s + v, 0) / metaMedias.length)
                : null;
              return { porIndicador, media };
            }

            indicadoresAnterior = calcIndicadores(lancMapAnterior, sextaAnterior);
            indicadoresAtual    = calcIndicadores(lancMapAtual, hojeRef);
          }
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

      if (callId !== callIdRef.current) return;

      // Salva snapshot no banco para que o Dashboard Geral sempre reflita o estado atual.
      // Só salva quando é o próprio usuário (não simulação admin — não teria permissão RLS).
      if (areaId && effectiveProfileId === user.id) {
        void supabase.from('carometro_status_diario').upsert(
          {
            area_id:     areaId,
            profile_id:  effectiveProfileId,
            data:        hojeStr,
            sirene:      sireneRuntime,
            engajamento: engajamentoRuntime,
            indicadores: indicadoresAnterior, // S-1: mesmo que o card Indicadores exibe
          },
          { onConflict: 'area_id,profile_id,data' },
        ).then(({ error: snapErr }) => {
          if (snapErr) console.warn('[useMeuCarometro] snapshot save:', snapErr.message);
        });
      }

      setSirene(sireneRuntime);
      setEngajamento(engajamentoRuntime);
      setIndicadores(indicadoresAnterior); // card principal exibe resultado da semana anterior
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
        cards_bloqueados:      engajamentoRuntime.cards.bloqueados,
        proximas_concluidos:   engajamentoRuntime.proximas.concluidos,
        proximas_venceHoje:    engajamentoRuntime.proximas.venceHoje,
        proximas_atrasadas:    engajamentoRuntime.proximas.atrasadas,
      }));
      setSemanasIndicadores([
        {
          label:       `S${String(semAnteriorInd).padStart(2, '0')}`,
          semana:      semAnteriorInd,
          score:       indicadoresAnterior.media,
          indicadores: indicadoresAnterior.porIndicador.map(i => ({
            nome:       i.nome,
            valor:      String(i.valor),
            percentual: i.percentual,
          })),
        },
        {
          label:       `S${String(semana).padStart(2, '0')}`,
          semana:      semana,
          score:       indicadoresAtual.media,
          indicadores: indicadoresAtual.porIndicador.map(i => ({
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

  // Mantém ref sempre atualizado — sem isso o Realtime useEffect ficaria com closure stale
  useEffect(() => { carregarRef.current = carregar; }, [carregar]);

  useEffect(() => { carregar(); }, [carregar]);

  // Subscription realtime: canal criado UMA vez; usa ref para não recriar o canal e evitar
  // "Lock broken by another request with the 'steal' option"
  useEffect(() => {
    const channel = supabase
      .channel('indicadores-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'indicador_lancamentos' },
        () => { carregarRef.current(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]); // intencionalmente sem `carregar` nas deps

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
    refetch: carregar,
  };
}
