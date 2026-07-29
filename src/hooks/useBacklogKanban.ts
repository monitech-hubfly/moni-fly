'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSimulacaoUsuario } from '@/components/carometro/todo/SeletorUsuarioAdmin';
import { calcularSlaKanbanCard, resolveDataBaseSlaKanban, type SlaKanbanResult } from '@/lib/kanban/kanban-card-sla';
import { adicionarDiasUteis, adicionarDiasCorridos, normalizarSlaTipo } from '@/lib/dias-uteis';
import {
  EMAIL_RESPONSAVEL_PADRAO_POR_KANBAN,
  CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO,
} from '@/lib/kanban/responsavel-fase-checklist';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';

const ADMIN_EMAIL  = 'danilo.n@moni.casa';
const INGRID_EMAIL = 'ingrid.hora@moni.casa';

// Kanbans sem responsável padrão: cards sem dono = orphan da Ingrid (SRC)
const KANBANS_SEM_DEFAULT = Object.values(KANBAN_IDS).filter(
  id => !EMAIL_RESPONSAVEL_PADRAO_POR_KANBAN[id],
);

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

const CARD_FIELDS = `
  id, titulo, arquivado, concluido, fase_id, kanban_id,
  created_at, entered_fase_at, sla_iniciado_em,
  proxima_atividade, prazo_atividade,
  fase:kanban_fases!fase_id(nome, sla_dias, sla_tipo, slug),
  kanban:kanbans(nome)
` as const;

