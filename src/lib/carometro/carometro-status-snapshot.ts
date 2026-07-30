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
  const { data: topicos } = await db
    .from('sirene_topicos')
    .select('id, data_fim, prazo_proposto')
    .or(`responsavel_id.eq.${profileId},responsaveis_ids.cs.{${profileId}}`)
    .in('status', ['nao_iniciado', 'em_andamento'])
    .eq('arquivado', false);

  const topicosArr = topicos ?? [];
  const semPrazo   = topicosArr.filter(t => !t.data_fim && !t.prazo_proposto).length;
  const sireneAtrasados = topicosArr.filter(t => {
    const prazo = (t.data_fim || t.prazo_proposto) as string | null;
    if (!prazo) return false;
    return new Date(prazo) < hoje;
  }).length;
  const sireneScore = topicosArr.length === 0
    ? 100
    : Math.max(0, Math.round(((topicosArr.length - sireneAtrasados) / topicosArr.length) * 1000) / 10);

  const sireneData = {
    atrasados: sireneAtrasados,
    abertos:   topicosArr.length,
    semPrazo,
    score:     sireneScore,
  };

  // ── Engajamento ────────────────────────────────────────────────────────────
  const cutoffDate = new Date(hoje);
  cutoffDate.setDate(cutoffDate.getDate() - 14);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10);

  const orGantt  = `profile_id.eq.${profileId}${nomeUsuario ? `,responsavel.ilike.%${nomeUsuario}%` : ''}`;
  const orKanban = `responsavel_id.eq.${profileId},responsaveis_ids.cs.{${profileId}},franqueado_id.eq.${profileId}`;

  const [
    ganttAtrasadasRes, ganttConcluidasRes, ganttPlanejdasRes,
    kanbanAbertosRes, kanbanConcluidosRes,
  ] = await Promise.all([
    // Atrasadas: qualquer semana passada não concluída (sem janela artificial de 2 semanas)
    db.from('gantt_planejamento').select('id')
      .or(orGantt).is('data_conclusao_real', null)
      .lt('semana_ano_fim', semana),
    // Concluídas: filtrar pela data real de conclusão nos últimos 14 dias
    db.from('gantt_planejamento').select('id')
      .or(orGantt).not('data_conclusao_real', 'is', null)
      .gte('data_conclusao_real', cutoffStr),
    db.from('gantt_planejamento').select('id')
      .or(orGantt).is('data_conclusao_real', null).gte('semana_ano_fim', semana),
    db.from('kanban_cards')
      .select('id, created_at, entered_fase_at, sla_iniciado_em, fase:kanban_fases!fase_id(sla_dias, sla_tipo, slug)')
      .or(orKanban).eq('arquivado', false).eq('concluido', false),
    db.from('kanban_cards').select('id')
      .or(orKanban).eq('concluido', true).eq('arquivado', false)
      .gte('concluido_em', cutoffStr),
  ]);

  const atividadesAtrasadas  = ganttAtrasadasRes.data?.length  ?? 0;
  const atividadesConcluidas = ganttConcluidasRes.data?.length ?? 0;
  const atividadesPlanejadas = ganttPlanejdasRes.data?.length  ?? 0;
  const cardsConcluidos      = kanbanConcluidosRes.data?.length ?? 0;

  type FaseKanban = { sla_dias: number | null; sla_tipo: string | null; slug: string | null };
  type KanbanCardSla = {
    id: string; created_at: string; entered_fase_at: string | null;
    sla_iniciado_em: string | null; fase: FaseKanban | FaseKanban[] | null;
  };

  const kanbanArr = (kanbanAbertosRes.data ?? []) as KanbanCardSla[];
  const cardsAtrasados = kanbanArr.filter(c => {
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
  const cardsAbertos = kanbanArr.length - cardsAtrasados;

  const engNumerador   = atividadesConcluidas + cardsConcluidos;
  const engDenominador = engNumerador + atividadesAtrasadas + cardsAtrasados;
  const engScore = engDenominador === 0
    ? null
    : Math.max(0, Math.round((engNumerador / engDenominador) * 1000) / 10);

  const engajamentoData = {
    atividades: {
      concluidas: atividadesConcluidas,
      atrasadas:  atividadesAtrasadas,
      planejadas: atividadesPlanejadas,
    },
    cards: {
      concluidos: cardsConcluidos,
      atrasados:  cardsAtrasados,
      abertos:    cardsAbertos,
    },
    score: engScore,
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
