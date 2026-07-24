'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSimulacaoUsuario } from '@/components/carometro/todo/SeletorUsuarioAdmin';
import { calcularSlaKanbanCard, type SlaKanbanResult } from '@/lib/kanban/kanban-card-sla';

const ADMIN_EMAIL  = 'danilo.n@moni.casa';
const INGRID_EMAIL = 'ingrid.hora@moni.casa';

export type PrioridadeGrupo = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';

export type KanbanCardItem = {
  id: string;
  titulo: string | null;
  fase_nome: string | null;
  kanban_nome: string | null;
  sla_dias: number | null;
  sla: SlaKanbanResult | null;
  origem: 'franqueado' | 'atividade' | 'checklist' | 'proxima_atividade' | 'sem_atividade';
  proxima_atividade?: string | null;
  prazo_atividade?: string | null;
  especial?: boolean;
  prioridade?: PrioridadeGrupo | null;
};

type FaseRelSla = { nome: string; sla_dias: number | null; sla_tipo: string | null; slug: string | null };

function computeSla(
  card: { created_at: string; entered_fase_at?: string | null; sla_iniciado_em?: string | null },
  fase: FaseRelSla | null,
): SlaKanbanResult | null {
  if (!card.created_at) return null;
  return calcularSlaKanbanCard({
    created_at: card.created_at,
    entered_fase_at: card.entered_fase_at,
    sla_iniciado_em: card.sla_iniciado_em,
    sla_dias: fase?.sla_dias ?? null,
    sla_tipo: fase?.sla_tipo ?? null,
    faseSlug: fase?.slug ?? null,
  });
}

const RANK: Record<PrioridadeGrupo, number> = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5, P6: 6 };

function atividadeBucket(c: KanbanCardItem, hojeIso: string): 'nao_preenchida' | 'atrasada' | 'futuro' {
  if (!c.proxima_atividade) return 'nao_preenchida';
  if (c.prazo_atividade && c.prazo_atividade < hojeIso) return 'atrasada';
  return 'futuro';
}

function calcPrioridade(c: KanbanCardItem, hojeIso: string): PrioridadeGrupo {
  const slaAt = c.sla?.status === 'atrasado';
  const bucket = atividadeBucket(c, hojeIso);
  if (slaAt  && bucket === 'nao_preenchida') return 'P1';
  if (!slaAt && bucket === 'nao_preenchida') return 'P2';
  if (slaAt  && bucket === 'atrasada')       return 'P3';
  if (slaAt  && bucket === 'futuro')         return 'P4';
  if (!slaAt && bucket === 'atrasada')       return 'P5';
  return 'P6';
}

