'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSimulacaoUsuario } from '@/components/carometro/todo/SeletorUsuarioAdmin';

const ADMIN_EMAIL = 'danilo.n@moni.casa';

export type KanbanCardItem = {
  id: string;
  titulo: string | null;
  fase_nome: string | null;
  kanban_nome: string | null;
  sla_dias: number | null;
  origem: 'franqueado' | 'atividade' | 'checklist';
};

export function useBacklogKanban(refreshKey = 0) {
  const supabase   = useMemo(() => createClient(), []);
  const [cards,     setCards]     = useState<KanbanCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const { simulacao } = useSimulacaoUsuario();

  const carregar = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const isAdmin = user.email === ADMIN_EMAIL;
      const effectiveProfileId = (isAdmin && simulacao?.profileId)
        ? simulacao.profileId
        : user.id;

      // 3 fontes em paralelo
      const [fonte1, fonte2, fonte3] = await Promise.all([
        supabase
          .from('kanban_cards')
          .select(`
            id, titulo, arquivado, concluido,
            fase:kanban_fases(nome, sla_dias),
            kanban:kanbans(nome),
            rede_franqueado:rede_franqueados(id, user_id)
          `)
          .eq('arquivado', false)
          .eq('concluido', false),

        supabase
          .from('kanban_atividades')
          .select(`
            id, card_id, status,
            card:kanban_cards(
              id, titulo, arquivado, concluido,
              fase:kanban_fases(nome, sla_dias),
              kanban:kanbans(nome)
            )
          `)
          .eq('responsavel_id', effectiveProfileId)
          .neq('status', 'concluido')
          .not('card_id', 'is', null),

        supabase
          .from('kanban_fase_checklist_respostas')
          .select(`
            card_id,
            card:kanban_cards(
              id, titulo, arquivado, concluido,
              fase:kanban_fases(nome, sla_dias),
              kanban:kanbans(nome)
            )
          `)
          .eq('valor', effectiveProfileId),
      ]);

      const mapa = new Map<string, KanbanCardItem>();

      // Processar fonte 1 — filtrar pelo user_id do franqueado
      type FaseRel  = { nome: string; sla_dias: number | null };
      type KanbanRel = { nome: string };
      type CardF1 = {
        id: string; titulo: string | null; arquivado: boolean; concluido: boolean;
        fase: FaseRel | FaseRel[] | null;
        kanban: KanbanRel | KanbanRel[] | null;
        rede_franqueado: { id: string; user_id: string | null } | { id: string; user_id: string | null }[] | null;
      };

      ((fonte1.data ?? []) as unknown as CardF1[]).forEach(card => {
        if (card.arquivado || card.concluido) return;
        const rf     = Array.isArray(card.rede_franqueado) ? card.rede_franqueado[0] : card.rede_franqueado;
        if (rf?.user_id !== effectiveProfileId) return;
        const fase   = Array.isArray(card.fase)   ? card.fase[0]   : card.fase;
        const kanban = Array.isArray(card.kanban) ? card.kanban[0] : card.kanban;
        mapa.set(card.id, {
          id: card.id, titulo: card.titulo,
          fase_nome:   fase?.nome   ?? null,
          kanban_nome: kanban?.nome ?? null,
          sla_dias:    fase?.sla_dias ?? null,
          origem: 'franqueado',
        });
      });

      // Processar fonte 2
      type CardNested = {
        id: string; titulo: string | null; arquivado: boolean; concluido: boolean;
        fase: FaseRel | FaseRel[] | null;
        kanban: KanbanRel | KanbanRel[] | null;
      };
      type CardF2 = {
        id: string; card_id: string; status: string;
        card: CardNested | CardNested[] | null;
      };

      ((fonte2.data ?? []) as unknown as CardF2[]).forEach(atv => {
        const card = Array.isArray(atv.card) ? atv.card[0] : atv.card;
        if (!card || card.arquivado || card.concluido) return;
        const fase   = Array.isArray(card.fase)   ? card.fase[0]   : card.fase;
        const kanban = Array.isArray(card.kanban) ? card.kanban[0] : card.kanban;
        mapa.set(card.id, {
          id: card.id, titulo: card.titulo,
          fase_nome:   fase?.nome   ?? null,
          kanban_nome: kanban?.nome ?? null,
          sla_dias:    fase?.sla_dias ?? null,
          origem: 'atividade',
        });
      });

      // Processar fonte 3 (não sobrescreve fonte 1/2)
      type CardF3 = {
        card_id: string;
        card: CardNested | CardNested[] | null;
      };

      ((fonte3.data ?? []) as unknown as CardF3[]).forEach(row => {
        const card = Array.isArray(row.card) ? row.card[0] : row.card;
        if (!card || card.arquivado || card.concluido || mapa.has(card.id)) return;
        const fase   = Array.isArray(card.fase)   ? card.fase[0]   : card.fase;
        const kanban = Array.isArray(card.kanban) ? card.kanban[0] : card.kanban;
        mapa.set(card.id, {
          id: card.id, titulo: card.titulo,
          fase_nome:   fase?.nome   ?? null,
          kanban_nome: kanban?.nome ?? null,
          sla_dias:    fase?.sla_dias ?? null,
          origem: 'checklist',
        });
      });

      const resultado = Array.from(mapa.values())
        .sort((a, b) => (a.kanban_nome ?? '').localeCompare(b.kanban_nome ?? '', 'pt-BR'));

      setCards(resultado);
    } catch (e) {
      console.error('[useBacklogKanban]', e);
      setError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      setIsLoading(false);
    }
  }, [supabase, simulacao?.profileId, refreshKey]);

  useEffect(() => { carregar(); }, [carregar]);
  return { cards, isLoading, error };
}
