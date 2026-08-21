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
import { tituloExibicaoCardLoteadores } from '@/lib/kanban/loteadores-card-titulo';
import { isFaseConclusaoKanban } from '@/lib/kanban/kanban-fase-conclusao';
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
  fase_slug: string | null;
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
  nome_condominio, rede_loteador_id,
  created_at, entered_fase_at, sla_iniciado_em,
  proxima_atividade, prazo_atividade,
  fase:kanban_fases!fase_id(nome, sla_dias, sla_tipo, slug),
  kanban:kanbans(nome)
` as const;

type CardRaw = {
  id: string; titulo: string | null; arquivado: boolean; concluido: boolean;
  fase_id: string; kanban_id: string;
  nome_condominio?: string | null;
  rede_loteador_id?: string | null;
  created_at: string; entered_fase_at: string | null; sla_iniciado_em: string | null;
  proxima_atividade: string | null; prazo_atividade: string | null;
  fase: FaseRelSla | FaseRelSla[] | null;
  kanban: { nome: string } | { nome: string }[] | null;
};

function faseDeCardRaw(raw: CardRaw): FaseRelSla | null {
  return Array.isArray(raw.fase) ? raw.fase[0] ?? null : raw.fase ?? null;
}

function cardRawEmFaseConclusao(raw: CardRaw): boolean {
  const fase = faseDeCardRaw(raw);
  return isFaseConclusaoKanban({ slug: fase?.slug, nome: fase?.nome });
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

      const isAdmin            = user.email === ADMIN_EMAIL;
      const effectiveProfileId = (isAdmin && simProfileId) ? simProfileId : user.id;
      const effectiveEmail     = (isAdmin && simEmail) ? simEmail : (user.email ?? '');
      const isIngridView       = user.email === INGRID_EMAIL || simEmail === INGRID_EMAIL;

      // Kanbans onde o usuário é o responsável padrão
      const myDefaultKanbanIds = Object.entries(EMAIL_RESPONSAVEL_PADRAO_POR_KANBAN)
        .filter(([, email]) => email === effectiveEmail)
        .map(([id]) => id);

      // ── Round 1: minhas respostas + tag Especial + cards default (paralelo) ──
      //
      // MUDANÇA CHAVE vs. versão anterior:
      // Antes: buscava TODOS kanban_fase_checklist_itens com slugs responsavel
      //        (podia retornar centenas de IDs) e usava essa lista enorme no
      //        .in('item_id', ...) das respostas → timeout.
      // Agora: busca MINHAS respostas pelo valor (profileId) diretamente →
      //        resultado pequeno (~5-200 linhas), depois valida quais são
      //        de itens responsavel_fase. Muito mais eficiente.
      const [minhasRespostasRes, tagRes, defaultCardsRes] = await Promise.all([
        supabase
          .from('kanban_fase_checklist_respostas')
          .select('card_id, item_id')
          .eq('valor', effectiveProfileId),

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

      const minhasRespostas    = (minhasRespostasRes.data ?? []) as Array<{ card_id: string; item_id: string }>;
      const minhasItemIds      = [...new Set(minhasRespostas.map(r => r.item_id))];
      const defaultCards       = (defaultCardsRes.data ?? []) as CardRaw[];
      const defaultCardIds     = defaultCards.map(c => c.id);
      // Fases únicas dos default cards (para checar overrides com escopo reduzido)
      const defaultCardFaseIds = [...new Set(defaultCards.map(c => c.fase_id))];
      const tagIds             = ((tagRes.data ?? []) as Array<{ id: string }>).map(r => r.id);

      // ── Round 2: validar itens responsavel + tag_cards + itens das fases default (paralelo) ──
      const [validItemsRes, tagCardsRes, defaultFaseItemsRes] = await Promise.all([
        // Valida quais das minhas respostas são de campos responsavel_fase.
        // Lista pequena (minhasItemIds), filtro por campo_slug → query rápida.
        minhasItemIds.length > 0
          ? supabase
              .from('kanban_fase_checklist_itens')
              .select('id, fase_id')
              .in('id', minhasItemIds)
              .in('campo_slug', [...CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO])
          : Promise.resolve({ data: [] as Array<{ id: string; fase_id: string }>, error: null }),

        tagIds.length > 0
          ? supabase
              .from('kanban_card_tags')
              .select('card_id')
              .in('tag_id', tagIds)
          : Promise.resolve({ data: [] as Array<{ card_id: string }>, error: null }),

        // Itens responsavel APENAS nas fases atuais dos default cards.
        // Escopo limitado: defaultCardFaseIds é tipicamente < 50 fases,
        // vs. a abordagem anterior que buscava todos os itens globalmente.
        defaultCardFaseIds.length > 0
          ? supabase
              .from('kanban_fase_checklist_itens')
              .select('id, fase_id')
              .in('fase_id', defaultCardFaseIds)
              .in('campo_slug', [...CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO])
          : Promise.resolve({ data: [] as Array<{ id: string; fase_id: string }>, error: null }),
      ]);

      // item_id → fase_id dos meus itens válidos de responsavel
      const validItemFaseMap = new Map<string, string>(
        ((validItemsRes.data ?? []) as Array<{ id: string; fase_id: string }>)
          .map(i => [i.id, i.fase_id]),
      );

      // item_id → fase_id dos itens responsavel nas fases dos default cards (override check)
      const defaultItemFaseMap = new Map<string, string>(
        ((defaultFaseItemsRes.data ?? []) as Array<{ id: string; fase_id: string }>)
          .map(i => [i.id, i.fase_id]),
      );
      const defaultFaseItemIds = [...defaultItemFaseMap.keys()];

      const especialSet = new Set<string>(
        ((tagCardsRes.data ?? []) as Array<{ card_id: string }>).map(r => r.card_id),
      );

      // card_id → item_ids[] (todas as respostas de itens responsavel válidos para o card)
      // Usa lista em vez de valor único para evitar overwrite: se o card tem entradas
      // em múltiplas fases (atual + históricas), o .set() simples descartaria a atual
      // caso a histórica viesse depois no array, excluindo o card erroneamente.
      const cardItemsMap = new Map<string, string[]>();
      for (const r of minhasRespostas) {
        if (validItemFaseMap.has(r.item_id)) {
          const list = cardItemsMap.get(r.card_id) ?? [];
          list.push(r.item_id);
          cardItemsMap.set(r.card_id, list);
        }
      }

      // ── Round 3: detalhes dos cards explícitos + overrides (paralelo) ──────
      const explicitIds = [...cardItemsMap.keys()];
      const [explicitCardsRes, overrideRes] = await Promise.all([
        explicitIds.length > 0
          ? supabase
              .from('kanban_cards')
              .select(CARD_FIELDS)
              .in('id', explicitIds)
              .eq('arquivado', false)
              .eq('concluido', false)
          : { data: [] as CardRaw[], error: null },

        // Override: respostas de responsavel nos default cards, escopadas
        // apenas aos itens das fases ATUAIS dos cards (lista muito menor).
        defaultFaseItemIds.length > 0 && defaultCardIds.length > 0
          ? supabase
              .from('kanban_fase_checklist_respostas')
              .select('card_id, item_id')
              .not('valor', 'is', null)
              .in('item_id', defaultFaseItemIds)
              .in('card_id', defaultCardIds)
          : Promise.resolve({ data: [] as Array<{ card_id: string; item_id: string }>, error: null }),
      ]);

      const explicitCards = (explicitCardsRes.data ?? []) as CardRaw[];

      const overrideCardItemMap = new Map<string, string>();
      ((overrideRes.data ?? []) as Array<{ card_id: string; item_id: string }>)
        .forEach(r => overrideCardItemMap.set(r.card_id, r.item_id));

      const allCardRaws = [...explicitCards, ...defaultCards];
      const loteadorIds = [
        ...new Set(
          allCardRaws
            .filter(
              (c) =>
                c.kanban_id === KANBAN_IDS.LOTEADORES &&
                String(c.rede_loteador_id ?? '').trim(),
            )
            .map((c) => String(c.rede_loteador_id).trim()),
        ),
      ];
      const loteadorPorId = new Map<
        string,
        { nome?: string | null; contato_nome?: string | null; condominio_nome?: string | null }
      >();
      if (loteadorIds.length > 0) {
        const { data: loteadoresRows } = await supabase
          .from('rede_loteadores')
          .select('id, nome, contato_nome, condominio_nome')
          .in('id', loteadorIds);
        for (const row of loteadoresRows ?? []) {
          const id = String((row as { id?: string }).id ?? '').trim();
          if (id) {
            loteadorPorId.set(id, {
              nome: (row as { nome?: string | null }).nome,
              contato_nome: (row as { contato_nome?: string | null }).contato_nome,
              condominio_nome: (row as { condominio_nome?: string | null }).condominio_nome,
            });
          }
        }
      }

      // ── Montar mapa ──────────────────────────────────────────────────────────
      function toItem(raw: CardRaw): KanbanCardItem {
        const fase   = faseDeCardRaw(raw);
        const kanban = Array.isArray(raw.kanban) ? raw.kanban[0] : raw.kanban;
        let tituloCard = raw.titulo;
        if (raw.kanban_id === KANBAN_IDS.LOTEADORES) {
          const redeLoteadorId = String(raw.rede_loteador_id ?? '').trim();
          const rl = redeLoteadorId ? loteadorPorId.get(redeLoteadorId) : undefined;
          tituloCard =
            tituloExibicaoCardLoteadores(
              { titulo: raw.titulo, nome_condominio: raw.nome_condominio },
              rl,
            ) ?? tituloCard;
        }
        return {
          id: raw.id, titulo: tituloCard,
          fase_nome:         fase?.nome   ?? null,
          fase_slug:         fase?.slug   ?? null,
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

      // Explícitos: só incluir se ao menos UM dos item_ids pertence à fase atual do card
      explicitCards.forEach(card => {
        const itemIds = cardItemsMap.get(card.id);
        if (!itemIds?.length) return;
        const temFaseAtual = itemIds.some(id => validItemFaseMap.get(id) === card.fase_id);
        if (!temFaseAtual) return; // só entradas históricas → ignorar
        mapa.set(card.id, toItem(card));
      });

      // Default kanbans: excluir cards com override explícito na fase atual
      defaultCards.forEach(card => {
        if (mapa.has(card.id)) return; // já incluído como explícito
        const oItemId  = overrideCardItemMap.get(card.id);
        if (oItemId) {
          const oFaseId = defaultItemFaseMap.get(oItemId);
          if (oFaseId === card.fase_id) return; // outro usuário é responsavel nesta fase
        }
        mapa.set(card.id, toItem(card));
      });

      // ── Prioridades e sort ───────────────────────────────────────────────────
      const hojeIso    = new Date().toISOString().slice(0, 10);
      const todasCards = [...mapa.values()];
      let sndFinal     = todasCards.filter(
        (c) => c.sla_dias === null && !isFaseConclusaoKanban({ slug: c.fase_slug, nome: c.fase_nome }),
      );
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
        // Fases únicas dos orphan candidates (para override check escopado)
        const orphanFaseIds      = [...new Set(orphanCandidates.map(c => c.fase_id))];

        // Round 4b: cards SND + itens responsavel das fases orphan (paralelo)
        const [sndCardsRes, orphanFaseItemsRes] = await Promise.all([
          sndFaseIds.length > 0
            ? supabase
                .from('kanban_cards')
                .select(CARD_FIELDS)
                .in('fase_id', sndFaseIds)
                .eq('arquivado', false)
                .eq('concluido', false)
            : Promise.resolve({ data: [] as CardRaw[], error: null }),

          // Itens responsavel apenas nas fases dos orphan candidates
          orphanFaseIds.length > 0
            ? supabase
                .from('kanban_fase_checklist_itens')
                .select('id, fase_id')
                .in('fase_id', orphanFaseIds)
                .in('campo_slug', [...CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO])
            : Promise.resolve({ data: [] as Array<{ id: string; fase_id: string }>, error: null }),
        ]);

        // SND final — exclui fases de conclusão (sem SLA intencional)
        sndFinal = ((sndCardsRes.data ?? []) as CardRaw[])
          .filter((c) => !cardRawEmFaseConclusao(c))
          .map(toItem);

        // Mapa item→fase para os orphan candidates
        const orphanFaseItemFaseMap = new Map<string, string>(
          ((orphanFaseItemsRes.data ?? []) as Array<{ id: string; fase_id: string }>)
            .map(i => [i.id, i.fase_id]),
        );
        const orphanFaseItemIds = [...orphanFaseItemFaseMap.keys()];

        // Round 4c: overrides nos orphan candidates (escopado às suas fases)
        const orphanOverrideRes = orphanFaseItemIds.length > 0 && orphanCandidateIds.length > 0
          ? await supabase
              .from('kanban_fase_checklist_respostas')
              .select('card_id, item_id')
              .not('valor', 'is', null)
              .in('item_id', orphanFaseItemIds)
              .in('card_id', orphanCandidateIds)
          : { data: [] as Array<{ card_id: string; item_id: string }>, error: null };

        // SRC: orphan candidates sem responsavel explícito na fase atual
        const orphanOvrMap = new Map<string, string>();
        ((orphanOverrideRes.data ?? []) as Array<{ card_id: string; item_id: string }>)
          .forEach(r => orphanOvrMap.set(r.card_id, r.item_id));

        ingridOrphans = orphanCandidates
          .filter(card => {
            const oItemId = orphanOvrMap.get(card.id);
            if (!oItemId) return true; // sem responsavel → orphan
            const oFaseId = orphanFaseItemFaseMap.get(oItemId);
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