export function useBacklogKanban(refreshKey = 0) {
  const supabase   = useMemo(() => createClient(), []);
  const [cards,        setCards]        = useState<KanbanCardItem[]>([]);
  const [sndCards,     setSndCards]     = useState<KanbanCardItem[]>([]);
  const [orphanCards,  setOrphanCards]  = useState<KanbanCardItem[]>([]);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const callIdRef = useRef(0);
  const { simulacao } = useSimulacaoUsuario();
  const simProfileId = simulacao?.profileId ?? null;
  const simAreaId    = simulacao?.areaId    ?? null;
  const simNome      = simulacao?.nomeUsuario ?? null;

  const carregar = useCallback(async () => {
    const callId = ++callIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const isAdmin = user.email === ADMIN_EMAIL;
      const effectiveProfileId = (isAdmin && simProfileId)
        ? simProfileId
        : user.id;

      // 6 fontes + tag Especial em paralelo
      const [fonte1, fonte2, fonte3, fonte4, fonte5, fonte6, tagEspecialRes] = await Promise.all([
        supabase
          .from('kanban_cards')
          .select(`
            id, titulo, arquivado, concluido,
            created_at, entered_fase_at, sla_iniciado_em,
            proxima_atividade, prazo_atividade,
            fase:kanban_fases(nome, sla_dias, sla_tipo, slug),
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
              created_at, entered_fase_at, sla_iniciado_em,
              proxima_atividade, prazo_atividade,
              fase:kanban_fases(nome, sla_dias, sla_tipo, slug),
              kanban:kanbans(nome)
            )
          `)
          .or(`responsavel_id.eq.${effectiveProfileId},responsaveis_ids.cs.{${effectiveProfileId}}`)
          .neq('status', 'concluido')
          .not('card_id', 'is', null),

        supabase
          .from('kanban_fase_checklist_respostas')
          .select(`
            card_id,
            card:kanban_cards(
              id, titulo, arquivado, concluido,
              created_at, entered_fase_at, sla_iniciado_em,
              proxima_atividade, prazo_atividade,
              fase:kanban_fases(nome, sla_dias, sla_tipo, slug),
              kanban:kanbans(nome)
            )
          `)
          .eq('valor', effectiveProfileId),

        // Fonte 4: cards com próx. atividade onde o usuário é responsável explícito
        // OU é dono (franqueado_id) sem responsável atribuído (card sem dono operacional)
        supabase
          .from('kanban_cards')
          .select(`
            id, titulo, arquivado, concluido,
            created_at, entered_fase_at, sla_iniciado_em,
            proxima_atividade, prazo_atividade,
            fase:kanban_fases(nome, sla_dias, sla_tipo, slug),
            kanban:kanbans(nome)
          `)
          .or(`responsavel_id.eq.${effectiveProfileId},responsaveis_ids.cs.{${effectiveProfileId}}`)
          .not('proxima_atividade', 'is', null)
          .eq('arquivado', false)
          .eq('concluido', false),

        // Fonte 5: cards sem próx. atividade — mesma lógica
        supabase
          .from('kanban_cards')
          .select(`
            id, titulo, arquivado, concluido,
            created_at, entered_fase_at, sla_iniciado_em,
            proxima_atividade, prazo_atividade,
            fase:kanban_fases(nome, sla_dias, sla_tipo, slug),
            kanban:kanbans(nome)
          `)
          .or(`responsavel_id.eq.${effectiveProfileId},responsaveis_ids.cs.{${effectiveProfileId}}`)
          .is('proxima_atividade', null)
          .eq('arquivado', false)
          .eq('concluido', false),

        // Fonte 6: cards com próximas atividades criadas pelo usuário (ainda abertas)
        (supabase as any)
          .from('kanban_proximas_atividades')
          .select(`
            card_id,
            card:kanban_cards(
              id, titulo, arquivado, concluido,
              created_at, entered_fase_at, sla_iniciado_em,
              proxima_atividade, prazo_atividade,
              fase:kanban_fases(nome, sla_dias, sla_tipo, slug),
              kanban:kanbans(nome)
            )
          `)
          .eq('criado_por', effectiveProfileId)
          .is('concluido_em', null),

        supabase
          .from('kanban_tags')
          .select('id')
          .eq('nome', '⭐Especial'),
      ]);

      // Busca cards da tag Especial usando todos os IDs encontrados (cada kanban tem a sua)
      const especialSet = new Set<string>();
      const tagIds = ((tagEspecialRes.data ?? []) as Array<{ id: string }>).map(r => r.id);
      if (tagIds.length > 0) {
        const { data: cardTagRows } = await supabase
          .from('kanban_card_tags')
          .select('card_id')
          .in('tag_id', tagIds);
        ((cardTagRows ?? []) as Array<{ card_id: string }>).forEach(r => especialSet.add(r.card_id));
      }

      const mapa = new Map<string, KanbanCardItem>();

      // Processar fonte 1 — filtrar pelo user_id do franqueado
      type FaseRel  = FaseRelSla;
      type KanbanRel = { nome: string };
      type CardBase = {
        id: string; titulo: string | null; arquivado: boolean; concluido: boolean;
        created_at: string; entered_fase_at: string | null; sla_iniciado_em: string | null;
        proxima_atividade: string | null;
        prazo_atividade: string | null;
        fase: FaseRel | FaseRel[] | null;
        kanban: KanbanRel | KanbanRel[] | null;
      };
      type CardF1 = CardBase & {
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
          fase_nome:         fase?.nome   ?? null,
          kanban_nome:       kanban?.nome ?? null,
          sla_dias:          fase?.sla_dias ?? null,
          sla:               computeSla(card, fase ?? null),
          origem:            'franqueado',
          proxima_atividade: card.proxima_atividade,
          prazo_atividade:   card.prazo_atividade,
          especial:          especialSet.has(card.id),
        });
      });

      // Processar fonte 2
      type CardNested = CardBase;
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
          fase_nome:         fase?.nome   ?? null,
          kanban_nome:       kanban?.nome ?? null,
          sla_dias:          fase?.sla_dias ?? null,
          sla:               computeSla(card, fase ?? null),
          origem:            'atividade',
          proxima_atividade: card.proxima_atividade,
          prazo_atividade:   card.prazo_atividade,
          especial:          especialSet.has(card.id),
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
          fase_nome:         fase?.nome   ?? null,
          kanban_nome:       kanban?.nome ?? null,
          sla_dias:          fase?.sla_dias ?? null,
          sla:               computeSla(card, fase ?? null),
          origem:            'checklist',
          proxima_atividade: card.proxima_atividade,
          prazo_atividade:   card.prazo_atividade,
          especial:          especialSet.has(card.id),
        });
      });

      // Processar fonte 4 — cards com proxima_atividade (não sobrescreve existentes)
      type CardF4 = CardBase & {
        proxima_atividade: string | null;
        prazo_atividade: string | null;
      };

      ((fonte4.data ?? []) as unknown as CardF4[]).forEach(card => {
        if (card.arquivado || card.concluido || mapa.has(card.id)) return;
        const fase   = Array.isArray(card.fase)   ? card.fase[0]   : card.fase;
        const kanban = Array.isArray(card.kanban) ? card.kanban[0] : card.kanban;
        mapa.set(card.id, {
          id: card.id, titulo: card.titulo,
          fase_nome:         fase?.nome   ?? null,
          kanban_nome:       kanban?.nome ?? null,
          sla_dias:          fase?.sla_dias ?? null,
          sla:               computeSla(card, fase ?? null),
          origem:            'proxima_atividade',
          proxima_atividade: card.proxima_atividade,
          prazo_atividade:   card.prazo_atividade,
          especial:          especialSet.has(card.id),
        });
      });

      // Processar fonte 5 — cards do usuário SEM proxima_atividade (não sobrescreve existentes)
      type CardF5 = CardBase;

      ((fonte5.data ?? []) as unknown as CardF5[]).forEach(card => {
        if (card.arquivado || card.concluido || mapa.has(card.id)) return;
        const fase   = Array.isArray(card.fase)   ? card.fase[0]   : card.fase;
        const kanban = Array.isArray(card.kanban) ? card.kanban[0] : card.kanban;
        mapa.set(card.id, {
          id: card.id, titulo: card.titulo,
          fase_nome:         fase?.nome   ?? null,
          kanban_nome:       kanban?.nome ?? null,
          sla_dias:          fase?.sla_dias ?? null,
          sla:               computeSla(card, fase ?? null),
          origem:            'sem_atividade',
          proxima_atividade: card.proxima_atividade,
          prazo_atividade:   card.prazo_atividade,
          especial:          especialSet.has(card.id),
        });
      });

      // Processar fonte 6 — cards com próximas atividades criadas pelo usuário (não sobrescreve)
      type CardF6 = { card_id: string; card: CardNested | CardNested[] | null };
      ((fonte6.data ?? []) as unknown as CardF6[]).forEach(row => {
        const card = Array.isArray(row.card) ? row.card[0] : row.card;
        if (!card || card.arquivado || card.concluido || mapa.has(card.id)) return;
        const fase   = Array.isArray(card.fase)   ? card.fase[0]   : card.fase;
        const kanban = Array.isArray(card.kanban) ? card.kanban[0] : card.kanban;
        mapa.set(card.id, {
          id: card.id, titulo: card.titulo,
          fase_nome:         fase?.nome   ?? null,
          kanban_nome:       kanban?.nome ?? null,
          sla_dias:          fase?.sla_dias ?? null,
          sla:               computeSla(card, fase ?? null),
          origem:            'proxima_atividade',
          proxima_atividade: card.proxima_atividade,
          prazo_atividade:   card.prazo_atividade,
          especial:          especialSet.has(card.id),
        });
      });

      const hojeIso = new Date().toISOString().slice(0, 10);
      const todasCards = Array.from(mapa.values());
      let sndResultado = todasCards.filter(c => c.sla_dias === null);
      const comSla = todasCards.filter(c => c.sla_dias !== null);

      comSla.forEach(c => { c.prioridade = calcPrioridade(c, hojeIso); });

      const resultado = comSla.sort((a, b) => {
        const pa = RANK[a.prioridade!], pb = RANK[b.prioridade!];
        if (pa !== pb) return pa - pb;
        if (a.prioridade !== 'P6') {
          const ea = a.especial ? 0 : 1, eb = b.especial ? 0 : 1;
          if (ea !== eb) return ea - eb;
        }
        const da = a.prazo_atividade ?? '', db = b.prazo_atividade ?? '';
        if (da && db) return da < db ? -1 : da > db ? 1 : 0;
        if (da) return -1;
        if (db) return 1;
        return 0;
      });

      // Ingrid: visão global — todos os cards SND + todos os cards sem responsável
      let ingridOrphans: KanbanCardItem[] = [];
      if (user.email === INGRID_EMAIL && !simProfileId) {
        type CardGlobal = CardBase & {
          responsavel_id: string | null;
          responsaveis_ids: string[] | null;
        };
        const { data: globalRaw } = await supabase
          .from('kanban_cards')
          .select(`
            id, titulo, arquivado, concluido,
            created_at, entered_fase_at, sla_iniciado_em,
            proxima_atividade, prazo_atividade,
            responsavel_id, responsaveis_ids,
            fase:kanban_fases(nome, sla_dias, sla_tipo, slug),
            kanban:kanbans(nome)
          `)
          .eq('arquivado', false)
          .eq('concluido', false);

        const sndMap = new Map(sndResultado.map(c => [c.id, c]));
        const orphanMap = new Map<string, KanbanCardItem>();

        ((globalRaw ?? []) as unknown as CardGlobal[]).forEach(card => {
          const fase   = Array.isArray(card.fase)   ? card.fase[0]   : card.fase;
          const kanban = Array.isArray(card.kanban) ? card.kanban[0] : card.kanban;
          const item: KanbanCardItem = {
            id: card.id, titulo: card.titulo,
            fase_nome:         fase?.nome   ?? null,
            kanban_nome:       kanban?.nome ?? null,
            sla_dias:          fase?.sla_dias ?? null,
            sla:               computeSla(card, fase ?? null),
            origem:            'sem_atividade',
            proxima_atividade: card.proxima_atividade,
            prazo_atividade:   card.prazo_atividade,
            especial:          especialSet.has(card.id),
          };
          if (fase?.sla_dias === null || fase?.sla_dias === undefined) {
            if (!sndMap.has(card.id)) sndMap.set(card.id, item);
          } else {
            const hasResp = !!card.responsavel_id ||
              (Array.isArray(card.responsaveis_ids) && card.responsaveis_ids.length > 0);
            if (!hasResp && !orphanMap.has(card.id)) orphanMap.set(card.id, item);
          }
        });

        sndResultado = Array.from(sndMap.values());
        ingridOrphans = Array.from(orphanMap.values());
      }

      if (callId !== callIdRef.current) return;
      setOrphanCards(ingridOrphans);
      setCards(resultado);
      setSndCards(sndResultado);
    } catch (e) {
      if (callId !== callIdRef.current) return;
      console.error('[useBacklogKanban]', e);
      setError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      if (callId === callIdRef.current) setIsLoading(false);
    }
  }, [supabase, simProfileId, simAreaId, simNome, refreshKey]);

  useEffect(() => { carregar(); }, [carregar]);
  return { cards, sndCards, orphanCards, isLoading, error };
}
