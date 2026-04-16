'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { calcularStatusSLA } from '@/lib/dias-uteis';
import { rotuloSlaInteracaoPainel } from '@/lib/painel-tarefas-filtros';
import {
  atualizarStatusSubInteracao,
  criarInteracao,
  criarSubInteracao,
  editarInteracao,
  type SubInteracaoStatusDb,
} from '@/lib/actions/card-actions';
import { AtividadeVinculadaCard } from '@/components/AtividadeVinculadaCard';
import { AtividadeVinculadaIcon } from '@/components/AtividadeVinculadaIcon';
import { AtividadeVinculadaStatusPill } from '@/components/AtividadeVinculadaStatusPill';
import {
  labelKanbanAtividadeParaPill,
  resolveAtividadeVinculadaKind,
} from '@/lib/atividade-vinculada-visual';
import type { CamposPorFaseMap, KanbanFase, KanbanNomeDisplay } from './types';
import {
  formatDataHoraHistorico,
  iconeHistoricoAcao,
  interacaoPassaFiltroTime,
  interacoesDemonstracao,
  isInteracaoDemonstracao,
  slaInteracaoBadge,
  tagsTimesParaLinha,
  textoResumidoAcaoHistorico,
  type ComentarioCardRow,
  type HistoricoItem,
  type InteracaoModal,
  type KanbanTimeRow,
  type SecaoEsquerdaId,
  type SubInteracaoModal,
} from './kanban-card-modal-helpers';

type Card = {
  id: string;
  titulo: string;
  status: string;
  created_at: string;
  fase_id: string;
  franqueado_id: string;
  kanban_id: string;
  /** Preenchido quando o card veio da view `v_processo_como_kanban_cards`. */
  etapa_slug?: string | null;
  profiles?: {
    full_name: string | null;
  } | null;
};

type ListaInteracoes = 'abertas' | 'concluidas' | 'todas';
type SituacaoFiltro = 'qualquer' | InteracaoModal['status'];

function mapInteracaoStatusParaPainelSla(s: InteracaoModal['status']): string {
  if (s === 'concluida' || s === 'cancelada') return 'concluido';
  if (s === 'em_andamento') return 'em_andamento';
  return 'nao_iniciada';
}

export type KanbanCardModalProps = {
  cardId: string;
  kanbanNome: KanbanNomeDisplay;
  onClose: () => void;
  /** Se não vier, as fases são carregadas do banco após obter o card. */
  fases?: KanbanFase[];
  isAdmin?: boolean;
  /** Rota do kanban (ex.: `/funil-stepone`) — usada em links auxiliares. */
  basePath?: string;
  legacyPanelHref?: string;
  camposPorFase?: CamposPorFaseMap;
  /** `legado`: card é `processo_step_one` (view); não usa `kanban_cards`. */
  origem?: 'legado' | 'nativo';
};

