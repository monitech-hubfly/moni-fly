'use client';

import type React from 'react';
import { Archive, MessageCircle, Pencil, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { rotaCardOrigem } from '@/lib/rota-card-origem';
import { ORDEM_GRUPOS_PAINEL, rankChamadoPainelUnificado } from '@/lib/sirene-painel-chamados-rank';
import {
  MONI_RESP_FILTRO_PREFIX,
  MONI_TIME_FILTRO_PREFIX,
  filtrarOpcoesTimeIdNomePorHdm,
  responsaveisFiltroOpcoesComCatalogoMoni,
  timesFiltroOpcoesComCatalogoMoni,
} from '@/lib/times-responsaveis';
import {
  atualizarInteracaoCompletaSirene,
  atualizarStatusInteracaoSirene,
  listarComentariosCardSirene,
  publicarComentarioCardSirene,
  type ComentarioCardSireneRow,
  type StatusInteracaoDb,
} from './actions';
import {
  adicionarTopicoChamadoPainel,
  arquivarChamado,
  arquivarTopico,
  atualizarChamadoPainelUnificado,
  getTopicosChamado,
  getTopicosPorInteracaoId,
} from '../actions';
import {
  arquivarInteracao,
  atualizarStatusSubInteracao,
  criarSubInteracao,
  type SubInteracaoStatusDb,
} from '@/lib/actions/card-actions';
import type { SubInteracaoTipoDb } from '@/types/kanban-subinteracao';
import { SubInteracaoLista, mapRawTopicoToListaItem } from '@/components/kanban-shared/SubInteracaoLista';
import { ModalNovoChamado } from '../ModalNovoChamado';
import {
  isNomeTimeMoniHdm,
  responsaveisDoTimeMoni,
  timesMoniReceberChamadoOpcoes,
  TIMES_MONI_HDM,
} from '@/lib/times-responsaveis';

export type InteracaoSireneRow = {
  id: string;
  card_id: string | null;
  card_titulo: string | null;
  fase_nome: string;
  kanban_nome: string;
  kanban_id: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  tipo: string;
  titulo: string;
  descricao: string | null;
  atividade_status: string;
  data_vencimento: string | null;
  time_nome: string | null;
  times_nomes: unknown;
  franqueado_nome: string | null;
  criado_em: string;
  sla_status: string | null;
  trava: boolean;
  origem: string;
  responsaveis_ids: string[];
  times_ids: string[];
  /** Quando não há `responsavel_id`: nome livre em `kanban_atividades`. */
  responsavel_nome_texto: string | null;
  sirene_chamado_id?: number | null;
  sirene_numero?: number | null;
  sirene_chamado_tipo?: string | null;
  sirene_time_abertura?: string | null;
  sirene_abertura_responsavel_nome?: string | null;
  sirene_hdm_responsavel?: string | null;
  frank_id?: string | null;
  /** Chamado Sirene arquivado (admin/team pode exibir com toggle). */
  sirene_arquivado?: boolean;
};

type TimeOpt = { id: string; nome: string };
type RespOpt = { id: string; nome: string; email?: string | null };

type EditLinhaDraft = {
  titulo: string;
  tipo: 'atividade' | 'duvida' | 'proposicoes';
  data: string;
  timesIds: string[];
  responsaveisIds: string[];
  trava: boolean;
};

type EditSireneDraft = {
  incendio: string;
  time_abertura: string;
  abertura_responsavel_nome: string;
  data: string;
  trava: boolean;
  tipo: 'padrao' | 'hdm';
  hdm_responsavel: string;
  ehHdmListaTimes: boolean;
};

type TopicoChamadoLinha = {
  id: number;
  ordem: number;
  descricao: string;
  time_responsavel: string;
  tipo: SubInteracaoTipoDb;
  times_ids: string[];
  responsaveis_ids: string[];
  data_inicio: string | null;
  data_fim: string | null;
  trava: boolean;
  status: string;
  resolucao_time: string | null;
  motivo_reprovacao: string | null;
};

type NovoSubChamadoDraft = {
  descricao: string;
  tipo: SubInteracaoTipoDb;
  data: string;
  timesIds: string[];
  responsaveisIds: string[];
  trava: boolean;
  ehHdm: boolean;
  tema: string;
  temaOutro: string;
};

/** Chave de cache de tópicos: `c:{sirene_chamado_id}` ou `i:{kanban_atividades.id}`. */
function topicosAlvoKey(row: { id: string; sirene_chamado_id?: number | null }): string {
  if (row.sirene_chamado_id != null) return `c:${row.sirene_chamado_id}`;
  return `i:${row.id}`;
}

function emptyNovoSubDraft(): NovoSubChamadoDraft {
  return {
    descricao: '',
    tipo: 'atividade',
    data: '',
    timesIds: [],
    responsaveisIds: [],
    trava: false,
    ehHdm: false,
    tema: '',
    temaOutro: '',
  };
}

type Props = {
  interacoes: InteracaoSireneRow[];
  times: TimeOpt[];
  responsaveis: RespOpt[];
  currentUserId: string | null;
  comentariosCountByCardId: Record<string, number>;
  filtroTipoChamado?: 'padrao' | 'hdm';
};

type FiltrosChamados = {
  statusF: string;
  tipoF: string;
  kanbanF: string;
  timeF: string;
  /** Lista de times no filtro: só HDM ou exclui HDM (Homologações, Modelo Virtual, Produto). */
  timeListaSomenteHdm: boolean;
  respF: string;
  travaF: string;
  busca: string;
};

const DEFAULT_FILTROS: FiltrosChamados = {
  statusF: 'todos',
  tipoF: 'todos',
  kanbanF: 'todos',
  timeF: 'todos',
  timeListaSomenteHdm: false,
  respF: 'todos',
  travaF: 'todos',
  busca: '',
};

function countFiltrosAtivos(f: FiltrosChamados): number {
  const d = DEFAULT_FILTROS;
  let n = 0;
  if (f.statusF !== 'todos') n++;
  if (f.tipoF !== 'todos') n++;
  if (f.kanbanF !== 'todos') n++;
  if (f.timeF !== 'todos' || f.timeListaSomenteHdm !== d.timeListaSomenteHdm) n++;
  if (f.respF !== 'todos') n++;
  if (f.travaF !== 'todos') n++;
  if (f.busca.trim() !== '') n++;
  return n;
}

function parseTimesNomes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x));
}

