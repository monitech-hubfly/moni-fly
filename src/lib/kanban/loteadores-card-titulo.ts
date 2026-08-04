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

/** Extrai o condomínio/projeto do título quando ainda não está em `nome_condominio`. */
function extrairCondominioDoTituloLoteador(
  titulo: string | null | undefined,
  nomeLoteador: string | null | undefined,
  contatoNome: string | null | undefined,
): string | null {
  const parts = String(titulo ?? '')
    .trim()
    .split(/\s*[-–—]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return null;

  const loteador = String(nomeLoteador ?? '').trim();
  const contato = String(contatoNome ?? '').trim();
  let idx = 0;
  if (loteador && parts[0]?.toLowerCase() === loteador.toLowerCase()) idx = 1;
  if (contato && parts[idx]?.toLowerCase() === contato.toLowerCase()) idx += 1;
  if (idx >= parts.length) return null;
  return parts.slice(idx).join(' - ') || null;
}

/** Condomínio do card: dados do card > título > cadastro do loteador (mesmo loteador, projetos distintos). */
export function resolverNomeCondominioCardLoteadores(input: {
  nomeCondominioCard?: string | null;
  condominioNomeTabela?: string | null;
  nomeCondominioCadastro?: string | null;
  tituloCard?: string | null;
  nomeLoteador?: string | null;
  contatoNome?: string | null;
  override?: string | null;
}): string | null {
  const fromOverride = coalesceTexto(input.override);
  if (fromOverride) return fromOverride;

  const fromCard = coalesceTexto(input.nomeCondominioCard);
  if (fromCard) return fromCard;

  const fromCondTable = coalesceTexto(input.condominioNomeTabela);
  if (fromCondTable) return fromCondTable;

  const parsed = extrairCondominioDoTituloLoteador(
    input.tituloCard,
    input.nomeLoteador,
    input.contatoNome,
  );
  if (parsed) return parsed;

  return coalesceTexto(input.nomeCondominioCadastro);
}

/** Título de exibição/persistência — card e título manual têm prioridade sobre o cadastro compartilhado. */
export function tituloExibicaoCardLoteadores(
  card: { titulo?: string | null; nome_condominio?: string | null },
  rl: RedeLoteadorTituloRow | null | undefined,
  options?: { nomeCondominioExtra?: string | null; condominioNomeTabela?: string | null },
): string | null {
  const nomeLoteador = coalesceTexto(rl?.nome);
  if (!nomeLoteador) return coalesceTexto(card.titulo);

  const nomeCondominio = resolverNomeCondominioCardLoteadores({
    nomeCondominioCard: card.nome_condominio,
    condominioNomeTabela: options?.condominioNomeTabela,
    nomeCondominioCadastro: rl?.condominio_nome,
    tituloCard: card.titulo,
    nomeLoteador,
    contatoNome: rl?.contato_nome,
    override: options?.nomeCondominioExtra,
  });

  return montarTituloCardLoteadores({
    nomeLoteador,
    contatoNome: rl?.contato_nome,
    nomeCondominio,
    tituloFallback: card.titulo,
  });
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

  let condominioNomeTabela: string | null = null;
  const condominioId = String(cardRow.condominio_id ?? '').trim();
  if (condominioId) {
    const { data: cond } = await db.from('condominios').select('nome').eq('id', condominioId).maybeSingle();
    condominioNomeTabela = coalesceTexto((cond as { nome?: string | null } | null)?.nome);
  }

  const titulo = tituloExibicaoCardLoteadores(cardRow, rlRow, {
    nomeCondominioExtra: overrides?.nomeCondominio,
    condominioNomeTabela,
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
