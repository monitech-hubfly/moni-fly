import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { KANBAN_NOME_FUNIL_LOTEADORES } from '@/lib/kanban/funil-loteadores';
import type { SupabaseClient } from '@supabase/supabase-js';

type LoteadoresTituloDb = Pick<SupabaseClient, 'from'>;
type TituloLoteadorParams = {
  nomeLoteador?: string | null;
  contatoNome?: string | null;
  nomeCondominio?: string | null;
  tituloFallback?: string | null;
};

/** Título do card: Nome do Loteador — Contato — Condomínio (dados do cadastro). */
export function montarTituloCardLoteadores(params: TituloLoteadorParams): string | null {
  const partes = [
    String(params.nomeLoteador ?? '').trim(),
    String(params.contatoNome ?? '').trim(),
    String(params.nomeCondominio ?? '').trim(),
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
  contato_nome?: string | null;
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

  // Sem cadastro de loteador vinculado: mantém o título/subtítulo atuais do card.
  const redeLoteadorId = String(cardRow.rede_loteador_id ?? '').trim();
  if (!redeLoteadorId) return { ok: true };

  const { data: rl, error: rlErr } = await db
    .from('rede_loteadores')
    .select('nome, contato_nome, interlocutor_nome, condominio_nome')
    .eq('id', redeLoteadorId)
    .maybeSingle();
  if (rlErr) return { ok: false, error: rlErr.message };
  if (!rl) return { ok: true };

  const rlRow = rl as RedeLoteadorTituloRow;
  const nomeLoteador = coalesceTexto(rlRow.nome);
  // Cadastro ainda sem nome preenchido: preserva o título atual.
  if (!nomeLoteador) return { ok: true };

  let nomeCondominioCard = coalesceTexto(
    rlRow.condominio_nome,
    overrides?.nomeCondominio,
    cardRow.nome_condominio,
  );
  if (!nomeCondominioCard) {
    const condominioId = String(cardRow.condominio_id ?? '').trim();
    if (condominioId) {
      const { data: cond } = await db.from('condominios').select('nome').eq('id', condominioId).maybeSingle();
      nomeCondominioCard = coalesceTexto((cond as { nome?: string | null } | null)?.nome);
    }
  }

  const titulo = montarTituloCardLoteadores({
    nomeLoteador,
    contatoNome: rlRow.contato_nome,
    nomeCondominio: nomeCondominioCard,
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
