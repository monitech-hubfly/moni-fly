'use client';

import type React from 'react';
import { Archive, CheckSquare, ChevronRight, Info, MessageCircle, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { rotaCardOrigem } from '@/lib/rota-card-origem';
import { compareChamadosPainelRank, ORDEM_GRUPOS_PAINEL, rankChamadoPainelUnificado } from '@/lib/sirene-painel-chamados-rank';
import {
  MONI_RESP_FILTRO_PREFIX,
  MONI_TIME_FILTRO_PREFIX,
  filtrarOpcoesTimeIdNomePorHdm,
  inferirHdmResponsavelPorNomesTimes,
  responsaveisDoTimeMoni,
  responsaveisFiltroOpcoesComCatalogoMoni,
  timesFiltroOpcoesComCatalogoMoni,
  timesMoniReceberChamadoOpcoes,
} from '@/lib/times-responsaveis';
import {
  atualizarInteracaoCompletaSirene,
  atualizarStatusInteracaoSirene,
  listarComentariosCardSirene,
  publicarComentarioCardSirene,
  listarComentariosSireneChamado,
  publicarComentarioSireneChamado,
  type AtualizarStatusInteracaoResult,
  type ComentarioCardSireneRow,
  type StatusInteracaoDb,
} from './actions';
import {
  arquivarChamado,
  arquivarTopico,
  atualizarChamadoPainelUnificado,
  getTopicosBatchPorInteracaoIds,
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
import { MencaoContentEditable } from '@/components/kanban-shared/MencaoContentEditable';
import { ModalNovoChamado } from '../ModalNovoChamado';
import { SireneChamadoDetalheModal } from './SireneChamadoDetalheModal';
import { SireneModalHoras } from './SireneModalHoras';
import type { EditLinhaDraft, EditSireneDraft } from './SireneChamadoEdicaoForms';
import {
  ATIVIDADE_FORM_DRAFT_VAZIO,
  type AtividadeFormDraft,
} from '@/components/kanban-shared/KanbanAtividadeFormFields';
import { chamadoEditavelNaSirene } from '@/lib/kanban/sirene-chamado-permissoes';
import { formatChamadoNumero } from '@/lib/kanban/chamado-numero';
import { SlaAtividadeBadge } from '@/components/SlaAtividadeBadge';
import { ConclusaoChamadoCriadorModal } from '@/components/sirene/ConclusaoChamadoCriadorModal';
import type { TopicoPainelLinha } from '../actions';

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
  /** Número global do chamado (kanban_atividades.numero). */
  numero?: number | null;
  sirene_chamado_tipo?: string | null;
  sirene_time_abertura?: string | null;
  sirene_abertura_responsavel_nome?: string | null;
  sirene_hdm_responsavel?: string | null;
  frank_id?: string | null;
  te_trata?: boolean | null;
  categoria?: 'chamado' | 'melhoria';
  time_abertura_nome?: string | null;
  /** Chamado Sirene arquivado (admin/team pode exibir com toggle). */
  sirene_arquivado?: boolean;
  criado_por?: string | null;
  sirene_prioridade?: string | null;
};
type TimeOpt = { id: string; nome: string };
type RespOpt = { id: string; nome: string; email?: string | null };

type TopicoChamadoLinha = TopicoPainelLinha;

/** Chave de cache de tópicos: sempre por interacao_id. */
function topicosAlvoKey(row: { id: string }): string {
  return `i:${row.id}`;
}

type Props = {
  interacoes: InteracaoSireneRow[];
  times: TimeOpt[];
  responsaveis: RespOpt[];
  currentUserId: string | null;
  sessionEhAdmin?: boolean;
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
  /** Inclui chamados concluídos/cancelados quando o status do filtro é "todos". */
  mostrarConcluidas: boolean;
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
  mostrarConcluidas: false,
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
  if (f.mostrarConcluidas !== d.mostrarConcluidas) n++;
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

function textoResponsavelPainel(
  row: InteracaoSireneRow,
  nomePorUserId: Map<string, string>,
  topicos?: TopicoChamadoLinha[],
): string {
  // For Sirene chamados, show who opened it as the primary responsible
  if (row.origem === 'sirene' && row.sirene_abertura_responsavel_nome) {
    return row.sirene_abertura_responsavel_nome;
  }
  const ids = [
    ...new Set([...(row.responsaveis_ids ?? []), ...(row.responsavel_id ? [row.responsavel_id] : [])]),
  ].filter(Boolean) as string[];
  if (ids.length > 0) {
    return ids.map((id) => nomePorUserId.get(id) ?? id.slice(0, 8)).join(', ');
  }
  if (row.responsavel_id) {
    return (row.responsavel_nome ?? '').trim() || '—';
  }
  const txt = (row.responsavel_nome_texto ?? '').trim();
  if (txt) return txt;
  const topicoRef =
    topicos?.find((t) => (t.responsaveis_ids.length > 0 || t.responsavel_id) && t.prazo_status && t.prazo_status !== 'aceito') ??
    topicos?.find((t) => t.responsaveis_ids.length > 0 || t.responsavel_id != null);
  if (topicoRef) {
    const ids = topicoRef.responsaveis_ids.length > 0
      ? topicoRef.responsaveis_ids
      : topicoRef.responsavel_id ? [topicoRef.responsavel_id] : [];
    const nomes = ids.map((id) => nomePorUserId.get(id)).filter(Boolean);
    if (nomes.length) return nomes.join(', ');
  }
  return 'Sem responsável';
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
  sessionEhAdmin = false,
  comentariosCountByCardId,
  filtroTipoChamado: _filtroTipoChamado,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  void _filtroTipoChamado;
  const [highlightTopicoId, setHighlightTopicoId] = useState<number | null>(null);
  const highlightIdRef = useRef<number | null>(null);
  const skipHorasModalRef = useRef(false);
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [editingSireneCid, setEditingSireneCid] = useState<number | null>(null);
  const [editSireneDraft, setEditSireneDraft] = useState<EditSireneDraft | null>(null);
  const [salvandoSirene, setSalvandoSirene] = useState(false);
  const [detalheRow, setDetalheRow] = useState<InteracaoSireneRow | null>(null);
  const [novaAtivDraft, setNovaAtivDraft] = useState<AtividadeFormDraft>({ ...ATIVIDADE_FORM_DRAFT_VAZIO });
  const [topicosPorAlvo, setTopicosPorAlvo] = useState<Record<string, TopicoChamadoLinha[]>>({});
  const [topicosLoading, setTopicosLoading] = useState<Record<string, boolean>>({});
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
  const [conclusaoInteracaoId, setConclusaoInteracaoId] = useState<string | null>(null);
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
  const comentarioEditorRef = useRef<HTMLDivElement>(null);
  const comentarioAtivoCardIdRef = useRef<string | null>(null);
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
  const [detalheExpandido, setDetalheExpandido] = useState<Record<string, boolean>>({});
  const [atividadesExpandido, setAtividadesExpandido] = useState<Record<string, boolean>>({});
  const [horasModalChamado, setHorasModalChamado] = useState<{ chamadoId: number; titulo: string } | null>(null);
  const [statusPendente, setStatusPendente] = useState<{ rowId: string; status: string } | null>(null);
  const [subStatusPendente, setSubStatusPendente] = useState<{
    row: InteracaoSireneRow;
    topicoId: number;
    status: SubInteracaoStatusDb;
  } | null>(null);

  useEffect(() => {
    const interacaoId = searchParams.get('interacao')?.trim();
    if (!interacaoId) return;
    const topicoRaw = searchParams.get('topico')?.trim();
    const topicoNum = topicoRaw ? Number.parseInt(topicoRaw, 10) : NaN;
    setHighlightTopicoId(Number.isFinite(topicoNum) ? topicoNum : null);

    const row = interacoes.find((r) => r.id === interacaoId);
    if (!row) return;
    if (subGrupoFluxo(row) === 'concluido') {
      setApplied((a) => (a.mostrarConcluidas ? a : { ...a, mostrarConcluidas: true }));
    }
    setDetalheRow(row);
    void carregarTopicosSeNecessario(row, true);
  }, [interacoes, searchParams]);

  useEffect(() => {
    const idRaw = searchParams.get('id')?.trim();
    if (!idRaw) return;
    const idNum = Number(idRaw);
    if (!Number.isFinite(idNum)) return;
    if (highlightIdRef.current === idNum) return;
    const row = interacoes.find((r) => r.sirene_chamado_id === idNum);
    if (!row) return;
    highlightIdRef.current = idNum;
    if (subGrupoFluxo(row) === 'concluido') {
      setApplied((a) => (a.mostrarConcluidas ? a : { ...a, mostrarConcluidas: true }));
    }
    setVerTodas(true);
    setDetalheRow(row);
    void carregarTopicosSeNecessario(row, true);
  }, [interacoes, searchParams]);

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
    setTopicosPorAlvo({});
    setTopicosLoading({});
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
    return { iids: interacoes.map((r) => r.id) };
  }, [interacoes]);

  useEffect(() => {
    const iids = painelTopicosPrefetch.iids;
    if (iids.length === 0) return;
    const loadingOn = Object.fromEntries(iids.map((id) => [`i:${id}`, true]));
    setTopicosLoading((l) => ({ ...l, ...loadingOn }));
    void getTopicosBatchPorInteracaoIds(iids).then((res) => {
      const loadingOff = Object.fromEntries(iids.map((id) => [`i:${id}`, false]));
      setTopicosLoading((l) => ({ ...l, ...loadingOff }));
      if (res.ok) {
        const novos = Object.fromEntries(
          Object.entries(res.porInteracao).map(([iid, t]) => [`i:${iid}`, t]),
        );
        setTopicosPorAlvo((m) => ({ ...m, ...novos }));
      }
    });
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

  const detalheRowEff = useMemo(() => {
    if (!detalheRow) return null;
    const p = rowPatch[detalheRow.id];
    return {
      ...detalheRow,
      atividade_status: statusPatch[detalheRow.id] ?? detalheRow.atividade_status,
      ...(p ?? {}),
    };
  }, [detalheRow, rowPatch, statusPatch]);

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

  const passaFiltrosLista = useMemo(() => {
    const q = norm(applied.busca);
    return (row: InteracaoSireneRow, ocultarConcluidasPorPadrao: boolean) => {
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
        const mine =
          ids.includes(currentUserId) ||
          row.responsavel_id === currentUserId ||
          row.criado_por === currentUserId;
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
      } else if (
        ocultarConcluidasPorPadrao &&
        !applied.mostrarConcluidas &&
        subGrupoFluxo(row) === 'concluido'
      ) {
        return false;
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
    };
  }, [
    applied,
    verTodas,
    currentUserId,
    timesById,
    nomePorUserId,
    podeArquivar,
    mostrarArquivados,
  ]);

  const filtradas = useMemo(
    () => linhas.filter((row) => passaFiltrosLista(row, true)),
    [linhas, passaFiltrosLista],
  );

  const concluidosOcultosPorGrupo = useMemo(() => {
    const m = new Map<number, number>();
    for (const g of ORDEM_GRUPOS_PAINEL) m.set(g.key, 0);
    if (applied.statusF !== 'todos' || applied.mostrarConcluidas) return m;
    for (const row of linhas) {
      if (!passaFiltrosLista(row, false)) continue;
      if (subGrupoFluxo(row) !== 'concluido') continue;
      const rk = rankChamadoPainelUnificado({
        frank_id: row.frank_id,
        franqueado_nome: row.franqueado_nome,
        trava: row.trava,
        data_vencimento: row.data_vencimento,
        atividade_status: row.atividade_status,
      });
      m.set(rk.group, (m.get(rk.group) ?? 0) + 1);
    }
    return m;
  }, [linhas, passaFiltrosLista, applied.statusF, applied.mostrarConcluidas]);

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
      list.sort((a, b) =>
        compareChamadosPainelRank(
          {
            frank_id: a.frank_id,
            franqueado_nome: a.franqueado_nome,
            trava: a.trava,
            te_trata: a.te_trata,
            data_vencimento: a.data_vencimento,
            atividade_status: a.atividade_status,
            criado_em: a.criado_em,
          },
          {
            frank_id: b.frank_id,
            franqueado_nome: b.franqueado_nome,
            trava: b.trava,
            te_trata: b.te_trata,
            data_vencimento: b.data_vencimento,
            atividade_status: b.atividade_status,
            criado_em: b.criado_em,
          },
        ),
      );
    }
    return m;
  }, [filtradas]);


  function onStatusChange(id: string, novo: StatusInteracaoDb) {
    setMsgErro(null);
    if (novo === 'em_andamento') {
      setMsgErro('O status em andamento é definido automaticamente pelas atividades.');
      return;
    }
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
        if (row.criado_por && currentUserId && row.criado_por !== currentUserId) {
          setMsgErro('Somente quem abriu o chamado pode marcá-lo como concluído.');
          return;
        }
      }
      setConclusaoInteracaoId(id);
      return;
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

  function confirmarConclusaoInteracao(payload: { suficiente: boolean; texto: string }) {
    const id = conclusaoInteracaoId;
    if (!id) return;
    setMsgErro(null);
    startTransition(async () => {
      const res = await atualizarStatusInteracaoSirene(id, 'concluida', {
        infoConclusaoCriador: payload.texto,
        resolucaoSuficiente: payload.suficiente,
      });
      if (!res.ok) {
        setMsgErro(res.error);
        return;
      }
      setConclusaoInteracaoId(null);
      setStatusPatch((prev) => ({
        ...prev,
        [id]: payload.suficiente ? 'concluida' : 'em_andamento',
      }));
      router.refresh();
    });
  }

  function abrirEdicao(row: InteracaoSireneRow) {
    if (!chamadoEditavelNaSirene(row)) {
      setMsgErro('Este chamado só pode ser alterado no card vinculado.');
      return;
    }
    if (row.origem === 'sirene' && row.sirene_chamado_id != null) {
      setEditingId(null);
      setEditDraft(null);
      setEditingSireneCid(row.sirene_chamado_id);
      const tipoSc = (row.sirene_chamado_tipo ?? 'padrao') === 'hdm' ? 'hdm' : 'padrao';
      setEditSireneDraft({
        incendio: row.titulo,
        time_abertura: row.sirene_time_abertura ?? '',
        abertura_responsavel_nome: row.sirene_abertura_responsavel_nome ?? '',
        data: row.data_vencimento ?? '',
        trava: row.trava,
        tipo: tipoSc,
        hdm_responsavel: row.sirene_hdm_responsavel ?? '',
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

  function abrirDetalheChamado(row: InteracaoSireneRow) {
    setDetalheRow(row);
    setNovaAtivDraft({ ...ATIVIDADE_FORM_DRAFT_VAZIO });
    cancelarEdicao();
    void carregarTopicosSeNecessario(row, true);
  }

  async function handleAdicionarAtividadeModal(row: InteracaoSireneRow) {
    if (!chamadoEditavelNaSirene(row)) {
      setMsgErro('Este chamado só pode ser alterado no card vinculado.');
      return;
    }
    const d = novaAtivDraft;
    if (!d.nome.trim()) {
      setMsgErro('Informe o nome da atividade.');
      return;
    }
    if (d.timesIds.length === 0) {
      setMsgErro('Selecione ao menos um time.');
      return;
    }
    if (d.responsaveisIds.length === 0) {
      setMsgErro('Selecione ao menos um responsável.');
      return;
    }
    const alvoKey = topicosAlvoKey(row);
    setSalvandoTopico((s) => ({ ...s, [alvoKey]: true }));
    setMsgErro(null);
    const res = await criarSubInteracao({
      interacao_id: row.id,
      nome: d.nome.trim(),
      descricao_detalhe: d.descricaoDetalhe.trim() || null,
      times_ids: d.timesIds,
      responsaveis_ids: d.responsaveisIds,
      data_fim: d.data.trim() || null,
      status: 'nao_iniciado',
      pastel: d.pastel,
      basePath: '/sirene/chamados',
      viaSirene: true,
    });
    setSalvandoTopico((s) => ({ ...s, [alvoKey]: false }));
    if (!res.ok) {
      setMsgErro(res.error);
      return;
    }
    setNovaAtivDraft({ ...ATIVIDADE_FORM_DRAFT_VAZIO });
    void carregarTopicosSeNecessario(row, true);
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
      const timeAb = editSireneDraft.time_abertura.trim();
      const inferred = inferirHdmResponsavelPorNomesTimes(timeAb ? [timeAb] : []);
      const tipoEff = inferred ? 'hdm' : 'padrao';
      const hdmVal = inferred;
      const res = await atualizarChamadoPainelUnificado(chamadoId, {
        incendio: editSireneDraft.incendio.trim(),
        time_abertura: timeAb || null,
        abertura_responsavel_nome: editSireneDraft.abertura_responsavel_nome.trim() || null,
        data_vencimento: editSireneDraft.data.trim() || null,
        trava: editSireneDraft.trava,
        tipo: tipoEff,
        hdm_responsavel: hdmVal,
      });
      if (!res.ok) {
        setMsgErro(res.error);
        return;
      }
      const tipoKa = tipoEff === 'hdm' ? 'chamado_hdm' : 'chamado_padrao';
      setRowPatch((prev) => ({
        ...prev,
        [atividadeRowId]: {
          titulo: editSireneDraft.incendio.trim(),
          tipo: tipoKa,
          data_vencimento: editSireneDraft.data.trim() || null,
          trava: editSireneDraft.trava,
          sirene_time_abertura: timeAb || null,
          sirene_abertura_responsavel_nome: editSireneDraft.abertura_responsavel_nome.trim() || null,
          sirene_chamado_tipo: tipoEff,
          sirene_hdm_responsavel: tipoEff === 'hdm' ? hdmVal : null,
        },
      }));
      setEditingSireneCid(null);
      setEditSireneDraft(null);
    } finally {
      setSalvandoSirene(false);
    }
  }

  async function handleSubStatusPainel(
    row: InteracaoSireneRow,
    topicoId: number,
    status: SubInteracaoStatusDb,
  ) {
    setMsgErro(null);
    if (
      !skipHorasModalRef.current &&
      row.sirene_chamado_id != null &&
      (status === 'concluido' || status === 'em_andamento')
    ) {
      setStatusPendente({ rowId: row.id, status: 'manter' });
      setHorasModalChamado({ chamadoId: row.sirene_chamado_id, titulo: row.titulo });
      setSubStatusPendente({ row, topicoId, status });
      return;
    }
    const res = await atualizarStatusSubInteracao(String(topicoId), status, '/sirene/chamados', true);
    if (!res.ok) {
      setMsgErro(res.error);
      return;
    }
    if (status === 'em_andamento') {
      setStatusPatch((prev) => ({ ...prev, [row.id]: 'em_andamento' }));
    }
    router.refresh();
    void carregarTopicosSeNecessario(row, true);
  }

  function toggleComentarios(row: InteracaoSireneRow) {
    const cid = row.card_id;
    const scid = row.sirene_chamado_id;
    // Use sirene_chamado_id as fallback key for direct Sirene chamados
    const commentKey = cid ?? (scid != null ? `sirene-${scid}` : null);
    if (!commentKey) return;
    const willOpen = !commentsOpenByRow[row.id];
    setCommentsOpenByRow((p) => ({ ...p, [row.id]: willOpen }));
    if (willOpen) {
      comentarioAtivoCardIdRef.current = commentKey;
    }
    if (willOpen && !commentsFetchedByCard[commentKey]) {
      setCommentsFetchedByCard((f) => ({ ...f, [commentKey]: true }));
      setCommentsLoading((l) => ({ ...l, [commentKey]: true }));
      if (cid) {
        void listarComentariosCardSirene(cid).then((res) => {
          setCommentsLoading((l) => ({ ...l, [commentKey]: false }));
          if (res.ok) setCommentsByCardId((c) => ({ ...c, [commentKey]: res.items }));
          else setMsgErro(res.error);
        });
      } else if (scid != null) {
        void listarComentariosSireneChamado(scid).then((res) => {
          setCommentsLoading((l) => ({ ...l, [commentKey]: false }));
          if (res.ok) setCommentsByCardId((c) => ({ ...c, [commentKey]: res.items }));
          else setMsgErro(res.error);
        });
      }
    }
  }

  async function publicarComentario(commentKey: string, row: InteracaoSireneRow) {
    const html =
      comentarioAtivoCardIdRef.current === commentKey && comentarioEditorRef.current
        ? comentarioEditorRef.current.innerHTML.trim()
        : (novoComentarioPorCard[commentKey] ?? '').trim();
    if (!html) return;
    setSalvandoComentario((s) => ({ ...s, [commentKey]: true }));
    setMsgErro(null);
    try {
      const referenciaPath =
        row.sirene_chamado_id != null
          ? `/sirene/chamados?interacao=${encodeURIComponent(row.id)}`
          : '/sirene/chamados';
      let res: AtualizarStatusInteracaoResult;
      if (row.card_id) {
        res = await publicarComentarioCardSirene(row.card_id, html, {
          referenciaPath,
          contextoTitulo: row.titulo || row.card_titulo || 'Chamado',
        });
      } else if (row.sirene_chamado_id != null) {
        res = await publicarComentarioSireneChamado(row.sirene_chamado_id, html, {
          referenciaPath,
          contextoTitulo: row.titulo || 'Chamado',
        });
      } else {
        setMsgErro('Não foi possível identificar o chamado.');
        setSalvandoComentario((s) => ({ ...s, [commentKey]: false }));
        return;
      }
      if (!res.ok) {
        setMsgErro(res.error);
        return;
      }
      setNovoComentarioPorCard((m) => ({ ...m, [commentKey]: '' }));
      if (comentarioEditorRef.current) comentarioEditorRef.current.innerHTML = '';
      setCountPatch((c) => ({ ...c, [commentKey]: (c[commentKey] ?? comentariosCount(commentKey)) + 1 }));
      // Recarrega comentários direto sem fechar o painel
      setCommentsLoading((l) => ({ ...l, [commentKey]: true }));
      const cid = row.card_id;
      const scid = row.sirene_chamado_id;
      if (cid) {
        void listarComentariosCardSirene(cid).then((res) => {
          setCommentsLoading((l) => ({ ...l, [commentKey]: false }));
          if (res.ok) setCommentsByCardId((c) => ({ ...c, [commentKey]: res.items }));
        });
      } else if (scid != null) {
        void listarComentariosSireneChamado(scid).then((res) => {
          setCommentsLoading((l) => ({ ...l, [commentKey]: false }));
          if (res.ok) setCommentsByCardId((c) => ({ ...c, [commentKey]: res.items }));
        });
      }
    } catch (e) {
      setMsgErro(String(e));
    } finally {
      setSalvandoComentario((s) => ({ ...s, [commentKey]: false }));
    }
  }

  function comentariosCount(commentKey: string | null): number {
    if (!commentKey) return 0;
    if (countPatch[commentKey] != null) return countPatch[commentKey]!;
    return comentariosCountByCardId[commentKey] ?? 0;
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

  const timesSireneEditOpcoes = useMemo(() => [...timesMoniReceberChamadoOpcoes(false)], []);

  const radioRow = 'flex flex-wrap gap-x-4 gap-y-2 text-sm text-[color:var(--moni-text-secondary)]';
  const radioLabel = 'inline-flex cursor-pointer items-center gap-2';

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1600px] px-6 py-6 text-[color:var(--moni-text-primary)]">
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
                  {draft.statusF === 'todos' ? (
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm text-[color:var(--moni-text-secondary)]">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[color:var(--moni-border-default)]"
                        checked={draft.mostrarConcluidas}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, mostrarConcluidas: e.target.checked }))
                        }
                      />
                      Mostrar concluídos
                    </label>
                  ) : null}
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
          const ocultos = concluidosOcultosPorGrupo.get(key) ?? 0;
          if (lista.length === 0) return null;
          const totalGrupo = lista.length + ocultos;
          return (
            <section key={key}>
              <h3 className="mb-3 border-b border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] px-3 py-2 text-sm font-semibold text-[color:var(--moni-text-primary)]">
                {titulo}
                <span className="ml-2 font-normal text-[color:var(--moni-text-tertiary)]">
                  ({lista.length}
                  {ocultos > 0 ? ` de ${totalGrupo}` : ''})
                </span>
              </h3>
              <ul className="rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)]">
                {lista.map((row) => {
                  const tipoB = badgeTipo(row.tipo);
                  const hrefCard = row.card_id ? rotaCardOrigem(row.kanban_nome, row.card_id) : null;
                  const sel = statusDbParaSelect(row.atividade_status);
                  const idsResp = [...new Set([...(row.responsaveis_ids ?? []), ...(row.responsavel_id ? [row.responsavel_id] : [])])];
                  const rankRow = rankChamadoPainelUnificado({
                    frank_id: row.frank_id,
                    franqueado_nome: row.franqueado_nome,
                    trava: row.trava,
                    te_trata: row.te_trata,
                    data_vencimento: row.data_vencimento,
                    atividade_status: row.atividade_status,
                    criado_em: row.criado_em,
                  });

                  const ccid = row.card_id;
                  const commentKey = ccid ?? (row.sirene_chamado_id != null ? `sirene-${row.sirene_chamado_id}` : null);
                  const cnt = comentariosCount(commentKey);
                  const alvoK = topicosAlvoKey(row);
                  const subs = topicosPorAlvo[alvoK] ?? [];
                  const temSubAberta = subs.some((s) => s.status !== 'concluido' && s.status !== 'aprovado');
                  const qtdAtividades = subs.length;

                  return (
                    <li key={row.id} className="border-b border-[color:var(--moni-border-default)] last:border-b-0">
                      <div className="px-3 py-2.5">
                          {/* Linha 1: badges + título + tipo + prioridade */}
                          <div
                            role="button"
                            tabIndex={0}
                            className="flex min-w-0 cursor-pointer items-center gap-2 hover:opacity-80"
                            onClick={() => abrirDetalheChamado(row)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDetalheChamado(row); } }}
                          >
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--moni-text-tertiary)]" aria-hidden />
                            {row.trava ? (
                              <span className="shrink-0 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-800">Trava</span>
                            ) : null}
                            {(row.numero ?? row.sirene_numero) != null ? (
                              <span className="shrink-0 rounded bg-[var(--moni-surface-100)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[color:var(--moni-text-secondary)]">
                                {formatChamadoNumero(row.numero ?? row.sirene_numero)}
                              </span>
                            ) : null}
                            {row.sirene_arquivado ? (
                              <span className="shrink-0 rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[color:var(--moni-text-tertiary)]">Arquivado</span>
                            ) : null}
                            <span className="min-w-0 flex-1 truncate font-medium text-[color:var(--moni-text-primary)]">{row.titulo}</span>
                            <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${tipoB.className}`}>{tipoB.label}</span>
                            <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                              rankRow.prioridade_label === 'P1' || rankRow.prioridade_label === 'P2'
                                ? 'border-red-200 bg-red-50 text-red-800'
                                : rankRow.prioridade_label === 'P3' || rankRow.prioridade_label === 'P4'
                                ? 'border-amber-200 bg-amber-50 text-amber-800'
                                : rankRow.prioridade_label === 'P5'
                                ? 'border-green-200 bg-green-50 text-green-700'
                                : 'border-[color:var(--moni-border-default)] bg-[var(--moni-surface-100)] text-[color:var(--moni-text-secondary)]'
                            }`}>{rankRow.prioridade_label}</span>
                            {row.origem === 'sirene' ? (
                              <span className="shrink-0 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">Sirene</span>
                            ) : row.origem === 'pastelaria' ? (
                              <span className="shrink-0 rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">Pastelaria</span>
                            ) : null}
                          </div>

                          {/* Linha 2: meta + ações */}
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {/* meta chips */}
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[color:var(--moni-text-tertiary)]">
                              {row.sirene_abertura_responsavel_nome ? (
                                <span className="flex items-center gap-1">
                                  <span className="text-[color:var(--moni-text-tertiary)]">Aberto por</span>
                                  <span className="text-[color:var(--moni-text-secondary)]">{row.sirene_abertura_responsavel_nome}</span>
                                </span>
                              ) : null}
                              {row.franqueado_nome ? (
                                <>
                                  {row.sirene_abertura_responsavel_nome ? <span className="text-[color:var(--moni-border-default)]">·</span> : null}
                                  <span className="text-[color:var(--moni-text-secondary)]">{row.franqueado_nome}</span>
                                </>
                              ) : null}
                              {row.card_titulo ? (
                                <>
                                  <span className="text-[color:var(--moni-border-default)]">·</span>
                                  <span className="truncate text-[color:var(--moni-text-tertiary)]">Card: {row.card_titulo.trim()}</span>
                                </>
                              ) : (
                                <span className="text-[color:var(--moni-text-tertiary)]">{row.kanban_nome}</span>
                              )}
                            </div>

                            {/* ações */}
                            <div
                              className="flex shrink-0 items-center gap-1.5"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                            >
                              {/* expand detalhes */}
                              <button
                                type="button"
                                onClick={() => setDetalheExpandido((s) => ({ ...s, [row.id]: !s[row.id] }))}
                                className="inline-flex items-center gap-1 rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-1.5 py-0.5 text-[10px] text-[color:var(--moni-text-secondary)] hover:border-[color:var(--moni-border-strong)] hover:text-[color:var(--moni-text-primary)]"
                              >
                                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                <span>Detalhes</span>
                              </button>
                              {/* expand atividades */}
                              {qtdAtividades > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setAtividadesExpandido((s) => ({ ...s, [row.id]: !s[row.id] }))}
                                  className="inline-flex items-center gap-1 rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-1.5 py-0.5 text-[10px] text-[color:var(--moni-text-secondary)] hover:border-[color:var(--moni-border-strong)] hover:text-[color:var(--moni-text-primary)]"
                                >
                                  <CheckSquare className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  <span>{qtdAtividades} atividade{qtdAtividades === 1 ? '' : 's'}</span>
                                </button>
                              ) : null}
                              {/* comentários */}
                              {(() => {
                                const commentKey = ccid ?? (row.sirene_chamado_id != null ? `sirene-${row.sirene_chamado_id}` : null);
                                if (!commentKey) return null;
                                return (
                                  <button
                                    type="button"
                                    onClick={() => toggleComentarios(row)}
                                    className="inline-flex items-center gap-1 rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-1.5 py-0.5 text-[color:var(--moni-text-secondary)] hover:border-[color:var(--moni-border-strong)] hover:text-[color:var(--moni-text-primary)]"
                                    aria-expanded={Boolean(commentsOpenByRow[row.id])}
                                    aria-label={`Comentários do chamado (${cnt})`}
                                  >
                                    <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                    <span className="min-w-[1rem] text-center text-[10px] font-semibold tabular-nums">{cnt}</span>
                                  </button>
                                );
                              })()}
                              {/* avatares responsáveis */}
                              {idsResp.length > 0 ? (
                                <div className="flex -space-x-1">
                                  {idsResp.slice(0, 4).map((uid) => (
                                    <span
                                      key={uid}
                                      title={nomePorUserId.get(uid) ?? uid}
                                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-100)] text-[9px] font-semibold text-[color:var(--moni-text-primary)]"
                                    >
                                      {iniciaisNome(nomePorUserId.get(uid) ?? '?')}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              <SlaAtividadeBadge
                                prazoIso={row.data_vencimento}
                                status={sel === 'concluida' ? 'concluida' : sel}
                                showOkText={false}
                              />
                              {sel === 'em_andamento' ? (
                                <span className="min-w-[8rem] rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] px-2 py-1 text-center text-xs text-[color:var(--moni-text-secondary)]">Em andamento</span>
                              ) : (
                                <SelectMoni
                                  value={sel}
                                  disabled={pending}
                                  onChange={(e) => onStatusChange(row.id, e.target.value as StatusInteracaoDb)}
                                  className="min-w-[8rem] text-xs"
                                  aria-label="Status do chamado"
                                >
                                  <option value="pendente">A fazer</option>
                                  <option value="concluida" disabled={temSubAberta}>Concluída</option>
                                </SelectMoni>
                              )}
                            </div>
                          </div>

                          {/* Expansão: detalhes */}
                          {detalheExpandido[row.id] ? (
                            <div className="mt-2 rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] px-3 py-2 text-[11px] text-[color:var(--moni-text-secondary)]">
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                {row.criado_em ? (
                                  <span><span className="font-medium text-[color:var(--moni-text-primary)]">Aberto em</span> {new Date(row.criado_em).toLocaleDateString('pt-BR')}</span>
                                ) : null}
                                {row.card_titulo ? (
                                  <span><span className="font-medium text-[color:var(--moni-text-primary)]">Card</span> {row.card_titulo.trim()}</span>
                                ) : null}
                                {row.kanban_nome ? (
                                  <span><span className="font-medium text-[color:var(--moni-text-primary)]">Funil</span> {row.kanban_nome}</span>
                                ) : null}
                              </div>
                              {row.descricao ? (
                                <p className="mt-1.5 leading-relaxed text-[color:var(--moni-text-secondary)]">{row.descricao}</p>
                              ) : null}
                            </div>
                          ) : null}

                          {/* Expansão: atividades */}
                          {atividadesExpandido[row.id] && subs.length > 0 ? (
                            <div className="mt-2 rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] px-3 py-1">
                              {subs.map((s) => (
                                <div key={s.id ?? (s as { topico_id?: number }).topico_id} className="flex items-center gap-2 border-b border-[color:var(--moni-border-default)] py-1.5 last:border-b-0 text-[11px]">
                                  <span className={`h-2 w-2 shrink-0 rounded-full ${s.status === 'concluido' || s.status === 'aprovado' ? 'bg-green-500' : s.status === 'em_andamento' ? 'bg-amber-500' : 'bg-stone-400'}`} />
                                  <span className="min-w-0 flex-1 truncate text-[color:var(--moni-text-primary)]">{(s as { titulo?: string }).titulo ?? (s as { tema?: string }).tema ?? s.descricao ?? '—'}</span>
                                  {(s as { responsavel_nome?: string }).responsavel_nome ? (
                                    <span
                                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-100)] text-[8px] font-semibold text-[color:var(--moni-text-primary)]"
                                      title={(s as { responsavel_nome?: string }).responsavel_nome}
                                    >
                                      {iniciaisNome((s as { responsavel_nome?: string }).responsavel_nome ?? '')}
                                    </span>
                                  ) : null}
                                  {(s as { prazo?: string }).prazo ?? s.data_fim ? (
                                    <span className="shrink-0 text-[10px] text-[color:var(--moni-text-tertiary)]">{new Date(((s as { prazo?: string }).prazo ?? s.data_fim)!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>

                      {commentsOpenByRow[row.id] && (() => {
                        const commentKey = ccid ?? (row.sirene_chamado_id != null ? `sirene-${row.sirene_chamado_id}` : null);
                        return commentKey ? (
                        <div className="mt-3 rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] p-3">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                            Comentários
                          </p>
                          {commentsLoading[commentKey] ? (
                            <p className="text-xs text-[color:var(--moni-text-tertiary)]">Carregando…</p>
                          ) : (
                            <ul className="mb-3 max-h-48 space-y-2 overflow-y-auto text-sm">
                              {[...(commentsByCardId[commentKey] ?? [])]
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
                          <div className="flex flex-col gap-2">
                            <div
                              className="overflow-visible rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)]"
                              onFocus={() => {
                                comentarioAtivoCardIdRef.current = commentKey;
                              }}
                            >
                              <MencaoContentEditable
                                editorRef={comentarioEditorRef}
                                onInput={(html) =>
                                  setNovoComentarioPorCard((m) => ({ ...m, [commentKey]: html }))
                                }
                                className="min-h-[72px] w-full p-2 text-sm text-[color:var(--moni-text-primary)] focus:outline-none empty:before:text-[color:var(--moni-text-tertiary)] empty:before:content-[attr(data-placeholder)]"
                                placeholder="Escreva um comentário… Use @ para mencionar"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={Boolean(salvandoComentario[commentKey])}
                              onClick={() => void publicarComentario(commentKey, row)}
                              className="self-end shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                            >
                              {salvandoComentario[commentKey] ? '…' : 'Publicar'}
                            </button>
                          </div>
                        </div>
                        ) : null;
                      })()}

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

      {detalheRowEff ? (
        <SireneChamadoDetalheModal
          row={detalheRowEff}
          onClose={() => {
            setDetalheRow(null);
            setHighlightTopicoId(null);
            setNovaAtivDraft({ ...ATIVIDADE_FORM_DRAFT_VAZIO });
            cancelarEdicao();
            if (searchParams.get('interacao')) {
              router.replace('/sirene/chamados');
            }
          }}
          topicos={topicosPorAlvo[topicosAlvoKey(detalheRowEff)] ?? []}
          topicosLoading={Boolean(topicosLoading[topicosAlvoKey(detalheRowEff)])}
          nomePorUserId={nomePorUserId}
          rankLabel={(() => {
            const rank = rankChamadoPainelUnificado({
              frank_id: detalheRowEff.frank_id,
              franqueado_nome: detalheRowEff.franqueado_nome,
              trava: detalheRowEff.trava,
              te_trata: detalheRowEff.te_trata,
              data_vencimento: detalheRowEff.data_vencimento,
              atividade_status: detalheRowEff.atividade_status,
              criado_em: detalheRowEff.criado_em,
            });
            return rank != null ? `P${rank}` : null;
          })()}
          textoResponsavel={textoResponsavelPainel(
            detalheRowEff,
            nomePorUserId,
            topicosPorAlvo[topicosAlvoKey(detalheRowEff)],
          )}
          parseTimesNomes={parseTimesNomes}
          statusSelect={statusDbParaSelect(detalheRowEff.atividade_status)}
          temSubAberta={(topicosPorAlvo[topicosAlvoKey(detalheRowEff)] ?? []).some(
            (s) => s.status !== 'concluido' && s.status !== 'aprovado',
          )}
          pending={pending}
          onStatusChange={onStatusChange}
          onSubStatusChange={(topicoId, status) =>
            void handleSubStatusPainel(detalheRowEff, topicoId, status)
          }
          onEdit={() => abrirEdicao(detalheRowEff)}
          onArquivar={() =>
            setModalArquivar({
              cid: detalheRowEff.sirene_chamado_id ?? null,
              interacaoId: detalheRowEff.id,
            })
          }
          podeArquivar={podeArquivar}
          badgeTipo={badgeTipo(detalheRowEff.tipo)}
          editingKanban={editingId === detalheRowEff.id && editDraft != null}
          editDraft={editDraft}
          setEditDraft={setEditDraft}
          editingSirene={
            detalheRowEff.sirene_chamado_id != null &&
            editingSireneCid === detalheRowEff.sirene_chamado_id &&
            editSireneDraft != null
          }
          editSireneDraft={editSireneDraft}
          setEditSireneDraft={setEditSireneDraft}
          times={times}
          responsaveis={responsaveis}
          timesSireneEditOpcoes={timesSireneEditOpcoes}
          salvandoEdicao={salvandoEdicao}
          salvandoSirene={salvandoSirene}
          onSalvarEdicao={() => void salvarEdicao(detalheRowEff.id)}
          onSalvarEdicaoSirene={() =>
            void salvarEdicaoSirene(detalheRowEff.id, detalheRowEff.sirene_chamado_id!)
          }
          onCancelarEdicao={cancelarEdicao}
          novaAtivDraft={novaAtivDraft}
          setNovaAtivDraft={setNovaAtivDraft}
          onAdicionarAtividade={() => void handleAdicionarAtividadeModal(detalheRowEff)}
          salvandoNovaAtividade={Boolean(salvandoTopico[topicosAlvoKey(detalheRowEff)])}
          currentUserId={currentUserId}
          onArquivarTopico={(topicoId) => {
            setModalArquivarTopico({
              topicoId,
              alvoKey: topicosAlvoKey(detalheRowEff),
            });
            setMotivoArquivarTopico('');
          }}
          highlightTopicoId={highlightTopicoId}
          sessionEhAdmin={sessionEhAdmin}
          onRecarregarTopicos={() => {
            if (detalheRowEff) void carregarTopicosSeNecessario(detalheRowEff, true);
          }}
        />
      ) : null}

      <ConclusaoChamadoCriadorModal
        open={conclusaoInteracaoId != null}
        onClose={() => setConclusaoInteracaoId(null)}
        onConfirm={confirmarConclusaoInteracao}
        pending={pending}
      />

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
                    if (ak.startsWith('i:')) {
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

      {horasModalChamado ? (
        <SireneModalHoras
          chamadoId={horasModalChamado.chamadoId}
          titulo={horasModalChamado.titulo}
          onClose={() => {
            setHorasModalChamado(null);
            setStatusPendente(null);
          }}
          onSaved={() => {
            setHorasModalChamado(null);
            if (subStatusPendente) {
              skipHorasModalRef.current = true;
              void handleSubStatusPainel(subStatusPendente.row, subStatusPendente.topicoId, subStatusPendente.status).finally(() => {
                skipHorasModalRef.current = false;
              });
              setSubStatusPendente(null);
            } else if (statusPendente) {
              skipHorasModalRef.current = true;
              void onStatusChange(statusPendente.rowId, statusPendente.status as StatusInteracaoDb);
              skipHorasModalRef.current = false;
            }
            setStatusPendente(null);
          }}
        />
      ) : null}
    </div>
  );
}
