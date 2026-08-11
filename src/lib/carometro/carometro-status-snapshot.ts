import type { SupabaseClient } from '@supabase/supabase-js';
import { isoWeek, isoWeekYear } from '@/utils/periodos';
import { calcularSlaKanbanCard } from '@/lib/kanban/kanban-card-sla';

// ── Semáforo (replicado de useMeuCarometro) ──────────────────────────────────
const NOME_SCORE: Record<string, number> = { ve: 100, vc: 75, am: 50, vm: 0 };

type SemaforoFaixa = { cor: string; limite: string | number; comparacao?: string };

/** Retorna 0–100. missing = 0 (rigoroso). Suporta faixas eq (texto) e numéricas. */
function scoreDeValorESemaforoNomeado(semaforo_faixas: unknown, valor: string): number {
  const faixas = (semaforo_faixas as { faixas?: SemaforoFaixa[] } | null)?.faixas;
  if (!faixas?.length) return 50;

  // Tenta eq textual primeiro
  const valorNorm = valor.toLowerCase().trim();
  for (const f of faixas) {
    if ((f.comparacao === 'eq' || !f.comparacao) &&
        String(f.limite ?? '').toLowerCase().trim() === valorNorm) {
      const cor = String(f.cor ?? '').toLowerCase();
      return NOME_SCORE[cor] ?? 50;
    }
  }

  // Tenta numérico
  const n = Number(valor.replace(',', '.'));
  if (Number.isFinite(n)) {
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
      if (match) {
        const cor = String(f.cor ?? '').toLowerCase();
        return NOME_SCORE[cor] ?? 50;
      }
    }
  }

  return 50;
}