type CardRaw = {
  id: string; titulo: string | null; arquivado: boolean; concluido: boolean;
  fase_id: string; kanban_id: string;
  created_at: string; entered_fase_at: string | null; sla_iniciado_em: string | null;
  proxima_atividade: string | null; prazo_atividade: string | null;
  fase: FaseRelSla | FaseRelSla[] | null;
  kanban: { nome: string } | { nome: string }[] | null;
};

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

      const isAdmin            = user.email === ADMIN_EMAIL;
      const effectiveProfileId = (isAdmin && simProfileId) ? simProfileId : user.id;
      const effectiveEmail     = (isAdmin && simEmail) ? simEmail : (user.email ?? '');
      const isIngridView       = user.email === INGRID_EMAIL || simEmail === INGRID_EMAIL;

      // Kanbans onde o usuário é o responsável padrão
      const myDefaultKanbanIds = Object.entries(EMAIL_RESPONSAVEL_PADRAO_POR_KANBAN)
        .filter(([, email]) => email === effectiveEmail)
        .map(([id]) => id);

      // ── Round 1: item_ids + tag Especial + cards default (paralelo) ──────────
      const [itensRes, tagRes, defaultCardsRes] = await Promise.all([
        // Itens de checklist que representam responsável de fase
        supabase
          .from('kanban_fase_checklist_itens')
          .select('id, fase_id')
          .in('campo_slug', [...CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO]),

        supabase.from('kanban_tags').select('id').eq('nome', '⭐Especial'),

        myDefaultKanbanIds.length > 0
          ? supabase
              .from('kanban_cards')
              .select(CARD_FIELDS)
              .in('kanban_id', myDefaultKanbanIds)
              .eq('arquivado', false)
              .eq('concluido', false)
          : Promise.resolve({ data: [] as CardRaw[], error: null }),
      ]);

      // item_id → fase_id
      const itemFaseMap = new Map<string, string>(
        ((itensRes.data ?? []) as Array<{ id: string; fase_id: string }>)
          .map(i => [i.id, i.fase_id]),
      );
      const responsavelItemIds = [...itemFaseMap.keys()];

      const defaultCards   = (defaultCardsRes.data ?? []) as CardRaw[];
      const defaultCardIds = defaultCards.map(c => c.id);
      const tagIds         = ((tagRes.data ?? []) as Array<{ id: string }>).map(r => r.id);

      // ── Round 2: respostas + tag_cards + overrides (paralelo) ───────────────
      const [respostasRes, tagCardsRes, overrideRes] = await Promise.all([
        responsavelItemIds.length > 0
          ? supabase
              .from('kanban_fase_checklist_respostas')
              .select('card_id, item_id')
              .eq('valor', effectiveProfileId)
              .in('item_id', responsavelItemIds)
          : Promise.resolve({ data: [] as Array<{ card_id: string; item_id: string }>, error: null }),

        tagIds.length > 0
          ? supabase
              .from('kanban_card_tags')
              .select('card_id')
              .in('tag_id', tagIds)
          : Promise.resolve({ data: [] as Array<{ card_id: string }>, error: null }),

        // Override: quaisquer respostas de responsavel nos cards default
        responsavelItemIds.length > 0 && defaultCardIds.length > 0
          ? supabase
              .from('kanban_fase_checklist_respostas')
              .select('card_id, item_id')
              .not('valor', 'is', null)
              .in('item_id', responsavelItemIds)
              .in('card_id', defaultCardIds)
          : Promise.resolve({ data: [] as Array<{ card_id: string; item_id: string }>, error: null }),
      ]);

      const especialSet = new Set<string>(
        ((tagCardsRes.data ?? []) as Array<{ card_id: string }>).map(r => r.card_id),
      );

      // card_id → item_id (para validar fase)
      const cardItemMap = new Map<string, string>();
      ((respostasRes.data ?? []) as Array<{ card_id: string; item_id: string }>)
        .forEach(r => cardItemMap.set(r.card_id, r.item_id));

      const overrideCardItemMap = new Map<string, string>();
      ((overrideRes.data ?? []) as Array<{ card_id: string; item_id: string }>)
        .forEach(r => overrideCardItemMap.set(r.card_id, r.item_id));

      // ── Round 3: detalhes dos cards explícitos ───────────────────────────────
      const explicitIds = [...cardItemMap.keys()];
      const explicitCardsRes = explicitIds.length > 0
        ? await supabase
            .from('kanban_cards')
            .select(CARD_FIELDS)
            .in('id', explicitIds)
            .eq('arquivado', false)
            .eq('concluido', false)
        : { data: [] as CardRaw[], error: null };

      const explicitCards = (explicitCardsRes.data ?? []) as CardRaw[];

      // ── Montar mapa ──────────────────────────────────────────────────────────
      function toItem(raw: CardRaw): KanbanCardItem {
        const fase   = Array.isArray(raw.fase)   ? raw.fase[0]   : raw.fase;
        const kanban = Array.isArray(raw.kanban) ? raw.kanban[0] : raw.kanban;
        return {
          id: raw.id, titulo: raw.titulo,
          fase_nome:         fase?.nome   ?? null,
          kanban_nome:       kanban?.nome ?? null,
          sla_dias:          fase?.sla_dias ?? null,
          sla:               computeSla(raw, fase ?? null),
          sla_prazo_iso:     computeSlaPrazo(raw, fase ?? null),
          origem:            raw.proxima_atividade ? 'proxima_atividade' : 'sem_atividade',
          proxima_atividade: raw.proxima_atividade,
          prazo_atividade:   raw.prazo_atividade,
          especial:          especialSet.has(raw.id),
        };
      }

      const mapa = new Map<string, KanbanCardItem>();

      // Explícitos: só incluir se item.fase_id === card.fase_id (fase atual)
      explicitCards.forEach(card => {
        const itemId    = cardItemMap.get(card.id);
        if (!itemId) return;
        const itemFaseId = itemFaseMap.get(itemId);
        if (itemFaseId !== card.fase_id) return; // entrada histórica → ignorar
        mapa.set(card.id, toItem(card));
      });

      // Default kanbans: excluir cards com override explícito na fase atual
      defaultCards.forEach(card => {
        if (mapa.has(card.id)) return; // já incluído como explícito
        const oItemId  = overrideCardItemMap.get(card.id);
        if (oItemId) {
          const oFaseId = itemFaseMap.get(oItemId);
          if (oFaseId === card.fase_id) return; // outro usuário é responsavel nesta fase
        }
        mapa.set(card.id, toItem(card));
      });

      // ── Prioridades e sort ───────────────────────────────────────────────────
      const hojeIso    = new Date().toISOString().slice(0, 10);
      const todasCards = [...mapa.values()];
      let sndFinal     = todasCards.filter(c => c.sla_dias === null);
      const comSla     = todasCards.filter(c => c.sla_dias !== null);

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

      // ── Ingrid: SND global + SRC global ─────────────────────────────────────
      let ingridOrphans: KanbanCardItem[] = [];
      if (isIngridView) {
        // Round 4a: fases SND + orphan candidates (paralelo)
        const [sndFasesRes, orphanCandRes] = await Promise.all([
          supabase.from('kanban_fases').select('id').is('sla_dias', null),

          KANBANS_SEM_DEFAULT.length > 0
            ? supabase
                .from('kanban_cards')
                .select(CARD_FIELDS)
                .in('kanban_id', KANBANS_SEM_DEFAULT)
                .eq('arquivado', false)
                .eq('concluido', false)
            : Promise.resolve({ data: [] as CardRaw[], error: null }),
        ]);

        const sndFaseIds         = ((sndFasesRes.data ?? []) as Array<{ id: string }>).map(f => f.id);
        const orphanCandidates   = (orphanCandRes.data ?? []) as CardRaw[];
        const orphanCandidateIds = orphanCandidates.map(c => c.id);

        // Round 4b: cards SND + overrides orphan (paralelo)
        const [sndCardsRes, orphanOverrideRes] = await Promise.all([
          sndFaseIds.length > 0
            ? supabase
                .from('kanban_cards')
                .select(CARD_FIELDS)
                .in('fase_id', sndFaseIds)
                .eq('arquivado', false)
                .eq('concluido', false)
            : Promise.resolve({ data: [] as CardRaw[], error: null }),

          responsavelItemIds.length > 0 && orphanCandidateIds.length > 0
            ? supabase
                .from('kanban_fase_checklist_respostas')
                .select('card_id, item_id')
                .not('valor', 'is', null)
                .in('item_id', responsavelItemIds)
                .in('card_id', orphanCandidateIds)
            : Promise.resolve({ data: [] as Array<{ card_id: string; item_id: string }>, error: null }),
        ]);

        // SND final
        sndFinal = ((sndCardsRes.data ?? []) as CardRaw[]).map(toItem);

        // SRC: orphan candidates sem responsavel explícito na fase atual
        const orphanOvrMap = new Map<string, string>();
        ((orphanOverrideRes.data ?? []) as Array<{ card_id: string; item_id: string }>)
          .forEach(r => orphanOvrMap.set(r.card_id, r.item_id));

        ingridOrphans = orphanCandidates
          .filter(card => {
            const oItemId = orphanOvrMap.get(card.id);
            if (!oItemId) return true; // sem responsavel → orphan
            const oFaseId = itemFaseMap.get(oItemId);
            return oFaseId !== card.fase_id; // override em fase diferente → ainda orphan
          })
          .map(toItem);
      }

      if (callId !== callIdRef.current) return;
      setCards(resultado);
      setSndCards(sndFinal);
      setOrphanCards(ingridOrphans);
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
