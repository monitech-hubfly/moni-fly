import type { FaseChecklistItem, FaseChecklistResposta } from '@/lib/actions/card-actions';
import { fetchFaseChecklistItens } from '@/lib/kanban/fase-checklist-select';
import { createClient } from '@/lib/supabase/client';

export type CargaChecklistFase = {
  itens: FaseChecklistItem[];
  respostas: FaseChecklistResposta[];
  compartilhado: { chave: string; valor: unknown }[];
  error: string | null;
};

const emVoo = new Map<string, Promise<CargaChecklistFase>>();

const COLUNAS_RESPOSTA = 'id, item_id, card_id, valor, arquivo_path, preenchido_por, preenchido_em';

async function buscarChecklistFase(cardId: string, faseId: string): Promise<CargaChecklistFase> {
  const supabase = createClient();
  const [itens, respostas, compartilhado] = await Promise.all([
    fetchFaseChecklistItens(supabase, faseId),
    supabase.from('kanban_fase_checklist_respostas').select(COLUNAS_RESPOSTA).eq('card_id', cardId),
    supabase.from('kanban_card_checklist_compartilhado').select('chave, valor').eq('card_id', cardId),
  ]);

  if (itens.error || respostas.error || compartilhado.error) {
    return {
      itens: [],
      respostas: [],
      compartilhado: [],
      error: itens.error || respostas.error?.message || compartilhado.error?.message || 'Não foi possível carregar o checklist.',
    };
  }

  return {
    itens: itens.data,
    respostas: (respostas.data ?? []) as FaseChecklistResposta[],
    compartilhado: (compartilhado.data ?? []) as { chave: string; valor: unknown }[],
    error: null,
  };
}

/** Uma leitura por card e fase. O modal dispara antes do componente pesado montar. */
export function prefetchChecklistFase(cardId: string, faseId: string): Promise<CargaChecklistFase> {
  const idCard = cardId.trim();
  const idFase = faseId.trim();
  const chave = `${idCard}:${idFase}`;
  const atual = emVoo.get(chave);
  if (atual) return atual;
  const promessa = buscarChecklistFase(idCard, idFase);
  emVoo.set(chave, promessa);
  void promessa.finally(() => {
    window.setTimeout(() => {
      if (emVoo.get(chave) === promessa) emVoo.delete(chave);
    }, 15000);
  });
  return promessa;
}
