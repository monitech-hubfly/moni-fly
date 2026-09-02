import type { SupabaseClient } from '@supabase/supabase-js';
import {
  compareChamadosPainelRank,
  type RankChamadoPainelInput,
} from '@/lib/sirene-painel-chamados-rank';
import type { PastelariaCardView } from '@/lib/pastelaria/api-client';
import type { PastelariaColuna } from '@/lib/pastelaria/types';

export type PastelariaCardRankMeta = {
  frank_id: string | null;
  franqueado_nome: string | null;
  trava: boolean;
  te_trata: boolean;
  data_vencimento: string | null;
  atividade_status: string;
};

function statusKanbanParaRank(status: string | null | undefined): string {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'concluida' || s === 'concluída' || s === 'concluido') return 'concluida';
  if (s === 'em_andamento') return 'em_andamento';
  if (s === 'cancelada') return 'cancelada';
  return 'pendente';
}

function statusSireneParaRank(status: string | null | undefined): string {
  const s = String(status ?? '').trim().toLowerCase();
  if (s === 'concluido') return 'concluida';
  if (s === 'em_andamento' || s === 'aguardando_aprovacao_criador') return 'em_andamento';
  return 'pendente';
}

export function rankInputFromPastelariaCard(
  card: Pick<PastelariaCardView, 'id' | 'coluna' | 'created_at' | 'opened_by'>,
  meta?: PastelariaCardRankMeta | null,
): RankChamadoPainelInput {
  const col = card.coluna as PastelariaColuna;
  const statusFromColuna = col === 'done' ? 'concluida' : null;
  return {
    frank_id: meta?.frank_id ?? null,
    franqueado_nome: meta?.franqueado_nome ?? card.opened_by ?? null,
    trava: meta?.trava ?? false,
    te_trata: meta?.te_trata ?? false,
    data_vencimento: meta?.data_vencimento ?? null,
    atividade_status: statusFromColuna ?? meta?.atividade_status ?? 'pendente',
    criado_em: card.created_at,
  };
}

export function comparePastelariaCards(
  a: Pick<PastelariaCardView, 'id' | 'coluna' | 'created_at' | 'opened_by'>,
  b: Pick<PastelariaCardView, 'id' | 'coluna' | 'created_at' | 'opened_by'>,
  metaByCardId: Map<string, PastelariaCardRankMeta>,
): number {
  return compareChamadosPainelRank(
    rankInputFromPastelariaCard(a, metaByCardId.get(a.id)),
    rankInputFromPastelariaCard(b, metaByCardId.get(b.id)),
  );
}

/** Metadados de priorização (Sirene / kanban) para cards da Pastelaria. */
export async function fetchPastelariaCardsRankMeta(
  supabase: SupabaseClient,
  cards: Array<{ id: string; sirene_chamado_id?: number | null; coluna: string }>,
): Promise<Map<string, PastelariaCardRankMeta>> {
  const out = new Map<string, PastelariaCardRankMeta>();
  const sireneIds = [
    ...new Set(
      cards
        .map((c) => c.sirene_chamado_id)
        .filter((id): id is number => id != null && Number.isFinite(id)),
    ),
  ];

  const sireneById = new Map<
    number,
    {
      frank_id: string | null;
      frank_nome: string | null;
      trava: boolean;
      te_trata: boolean;
      data_vencimento: string | null;
      status: string;
    }
  >();
  const kaBySireneId = new Map<
    number,
    { trava: boolean; data_vencimento: string | null; status: string }
  >();

  if (sireneIds.length > 0) {
    const { data: sireneRows } = await supabase
      .from('sirene_chamados')
      .select('id, frank_id, frank_nome, trava, te_trata, data_vencimento, status')
      .in('id', sireneIds);

    for (const row of sireneRows ?? []) {
      const id = Number((row as { id: number }).id);
      if (!Number.isFinite(id)) continue;
      const dv = (row as { data_vencimento?: string | null }).data_vencimento;
      sireneById.set(id, {
        frank_id: (row as { frank_id?: string | null }).frank_id ?? null,
        frank_nome: (row as { frank_nome?: string | null }).frank_nome ?? null,
        trava: Boolean((row as { trava?: boolean }).trava),
        te_trata: (row as { te_trata?: boolean | null }).te_trata === true,
        data_vencimento: dv != null && String(dv).trim() !== '' ? String(dv).slice(0, 10) : null,
        status: String((row as { status?: string }).status ?? ''),
      });
    }

    const { data: kaRows } = await supabase
      .from('kanban_atividades')
      .select('sirene_chamado_id, trava, data_vencimento, status')
      .in('sirene_chamado_id', sireneIds)
      .eq('origem', 'sirene');

    for (const row of kaRows ?? []) {
      const sid = Number((row as { sirene_chamado_id?: number }).sirene_chamado_id);
      if (!Number.isFinite(sid) || kaBySireneId.has(sid)) continue;
      const dv = (row as { data_vencimento?: string | null }).data_vencimento;
      kaBySireneId.set(sid, {
        trava: Boolean((row as { trava?: boolean }).trava),
        data_vencimento: dv != null && String(dv).trim() !== '' ? String(dv).slice(0, 10) : null,
        status: String((row as { status?: string }).status ?? ''),
      });
    }
  }

  for (const card of cards) {
    const sid = card.sirene_chamado_id;
    const sirene = sid != null && Number.isFinite(sid) ? sireneById.get(sid) : undefined;
    const ka = sid != null && Number.isFinite(sid) ? kaBySireneId.get(sid) : undefined;
    const colDone = card.coluna === 'done';

    out.set(card.id, {
      frank_id: sirene?.frank_id ?? null,
      franqueado_nome: sirene?.frank_nome ?? null,
      trava: Boolean(ka?.trava ?? sirene?.trava),
      te_trata: sirene?.te_trata === true,
      data_vencimento: ka?.data_vencimento ?? sirene?.data_vencimento ?? null,
      atividade_status: colDone
        ? 'concluida'
        : ka
          ? statusKanbanParaRank(ka.status)
          : sirene
            ? statusSireneParaRank(sirene.status)
            : 'pendente',
    });
  }

  return out;
}

export function sortPastelariaCardsByPrioridade<T extends PastelariaCardView>(
  cards: T[],
  metaByCardId: Map<string, PastelariaCardRankMeta>,
): T[] {
  return [...cards].sort((a, b) => comparePastelariaCards(a, b, metaByCardId));
}
