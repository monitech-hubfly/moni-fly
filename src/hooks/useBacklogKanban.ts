'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSimulacaoUsuario } from '@/components/carometro/todo/SeletorUsuarioAdmin';
import { calcularSlaKanbanCard, type SlaKanbanResult } from '@/lib/kanban/kanban-card-sla';

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
    faseNome: fase?.nome ?? null,
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

/** Converte uma row bruta do banco para KanbanCardItem */
type FaseRel   = FaseRelSla;
type KanbanRel = { nome: string };
type CardBase  = {
  id: string; titulo: string | null; arquivado: boolean; concluido: boolean;
  created_at: string; entered_fase_at: string | null; sla_iniciado_em: string | null;
  proxima_atividade: string | null; prazo_atividade: string | null;
  fase: FaseRel | FaseRel[] | null;
  kanban: KanbanRel | KanbanRel[] | null;
};

function cardBaseParaItem(
  card: CardBase,
  origem: KanbanCardItem['origem'],
  especialSet: Set<string>,
): KanbanCardItem {
  const fase   = Array.isArray(card.fase)   ? card.fase[0]   : card.fase;
  const kanban = Array.isArray(card.kanban) ? card.kanban[0] : card.kanban;
  return {
    id:                card.id,
    titulo:            card.titulo,
    fase_nome:         fase?.nome   ?? null,
    kanban_nome:       kanban?.nome ?? null,
    sla_dias:          fase?.sla_dias ?? null,
    sla:               computeSla(card, fase ?? null),
    origem,
    proxima_atividade: card.proxima_atividade,
    prazo_atividade:   card.prazo_atividade,
    especial:          especialSet.has(card.id),
  };
}

