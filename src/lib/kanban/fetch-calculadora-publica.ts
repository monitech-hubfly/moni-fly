import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanFase } from '@/components/kanban-shared/types';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  calcularLinhasCalculadoraFases,
  enriquecerLinhasCalculadoraComCusto,
  enriquecerLinhasCalculadoraComResponsavelDaFase,
  type CalculadoraFaseLinha,
} from '@/lib/kanban/calculadora-fases';
import type { CalculadoraMarcosInput } from '@/lib/kanban/calculadora-fases-marcos';
import {
  CALCULADORA_ESTEIRA_KANBAN_IDS,
  calcularLinhasCalculadoraFasesEsteira,
  fetchCalculadoraEsteiraFasesMap,
  mesclarFasesKanbanAtualNoMapa,
  montarFasesFlatCalculadoraVisitas,
} from '@/lib/kanban/calculadora-fases-esteira';
import { fetchKanbanFasesAtivas } from '@/lib/kanban/fetch-kanban-fases';
import { loadHistoricoCardModal } from '@/lib/kanban/kanban-card-historico';
import { buildNativeFaseVisits } from '@/lib/kanban/kanban-card-timeline';
import { filterOperacoesCalculadoraFases } from '@/lib/kanban/operacoes-fase-slugs';
import { buscarResponsavelDaFaseSalvoPorFases } from '@/lib/kanban/responsavel-fase-checklist';
import { filterStepOneCalculadoraFases } from '@/lib/kanban/stepone-fase-slugs';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type CalculadoraPublicaCard = {
  id: string;
  titulo: string;
  kanban_id: string;
  fase_id: string;
  created_at: string;
  entered_fase_at: string | null;
  concluido: boolean;
  concluido_em: string | null;
  contrato_assinado_em: string | null;
  obra_finalizada_em: string | null;
};

export type CalculadoraPublicaPack = {
  card: CalculadoraPublicaCard;
  linhas: CalculadoraFaseLinha[];
  fasesFlat: KanbanFase[];
  fasesMeta: Map<string, KanbanFase>;
  marcos: CalculadoraMarcosInput;
};

/** Resolve card_id via RPC pública (anon). */
export async function resolveCalculadoraCardIdByToken(token: string): Promise<string | null> {
  const trimmed = String(token ?? '').trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_card_id_by_calculadora_token', {
    p_token: trimmed,
  });

  if (error) {
    console.error('[resolveCalculadoraCardIdByToken]', error.message);
    return null;
  }

  const id = String(data ?? '').trim();
  return id || null;
}

function buildSlugPorFaseId(fases: KanbanFase[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of fases) {
    const slug = String(f.slug ?? '').trim();
    if (slug) map.set(f.id, slug);
  }
  return map;
}

