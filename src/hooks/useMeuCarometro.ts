'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isoWeek, isoWeekYear } from '@/utils/periodos';
import { useSimulacaoUsuario } from '@/components/carometro/todo/SeletorUsuarioAdmin';
import { ultimaSextaUtilDoMes, tierPorAtraso, tierFilha } from '@/lib/carometro/scoring-utils';

// ── Tipos de evidência ────────────────────────────────────────────────────────

export type SireneTopicoDetalhe = {
  id: number;
  chamado_id: number | null;
  nome: string | null;
  prazo: string | null;
  status: string;
  tipo: 'concluido' | 'em_aberto';
  dias_atraso: number | null;
  tier: string;
  credito: number;
  updated_at?: string | null;
};

export type FilhaDetalhe = {
  id: string;
  descricao: string;
  data_fim: string | null;
  status: string;
  atualizado_em: string | null;
  dias_atraso: number | null;
  tier: string;
  credito: number;
};

export type IndicadorDetalhe = {
  id: string;
  nome: string;
  tipo: string;
  deadline_calculada: string | null;
  status: string;
  isConcluido: boolean;
  concluido_em: string | null;
  dias_atraso: number | null;
  tier: string;
  percentual: number;
};

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
  score:           number | null;
  cap_ativo?:      boolean;
  relevantes:      number;
  concluidos:      number;
  atrasados:       number;
  venceHoje:       number;
  futuras:         number;
  semPrazo:        number;
  super_atrasados?: number;
  topicos?:        SireneTopicoDetalhe[];
};

export type EngajamentoSnapshot = {
  score: number | null;
  filhas: {
    total: number;
    concluidas: number;
    vencidas_abertas: number;
    no_prazo: number;
    detalhes?: FilhaDetalhe[];
  };
};

export type IndicadorItem = {
  nome: string;
  valor: number;
  meta: number;
  percentual: number | null;
};

export type IndicadoresSnapshot = {
  porIndicador: IndicadorItem[];
  media: number | null;
};

/** Score acumulado do ciclo (mês corrente) para cada dimensão, calculado a partir de carometro_status_diario */
export type CicloScores = {
  sirene: number | null;
  engajamento: number | null;
  indicadores: number | null;
};

