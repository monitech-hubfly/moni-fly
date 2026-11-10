import type { SupabaseClient } from '@supabase/supabase-js';
import { isoWeek } from '@/utils/periodos';
import { ultimaSextaUtilDoMes, tierPorAtraso, tierFilha } from '@/lib/carometro/scoring-utils';

// ── Tipos de evidência (espelhados em useMeuCarometro.ts) ────────────────────
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcTierSirene(prazo: string | null, updatedAt: string | null): { tier: string; credito: number } {
  if (!prazo || !updatedAt) return { tier: 'no_prazo', credito: 100 };
  const prazoDate = new Date(prazo + 'T00:00:00');
  const concDate  = new Date(updatedAt.slice(0, 10) + 'T00:00:00');
  const dias = Math.floor((concDate.getTime() - prazoDate.getTime()) / 86_400_000);
  if (dias <= 0)  return { tier: 'no_prazo', credito: 100 };
  if (dias <= 6)  return { tier: 'T1',      credito: 75 };
  if (dias <= 14) return { tier: 'T2',      credito: 50 };
  return              { tier: 'T3',          credito: 20 };
}

function diasAtraso(prazo: string | null, ref: Date): number | null {
  if (!prazo) return null;
  const prazoDate = new Date(prazo + 'T00:00:00');
  return Math.floor((ref.getTime() - prazoDate.getTime()) / 86_400_000);
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
  const hojeStr = hoje.toISOString().slice(0, 10);
  void nomeUsuario; // parâmetro mantido por compatibilidade com callers existentes

  // ── Sirene ─────────────────────────────────────────────────────────────────
  const dowSnap = hoje.getDay() || 7;
  const semanaInicioSnap = new Date(hoje);
  semanaInicioSnap.setDate(hoje.getDate() - (dowSnap - 1));
  const semanaInicioSnapStr = semanaInicioSnap.toISOString().slice(0, 10);

  const [topicosAbertosSnap, topicosConcluidosSnap] = await Promise.all([
    db.from('sirene_topicos')
      .select('id, chamado_id, interacao_id, nome, data_fim, prazo_proposto, status, updated_at')
      .or(`responsavel_id.eq.${profileId},responsaveis_ids.cs.{${profileId}}`)
      .in('status', ['nao_iniciado', 'em_andamento'])
      .eq('arquivado', false),
    db.from('sirene_topicos')
      .select('id, chamado_id, nome, data_fim, prazo_proposto, status, updated_at')
      .or(`responsavel_id.eq.${profileId},responsaveis_ids.cs.{${profileId}}`)
      .in('status', ['concluido', 'aprovado'])
      .eq('arquivado', false)
      .gte('updated_at', semanaInicioSnapStr),
  ]);

  type TopicoSnap = {
    id: number; chamado_id: number | null; interacao_id: string | null; nome: string | null;
    data_fim: string | null; prazo_proposto: string | null;
    status: string; updated_at: string | null;
  };
  let topicosAbertos = (topicosAbertosSnap.data ?? []) as TopicoSnap[];

  // ── Filtrar tópicos-fantasma: chamado-pai arquivado (direto ou via kanban_atividades) ─────
  // Replica a lógica do useBacklog.ts para evitar que chamados concluídos/arquivados
  // penalizem o score do Carômetro no cron noturno.
  {
    // 1. Chamados diretos arquivados
    const chamadoIdsDirectos = topicosAbertos
      .filter(t => t.chamado_id != null)
      .map(t => t.chamado_id as number);

    const chamadosArquivadosSet = new Set<number>();
    if (chamadoIdsDirectos.length > 0) {
      const { data: chamArq } = await db
        .from('sirene_chamados')
        .select('id')
        .in('id', chamadoIdsDirectos)
        .eq('arquivado', true);
      for (const c of (chamArq ?? []) as { id: number }[]) {
        chamadosArquivadosSet.add(c.id);
      }
    }

    // 2. Chamados via kanban_atividades.sirene_chamado_id arquivados + cards arquivados
    const interacaoIds = topicosAbertos
      .filter(t => !t.chamado_id && t.interacao_id)
      .map(t => t.interacao_id as string);

    const chamadosArquivadosViaKativSet = new Set<number>();
    const cardsAtivosSnapSet = new Set<string>();

    if (interacaoIds.length > 0) {
      type KASnapRow = { id: string; card_id: string | null; sirene_chamado_id: number | null };
      const { data: kativs } = await db
        .from('kanban_atividades')
        .select('id, card_id, sirene_chamado_id')
        .in('id', interacaoIds);

      const kativSnapMap = new Map<string, KASnapRow>(
        ((kativs ?? []) as KASnapRow[]).map(r => [r.id, r])
      );

      // 2a. Chamados via sirene_chamado_id
      const chamadoIdsViaKativ = [...kativSnapMap.values()]
        .filter(r => r.sirene_chamado_id != null)
        .map(r => r.sirene_chamado_id as number);

      if (chamadoIdsViaKativ.length > 0) {
        const { data: chamArqViaKativ } = await db
          .from('sirene_chamados')
          .select('id')
          .in('id', chamadoIdsViaKativ)
          .eq('arquivado', true);
        for (const c of (chamArqViaKativ ?? []) as { id: number }[]) {
          chamadosArquivadosViaKativSet.add(c.id);
        }
      }

      // 2b. Cards via card_id (cards arquivados = ausentes na query com .eq('arquivado', false))
      const cardIdsSnap = [...kativSnapMap.values()]
        .filter(r => r.sirene_chamado_id == null && r.card_id != null)
        .map(r => r.card_id as string);

      if (cardIdsSnap.length > 0) {
        const { data: cardsAtivosSnap } = await db
          .from('kanban_cards')
          .select('id')
          .in('id', cardIdsSnap)
          .eq('arquivado', false);
        for (const c of (cardsAtivosSnap ?? []) as { id: string }[]) {
          cardsAtivosSnapSet.add(c.id);
        }
      }

      topicosAbertos = topicosAbertos.filter(t => {
        // Chamado direto arquivado
        if (t.chamado_id != null && chamadosArquivadosSet.has(t.chamado_id)) return false;
        // Via kanban_atividades
        if (!t.chamado_id && t.interacao_id) {
          const kativ = kativSnapMap.get(t.interacao_id);
          if (kativ) {
            if (kativ.sirene_chamado_id != null && chamadosArquivadosViaKativSet.has(kativ.sirene_chamado_id)) return false;
            if (kativ.sirene_chamado_id == null && kativ.card_id != null && !cardsAtivosSnapSet.has(kativ.card_id)) return false;
          }
        }
        return true;
      });
    } else if (chamadosArquivadosSet.size > 0) {
      // Sem interacao_ids mas pode ter chamados diretos arquivados
      topicosAbertos = topicosAbertos.filter(t =>
        !(t.chamado_id != null && chamadosArquivadosSet.has(t.chamado_id))
      );
    }
  }
  const topicosConcluidos = ((topicosConcluidosSnap.data ?? []) as TopicoSnap[]).filter(t => {
    const prazo = t.data_fim || t.prazo_proposto;
    return prazo && prazo <= hojeStr;
  });

  const topicosSemPrazo      = topicosAbertos.filter(t => !t.data_fim && !t.prazo_proposto).length;
  const topicosAtrasados     = topicosAbertos.filter(t => { const p = t.data_fim || t.prazo_proposto; return p && p < hojeStr; }).length;
  const topicosVenceHoje     = topicosAbertos.filter(t => { const p = t.data_fim || t.prazo_proposto; return p === hojeStr; }).length;
  const topicosFuturas       = topicosAbertos.filter(t => { const p = t.data_fim || t.prazo_proposto; return p && p > hojeStr; }).length;
  const topicosUltraAtrasados = topicosAbertos.filter(t => {
    const p = t.data_fim || t.prazo_proposto; if (!p) return false;
    return diasAtraso(p, hoje) !== null && (diasAtraso(p, hoje) as number) > 15;
  }).length;

  // Score v2 tier — créditos ponderados
  const sireneTotal = topicosConcluidos.length + topicosAtrasados + topicosVenceHoje;
  const creditoTotal = topicosConcluidos.reduce((sum, t) => {
    const p = t.data_fim || t.prazo_proposto;
    return sum + calcTierSirene(p, t.updated_at).credito;
  }, 0);
  const sireneScoreRaw = sireneTotal === 0
    ? 100
    : Math.max(0, Math.round((creditoTotal / (sireneTotal * 100)) * 100));
  const capAtivo    = topicosUltraAtrasados > 0;
  const sireneScore = capAtivo ? Math.min(sireneScoreRaw, 50) : sireneScoreRaw;

  // Montar evidências por tópico
  const topicosDetalhe: SireneTopicoDetalhe[] = [
    ...topicosConcluidos.map(t => {
      const p = t.data_fim || t.prazo_proposto;
      const { tier, credito } = calcTierSirene(p, t.updated_at);
      return {
        id: t.id, chamado_id: t.chamado_id, nome: t.nome, prazo: p,
        status: t.status, tipo: 'concluido' as const,
        dias_atraso: p ? (diasAtraso(t.updated_at ? t.updated_at.slice(0,10) : hojeStr + 'T00:00:00', new Date(p + 'T00:00:00')) !== null
          ? Math.floor((new Date(t.updated_at?.slice(0,10) ?? hojeStr).getTime() - new Date(p).getTime()) / 86_400_000)
          : null) : null,
        tier, credito, updated_at: t.updated_at,
      };
    }),
    ...topicosAbertos.map(t => {
      const p = t.data_fim || t.prazo_proposto;
      const da = p ? diasAtraso(p, hoje) : null;
      const tier = da === null ? 'sem_prazo' : da <= 0 ? 'no_prazo' : da <= 6 ? 'T1' : da <= 14 ? 'T2' : da <= 15 ? 'T3' : 'ultra_atrasado';
      return {
        id: t.id, chamado_id: t.chamado_id, nome: t.nome, prazo: p,
        status: t.status, tipo: 'em_aberto' as const,
        dias_atraso: da !== null ? Math.max(0, da) : null,
        tier, credito: 0, updated_at: t.updated_at,
      };
    }),
  ];

  const sireneData = {
    score:         sireneScore,
    cap_ativo:     capAtivo,
    relevantes:    sireneTotal,
    concluidos:    topicosConcluidos.length,
    atrasados:     topicosAtrasados,
    venceHoje:     topicosVenceHoje,
    futuras:       topicosFuturas,
    semPrazo:      topicosSemPrazo,
    super_atrasados: topicosUltraAtrasados,
    topicos:       topicosDetalhe,
  };

  // ── Engajamento v2: Metas Filhas + Tier (sem código antigo de atividades/cards) ──
  const mesAtualEng = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  const { data: filhasData } = await db
    .from('objetivos')
    .select('id, descricao, status, data_fim, atualizado_em')
    .eq('profile_id', profileId)
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

  // Evidências por filha
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
        da = diasAtraso(f.data_fim, hoje) ?? 0;
        tier = 'vencida_aberta';
        credito = 0;
      } else {
        tier = 'no_prazo_aberta';
        credito = 0;
      }

      return {
        id: f.id, descricao: f.descricao, data_fim: f.data_fim,
        status: f.status, atualizado_em: f.atualizado_em,
        dias_atraso: da, tier, credito,
      };
    });

  const engajamentoData = {
    score: novoScoreEng,
    filhas: {
      total:            filhasArr.length,
      concluidas:       filhasConcluidas.length,
      vencidas_abertas: filhasVencidasAbertas.length,
      no_prazo:         filhasNoPrazo.length,
      detalhes:         filhasDetalhes,
    },
  };

  // ── Indicadores v3: scoring baseado na conclusão da Meta Mãe ─────────────
  let indicadoresData:      { media: number; porIndicador: IndicadorDetalhe[] } = { media: 0, porIndicador: [] };
  let indicadoresPreviaData: { media: number; porIndicador: IndicadorDetalhe[] } = { media: 0, porIndicador: [] };

  {
    const mesAtualInd = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const anoAtualInd = hoje.getFullYear();
    const mesNumInd   = hoje.getMonth() + 1;

    const { data: objRespData } = await db
      .from('objetivo_responsaveis')
      .select('objetivo_id, concluido, concluido_em')
      .eq('profile_id', profileId);

    type ObjRespRow = { objetivo_id: string; concluido: boolean | null; concluido_em: string | null };
    const objRespRows = (objRespData ?? []) as ObjRespRow[];
    const objIds = objRespRows.map(r => r.objetivo_id).filter(Boolean);

    if (objIds.length > 0) {
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

      if (metas.length > 0) {
        const objRespMap = new Map(objRespRows.map(r => [r.objetivo_id, r]));

        // Deadline máximo do ciclo — nenhuma meta pode ultrapassar a última sexta útil
        const deadlineMaxCiclo = ultimaSextaUtilDoMes(anoAtualInd, mesNumInd);

        const scoresTracking: number[] = []; // tracking: 100% enquanto no prazo
        const scoresPrevia:   number[] = []; // prévia:   0% para toda aberta
        const porIndicadorTracking: IndicadorDetalhe[] = [];
        const porIndicadorPrevia:   IndicadorDetalhe[] = [];

        for (const meta of metas) {
          const resp = objRespMap.get(meta.id);
          const tipo = (meta.tipo ?? '').toLowerCase();

          let deadline: Date;
          let deadlineStr: string;
          if (tipo === 'recorrente') {
            deadline    = deadlineMaxCiclo;
            deadlineStr = deadline.toISOString().slice(0, 10);
          } else {
            if (!meta.data_fim) {
              // Sem prazo definido → 100% tracking / 0% prévia (aberta)
              scoresTracking.push(100);
              scoresPrevia.push(0);
              const baseItem: IndicadorDetalhe = {
                id: meta.id, nome: meta.descricao, tipo,
                deadline_calculada: null, status: meta.status,
                isConcluido: false, concluido_em: null,
                dias_atraso: null, tier: 'sem_prazo', percentual: 100,
              };
              porIndicadorTracking.push(baseItem);
              porIndicadorPrevia.push({ ...baseItem, percentual: 0 });
              continue;
            }
            const dataFimDate = new Date(meta.data_fim + 'T23:59:59');
            // Trava: deadline não pode ultrapassar o último dia útil do ciclo
            deadline    = dataFimDate > deadlineMaxCiclo ? deadlineMaxCiclo : dataFimDate;
            deadlineStr = deadline.toISOString().slice(0, 10);
          }

          const isConcluido = resp?.concluido === true || meta.status === 'concluido';
          const concluidoEm = resp?.concluido_em ?? null;

          let scoreTracking: number;
          let scorePrevia: number;
          let tier: string;
          let da: number | null = null;

          if (isConcluido && concluidoEm) {
            scoreTracking = tierPorAtraso(concluidoEm, deadline);
            scorePrevia   = scoreTracking; // concluída: mesmo valor nos dois
            da = Math.floor(
              (new Date(concluidoEm.slice(0, 10) + 'T00:00:00').getTime() - deadline.getTime()) / 86_400_000
            );
            tier = da <= 0 ? 'no_prazo' : da <= 6 ? 'T1' : da <= 14 ? 'T2' : 'T3';
          } else {
            scoreTracking = hoje <= deadline ? 100 : 0;
            scorePrevia   = 0; // aberta = sempre 0 na prévia
            tier = hoje <= deadline ? 'em_aberto_no_prazo' : 'em_aberto_vencido';
          }

          scoresTracking.push(scoreTracking);
          scoresPrevia.push(scorePrevia);
          const itemTracking: IndicadorDetalhe = {
            id: meta.id, nome: meta.descricao, tipo,
            deadline_calculada: deadlineStr, status: meta.status,
            isConcluido, concluido_em: concluidoEm,
            dias_atraso: da, tier, percentual: scoreTracking,
          };
          porIndicadorTracking.push(itemTracking);
          porIndicadorPrevia.push({ ...itemTracking, percentual: scorePrevia });
        }

        const avg = (arr: number[]) => arr.length > 0
          ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

        indicadoresData      = { media: avg(scoresTracking), porIndicador: porIndicadorTracking };
        indicadoresPreviaData = { media: avg(scoresPrevia),   porIndicador: porIndicadorPrevia };
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
      indicadores:         indicadoresData,
      indicadores_previa:  indicadoresPreviaData,
    },
    { onConflict: 'area_id,profile_id,data' },
  );

  if (error) throw error;
}