export function KanbanCardModal({
  cardId,
  kanbanNome,
  onClose,
  fases: fasesProp,
  isAdmin = false,
  basePath = '/',
  legacyPanelHref = '/painel-novos-negocios',
  camposPorFase,
  origem = 'nativo',
}: KanbanCardModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<Card | null>(null);
  const [fases, setFases] = useState<KanbanFase[]>(fasesProp ?? []);
  const [faseAtual, setFaseAtual] = useState<KanbanFase | null>(null);
  const [secaoAberta, setSecaoAberta] = useState<Record<SecaoEsquerdaId, boolean>>({
    franqueado: true,
    novoNegocio: true,
    preObra: true,
    obra: false,
    relacionamentos: true,
    historico: true,
  });
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [comentariosCard, setComentariosCard] = useState<ComentarioCardRow[]>([]);
  const [novoComentarioCard, setNovoComentarioCard] = useState('');
  const [salvandoComentario, setSalvandoComentario] = useState(false);
  const [interacoes, setInteracoes] = useState<InteracaoModal[]>([]);
  const [kanbanTimes, setKanbanTimes] = useState<KanbanTimeRow[]>([]);
  const [responsaveisOpcoes, setResponsaveisOpcoes] = useState<{ id: string; nome: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    descricao: '',
    tipo: 'atividade' as 'atividade' | 'duvida',
    data: '',
    timesIds: [] as string[],
    responsaveisIds: [] as string[],
    trava: false,
  });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [novaInteracao, setNovaInteracao] = useState({
    titulo: '',
    tipo: 'atividade' as 'atividade' | 'duvida',
    data: '',
    timesIds: [] as string[],
    responsaveisIds: [] as string[],
    trava: false,
    status: 'pendente' as const,
  });
  const [subInteracoesPorPai, setSubInteracoesPorPai] = useState<Record<string, SubInteracaoModal[]>>({});
  const [subExpandida, setSubExpandida] = useState<Record<string, boolean>>({});
  const [subFormInteracaoId, setSubFormInteracaoId] = useState<string | null>(null);
  const [subNovaDraft, setSubNovaDraft] = useState({
    titulo: '',
    timesIds: [] as string[],
    responsaveisIds: [] as string[],
    data: '',
    trava: false,
  });
  const [salvandoSub, setSalvandoSub] = useState(false);
  const [filtros, setFiltros] = useState<{
    lista: ListaInteracoes;
    situacao: SituacaoFiltro;
    time: string;
    responsavel: string;
    ordenacao: string;
  }>({
    lista: 'abertas',
    situacao: 'qualquer',
    time: 'todos',
    responsavel: 'todos',
    ordenacao: 'prazo_asc',
  });

  useEffect(() => {
    if (filtros.lista === 'abertas' && filtros.situacao === 'concluida') {
      setFiltros((f) => ({ ...f, situacao: 'qualquer' }));
    }
  }, [filtros.lista, filtros.situacao]);

  useEffect(() => {
    if (fasesProp?.length) setFases(fasesProp);
  }, [fasesProp]);

  useEffect(() => {
    void loadCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, origem]);

  async function loadCard() {
    setLoading(true);
    try {
      const supabase = createClient();

      type LoadedShape = {
        id: string;
        titulo: string;
        status: string;
        created_at: string;
        fase_id: string;
        franqueado_id: string;
        kanban_id: string;
        etapa_slug: string | null;
      };

      let loaded: LoadedShape | null = null;

      if (origem === 'legado') {
        const { data: vRow, error: vErr } = await supabase
          .from('v_processo_como_kanban_cards')
          .select('id, titulo, status, criado_em, fase_id, responsavel_id, kanban_id, etapa_slug, origem')
          .eq('id', cardId)
          .maybeSingle();

        if (vErr || !vRow) {
          alert('Processo não encontrado');
          onClose();
          return;
        }

        loaded = {
          id: String(vRow.id),
          titulo: String((vRow as { titulo?: string | null }).titulo ?? ''),
          status: String((vRow as { status?: string | null }).status ?? ''),
          created_at: String((vRow as { criado_em?: string | null }).criado_em ?? ''),
          fase_id: String((vRow as { fase_id?: string | null }).fase_id ?? ''),
          franqueado_id: String((vRow as { responsavel_id?: string | null }).responsavel_id ?? ''),
          kanban_id: String((vRow as { kanban_id?: string | null }).kanban_id ?? ''),
          etapa_slug:
            (vRow as { etapa_slug?: string | null }).etapa_slug != null
              ? String((vRow as { etapa_slug?: string | null }).etapa_slug)
              : null,
        };
      } else {
        const { data: cardData, error: cardError } = await supabase
          .from('kanban_cards')
          .select('id, titulo, status, created_at, fase_id, franqueado_id, kanban_id')
          .eq('id', cardId)
          .single();

        if (cardError || !cardData) {
          alert('Card não encontrado');
          onClose();
          return;
        }

        loaded = {
          id: String(cardData.id),
          titulo: String(cardData.titulo ?? ''),
          status: String(cardData.status ?? ''),
          created_at: String(cardData.created_at ?? ''),
          fase_id: String(cardData.fase_id ?? ''),
          franqueado_id: String(cardData.franqueado_id ?? ''),
          kanban_id: String(cardData.kanban_id ?? ''),
          etapa_slug: null,
        };
      }

      let profiles: Card['profiles'] = null;
      if (isAdmin && loaded.franqueado_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', loaded.franqueado_id)
          .single();
        profiles = profileData ?? null;
      }

      setCard({
        id: loaded.id,
        titulo: loaded.titulo,
        status: loaded.status,
        created_at: loaded.created_at,
        fase_id: loaded.fase_id,
        franqueado_id: loaded.franqueado_id,
        kanban_id: loaded.kanban_id,
        etapa_slug: loaded.etapa_slug,
        profiles,
      });

      if (!fasesProp?.length) {
        const { data: fasesData } = await supabase
          .from('kanban_fases')
          .select('id, nome, ordem, sla_dias, slug')
          .eq('kanban_id', loaded.kanban_id)
          .eq('ativo', true)
          .order('ordem');
        setFases((fasesData ?? []) as KanbanFase[]);
        const faseEncontrada = fasesData?.find((f) => f.id === loaded.fase_id) || null;
        setFaseAtual(faseEncontrada as KanbanFase | null);
      } else {
        setFases(fasesProp);
        const faseEncontrada = fasesProp.find((f) => f.id === loaded.fase_id) || null;
        setFaseAtual(faseEncontrada);
      }

      let cacheKanbanTimes: KanbanTimeRow[] = [];
      try {
        const { data: kt } = await supabase.from('kanban_times').select('id, nome').order('nome');
        cacheKanbanTimes = (kt ?? []).map((r) => ({ id: String(r.id), nome: String(r.nome) }));
        setKanbanTimes(cacheKanbanTimes);
      } catch {
        setKanbanTimes([]);
      }
      const nomePorTimeId = new Map(cacheKanbanTimes.map((t) => [t.id, t.nome]));

      try {
        const { data: profOpts, error: profOptsErr } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .order('full_name', { ascending: true, nullsFirst: false })
          .limit(500);
        if (profOptsErr) throw profOptsErr;
        setResponsaveisOpcoes(
          (profOpts ?? []).map((p) => {
            const fn = String((p as { full_name?: string | null }).full_name ?? '').trim();
            const em = String((p as { email?: string | null }).email ?? '').trim();
            return {
              id: String((p as { id: string }).id),
              nome: fn || em || String((p as { id: string }).id).slice(0, 8),
            };
          }),
        );
      } catch {
        setResponsaveisOpcoes([]);
      }

      try {
        const { data: histRows, error: histErr } = await supabase
          .from('kanban_historico')
          .select('id, acao, usuario_nome, detalhe, criado_em')
          .eq('card_id', cardId)
          .order('criado_em', { ascending: false });
        if (histErr) setHistorico([]);
        else {
          setHistorico(
            (histRows ?? []).map((h) => ({
              id: String(h.id),
              acao: String(h.acao),
              usuario_nome: (h.usuario_nome as string | null) ?? null,
              detalhe: (h.detalhe as Record<string, unknown> | null) ?? null,
              criado_em: String(h.criado_em),
            })),
          );
        }
      } catch {
        setHistorico([]);
      }

      try {
        const { data: comRows, error: comErr } = await supabase
          .from('kanban_card_comentarios')
          .select('id, texto, created_at, fase_id, autor_id')
          .eq('card_id', cardId)
          .order('created_at', { ascending: false });
        if (comErr || !comRows?.length) {
          setComentariosCard([]);
        } else {
          const autorIds = [...new Set(comRows.map((c) => c.autor_id).filter(Boolean))] as string[];
          let nomePorId = new Map<string, string>();
          if (autorIds.length > 0) {
            const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', autorIds);
            nomePorId = new Map((profs ?? []).map((p) => [p.id, (p.full_name as string | null)?.trim() || '']));
          }
          setComentariosCard(
            comRows.map((c) => ({
              id: String(c.id),
              texto: String(c.texto ?? ''),
              created_at: String(c.created_at),
              fase_id: c.fase_id ? String(c.fase_id) : null,
              autor_id: c.autor_id ? String(c.autor_id) : null,
              autor_nome: c.autor_id ? nomePorId.get(String(c.autor_id)) ?? null : null,
            })),
          );
        }
      } catch {
        setComentariosCard([]);
      }

      try {
        const origemAtividade = origem === 'legado' ? 'legado' : 'nativo';
        const { data: interacoesData, error: interacoesError } = await supabase
          .from('kanban_atividades')
          .select(
            'id, titulo, descricao, tipo, times_ids, responsaveis_ids, trava, status, prioridade, data_vencimento, responsavel_id, time, created_at, concluida_em, origem',
          )
          .eq('card_id', cardId)
          .eq('origem', origemAtividade)
          .order('ordem', { ascending: true });

        if (interacoesError || !interacoesData?.length) {
          setInteracoes(interacoesDemonstracao());
          setSubInteracoesPorPai({});
        } else {
          const rawRespArrays = interacoesData.map((a) => (a as { responsaveis_ids?: unknown }).responsaveis_ids);
          const respFromArrays = rawRespArrays.flatMap((arr) =>
            Array.isArray(arr) ? arr.map((x) => String(x)) : [],
          );
          const responsavelIds = [
            ...new Set([
              ...interacoesData.map((a) => a.responsavel_id).filter(Boolean),
              ...respFromArrays,
            ]),
          ] as string[];
          let responsaveisMap = new Map<string, { full_name: string | null }>();
          if (responsavelIds.length > 0) {
            const { data: responsaveisData } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', responsavelIds);
            responsaveisMap = new Map(responsaveisData?.map((r) => [r.id, { full_name: r.full_name }]) || []);
          }
          const mapeadas: InteracaoModal[] = interacoesData.map((a) => {
            const rawIds = (a as { times_ids?: unknown }).times_ids;
            const ids = Array.isArray(rawIds) ? rawIds.map((x) => String(x)) : [];
            const rawR = (a as { responsaveis_ids?: unknown }).responsaveis_ids;
            let respIds = Array.isArray(rawR) ? rawR.map((x) => String(x)) : [];
            const rid = a.responsavel_id ? String(a.responsavel_id) : null;
            if (respIds.length === 0 && rid) respIds = [rid];
            const tipoRaw = (a as { tipo?: string }).tipo;
            const tipo: 'atividade' | 'duvida' = tipoRaw === 'duvida' ? 'duvida' : 'atividade';
            const times_resolvidos = ids.map((id) => ({ id, nome: nomePorTimeId.get(id) ?? id.slice(0, 8) }));
            const responsaveis_resolvidos = respIds.map((id) => ({
              id,
              nome: responsaveisMap.get(id)?.full_name?.trim() || id.slice(0, 8),
            }));
            const primeiroResp = respIds[0] ?? rid;
            return {
              id: String(a.id),
              titulo: String(a.titulo ?? ''),
              descricao: (a.descricao as string | null) ?? null,
              tipo,
              times_ids: ids,
              responsaveis_ids: respIds,
              trava: Boolean((a as { trava?: boolean }).trava),
              status: a.status as InteracaoModal['status'],
              prioridade: (a.prioridade as InteracaoModal['prioridade']) ?? 'normal',
              data_vencimento: (a.data_vencimento as string | null) ?? null,
              responsavel_id: rid,
              time: (a.time as string | null) ?? null,
              created_at: String(a.created_at),
              concluida_em: (a.concluida_em as string | null) ?? null,
              profiles: primeiroResp ? responsaveisMap.get(primeiroResp) ?? null : null,
              times_resolvidos,
              responsaveis_resolvidos,
            };
          });
          setInteracoes(mapeadas);

          const actIds = mapeadas.map((m) => m.id);
          const { data: topicosRows } = await supabase
            .from('sirene_topicos')
            .select('id, interacao_id, descricao, times_ids, responsaveis_ids, data_fim, status, trava')
            .in('interacao_id', actIds)
            .order('ordem', { ascending: true });

          const topicos = topicosRows ?? [];
          const tRespIds = [
            ...new Set(
              topicos.flatMap((t) => {
                const arr = (t as { responsaveis_ids?: unknown }).responsaveis_ids;
                return Array.isArray(arr) ? arr.map((x) => String(x)) : [];
              }),
            ),
          ] as string[];
          const tTimeIds = [
            ...new Set(
              topicos.flatMap((t) => {
                const arr = (t as { times_ids?: unknown }).times_ids;
                return Array.isArray(arr) ? arr.map((x) => String(x)) : [];
              }),
            ),
          ] as string[];
          let profTop = new Map<string, { full_name: string | null }>();
          if (tRespIds.length > 0) {
            const { data: pr } = await supabase.from('profiles').select('id, full_name').in('id', tRespIds);
            profTop = new Map((pr ?? []).map((r) => [String((r as { id: string }).id), { full_name: (r as { full_name?: string | null }).full_name ?? null }]));
          }
          const timeTopMap = new Map(cacheKanbanTimes.map((t) => [t.id, t.nome]));
          const porPai: Record<string, SubInteracaoModal[]> = {};
          for (const t of topicos) {
            const iid = String((t as { interacao_id: string }).interacao_id);
            const rawTi = (t as { times_ids?: unknown }).times_ids;
            const ti = Array.isArray(rawTi) ? rawTi.map((x) => String(x)) : [];
            const rawRi = (t as { responsaveis_ids?: unknown }).responsaveis_ids;
            let ri = Array.isArray(rawRi) ? rawRi.map((x) => String(x)) : [];
            const st = String((t as { status?: string }).status ?? 'nao_iniciado') as SubInteracaoStatusDb;
            const row: SubInteracaoModal = {
              id: String((t as { id: number }).id),
              interacao_id: iid,
              descricao: String((t as { descricao?: string }).descricao ?? ''),
              times_ids: ti,
              responsaveis_ids: ri,
              times_resolvidos: ti.map((id) => ({ id, nome: timeTopMap.get(id) ?? id.slice(0, 8) })),
              responsaveis_resolvidos: ri.map((id) => ({
                id,
                nome: profTop.get(id)?.full_name?.trim() || id.slice(0, 8),
              })),
              data_fim: (t as { data_fim?: string | null }).data_fim != null ? String((t as { data_fim: string }).data_fim).slice(0, 10) : null,
              status: ['nao_iniciado', 'em_andamento', 'concluido', 'aprovado'].includes(st) ? st : 'nao_iniciado',
              trava: Boolean((t as { trava?: boolean }).trava),
            };
            if (!porPai[iid]) porPai[iid] = [];
            porPai[iid]!.push(row);
          }
          setSubInteracoesPorPai(porPai);
        }
      } catch {
        setInteracoes(interacoesDemonstracao());
        setSubInteracoesPorPai({});
      }
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!card || !fasesProp?.length) return;
    const f = fasesProp.find((x) => x.id === card.fase_id) ?? null;
    setFaseAtual(f);
  }, [card, fasesProp]);

  async function handleAdicionarInteracao() {
    if (!card || !novaInteracao.titulo.trim()) return;
    setLoading(true);
    try {
      const ordemReal = interacoes.filter((a) => !isInteracaoDemonstracao(a.id)).length;
      const res = await criarInteracao({
        card_id: card.id,
        titulo: novaInteracao.titulo.trim(),
        tipo: novaInteracao.tipo,
        times_ids: novaInteracao.timesIds,
        data_vencimento: novaInteracao.data || null,
        responsaveis_ids: novaInteracao.responsaveisIds,
        trava: novaInteracao.trava,
        status: novaInteracao.status,
        ordem: ordemReal,
        basePath,
        origem,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setNovaInteracao({
        titulo: '',
        tipo: 'atividade',
        data: '',
        timesIds: [],
        responsaveisIds: [],
        trava: false,
        status: 'pendente',
      });
      await loadCard();
      router.refresh();
    } catch {
      alert('Erro ao criar chamado.');
    } finally {
      setLoading(false);
    }
  }

  function toggleNovaInteracaoTime(id: string) {
    setNovaInteracao((n) => ({
      ...n,
      timesIds: n.timesIds.includes(id) ? n.timesIds.filter((x) => x !== id) : [...n.timesIds, id],
    }));
  }

  function toggleEditDraftTime(id: string) {
    setEditDraft((e) => ({
      ...e,
      timesIds: e.timesIds.includes(id) ? e.timesIds.filter((x) => x !== id) : [...e.timesIds, id],
    }));
  }

  function toggleNovaInteracaoResponsavel(id: string) {
    setNovaInteracao((n) => ({
      ...n,
      responsaveisIds: n.responsaveisIds.includes(id)
        ? n.responsaveisIds.filter((x) => x !== id)
        : [...n.responsaveisIds, id],
    }));
  }

  function toggleEditDraftResponsavel(id: string) {
    setEditDraft((e) => ({
      ...e,
      responsaveisIds: e.responsaveisIds.includes(id)
        ? e.responsaveisIds.filter((x) => x !== id)
        : [...e.responsaveisIds, id],
    }));
  }

  function toggleSubNovaResponsavel(id: string) {
    setSubNovaDraft((s) => ({
      ...s,
      responsaveisIds: s.responsaveisIds.includes(id)
        ? s.responsaveisIds.filter((x) => x !== id)
        : [...s.responsaveisIds, id],
    }));
  }

  function toggleSubNovaTime(id: string) {
    setSubNovaDraft((s) => ({
      ...s,
      timesIds: s.timesIds.includes(id) ? s.timesIds.filter((x) => x !== id) : [...s.timesIds, id],
    }));
  }

  function abrirEdicaoInteracao(it: InteracaoModal) {
    setEditingId(it.id);
    const rids = [...(it.responsaveis_ids ?? [])];
    if (rids.length === 0 && it.responsavel_id) rids.push(it.responsavel_id);
    setEditDraft({
      descricao: it.descricao ?? '',
      tipo: it.tipo,
      data: it.data_vencimento ? String(it.data_vencimento).slice(0, 10) : '',
      timesIds: [...(it.times_ids ?? [])],
      responsaveisIds: rids,
      trava: it.trava,
    });
  }

  async function salvarEdicaoInteracao() {
    if (!editingId) return;
    setSalvandoEdicao(true);
    try {
      const res = await editarInteracao(editingId, {
        descricao: editDraft.descricao.trim() || null,
        tipo: editDraft.tipo,
        data_vencimento: editDraft.data.trim() || null,
        times_ids: editDraft.timesIds,
        responsaveis_ids: editDraft.responsaveisIds,
        trava: editDraft.trava,
        basePath,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setEditingId(null);
      await loadCard();
      router.refresh();
    } catch {
      alert('Erro ao salvar chamado.');
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function handleCriarSubInteracao(interacaoId: string) {
    if (!subNovaDraft.titulo.trim()) return;
    setSalvandoSub(true);
    try {
      const res = await criarSubInteracao({
        interacao_id: interacaoId,
        descricao: subNovaDraft.titulo.trim(),
        times_ids: subNovaDraft.timesIds,
        responsaveis_ids: subNovaDraft.responsaveisIds,
        data_fim: subNovaDraft.data.trim() || null,
        trava: subNovaDraft.trava,
        basePath,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setSubFormInteracaoId(null);
      setSubNovaDraft({ titulo: '', timesIds: [], responsaveisIds: [], data: '', trava: false });
      await loadCard();
      router.refresh();
    } catch {
      alert('Erro ao criar sub-chamado.');
    } finally {
      setSalvandoSub(false);
    }
  }

  async function handleSubStatusChange(topicoId: string, status: SubInteracaoStatusDb) {
    const res = await atualizarStatusSubInteracao(topicoId, status, basePath);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    await loadCard();
    router.refresh();
  }

  async function handleAvancarFase() {
    if (!card || !faseAtual) return;
    const proximaFase = fases.find((f) => f.ordem === faseAtual.ordem + 1);
    if (!proximaFase) {
      alert('Esta é a última fase do funil.');
      return;
    }
    if (!confirm(`Avançar para a fase "${proximaFase.nome}"?`)) return;
    setLoading(true);
    try {
      const supabase = createClient();
      if (origem === 'legado') {
        const slug = proximaFase.slug?.trim();
        if (!slug) {
          alert('Esta fase não tem slug cadastrado; não é possível avançar o processo por aqui.');
          return;
        }
        const { error } = await supabase.from('processo_step_one').update({ etapa_painel: slug }).eq('id', card.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('kanban_cards').update({ fase_id: proximaFase.id }).eq('id', card.id);
        if (error) throw error;
      }
      await loadCard();
      router.refresh();
    } catch {
      alert('Erro ao avançar fase.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRetrocederFase() {
    if (!card || !faseAtual) return;
    const faseAnterior = fases.find((f) => f.ordem === faseAtual.ordem - 1);
    if (!faseAnterior) {
      alert('Esta é a primeira fase do funil.');
      return;
    }
    if (!confirm(`Voltar para a fase "${faseAnterior.nome}"?`)) return;
    setLoading(true);
    try {
      const supabase = createClient();
      if (origem === 'legado') {
        const slug = faseAnterior.slug?.trim();
        if (!slug) {
          alert('Esta fase não tem slug cadastrado; não é possível retroceder o processo por aqui.');
          return;
        }
        const { error } = await supabase.from('processo_step_one').update({ etapa_painel: slug }).eq('id', card.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('kanban_cards').update({ fase_id: faseAnterior.id }).eq('id', card.id);
        if (error) throw error;
      }
      await loadCard();
      router.refresh();
    } catch {
      alert('Erro ao retroceder fase.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnviarComentarioCard() {
    if (!card || !novoComentarioCard.trim()) return;
    setSalvandoComentario(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert('Faça login para comentar.');
        return;
      }
      const { error } = await supabase.from('kanban_card_comentarios').insert({
        card_id: card.id,
        fase_id: card.fase_id,
        autor_id: user.id,
        texto: novoComentarioCard.trim(),
      });
      if (error) throw error;
      setNovoComentarioCard('');
      await loadCard();
      router.refresh();
    } catch {
      alert('Não foi possível salvar o comentário.');
    } finally {
      setSalvandoComentario(false);
    }
  }

  async function handleArquivar() {
    if (!card || origem === 'legado') return;
    if (!confirm('Tem certeza que deseja arquivar este card?')) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('kanban_cards').update({ status: 'arquivado' }).eq('id', card.id);
      if (error) throw error;
      router.refresh();
      onClose();
    } catch {
      alert('Erro ao arquivar.');
    } finally {
      setLoading(false);
    }
  }

  function toggleSecaoEsquerda(id: SecaoEsquerdaId) {
    setSecaoAberta((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const interacoesFiltradas = useMemo(() => {
    const situacaoEfetiva: SituacaoFiltro =
      filtros.lista === 'concluidas' ? 'qualquer' : filtros.situacao;
    const prazoTs = (a: InteracaoModal) => {
      if (!a.data_vencimento) return Number.POSITIVE_INFINITY;
      const t = new Date(a.data_vencimento).getTime();
      return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
    };
    const filtered = interacoes.filter((it) => {
      const concl = it.status === 'concluida';
      if (filtros.lista === 'abertas') {
        if (concl) return false;
        if (situacaoEfetiva !== 'qualquer' && it.status !== situacaoEfetiva) return false;
      } else if (filtros.lista === 'concluidas') {
        if (!concl) return false;
      } else if (situacaoEfetiva !== 'qualquer' && it.status !== situacaoEfetiva) {
        return false;
      }
      if (!interacaoPassaFiltroTime(it, filtros.time, kanbanTimes)) return false;
      if (filtros.responsavel !== 'todos') {
        const ids = it.responsaveis_ids ?? [];
        if (!ids.includes(filtros.responsavel) && it.responsavel_id !== filtros.responsavel) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (filtros.lista === 'todas') {
        const ac = a.status === 'concluida';
        const bc = b.status === 'concluida';
        if (ac !== bc) return ac ? 1 : -1;
      }
      if (filtros.ordenacao === 'prazo_asc') return prazoTs(a) - prazoTs(b);
      if (filtros.ordenacao === 'prazo_desc') return prazoTs(b) - prazoTs(a);
      return 0;
    });
  }, [interacoes, filtros, kanbanTimes]);

  const faseNomePorId = useMemo(() => new Map(fases.map((f) => [f.id, f.nome])), [fases]);

  if (loading && !card) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="text-white">Carregando…</div>
      </div>
    );
  }

  if (!card) return null;

  const isLegado = origem === 'legado';
  const painelLegadoCompletoHref = `/painel-novos-negocios?abrir=${encodeURIComponent(card.id)}`;

  const createdDate = new Date(card.created_at);
  const slaCard = calcularStatusSLA(createdDate, faseAtual?.sla_dias ?? 999);
  const podeRetrocederFase = Boolean(faseAtual && fases.some((f) => f.ordem === faseAtual.ordem - 1));
  const podeAvancarFase = Boolean(faseAtual && fases.some((f) => f.ordem === faseAtual.ordem + 1));
  const cardTitulo = card.titulo;
  const checklistExtra = card.fase_id && camposPorFase?.[card.fase_id];

  const secaoHead = (id: SecaoEsquerdaId, label: string, body: ReactNode) => (
    <div
      className="mb-3 overflow-hidden rounded-lg bg-white"
      style={{
        border: '0.5px solid var(--moni-border-default)',
        boxShadow: 'var(--moni-shadow-sm)',
      }}
    >
      <button
        type="button"
        onClick={() => toggleSecaoEsquerda(id)}
        className="flex w-full items-center gap-2 p-3 text-left transition hover:bg-stone-50"
      >
        {secaoAberta[id] ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-stone-500" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-stone-500" aria-hidden />
        )}
        <span className="text-sm font-semibold text-stone-800">{label}</span>
      </button>
      {secaoAberta[id] ? (
        <div className="border-t px-3 pb-3 pt-2 text-sm text-stone-600" style={{ borderColor: 'var(--moni-border-subtle)' }}>
          {body}
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="moni-card-modal-split relative flex h-[90vh] w-full flex-col overflow-hidden bg-white sm:flex-row"
        style={{
          maxWidth: 'var(--moni-card-modal-max)',
          borderRadius: 'var(--moni-radius-xl)',
          border: '0.5px solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kanban-card-modal-title"
      >
        <div
          className="absolute left-0 right-0 top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white px-6 py-4"
          style={{
            borderColor: 'var(--moni-border-default)',
            borderTopLeftRadius: 'var(--moni-radius-xl)',
            borderTopRightRadius: 'var(--moni-radius-xl)',
          }}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <h2 id="kanban-card-modal-title" className="min-w-0 truncate text-base font-semibold sm:text-lg" style={{ color: 'var(--moni-text-primary)' }}>
              {cardTitulo}
            </h2>
            <span
              className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{
                background: 'var(--moni-surface-100)',
                color: 'var(--moni-text-secondary)',
                border: '0.5px solid var(--moni-border-default)',
              }}
            >
              {kanbanNome}
            </span>
            {isLegado ? (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide"
                style={{
                  background: 'var(--moni-surface-50)',
                  color: 'var(--moni-text-tertiary)',
                  border: '0.5px solid var(--moni-border-subtle)',
                }}
              >
                Legado
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-full w-full flex-col sm:flex-row" style={{ paddingTop: '70px' }}>
          {/* Centro — conteúdo principal (mobile: primeiro) */}
          <div
            className="moni-card-modal-center order-1 flex h-full min-h-0 flex-1 flex-col overflow-y-auto p-6 sm:order-2 sm:min-w-0"
            style={{ background: 'var(--moni-surface-0)' }}
          >
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {faseAtual ? (
                <span
                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold"
                  style={{
                    background: 'var(--moni-gold-50)',
                    color: 'var(--moni-gold-800)',
                    border: '0.5px solid var(--moni-gold-400)',
                    borderRadius: 'var(--moni-radius-pill)',
                  }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {faseAtual.nome}
                </span>
              ) : null}
              {slaCard.label && slaCard.status !== 'ok' ? (
                <span className={slaCard.classe}>{slaCard.label}</span>
              ) : null}
            </div>

            <div className="mb-6">
              <h4 className="mb-3 text-sm font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
                Checklist / itens estruturais da fase
              </h4>
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'var(--moni-surface-50)',
                  border: '0.5px solid var(--moni-border-default)',
                }}
              >
                {checklistExtra ?? (
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 rounded bg-white" disabled />
                      <span style={{ color: 'var(--moni-text-primary)' }}>Item do checklist 1</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 rounded bg-white" disabled />
                      <span style={{ color: 'var(--moni-text-primary)' }}>Item do checklist 2</span>
                    </label>
                    <p className="mt-3 text-xs italic" style={{ color: 'var(--moni-text-tertiary)' }}>
                      Conteúdo padrão — passe <code className="rounded bg-white/60 px-1">camposPorFase</code> por fase no{' '}
                      <code className="rounded bg-white/60 px-1">KanbanBoard</code>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6 flex-1">
              <h4 className="mb-3 text-sm font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
                Chamados vinculados
              </h4>
              {interacoes.some((a) => isInteracaoDemonstracao(a.id)) ? (
                <p
                  className="mb-3 rounded-lg border px-3 py-2 text-xs"
                  style={{
                    borderColor: 'var(--moni-status-attention-border)',
                    background: 'var(--moni-status-attention-bg)',
                    color: 'var(--moni-status-attention-text)',
                  }}
                >
                  <strong>Exemplos:</strong> não há linhas em <code className="rounded bg-white/50 px-1">kanban_atividades</code> para este
                  card. Ao gravar um chamado real, os exemplos somem após recarregar.
                </p>
              ) : null}

              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-5">
                <div>
                  <label className="mb-1 block text-xs text-stone-600">Lista</label>
                  <select
                    value={filtros.lista}
                    onChange={(e) => setFiltros({ ...filtros, lista: e.target.value as ListaInteracoes })}
                    className="w-full px-3 py-1.5 text-xs focus:outline-none"
                    style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
                  >
                    <option value="abertas">Em aberto</option>
                    <option value="concluidas">Somente concluídas</option>
                    <option value="todas">Todas</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-600">Situação</label>
                  <select
                    value={filtros.lista === 'concluidas' ? 'qualquer' : filtros.situacao}
                    disabled={filtros.lista === 'concluidas'}
                    onChange={(e) => setFiltros({ ...filtros, situacao: e.target.value as SituacaoFiltro })}
                    className="w-full px-3 py-1.5 text-xs focus:outline-none disabled:opacity-60"
                    style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
                  >
                    <option value="qualquer">Qualquer</option>
                    <option value="pendente">Pendente</option>
                    <option value="em_andamento">Em andamento</option>
                    {filtros.lista !== 'abertas' ? <option value="concluida">Concluída</option> : null}
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-600">Time</label>
                  <select
                    value={filtros.time}
                    onChange={(e) => setFiltros({ ...filtros, time: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs"
                    style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
                  >
                    <option value="todos">Todos</option>
                    {kanbanTimes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-600">Responsável (qualquer)</label>
                  <select
                    value={filtros.responsavel}
                    onChange={(e) => setFiltros({ ...filtros, responsavel: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs"
                    style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
                  >
                    <option value="todos">Todos</option>
                    {responsaveisOpcoes.length === 0 ? (
                      <option value="" disabled>
                        Nenhum usuário encontrado
                      </option>
                    ) : (
                      responsaveisOpcoes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-stone-600">Ordenar</label>
                  <select
                    value={filtros.ordenacao}
                    onChange={(e) => setFiltros({ ...filtros, ordenacao: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs"
                    style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
                  >
                    <option value="prazo_asc">Prazo ↑</option>
                    <option value="prazo_desc">Prazo ↓</option>
                  </select>
                </div>
              </div>

              {interacoesFiltradas.length > 0 ? (
                <div className="mb-4 space-y-2">
                  {interacoesFiltradas.map((it) => {
                    const prazoBr =
                      it.data_vencimento &&
                      (() => {
                        const d = new Date(it.data_vencimento);
                        return Number.isFinite(d.getTime())
                          ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                          : null;
                      })();
                    const avKind = resolveAtividadeVinculadaKind({
                      concluido: it.status === 'concluida',
                      status: it.status,
                      prazo: prazoBr,
                      prioridade: it.prioridade,
                    });
                    const slaLegacy = slaInteracaoBadge(it.data_vencimento, it.status);
                    const slaDu = rotuloSlaInteracaoPainel(
                      it.data_vencimento ? String(it.data_vencimento).slice(0, 10) : null,
                      mapInteracaoStatusParaPainelSla(it.status),
                    );
                    const timeTags = tagsTimesParaLinha(it, kanbanTimes);
                    const demo = isInteracaoDemonstracao(it.id);
                    const subs = subInteracoesPorPai[it.id] ?? [];
                    return (
                      <AtividadeVinculadaCard key={it.id} kind={avKind} as="div">
                        <div className="flex items-start gap-2">
                          {!demo ? (
                            <button
                              type="button"
                              className="mt-0.5 shrink-0 rounded p-0.5 text-stone-500 hover:bg-stone-200"
                              aria-expanded={Boolean(subExpandida[it.id])}
                              onClick={() => setSubExpandida((s) => ({ ...s, [it.id]: !s[it.id] }))}
                            >
                              <ChevronRight
                                className={`h-4 w-4 transition-transform ${subExpandida[it.id] ? 'rotate-90' : ''}`}
                                aria-hidden
                              />
                            </button>
                          ) : (
                            <span className="mt-0.5 inline-block w-5 shrink-0" aria-hidden />
                          )}
                          <span className="mt-0.5 shrink-0">
                            <AtividadeVinculadaIcon kind={avKind} size="md" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="text-sm font-medium text-stone-800">{it.titulo}</h5>
                              {!demo ? (
                                <button
                                  type="button"
                                  onClick={() => abrirEdicaoInteracao(it)}
                                  className="shrink-0 rounded p-1 text-stone-500 hover:bg-stone-200"
                                  aria-label="Editar chamado"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              ) : null}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                                style={
                                  it.tipo === 'duvida'
                                    ? {
                                        background: 'var(--moni-gold-50)',
                                        color: 'var(--moni-gold-800)',
                                        border: '1px solid var(--moni-gold-200)',
                                      }
                                    : {
                                        background: 'var(--moni-status-active-bg)',
                                        color: 'var(--moni-status-active-text)',
                                        border: '1px solid var(--moni-status-active-border)',
                                      }
                                }
                              >
                                {it.tipo === 'duvida' ? 'Dúvida' : 'Atividade'}
                              </span>
                              {it.trava ? (
                                <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                                  Trava
                                </span>
                              ) : null}
                              {timeTags.map((tg) => (
                                <span
                                  key={`${it.id}-${tg.id}`}
                                  className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                                  style={{
                                    background: 'var(--moni-surface-100)',
                                    color: 'var(--moni-text-secondary)',
                                  }}
                                >
                                  {tg.nome}
                                </span>
                              ))}
                              {slaDu.variante !== 'nenhum' ? (
                                <span
                                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                  style={
                                    slaDu.variante === 'atrasado'
                                      ? {
                                          background: 'var(--moni-status-overdue-bg)',
                                          color: 'var(--moni-status-overdue-text)',
                                          border: '1px solid var(--moni-status-overdue-border)',
                                        }
                                      : {
                                          background: 'var(--moni-status-attention-bg)',
                                          color: 'var(--moni-status-attention-text)',
                                          border: '1px solid var(--moni-status-attention-border)',
                                        }
                                  }
                                >
                                  {slaDu.texto}
                                </span>
                              ) : null}
                            </div>
                            {editingId === it.id ? (
                              <div className="mt-3 space-y-2 rounded-lg border border-stone-200 p-3 bg-white">
                                <label className="block text-[10px] font-medium text-stone-500">Descrição</label>
                                <textarea
                                  value={editDraft.descricao}
                                  onChange={(e) => setEditDraft((d) => ({ ...d, descricao: e.target.value }))}
                                  rows={2}
                                  className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
                                />
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <select
                                    value={editDraft.tipo}
                                    onChange={(e) =>
                                      setEditDraft((d) => ({ ...d, tipo: e.target.value as 'atividade' | 'duvida' }))
                                    }
                                    className="rounded border border-stone-300 px-2 py-1 text-xs"
                                  >
                                    <option value="atividade">Atividade</option>
                                    <option value="duvida">Dúvida</option>
                                  </select>
                                  <input
                                    type="date"
                                    value={editDraft.data}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, data: e.target.value }))}
                                    className="rounded border border-stone-300 px-2 py-1 text-xs"
                                  />
                                </div>
                                <div>
                                  <span className="mb-1 block text-[10px] font-medium text-stone-500">Times</span>
                                  <div className="flex flex-wrap gap-1">
                                    {kanbanTimes.map((t) => {
                                      const on = editDraft.timesIds.includes(t.id);
                                      return (
                                        <button
                                          key={t.id}
                                          type="button"
                                          onClick={() => toggleEditDraftTime(t.id)}
                                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                            on ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600'
                                          }`}
                                        >
                                          {t.nome}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div>
                                  <span className="mb-1 block text-[10px] font-medium text-stone-500">Responsáveis</span>
                                  {responsaveisOpcoes.length === 0 ? (
                                    <p className="text-[10px] text-stone-500">Nenhum usuário encontrado</p>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {responsaveisOpcoes.map((p) => {
                                        const on = editDraft.responsaveisIds.includes(p.id);
                                        return (
                                          <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => toggleEditDraftResponsavel(p.id)}
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                              on ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600'
                                            }`}
                                          >
                                            {p.nome}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-700">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-stone-400"
                                    checked={editDraft.trava}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, trava: e.target.checked }))}
                                  />
                                  Trava — estou bloqueado até este chamado ser concluído
                                </label>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={salvandoEdicao}
                                    onClick={() => void salvarEdicaoInteracao()}
                                    className="rounded px-3 py-1.5 text-xs font-medium text-white"
                                    style={{ background: 'var(--moni-text-primary)' }}
                                  >
                                    {salvandoEdicao ? '…' : 'Salvar'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingId(null)}
                                    className="rounded border border-stone-300 px-3 py-1.5 text-xs"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : it.descricao ? (
                              <p className="mt-1 text-xs text-stone-600">{it.descricao}</p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              <AtividadeVinculadaStatusPill kind={avKind}>
                                {labelKanbanAtividadeParaPill(it.status)}
                              </AtividadeVinculadaStatusPill>
                              {it.data_vencimento ? (
                                <span className="text-stone-600">
                                  Prazo: {new Date(it.data_vencimento).toLocaleDateString('pt-BR')}
                                </span>
                              ) : (
                                <span className="text-stone-400">Sem prazo</span>
                              )}
                              {slaLegacy === 'atrasado' ? (
                                <span
                                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                  style={{ color: 'var(--moni-status-overdue-text)' }}
                                >
                                  Atrasado
                                </span>
                              ) : null}
                              {slaLegacy === 'vence_hoje' ? (
                                <span
                                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                                  style={{ color: 'var(--moni-status-attention-text)' }}
                                >
                                  Vence hoje
                                </span>
                              ) : null}
                              <span className="text-stone-600">
                                Resp.:{' '}
                                <span className="font-medium">
                                  {(it.responsaveis_resolvidos && it.responsaveis_resolvidos.length > 0
                                    ? it.responsaveis_resolvidos.map((r) => r.nome).join(', ')
                                    : null) ||
                                    it.profiles?.full_name?.trim() ||
                                    '—'}
                                </span>
                              </span>
                            </div>
                            {!demo && subExpandida[it.id] ? (
                              <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50/80 p-3">
                                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                                  Sub-chamados ({subs.length})
                                </p>
                                {subs.length > 0 ? (
                                  <ul className="mb-3 space-y-2">
                                    {subs.map((sub) => (
                                      <li
                                        key={sub.id}
                                        className="rounded-md border border-stone-200 bg-white px-2 py-2 text-xs"
                                      >
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                          <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              {sub.trava ? (
                                                <span className="rounded border border-red-300 bg-red-50 px-1 py-0.5 text-[9px] font-bold uppercase text-red-700">
                                                  Trava
                                                </span>
                                              ) : null}
                                              <span className="font-medium text-stone-800">{sub.descricao}</span>
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                              {sub.times_resolvidos.map((tg) => (
                                                <span
                                                  key={`${sub.id}-${tg.id}`}
                                                  className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600"
                                                >
                                                  {tg.nome}
                                                </span>
                                              ))}
                                            </div>
                                            <p className="mt-1 text-[10px] text-stone-500">
                                              Resp.:{' '}
                                              {sub.responsaveis_resolvidos.length > 0
                                                ? sub.responsaveis_resolvidos.map((r) => r.nome).join(', ')
                                                : '—'}
                                            </p>
                                            {sub.data_fim ? (
                                              <p className="text-[10px] text-stone-500">
                                                Prazo:{' '}
                                                {new Date(sub.data_fim).toLocaleDateString('pt-BR')}
                                              </p>
                                            ) : (
                                              <p className="text-[10px] text-stone-400">Sem prazo</p>
                                            )}
                                          </div>
                                          <select
                                            value={sub.status}
                                            onChange={(e) =>
                                              void handleSubStatusChange(sub.id, e.target.value as SubInteracaoStatusDb)
                                            }
                                            className="rounded border border-stone-300 px-1.5 py-1 text-[10px]"
                                          >
                                            <option value="nao_iniciado">Não iniciado</option>
                                            <option value="em_andamento">Em andamento</option>
                                            <option value="concluido">Concluído</option>
                                            <option value="aprovado">Aprovado</option>
                                          </select>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mb-3 text-[11px] text-stone-500">Nenhum sub-chamado.</p>
                                )}
                                {subFormInteracaoId === it.id ? (
                                  <div className="space-y-2 border-t border-stone-200 pt-3">
                                    <p className="text-[10px] font-semibold text-stone-600">Novo sub-chamado</p>
                                    <input
                                      type="text"
                                      value={subNovaDraft.titulo}
                                      onChange={(e) => setSubNovaDraft((s) => ({ ...s, titulo: e.target.value }))}
                                      placeholder="Título (obrigatório)"
                                      className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
                                    />
                                    <input
                                      type="date"
                                      value={subNovaDraft.data}
                                      onChange={(e) => setSubNovaDraft((s) => ({ ...s, data: e.target.value }))}
                                      className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
                                    />
                                    <div>
                                      <span className="mb-1 block text-[10px] text-stone-500">Times</span>
                                      <div className="flex flex-wrap gap-1">
                                        {kanbanTimes.map((t) => {
                                          const on = subNovaDraft.timesIds.includes(t.id);
                                          return (
                                            <button
                                              key={t.id}
                                              type="button"
                                              onClick={() => toggleSubNovaTime(t.id)}
                                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                on ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600'
                                              }`}
                                            >
                                              {t.nome}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="mb-1 block text-[10px] text-stone-500">Responsáveis</span>
                                      {responsaveisOpcoes.length === 0 ? (
                                        <p className="text-[10px] text-stone-500">Nenhum usuário encontrado</p>
                                      ) : (
                                        <div className="flex flex-wrap gap-1">
                                          {responsaveisOpcoes.map((p) => {
                                            const on = subNovaDraft.responsaveisIds.includes(p.id);
                                            return (
                                              <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => toggleSubNovaResponsavel(p.id)}
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                  on ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600'
                                                }`}
                                              >
                                                {p.nome}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-stone-700">
                                      <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5"
                                        checked={subNovaDraft.trava}
                                        onChange={(e) => setSubNovaDraft((s) => ({ ...s, trava: e.target.checked }))}
                                      />
                                      Trava — estou bloqueado até este chamado ser concluído
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={salvandoSub || !subNovaDraft.titulo.trim()}
                                        onClick={() => void handleCriarSubInteracao(it.id)}
                                        className="rounded px-3 py-1.5 text-[11px] font-medium text-white disabled:opacity-50"
                                        style={{ background: 'var(--moni-text-primary)' }}
                                      >
                                        {salvandoSub ? '…' : 'Salvar sub-chamado'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSubFormInteracaoId(null);
                                          setSubNovaDraft({
                                            titulo: '',
                                            timesIds: [],
                                            responsaveisIds: [],
                                            data: '',
                                            trava: false,
                                          });
                                        }}
                                        className="rounded border border-stone-300 px-3 py-1.5 text-[11px]"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubFormInteracaoId(it.id);
                                      setSubNovaDraft({
                                        titulo: '',
                                        timesIds: [],
                                        responsaveisIds: [],
                                        data: '',
                                        trava: false,
                                      });
                                    }}
                                    className="text-[11px] font-medium text-stone-700 underline-offset-2 hover:underline"
                                  >
                                    + Sub-chamado
                                  </button>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </AtividadeVinculadaCard>
                    );
                  })}
                </div>
              ) : (
                <p className="mb-4 text-sm text-stone-500">Nenhum chamado para os filtros.</p>
              )}

              <div
                className="rounded-lg p-4"
                style={{
                  background: 'var(--moni-surface-50)',
                  border: '0.5px solid var(--moni-border-default)',
                }}
              >
                <p className="mb-2 text-xs font-semibold text-stone-600">Nova chamada</p>
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={novaInteracao.titulo}
                    onChange={(e) => setNovaInteracao({ ...novaInteracao, titulo: e.target.value })}
                    placeholder="Título / assunto"
                    className="w-full px-3 py-2 text-xs"
                    style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <select
                      value={novaInteracao.tipo}
                      onChange={(e) =>
                        setNovaInteracao({ ...novaInteracao, tipo: e.target.value as 'atividade' | 'duvida' })
                      }
                      className="px-3 py-2 text-xs"
                      style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
                    >
                      <option value="atividade">Atividade</option>
                      <option value="duvida">Dúvida</option>
                    </select>
                    <input
                      type="date"
                      value={novaInteracao.data}
                      onChange={(e) => setNovaInteracao({ ...novaInteracao, data: e.target.value })}
                      className="px-3 py-2 text-xs"
                      style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-[10px] font-medium text-stone-500">Responsáveis</span>
                    {responsaveisOpcoes.length === 0 ? (
                      <p className="text-xs text-stone-500">Nenhum usuário encontrado</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {responsaveisOpcoes.map((p) => {
                          const on = novaInteracao.responsaveisIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggleNovaInteracaoResponsavel(p.id)}
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${on ? 'bg-stone-800 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-300'}`}
                            >
                              {p.nome}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="mb-1 block text-[10px] font-medium text-stone-500">Times</span>
                    <div className="flex flex-wrap gap-1.5">
                      {kanbanTimes.map((t) => {
                        const on = novaInteracao.timesIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleNovaInteracaoTime(t.id)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${on ? 'bg-stone-800 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-300'}`}
                          >
                            {t.nome}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-stone-400"
                      checked={novaInteracao.trava}
                      onChange={(e) => setNovaInteracao({ ...novaInteracao, trava: e.target.checked })}
                    />
                    Trava — estou bloqueado até este chamado ser concluído
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleAdicionarInteracao()}
                    disabled={loading || !novaInteracao.titulo.trim()}
                    className="w-full px-4 py-2 text-xs font-medium text-white disabled:opacity-50 sm:w-auto"
                    style={{ background: 'var(--moni-text-primary)', borderRadius: 'var(--moni-radius-md)' }}
                  >
                    Adicionar chamada
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-auto border-t pt-4" style={{ borderColor: 'var(--moni-border-default)' }}>
              <h4 className="mb-3 text-sm font-semibold" style={{ color: 'var(--moni-text-secondary)' }}>
                Comentários
              </h4>
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'var(--moni-surface-50)',
                  border: '0.5px solid var(--moni-border-default)',
                }}
              >
                {comentariosCard.length > 0 ? (
                  <ul className="mb-4 max-h-48 space-y-3 overflow-y-auto">
                    {comentariosCard.map((c) => (
                      <li key={c.id} className="border-b border-stone-200/80 pb-3 text-sm last:border-0">
                        <p style={{ color: 'var(--moni-text-primary)' }}>{c.texto}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          {c.autor_nome?.trim() || 'Usuário'}
                          {c.fase_id && faseNomePorId.has(c.fase_id) ? ` · ${faseNomePorId.get(c.fase_id)}` : ''}
                          {' · '}
                          {formatDataHoraHistorico(c.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-4 text-xs text-stone-500">Nenhum comentário ainda.</p>
                )}
                <textarea
                  value={novoComentarioCard}
                  onChange={(e) => setNovoComentarioCard(e.target.value)}
                  placeholder="Escreva um comentário…"
                  rows={3}
                  className="w-full resize-none rounded-lg p-3 text-sm focus:outline-none"
                  style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}
                />
                <button
                  type="button"
                  onClick={() => void handleEnviarComentarioCard()}
                  disabled={salvandoComentario || !novoComentarioCard.trim()}
                  className="mt-2 w-full rounded-lg px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: 'var(--moni-text-primary)' }}
                >
                  {salvandoComentario ? 'Enviando…' : 'Publicar'}
                </button>
              </div>
            </div>

            {!isLegado ? (
              <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--moni-border-default)' }}>
                <button
                  type="button"
                  onClick={() => void handleArquivar()}
                  disabled={loading}
                  className="w-full px-6 py-2.5 text-sm font-medium disabled:opacity-50"
                  style={{
                    background: 'transparent',
                    color: 'var(--moni-status-overdue-text)',
                    border: '0.5px solid var(--moni-status-overdue-border)',
                    borderRadius: 'var(--moni-radius-md)',
                  }}
                >
                  Arquivar card
                </button>
              </div>
            ) : null}
          </div>

          {/* Direita — ações de movimento do card (mobile: após o centro) */}
          <aside
            className="moni-card-modal-acoes order-2 flex w-full shrink-0 flex-col gap-2 border-t p-4 sm:order-3 sm:h-full sm:w-[11.5rem] sm:border-l sm:border-t-0 sm:p-5"
            style={{
              borderColor: 'var(--moni-border-default)',
              background: 'var(--moni-surface-50)',
            }}
            aria-label="Ações do card"
          >
            <button
              type="button"
              onClick={() => void handleRetrocederFase()}
              disabled={loading || !podeRetrocederFase}
              className="w-full px-3 py-2.5 text-sm font-medium transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: 'var(--moni-surface-0)',
                color: 'var(--moni-text-primary)',
                border: '0.5px solid var(--moni-border-default)',
                borderRadius: 'var(--moni-radius-md)',
              }}
            >
              {loading ? '…' : 'Fase Anterior'}
            </button>
            <button
              type="button"
              onClick={() => void handleAvancarFase()}
              disabled={loading || !podeAvancarFase}
              className="w-full px-3 py-2.5 text-sm font-medium transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: 'var(--moni-surface-0)',
                color: 'var(--moni-green-800)',
                border: '0.5px solid var(--moni-green-400)',
                borderRadius: 'var(--moni-radius-md)',
              }}
            >
              {loading ? '…' : 'Próxima Fase'}
            </button>
            {isLegado ? (
              <Link
                href={painelLegadoCompletoHref}
                className="flex w-full items-center justify-center px-3 py-3 text-center text-sm font-semibold transition hover:opacity-95"
                style={{
                  background: 'var(--moni-text-primary)',
                  color: 'var(--moni-surface-0)',
                  borderRadius: 'var(--moni-radius-md)',
                  boxShadow: 'var(--moni-shadow-sm)',
                }}
              >
                Painel completo (legado)
              </Link>
            ) : (
              <Link
                href={legacyPanelHref}
                className="flex w-full items-center justify-center px-3 py-2.5 text-center text-sm font-medium transition hover:bg-stone-100"
                style={{
                  background: 'var(--moni-surface-0)',
                  color: 'var(--moni-text-secondary)',
                  border: '0.5px solid var(--moni-border-default)',
                  borderRadius: 'var(--moni-radius-md)',
                }}
              >
                Painel completo (legado)
              </Link>
            )}
          </aside>

          {/* Esquerda — dados colapsáveis (mobile: por último) */}
          <div
            className="moni-card-modal-left order-3 h-full w-full overflow-y-auto border-t p-6 sm:order-1 sm:w-[min(30%,20rem)] sm:shrink-0 sm:border-r sm:border-t-0"
            style={{
              borderColor: 'var(--moni-border-default)',
              background: 'var(--moni-surface-50)',
            }}
          >
            {secaoHead(
              'franqueado',
              'Dados do Franqueado',
              isAdmin && card.profiles ? (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">Responsável</p>
                  <p className="mt-1 font-medium text-stone-800">{card.profiles.full_name || 'Não informado'}</p>
                </>
              ) : (
                <p className="text-xs text-stone-500">Dados do franqueado quando disponíveis (admin).</p>
              ),
            )}
            {secaoHead(
              'novoNegocio',
              'Dados do Novo Negócio',
              <div className="space-y-2">
                <p>
                  <span className="text-xs font-medium text-stone-500">Título</span>
                  <br />
                  <span className="text-stone-800">{cardTitulo}</span>
                </p>
                <p>
                  <span className="text-xs font-medium text-stone-500">Status</span>
                  <br />
                  <span className="capitalize text-stone-800">{card.status}</span>
                </p>
                {card.etapa_slug ? (
                  <p>
                    <span className="text-xs font-medium text-stone-500">Etapa (slug)</span>
                    <br />
                    <span className="font-mono text-sm text-stone-800">{card.etapa_slug}</span>
                  </p>
                ) : null}
                <p>
                  <span className="text-xs font-medium text-stone-500">Criado em</span>
                  <br />
                  <span className="text-stone-800">
                    {createdDate.toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </p>
                <p className="text-xs text-stone-500">
                  Rota: <Link href={basePath} className="text-moni-primary underline">{basePath}</Link>
                </p>
              </div>,
            )}
            {!isLegado ? (
              <>
                {secaoHead(
                  'preObra',
                  'Dados Pré Obra',
                  <p className="text-xs italic text-stone-500">Em breve — campos de pré-obra do card.</p>,
                )}
                {secaoHead('obra', 'Dados Obra', <p className="text-xs italic text-stone-500">Placeholder.</p>)}
                {secaoHead(
                  'relacionamentos',
                  'Relacionamentos',
                  <p className="text-xs text-stone-500">Vínculos entre cards — em breve.</p>,
                )}
              </>
            ) : null}
            <div
              className="overflow-hidden rounded-lg bg-white"
              style={{
                border: '0.5px solid var(--moni-border-default)',
                boxShadow: 'var(--moni-shadow-sm)',
              }}
            >
              <button
                type="button"
                onClick={() => toggleSecaoEsquerda('historico')}
                className="flex w-full items-center gap-2 p-3 text-left transition hover:bg-stone-50"
              >
                {secaoAberta.historico ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-stone-500" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-stone-500" aria-hidden />
                )}
                <span className="text-sm font-semibold text-stone-800">Histórico</span>
              </button>
              {secaoAberta.historico ? (
                <div className="border-t px-3 pb-3 pt-2" style={{ borderColor: 'var(--moni-border-subtle)' }}>
                  {historico.length === 0 ? (
                    <p className="text-xs text-stone-500">Nenhum evento ainda.</p>
                  ) : (
                    <ul className="max-h-64 list-none space-y-0 overflow-y-auto">
                      {historico.map((h) => (
                        <li key={h.id} className="flex gap-2 border-b border-stone-100 py-2.5 text-sm last:border-0">
                          <span className="mt-0.5 shrink-0">{iconeHistoricoAcao(h.acao)}</span>
                          <div className="min-w-0 flex-1 leading-snug text-stone-800">
                            <span>{textoResumidoAcaoHistorico(h.acao, h.detalhe)}</span>
                            <span className="text-stone-600"> — </span>
                            <span className="font-medium text-stone-700">{h.usuario_nome?.trim() || '—'}</span>
                            <span className="text-stone-500"> · {formatDataHoraHistorico(h.criado_em)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
