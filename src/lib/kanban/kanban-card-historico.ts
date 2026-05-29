import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanFase } from '@/components/kanban-shared/types';
import type { HistoricoItem } from '@/components/kanban-shared/kanban-card-modal-helpers';
import { fetchKanbanFasesAtivas } from '@/lib/kanban/fetch-kanban-fases';

type ProcessoEventoRow = {
  id: string;
  autor_nome: string | null;
  tipo: string;
  descricao: string | null;
  created_at: string;
  detalhes: Record<string, unknown> | null;
};

function detStr(d: Record<string, unknown> | null | undefined, key: string): string {
  if (!d) return '';
  const v = d[key];
  return typeof v === 'string' ? v.trim() : '';
}

function mapCardMoveLegado(evt: ProcessoEventoRow, fases: KanbanFase[]): HistoricoItem {
  const fromSlug = detStr(evt.detalhes, 'from');
  const toSlug = detStr(evt.detalhes, 'to');
  const fromFase = fases.find((f) => f.slug?.trim() === fromSlug);
  const toFase = fases.find((f) => f.slug?.trim() === toSlug);
  const ordemFrom = fromFase?.ordem ?? 0;
  const ordemTo = toFase?.ordem ?? 0;
  const retro = fromFase && toFase ? ordemTo < ordemFrom : false;
  return {
    id: `proc-evt-${evt.id}`,
    acao: retro ? 'fase_retrocedida' : 'fase_avancada',
    usuario_nome: evt.autor_nome?.trim() || null,
    detalhe: {
      fase_anterior_nome: fromFase?.nome ?? fromSlug,
      fase_nova_nome: toFase?.nome ?? toSlug,
      from_slug: fromSlug,
      to_slug: toSlug,
    },
    criado_em: evt.created_at,
  };
}

function mapProcessoEventoGenerico(evt: ProcessoEventoRow): HistoricoItem {
  const desc = (evt.descricao ?? '').trim() || evt.tipo.replace(/_/g, ' ');
  return {
    id: `proc-evt-${evt.id}`,
    acao: 'campo_alterado',
    usuario_nome: evt.autor_nome?.trim() || null,
    detalhe: {
      descricao: desc,
      tipo_evento: evt.tipo,
      ...(evt.detalhes ?? {}),
    },
    criado_em: evt.created_at,
  };
}

/** Carrega histórico unificado do modal (nativo + legado). */
export async function loadHistoricoCardModal(
  supabase: SupabaseClient,
  cardId: string,
  origem: 'legado' | 'nativo',
  fases: KanbanFase[],
  kanbanId?: string,
): Promise<HistoricoItem[]> {
  let fasesResolved = fases;
  if (fasesResolved.length === 0 && kanbanId) {
    fasesResolved = await fetchKanbanFasesAtivas(supabase, kanbanId);
  }

  const merged: HistoricoItem[] = [];

  const { data: histRows, error: histErr } = await supabase
    .from('kanban_historico')
    .select('id, acao, usuario_nome, detalhe, criado_em')
    .eq('card_id', cardId);

  if (!histErr && histRows?.length) {
    for (const h of histRows) {
      merged.push({
        id: String(h.id),
        acao: String(h.acao),
        usuario_nome: (h.usuario_nome as string | null) ?? null,
        detalhe: (h.detalhe as Record<string, unknown> | null) ?? null,
        criado_em: String(h.criado_em),
      });
    }
  }

  if (origem === 'legado') {
    const { data: evRows } = await supabase
      .from('processo_card_eventos')
      .select('id, autor_nome, tipo, descricao, created_at, detalhes')
      .eq('processo_id', cardId);

    for (const raw of evRows ?? []) {
      const evt = raw as ProcessoEventoRow;
      const tipo = String(evt.tipo ?? '').trim();
      if (tipo === 'card_move') {
        merged.push(mapCardMoveLegado(evt, fasesResolved));
      } else if (tipo && tipo !== 'comentario_add') {
        merged.push(mapProcessoEventoGenerico(evt));
      }
    }
  }

  const seen = new Set<string>();
  const unique: HistoricoItem[] = [];
  for (const item of merged) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    unique.push(item);
  }

  unique.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
  return unique;
}