export function useBacklogKanban(refreshKey = 0) {
  const supabase    = useMemo(() => createClient(), []);
  const [cards,     setCards]     = useState<KanbanCardItem[]>([]);
  const [ssdCards,  setSsdCards]  = useState<KanbanCardItem[]>([]);
  const [srdCards,  setSrdCards]  = useState<KanbanCardItem[]>([]);
  const [isAdmin,   setIsAdmin]   = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
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

      // Verifica role admin via profiles (conforme padrão do projeto)
      const { data: perfil } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      const adminPorRole = (perfil as { role?: string | null } | null)?.role === 'admin';

      const effectiveProfileId = (adminPorRole && simProfileId)
        ? simProfileId
        : user.id;

      // ── Rodada 1: fontes pessoais + queries admin-only em paralelo ────────────
      // Regra: o backlog pessoal mostra apenas cards onde o usuário é o RESPONSÁVEL
      // DO CARD (responsavel_id ou responsaveis_ids). franqueado_id é o cliente/
      // franqueado do negócio — não é critério de responsabilidade operacional.
      // Nota: usar !fase_id para disambiguar FK dupla (fase_id / data_reuniao_fase_id)
      const noopQuery = Promise.resolve({ data: [] as unknown[], error: null });

      const [fonte1, fonte2, fonte3, fonte4, tagEspecialRes, ssdFasesRes, srdRes] =
        await Promise.all([
          // ── Pessoal ──────────────────────────────────────────────────────────
          supabase
            .from('kanban_atividades')
            .select(`
              id, card_id, status,
              card:kanban_cards(
                id, titulo, arquivado, concluido,
                created_at, entered_fase_at, sla_iniciado_em,
                proxima_atividade, prazo_atividade,
                fase:kanban_fases!fase_id(nome, sla_dias, sla_tipo, slug),
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
                fase:kanban_fases!fase_id(nome, sla_dias, sla_tipo, slug),
                kanban:kanbans(nome)
              )
            `)
            .eq('valor', effectiveProfileId),

          supabase
            .from('kanban_cards')
            .select(`
              id, titulo, arquivado, concluido,
              created_at, entered_fase_at, sla_iniciado_em,
              proxima_atividade, prazo_atividade,
              fase:kanban_fases!fase_id(nome, sla_dias, sla_tipo, slug),
              kanban:kanbans(nome)
            `)
            .or(`responsavel_id.eq.${effectiveProfileId},responsaveis_ids.cs.{${effectiveProfileId}}`)
            .not('proxima_atividade', 'is', null)
            .eq('arquivado', false)
            .eq('concluido', false),

          supabase
            .from('kanban_cards')
            .select(`
              id, titulo, arquivado, concluido,
              created_at, entered_fase_at, sla_iniciado_em,
              proxima_atividade, prazo_atividade,
              fase:kanban_fases!fase_id(nome, sla_dias, sla_tipo, slug),
              kanban:kanbans(nome)
            `)
            .or(`responsavel_id.eq.${effectiveProfileId},responsaveis_ids.cs.{${effectiveProfileId}}`)
            .is('proxima_atividade', null)
            .eq('arquivado', false)
            .eq('concluido', false),

          supabase
            .from('kanban_tags')
            .select('id')
            .eq('nome', '⭐Especial'),

          // ── Admin: IDs das fases sem SLA (para busca SSD) ───────────────────
          adminPorRole
            ? supabase.from('kanban_fases').select('id').is('sla_dias', null)
            : noopQuery,

          // ── Admin: cards sem responsável definido (SRD) ──────────────────────
          adminPorRole
            ? supabase
                .from('kanban_cards')
                .select(`
                  id, titulo, arquivado, concluido,
                  created_at, entered_fase_at, sla_iniciado_em,
                  proxima_atividade, prazo_atividade,
                  responsaveis_ids,
                  fase:kanban_fases!fase_id(nome, sla_dias, sla_tipo, slug),
                  kanban:kanbans(nome)
                `)
                .is('responsavel_id', null)
                .eq('arquivado', false)
                .eq('concluido', false)
            : noopQuery,
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

      // ── Processar fontes pessoais ─────────────────────────────────────────────
      const mapa = new Map<string, KanbanCardItem>();

      type CardNested = CardBase;
      type CardF1 = { id: string; card_id: string; status: string; card: CardNested | CardNested[] | null };

      ((fonte1.data ?? []) as unknown as CardF1[]).forEach(atv => {
        const card = Array.isArray(atv.card) ? atv.card[0] : atv.card;
        if (!card || card.arquivado || card.concluido) return;
        mapa.set(card.id, cardBaseParaItem(card, 'atividade', especialSet));
      });

      type CardF2 = { card_id: string; card: CardNested | CardNested[] | null };

      ((fonte2.data ?? []) as unknown as CardF2[]).forEach(row => {
        const card = Array.isArray(row.card) ? row.card[0] : row.card;
        if (!card || card.arquivado || card.concluido || mapa.has(card.id)) return;
        mapa.set(card.id, cardBaseParaItem(card, 'checklist', especialSet));
      });

      ((fonte3.data ?? []) as unknown as CardBase[]).forEach(card => {
        if (card.arquivado || card.concluido || mapa.has(card.id)) return;
        mapa.set(card.id, cardBaseParaItem(card, 'proxima_atividade', especialSet));
      });

      ((fonte4.data ?? []) as unknown as CardBase[]).forEach(card => {
        if (card.arquivado || card.concluido || mapa.has(card.id)) return;
        mapa.set(card.id, cardBaseParaItem(card, 'sem_atividade', especialSet));
      });

      // Ordenação pessoal: P1-P6 (apenas cards com SLA). Cards sem SLA ficam ao final.
      const hojeIso = new Date().toISOString().slice(0, 10);
      const todasCards = Array.from(mapa.values());
      const comSla  = todasCards.filter(c => c.sla_dias !== null);
      const semSla  = todasCards.filter(c => c.sla_dias === null);

      comSla.forEach(c => { c.prioridade = calcPrioridade(c, hojeIso); });

      const sortPessoal = (a: KanbanCardItem, b: KanbanCardItem) => {
        const pa = RANK[a.prioridade!] ?? 99, pb = RANK[b.prioridade!] ?? 99;
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
      };

      const resultado = [...comSla.sort(sortPessoal), ...semSla];

      // ── Processar SSD e SRD globais (apenas admin) ─────────────────────────
      let ssdResultado: KanbanCardItem[] = [];
      let srdResultado: KanbanCardItem[] = [];

      if (adminPorRole) {
        // ── Rodada 2: cards nas fases sem SLA ───────────────────────────────
        const faseIds = ((ssdFasesRes.data ?? []) as Array<{ id: string }>).map(r => r.id);
        if (faseIds.length > 0) {
          const { data: ssdData } = await supabase
            .from('kanban_cards')
            .select(`
              id, titulo, arquivado, concluido,
              created_at, entered_fase_at, sla_iniciado_em,
              proxima_atividade, prazo_atividade,
              fase:kanban_fases!fase_id(nome, sla_dias, sla_tipo, slug),
              kanban:kanbans(nome)
            `)
            .in('fase_id', faseIds)
            .eq('arquivado', false)
            .eq('concluido', false);

          const ssdMapaIds = new Set<string>();
          ((ssdData ?? []) as unknown as CardBase[]).forEach(card => {
            if (card.arquivado || card.concluido || ssdMapaIds.has(card.id)) return;
            ssdMapaIds.add(card.id);
            ssdResultado.push(cardBaseParaItem(card, 'sem_atividade', especialSet));
          });

          // Ordenar SSD por kanban_nome, depois titulo
          ssdResultado.sort((a, b) => {
            const ka = a.kanban_nome ?? '', kb = b.kanban_nome ?? '';
            if (ka !== kb) return ka < kb ? -1 : 1;
            return (a.titulo ?? '') < (b.titulo ?? '') ? -1 : 1;
          });
        }

        // ── Processar SRD: filtrar client-side responsaveis_ids vazio ────────
        type CardSrd = CardBase & { responsaveis_ids?: string[] | null };
        ((srdRes.data ?? []) as unknown as CardSrd[]).forEach(card => {
          if (card.arquivado || card.concluido) return;
          const ids = card.responsaveis_ids;
          if (ids && ids.length > 0) return; // tem responsável no array
          srdResultado.push(cardBaseParaItem(card, 'sem_atividade', especialSet));
        });

        // Ordenar SRD por kanban_nome, depois titulo
        srdResultado.sort((a, b) => {
          const ka = a.kanban_nome ?? '', kb = b.kanban_nome ?? '';
          if (ka !== kb) return ka < kb ? -1 : 1;
          return (a.titulo ?? '') < (b.titulo ?? '') ? -1 : 1;
        });
      }

      if (callId !== callIdRef.current) return;
      setCards(resultado);
      setSsdCards(ssdResultado);
      setSrdCards(srdResultado);
      setIsAdmin(adminPorRole);
    } catch (e) {
      if (callId !== callIdRef.current) return;
      console.error('[useBacklogKanban]', e);
      setError(e instanceof Error ? e.message : JSON.stringify(e));
    } finally {
      if (callId === callIdRef.current) setIsLoading(false);
    }
  }, [supabase, simProfileId, simAreaId, simNome, refreshKey]);

  useEffect(() => { carregar(); }, [carregar]);
  return { cards, ssdCards, srdCards, isLoading, error, isAdmin };
}