async function montarCalculadoraPack(
  supabase: SupabaseClient,
  card: CalculadoraPublicaCard,
): Promise<CalculadoraPublicaPack | null> {
  const kanbanId = String(card.kanban_id ?? '').trim();
  if (!kanbanId) return null;

  const [fasesEsteiraMap, fasesKanban, historico] = await Promise.all([
    fetchCalculadoraEsteiraFasesMap(supabase),
    fetchKanbanFasesAtivas(supabase, kanbanId),
    loadHistoricoCardModal(supabase, card.id, 'nativo', [], kanbanId),
  ]);

  const fasesMap = mesclarFasesKanbanAtualNoMapa(fasesEsteiraMap, kanbanId, fasesKanban);
  const fasesParaVisitas = montarFasesFlatCalculadoraVisitas(fasesMap, fasesKanban, kanbanId);

  const historicoMovs = historico.map((h) => ({
    acao: h.acao,
    detalhe: h.detalhe,
    criado_em: h.criado_em,
  }));

  const visits = buildNativeFaseVisits(
    fasesParaVisitas,
    { created_at: card.created_at, fase_id: card.fase_id },
    historicoMovs,
  );

  const cardFaseSlug =
    fasesKanban.find((f) => f.id === card.fase_id)?.slug ?? null;

  const linhasEsteira = calcularLinhasCalculadoraFasesEsteira({
    fasesPorKanban: fasesMap,
    cardKanbanId: kanbanId,
    cardFaseSlug,
    card: {
      fase_id: card.fase_id,
      created_at: card.created_at,
      entered_fase_at: card.entered_fase_at,
      concluido: card.concluido,
      concluido_em: card.concluido_em,
    },
    visits,
  });

  let linhas = linhasEsteira;

  if (linhas.length === 0 && fasesKanban.length > 0) {
    const fasesCalculadora =
      kanbanId === KANBAN_IDS.STEP_ONE
        ? filterStepOneCalculadoraFases(fasesKanban)
        : kanbanId === KANBAN_IDS.OPERACOES
          ? filterOperacoesCalculadoraFases(fasesKanban)
          : fasesKanban;

    linhas = calcularLinhasCalculadoraFases({
      fases: fasesCalculadora,
      card: {
        fase_id: card.fase_id,
        created_at: card.created_at,
        entered_fase_at: card.entered_fase_at,
        concluido: card.concluido,
        concluido_em: card.concluido_em,
      },
      visits,
    });
  }

  const fasesFlat: KanbanFase[] = [];
  for (const kid of CALCULADORA_ESTEIRA_KANBAN_IDS) {
    fasesFlat.push(...(fasesMap.get(kid) ?? []));
  }
  const fasesFlatFinal =
    fasesFlat.length > 0
      ? fasesFlat
      : kanbanId === KANBAN_IDS.STEP_ONE
        ? filterStepOneCalculadoraFases(fasesKanban)
        : kanbanId === KANBAN_IDS.OPERACOES
          ? filterOperacoesCalculadoraFases(fasesKanban)
          : fasesKanban;

  const fasesMeta = new Map<string, KanbanFase>();
  for (const f of fasesFlatFinal) fasesMeta.set(f.id, f);
  for (const f of fasesKanban) fasesMeta.set(f.id, f);

  const slugPorFaseId = buildSlugPorFaseId(Array.from(fasesMeta.values()));
  const faseIds = linhas.map((l: CalculadoraFaseLinha) => l.faseId).filter(Boolean);
  const salvoPorFase = await buscarResponsavelDaFaseSalvoPorFases(supabase, card.id, faseIds);

  const linhasEnriquecidas = enriquecerLinhasCalculadoraComCusto(
    enriquecerLinhasCalculadoraComResponsavelDaFase(linhas, slugPorFaseId, salvoPorFase),
    slugPorFaseId,
  );

  return {
    card,
    linhas: linhasEnriquecidas,
    fasesFlat: fasesFlatFinal,
    fasesMeta,
    marcos: {
      contrato_assinado_em: card.contrato_assinado_em,
      obra_finalizada_em: card.obra_finalizada_em,
      concluido_em: card.concluido_em,
      visits,
    },
  };
}

/** Carrega calculadora pública após validar token (service role para dados do card). */
export async function fetchCalculadoraPublicaByToken(
  token: string,
): Promise<CalculadoraPublicaPack | null> {
  const cardId = await resolveCalculadoraCardIdByToken(token);
  if (!cardId) return null;

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    console.error('[fetchCalculadoraPublicaByToken] admin client', e);
    return null;
  }

  const { data: row, error } = await admin
    .from('kanban_cards')
    .select(
      'id, titulo, kanban_id, fase_id, created_at, entered_fase_at, concluido, concluido_em, contrato_assinado_em, obra_finalizada_em, status',
    )
    .eq('id', cardId)
    .eq('status', 'ativo')
    .maybeSingle();

  if (error || !row) {
    if (error) console.error('[fetchCalculadoraPublicaByToken]', error.message);
    return null;
  }

  const card: CalculadoraPublicaCard = {
    id: String(row.id),
    titulo: String(row.titulo ?? '').trim() || '(sem título)',
    kanban_id: String(row.kanban_id ?? ''),
    fase_id: String(row.fase_id ?? ''),
    created_at: String(row.created_at ?? ''),
    entered_fase_at: row.entered_fase_at != null ? String(row.entered_fase_at) : null,
    concluido: Boolean(row.concluido),
    concluido_em: row.concluido_em != null ? String(row.concluido_em) : null,
    contrato_assinado_em:
      row.contrato_assinado_em != null ? String(row.contrato_assinado_em) : null,
    obra_finalizada_em:
      row.obra_finalizada_em != null ? String(row.obra_finalizada_em) : null,
  };

  return montarCalculadoraPack(admin, card);
}