// ── Snapshot principal ───────────────────────────────────────────────────────
export async function gerarSnapshotCarometro(
  db: SupabaseClient,
  profileId: string,
  areaId: string,
  nomeUsuario: string | null,
  data: Date,
) {
  const hoje    = data;
  const semana  = isoWeek(hoje);
  const anoISO  = isoWeekYear(hoje);
  const hojeStr = hoje.toISOString().slice(0, 10);

  // ── Sirene ─────────────────────────────────────────────────────────────────
  // Início da semana para filtro de concluídos
  const dowSnap = hoje.getDay() || 7;
  const semanaInicioSnap = new Date(hoje);
  semanaInicioSnap.setDate(hoje.getDate() - (dowSnap - 1));
  const semanaInicioSnapStr = semanaInicioSnap.toISOString().slice(0, 10);

  const [topicosAbertosSnap, topicosConcluidosSnap] = await Promise.all([
    db.from('sirene_topicos')
      .select('id, data_fim, prazo_proposto')
      .or(`responsavel_id.eq.${profileId},responsaveis_ids.cs.{${profileId}}`)
      .in('status', ['nao_iniciado', 'em_andamento'])
      .eq('arquivado', false),
    db.from('sirene_topicos')
      .select('id, data_fim, prazo_proposto')
      .or(`responsavel_id.eq.${profileId},responsaveis_ids.cs.{${profileId}}`)
      .in('status', ['concluido', 'aprovado'])
      .eq('arquivado', false)
      .gte('updated_at', semanaInicioSnapStr),
  ]);

  type TopicosSnapRow = { id: unknown; data_fim: string | null; prazo_proposto: string | null };
  const topicosAbertos = (topicosAbertosSnap.data ?? []) as TopicosSnapRow[];
  const topicosConcluidos = ((topicosConcluidosSnap.data ?? []) as TopicosSnapRow[]).filter(t => {
    const prazo = t.data_fim || t.prazo_proposto;
    return prazo && prazo <= hojeStr;
  });

  const semPrazo = topicosAbertos.filter(t => !t.data_fim && !t.prazo_proposto).length;
  // Atrasado = prazo < hoje (prazo = hoje ainda não é atrasado)
  const sireneAtrasados = topicosAbertos.filter(t => {
    const prazo = t.data_fim || t.prazo_proposto;
    if (!prazo) return false;
    return prazo < hojeStr;
  }).length;
  // Vence hoje = open com prazo = hoje
  const sireneVenceHoje = topicosAbertos.filter(t => {
    const prazo = t.data_fim || t.prazo_proposto;
    return prazo === hojeStr;
  }).length;
  // Futuras = open com prazo > hoje (não entram no score)
  const sireneFuturas = topicosAbertos.filter(t => {
    const prazo = t.data_fim || t.prazo_proposto;
    return prazo && prazo > hojeStr;
  }).length;

  // Score: concluidos / (concluidos + atrasados + venceHoje). Futuras nunca entram.
  // total = 0 → 100% (em dia, sem pendências)
  const sireneTotal = topicosConcluidos.length + sireneAtrasados + sireneVenceHoje;
  const sireneScore = sireneTotal === 0
    ? 100
    : Math.max(0, Math.round((topicosConcluidos.length / sireneTotal) * 100));

  const sireneData = {
    atrasados:  sireneAtrasados,
    abertos:    topicosAbertos.length,
    venceHoje:  sireneVenceHoje,
    futuras:    sireneFuturas,
    relevantes: sireneTotal,
    concluidos: topicosConcluidos.length,
    semPrazo,
    score:      sireneScore,
  };

  // ── Engajamento (3 sub-scores independentes) ─────────────────────────────────
  // franqueado_id incluído APENAS quando responsavel_id IS NULL:
  // - Helenna: franqueado_id=Helenna, responsavel_id=null → é a responsável operacional ✓
  // - Danilo:  franqueado_id=Danilo,  responsavel_id=Helenna → é o gestor, não conta ✓
  const orKanban = `responsavel_id.eq.${profileId},responsaveis_ids.cs.{${profileId}},and(franqueado_id.eq.${profileId},responsavel_id.is.null)`;

  const [ganttEngRes, kanbanAbertosRes, proximasEngRes, proximasConcluidosRes] = await Promise.all([
    db.from('gantt_planejamento')
      .select('id, data, data_conclusao_real')
      .eq('profile_id', profileId)
      .gte('data', semanaInicioSnapStr)
      .lte('data', hojeStr)
      .is('sirene_chamado_id', null)
      .is('card_id', null),
    db.from('kanban_cards')
      .select('id, created_at, entered_fase_at, sla_iniciado_em, fase:kanban_fases!fase_id(sla_dias, sla_tipo, slug)')
      .or(orKanban).eq('arquivado', false).eq('concluido', false),
    db.from('kanban_cards')
      .select('id, prazo_atividade')
      .or(orKanban).eq('arquivado', false).eq('concluido', false)
      .not('prazo_atividade', 'is', null),
    db.from('kanban_cards')
      .select('id, prazo_atividade')
      .or(orKanban).eq('arquivado', false).eq('concluido', true)
      .not('prazo_atividade', 'is', null)
      .lte('prazo_atividade', hojeStr)
      .gte('updated_at', semanaInicioSnapStr),
  ]);

  // Sub-score 1: Atividades da Agenda — esta semana (gantt_planejamento)
  type GanttEngRow = { id: string; data: string; data_conclusao_real: string | null };
  const ganttArr = (ganttEngRes.data ?? []) as GanttEngRow[];
  const atividadesAgendadas = ganttArr.length;
  const atividadesRealizadas = ganttArr.filter(g => !!g.data_conclusao_real).length;
  // Não concluída = agendada sem data_conclusao_real (inclui hoje — afeta score imediatamente)
  const atividadesAtrasadas  = ganttArr.filter(g => !g.data_conclusao_real).length;
  const scoreAtividades = atividadesAgendadas === 0
    ? null
    : Math.max(0, Math.round((atividadesRealizadas / atividadesAgendadas) * 100));

  // Sub-score 2: Cards com SLA
  type FaseKanban = { sla_dias: number | null; sla_tipo: string | null; slug: string | null };
  type KanbanCardSla = {
    id: string; created_at: string; entered_fase_at: string | null;
    sla_iniciado_em: string | null; fase: FaseKanban | FaseKanban[] | null;
  };

  const kanbanArr = (kanbanAbertosRes.data ?? []) as KanbanCardSla[];
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
  type ProximaEngRow = { id: string; prazo_atividade: string | null };
  const proximasAbertosArr    = (proximasEngRes.data        ?? []) as ProximaEngRow[];
  const proximasConcluidosArr = (proximasConcluidosRes.data ?? []) as ProximaEngRow[];
  const proxVenceHoje  = proximasAbertosArr.filter(c => c.prazo_atividade === hojeStr).length;
  const proxAtrasadas  = proximasAbertosArr.filter(c => c.prazo_atividade && c.prazo_atividade < hojeStr).length;
  const proxConcluidos = proximasConcluidosArr.length;
  const proxDenominador = proxConcluidos + proxAtrasadas;
  const scoreProximas = proxDenominador === 0
    ? 100
    : Math.max(0, Math.round((proxConcluidos / proxDenominador) * 100));

  // Score combinado = média dos sub-scores não-null (pesos iguais)
  const engSubScores = [scoreAtividades, scoreCards, scoreProximas].filter((s): s is number => s !== null);
  const engScore = engSubScores.length === 0
    ? null
    : Math.round(engSubScores.reduce((s, v) => s + v, 0) / engSubScores.length);

  const engajamentoData = {
    atividades: { agendadas: atividadesAgendadas, realizadas: atividadesRealizadas, atrasadas: atividadesAtrasadas, score: scoreAtividades },
    cards:      { comSLA: cardsComSLA.length, emDia: cardsEmDia, atrasados: cardsAtrasados, score: scoreCards },
    proximas:   { concluidos: proxConcluidos, venceHoje: proxVenceHoje, atrasadas: proxAtrasadas, relevantes: proxConcluidos + proxVenceHoje + proxAtrasadas, score: scoreProximas },
    score:      engScore,
  };

  // ── Indicadores (2 níveis: por meta → por usuário) ────────────────────────
  let indicadoresData: Record<string, unknown> = { porMeta: [], media: null };

  type MetaRow = { id: string; descricao: string; tipo: string | null; meta_unidade: string | null; status: string };
  type IndRow  = { id: string; nome: string; semaforo_faixas: unknown; objetivo_id: string | null };

  const { data: metasData } = await db
    .from('objetivos')
    .select('id, descricao, tipo, meta_unidade, status')
    .eq('area_id', areaId)
    .eq('profile_id', profileId)
    .eq('status', 'ativo')
    .is('objetivo_pai_id', null);

  const metas     = (metasData ?? []) as MetaRow[];
  const metaIds   = metas.map(m => m.id);

  if (metaIds.length > 0) {
    const { data: indsData } = await db
      .from('indicadores')
      .select('id, nome, semaforo_faixas, objetivo_id')
      .in('objetivo_id', metaIds);

    const inds   = (indsData ?? []) as IndRow[];
    const indIds = inds.map(i => i.id);

    if (indIds.length > 0) {
      const { data: periodoData } = await db
        .from('periodos')
        .select('data_inicio')
        .lte('data_inicio', hojeStr)
        .gte('data_fim', hojeStr)
        .eq('ano', anoISO)
        .order('data_fim', { ascending: true })
        .limit(1)
        .maybeSingle();

      const semRel = periodoData
        ? isoWeek(new Date((periodoData as { data_inicio: string }).data_inicio))
        : semana;
      const semAnt = semRel > 1 ? semRel - 1 : 52;

      const { data: lancsData } = await db
        .from('indicador_lancamentos')
        .select('indicador_id, valor, semana')
        .in('indicador_id', indIds)
        .in('semana', [semAnt, semRel]);

      // Prefere semana atual; fallback para semana anterior
      const lancMap = new Map<string, string>();
      for (const l of (lancsData ?? []) as { indicador_id: string; valor: unknown; semana: number }[]) {
        const val = String(l.valor ?? '');
        if (l.semana === semRel) {
          lancMap.set(l.indicador_id, val);
        } else if (l.semana === semAnt && !lancMap.has(l.indicador_id)) {
          lancMap.set(l.indicador_id, val);
        }
      }

      const porMeta = metas
        .map(meta => {
          const metaInds = inds.filter(i => i.objetivo_id === meta.id);
          if (metaInds.length === 0) return null; // sem indicadores → exclui da média

          const scores = metaInds.map(ind => {
            const valor = lancMap.get(ind.id);
            if (!valor) return 0; // missing = vm = 0 (rigoroso)
            return scoreDeValorESemaforoNomeado(ind.semaforo_faixas, valor);
          });

          const mediaMeta = scores.reduce((s, v) => s + v, 0) / scores.length;

          const isRecorrente = meta.tipo?.toLowerCase() === 'recorrente';
          const isAtrasada   = !isRecorrente &&
            !!meta.meta_unidade && meta.meta_unidade < hojeStr &&
            meta.status !== 'concluido';

          const scoreFinal = isAtrasada ? mediaMeta * 0.70 : mediaMeta;

          return {
            id:         meta.id,
            descricao:  meta.descricao,
            score:      Math.round(scoreFinal * 10) / 10,
            indicadores: scores.length,
            penalidade:  isAtrasada,
          };
        })
        .filter(Boolean) as Array<{ id: string; descricao: string; score: number; indicadores: number; penalidade: boolean }>;

      const media = porMeta.length > 0
        ? Math.round(porMeta.reduce((s, m) => s + m.score, 0) / porMeta.length * 10) / 10
        : null;

      indicadoresData = { porMeta, media };
    }
  }

  // ── Upsert ─────────────────────────────────────────────────────────────────
  const { error } = await db.from('carometro_status_diario').upsert(
    {
      area_id:    areaId,
      profile_id: profileId,
      data:       hojeStr,
      sirene:     sireneData,
      engajamento: engajamentoData,
      indicadores: indicadoresData,
    },
    { onConflict: 'area_id,profile_id,data' },
  );

  if (error) throw error;
}
