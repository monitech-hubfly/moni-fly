import type { SupabaseClient } from '@supabase/supabase-js';
import { faseNomeExibicaoVinculoCard } from '@/lib/kanban/acoplamento-tag-pai';
import { escolherTituloExibicaoCard, montarTituloCardSync } from '@/lib/kanban/card-sync-group';

export type CardProjetoEsteiraRow = {
  id: string;
  titulo: string;
  status: string;
  concluido: boolean;
  arquivado: boolean;
  created_at: string;
  origem_card_id: string | null;
  fase_nome: string;
  fase_slug: string | null;
  sla_dias: number | null;
  kanban_nome: string;
  kanban_id: string;
};

type FaseJoin = {
  nome: string | null;
  slug: string | null;
  sla_dias: number | null;
} | null;

type KanbanJoin = {
  nome: string | null;
  id: string;
} | null;

type RawRow = {
  id: string;
  titulo: string | null;
  status: string | null;
  concluido: boolean | null;
  arquivado: boolean | null;
  created_at: string;
  origem_card_id: string | null;
  rede_franqueado_id?: string | null;
  nome_condominio?: string | null;
  quadra?: string | null;
  lote?: string | null;
  kanban_fases: FaseJoin | FaseJoin[];
  kanbans: KanbanJoin | KanbanJoin[];
};

function unwrapJoin<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** Cards do mesmo `projeto_id`, exceto o card atual (esteiras paralelas). */
export async function fetchCardsProjetoEsteiras(
  supabase: SupabaseClient,
  projetoId: string,
  excludeCardId: string,
): Promise<CardProjetoEsteiraRow[]> {
  const pid = String(projetoId ?? '').trim();
  const exclude = String(excludeCardId ?? '').trim();
  if (!pid || !exclude) return [];

  const { data, error } = await supabase
    .from('kanban_cards')
    .select(
      `
      id,
      titulo,
      status,
      concluido,
      arquivado,
      created_at,
      origem_card_id,
      rede_franqueado_id,
      nome_condominio,
      quadra,
      lote,
      kanban_fases!fase_id ( nome, slug, sla_dias ),
      kanbans!kanban_id ( nome, id )
    `,
    )
    .eq('projeto_id', pid)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[fetchCardsProjetoEsteiras]', error.message);
    throw new Error(error.message);
  }

  const allRows = (data ?? []) as RawRow[];
  const rows = allRows.filter((row) => String(row.id) !== exclude);
  const redeIds = [
    ...new Set(
      allRows.map((r) => String(r.rede_franqueado_id ?? '').trim()).filter(Boolean),
    ),
  ];
  const nFranquiaPorRede = new Map<string, string>();
  if (redeIds.length > 0) {
    const { data: redes } = await supabase
      .from('rede_franqueados')
      .select('id, n_franquia')
      .in('id', redeIds);
    for (const r of redes ?? []) {
      const id = String((r as { id?: string }).id ?? '').trim();
      const num = String((r as { n_franquia?: string | null }).n_franquia ?? '').trim();
      if (id && num) nFranquiaPorRede.set(id, num);
    }
  }

  const camposProjeto = allRows.reduce(
    (acc, row) => ({
      titulo: escolherTituloExibicaoCard(acc.titulo, row.titulo),
      rede_franqueado_id: acc.rede_franqueado_id ?? row.rede_franqueado_id ?? null,
      nome_condominio: acc.nome_condominio ?? row.nome_condominio ?? null,
      quadra: acc.quadra ?? row.quadra ?? null,
      lote: acc.lote ?? row.lote ?? null,
    }),
    {
      titulo: null as string | null,
      rede_franqueado_id: null as string | null,
      nome_condominio: null as string | null,
      quadra: null as string | null,
      lote: null as string | null,
    },
  );
  const redeCanonica = String(camposProjeto.rede_franqueado_id ?? '').trim();
  const tituloCanonicoProjeto = montarTituloCardSync({
    nFranquia: redeCanonica ? nFranquiaPorRede.get(redeCanonica) : null,
    nomeCondominio: camposProjeto.nome_condominio,
    quadra: camposProjeto.quadra,
    lote: camposProjeto.lote,
    tituloFallback: camposProjeto.titulo,
  });

  return rows.map((row) => {
    const fase = unwrapJoin(row.kanban_fases);
    const kanban = unwrapJoin(row.kanbans);
    const tituloRaw = String(row.titulo ?? '').trim();
    const redeId = String(row.rede_franqueado_id ?? '').trim();
    const tituloCalc = montarTituloCardSync({
      nFranquia: redeId ? nFranquiaPorRede.get(redeId) : null,
      nomeCondominio: row.nome_condominio ?? camposProjeto.nome_condominio,
      quadra: row.quadra ?? camposProjeto.quadra,
      lote: row.lote ?? camposProjeto.lote,
      tituloFallback: row.titulo,
    });
    return {
      id: String(row.id),
      titulo:
        escolherTituloExibicaoCard(
          escolherTituloExibicaoCard(tituloRaw, tituloCalc),
          tituloCanonicoProjeto,
        ) || '—',
      status: String(row.status ?? 'ativo'),
      concluido: Boolean(row.concluido),
      arquivado: Boolean(row.arquivado),
      created_at: String(row.created_at ?? ''),
      origem_card_id: row.origem_card_id != null ? String(row.origem_card_id) : null,
      fase_nome: faseNomeExibicaoVinculoCard(fase?.nome, row.arquivado),
      fase_slug: fase?.slug != null ? String(fase.slug) : null,
      sla_dias: fase?.sla_dias != null ? Number(fase.sla_dias) : null,
      kanban_nome: String(kanban?.nome ?? '—'),
      kanban_id: String(kanban?.id ?? ''),
    };
  });
}

export function statusIndicadorCardProjeto(row: Pick<CardProjetoEsteiraRow, 'arquivado' | 'concluido'>): {
  rotulo: 'ativo' | 'concluído' | 'arquivado';
  classe: string;
} {
  if (row.arquivado) {
    return { rotulo: 'arquivado', classe: 'text-stone-500 bg-stone-100 border-stone-200' };
  }
  if (row.concluido) {
    return { rotulo: 'concluído', classe: 'text-emerald-800 bg-emerald-50 border-emerald-200' };
  }
  return { rotulo: 'ativo', classe: 'text-sky-800 bg-sky-50 border-sky-200' };
}

export function agruparCardsProjetoPorKanban(
  rows: CardProjetoEsteiraRow[],
): { kanban_id: string; kanban_nome: string; cards: CardProjetoEsteiraRow[] }[] {
  const map = new Map<string, { kanban_id: string; kanban_nome: string; cards: CardProjetoEsteiraRow[] }>();
  for (const row of rows) {
    const key = row.kanban_id || row.kanban_nome;
    let g = map.get(key);
    if (!g) {
      g = { kanban_id: row.kanban_id, kanban_nome: row.kanban_nome, cards: [] };
      map.set(key, g);
    }
    g.cards.push(row);
  }
  return [...map.values()];
}