export type UseMeuCarometroResult = {
  sirene: SireneSnapshot | null;
  engajamento: EngajamentoSnapshot | null;
  indicadores: IndicadoresSnapshot | null;
  /** Prévia de Indicadores: Atingível=100% no prazo/0% vencida, Recorrente=score semanal */
  indicadoresPrevia: IndicadoresSnapshot | null;
  diasSirene: DiaStatus[];
  diasEngajamento: DiaStatus[];
  semanasIndicadores: SemanaStatusInd[];
  semanaAtual: number;
  ciclo: CicloScores;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};


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
  const [indicadoresPrevia, setIndicadoresPrevia] = useState<IndicadoresSnapshot | null>(null);
  const [diasSirene, setDiasSirene] = useState<DiaStatus[]>([]);
  const [diasEngajamento, setDiasEngajamento] = useState<DiaStatus[]>([]);
  const [semanasIndicadores, setSemanasIndicadores] = useState<SemanaStatusInd[]>([]);
  const [semanaAtual, setSemanaAtual] = useState<number>(() => isoWeek(new Date()));
  const [ciclo, setCiclo] = useState<CicloScores>({ sirene: null, engajamento: null, indicadores: null });
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
          .select('id, nome, status, data_fim, prazo_proposto, chamado_id, interacao_id, sirene_chamados!chamado_id(arquivado)')
          .or(`responsavel_id.eq.${effectiveProfileId},responsaveis_ids.cs.{${effectiveProfileId}}`)
          .in('status', ['nao_iniciado', 'em_andamento'])
          .eq('arquivado', false),
        supabase
          .from('sirene_topicos')
          .select('id, nome, status, data_fim, prazo_proposto, updated_at')
          .or(`responsavel_id.eq.${effectiveProfileId},responsaveis_ids.cs.{${effectiveProfileId}}`)
          .in('status', ['concluido', 'aprovado'])
          .eq('arquivado', false)
          .gte('updated_at', semanaInicioStr),
      ]);

      type TopicosRow = {
        id: unknown;
        nome?: string | null;
        status?: string;
        data_fim: string | null;
        prazo_proposto: string | null;
        updated_at?: string | null;
        chamado_id?: string | null;
        interacao_id?: string | null;
        sirene_chamados?: { arquivado: boolean | null } | { arquivado: boolean | null }[] | null;
      };
      // Exclui tópicos cujo chamado-pai já foi arquivado (mesmo que o tópico ainda esteja aberto),
      // igualando o comportamento ao useBacklog. Evita que chamados concluídos/arquivados
      // penalizem o score do Carômetro.
      const topicosAbertosRaw = ((topicosAbertosRes.data ?? []) as TopicosRow[]).filter(t => {
        if (t.chamado_id) {
          const ch = Array.isArray(t.sirene_chamados) ? t.sirene_chamados[0] : t.sirene_chamados;
          if (ch?.arquivado === true) return false;
        }
        return true;
      });

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
      // Ultra-atrasado = aberto com prazo vencido há MAIS de 15 dias (além do tier T3)
      // Ativa cap de 50% no score enquanto qualquer um desses estiver em aberto
      const topicosUltraAtrasados = topicosAbertos.filter(t => {
        const prazo = t.data_fim || t.prazo_proposto;
        if (!prazo) return false;
        const prazoDate = new Date(prazo + 'T00:00:00');
        const diasAtraso = Math.floor((hoje.getTime() - prazoDate.getTime()) / (1000 * 60 * 60 * 24));
        return diasAtraso > 15;
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

      // ── Score v2: Tier parcial (T1=75%, T2=50%, T3=20%) ─────────────────
      // Crédito por chamado concluído baseado em dias de atraso após o prazo.
      // Chamados concluídos no prazo ou antes = 100%. Em aberto = 0%.
      function calcTierCredit(prazo: string | null, updatedAt: string | null): number {
        if (!prazo || !updatedAt) return 100; // sem prazo ou sem data = crédito cheio
        const prazoDate    = new Date(prazo    + 'T00:00:00');
        const conclusaoDate = new Date(updatedAt.slice(0, 10) + 'T00:00:00');
        const diasAtraso = Math.floor((conclusaoDate.getTime() - prazoDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diasAtraso <= 0)  return 100; // no prazo
        if (diasAtraso <= 6)  return 75;  // T1
        if (diasAtraso <= 14) return 50;  // T2
        return 20;                        // T3 (15+ dias)
      }

      // Contagem por tier para exibição no accordion
      let sireneNp = 0, sireneT1 = 0, sireneT2 = 0, sireneT3 = 0;
      const creditosConcluidos = topicosConcluidos.reduce((sum, t) => {
        const prazo = t.data_fim || t.prazo_proposto;
        const c = calcTierCredit(prazo, t.updated_at ?? null);
        if (c === 100) sireneNp++; else if (c === 75) sireneT1++; else if (c === 50) sireneT2++; else sireneT3++;
        return sum + c;
      }, 0);

      // Chamados em aberto atrasados ou que vencem hoje = 0% de crédito
      const sireneTotal = topicosConcluidos.length + topicosAtrasados + topicosVenceHoje;
      const creditoTotal = creditosConcluidos; // abertos/atrasados contribuem 0
      const sireneScoreRaw = sireneTotal === 0
        ? 100
        : Math.max(0, Math.round((creditoTotal / (sireneTotal * 100)) * 100));
      // Cap: enquanto houver chamados abertos com 15+ dias de atraso (além do T3),
      // o score máximo é 50% — independente de quantos chamados novos sejam fechados.
      const sireneScore = topicosUltraAtrasados > 0
        ? Math.min(sireneScoreRaw, 50)
        : sireneScoreRaw;

      // Montar evidências por tópico (topicos[])
      const topicosDetalhe: SireneTopicoDetalhe[] = [
        ...topicosConcluidos.map(t => {
          const prazo = t.data_fim || t.prazo_proposto;
          const credito = calcTierCredit(prazo, t.updated_at ?? null);
          const tier = credito === 100 ? 'no_prazo' : credito === 75 ? 'T1' : credito === 50 ? 'T2' : 'T3';
          let da: number | null = null;
          if (prazo && t.updated_at) {
            da = Math.floor(
              (new Date(t.updated_at.slice(0, 10) + 'T00:00:00').getTime() -
               new Date(prazo + 'T00:00:00').getTime()) / 86_400_000
            );
          }
          return {
            id: t.id as number, chamado_id: t.chamado_id as number | null,
            nome: t.nome as string | null, prazo, status: t.status ?? 'concluido',
            tipo: 'concluido' as const, dias_atraso: da !== null ? Math.max(0, da) : null,
            tier, credito, updated_at: t.updated_at ?? null,
          };
        }),
        ...topicosAbertos.map(t => {
          const prazo = t.data_fim || t.prazo_proposto;
          const prazoDate = prazo ? new Date(prazo + 'T00:00:00') : null;
          const da = prazoDate ? Math.floor((hoje.getTime() - prazoDate.getTime()) / 86_400_000) : null;
          const tier = da === null ? 'sem_prazo' : da <= 0 ? 'no_prazo' : da <= 6 ? 'T1' : da <= 14 ? 'T2' : da <= 15 ? 'T3' : 'ultra_atrasado';
          return {
            id: t.id as number, chamado_id: t.chamado_id as number | null,
            nome: t.nome as string | null, prazo: prazo ?? null, status: t.status ?? 'em_andamento',
            tipo: 'em_aberto' as const, dias_atraso: da !== null ? Math.max(0, da) : null,
            tier, credito: 0, updated_at: t.updated_at ?? null,
          };
        }),
      ];

      const sireneRuntime: SireneSnapshot = {
        score:          sireneScore,
        cap_ativo:      topicosUltraAtrasados > 0,
        relevantes:     sireneTotal,
        concluidos:     topicosConcluidos.length,
        atrasados:      topicosAtrasados,
        venceHoje:      topicosVenceHoje,
        futuras:        topicosFuturas,
        semPrazo:       topicosSemPrazo,
        super_atrasados: topicosUltraAtrasados,
        topicos:        topicosDetalhe,
      };

      // ── Engajamento v2: Metas Filhas + Tier ─────────────────────────────────
      let engajamentoRuntime: EngajamentoSnapshot = {
        score: null,
        filhas: { total: 0, concluidas: 0, vencidas_abertas: 0, no_prazo: 0, detalhes: [] },
      };
      {
        const mesAtualEng = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        const { data: filhasData } = await supabase
          .from('objetivos')
          .select('id, descricao, status, data_fim, atualizado_em')
          .eq('profile_id', effectiveProfileId)
          .not('objetivo_pai_id', 'is', null)
          .eq('mes', mesAtualEng);

        type FilhaRow = { id: string; descricao: string; status: string; data_fim: string | null; atualizado_em: string | null };
        const filhasArr = (filhasData ?? []) as FilhaRow[];

        const filhasConcluidas      = filhasArr.filter(f => f.status === 'concluido');
        const filhasVencidasAbertas = filhasArr.filter(f =>
          f.status !== 'concluido' && f.status !== 'arquivado' && f.status !== 'relancada' &&
          !!f.data_fim && f.data_fim < hojeStr
        );
        const filhasNoPrazo = filhasArr.filter(f =>
          f.status !== 'concluido' && f.status !== 'arquivado' && f.status !== 'relancada' &&
          (!f.data_fim || f.data_fim >= hojeStr)
        );
        const engRelevantes = filhasConcluidas.length + filhasVencidasAbertas.length;

        let novoScoreEng: number;
        if (filhasArr.length === 0) {
          novoScoreEng = 0;
        } else if (engRelevantes === 0) {
          novoScoreEng = 100;
        } else {
          const totalCreditos = filhasConcluidas.reduce(
            (sum, f) => sum + tierFilha(f.data_fim, f.atualizado_em), 0
          );
          novoScoreEng = Math.max(0, Math.round((totalCreditos / (engRelevantes * 100)) * 100));
        }

        // Evidências por filha (para auditoria no banco)
        const filhasDetalhes: FilhaDetalhe[] = filhasArr
          .filter(f => f.status !== 'arquivado')
          .map(f => {
            let tier: string;
            let credito: number;
            let da: number | null = null;
            if (f.status === 'concluido') {
              credito = tierFilha(f.data_fim, f.atualizado_em);
              if (f.data_fim && f.atualizado_em) {
                da = Math.floor(
                  (new Date(f.atualizado_em.slice(0, 10) + 'T00:00:00').getTime() -
                   new Date(f.data_fim + 'T00:00:00').getTime()) / 86_400_000
                );
              }
              tier = da === null ? 'no_prazo' : da <= 0 ? 'no_prazo' : da <= 6 ? 'T1' : da <= 14 ? 'T2' : 'T3';
            } else if (f.data_fim && f.data_fim < hojeStr) {
              da = Math.floor((hoje.getTime() - new Date(f.data_fim + 'T00:00:00').getTime()) / 86_400_000);
              tier = 'vencida_aberta'; credito = 0;
            } else {
              tier = 'no_prazo_aberta'; credito = 0;
            }
            return {
              id: f.id, descricao: f.descricao, data_fim: f.data_fim,
              status: f.status, atualizado_em: f.atualizado_em,
              dias_atraso: da, tier, credito,
            };
          });

        engajamentoRuntime = {
          score: novoScoreEng,
          filhas: {
            total:            filhasArr.length,
            concluidas:       filhasConcluidas.length,
            vencidas_abertas: filhasVencidasAbertas.length,
            no_prazo:         filhasNoPrazo.length,
            detalhes:         filhasDetalhes,
          },
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

      // Regra da quinta-feira (igual ao calendário do Carômetro): a semana pertence ao mês
      // que contém sua quinta-feira. Quinta de S-1 = sexta de S-1 − 1 dia.
      const thursdayAnterior = new Date(sextaAnterior);
      thursdayAnterior.setDate(sextaAnterior.getDate() - 1);
      const semAnteriorNaMes = thursdayAnterior.getMonth() === hoje.getMonth()
        && thursdayAnterior.getFullYear() === hoje.getFullYear();

      const semAnteriorInd = semana > 1 ? semana - 1 : 52;
      let indicadoresAnterior: IndicadoresSnapshot = { porIndicador: [], media: null };
      let indicadoresAtual: IndicadoresSnapshot    = { porIndicador: [], media: null };
      let indicadoresPreviaLocal: IndicadoresSnapshot | null = null;

      // ── Indicadores v3: scoring baseado na conclusão da Meta Mãe ────────────
      // Tier por atraso na entrega da Meta Mãe (100/75/50/20/0).
      // Recorrente: prazo = última sexta útil do mês (ciclo Boné Day).
      // Projeto: prazo = data_fim da meta.
      // Sem Meta Mãe assumida → 0%.
      {
        const mesAtualInd = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

        // 1. Metas Mãe que o usuário assumiu
        const { data: objRespData } = await supabase
          .from('objetivo_responsaveis')
          .select('objetivo_id, concluido, concluido_em')
          .eq('profile_id', effectiveProfileId);

        type ObjRespIndRow = { objetivo_id: string; concluido: boolean | null; concluido_em: string | null };
        const objRespRows = (objRespData ?? []) as ObjRespIndRow[];
        const objIds = objRespRows.map(r => r.objetivo_id).filter(Boolean);

        if (objIds.length === 0) {
          // Nenhuma Meta Mãe assumida → 0%
          indicadoresAtual    = { porIndicador: [], media: 0 };
          indicadoresAnterior = { porIndicador: [], media: 0 };
          setIndicadoresPrevia({ porIndicador: [], media: 0 });
        } else {
          // 2. Detalhes das Metas Mãe do mês vigente (ativo, relancada, concluido)
          const { data: metasData } = await supabase
            .from('objetivos')
            .select('id, descricao, tipo, data_fim, status, concluido_em')
            .in('id', objIds)
            .eq('mes', mesAtualInd)
            .in('status', ['ativo', 'relancada', 'concluido']);

          type MetaMaeRow = {
            id: string; descricao: string; tipo: string;
            data_fim: string | null; status: string; concluido_em: string | null;
          };
          const metas = (metasData ?? []) as MetaMaeRow[];

          if (metas.length === 0) {
            // Assumiu metas em outros meses mas não neste → 0%
            indicadoresAtual    = { porIndicador: [], media: 0 };
            indicadoresAnterior = { porIndicador: [], media: 0 };
            setIndicadoresPrevia({ porIndicador: [], media: 0 });
          } else {
            const objRespMap = new Map(objRespRows.map(r => [r.objetivo_id, r]));
            const anoAtualInd  = hoje.getFullYear();
            const mesNumInd    = hoje.getMonth() + 1; // 1-indexed

            // Deadline máximo do ciclo — nenhuma meta pode ultrapassar a última sexta útil
            const deadlineMaxCiclo = ultimaSextaUtilDoMes(anoAtualInd, mesNumInd);

            const scoresTracking: number[] = []; // bolinha esquerda: 100% enquanto no prazo
            const scoresPrevia:   number[] = []; // bolinha direita:  0% para toda aberta
            const porIndicadorTracking: IndicadorItem[] = [];
            const porIndicadorPrevia:   IndicadorItem[] = [];

            for (const meta of metas) {
              const resp = objRespMap.get(meta.id);
              const tipo = (meta.tipo ?? '').toLowerCase();

              // Calcular deadline conforme tipo, sempre capado na última sexta útil do ciclo
              let deadline: Date;
              if (tipo === 'recorrente') {
                deadline = deadlineMaxCiclo;
              } else {
                // Atingível-Projeto: usa data_fim da meta, mas nunca além do Boné Day
                if (!meta.data_fim) {
                  // Sem prazo definido → 100% tracking / 0% prévia (aberta)
                  scoresTracking.push(100);
                  scoresPrevia.push(0);
                  const item = { nome: meta.descricao, valor: 0, meta: 0, percentual: 100 };
                  porIndicadorTracking.push(item);
                  porIndicadorPrevia.push({ ...item, percentual: 0 });
                  continue;
                }
                const dataFimDate = new Date(meta.data_fim + 'T23:59:59');
                // Trava: deadline não pode ultrapassar o último dia útil do ciclo
                deadline = dataFimDate > deadlineMaxCiclo ? deadlineMaxCiclo : dataFimDate;
              }

              // Fallback: cobre dados históricos onde apenas objetivos.status foi atualizado
              const isConcluido = resp?.concluido === true || meta.status === 'concluido';
              const concluidoEm = resp?.concluido_em ?? null;

              let scoreTracking: number;
              let scorePrevia: number;

              if (isConcluido && concluidoEm) {
                // Meta concluída: mesmo tier para ambos (entrega real avaliada)
                scoreTracking = tierPorAtraso(concluidoEm, deadline);
                scorePrevia   = scoreTracking;
              } else {
                // Meta aberta:
                // tracking = 100% se ainda no prazo, 0% se vencida
                scoreTracking = hoje <= deadline ? 100 : 0;
                // prévia = sempre 0% (não entregou = não pontua no Boné Day)
                scorePrevia = 0;
              }

              scoresTracking.push(scoreTracking);
              scoresPrevia.push(scorePrevia);
              porIndicadorTracking.push({ nome: meta.descricao, valor: 0, meta: 0, percentual: scoreTracking });
              porIndicadorPrevia.push({ nome: meta.descricao, valor: 0, meta: 0, percentual: scorePrevia });
            }

            const avg = (arr: number[]) => arr.length > 0
              ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

            const mediaTracking = avg(scoresTracking);
            const mediaPrevia   = avg(scoresPrevia);

            // Sem distinção semanal neste modelo — anterior = atual
            indicadoresAtual    = { porIndicador: porIndicadorTracking, media: mediaTracking };
            indicadoresAnterior = { porIndicador: porIndicadorTracking, media: mediaTracking };
            // Prévia (bolinha direita): open metas = 0%
            indicadoresPreviaLocal = { porIndicador: porIndicadorPrevia, media: mediaPrevia };
            setIndicadoresPrevia({ porIndicador: porIndicadorPrevia, media: mediaPrevia });
          }
        }
      }

      // ── Score semanal (Sirene + Engajamento): média dos dias Mon–hoje ────────
      // A bolinha esquerda mostra a média da semana, não só o valor de hoje.
      // Os pontos diários (dots Seg/Ter/…) continuam mostrando o valor do dia.
      function buildSemanaScore(
        snapKey: 'sirene' | 'engajamento',
        todayLive: number | null,
      ): number | null {
        const semScores = diasSemana
          .filter(d => d !== hojeStr)
          .map(d => {
            const snap = snapshotMap.get(d);
            if (!snap) return null;
            const blob = snap[snapKey] as Record<string, unknown> | null;
            const v = blob?.score;
            return typeof v === 'number' ? v : null;
          })
          .filter((v): v is number => v !== null);
        if (todayLive !== null) semScores.push(todayLive);
        if (semScores.length === 0) return null;
        return Math.round(semScores.reduce((a, b) => a + b, 0) / semScores.length);
      }

      const sireneWeeklyScore  = buildSemanaScore('sirene',      sireneScore);
      const engWeeklyScore     = buildSemanaScore('engajamento', engajamentoRuntime.score);

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
            // indicadores = resultado real (para ciclo histórico)
            indicadores: semAnteriorNaMes ? indicadoresAnterior : indicadoresAtual,
            // indicadores_previa = simulação "se fechasse hoje" (para dashboard gestão)
            indicadores_previa: indicadoresPreviaLocal ?? null,
          },
          { onConflict: 'area_id,profile_id,data' },
        ).then(({ error: snapErr }) => {
          if (snapErr) console.warn('[useMeuCarometro] snapshot save:', snapErr.message);
        });
      }

      // ── Score do ciclo (mês corrente) — média dos snapshots do mês ──────────
      // Início do mês corrente para buscar todos os snapshots salvos
      const cicloInicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
      const { data: cicloSnaps } = await supabase
        .from('carometro_status_diario')
        .select('data, sirene, engajamento, indicadores, indicadores_previa')
        .eq('profile_id', effectiveProfileId)
        .gte('data', cicloInicio)
        .lte('data', hojeStr);

      type SnapCicloRow = {
        data: string;
        sirene: unknown;
        engajamento: unknown;
        indicadores: unknown;
        indicadores_previa: unknown;
      };
      const cicloRows = (cicloSnaps ?? []) as SnapCicloRow[];

      // hasTodaySnap mantido para compatibilidade (não mais usado no cálculo do ciclo)
      const hasTodaySnap = cicloRows.some(r => r.data === hojeStr);
      void hasTodaySnap; // evita warning de unused variable

      function mediaScoresCiclo(
        key: 'sirene' | 'engajamento' | 'indicadores',
        currentWeekScore: number | null,
        // Para indicadores: lê da coluna indicadores_previa (score real "se fechasse hoje")
        altKey?: 'indicadores_previa',
      ): number | null {
        // Agrupa dias históricos por semana ISO (exclui hoje — usa live currentWeekScore).
        // A bolinha direita = média das SEMANAS, não dos dias individuais.
        const semanaAtualISO = isoWeek(hoje);
        const weekMap = new Map<number, number[]>();
        for (const r of cicloRows) {
          if (r.data === hojeStr) continue;
          const weekNum = isoWeek(new Date(r.data + 'T12:00:00'));
          if (weekNum === semanaAtualISO) continue; // semana atual via currentWeekScore
          // Para indicadores: prefere indicadores_previa; fallback em indicadores (dados antigos)
          const blob = altKey
            ? ((r[altKey] as Record<string, unknown> | null) ?? (r[key] as Record<string, unknown> | null))
            : (r[key] as Record<string, unknown> | null);
          const v = typeof blob?.score === 'number'
            ? (blob.score as number)
            : (typeof blob?.media === 'number' ? (blob.media as number) : null);
          if (v !== null) {
            if (!weekMap.has(weekNum)) weekMap.set(weekNum, []);
            weekMap.get(weekNum)!.push(v);
          }
        }
        // Média de cada semana histórica
        const weeklyAvgs: number[] = [];
        for (const [, scores] of weekMap)
          weeklyAvgs.push(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
        // Adiciona semana atual (running average)
        if (currentWeekScore !== null) weeklyAvgs.push(currentWeekScore);
        if (weeklyAvgs.length === 0) return null;
        return Math.round(weeklyAvgs.reduce((a, b) => a + b, 0) / weeklyAvgs.length);
      }

      // indScore para bolinha direita (Boné Day) usa score PRÉVIA (open metas = 0%)
      const indPreviaScore = indicadoresPreviaLocal?.media ?? null;
      const cicloScores: CicloScores = {
        sirene:      mediaScoresCiclo('sirene',      sireneWeeklyScore),
        engajamento: mediaScoresCiclo('engajamento', engWeeklyScore),
        // Indicadores: lê histórico de indicadores_previa + contribuição da semana atual
        indicadores: mediaScoresCiclo('indicadores', indPreviaScore, 'indicadores_previa'),
      };

      // Bolinhas esquerdas: score SEMANAL (média Mon–hoje), não só o valor de hoje.
      // O banco continua recebendo sireneRuntime/engajamentoRuntime com score diário.
      setSirene({ ...sireneRuntime, score: sireneWeeklyScore });
      setEngajamento({ ...engajamentoRuntime, score: engWeeklyScore });
      // Score principal: S-1 se pertence ao mês vigente; caso contrário, semana atual (primeira do mês)
      setIndicadores(semAnteriorNaMes ? indicadoresAnterior : indicadoresAtual);
      setCiclo(cicloScores);
      setDiasSirene(buildDias('sirene', 'score', sireneScore, {
        concluidos: topicosConcluidos.length,
        atrasados:  topicosAtrasados,
        venceHoje:  topicosVenceHoje,
        futuras:    topicosFuturas,
        abertos:    topicosAbertos.length,
        semPrazo:   topicosSemPrazo,
      }));
      setDiasEngajamento(buildDias('engajamento', 'score', engajamentoRuntime.score));
      // Exibe apenas semanas que pertencem ao mês vigente (regra da quinta-feira)
      setSemanasIndicadores([
        ...(semAnteriorNaMes ? [{
          label:       `S${String(semAnteriorInd).padStart(2, '0')}`,
          semana:      semAnteriorInd,
          score:       indicadoresAnterior.media,
          indicadores: indicadoresAnterior.porIndicador.map(i => ({
            nome:       i.nome,
            valor:      String(i.valor),
            percentual: i.percentual,
          })),
        }] : []),
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

  // Subscription realtime: nome único por instância para evitar conflito de lock no StrictMode
  // (React StrictMode monta/desmonta efeitos 2x em dev, causando "Lock broken by another request")
  const channelSuffix = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    const channel = supabase
      .channel(`indicadores-realtime-${channelSuffix.current}`)
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
    indicadoresPrevia,
    diasSirene,
    diasEngajamento,
    semanasIndicadores,
    semanaAtual,
    ciclo,
    isLoading,
    error,
    refetch: carregar,
  };
}
