import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { KANBAN_NOME_FUNIL_LOTEADORES } from '@/lib/kanban/funil-loteadores';
import type { SupabaseClient } from '@supabase/supabase-js';

type LoteadoresTituloDb = Pick<SupabaseClient, 'from'>;
type TituloLoteadorParams = {
  nomeLoteador?: string | null;
  nomeCondominio?: string | null;
  quadra?: string | null;
  lote?: string | null;
  tituloFallback?: string | null;
};

/** Título do card: Nome do Loteador — Condomínio — Quadra — Lote. */
export function montarTituloCardLoteadores(params: TituloLoteadorParams): string | null {
  const partes = [
    String(params.nomeLoteador ?? '').trim(),
    String(params.nomeCondominio ?? '').trim(),
    String(params.quadra ?? '').trim(),
    String(params.lote ?? '').trim(),
  ].filter(Boolean);
  if (partes.length > 0) return partes.join(' - ');
  const fb = String(params.tituloFallback ?? '').trim();
  return fb || null;
}

/** Subtítulo do card no board: interlocutor da negociação. */
export function subtituloCardLoteadores(interlocutorNome?: string | null): string | null {
  const s = String(interlocutorNome ?? '').trim();
  return s || null;
}

export function isKanbanFunilLoteadoresRef(
  kanbanId: string | null | undefined,
  kanbanNome?: string | null,
): boolean {
  const kid = String(kanbanId ?? '').trim();
  const nome = String(kanbanNome ?? '').trim();
  return kid === KANBAN_IDS.LOTEADORES || nome === KANBAN_NOME_FUNIL_LOTEADORES;
}

type CardTituloRow = {
  kanban_id?: string | null;
  titulo?: string | null;
  nome_condominio?: string | null;
  condominio_id?: string | null;
  quadra?: string | null;
  lote?: string | null;
  rede_loteador_id?: string | null;
};

type TituloLoteadorOverrides = {
  nomeCondominio?: string | null;
  quadra?: string | null;
  lote?: string | null;
};

type RedeLoteadorTituloRow = {
  nome?: string | null;
  interlocutor_nome?: string | null;
  condominio_nome?: string | null;
};

function coalesceTexto(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return null;
}

/** Persiste `titulo` no card quando o kanban é Funil Loteadores. */
export async function sincronizarTituloCardLoteadores(
  db: LoteadoresTituloDb,
  cardId: string,
  overrides?: TituloLoteadorOverrides,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const { data: card, error: cardErr } = await db
    .from('kanban_cards')
    .select('id, kanban_id, titulo, nome_condominio, condominio_id, quadra, lote, rede_loteador_id')
    .eq('id', cid)
    .maybeSingle();
  if (cardErr) return { ok: false, error: cardErr.message };
  if (!card) return { ok: false, error: 'Card não encontrado.' };

  const cardRow = card as CardTituloRow;
  const kanbanId = String(cardRow.kanban_id ?? '').trim();
  if (!isKanbanFunilLoteadoresRef(kanbanId)) return { ok: true };

  const redeLoteadorId = String(cardRow.rede_loteador_id ?? '').trim();
  let nomeLoteador: string | null = null;
  let condominioLoteador: string | null = null;

  if (redeLoteadorId) {
    const { data: rl, error: rlErr } = await db
      .from('rede_loteadores')
      .select('nome, interlocutor_nome, condominio_nome')
      .eq('id', redeLoteadorId)
      .maybeSingle();
    if (rlErr) return { ok: false, error: rlErr.message };
    if (rl) {
      const rlRow = rl as RedeLoteadorTituloRow;
      nomeLoteador = coalesceTexto(rlRow.nome);
      condominioLoteador = coalesceTexto(rlRow.condominio_nome);
    }
  }

  if (!nomeLoteador) {
    const tituloAtual = String(cardRow.titulo ?? '').trim();
    nomeLoteador = tituloAtual.split(' - ')[0]?.trim() || tituloAtual || null;
  }

  let nomeCondominioCard = coalesceTexto(overrides?.nomeCondominio, cardRow.nome_condominio, condominioLoteador);
  if (!nomeCondominioCard) {
    const condominioId = String(cardRow.condominio_id ?? '').trim();
    if (condominioId) {
      const { data: cond } = await db.from('condominios').select('nome').eq('id', condominioId).maybeSingle();
      nomeCondominioCard = coalesceTexto((cond as { nome?: string | null } | null)?.nome);
    }
  }

  const titulo = montarTituloCardLoteadores({
    nomeLoteador,
    nomeCondominio: nomeCondominioCard,
    quadra: coalesceTexto(overrides?.quadra, cardRow.quadra),
    lote: coalesceTexto(overrides?.lote, cardRow.lote),
    tituloFallback: cardRow.titulo,
  });
  if (!titulo) return { ok: true };

  const { error: updErr } = await db
    .from('kanban_cards')
    .update({
      titulo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cid);
  if (updErr) return { ok: false, error: updErr.message };

  return { ok: true };
}
