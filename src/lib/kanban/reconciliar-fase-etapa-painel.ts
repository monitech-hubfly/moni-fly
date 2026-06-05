import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanCardBrief, KanbanFase } from '@/components/kanban-shared/types';
import {
  normalizeStepOneFaseSlug,
  stepOneSlugAliasesForFase,
} from '@/lib/kanban/stepone-fase-slugs';

const PROCESSO_CHUNK = 200;

export type ProcessoEtapaPainelRow = {
  etapa_painel: string;
  ordem_coluna_painel: number;
};

/** Mapa `processo_step_one.id` → etapa/ordem do painel. */
export async function fetchEtapaPainelPorProcessoIds(
  supabase: SupabaseClient,
  processoIds: string[],
): Promise<Map<string, ProcessoEtapaPainelRow>> {
  const out = new Map<string, ProcessoEtapaPainelRow>();
  const ids = [...new Set(processoIds.map((id) => String(id ?? '').trim()).filter(Boolean))];
  if (ids.length === 0) return out;

  for (let i = 0; i < ids.length; i += PROCESSO_CHUNK) {
    const chunk = ids.slice(i, i + PROCESSO_CHUNK);
    const { data, error } = await supabase
      .from('processo_step_one')
      .select('id, etapa_painel, ordem_coluna_painel')
      .in('id', chunk)
      .is('cancelado_em', null)
      .is('removido_em', null);

    if (error) {
      console.error('[fetchEtapaPainelPorProcessoIds]', error.message);
      continue;
    }

    for (const row of data ?? []) {
      const id = String((row as { id?: string }).id ?? '').trim();
      const slug = String((row as { etapa_painel?: string | null }).etapa_painel ?? '').trim();
      if (!id || !slug) continue;
      out.set(id, {
        etapa_painel: slug,
        ordem_coluna_painel: Number(
          (row as { ordem_coluna_painel?: number | null }).ordem_coluna_painel ?? 0,
        ),
      });
    }
  }

  return out;
}

/** `slug` → `fase_id` para o kanban atual (fases já carregadas + slugs extras no banco). */
export async function buildSlugParaFaseIdMap(
  supabase: SupabaseClient,
  kanbanId: string,
  fases: KanbanFase[],
  slugsExtras: Iterable<string>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const f of fases) {
    const slug = String(f.slug ?? '').trim();
    if (slug) {
      map.set(slug, f.id);
      for (const alias of stepOneSlugAliasesForFase(slug)) {
        if (alias !== slug) map.set(alias, f.id);
      }
    }
  }

  const missing = [...new Set([...slugsExtras].map((s) => String(s ?? '').trim()).filter(Boolean))].filter(
    (slug) => !map.has(slug),
  );

  const missingNormalized = [
    ...new Set(
      missing.flatMap((slug) => {
        const aliases = stepOneSlugAliasesForFase(slug);
        return aliases.length > 0 ? aliases : [normalizeStepOneFaseSlug(slug)];
      }),
    ),
  ].filter((slug) => slug && !map.has(slug));

  if (missingNormalized.length === 0) return map;

  const { data, error } = await supabase
    .from('kanban_fases')
    .select('id, slug')
    .eq('kanban_id', kanbanId)
    .eq('ativo', true)
    .in('slug', missingNormalized);

  if (error) {
    console.error('[buildSlugParaFaseIdMap]', error.message);
    return map;
  }

  for (const row of data ?? []) {
    const slug = String((row as { slug?: string | null }).slug ?? '').trim();
    const id = String((row as { id?: string }).id ?? '').trim();
    if (slug && id) {
      map.set(slug, id);
      for (const alias of stepOneSlugAliasesForFase(slug)) {
        if (alias !== slug) map.set(alias, id);
      }
    }
  }

  return map;
}

/**
 * Alinha `fase_id` do card com `processo_step_one.etapa_painel` no kanban atual.
 * Corrige linhas nativas com UUID de outro funil ou `kanban_cards.fase_id` desatualizado.
 */
export function aplicarFasePorEtapaPainel(
  card: KanbanCardBrief,
  etapaPorProcesso: Map<string, ProcessoEtapaPainelRow>,
  slugParaFaseId: Map<string, string>,
): KanbanCardBrief {
  const proc = etapaPorProcesso.get(card.id);
  if (!proc) return card;

  const faseId = slugParaFaseId.get(proc.etapa_painel);
  if (!faseId || faseId === card.fase_id) return card;

  return {
    ...card,
    fase_id: faseId,
    ordem_coluna: proc.ordem_coluna_painel ?? card.ordem_coluna,
  };
}

export function aplicarFasePorEtapaPainelEmLote(
  cards: KanbanCardBrief[],
  etapaPorProcesso: Map<string, ProcessoEtapaPainelRow>,
  slugParaFaseId: Map<string, string>,
): KanbanCardBrief[] {
  if (etapaPorProcesso.size === 0 || slugParaFaseId.size === 0) return cards;
  return cards.map((c) => aplicarFasePorEtapaPainel(c, etapaPorProcesso, slugParaFaseId));
}

/** IDs de processo presentes nos briefs (board + concluídos). */
export function coletarIdsProcessoDosCards(...listas: KanbanCardBrief[][]): string[] {
  return [
    ...new Set(
      listas.flat().map((c) => String(c.id ?? '').trim()).filter(Boolean),
    ),
  ];
}
