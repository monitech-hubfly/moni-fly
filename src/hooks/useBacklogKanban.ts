'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSimulacaoUsuario } from '@/components/carometro/todo/SeletorUsuarioAdmin';
import { calcularSlaKanbanCard, resolveDataBaseSlaKanban, type SlaKanbanResult } from '@/lib/kanban/kanban-card-sla';
import { adicionarDiasUteis, adicionarDiasCorridos, normalizarSlaTipo } from '@/lib/dias-uteis';

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
  sla_prazo_iso: string | null;
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

function computeSlaPrazo(
  card: { created_at: string; entered_fase_at?: string | null; sla_iniciado_em?: string | null },
  fase: FaseRelSla | null,
): string | null {
  if (!fase?.sla_dias || fase.sla_dias <= 0) return null;
  const base = resolveDataBaseSlaKanban({ ...card, faseSlug: fase.slug });
  if (!base) return null;
  const slaTipo = normalizarSlaTipo(fase.sla_tipo);
  const prazoDate = slaTipo === 'corridos'
    ? adicionarDiasCorridos(base, fase.sla_dias)
    : adicionarDiasUteis(base, fase.sla_dias);
  return prazoDate.toISOString().slice(0, 10);
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
  const simEmail     = simulacao?.email ?? null;

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

      // Fonte única: cards onde o usuário é responsável (responsavel_id ou responsaveis_ids)
      const [responsavelRes, tagEspecialRes] = await Promise.all([
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
          .eq('arquivado', false)
          .eq('concluido', false),

        supabase
          .from('kanban_tags')
          .select('id')
          .eq('nome', '⭐Especial'),
      ]);

      // Busca cards da tag Especial
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

      type FaseRel   = FaseRelSla;
      type KanbanRel = { nome: string };
      type CardBase  = {
        id: string; titulo: string | null; arquivado: boolean; concluido: boolean;
        created_at: string; entered_fase_at: string | null; sla_iniciado_em: string | null;
        proxima_atividade: string | null;
        prazo_atividade: string | null;
        fase: FaseRel | FaseRel[] | null;
        kanban: KanbanRel | KanbanRel[] | null;
      };

      ((responsavelRes.data ?? []) as unknown as CardBase[]).forEach(card => {
        if (card.arquivado || card.concluido) return;
        const fase   = Array.isArray(card.fase)   ? card.fase[0]   : card.fase;
        const kanban = Array.isArray(card.kanban) ? card.kanban[0] : card.kanban;
        mapa.set(card.id, {
          id: card.id, titulo: card.titulo,
          fase_nome:         fase?.nome   ?? null,
          kanban_nome:       kanban?.nome ?? null,
          sla_dias:          fase?.sla_dias ?? null,
          sla:               computeSla(card, fase ?? null),
          sla_prazo_iso:     computeSlaPrazo(card, fase ?? null),
          origem:            card.proxima_atividade ? 'proxima_atividade' : 'sem_atividade',
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
      const isIngridView = user.email === INGRID_EMAIL || simEmail === INGRID_EMAIL;
      if (isIngridView) {
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
            fase:kanban_fases!fase_id(nome, sla_dias, sla_tipo, slug),
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
            sla_prazo_iso:     computeSlaPrazo(card, fase ?? null),
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
  }, [supabase, simProfileId, simAreaId, simNome, simEmail, refreshKey]);

  useEffect(() => { carregar(); }, [carregar]);
  return { cards, sndCards, orphanCards, isLoading, error };
}
