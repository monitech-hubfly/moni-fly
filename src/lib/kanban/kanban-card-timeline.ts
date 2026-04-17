import type { KanbanFase } from '@/components/kanban-shared/types';

export type HistoricoFaseMovimento = {
  acao: string;
  detalhe: Record<string, unknown> | null;
  criado_em: string;
};

export type ProcessoCardMoveEvt = {
  created_at: string;
  detalhes: Record<string, unknown> | null;
};

export type LinhaCronologiaFase = {
  faseId: string;
  faseNome: string;
  ordem: number;
  entrouEm: string | null;
  saiuEm: string | null;
};

type Visit = { faseId: string; entrou: string; saiu: string | null };

function sortedFasesAsc(fases: KanbanFase[]): KanbanFase[] {
  return [...fases].sort((a, b) => a.ordem - b.ordem);
}

function detStr(d: Record<string, unknown> | null, key: string): string {
  if (!d) return '';
  const v = d[key];
  return typeof v === 'string' ? v.trim() : '';
}

function linhasPorVisitas(sortedFases: KanbanFase[], visits: Visit[]): LinhaCronologiaFase[] {
  const byId = new Map(sortedFases.map((f) => [f.id, f]));
  const agg = new Map<string, { firstIn: string | null; lastOut: string | null; open: boolean }>();
  for (const f of sortedFases) {
    agg.set(f.id, { firstIn: null, lastOut: null, open: false });
  }
  for (const v of visits) {
    if (!byId.has(v.faseId)) continue;
    const cur = agg.get(v.faseId)!;
    if (!cur.firstIn || new Date(v.entrou) < new Date(cur.firstIn)) cur.firstIn = v.entrou;
    if (v.saiu === null) cur.open = true;
    else if (!cur.lastOut || new Date(v.saiu) > new Date(cur.lastOut)) cur.lastOut = v.saiu;
  }
  return sortedFases.map((f) => {
    const cur = agg.get(f.id)!;
    return {
      faseId: f.id,
      faseNome: f.nome,
      ordem: f.ordem,
      entrouEm: cur.firstIn,
      saiuEm: cur.open ? null : cur.lastOut,
    };
  });
}

/** Card nativo: histórico `kanban_historico` + `created_at` do card. */
export function buildNativeFaseTimeline(
  fases: KanbanFase[],
  card: { created_at: string; fase_id: string },
  historico: HistoricoFaseMovimento[],
): LinhaCronologiaFase[] {
  const sorted = sortedFasesAsc(fases);
  const byId = new Map(sorted.map((f) => [f.id, f]));
  if (sorted.length === 0) return [];

  const cardCriado = historico.find((h) => h.acao === 'card_criado');
  const faseIdCriado = detStr(cardCriado?.detalhe ?? null, 'fase_id');

  const moves = historico
    .filter((h) => h.acao === 'fase_avancada' || h.acao === 'fase_retrocedida')
    .sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());

  const visits: Visit[] = [];

  let initialPhase =
    (faseIdCriado && byId.has(faseIdCriado) ? faseIdCriado : '') ||
    (moves.length > 0 ? detStr(moves[0].detalhe, 'fase_anterior_id') : '') ||
    card.fase_id;

  if (!initialPhase || !byId.has(initialPhase)) initialPhase = card.fase_id;

  visits.push({ faseId: initialPhase, entrou: card.created_at, saiu: null });

  for (const m of moves) {
    const ant = detStr(m.detalhe, 'fase_anterior_id');
    const nov = detStr(m.detalhe, 'fase_nova_id');
    if (!ant || !nov || !byId.has(ant) || !byId.has(nov)) continue;
    const t = m.criado_em;
    const last = visits[visits.length - 1];
    if (last && last.faseId === ant && last.saiu === null) last.saiu = t;
    visits.push({ faseId: nov, entrou: t, saiu: null });
  }

  return linhasPorVisitas(sorted, visits);
}

/** Card legado: eventos `processo_card_eventos` tipo card_move (slugs em detalhes). */
export function buildLegadoFaseTimeline(
  fases: KanbanFase[],
  card: { created_at: string; fase_id: string; etapa_slug?: string | null },
  moves: ProcessoCardMoveEvt[],
): LinhaCronologiaFase[] {
  const sorted = sortedFasesAsc(fases);
  const byId = new Map(sorted.map((f) => [f.id, f]));
  if (sorted.length === 0) return [];

  const slugToId = new Map<string, string>();
  for (const f of sorted) {
    const s = f.slug?.trim();
    if (s) slugToId.set(s, f.id);
  }

  const movesSorted = [...moves].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const visits: Visit[] = [];

  const initialSlug =
    movesSorted.length > 0
      ? detStr(movesSorted[0].detalhes, 'from')
      : (card.etapa_slug ?? '').trim();

  let initialId = slugToId.get(initialSlug) || card.fase_id;
  if (!byId.has(initialId)) initialId = card.fase_id;

  visits.push({ faseId: initialId, entrou: card.created_at, saiu: null });

  for (const m of movesSorted) {
    const fromSlug = detStr(m.detalhes, 'from');
    const toSlug = detStr(m.detalhes, 'to');
    const ant = slugToId.get(fromSlug) || '';
    const nov = slugToId.get(toSlug) || '';
    if (!ant || !nov || !byId.has(ant) || !byId.has(nov)) continue;
    const t = m.created_at;
    const last = visits[visits.length - 1];
    if (last && last.faseId === ant && last.saiu === null) last.saiu = t;
    visits.push({ faseId: nov, entrou: t, saiu: null });
  }

  return linhasPorVisitas(sorted, visits);
}
