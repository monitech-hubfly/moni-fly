import type { SupabaseClient } from '@supabase/supabase-js';
import { isoWeek } from '@/utils/periodos';
import { calcularSlaKanbanCard, faseExcluidaDoAtrasoSla } from '@/lib/kanban/kanban-card-sla';
import { ultimaSextaUtilDoMes, tierPorAtraso, tierFilha } from '@/lib/carometro/scoring-utils';

// ── Snapshot principal ───────────────────────────────────────────────────────
export async function gerarSnapshotCarometro(
  db: SupabaseClient,
  profileId: string,
  areaId: string,
  nomeUsuario: string | null,
  data: Date,
) {
  const hoje    = data;
  const hojeStr = hoje.toISOString().slice(0, 10);
  const semana  = isoWeek(hoje);

  // ── Sirene ─────────────────────────────────────────────────────────────────
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
      .select('id, data_fim, prazo_proposto, updated_at')
      .or(`responsavel_id.eq.${profileId},responsaveis_ids.cs.{${profileId}}`)
      .in('status', ['concluido', 'aprovado'])
      .eq('arquivado', false)
      .gte('updated_at', semanaInicioSnapStr),
  ]);

  type TopicosSnapRow = { id: unknown; data_fim: string | null; prazo_proposto: string | null; updated_at?: string | null };
  const topicosAbertos = (topicosAbertosSnap.data ?? []) as TopicosSnapRow[];
  const topicosConcluidos = ((topicosConcluidosSnap.data ?? []) as TopicosSnapRow[]).filter(t => {
    const prazo = t.data_fim || t.prazo_proposto;
    return prazo && prazo <= hojeStr;
  });

  const semPrazo = topicosAbertos.filter(t => !t.data_fim && !t.prazo_proposto).length;
  const sireneAtrasados = topicosAbertos.filter(t => {
    const prazo = t.data_fim || t.prazo_proposto;
    if (!prazo) return false;
    return prazo < hojeStr;
  }).length;
  const sireneVenceHoje = topicosAbertos.filter(t => {
    const prazo = t.data_fim || t.prazo_proposto;
    return prazo === hojeStr;
  }).length;
  const sireneFuturas = topicosAbertos.filter(t => {
    const prazo = t.data_fim || t.prazo_proposto;
    return prazo && prazo > hojeStr;
  }).length;

  // Fórmula com tier (100/75/50/20%) — igual ao browser (useMeuCarometro.ts)
  const sireneTotal = topicosConcluidos.length + sireneAtrasados + sireneVenceHoje;
  const creditosSirene = topicosConcluidos.reduce((sum, t) => {
    const prazo = t.data_fim || t.prazo_proposto;
    return sum + tierFilha(prazo, t.updated_at ?? null);
  }, 0);
  const sireneScoreRaw = sireneTotal === 0
    ? 100
    : Math.max(0, Math.round((creditosSirene / (sireneTotal * 100)) * 100));

  // Cap 50%: chamado aberto com prazo vencido há >15 dias — igual ao browser
  const quinzeDiasAtrasStr = new Date(hoje.getTime() - 15 * 86_400_000).toISOString().slice(0, 10);
  const temChamadoAntigo = topicosAbertos.some(t => {
    const prazo = t.data_fim || t.prazo_proposto;
    return !!prazo && prazo < quinzeDiasAtrasStr;
  });
  const sireneFinal = temChamadoAntigo ? Math.min(sireneScoreRaw, 50) : sireneScoreRaw;

  const sireneData = {
    atrasados:  sireneAtrasados,
    abertos:    topicosAbertos.length,
    venceHoje:  sireneVenceHoje,
    futuras:    sireneFuturas,
    relevantes: sireneTotal,
    concluidos: topicosConcluidos.length,
    semPrazo,
    score:      sireneFinal,
  };

  // ── Engajamento v2: Metas Filhas + Tier ──────────────────────────────────
  // Espelha exatamente a lógica de useMeuCarometro.ts (Engajamento v2).
  // Mantém os campos antigos (atividades/cards/proximas) para backward compat com
  // useFechamentoBoneDay que os agrega por equipe.
  const orKanban = `responsavel_id.eq.${profileId},responsaveis_ids.cs.{${profileId}}`;

  const mesAtualEng = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  const [ganttEngRes, kanbanAbertosRes, proximasEngRes, proximasConcluidosRes, filhasEngRes] = await Promise.all([
    db.from('gantt_planejamento')
      .select('id, data, data_conclusao_real')
      .eq('profile_id', profileId)
      .gte('data', semanaInicioSnapStr)
      .lte('data', hojeStr)
      .is('sirene_chamado_id', null)
      .is('card_id', null)
      .not('objetivo_id', 'is', null),
    db.from('kanban_cards')
      .select('id, created_at, entered_fase_at, sla_iniciado_em, sla_pausado_em, fase:kanban_fases!fase_id(sla_dias, sla_tipo, slug)')
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
    // Metas Filhas do usuário no mês vigente (Engajamento v2)
    db.from('objetivos')
      .select('id, status, data_fim, atualizado_em')
      .eq('profile_id', profileId)
      .not('objetivo_pai_id', 'is', null)
      .eq('mes', mesAtualEng),
  ]);

  // Sub-scores antigos (mantidos para agregação de equipe no Fechamento Boné Day)
  type GanttEngRow = { id: string; data: string; data_conclusao_real: string | null };
  const ganttArr = (ganttEngRes.data ?? []) as GanttEngRow[];
  const atividadesAgendadas = ganttArr.length;
  const atividadesRealizadas = ganttArr.filter(g => !!g.data_conclusao_real).length;
  const atividadesAtrasadas  = ganttArr.filter(g => !g.data_conclusao_real).length;
  const scoreAtividades = atividadesAgendadas === 0
    ? 0
    : Math.max(0, Math.round((atividadesRealizadas / atividadesAgendadas) * 100));

  type FaseKanban = { sla_dias: number | null; sla_tipo: string | null; slug: string | null };
  type KanbanCardSla = {
    id: string; created_at: string; entered_fase_at: string | null;
    sla_iniciado_em: string | null; sla_pausado_em: string | null; fase: FaseKanban | FaseKanban[] | null;
  };
  const kanbanArr = (kanbanAbertosRes.data ?? []) as KanbanCardSla[];
  const cardsComSLA = kanbanArr.filter(c => {
    const fase = Array.isArray(c.fase) ? c.fase[0] : c.fase;
    if (faseExcluidaDoAtrasoSla(fase?.slug)) return false;
    return (fase?.sla_dias ?? null) !== null;
  });
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
  const scoreCards = cardsComSLA.length === 0 || cardsNaoBloqueados.length === 0
    ? 100
    : Math.max(0, Math.round((cardsEmDia / cardsNaoBloqueados.length) * 100));

  type ProximaEngRow = { id: string; prazo_atividade: string | null };
  const proximasAbertosArr    = (proximasEngRes.data        ?? []) as ProximaEngRow[];
  const proximasConcluidosArr = (proximasConcluidosRes.data ?? []) as ProximaEngRow[];
  const proxVenceHoje  = proximasAbertosArr.filter(c => c.prazo_atividade === hojeStr).length;
  const proxAtrasadas  = proximasAbertosArr.filter(c => c.prazo_atividade && c.prazo_atividade < hojeStr).length;
  const proxConcluidos = proximasConcluidosArr.length;
  const cardsSemProxima = kanbanArr.length - proximasAbertosArr.length;
  const proxDenominador = proxConcluidos + proxAtrasadas + proxVenceHoje + cardsSemProxima;
  const scoreProximas = proxDenominador === 0
    ? 100
    : Math.max(0, Math.round((proxConcluidos / proxDenominador) * 100));

  // Engajamento v2: score baseado em Metas Filhas + Tier
  type FilhaEngRow = { id: string; status: string; data_fim: string | null; atualizado_em: string | null };
  const filhasArr = (filhasEngRes.data ?? []) as FilhaEngRow[];

  const filhasConcluidas      = filhasArr.filter(f => f.status === 'concluido');
  const filhasVencidasAbertas = filhasArr.filter(f =>
    f.status !== 'concluido' && f.status !== 'arquivado' && f.status !== 'relancada' &&
    !!f.data_fim && f.data_fim < hojeStr
  );
  const engRelevantes = filhasConcluidas.length + filhasVencidasAbertas.length;

  let novoScoreEng: number;
  if (filhasArr.length === 0) {
    novoScoreEng = 0; // sem filhas → não assumiu metas do mês
  } else if (engRelevantes === 0) {
    novoScoreEng = 100; // tem filhas, todas no prazo → sem penalidade
  } else {
    const totalCreditos = filhasConcluidas.reduce(
      (sum, f) => sum + tierFilha(f.data_fim, f.atualizado_em), 0
    );
    novoScoreEng = Math.max(0, Math.round((totalCreditos / (engRelevantes * 100)) * 100));
  }

  const engajamentoData = {
    // Campos antigos mantidos para backward compat (usados pela agregação de equipe no Fechamento)
    atividades: { agendadas: atividadesAgendadas, realizadas: atividadesRealizadas, atrasadas: atividadesAtrasadas, score: scoreAtividades },
    cards:      { comSLA: cardsComSLA.length, emDia: cardsEmDia, atrasados: cardsAtrasados, bloqueados: cardsBloqueados, score: scoreCards },
    proximas:   { concluidos: proxConcluidos, venceHoje: proxVenceHoje, atrasadas: proxAtrasadas, semProxima: cardsSemProxima, relevantes: proxDenominador, score: scoreProximas },
    // Score v2 (Metas Filhas) — fonte de verdade para Meu Carômetro e Fechamento
    score:      novoScoreEng,
    // Detalhe das filhas para auditoria
    filhas: {
      total:           filhasArr.length,
      concluidas:      filhasConcluidas.length,
      vencidas_abertas: filhasVencidasAbertas.length,
      no_prazo:        filhasArr.length - filhasConcluidas.length - filhasVencidasAbertas.length,
    },
  };

  // ── Indicadores v3: scoring baseado na conclusão da Meta Mãe ─────────────
  // Espelha exatamente a lógica de useMeuCarometro.ts (Indicadores v3).
  let indicadoresData: Record<string, unknown> = { porIndicador: [], media: 0 };

  {
    const mesAtualInd = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const anoAtualInd = hoje.getFullYear();
    const mesNumInd   = hoje.getMonth() + 1; // 1-indexed

    const { data: objRespData } = await db
      .from('objetivo_responsaveis')
      .select('objetivo_id, concluido, concluido_em')
      .eq('profile_id', profileId);

    type ObjRespRow = { objetivo_id: string; concluido: boolean | null; concluido_em: string | null };
    const objRespRows = (objRespData ?? []) as ObjRespRow[];
    const objIds = objRespRows.map(r => r.objetivo_id).filter(Boolean);

    if (objIds.length === 0) {
      indicadoresData = { porIndicador: [], media: 0 };
    } else {
      const { data: metasData } = await db
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
        indicadoresData = { porIndicador: [], media: 0 };
      } else {
        const objRespMap = new Map(objRespRows.map(r => [r.objetivo_id, r]));
        const scores: number[] = [];
        const porIndicador: { nome: string; valor: number; meta: number; percentual: number }[] = [];

        for (const meta of metas) {
          const resp = objRespMap.get(meta.id);
          const tipo = (meta.tipo ?? '').toLowerCase();

          let deadline: Date;
          if (tipo === 'recorrente') {
            deadline = ultimaSextaUtilDoMes(anoAtualInd, mesNumInd);
          } else {
            if (!meta.data_fim) {
              scores.push(100);
              porIndicador.push({ nome: meta.descricao, valor: 0, meta: 0, percentual: 100 });
              continue;
            }
            deadline = new Date(meta.data_fim + 'T23:59:59');
          }

          // Fallback: cobre dados históricos onde apenas objetivos.status foi atualizado
          const isConcluido = resp?.concluido === true || meta.status === 'concluido';
          const concluidoEm = resp?.concluido_em ?? null;

          let score: number;
          if (isConcluido && concluidoEm) {
            score = tierPorAtraso(concluidoEm, deadline);
          } else {
            score = hoje <= deadline ? 100 : 0;
          }

          scores.push(score);
          porIndicador.push({ nome: meta.descricao, valor: 0, meta: 0, percentual: score });
        }

        const media = scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;

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