function norm(s: string): string {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

function temResponsavel(row: InteracaoSireneRow): boolean {
  if (row.responsavel_id) return true;
  if ((row.responsaveis_ids?.length ?? 0) > 0) return true;
  const txt = (row.responsavel_nome_texto ?? '').trim();
  return txt.length > 0;
}

function textoResponsavelPainel(row: InteracaoSireneRow, nomePorUserId: Map<string, string>): string {
  const ids = [
    ...new Set([...(row.responsaveis_ids ?? []), ...(row.responsavel_id ? [row.responsavel_id] : [])]),
  ].filter(Boolean) as string[];
  if (ids.length > 0) {
    return ids.map((id) => nomePorUserId.get(id) ?? id.slice(0, 8)).join(', ');
  }
  if (row.responsavel_id) {
    return (row.responsavel_nome ?? '').trim() || '—';
  }
  return row.responsavel_nome_texto ?? 'Sem responsável';
}

function subGrupoFluxo(row: InteracaoSireneRow): 'a_fazer' | 'em_andamento' | 'aguardando' | 'concluido' {
  const s = norm(row.atividade_status);
  if (s === 'concluida' || s === 'concluída' || s === 'cancelada') return 'concluido';
  if (s === 'em_andamento') return 'em_andamento';
  if (s === 'pendente' || !s) return temResponsavel(row) ? 'aguardando' : 'a_fazer';
  return 'a_fazer';
}

function statusDbParaSelect(s: string): StatusInteracaoDb {
  const x = norm(s);
  if (x === 'concluida' || x === 'concluída') return 'concluida';
  if (x === 'em_andamento') return 'em_andamento';
  return 'pendente';
}

function badgeTipo(tipo: string): { label: string; className: string } {
  const t = norm(tipo);
  if (t === 'duvida' || t === 'dúvida')
    return {
      label: 'Dúvida',
      className:
        'border-[color:var(--moni-gold-600)] bg-[rgba(212,173,104,0.12)] text-[color:var(--moni-gold-800)]',
    };
  if (t === 'proposicoes' || t === 'proposições')
    return {
      label: 'Proposições',
      className: 'border-violet-300 bg-violet-100 text-violet-900',
    };
  if (t === 'chamado_hdm')
    return { label: 'Chamado HDM', className: 'border-red-300 bg-red-50 text-red-900' };
  if (t === 'chamado_padrao')
    return { label: 'Chamado', className: 'border-red-200 bg-red-50 text-red-800' };
  return { label: 'Atividade', className: 'border-sky-300 bg-sky-50 text-sky-900' };
}

function SelectMoni(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)] outline-none focus:border-[color:var(--moni-navy-400)] focus:ring-1 focus:ring-[color:var(--moni-navy-400)] ${props.className ?? ''}`}
    />
  );
}

const BOMBEIRO_SENTINEL = '__bombeiro__';

function rowMatchTime(row: InteracaoSireneRow, timeFiltro: string, timesById: Map<string, string>): boolean {
  if (timeFiltro === 'todos') return true;
  if (timeFiltro === BOMBEIRO_SENTINEL) {
    const tn = (row.time_nome ?? '').toLowerCase();
    const nomes = [tn, ...parseTimesNomes(row.times_nomes).map((x) => x.toLowerCase())];
    return nomes.some((n) => n.includes('bombeiro'));
  }
  if (timeFiltro.startsWith(MONI_TIME_FILTRO_PREFIX)) {
    const nome = timeFiltro.slice(MONI_TIME_FILTRO_PREFIX.length).trim();
    if (!nome) return false;
    const n = nome.toLowerCase();
    if ((row.time_nome ?? '').trim().toLowerCase() === n) return true;
    return parseTimesNomes(row.times_nomes).some((x) => x.trim().toLowerCase() === n);
  }
  const nomeTime = timesById.get(timeFiltro);
  if (!nomeTime) return false;
  const n = nomeTime.toLowerCase();
  if ((row.time_nome ?? '').toLowerCase() === n) return true;
  return parseTimesNomes(row.times_nomes).some((x) => x.toLowerCase() === n);
}

function rowMatchResponsavel(
  row: InteracaoSireneRow,
  respF: string,
  nomePorUserId: Map<string, string>,
  currentUserId: string | null,
): boolean {
  if (respF === 'todos') return true;
  if (respF === 'eu' && currentUserId) {
    const ids = row.responsaveis_ids ?? [];
    return ids.includes(currentUserId) || row.responsavel_id === currentUserId;
  }
  if (respF.startsWith(MONI_RESP_FILTRO_PREFIX)) {
    let nome = '';
    try {
      nome = decodeURIComponent(respF.slice(MONI_RESP_FILTRO_PREFIX.length)).trim();
    } catch {
      nome = respF.slice(MONI_RESP_FILTRO_PREFIX.length).trim();
    }
    if (!nome) return false;
    const ids = [...new Set([...(row.responsaveis_ids ?? []), ...(row.responsavel_id ? [row.responsavel_id] : [])])];
    for (const id of ids) {
      if ((nomePorUserId.get(id) ?? '').trim() === nome) return true;
    }
    if ((row.responsavel_nome_texto ?? '').trim() === nome) return true;
    if ((row.responsavel_nome ?? '').trim() === nome) return true;
    return false;
  }
  const ids = row.responsaveis_ids ?? [];
  return ids.includes(respF) || row.responsavel_id === respF;
}

function filtroTipoMatch(row: InteracaoSireneRow, tipoF: string): boolean {
  if (tipoF === 'todos') return true;
  if (tipoF === 'chamado') return norm(row.tipo).includes('chamado');
  return norm(row.tipo) === norm(tipoF);
}

type SecaoRadioProps = {
  titulo: string;
  children: React.ReactNode;
};

function SecaoFiltro({ titulo, children }: SecaoRadioProps) {
  return (
    <fieldset className="space-y-2 border-b border-[color:var(--moni-border-default)] pb-3 last:border-b-0">
      <legend className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}

function tipoEdicaoFromRow(tipo: string): 'atividade' | 'duvida' | 'proposicoes' {
  const t = norm(tipo);
  if (t === 'duvida' || t === 'dúvida') return 'duvida';
  if (t === 'proposicoes' || t === 'proposições') return 'proposicoes';
  return 'atividade';
}

function nomesTimesDeIds(ids: string[], catalog: TimeOpt[]): unknown {
  const m = new Map(catalog.map((t) => [t.id, t.nome]));
  return ids.map((id) => m.get(id) ?? '').filter(Boolean);
}

export function InteracoesLista({
  interacoes,
  times,
  responsaveis,
  currentUserId,
  comentariosCountByCardId,
  filtroTipoChamado: _filtroTipoChamado,
}: Props) {
  const router = useRouter();
  void _filtroTipoChamado;
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [editingSireneCid, setEditingSireneCid] = useState<number | null>(null);
  const [editSireneDraft, setEditSireneDraft] = useState<EditSireneDraft | null>(null);
  const [salvandoSirene, setSalvandoSirene] = useState(false);
  const [subsOpenByRow, setSubsOpenByRow] = useState<Record<string, boolean>>({});
  const [topicosPorAlvo, setTopicosPorAlvo] = useState<Record<string, TopicoChamadoLinha[]>>({});
  const [topicosLoading, setTopicosLoading] = useState<Record<string, boolean>>({});
  const [novoSubPorAlvo, setNovoSubPorAlvo] = useState<Record<string, NovoSubChamadoDraft>>({});
  const [salvandoTopico, setSalvandoTopico] = useState<Record<string, boolean>>({});

  const [verTodas, setVerTodas] = useState(false);
  const [applied, setApplied] = useState<FiltrosChamados>(DEFAULT_FILTROS);
  const [draft, setDraft] = useState<FiltrosChamados>(DEFAULT_FILTROS);
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const filtrosBtnRef = useRef<HTMLButtonElement>(null);

  /** Status local após salvar (evita re-fetch; reset quando `interacoes` muda). */
  const [statusPatch, setStatusPatch] = useState<Record<string, string>>({});
  /** Campos da linha após edição inline (merge sobre `interacoes`). */
  const [rowPatch, setRowPatch] = useState<Record<string, Partial<InteracaoSireneRow>>>({});
  const [msgErro, setMsgErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditLinhaDraft | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [commentsOpenByRow, setCommentsOpenByRow] = useState<Record<string, boolean>>({});
  const [commentsFetchedByCard, setCommentsFetchedByCard] = useState<Record<string, boolean>>({});
  const [commentsByCardId, setCommentsByCardId] = useState<Record<string, ComentarioCardSireneRow[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [novoComentarioPorCard, setNovoComentarioPorCard] = useState<Record<string, string>>({});
  const [salvandoComentario, setSalvandoComentario] = useState<Record<string, boolean>>({});
  const [countPatch, setCountPatch] = useState<Record<string, number>>({});
  const [modalArquivar, setModalArquivar] = useState<{ cid: number | null; interacaoId: string } | null>(null);
  const [motivoArquivamento, setMotivoArquivamento] = useState('');
  const [salvandoArquivamento, setSalvandoArquivamento] = useState(false);
  const [modalArquivarTopico, setModalArquivarTopico] = useState<{
    topicoId: number;
    alvoKey: string;
  } | null>(null);
  const [motivoArquivarTopico, setMotivoArquivarTopico] = useState('');
  const [salvandoArquivarTopico, setSalvandoArquivarTopico] = useState(false);
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [podeArquivar, setPodeArquivar] = useState(false);

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      const role = String((profile as { role?: string | null } | null)?.role ?? '').toLowerCase();
      setPodeArquivar(role === 'admin' || role === 'team');
    })();
  }, []);

  useEffect(() => {
    setStatusPatch({});
    setRowPatch({});
    setEditingId(null);
    setEditDraft(null);
    setEditingSireneCid(null);
    setEditSireneDraft(null);
    setSubsOpenByRow({});
    setTopicosPorAlvo({});
    setTopicosLoading({});
    setNovoSubPorAlvo({});
    setSalvandoTopico({});
    setCommentsOpenByRow({});
    setCommentsFetchedByCard({});
    setCommentsByCardId({});
    setNovoComentarioPorCard({});
    setCountPatch({});
    setModalArquivar(null);
    setMotivoArquivamento('');
    setMostrarArquivados(false);
  }, [interacoes]);

  const painelTopicosPrefetch = useMemo(() => {
    const cids = new Set<number>();
    const iids = new Set<string>();
    for (const r of interacoes) {
      if (r.sirene_chamado_id != null) cids.add(r.sirene_chamado_id);
      else iids.add(r.id);
    }
    return { cids: [...cids], iids: [...iids] };
  }, [interacoes]);

  useEffect(() => {
    for (const cid of painelTopicosPrefetch.cids) {
      const key = `c:${cid}`;
      void (async () => {
        setTopicosLoading((l) => ({ ...l, [key]: true }));
        const res = await getTopicosChamado(cid);
        setTopicosLoading((l) => ({ ...l, [key]: false }));
        if (res.ok) setTopicosPorAlvo((m) => ({ ...m, [key]: res.topicos }));
      })();
    }
    for (const iid of painelTopicosPrefetch.iids) {
      const key = `i:${iid}`;
      void (async () => {
        setTopicosLoading((l) => ({ ...l, [key]: true }));
        const res = await getTopicosPorInteracaoId(iid);
        setTopicosLoading((l) => ({ ...l, [key]: false }));
        if (res.ok) setTopicosPorAlvo((m) => ({ ...m, [key]: res.topicos }));
      })();
    }
  }, [painelTopicosPrefetch]);

  useEffect(() => {
    if (!filtrosOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraft({ ...applied });
        setFiltrosOpen(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (filtrosBtnRef.current?.contains(t)) return;
      setDraft({ ...applied });
      setFiltrosOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [filtrosOpen, applied]);

  const linhas = useMemo(
    () =>
      interacoes.map((r) => {
        const p = rowPatch[r.id];
        return {
          ...r,
          atividade_status: statusPatch[r.id] ?? r.atividade_status,
          ...(p ?? {}),
        };
      }),
    [interacoes, statusPatch, rowPatch],
  );

  const timesById = useMemo(() => new Map(times.map((t) => [t.id, t.nome])), [times]);

  const timesParaFiltro = useMemo(() => timesFiltroOpcoesComCatalogoMoni(times), [times]);
  const timesParaFiltroVisiveis = useMemo(
    () => filtrarOpcoesTimeIdNomePorHdm(timesParaFiltro, draft.timeListaSomenteHdm),
    [timesParaFiltro, draft.timeListaSomenteHdm],
  );
  const responsaveisParaFiltro = useMemo(
    () => responsaveisFiltroOpcoesComCatalogoMoni(responsaveis),
    [responsaveis],
  );

  const kanbans = useMemo(() => {
    const s = new Set<string>();
    for (const r of interacoes) {
      const k = r.kanban_nome?.trim();
      if (k) s.add(k);
    }
    return [...s].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [interacoes]);

  const nomePorUserId = useMemo(() => new Map(responsaveis.map((r) => [r.id, r.nome])), [responsaveis]);

  const filtradas = useMemo(() => {
    const q = norm(applied.busca);
    return linhas.filter((row) => {
      if (row.origem === 'sirene' && row.sirene_arquivado && !podeArquivar) return false;
      if (
        row.origem === 'sirene' &&
        row.sirene_arquivado &&
        podeArquivar &&
        !mostrarArquivados
      ) {
        return false;
      }

      if (!verTodas && currentUserId) {
        const ids = row.responsaveis_ids ?? [];
        const mine = ids.includes(currentUserId) || row.responsavel_id === currentUserId;
        if (!mine) return false;
      } else if (!verTodas && !currentUserId) {
        return false;
      }

      if (applied.statusF !== 'todos') {
        const sg = subGrupoFluxo(row);
        if (applied.statusF === 'a_fazer' && sg !== 'a_fazer') return false;
        if (applied.statusF === 'aguardando' && sg !== 'aguardando') return false;
        if (applied.statusF === 'em_andamento' && sg !== 'em_andamento') return false;
        if (applied.statusF === 'concluida' && sg !== 'concluido') return false;
      }

      if (!filtroTipoMatch(row, applied.tipoF)) return false;

      if (applied.kanbanF !== 'todos' && row.kanban_nome !== applied.kanbanF) return false;

      if (!rowMatchTime(row, applied.timeF, timesById)) return false;

      if (applied.travaF === 'com' && !row.trava) return false;
      if (applied.travaF === 'sem' && row.trava) return false;

      if (!rowMatchResponsavel(row, applied.respF, nomePorUserId, currentUserId)) return false;

      if (q) {
        const blob = `${row.titulo} ${row.card_titulo ?? ''} ${row.descricao ?? ''} ${row.franqueado_nome ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }

      return true;
    });
  }, [
    linhas,
    verTodas,
    currentUserId,
    applied,
    timesById,
    nomePorUserId,
    podeArquivar,
    mostrarArquivados,
  ]);

  const porGrupo = useMemo(() => {
    const m = new Map<number, InteracaoSireneRow[]>();
    for (const g of ORDEM_GRUPOS_PAINEL) m.set(g.key, []);
    for (const row of filtradas) {
      const rk = rankChamadoPainelUnificado({
        frank_id: row.frank_id,
        franqueado_nome: row.franqueado_nome,
        trava: row.trava,
        data_vencimento: row.data_vencimento,
        atividade_status: row.atividade_status,
      });
      const list = m.get(rk.group);
      if (list) list.push(row);
    }
    for (const g of ORDEM_GRUPOS_PAINEL) {
      const list = m.get(g.key);
      if (!list) continue;
      list.sort((a, b) => {
        const ra = rankChamadoPainelUnificado({
          frank_id: a.frank_id,
          franqueado_nome: a.franqueado_nome,
          trava: a.trava,
          data_vencimento: a.data_vencimento,
          atividade_status: a.atividade_status,
        });
        const rb = rankChamadoPainelUnificado({
          frank_id: b.frank_id,
          franqueado_nome: b.franqueado_nome,
          trava: b.trava,
          data_vencimento: b.data_vencimento,
          atividade_status: b.atividade_status,
        });
        if (ra.dueMs !== rb.dueMs) return ra.dueMs - rb.dueMs;
        return String(b.criado_em).localeCompare(String(a.criado_em));
      });
    }
    return m;
  }, [filtradas]);

  /** Índice global (ordem em `filtradas`) só para linhas sem número Sirene → #K001, #K002… */
  const indiceKanbanPorRowId = useMemo(() => {
    let n = 0;
    const m = new Map<string, number>();
    for (const row of filtradas) {
      if (row.sirene_numero == null) {
        n += 1;
        m.set(row.id, n);
      }
    }
    return m;
  }, [filtradas]);

  function onStatusChange(id: string, novo: StatusInteracaoDb) {
    setMsgErro(null);
    if (novo === 'concluida') {
      const row = linhas.find((r) => r.id === id);
      if (row) {
        const alvoKey = topicosAlvoKey(row);
        const subs = topicosPorAlvo[alvoKey] ?? [];
        const temSubAberta = subs.some((s) => s.status !== 'concluido' && s.status !== 'aprovado');
        if (temSubAberta) {
          setMsgErro('Conclua todas as sub-interações antes de concluir o chamado.');
          return;
        }
      }
    }
    startTransition(async () => {
      const res = await atualizarStatusInteracaoSirene(id, novo);
      if (!res.ok) {
        setMsgErro(res.error);
        return;
      }
      setStatusPatch((prev) => ({ ...prev, [id]: novo }));
    });
  }

  function abrirEdicao(row: InteracaoSireneRow) {
    if (row.origem === 'sirene' && row.sirene_chamado_id != null) {
      setEditingId(null);
      setEditDraft(null);
      setEditingSireneCid(row.sirene_chamado_id);
      const tipoSc = (row.sirene_chamado_tipo ?? 'padrao') === 'hdm' ? 'hdm' : 'padrao';
      const ehHdm = tipoSc === 'hdm';
      setEditSireneDraft({
        incendio: row.titulo,
        time_abertura: row.sirene_time_abertura ?? '',
        abertura_responsavel_nome: row.sirene_abertura_responsavel_nome ?? '',
        data: row.data_vencimento ?? '',
        trava: row.trava,
        tipo: tipoSc,
        hdm_responsavel: row.sirene_hdm_responsavel ?? '',
        ehHdmListaTimes: ehHdm,
      });
      return;
    }
    setEditingSireneCid(null);
    setEditSireneDraft(null);
    const rids = [...(row.responsaveis_ids ?? [])];
    if (row.responsavel_id && !rids.includes(row.responsavel_id)) rids.unshift(row.responsavel_id);
    setEditingId(row.id);
    setEditDraft({
      titulo: row.titulo,
      tipo: tipoEdicaoFromRow(row.tipo),
      data: row.data_vencimento ?? '',
      timesIds: [...(row.times_ids ?? [])],
      responsaveisIds: rids,
      trava: row.trava,
    });
  }

  function cancelarEdicao() {
    setEditingId(null);
    setEditDraft(null);
    setEditingSireneCid(null);
    setEditSireneDraft(null);
  }

  async function carregarTopicosSeNecessario(row: InteracaoSireneRow, force = false) {
    const key = topicosAlvoKey(row);
    if (!force && topicosPorAlvo[key] != null && !topicosLoading[key]) return;
    setTopicosLoading((l) => ({ ...l, [key]: true }));
    const res =
      row.sirene_chamado_id != null
        ? await getTopicosChamado(row.sirene_chamado_id)
        : await getTopicosPorInteracaoId(row.id);
    setTopicosLoading((l) => ({ ...l, [key]: false }));
    if (res.ok) setTopicosPorAlvo((m) => ({ ...m, [key]: res.topicos }));
    else setMsgErro(res.error);
  }

  function toggleSubsPainel(row: InteracaoSireneRow) {
    const key = topicosAlvoKey(row);
    const n = (topicosPorAlvo[key] ?? []).length;
    const cur = subsOpenByRow[row.id] !== undefined ? subsOpenByRow[row.id]! : n > 0;
    const will = !cur;
    setSubsOpenByRow((p) => ({ ...p, [row.id]: will }));
    if (will) void carregarTopicosSeNecessario(row, true);
  }

  async function salvarEdicao(atividadeId: string) {
    if (!editDraft) return;
    if (!editDraft.titulo.trim()) {
      setMsgErro('Informe o título.');
      return;
    }
    setMsgErro(null);
    setSalvandoEdicao(true);
    try {
      const res = await atualizarInteracaoCompletaSirene(atividadeId, {
        titulo: editDraft.titulo.trim(),
        tipo: editDraft.tipo,
        data_vencimento: editDraft.data.trim() || null,
        times_ids: editDraft.timesIds,
        responsaveis_ids: editDraft.responsaveisIds,
        trava: editDraft.trava,
      });
      if (!res.ok) {
        setMsgErro(res.error);
        return;
      }
      const tnomes = nomesTimesDeIds(editDraft.timesIds, times);
      const firstTimeNome = Array.isArray(tnomes) && tnomes.length > 0 ? String(tnomes[0]) : null;
      setRowPatch((prev) => ({
        ...prev,
        [atividadeId]: {
          titulo: editDraft.titulo.trim(),
          tipo: editDraft.tipo,
          data_vencimento: editDraft.data.trim() || null,
          trava: editDraft.trava,
          times_ids: [...editDraft.timesIds],
          responsaveis_ids: [...editDraft.responsaveisIds],
          times_nomes: tnomes,
          time_nome: firstTimeNome,
        },
      }));
      setEditingId(null);
      setEditDraft(null);
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function salvarEdicaoSirene(atividadeRowId: string, chamadoId: number) {
    if (!editSireneDraft) return;
    if (!editSireneDraft.incendio.trim()) {
      setMsgErro('Informe o resumo (incêndio).');
      return;
    }
    setMsgErro(null);
    setSalvandoSirene(true);
    try {
      const hdmVal =
        editSireneDraft.tipo === 'hdm' && editSireneDraft.hdm_responsavel.trim()
          ? (editSireneDraft.hdm_responsavel.trim() as (typeof TIMES_MONI_HDM)[number])
          : null;
      const res = await atualizarChamadoPainelUnificado(chamadoId, {
        incendio: editSireneDraft.incendio.trim(),
        time_abertura: editSireneDraft.time_abertura.trim() || null,
        abertura_responsavel_nome: editSireneDraft.abertura_responsavel_nome.trim() || null,
        data_vencimento: editSireneDraft.data.trim() || null,
        trava: editSireneDraft.trava,
        tipo: editSireneDraft.tipo,
        hdm_responsavel: hdmVal,
      });
      if (!res.ok) {
        setMsgErro(res.error);
        return;
      }
      const tipoKa = editSireneDraft.tipo === 'hdm' ? 'chamado_hdm' : 'chamado_padrao';
      setRowPatch((prev) => ({
        ...prev,
        [atividadeRowId]: {
          titulo: editSireneDraft.incendio.trim(),
          tipo: tipoKa,
          data_vencimento: editSireneDraft.data.trim() || null,
          trava: editSireneDraft.trava,
          sirene_time_abertura: editSireneDraft.time_abertura.trim() || null,
          sirene_abertura_responsavel_nome: editSireneDraft.abertura_responsavel_nome.trim() || null,
          sirene_chamado_tipo: editSireneDraft.tipo,
          sirene_hdm_responsavel:
            editSireneDraft.tipo === 'hdm' ? editSireneDraft.hdm_responsavel.trim() || null : null,
        },
      }));
      setEditingSireneCid(null);
      setEditSireneDraft(null);
    } finally {
      setSalvandoSirene(false);
    }
  }

  function subDraft(alvoKey: string): NovoSubChamadoDraft {
    return novoSubPorAlvo[alvoKey] ?? emptyNovoSubDraft();
  }

  function setSubDraft(alvoKey: string, patch: Partial<NovoSubChamadoDraft>) {
    setNovoSubPorAlvo((m) => ({
      ...m,
      [alvoKey]: { ...subDraft(alvoKey), ...patch },
    }));
  }

  async function handleAdicionarTopico(row: InteracaoSireneRow) {
    const alvoKey = topicosAlvoKey(row);
    const d = subDraft(alvoKey);
    const desc = d.descricao.trim();
    if (!desc) {
      setMsgErro('Informe a descrição do sub-chamado.');
      return;
    }
    if (!d.tema) { setMsgErro('Selecione o tema do sub-chamado.'); return; }
    if (d.tema === 'Outro' && !d.temaOutro.trim()) { setMsgErro('Detalhe o tema.'); return; }
    if (d.timesIds.length === 0) {
      setMsgErro('Selecione ao menos um time.');
      return;
    }
    setSalvandoTopico((s) => ({ ...s, [alvoKey]: true }));
    setMsgErro(null);
    const temaFinal = d.tema === 'Outro' ? d.temaOutro.trim() : d.tema;
    const res =
      row.sirene_chamado_id != null
        ? await adicionarTopicoChamadoPainel(row.sirene_chamado_id, {
            descricao: desc,
            tipo: d.tipo,
            times_ids: d.timesIds,
            responsaveis_ids: d.responsaveisIds,
            data_fim: d.data.trim() || null,
            trava: d.trava,
            tema: temaFinal,
          })
        : await criarSubInteracao({
            interacao_id: row.id,
            descricao: desc,
            tipo: d.tipo,
            times_ids: d.timesIds,
            responsaveis_ids: d.responsaveisIds,
            data_fim: d.data.trim() || null,
            trava: d.trava,
            tema: temaFinal,
            basePath: '/sirene/chamados',
          });
    setSalvandoTopico((s) => ({ ...s, [alvoKey]: false }));
    if (!res.ok) {
      setMsgErro(res.error);
      return;
    }
    setNovoSubPorAlvo((m) => ({ ...m, [alvoKey]: emptyNovoSubDraft() }));
    void carregarTopicosSeNecessario(row, true);
  }

  async function handleSubStatusPainel(
    row: InteracaoSireneRow,
    topicoId: number,
    status: SubInteracaoStatusDb,
  ) {
    setMsgErro(null);
    const res = await atualizarStatusSubInteracao(String(topicoId), status, '/sirene/chamados');
    if (!res.ok) {
      setMsgErro(res.error);
      return;
    }
    if (status === 'em_andamento') {
      const resPai = await atualizarStatusInteracaoSirene(row.id, 'em_andamento');
      if (!resPai.ok) {
        setMsgErro(resPai.error);
        router.refresh();
        void carregarTopicosSeNecessario(row, true);
        return;
      }
      setStatusPatch((prev) => ({ ...prev, [row.id]: 'em_andamento' }));
    }
    router.refresh();
    void carregarTopicosSeNecessario(row, true);
  }

  function toggleComentarios(row: InteracaoSireneRow) {
    const cid = row.card_id;
    if (!cid) return;
    const willOpen = !commentsOpenByRow[row.id];
    setCommentsOpenByRow((p) => ({ ...p, [row.id]: willOpen }));
    if (willOpen && !commentsFetchedByCard[cid]) {
      setCommentsFetchedByCard((f) => ({ ...f, [cid]: true }));
      setCommentsLoading((l) => ({ ...l, [cid]: true }));
      void listarComentariosCardSirene(cid).then((res) => {
        setCommentsLoading((l) => ({ ...l, [cid]: false }));
        if (res.ok) setCommentsByCardId((c) => ({ ...c, [cid]: res.items }));
        else setMsgErro(res.error);
      });
    }
  }

  async function publicarComentario(cardId: string) {
    const texto = (novoComentarioPorCard[cardId] ?? '').trim();
    if (!texto) return;
    setSalvandoComentario((s) => ({ ...s, [cardId]: true }));
    setMsgErro(null);
    try {
      const res = await publicarComentarioCardSirene(cardId, texto, null);
      if (!res.ok) {
        setMsgErro(res.error);
        return;
      }
      setNovoComentarioPorCard((m) => ({ ...m, [cardId]: '' }));
      setCountPatch((c) => ({ ...c, [cardId]: (c[cardId] ?? comentariosCountByCardId[cardId] ?? 0) + 1 }));
      const list = await listarComentariosCardSirene(cardId);
      if (list.ok) setCommentsByCardId((c) => ({ ...c, [cardId]: list.items }));
    } finally {
      setSalvandoComentario((s) => ({ ...s, [cardId]: false }));
    }
  }

  function comentariosCount(cardId: string | null): number {
    if (!cardId) return 0;
    if (countPatch[cardId] != null) return countPatch[cardId]!;
    return comentariosCountByCardId[cardId] ?? 0;
  }

  function iniciaisNome(nome: string): string {
    const p = nome.trim().split(/\s+/).filter(Boolean);
    if (p.length === 0) return '?';
    if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
    return (p[0]![0] + p[p.length - 1]![0]).toUpperCase();
  }

  function abrirPainelFiltros() {
    setDraft({ ...applied });
    setFiltrosOpen(true);
  }

  function aplicarFiltros() {
    setApplied({ ...draft });
    setFiltrosOpen(false);
  }

  function limparDraftFiltros() {
    setDraft(DEFAULT_FILTROS);
  }

  const ativos = countFiltrosAtivos(applied);

  const timesSireneEditOpcoes = useMemo(
    () => [...timesMoniReceberChamadoOpcoes(Boolean(editSireneDraft?.ehHdmListaTimes))],
    [editSireneDraft?.ehHdmListaTimes],
  );

  const radioRow = 'flex flex-wrap gap-x-4 gap-y-2 text-sm text-[color:var(--moni-text-secondary)]';
  const radioLabel = 'inline-flex cursor-pointer items-center gap-2';

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 text-[color:var(--moni-text-primary)]">
      <div className="mb-6 flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative shrink-0">
            <button
              ref={filtrosBtnRef}
              type="button"
              onClick={() => (filtrosOpen ? (setDraft({ ...applied }), setFiltrosOpen(false)) : abrirPainelFiltros())}
              className="rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-4 py-2 text-sm font-medium text-[color:var(--moni-text-secondary)] hover:bg-[var(--moni-surface-100)]"
            >
              Filtros ({ativos})
            </button>
          {filtrosOpen ? (
            <div
              ref={popoverRef}
              className="absolute left-0 top-full z-50 mt-2 w-[min(100vw-2rem,28rem)] rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-4 shadow-xl"
            >
              <div className="max-h-[min(70vh,32rem)] space-y-4 overflow-y-auto pr-1">
                <label className="block text-xs text-[color:var(--moni-text-tertiary)]">
                  <span className="mb-1 block font-semibold uppercase tracking-wide">Buscar</span>
                  <input
                    type="search"
                    value={draft.busca}
                    onChange={(e) => setDraft((d) => ({ ...d, busca: e.target.value }))}
                    placeholder="Buscar…"
                    className="mt-1 w-full rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-3 py-2 text-sm text-[color:var(--moni-text-primary)] placeholder:text-[color:var(--moni-text-tertiary)] focus:border-[color:var(--moni-border-default)] focus:outline-none"
                  />
                </label>

                <SecaoFiltro titulo="Status">
                  <div className={radioRow}>
                    {[
                      ['todos', 'Todos'],
                      ['a_fazer', 'A fazer'],
                      ['em_andamento', 'Em andamento'],
                      ['aguardando', 'Aguardando'],
                      ['concluida', 'Concluído'],
                    ].map(([v, lab]) => (
                      <label key={v} className={radioLabel}>
                        <input
                          type="radio"
                          name="filtro-status"
                          checked={draft.statusF === v}
                          onChange={() => setDraft((d) => ({ ...d, statusF: v }))}
                          className="border-[color:var(--moni-border-default)] text-red-500 focus:ring-red-400"
                        />
                        {lab}
                      </label>
                    ))}
                  </div>
                </SecaoFiltro>

                <SecaoFiltro titulo="Tipo">
                  <div className={radioRow}>
                    {[
                      ['todos', 'Todos'],
                      ['atividade', 'Atividade'],
                      ['duvida', 'Dúvida'],
                      ['chamado', 'Chamado'],
                    ].map(([v, lab]) => (
                      <label key={v} className={radioLabel}>
                        <input
                          type="radio"
                          name="filtro-tipo"
                          checked={draft.tipoF === v}
                          onChange={() => setDraft((d) => ({ ...d, tipoF: v }))}
                          className="border-[color:var(--moni-border-default)] text-red-500 focus:ring-red-400"
                        />
                        {lab}
                      </label>
                    ))}
                  </div>
                </SecaoFiltro>

                <SecaoFiltro titulo="Kanban">
                  <div className="flex max-h-40 flex-col gap-2 overflow-y-auto text-sm text-[color:var(--moni-text-secondary)]">
                    <label className={radioLabel}>
                      <input
                        type="radio"
                        name="filtro-kanban"
                        checked={draft.kanbanF === 'todos'}
                        onChange={() => setDraft((d) => ({ ...d, kanbanF: 'todos' }))}
                        className="border-[color:var(--moni-border-default)] text-red-500"
                      />
                      Todos
                    </label>
                    {kanbans.map((k) => (
                      <label key={k} className={radioLabel}>
                        <input
                          type="radio"
                          name="filtro-kanban"
                          checked={draft.kanbanF === k}
                          onChange={() => setDraft((d) => ({ ...d, kanbanF: k }))}
                          className="border-[color:var(--moni-border-default)] text-red-500"
                        />
                        {k}
                      </label>
                    ))}
                  </div>
                </SecaoFiltro>

                <SecaoFiltro titulo="Time">
                  <div className="flex max-h-36 flex-col gap-2 overflow-y-auto text-sm text-[color:var(--moni-text-secondary)]">
                    <label className={`${radioLabel} mb-1 border-b border-[color:var(--moni-border-default)] pb-2`}>
                      <input
                        type="checkbox"
                        className="border-[color:var(--moni-border-default)] text-red-500"
                        checked={draft.timeListaSomenteHdm}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setDraft((d) => ({ ...d, timeListaSomenteHdm: v, timeF: 'todos' }));
                        }}
                      />
                      Este chamado é HDM?
                    </label>
                    <label className={radioLabel}>
                      <input
                        type="radio"
                        name="filtro-time"
                        checked={draft.timeF === 'todos'}
                        onChange={() => setDraft((d) => ({ ...d, timeF: 'todos' }))}
                        className="border-[color:var(--moni-border-default)] text-red-500"
                      />
                      Todos
                    </label>
                    {timesParaFiltroVisiveis.map((t) => (
                      <label key={t.id} className={radioLabel}>
                        <input
                          type="radio"
                          name="filtro-time"
                          checked={draft.timeF === t.id}
                          onChange={() => setDraft((d) => ({ ...d, timeF: t.id }))}
                          className="border-[color:var(--moni-border-default)] text-red-500"
                        />
                        {t.nome}
                      </label>
                    ))}
                    <label className={radioLabel}>
                      <input
                        type="radio"
                        name="filtro-time"
                        checked={draft.timeF === BOMBEIRO_SENTINEL}
                        onChange={() => setDraft((d) => ({ ...d, timeF: BOMBEIRO_SENTINEL }))}
                        className="border-[color:var(--moni-border-default)] text-red-500"
                      />
                      Bombeiro
                    </label>
                  </div>
                </SecaoFiltro>

                <SecaoFiltro titulo="Responsável">
                  <div className="flex max-h-36 flex-col gap-2 overflow-y-auto text-sm text-[color:var(--moni-text-secondary)]">
                    <label className={radioLabel}>
                      <input
                        type="radio"
                        name="filtro-resp"
                        checked={draft.respF === 'todos'}
                        onChange={() => setDraft((d) => ({ ...d, respF: 'todos' }))}
                        className="border-[color:var(--moni-border-default)] text-red-500"
                      />
                      Todos
                    </label>
                    {currentUserId ? (
                      <label className={radioLabel}>
                        <input
                          type="radio"
                          name="filtro-resp"
                          checked={draft.respF === 'eu'}
                          onChange={() => setDraft((d) => ({ ...d, respF: 'eu' }))}
                          className="border-[color:var(--moni-border-default)] text-red-500"
                        />
                        Eu
                      </label>
                    ) : null}
                    {responsaveisParaFiltro.map((r) => (
                      <label key={r.id} className={radioLabel}>
                        <input
                          type="radio"
                          name="filtro-resp"
                          checked={draft.respF === r.id}
                          onChange={() => setDraft((d) => ({ ...d, respF: r.id }))}
                          className="border-[color:var(--moni-border-default)] text-red-500"
                        />
                        {r.nome}
                      </label>
                    ))}
                  </div>
                </SecaoFiltro>

                <SecaoFiltro titulo="Trava">
                  <div className={radioRow}>
                    {[
                      ['todos', 'Todos'],
                      ['com', 'Com trava'],
                      ['sem', 'Sem trava'],
                    ].map(([v, lab]) => (
                      <label key={v} className={radioLabel}>
                        <input
                          type="radio"
                          name="filtro-trava"
                          checked={draft.travaF === v}
                          onChange={() => setDraft((d) => ({ ...d, travaF: v }))}
                          className="border-[color:var(--moni-border-default)] text-red-500"
                        />
                        {lab}
                      </label>
                    ))}
                  </div>
                </SecaoFiltro>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--moni-border-default)] pt-3">
                <button
                  type="button"
                  onClick={limparDraftFiltros}
                  className="rounded-lg border border-[color:var(--moni-border-default)] px-3 py-1.5 text-sm text-[color:var(--moni-text-secondary)] hover:bg-[var(--moni-surface-100)]"
                >
                  Limpar filtros
                </button>
                <button
                  type="button"
                  onClick={aplicarFiltros}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
                >
                  Aplicar
                </button>
              </div>
            </div>
          ) : null}
          </div>
          <div className="flex rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setVerTodas(false)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                !verTodas
                  ? 'bg-red-600 text-white'
                  : 'text-[color:var(--moni-text-tertiary)] hover:text-[color:var(--moni-text-primary)]'
              }`}
            >
              Ver minhas
            </button>
            <button
              type="button"
              onClick={() => setVerTodas(true)}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                verTodas
                  ? 'bg-red-600 text-white'
                  : 'text-[color:var(--moni-text-tertiary)] hover:text-[color:var(--moni-text-primary)]'
              }`}
            >
              Ver todas
            </button>
          </div>
          {podeArquivar ? (
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[color:var(--moni-text-secondary)]">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[color:var(--moni-border-default)]"
                checked={mostrarArquivados}
                onChange={(e) => setMostrarArquivados(e.target.checked)}
              />
              Mostrar arquivados
            </label>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setModalNovoAberto(true)}
          className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
        >
          Novo Chamado
        </button>
      </div>

      {msgErro && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {msgErro}
        </div>
      )}

      {pending && <p className="mb-2 text-xs text-[color:var(--moni-text-tertiary)]">Salvando status…</p>}
      {salvandoEdicao && <p className="mb-2 text-xs text-[color:var(--moni-text-tertiary)]">Salvando chamado…</p>}
      {salvandoSirene && <p className="mb-2 text-xs text-[color:var(--moni-text-tertiary)]">Salvando chamado Sirene…</p>}
      <div className="space-y-8">
        {ORDEM_GRUPOS_PAINEL.map(({ key, titulo }) => {
          const lista = porGrupo.get(key) ?? [];
          if (lista.length === 0) return null;
          return (
            <section key={key}>
              <h3 className="mb-3 border-b border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] px-3 py-2 text-sm font-semibold text-[color:var(--moni-text-primary)]">
                {titulo}
                <span className="ml-2 font-normal text-[color:var(--moni-text-tertiary)]">({lista.length})</span>
              </h3>
              <ul className="rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)]">
                {lista.map((row) => {
                  const tipoB = badgeTipo(row.tipo);
                  const hrefCard = row.card_id ? rotaCardOrigem(row.kanban_nome, row.card_id) : null;
                  const sel = statusDbParaSelect(row.atividade_status);
                  const idsResp = [...new Set([...(row.responsaveis_ids ?? []), ...(row.responsavel_id ? [row.responsavel_id] : [])])];

                  const ccid = row.card_id;
                  const cnt = ccid ? comentariosCount(ccid) : 0;
                  const alvoK = topicosAlvoKey(row);
                  const subs = topicosPorAlvo[alvoK] ?? [];
                  const temSubAberta = subs.some((s) => s.status !== 'concluido' && s.status !== 'aprovado');
                  const subsPainelAberto =
                    subsOpenByRow[row.id] !== undefined ? subsOpenByRow[row.id]! : subs.length > 0;

                  return (
                    <li key={row.id} className="flex flex-col gap-0 border-b border-[color:var(--moni-border-default)] px-3 py-3 last:border-b-0">
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:gap-x-3 sm:gap-y-2">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {row.trava && (
                              <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-800">
                                Trava
                              </span>
                            )}
                            {row.sirene_numero != null ? (
                              <span className="rounded bg-[var(--moni-surface-100)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--moni-text-secondary)]">
                                #{row.sirene_numero}
                              </span>
                            ) : (
                              <span className="rounded bg-[var(--moni-surface-100)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--moni-text-secondary)]">
                                #K{String(indiceKanbanPorRowId.get(row.id) ?? 0).padStart(3, '0')}
                              </span>
                            )}
                            {row.sirene_arquivado ? (
                              <span className="rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--moni-text-tertiary)]">
                                Arquivado
                              </span>
                            ) : null}
                            <span className="font-medium text-[color:var(--moni-text-primary)]">{row.titulo}</span>
                            {ccid ? (
                              <button
                                type="button"
                                onClick={() => toggleComentarios(row)}
                                className="inline-flex items-center gap-1 rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-1.5 py-0.5 text-[color:var(--moni-text-secondary)] hover:border-[color:var(--moni-border-strong)] hover:text-[color:var(--moni-text-primary)]"
                                aria-expanded={Boolean(commentsOpenByRow[row.id])}
                                aria-label={`Comentários do card (${cnt})`}
                              >
                                <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                <span className="min-w-[1.1rem] text-center text-[10px] font-semibold tabular-nums">{cnt}</span>
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => toggleSubsPainel(row)}
                              className="rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-1.5 py-0.5 text-[10px] text-[color:var(--moni-text-secondary)] hover:text-[color:var(--moni-text-primary)]"
                              aria-expanded={subsPainelAberto}
                            >
                              Sub-interações
                            </button>
                            <button
                              type="button"
                              onClick={() => abrirEdicao(row)}
                              className="rounded p-0.5 text-[color:var(--moni-text-tertiary)] hover:bg-[var(--moni-surface-100)] hover:text-[color:var(--moni-text-primary)]"
                              aria-label="Editar chamado"
                              title="Editar"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            {podeArquivar && !row.sirene_arquivado ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setModalArquivar({
                                    cid: row.sirene_chamado_id ?? null,
                                    interacaoId: row.id,
                                  })
                                }
                                className="rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-1.5 py-0.5 text-[10px] text-[color:var(--moni-text-secondary)] hover:border-[color:var(--moni-border-strong)] hover:text-[color:var(--moni-text-primary)]"
                              >
                                Arquivar
                              </button>
                            ) : null}
                            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${tipoB.className}`}>
                              {tipoB.label}
                            </span>
                          </div>
                          {subsPainelAberto && topicosLoading[alvoK] ? (
                            <p className="text-[10px] text-[color:var(--moni-text-tertiary)]">Carregando subinterações…</p>
                          ) : subsPainelAberto && (topicosPorAlvo[alvoK] ?? []).length > 0 ? (
                            <SubInteracaoLista
                              variant="sirene"
                              items={(topicosPorAlvo[alvoK] ?? []).map((t) =>
                                mapRawTopicoToListaItem({
                                  id: t.id,
                                  tipo: t.tipo,
                                  descricao: t.descricao,
                                  status: t.status,
                                  data_fim: t.data_fim,
                                  trava: t.trava,
                                }),
                              )}
                            />
                          ) : null}
                          {(row.franqueado_nome ?? '').trim() ? (
                            <div className="flex items-center gap-1 text-xs text-[color:var(--moni-text-tertiary)]">
                              <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span>{(row.franqueado_nome ?? '').trim()}</span>
                            </div>
                          ) : null}
                          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-[color:var(--moni-text-tertiary)]">
                            <span className="shrink-0">Resp.:</span>
                            <span className="font-medium text-[color:var(--moni-text-tertiary)]">
                              {textoResponsavelPainel(row, nomePorUserId)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--moni-text-tertiary)]">
                            {ccid && hrefCard ? (
                              <Link
                                href={hrefCard}
                                className="rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-0.5 text-[color:var(--moni-text-secondary)] underline-offset-2 hover:text-[color:var(--moni-navy-600)] hover:underline"
                              >
                                Card: {row.card_titulo?.trim() || '—'}
                              </Link>
                            ) : null}
                            <span className="rounded bg-[var(--moni-surface-100)] px-1.5 py-0.5 text-[10px] text-[color:var(--moni-text-secondary)]">
                              {row.kanban_nome}
                            </span>
                            {parseTimesNomes(row.times_nomes).map((tn) => (
                              <span key={tn} className="rounded bg-[var(--moni-surface-100)] px-1.5 py-0.5 text-[10px] text-[color:var(--moni-text-secondary)]">
                                {tn}
                              </span>
                            ))}
                            {row.time_nome && parseTimesNomes(row.times_nomes).length === 0 && (
                              <span className="rounded bg-[var(--moni-surface-100)] px-1.5 py-0.5 text-[10px] text-[color:var(--moni-text-secondary)]">{row.time_nome}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                          <div className="flex -space-x-1">
                            {idsResp.slice(0, 6).map((uid) => (
                              <span
                                key={uid}
                                title={nomePorUserId.get(uid) ?? uid}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-100)] text-[10px] font-semibold text-[color:var(--moni-text-primary)]"
                              >
                                {iniciaisNome(nomePorUserId.get(uid) ?? '?')}
                              </span>
                            ))}
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
                            {row.data_vencimento ? (
                              <span className="text-[color:var(--moni-text-tertiary)]">
                                Prazo {row.data_vencimento.split('-').reverse().join('/')}
                              </span>
                            ) : null}
                            <SelectMoni
                              value={sel}
                              disabled={pending}
                              onChange={(e) => onStatusChange(row.id, e.target.value as StatusInteracaoDb)}
                              className="min-w-[9.5rem]"
                              aria-label="Status do chamado"
                            >
                              <option value="pendente">A fazer</option>
                              <option value="em_andamento">Em andamento</option>
                              <option value="concluida" disabled={temSubAberta}>
                                Concluída
                              </option>
                            </SelectMoni>
                          </div>
                        </div>
                      </div>

                      {editingId === row.id && editDraft ? (
                        <div className="mt-3 space-y-3 border-t border-[color:var(--moni-border-default)] pt-3">
                          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                            Título
                            <input
                              type="text"
                              value={editDraft.titulo}
                              onChange={(e) => setEditDraft((d) => (d ? { ...d, titulo: e.target.value } : d))}
                              className="mt-1 w-full rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)]"
                            />
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                              Tipo
                              <SelectMoni
                                value={editDraft.tipo}
                                onChange={(e) =>
                                  setEditDraft((d) =>
                                    d ? { ...d, tipo: e.target.value as 'atividade' | 'duvida' | 'proposicoes' } : d,
                                  )
                                }
                                className="mt-1 w-full"
                              >
                                <option value="atividade">Atividade</option>
                                <option value="duvida">Dúvida</option>
                                <option value="proposicoes">Proposições</option>
                              </SelectMoni>
                            </label>
                            <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                              Prazo
                              <input
                                type="date"
                                value={editDraft.data}
                                onChange={(e) => setEditDraft((d) => (d ? { ...d, data: e.target.value } : d))}
                                className="mt-1 w-full rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)]"
                              />
                            </label>
                          </div>
                          <div>
                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                              Times
                            </span>
                            <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
                              {times.map((t) => {
                                const on = editDraft.timesIds.includes(t.id);
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() =>
                                      setEditDraft((d) => {
                                        if (!d) return d;
                                        const has = d.timesIds.includes(t.id);
                                        return {
                                          ...d,
                                          timesIds: has ? d.timesIds.filter((x) => x !== t.id) : [...d.timesIds, t.id],
                                        };
                                      })
                                    }
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                      on ? 'bg-red-600 text-white' : 'bg-[var(--moni-surface-100)] text-[color:var(--moni-text-secondary)]'
                                    }`}
                                  >
                                    {t.nome}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                              Responsáveis
                            </span>
                            <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                              {responsaveis.map((p) => {
                                const on = editDraft.responsaveisIds.includes(p.id);
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() =>
                                      setEditDraft((d) => {
                                        if (!d) return d;
                                        const has = d.responsaveisIds.includes(p.id);
                                        return {
                                          ...d,
                                          responsaveisIds: has
                                            ? d.responsaveisIds.filter((x) => x !== p.id)
                                            : [...d.responsaveisIds, p.id],
                                        };
                                      })
                                    }
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                      on ? 'bg-red-600 text-white' : 'bg-[var(--moni-surface-100)] text-[color:var(--moni-text-secondary)]'
                                    }`}
                                  >
                                    {p.nome}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--moni-text-secondary)]">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-[color:var(--moni-border-default)]"
                              checked={editDraft.trava}
                              onChange={(e) => setEditDraft((d) => (d ? { ...d, trava: e.target.checked } : d))}
                            />
                            Trava — bloqueia o card até concluir
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={salvandoEdicao}
                              onClick={() => void salvarEdicao(row.id)}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                            >
                              {salvandoEdicao ? 'Salvando…' : 'Salvar'}
                            </button>
                            <button
                              type="button"
                              disabled={salvandoEdicao}
                              onClick={cancelarEdicao}
                              className="rounded-lg border border-[color:var(--moni-border-default)] px-3 py-1.5 text-sm text-[color:var(--moni-text-secondary)] hover:bg-[var(--moni-surface-100)]"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {row.sirene_chamado_id != null &&
                      editingSireneCid === row.sirene_chamado_id &&
                      editSireneDraft ? (
                        <div className="mt-3 space-y-3 border-t border-[color:var(--moni-border-default)] pt-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                            Chamado Sirene
                          </p>
                          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                            Incêndio (resumo)
                            <textarea
                              value={editSireneDraft.incendio}
                              onChange={(e) =>
                                setEditSireneDraft((d) => (d ? { ...d, incendio: e.target.value } : d))
                              }
                              rows={3}
                              className="mt-1 w-full rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)]"
                            />
                          </label>
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--moni-text-secondary)]">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-[color:var(--moni-border-default)]"
                              checked={editSireneDraft.ehHdmListaTimes}
                              onChange={(e) => {
                                const eh = e.target.checked;
                                setEditSireneDraft((d) => {
                                  if (!d) return d;
                                  const op = [...timesMoniReceberChamadoOpcoes(eh)];
                                  let time_abertura = d.time_abertura;
                                  let abertura_responsavel_nome = d.abertura_responsavel_nome;
                                  if (!time_abertura || !op.includes(time_abertura)) {
                                    time_abertura = '';
                                    abertura_responsavel_nome = '';
                                  } else if (!responsaveisDoTimeMoni(time_abertura).includes(abertura_responsavel_nome)) {
                                    abertura_responsavel_nome = '';
                                  }
                                  return { ...d, ehHdmListaTimes: eh, time_abertura, abertura_responsavel_nome };
                                });
                              }}
                            />
                            Este chamado é HDM?
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                              Time (abertura)
                              <select
                                value={editSireneDraft.time_abertura}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setEditSireneDraft((d) =>
                                    d
                                      ? {
                                          ...d,
                                          time_abertura: v,
                                          abertura_responsavel_nome: responsaveisDoTimeMoni(v).includes(
                                            d.abertura_responsavel_nome,
                                          )
                                            ? d.abertura_responsavel_nome
                                            : '',
                                          tipo: v && isNomeTimeMoniHdm(v) ? 'hdm' : d.tipo,
                                          ehHdmListaTimes: v ? isNomeTimeMoniHdm(v) : d.ehHdmListaTimes,
                                        }
                                      : d,
                                  );
                                }}
                                className="mt-1 w-full rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)]"
                              >
                                <option value="">Selecione</option>
                                {timesSireneEditOpcoes.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                              Responsável (abertura)
                              <select
                                value={editSireneDraft.abertura_responsavel_nome}
                                onChange={(e) =>
                                  setEditSireneDraft((d) =>
                                    d ? { ...d, abertura_responsavel_nome: e.target.value } : d,
                                  )
                                }
                                disabled={!editSireneDraft.time_abertura}
                                className="mt-1 w-full rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)] disabled:opacity-50"
                              >
                                <option value="">—</option>
                                {responsaveisDoTimeMoni(editSireneDraft.time_abertura).map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                            Prazo
                            <input
                              type="date"
                              value={editSireneDraft.data}
                              onChange={(e) =>
                                setEditSireneDraft((d) => (d ? { ...d, data: e.target.value } : d))
                              }
                              className="mt-1 w-full rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)]"
                            />
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                              Tipo chamado
                              <SelectMoni
                                value={editSireneDraft.tipo}
                                onChange={(e) => {
                                  const v = e.target.value as 'padrao' | 'hdm';
                                  setEditSireneDraft((d) =>
                                    d
                                      ? {
                                          ...d,
                                          tipo: v,
                                          hdm_responsavel: v === 'hdm' ? d.hdm_responsavel : '',
                                        }
                                      : d,
                                  );
                                }}
                                className="mt-1 w-full"
                              >
                                <option value="padrao">Padrão</option>
                                <option value="hdm">HDM</option>
                              </SelectMoni>
                            </label>
                            {editSireneDraft.tipo === 'hdm' ? (
                              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                                Time HDM
                                <SelectMoni
                                  value={editSireneDraft.hdm_responsavel}
                                  onChange={(e) =>
                                    setEditSireneDraft((d) =>
                                      d ? { ...d, hdm_responsavel: e.target.value } : d,
                                    )
                                  }
                                  className="mt-1 w-full"
                                >
                                  <option value="">—</option>
                                  {TIMES_MONI_HDM.map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </SelectMoni>
                              </label>
                            ) : (
                              <span />
                            )}
                          </div>
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--moni-text-secondary)]">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-[color:var(--moni-border-default)]"
                              checked={editSireneDraft.trava}
                              onChange={(e) =>
                                setEditSireneDraft((d) => (d ? { ...d, trava: e.target.checked } : d))
                              }
                            />
                            Trava
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={salvandoSirene}
                              onClick={() => void salvarEdicaoSirene(row.id, row.sirene_chamado_id!)}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                            >
                              {salvandoSirene ? 'Salvando…' : 'Salvar'}
                            </button>
                            <button
                              type="button"
                              disabled={salvandoSirene}
                              onClick={cancelarEdicao}
                              className="rounded-lg border border-[color:var(--moni-border-default)] px-3 py-1.5 text-sm text-[color:var(--moni-text-secondary)] hover:bg-[var(--moni-surface-100)]"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {commentsOpenByRow[row.id] && ccid ? (
                        <div className="mt-3 rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] p-3">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                            Comentários do card
                          </p>
                          {commentsLoading[ccid] ? (
                            <p className="text-xs text-[color:var(--moni-text-tertiary)]">Carregando…</p>
                          ) : (
                            <ul className="mb-3 max-h-48 space-y-2 overflow-y-auto text-sm">
                              {[...(commentsByCardId[ccid] ?? [])]
                                .sort(
                                  (a, b) =>
                                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                                )
                                .map((c) => (
                                  <li
                                    key={c.id}
                                    className="flex gap-2 rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-2 text-[color:var(--moni-text-secondary)]"
                                  >
                                    <span
                                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] text-[10px] font-semibold text-[color:var(--moni-text-secondary)]"
                                      aria-hidden
                                    >
                                      {iniciaisNome(c.autor_nome ?? '')}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs leading-snug">
                                        <span className="font-medium text-[color:var(--moni-text-primary)]">
                                          {(c.autor_nome ?? '—').trim() || '—'}
                                        </span>
                                        {c.created_at ? (
                                          <>
                                            {' '}
                                            <span className="tabular-nums text-[color:var(--moni-text-tertiary)]">
                                              {new Date(c.created_at).toLocaleString('pt-BR')}
                                            </span>
                                          </>
                                        ) : null}
                                      </p>
                                      <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--moni-text-primary)]">{c.texto}</p>
                                    </div>
                                  </li>
                                ))}
                            </ul>
                          )}
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              type="text"
                              value={novoComentarioPorCard[ccid] ?? ''}
                              onChange={(e) =>
                                setNovoComentarioPorCard((m) => ({ ...m, [ccid]: e.target.value }))
                              }
                              placeholder="Escreva um comentário…"
                              className="min-w-0 flex-1 rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)] placeholder:text-[color:var(--moni-text-tertiary)]"
                            />
                            <button
                              type="button"
                              disabled={Boolean(salvandoComentario[ccid])}
                              onClick={() => void publicarComentario(ccid)}
                              className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                            >
                              {salvandoComentario[ccid] ? '…' : 'Publicar'}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {subsPainelAberto ? (
                        <div className="mt-3 rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] p-3">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                            Gerir subinterações
                          </p>
                          {topicosLoading[alvoK] ? (
                            <p className="text-xs text-[color:var(--moni-text-tertiary)]">Carregando…</p>
                          ) : (
                            <ul className="mb-3 max-h-48 space-y-2 overflow-y-auto text-sm text-[color:var(--moni-text-secondary)]">
                              {(topicosPorAlvo[alvoK] ?? []).map((t) => (
                                <li
                                  key={t.id}
                                  className="rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-2 text-xs"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-[color:var(--moni-text-primary)]">{t.descricao}</p>
                                      <p className="mt-1 text-[10px] text-[color:var(--moni-text-tertiary)]">
                                        Time: {t.time_responsavel}
                                        {t.data_fim ? ` · Prazo ${t.data_fim.split('-').reverse().join('/')}` : ''}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                      {podeArquivar ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setModalArquivarTopico({
                                              topicoId: t.id,
                                              alvoKey: alvoK,
                                            });
                                            setMotivoArquivarTopico('');
                                          }}
                                          className="rounded p-1 text-[color:var(--moni-text-tertiary)] hover:bg-red-50 hover:text-red-700"
                                          title="Arquivar sub-chamado"
                                          aria-label="Arquivar sub-chamado"
                                        >
                                          <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                        </button>
                                      ) : null}
                                      <SelectMoni
                                        value={t.status}
                                        onChange={(e) =>
                                          void handleSubStatusPainel(
                                            row,
                                            t.id,
                                            e.target.value as SubInteracaoStatusDb,
                                          )
                                        }
                                        className="min-w-[7.5rem] text-[10px]"
                                        aria-label="Status do sub-chamado"
                                      >
                                        <option value="nao_iniciado">Não iniciado</option>
                                        <option value="em_andamento">Em andamento</option>
                                        <option value="concluido">Concluído</option>
                                        <option value="aprovado">Aprovado</option>
                                      </SelectMoni>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                          {(() => {
                            const d = subDraft(alvoK);
                            const timesOpts = filtrarOpcoesTimeIdNomePorHdm(
                              times,
                              d.tipo === 'chamado' && d.ehHdm,
                            );
                            return (
                              <div className="space-y-2 border-t border-[color:var(--moni-border-default)] pt-3">
                                <p className="text-[10px] font-semibold text-[color:var(--moni-text-tertiary)]">Novo sub-chamado</p>
                                <div>
                                  <span className="mb-1 block text-[10px] font-medium text-[color:var(--moni-text-tertiary)]">
                                    Tipo (obrigatório)
                                  </span>
                                  <SelectMoni
                                    value={d.tipo}
                                    onChange={(e) => {
                                      const v = e.target.value as SubInteracaoTipoDb;
                                      const ehNext = v === 'chamado' ? d.ehHdm : false;
                                      const allowed = new Set(
                                        filtrarOpcoesTimeIdNomePorHdm(times, v === 'chamado' && ehNext).map(
                                          (x) => x.id,
                                        ),
                                      );
                                      setSubDraft(alvoK, {
                                        tipo: v,
                                        ehHdm: ehNext,
                                        timesIds: d.timesIds.filter((id) => allowed.has(id)),
                                      });
                                    }}
                                    className="w-full text-xs"
                                  >
                                    <option value="atividade">Atividade</option>
                                    <option value="duvida">Dúvida</option>
                                    <option value="proposicoes">Proposições</option>
                                    <option value="chamado">Chamado</option>
                                  </SelectMoni>
                                </div>
                                <input
                                  type="text"
                                  value={d.descricao}
                                  onChange={(e) => setSubDraft(alvoK, { descricao: e.target.value })}
                                  placeholder="Descrição (obrigatório)"
                                  className="w-full rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)]"
                                />
                                <input
                                  type="date"
                                  value={d.data}
                                  onChange={(e) => setSubDraft(alvoK, { data: e.target.value })}
                                  className="w-full rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)]"
                                />
                                <div>
                                  <span className="mb-1 block text-[10px] font-medium text-[color:var(--moni-text-tertiary)]">Tema (obrigatório)</span>
                                  <SelectMoni
                                    value={d.tema}
                                    onChange={(e) => setSubDraft(alvoK, { tema: e.target.value, temaOutro: '' })}
                                    className="w-full text-xs"
                                  >
                                    <option value="">Selecione</option>
                                    <option value="Acoplamento">Acoplamento</option>
                                    <option value="Adicionais">Adicionais</option>
                                    <option value="BCA + Batalha">BCA + Batalha</option>
                                    <option value="Catálogo de Casas">Catálogo de Casas</option>
                                    <option value="Crédito p/ Obra">Crédito p/ Obra</option>
                                    <option value="Crédito p/ Terreno">Crédito p/ Terreno</option>
                                    <option value="Diligência Terreno">Diligência Terreno</option>
                                    <option value="Gadgets">Gadgets</option>
                                    <option value="Negociação com Terrenista">Negociação com Terrenista</option>
                                    <option value="Outro">Outro</option>
                                  </SelectMoni>
                                  {d.tema === 'Outro' && (
                                    <input
                                      type="text"
                                      value={d.temaOutro}
                                      onChange={(e) => setSubDraft(alvoK, { temaOutro: e.target.value })}
                                      placeholder="Detalhe o tema (obrigatório)"
                                      className="mt-1 w-full rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)]"
                                    />
                                  )}
                                </div>
                                {d.tipo === 'chamado' ? (
                                  <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[color:var(--moni-text-secondary)]">
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5 rounded border-[color:var(--moni-border-default)]"
                                      checked={d.ehHdm}
                                      onChange={(e) => {
                                        const eh = e.target.checked;
                                        setSubDraft(alvoK, {
                                          ehHdm: eh,
                                          timesIds: d.timesIds.filter((id) =>
                                            filtrarOpcoesTimeIdNomePorHdm(times, d.tipo === 'chamado' && eh).some(
                                              (x) => x.id === id,
                                            ),
                                          ),
                                        });
                                      }}
                                    />
                                    Este chamado é HDM?
                                  </label>
                                ) : null}
                                <div>
                                  <span className="mb-1 block text-[10px] text-[color:var(--moni-text-tertiary)]">Times</span>
                                  <div className="flex flex-wrap gap-1">
                                    {timesOpts.map((topt) => {
                                      const on = d.timesIds.includes(topt.id);
                                      return (
                                        <button
                                          key={topt.id}
                                          type="button"
                                          onClick={() =>
                                            setSubDraft(alvoK, {
                                              timesIds: on
                                                ? d.timesIds.filter((x) => x !== topt.id)
                                                : [...d.timesIds, topt.id],
                                            })
                                          }
                                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                            on ? 'bg-red-600 text-white' : 'bg-[var(--moni-surface-100)] text-[color:var(--moni-text-secondary)]'
                                          }`}
                                        >
                                          {topt.nome}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div>
                                  <span className="mb-1 block text-[10px] text-[color:var(--moni-text-tertiary)]">Responsáveis</span>
                                  <div className="flex flex-wrap gap-1">
                                    {responsaveis.map((p) => {
                                      const on = d.responsaveisIds.includes(p.id);
                                      return (
                                        <button
                                          key={p.id}
                                          type="button"
                                          onClick={() =>
                                            setSubDraft(alvoK, {
                                              responsaveisIds: on
                                                ? d.responsaveisIds.filter((x) => x !== p.id)
                                                : [...d.responsaveisIds, p.id],
                                            })
                                          }
                                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                            on ? 'bg-red-600 text-white' : 'bg-[var(--moni-surface-100)] text-[color:var(--moni-text-secondary)]'
                                          }`}
                                        >
                                          {p.nome}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[color:var(--moni-text-secondary)]">
                                  <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 rounded border-[color:var(--moni-border-default)]"
                                    checked={d.trava}
                                    onChange={(e) => setSubDraft(alvoK, { trava: e.target.checked })}
                                  />
                                  Trava — estou bloqueado até este sub-chamado ser concluído
                                </label>
                                <button
                                  type="button"
                                  disabled={
                                    Boolean(salvandoTopico[alvoK]) ||
                                    !d.descricao.trim() ||
                                    d.timesIds.length === 0 ||
                                    !d.tema ||
                                    (d.tema === 'Outro' && !d.temaOutro.trim())
                                  }
                                  onClick={() => void handleAdicionarTopico(row)}
                                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                                >
                                  {salvandoTopico[alvoK] ? '…' : '+ Adicionar subinteração'}
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {filtradas.length === 0 && (
        <p className="mt-8 text-center text-sm text-[color:var(--moni-text-tertiary)]">Nenhum chamado com os filtros atuais.</p>
      )}

      {modalNovoAberto ? (
        <ModalNovoChamado
          onClose={() => setModalNovoAberto(false)}
          onSuccess={() => {
            setModalNovoAberto(false);
            router.refresh();
          }}
        />
      ) : null}

      {modalArquivarTopico ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-base font-semibold text-[color:var(--moni-text-primary)]">
              Arquivar sub-chamado
            </h3>
            <p className="mb-4 text-sm text-[color:var(--moni-text-tertiary)]">
              Informe o motivo do arquivamento. Esta ação não pode ser desfeita.
            </p>
            <textarea
              value={motivoArquivarTopico}
              onChange={(e) => setMotivoArquivarTopico(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo…"
              className="w-full resize-none rounded-lg border border-[color:var(--moni-border-default)] px-3 py-2 text-sm text-[color:var(--moni-text-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--moni-navy-400)]"
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={salvandoArquivarTopico || !motivoArquivarTopico.trim()}
                onClick={async () => {
                  if (!confirm('Tem certeza que deseja arquivar este sub-chamado?')) return;
                  setSalvandoArquivarTopico(true);
                  try {
                    const res = await arquivarTopico(modalArquivarTopico.topicoId, motivoArquivarTopico);
                    if (!res.ok) {
                      alert(res.error);
                      return;
                    }
                    const ak = modalArquivarTopico.alvoKey;
                    setModalArquivarTopico(null);
                    setMotivoArquivarTopico('');
                    if (ak.startsWith('c:')) {
                      const tr = await getTopicosChamado(Number(ak.slice(2)));
                      if (tr.ok) setTopicosPorAlvo((m) => ({ ...m, [ak]: tr.topicos }));
                    } else if (ak.startsWith('i:')) {
                      const tr = await getTopicosPorInteracaoId(ak.slice(2));
                      if (tr.ok) setTopicosPorAlvo((m) => ({ ...m, [ak]: tr.topicos }));
                    }
                    router.refresh();
                  } finally {
                    setSalvandoArquivarTopico(false);
                  }
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {salvandoArquivarTopico ? 'Arquivando…' : 'Confirmar arquivamento'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalArquivarTopico(null);
                  setMotivoArquivarTopico('');
                }}
                disabled={salvandoArquivarTopico}
                className="flex-1 rounded-lg border border-[color:var(--moni-border-default)] px-4 py-2 text-sm font-medium text-[color:var(--moni-text-secondary)] disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalArquivar ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-base font-semibold text-[color:var(--moni-text-primary)]">
              Arquivar chamado
            </h3>
            <p className="mb-4 text-sm text-[color:var(--moni-text-tertiary)]">
              Informe o motivo do arquivamento. Esta ação não pode ser desfeita.
            </p>
            <textarea
              value={motivoArquivamento}
              onChange={(e) => setMotivoArquivamento(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo…"
              className="w-full resize-none rounded-lg border border-[color:var(--moni-border-default)] px-3 py-2 text-sm text-[color:var(--moni-text-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--moni-navy-400)]"
              autoFocus
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={salvandoArquivamento || !motivoArquivamento.trim()}
                onClick={async () => {
                  if (!modalArquivar) return;
                  if (!confirm('Tem certeza que deseja arquivar este chamado?')) return;
                  setSalvandoArquivamento(true);
                  try {
                    let res: { ok: true } | { ok: false; error: string };
                    if (modalArquivar.cid != null) {
                      res = await arquivarChamado(modalArquivar.cid, motivoArquivamento);
                    } else {
                      res = await arquivarInteracao(
                        modalArquivar.interacaoId,
                        motivoArquivamento,
                        '/sirene/chamados',
                      );
                    }
                    if (!res.ok) {
                      alert(res.error);
                      return;
                    }
                    setModalArquivar(null);
                    setMotivoArquivamento('');
                    router.refresh();
                  } finally {
                    setSalvandoArquivamento(false);
                  }
                }}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {salvandoArquivamento ? 'Arquivando…' : 'Confirmar arquivamento'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalArquivar(null);
                  setMotivoArquivamento('');
                }}
                disabled={salvandoArquivamento}
                className="flex-1 rounded-lg border border-[color:var(--moni-border-default)] px-4 py-2 text-sm font-medium text-[color:var(--moni-text-secondary)] disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
