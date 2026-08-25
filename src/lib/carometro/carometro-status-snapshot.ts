import type { SupabaseClient } from '@supabase/supabase-js';
import { isoWeek } from '@/utils/periodos';
import { calcularSlaKanbanCard } from '@/lib/kanban/kanban-card-sla';

// ── Semáforo — cores hex (sincronizado com useMeuCarometro) ──────────────────
const COR_PARA_SCORE: Record<string, number> = {
  '#1e7a3a': 100,
  '#52b36f': 67,
  '#f2c94c': 50,
  '#d24141': 0,
};

type SemaforoFaixa = { cor: string; limite: string | number; comparacao?: string };

/** Retorna 0–100 usando cores hex. Sem lançamento/inválido = 50 (neutro). */
function scoreDeValorESemaforoHex(valor: unknown, semaforo_faixas: unknown): number {
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
 * Calcula % esperado de um indicador Atingível/Projeto com base em dias úteis.
 * Calcula o total de dias úteis dinamicamente (não depende de dias_uteis salvo).
 */
function calcularEsperadoPctDinamico(dataInicio: string, dataFim: string, refDate: Date): number {
  if (!dataInicio || !dataFim) return 0;
  const ref  = new Date(refDate); ref.setHours(0, 0, 0, 0);
  const inicio = new Date(dataInicio + 'T00:00:00');
  const fim    = new Date(dataFim    + 'T00:00:00');
  if (ref < inicio) return 0;

  let total = 0;
  const dt = new Date(inicio);
  while (dt <= fim) {
    if (dt.getDay() !== 0 && dt.getDay() !== 6) total++;
    dt.setDate(dt.getDate() + 1);
  }
  if (total === 0) return 0;
  if (ref >= fim) return 100;

  let count = 0;
  const d2 = new Date(inicio);
  while (d2 <= ref) {
    if (d2.getDay() !== 0 && d2.getDay() !== 6) count++;
    d2.setDate(d2.getDate() + 1);
  }
  return Math.min(100, Math.round((count / total) * 100));
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
  const hojeStr = hoje.toISOString().slice(0, 10);

  // S-1: semana anterior usada como referência de indicadores (igual ao useMeuCarometro)
  const semAnteriorInd = semana > 1 ? semana - 1 : 52;
  // sextaAnterior: data de referência para calcular % esperado dos indicadores de S-1
  const dowRef = hoje.getDay() || 7;
  const segundaSemana = new Date(hoje);
  segundaSemana.setDate(hoje.getDate() - (dowRef - 1));
  const sextaAnterior = new Date(segundaSemana);
  sextaAnterior.setDate(segundaSemana.getDate() - 3);

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
  // Fonte de verdade: APENAS responsavel_id (campo "Responsável do Card" na UI).
  // Cards sem responsavel_id ficam com Ingrid (padrão). franqueado_id nunca é usado.
  const orKanban = `responsavel_id.eq.${profileId},responsaveis_ids.cs.{${profileId}}`;

  const [ganttEngRes, kanbanAbertosRes, proximasEngRes, proximasConcluidosRes] = await Promise.all([
    db.from('gantt_planejamento')
      .select('id, data, data_conclusao_real')
      .eq('profile_id', profileId)
      .gte('data', semanaInicioSnapStr)
      .lte('data', hojeStr)
      .is('sirene_chamado_id', null)
      .is('card_id', null)
      .not('objetivo_id', 'is', null),   // exclui "Sem vínculo à meta"
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
    ? 0
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
  // Cards sem próxima atividade mapeada = penaliza (todo card ativo deveria ter uma)
  const cardsSemProxima = kanbanArr.length - proximasAbertosArr.length;
  // Denominador: concluídos + atrasadas + vence hoje + sem próxima mapeada.
  // Cards com prazo futuro não entram na conta de hoje.
  const proxDenominador = proxConcluidos + proxAtrasadas + proxVenceHoje + cardsSemProxima;
  const scoreProximas = proxDenominador === 0
    ? 100  // sem cards ou todos com próximas futuras = 100%
    : Math.max(0, Math.round((proxConcluidos / proxDenominador) * 100));

  // Score combinado = média dos sub-scores não-null (pesos iguais)
  const engSubScores = [scoreAtividades, scoreCards, scoreProximas].filter((s): s is number => s !== null);
  const engScore = engSubScores.length === 0
    ? null
    : Math.round(engSubScores.reduce((s, v) => s + v, 0) / engSubScores.length);

  const engajamentoData = {
    atividades: { agendadas: atividadesAgendadas, realizadas: atividadesRealizadas, atrasadas: atividadesAtrasadas, score: scoreAtividades },
    cards:      { comSLA: cardsComSLA.length, emDia: cardsEmDia, atrasados: cardsAtrasados, score: scoreCards },
    proximas:   { concluidos: proxConcluidos, venceHoje: proxVenceHoje, atrasadas: proxAtrasadas, semProxima: cardsSemProxima, relevantes: proxConcluidos + proxVenceHoje + proxAtrasadas + cardsSemProxima, score: scoreProximas },
    score:      engScore,
  };

  // ── Indicadores (sincronizado com useMeuCarometro) ───────────────────────
  // Usa objetivo_responsaveis para encontrar indicadores do usuário.
  // Lógica diferenciada: Atingível/Projeto (is_projeto_relativo) vs Recorrente.
  let indicadoresData: Record<string, unknown> = { porIndicador: [], media: null };

  {
    const { data: objRespData } = await db
      .from('objetivo_responsaveis')
      .select('objetivo_id')
      .eq('profile_id', profileId);

    const objIds = ((objRespData ?? []) as { objetivo_id: string }[])
      .map(o => o.objetivo_id).filter(Boolean);

    if (objIds.length > 0) {
      const { data: objetivosData } = await db
        .from('objetivos')
        .select('id, descricao')
        .in('id', objIds);
      const objNomeMap = new Map<string, string>(
        ((objetivosData ?? []) as { id: string; descricao: string }[]).map(o => [o.id, o.descricao])
      );

      const { data: indsData } = await db
        .from('indicadores')
        .select('id, nome, semaforo_faixas, objetivo_id')
        .in('objetivo_id', objIds)
        .eq('ativo', true);

      type IndRow = { id: string; nome: string; semaforo_faixas: unknown; objetivo_id: string | null };
      const indsTyped = (indsData ?? []) as IndRow[];
      const indIds = indsTyped.map(i => i.id);

      if (indIds.length > 0) {
        // Busca lançamentos de S-1 — mesma semana que o TO DO & Planning exibe no card principal
        const { data: lancsData } = await db
          .from('indicador_lancamentos')
          .select('indicador_id, valor')
          .in('indicador_id', indIds)
          .eq('semana', semAnteriorInd);

        const lancMap = new Map<string, unknown>(
          ((lancsData ?? []) as { indicador_id: string; valor: unknown }[]).map(l => [l.indicador_id, l.valor])
        );

        type SfRaw = { is_projeto_relativo?: boolean; data_inicio?: string; data_fim?: string };
        type IndItem = { nome: string; valor: number; meta: number; percentual: number | null };
        const porIndicador: IndItem[] = [];
        const metaScoresMap = new Map<string, number[]>();

        for (const ind of indsTyped) {
          const objNome    = ind.objetivo_id ? (objNomeMap.get(ind.objetivo_id) ?? '') : '';
          const nomeDisplay = objNome ? `${objNome} — ${ind.nome}` : (ind.nome || ind.id);
          const rawSf = ind.semaforo_faixas as SfRaw | null;
          const isProjeto = rawSf != null && typeof rawSf === 'object' && !Array.isArray(rawSf) && rawSf.is_projeto_relativo;
          const metaKey = ind.objetivo_id ?? ind.id;

          if (isProjeto) {
            const esp = calcularEsperadoPctDinamico(rawSf!.data_inicio ?? '', rawSf!.data_fim ?? '', sextaAnterior);
            if (esp <= 0) {
              porIndicador.push({ nome: nomeDisplay, valor: 0, meta: 0, percentual: null });
              continue;
            }

            // Cap de 70 pts se sextaAnterior ultrapassou a semana do data_fim
            const dataFimDate = new Date((rawSf!.data_fim ?? '') + 'T00:00:00');
            const dataFimDow = dataFimDate.getDay() || 7;
            const endOfDeadlineWeek = new Date(dataFimDate);
            endOfDeadlineWeek.setDate(dataFimDate.getDate() + (7 - dataFimDow));
            const isPastDeadlineWeek = sextaAnterior > endOfDeadlineWeek;

            const valor  = lancMap.get(ind.id);
            const valStr = valor != null ? String(valor).trim() : '';
            if (valStr === '' || valStr === '-') {
              porIndicador.push({ nome: nomeDisplay, valor: 0, meta: esp, percentual: 0 });
              metaScoresMap.set(metaKey, [...(metaScoresMap.get(metaKey) ?? []), 0]);
            } else {
              const n = Number(valStr.replace(',', '.'));
              if (!Number.isFinite(n)) { porIndicador.push({ nome: nomeDisplay, valor: 0, meta: esp, percentual: null }); continue; }
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
              const score = scoreDeValorESemaforoHex(valor, ind.semaforo_faixas);
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

        indicadoresData = { porIndicador, media };
      }
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
