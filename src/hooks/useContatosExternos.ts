/**
 * useContatosExternos
 * Hook para gerenciar a agenda de contatos externos da Agenda.
 * Cada contato pertence ao usuário logado (RLS por profile_id).
 */

import { useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

export type ContatoExterno = {
  id: string;
  email: string;
  nome: string | null;
  empresa: string | null;
  ultimo_uso: string;
};

export function useContatosExternos() {
  const supabase = useMemo(() => createClient(), []);

  /** Busca sugestões por e-mail, nome ou empresa (mínimo 2 chars) */
  async function buscarSugestoes(query: string): Promise<ContatoExterno[]> {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    const { data, error } = await supabase
      .from('agenda_contatos_externos')
      .select('id, email, nome, empresa, ultimo_uso')
      .or(`email.ilike.%${q}%,nome.ilike.%${q}%,empresa.ilike.%${q}%`)
      .order('ultimo_uso', { ascending: false })
      .limit(8);
    if (error) { console.error('[useContatosExternos] buscarSugestoes:', error); return []; }
    return (data ?? []) as ContatoExterno[];
  }

  /** Salva ou atualiza contato (upsert por profile_id + email). Chame ao adicionar e-mail na reunião. */
  async function salvarOuAtualizar(
    email: string,
    nome?: string | null,
    empresa?: string | null,
  ): Promise<void> {
    const emailNorm = email.trim().toLowerCase();
    if (!emailNorm || !emailNorm.includes('@')) return;

    const { error } = await supabase
      .from('agenda_contatos_externos')
      .upsert(
        {
          email: emailNorm,
          nome: nome?.trim() || null,
          empresa: empresa?.trim() || null,
          ultimo_uso: new Date().toISOString(),
        },
        { onConflict: 'profile_id,email', ignoreDuplicates: false },
      );
    if (error) console.error('[useContatosExternos] salvarOuAtualizar:', error);
  }

  /** Edita nome e empresa de um contato já salvo. */
  async function atualizar(
    id: string,
    nome: string | null,
    empresa: string | null,
  ): Promise<void> {
    const { error } = await supabase
      .from('agenda_contatos_externos')
      .update({ nome: nome?.trim() || null, empresa: empresa?.trim() || null })
      .eq('id', id);
    if (error) console.error('[useContatosExternos] atualizar:', error);
  }

  /** Remove contato da agenda do usuário. */
  async function excluir(id: string): Promise<void> {
    const { error } = await supabase
      .from('agenda_contatos_externos')
      .delete()
      .eq('id', id);
    if (error) console.error('[useContatosExternos] excluir:', error);
  }

  return { buscarSugestoes, salvarOuAtualizar, atualizar, excluir };
}
