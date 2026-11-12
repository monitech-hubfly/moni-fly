'use server';

import { normalizeAccessRole } from '@/lib/authz';
import { isKanbanIdInterno } from '@/lib/kanban/filtrar-kanbans-internos';
import { fetchFasesNegocioPrazoOpcoes } from '@/lib/kanban/fetch-kanban-fases';
import {
  fetchKanbanCardModalDetalhes,
  type ProcessoModalNegocioPreObra,
} from '@/lib/kanban/kanban-card-modal-detalhes';
import type { FaseNegocioPrazoOpcao } from '@/lib/kanban/dados-negocio-prazo';
import { createClient } from '@/lib/supabase/server';

export type FunilLivroOpcao = { id: string; nome: string };

export type CardFunilLivro = {
  id: string;
  titulo: string;
  nome_condominio: string | null;
  quadra: string | null;
  lote: string | null;
  arquivado: boolean;
};

export type DadosNegocioLivro = {
  processo: ProcessoModalNegocioPreObra | null;
  fases: FaseNegocioPrazoOpcao[];
};

async function exigirStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (role !== 'admin' && role !== 'team') {
    return { ok: false as const, error: 'Sem permissão para consultar os dados do negócio.' };
  }
  return { ok: true as const, supabase };
}

export async function listarCardsDoFunilLivro(
  kanbanId: string,
): Promise<{ ok: true; cards: CardFunilLivro[] } | { ok: false; error: string }> {
  const gate = await exigirStaff();
  if (!gate.ok) return gate;

  const id = String(kanbanId ?? '').trim();
  if (!id || isKanbanIdInterno(id)) return { ok: false, error: 'Funil inválido.' };

  const { data, error } = await gate.supabase
    .from('kanban_cards')
    .select('id, titulo, nome_condominio, quadra, lote, arquivado')
    .eq('kanban_id', id)
    .order('titulo', { ascending: true });

  if (error) return { ok: false, error: error.message };

  const cards: CardFunilLivro[] = (data ?? []).map((row) => {
    const r = row as {
      id: string;
      titulo?: string | null;
      nome_condominio?: string | null;
      quadra?: string | null;
      lote?: string | null;
      arquivado?: boolean | null;
    };
    return {
      id: String(r.id),
      titulo: String(r.titulo ?? '').trim(),
      nome_condominio: String(r.nome_condominio ?? '').trim() || null,
      quadra: String(r.quadra ?? '').trim() || null,
      lote: String(r.lote ?? '').trim() || null,
      arquivado: r.arquivado === true,
    };
  });

  return { ok: true, cards };
}

export async function carregarDadosNegocioLivro(
  cardId: string,
): Promise<{ ok: true; dados: DadosNegocioLivro } | { ok: false; error: string }> {
  const gate = await exigirStaff();
  if (!gate.ok) return gate;

  const id = String(cardId ?? '').trim();
  if (!id) return { ok: false, error: 'Card inválido.' };

  const { data: card, error } = await gate.supabase
    .from('kanban_cards')
    .select('id, titulo, rede_franqueado_id, projeto_id, processo_step_one_id')
    .eq('id', id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!card) return { ok: false, error: 'Card não encontrado.' };

  const row = card as {
    id: string;
    titulo?: string | null;
    rede_franqueado_id?: string | null;
    projeto_id?: string | null;
    processo_step_one_id?: string | null;
  };

  const [detalhes, fases] = await Promise.all([
    fetchKanbanCardModalDetalhes(gate.supabase, {
      origem: 'nativo',
      cardId: row.id,
      cardTitulo: String(row.titulo ?? ''),
      redeFranqueadoId: row.rede_franqueado_id ?? null,
      cardProjetoId: row.projeto_id ?? null,
      cardProcessoStepOneId: row.processo_step_one_id ?? null,
    }),
    fetchFasesNegocioPrazoOpcoes(gate.supabase),
  ]);

  return { ok: true, dados: { processo: detalhes.processo, fases } };
}
