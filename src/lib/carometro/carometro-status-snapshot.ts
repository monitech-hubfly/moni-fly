import type { SupabaseClient } from '@supabase/supabase-js';
import { isoWeek, isoWeekYear } from '@/utils/periodos';
import { calcularSlaKanbanCard } from '@/lib/kanban/kanban-card-sla';

// ── Semáforo (replicado de useMeuCarometro) ──────────────────────────────────
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
  const orKanban = `responsavel_id.eq.${profileId},responsaveis_ids.cs.{${profileId}}`;

  const [
    ganttAtrasadasRes, ganttConcluidasRes, ganttPlanejdasRes,
    kanbanAbertosRes, kanbanConcluidosRes,
  ] = await Promise.all([
    db.from('gantt_planejamento').select('id')
      .or(orGantt).is('data_conclusao_real', null)
      .gte('semana_ano_fim', semana - 2).lt('semana_ano_fim', semana),
    db.from('gantt_planejamento').select('id')
      .or(orGantt).not('data_conclusao_real', 'is', null)
      .gte('semana_ano_fim', semana - 2).lte('semana_ano_fim', semana),
    db.from('gantt_planejamento').select('id')
      .or(orGantt).is('data_conclusao_real', null).gte('semana_ano_fim', semana),
    db.from('kanban_cards')
      .select('id, created_at, entered_fase_at, sla_iniciado_em, fase:kanban_fases(sla_dias, sla_tipo, slug)')
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

  // ── Indicadores ────────────────────────────────────────────────────────────
  let indicadoresData: Record<string, unknown> = { porIndicador: [], media: null };

  const { data: indsData } = await db
    .from('indicadores')
    .select('id, nome, semaforo_faixas')
    .eq('area_id', areaId);

  const indsTyped = ((indsData ?? []) as { id: string; nome: string; semaforo_faixas: unknown }[]);
  const indIds = indsTyped.map(i => i.id);

  if (indIds.length > 0) {
    const { data: periodo } = await db
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

    const { data: lancamentos } = await db
      .from('indicador_lancamentos')
      .select('indicador_id, valor')
      .in('indicador_id', indIds)
      .eq('semana', semanaRelativa);

    const lancMap = new Map<string, unknown>(
      ((lancamentos ?? []) as { indicador_id: string; valor: unknown }[]).map(l => [l.indicador_id, l.valor])
    );

    const porIndicador = indsTyped
      .filter(ind => lancMap.has(ind.id))
      .map(ind => {
        const valor = lancMap.get(ind.id);
        return {
          nome:       ind.nome || ind.id,
          valor:      Number(valor) || 0,
          meta:       0,
          percentual: scoreDeValorESemaforo(valor, ind.semaforo_faixas),
        };
      });

    const scores = porIndicador.map(i => i.percentual);
    const media  = scores.length > 0
      ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      : null;

    indicadoresData = { porIndicador, media };
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
