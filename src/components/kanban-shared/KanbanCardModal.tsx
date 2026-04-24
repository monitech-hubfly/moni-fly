'use client';

import type { ChangeEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Pencil,
  BookOpen,
  Link2,
  FileText,
  Video,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { calcularDiasUteis, calcularStatusSLA, formatIsoDateOnlyPtBr, parseIsoDateOnlyLocal } from '@/lib/dias-uteis';
import { rotuloSlaInteracaoPainel } from '@/lib/painel-tarefas-filtros';
import {
  arquivarCard,
  atualizarStatusSubInteracao,
  buscarCardsParaVinculo,
  criarInteracao,
  criarSubInteracao,
  criarVinculoCard,
  editarInteracao,
  finalizarCard,
  listarVinculosCard,
  removerVinculoCard,
  salvarDadosPreObra,
  salvarInstrucoesFase,
  solicitarAprovacaoFase,
  uploadContratoFranquia,
  verificarChecklistParaFase,
  gerarFormTokenCandidato,
  enviarEmailCard,
  type BuscaCardVinculoRow,
  type KanbanCardVinculoListItem,
  type SubInteracaoStatusDb,
  type TipoVinculoKanbanCard,
} from '@/lib/actions/card-actions';
import {
  displayOrDash,
  fetchKanbanCardModalDetalhes,
  fmtMoedaKanban,
  preObraDraftFromProcesso,
  type KanbanCardModalDetalhes,
  type PreObraDraftKanban,
} from '@/lib/kanban/kanban-card-modal-detalhes';
import { SlaTituloBolinha } from '@/components/SlaTituloBolinha';
import { AtividadeVinculadaCard } from '@/components/AtividadeVinculadaCard';
import { AtividadeVinculadaIcon } from '@/components/AtividadeVinculadaIcon';
import { AtividadeVinculadaStatusPill } from '@/components/AtividadeVinculadaStatusPill';
import {
  type AtividadeVinculadaKind,
  labelKanbanAtividadeParaPill,
  resolveKanbanChamadoIconKind,
  resolveKanbanChamadoSurfaceKind,
} from '@/lib/atividade-vinculada-visual';
import type { CamposPorFaseMap, KanbanFase, KanbanFaseMaterial, KanbanNomeDisplay } from './types';
import { usePermissoes } from '@/lib/hooks/usePermissoes';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import { parseKanbanFaseMateriais } from '@/lib/kanban/parse-kanban-fase-materiais';
import {
  countKanbanModalInteracoesFiltrosAtivos,
  KanbanInteracoesFiltrosPanel,
  KANBAN_MODAL_INTERACOES_FILTROS_DEFAULT,
  type KanbanModalInteracoesFiltros,
} from './KanbanInteracoesFiltrosPanel';
import {
  derivarChamadoKanbanComSubs,
  formatDataHoraHistorico,
  iconeHistoricoAcao,
  interacaoPassaFiltroResponsavel,
  interacaoPassaFiltroTime,
  interacoesDemonstracao,
  isInteracaoDemonstracao,
  prazoEfetivoParaChamado,
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
import {
  TIMES_MONI,
  inferResponsavelMoniFromInteracao,
  inferTimeMoniFromInteracao,
  responsaveisFiltroOpcoesComCatalogoMoni,
  resolveKanbanInteracaoFromCatalog,
  responsaveisDoTimeMoni,
  timesFiltroOpcoesComCatalogoMoni,
  validarParTimeResponsavelMoni,
} from '@/lib/times-responsaveis';
import { AnexosChamado } from './AnexosChamado';
import { AnexosSubchamado } from './AnexosSubchamado';
import { ChecklistCard } from './ChecklistCard';
import { FaseChecklistCard } from './FaseChecklistCard';
import {
  buildLegadoFaseTimeline,
  buildNativeFaseTimeline,
  type ProcessoCardMoveEvt,
} from '@/lib/kanban/kanban-card-timeline';

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
  /** Nativo: finalização explícita (`finalizarCard`). */
  concluido?: boolean;
  concluido_em?: string | null;
  arquivado?: boolean;
  /** Legado: status e updated_at do processo (conclusão aproximada quando status = concluido). */
  processo_meta?: { status: string; updated_at: string } | null;
  profiles?: {
    full_name: string | null;
  } | null;
};

function mapInteracaoStatusParaPainelSla(s: InteracaoModal['status']): string {
  if (s === 'concluida' || s === 'cancelada') return 'concluido';
  if (s === 'em_andamento') return 'em_andamento';
  return 'nao_iniciada';
}

function kanbanStatusParaPillKind(s: InteracaoModal['status']): AtividadeVinculadaKind {
  if (s === 'concluida') return 'concluido';
  if (s === 'cancelada') return 'cancelada';
  if (s === 'em_andamento') return 'em_andamento';
  return 'pendente';
}

function IconeMaterialTipo({ tipo }: { tipo: KanbanFaseMaterial['tipo'] }) {
  const cls = 'h-3.5 w-3.5 shrink-0 text-stone-500';
  if (tipo === 'documento') return <FileText className={cls} aria-hidden />;
  if (tipo === 'video') return <Video className={cls} aria-hidden />;
  return <Link2 className={cls} aria-hidden />;
}

function inicioDiaLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Fundo da linha do chamado (listagem) conforme SLA do prazo efetivo. */
function corFundoChamado(dataVencimento: string | null | undefined, status: string) {
  const neutro = { background: '#f5f5f4', border: '0.5px solid #e7e5e4' };
  const st = String(status ?? '').trim().toLowerCase();
  if (st === 'concluida' || st === 'concluido' || st === 'cancelada') return neutro;
  if (!dataVencimento) return neutro;
  const alvo = parseIsoDateOnlyLocal(dataVencimento);
  if (!alvo || !Number.isFinite(alvo.getTime())) return neutro;
  const hoje = inicioDiaLocal(new Date());
  const al = inicioDiaLocal(alvo);
  if (al.getTime() < hoje.getTime()) {
    return { background: 'rgb(254 242 242)', border: '1px solid rgb(254 202 202)' };
  }
  if (al.getTime() === hoje.getTime()) {
    return { background: '#FAEEDA', border: '1px solid #D4AD68' };
  }
  const du = calcularDiasUteis(hoje, al);
  if (du <= 1) return { background: '#FAEEDA', border: '1px solid #D4AD68' };
  return neutro;
}

export type KanbanCardModalProps = {
  cardId: string;
  kanbanNome: KanbanNomeDisplay | string;
  onClose: () => void;
  /** Se não vier, as fases são carregadas do banco após obter o card. */
  fases?: KanbanFase[];
  isAdmin?: boolean;
  /** Rota do kanban (ex.: `/funil-stepone`) — usada em links auxiliares. */
  basePath?: string;
  camposPorFase?: CamposPorFaseMap;
  /** `legado`: card é `processo_step_one` (view); não usa `kanban_cards`. */
  origem?: 'legado' | 'nativo';
  /** Portal do franqueado: oculta arquivar, finalizar e mudança de fase. */
  portalFrank?: boolean;
};

export function KanbanCardModal({
  cardId,
  kanbanNome,
  onClose,
  fases: fasesProp,
  isAdmin = false,
  basePath = '/',
  camposPorFase,
  origem = 'nativo',
  portalFrank = false,
}: KanbanCardModalProps) {
  const router = useRouter();
  const { pode } = usePermissoes();
  const ocultarGestaoCard = portalFrank === true;
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<Card | null>(null);
  const [linkCandidato, setLinkCandidato] = useState<string | null>(null);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [fases, setFases] = useState<KanbanFase[]>(fasesProp ?? []);
  const [faseAtual, setFaseAtual] = useState<KanbanFase | null>(null);
  const [secaoAberta, setSecaoAberta] = useState<Record<SecaoEsquerdaId, boolean>>({
    cronologia: false,
    franqueado: false,
    novoNegocio: false,
    preObra: false,
    obra: false,
    relacionamentos: false,
    historico: false,
  });
  const [legadoCronologiaMoves, setLegadoCronologiaMoves] = useState<ProcessoCardMoveEvt[]>([]);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [comentariosCard, setComentariosCard] = useState<ComentarioCardRow[]>([]);
  const [novoComentarioCard, setNovoComentarioCard] = useState('');
  const [salvandoComentario, setSalvandoComentario] = useState(false);
  const [abaComentarios, setAbaComentarios] = useState<'comentarios' | 'email'>('comentarios');
  const [emailPara, setEmailPara] = useState('');
  const [emailAssunto, setEmailAssunto] = useState('');
  const [emailMensagem, setEmailMensagem] = useState('');
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [erroEmail, setErroEmail] = useState<string | null>(null);
  const [interacoes, setInteracoes] = useState<InteracaoModal[]>([]);
  const [modalSessao, setModalSessao] = useState<{
    userId: string | null;
    uploaderNome: string;
    ehAdminOuTeam: boolean;
  }>({ userId: null, uploaderNome: '—', ehAdminOuTeam: false });
  const [kanbanTimes, setKanbanTimes] = useState<KanbanTimeRow[]>([]);
  const [responsaveisOpcoes, setResponsaveisOpcoes] = useState<{ id: string; nome: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    titulo: '',
    descricao: '',
    tipo: 'atividade' as 'atividade' | 'duvida',
    data: '',
    timeMoni: '',
    responsavelMoni: '',
    trava: false,
  });
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [novaInteracao, setNovaInteracao] = useState({
    titulo: '',
    tipo: 'atividade' as 'atividade' | 'duvida',
    data: '',
    timeMoni: '',
    responsavelMoni: '',
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
  const [filtros, setFiltros] = useState<KanbanModalInteracoesFiltros>(KANBAN_MODAL_INTERACOES_FILTROS_DEFAULT);
  const [filtrosDraft, setFiltrosDraft] = useState<KanbanModalInteracoesFiltros>(KANBAN_MODAL_INTERACOES_FILTROS_DEFAULT);
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const filtrosPopoverRef = useRef<HTMLDivElement>(null);
  const filtrosBtnRef = useRef<HTMLButtonElement>(null);
  const [arquivamentoAberto, setArquivamentoAberto] = useState(false);
  const [motivoArquivamento, setMotivoArquivamento] = useState('');
  const [confirmandoFinalizar, setConfirmandoFinalizar] = useState(false);
  const [modalDetalhes, setModalDetalhes] = useState<KanbanCardModalDetalhes>({
    rede: null,
    processo: null,
    redeIdContrato: null,
  });
  const [preObraDraft, setPreObraDraft] = useState<PreObraDraftKanban>(() => preObraDraftFromProcesso(null));
  const [salvandoPreObra, setSalvandoPreObra] = useState(false);
  const [uploadingContrato, setUploadingContrato] = useState(false);
  const contratoFileRef = useRef<HTMLInputElement>(null);
  const [editandoInstrucoesFase, setEditandoInstrucoesFase] = useState(false);
  const [draftInstrucoesFase, setDraftInstrucoesFase] = useState('');
  const [draftMateriaisFase, setDraftMateriaisFase] = useState<KanbanFaseMaterial[]>([]);
  const [salvandoInstrucoesFase, setSalvandoInstrucoesFase] = useState(false);
  const [vinculosCard, setVinculosCard] = useState<KanbanCardVinculoListItem[]>([]);
  const [vincularAberto, setVincularAberto] = useState(false);
  const [buscaVinculo, setBuscaVinculo] = useState('');
  const [tipoNovoVinculo, setTipoNovoVinculo] = useState<TipoVinculoKanbanCard>('relacionado');
  const [resultadosBuscaVinculo, setResultadosBuscaVinculo] = useState<BuscaCardVinculoRow[]>([]);
  const [modalAprovacaoFase, setModalAprovacaoFase] = useState<{
    fase: KanbanFase;
    direcao: 'avancar' | 'retroceder';
    itensPendentes: number;
  } | null>(null);
  const [solicitandoAprovacaoFase, setSolicitandoAprovacaoFase] = useState(false);

  useEffect(() => {
    setArquivamentoAberto(false);
    setMotivoArquivamento('');
    setConfirmandoFinalizar(false);
    setFiltros(KANBAN_MODAL_INTERACOES_FILTROS_DEFAULT);
    setFiltrosDraft(KANBAN_MODAL_INTERACOES_FILTROS_DEFAULT);
    setFiltrosOpen(false);
    setModalDetalhes({ rede: null, processo: null, redeIdContrato: null });
    setPreObraDraft(preObraDraftFromProcesso(null));
    setLegadoCronologiaMoves([]);
    setEditandoInstrucoesFase(false);
    setDraftInstrucoesFase('');
    setDraftMateriaisFase([]);
    setVinculosCard([]);
    setVincularAberto(false);
    setBuscaVinculo('');
    setTipoNovoVinculo('relacionado');
    setResultadosBuscaVinculo([]);
    setModalSessao({ userId: null, uploaderNome: '—', ehAdminOuTeam: false });
    setModalAprovacaoFase(null);
    setSolicitandoAprovacaoFase(false);
    setEditingId(null);
    setNovaInteracao({
      titulo: '',
      tipo: 'atividade',
      data: '',
      timeMoni: '',
      responsavelMoni: '',
      trava: false,
      status: 'pendente',
    });
    setEditDraft({
      titulo: '',
      descricao: '',
      tipo: 'atividade',
      data: '',
      timeMoni: '',
      responsavelMoni: '',
      trava: false,
    });
  }, [cardId]);

  useEffect(() => {
    if (!vincularAberto || !pode('vincular_cards') || !card || origem === 'legado') {
      setResultadosBuscaVinculo([]);
      return;
    }
    const t = buscaVinculo.trim();
    if (t.length < 2) {
      setResultadosBuscaVinculo([]);
      return;
    }
    let cancel = false;
    const h = setTimeout(() => {
      void (async () => {
        const r = await buscarCardsParaVinculo(t, card.id);
        if (cancel) return;
        if (r.ok) setResultadosBuscaVinculo(r.items);
        else setResultadosBuscaVinculo([]);
      })();
    }, 320);
    return () => {
      cancel = true;
      clearTimeout(h);
    };
  }, [buscaVinculo, vincularAberto, pode, card?.id, origem]);

  useEffect(() => {
    if (!card?.fase_id) return;
    let cancel = false;
    void (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('kanban_fases')
        .select('id, instrucoes, materiais')
        .eq('id', card.fase_id)
        .maybeSingle();
      if (cancel || error || !data) return;
      const materiais = parseKanbanFaseMateriais((data as { materiais?: unknown }).materiais);
      const instrucoes = (data as { instrucoes?: string | null }).instrucoes ?? null;
      setFaseAtual((prev) => (prev && prev.id === card.fase_id ? { ...prev, instrucoes, materiais } : prev));
      setFases((prev) => prev.map((f) => (f.id === card.fase_id ? { ...f, instrucoes, materiais } : f)));
    })();
    return () => {
      cancel = true;
    };
  }, [card?.fase_id, card?.id]);

  useEffect(() => {
    if (filtros.lista === 'abertas' && filtros.situacao === 'concluida') {
      setFiltros((f) => ({ ...f, situacao: 'qualquer' }));
    }
  }, [filtros.lista, filtros.situacao]);

  useEffect(() => {
    if (!filtrosOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFiltrosDraft({ ...filtros });
        setFiltrosOpen(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (filtrosPopoverRef.current?.contains(t)) return;
      if (filtrosBtnRef.current?.contains(t)) return;
      setFiltrosDraft({ ...filtros });
      setFiltrosOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [filtrosOpen, filtros]);

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

      try {
        const {
          data: { user: sessUser },
        } = await supabase.auth.getUser();
        let uid: string | null = null;
        let unome = '—';
        let admTeam = false;
        if (sessUser) {
          uid = sessUser.id;
          const { data: me } = await supabase
            .from('profiles')
            .select('full_name, role')
            .eq('id', sessUser.id)
            .maybeSingle();
          const fn = String((me as { full_name?: string | null } | null)?.full_name ?? '').trim();
          unome = fn || '—';
          const rl = String((me as { role?: string | null } | null)?.role ?? '').toLowerCase();
          admTeam = rl === 'admin' || rl === 'team';
        }
        setModalSessao({ userId: uid, uploaderNome: unome, ehAdminOuTeam: admTeam });
      } catch {
        setModalSessao({ userId: null, uploaderNome: '—', ehAdminOuTeam: false });
      }

      type LoadedShape = {
        id: string;
        titulo: string;
        status: string;
        created_at: string;
        fase_id: string;
        franqueado_id: string;
        kanban_id: string;
        etapa_slug: string | null;
        concluido?: boolean;
        concluido_em?: string | null;
        arquivado?: boolean;
        processo_meta?: Card['processo_meta'];
      };

      let loaded: LoadedShape | null = null;
      let nativeRedeFranqueadoId: string | null = null;

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

        try {
          const [pmRes, evRes] = await Promise.all([
            supabase.from('processo_step_one').select('status, updated_at').eq('id', loaded.id).maybeSingle(),
            supabase
              .from('processo_card_eventos')
              .select('created_at, detalhes')
              .eq('processo_id', loaded.id)
              .eq('tipo', 'card_move')
              .order('created_at', { ascending: true }),
          ]);
          const pm = pmRes.data as { status?: string | null; updated_at?: string | null } | null;
          loaded.processo_meta = pm
            ? {
                status: String(pm.status ?? ''),
                updated_at: String(pm.updated_at ?? ''),
              }
            : null;
          const evRows = (evRes.data ?? []) as { created_at: string; detalhes?: unknown }[];
          setLegadoCronologiaMoves(
            evRows.map((r) => ({
              created_at: String(r.created_at),
              detalhes: (r.detalhes as Record<string, unknown> | null) ?? null,
            })),
          );
        } catch {
          loaded.processo_meta = null;
          setLegadoCronologiaMoves([]);
        }
      } else {
        setLegadoCronologiaMoves([]);
        const { data: cardData, error: cardError } = await supabase
          .from('kanban_cards')
          .select(
            'id, titulo, status, created_at, fase_id, franqueado_id, kanban_id, rede_franqueado_id, concluido, concluido_em, arquivado',
          )
          .eq('id', cardId)
          .single();

        if (cardError || !cardData) {
          alert('Card não encontrado');
          onClose();
          return;
        }

        const rrid = (cardData as { rede_franqueado_id?: string | null }).rede_franqueado_id;
        nativeRedeFranqueadoId = rrid != null && String(rrid).trim() !== '' ? String(rrid) : null;

        const ccem = (cardData as { concluido_em?: string | null }).concluido_em;
        loaded = {
          id: String(cardData.id),
          titulo: String(cardData.titulo ?? ''),
          status: String(cardData.status ?? ''),
          created_at: String(cardData.created_at ?? ''),
          fase_id: String(cardData.fase_id ?? ''),
          franqueado_id: String(cardData.franqueado_id ?? ''),
          kanban_id: String(cardData.kanban_id ?? ''),
          etapa_slug: null,
          concluido: Boolean((cardData as { concluido?: boolean | null }).concluido),
          concluido_em: ccem != null && String(ccem).trim() !== '' ? String(ccem) : null,
          arquivado: Boolean((cardData as { arquivado?: boolean | null }).arquivado),
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
        concluido: loaded.concluido ?? false,
        concluido_em: loaded.concluido_em ?? null,
        arquivado: loaded.arquivado ?? false,
        processo_meta: loaded.processo_meta ?? null,
        profiles,
      });

      try {
        const det = await fetchKanbanCardModalDetalhes(supabase, {
          origem,
          cardId: loaded.id,
          cardTitulo: loaded.titulo,
          redeFranqueadoId: origem === 'nativo' ? nativeRedeFranqueadoId : null,
        });
        setModalDetalhes(det);
        setPreObraDraft(preObraDraftFromProcesso(det.processo));
      } catch {
        setModalDetalhes({ rede: null, processo: null, redeIdContrato: null });
        setPreObraDraft(preObraDraftFromProcesso(null));
      }

      const mapFaseRow = (row: Record<string, unknown>): KanbanFase => ({
        id: String(row.id),
        nome: String(row.nome ?? ''),
        ordem: Number(row.ordem ?? 0),
        sla_dias: row.sla_dias != null && row.sla_dias !== '' ? Number(row.sla_dias) : null,
        slug: row.slug != null ? String(row.slug) : null,
        instrucoes: row.instrucoes != null ? String(row.instrucoes) : null,
        materiais: parseKanbanFaseMateriais(row.materiais),
      });

      if (!fasesProp?.length) {
        const { data: fasesData } = await supabase
          .from('kanban_fases')
          .select('id, nome, ordem, sla_dias, slug, instrucoes, materiais')
          .eq('kanban_id', loaded.kanban_id)
          .eq('ativo', true)
          .order('ordem');
        const mapped = (fasesData ?? []).map((r) => mapFaseRow(r as unknown as Record<string, unknown>));
        setFases(mapped);
        setFaseAtual(mapped.find((f) => f.id === loaded.fase_id) ?? null);
      } else {
        const normalizedFromProp = fasesProp.map((f) =>
          mapFaseRow({
            id: f.id,
            nome: f.nome,
            ordem: f.ordem,
            sla_dias: f.sla_dias,
            slug: f.slug ?? null,
            instrucoes: f.instrucoes ?? null,
            materiais: f.materiais as unknown,
          }),
        );
        setFases(normalizedFromProp);
        setFaseAtual(normalizedFromProp.find((f) => f.id === loaded.fase_id) ?? null);
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
        const { data: tokRow } = await supabase
          .from('kanban_card_form_tokens')
          .select('email_candidato')
          .eq('card_id', cardId)
          .not('email_candidato', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const emailTok = (tokRow as { email_candidato?: string | null } | null)?.email_candidato;
        if (emailTok) setEmailPara(emailTok);
      } catch {
        // sem token — mantém campo vazio
      }

      try {
        const origemAtividade = origem === 'legado' ? 'legado' : 'nativo';
        const { data: interacoesData, error: interacoesError } = await supabase
          .from('kanban_atividades')
          .select(
            'id, titulo, descricao, tipo, times_ids, responsaveis_ids, trava, status, prioridade, data_vencimento, responsavel_id, responsavel_nome_texto, time, created_at, concluida_em, origem, criado_por',
          )
          .eq('card_id', cardId)
          .eq('origem', origemAtividade)
          .order('ordem', { ascending: true });

        if (interacoesError) {
          setInteracoes(interacoesDemonstracao());
          setSubInteracoesPorPai({});
        } else if (!interacoesData?.length) {
          setInteracoes([]);
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
            const cp = (a as { criado_por?: string | null }).criado_por;
            const rnt = (a as { responsavel_nome_texto?: string | null }).responsavel_nome_texto;
            const responsavel_nome_texto =
              rnt != null && String(rnt).trim() !== '' ? String(rnt).trim() : null;
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
              responsavel_nome_texto,
              time: (a.time as string | null) ?? null,
              created_at: String(a.created_at),
              concluida_em: (a.concluida_em as string | null) ?? null,
              criado_por: cp != null && String(cp).trim() !== '' ? String(cp) : null,
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

      if (origem !== 'legado' && loaded) {
        try {
          const vr = await listarVinculosCard(loaded.id);
          setVinculosCard(vr.ok ? vr.items : []);
        } catch {
          setVinculosCard([]);
        }
      } else {
        setVinculosCard([]);
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
    if (!pode('criar_chamados')) {
      alert('Sem permissão para criar chamados.');
      return;
    }
    setLoading(true);
    try {
      const ordemReal = interacoes.filter((a) => !isInteracaoDemonstracao(a.id)).length;
      const vPar = validarParTimeResponsavelMoni(
        novaInteracao.timeMoni || null,
        novaInteracao.responsavelMoni || null,
      );
      if (!vPar.ok) {
        alert(vPar.error);
        return;
      }
      const resolved = resolveKanbanInteracaoFromCatalog(
        novaInteracao.timeMoni,
        novaInteracao.responsavelMoni,
        kanbanTimes,
        responsaveisOpcoes,
      );
      const res = await criarInteracao({
        card_id: card.id,
        titulo: novaInteracao.titulo.trim(),
        tipo: novaInteracao.tipo,
        times_ids: resolved.times_ids,
        data_vencimento: novaInteracao.data || null,
        responsaveis_ids: resolved.responsaveis_ids,
        responsavel_nome_texto: resolved.responsavel_nome_texto,
        time_legado: resolved.time_legado,
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
        timeMoni: '',
        responsavelMoni: '',
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
    const timeMoni = inferTimeMoniFromInteracao(it.times_resolvidos, it.time);
    const responsavelMoni = inferResponsavelMoniFromInteracao(
      timeMoni,
      it.responsaveis_resolvidos,
      it.responsavel_nome_texto,
      it.responsavel_id,
      it.responsaveis_ids,
      responsaveisOpcoes,
    );
    setEditDraft({
      titulo: it.titulo ?? '',
      descricao: it.descricao ?? '',
      tipo: it.tipo,
      data: it.data_vencimento ? String(it.data_vencimento).slice(0, 10) : '',
      timeMoni,
      responsavelMoni,
      trava: it.trava,
    });
  }

  async function salvarEdicaoInteracao() {
    if (!editingId) return;
    if (!editDraft.titulo.trim()) {
      alert('Informe o título do chamado.');
      return;
    }
    setSalvandoEdicao(true);
    try {
      const vPar = validarParTimeResponsavelMoni(
        editDraft.timeMoni || null,
        editDraft.responsavelMoni || null,
      );
      if (!vPar.ok) {
        alert(vPar.error);
        return;
      }
      const resolved = resolveKanbanInteracaoFromCatalog(
        editDraft.timeMoni,
        editDraft.responsavelMoni,
        kanbanTimes,
        responsaveisOpcoes,
      );
      const res = await editarInteracao(editingId, {
        titulo: editDraft.titulo.trim(),
        descricao: editDraft.descricao.trim() || null,
        tipo: editDraft.tipo,
        data_vencimento: editDraft.data.trim() || null,
        times_ids: resolved.times_ids,
        responsaveis_ids: resolved.responsaveis_ids,
        responsavel_nome_texto: resolved.responsavel_nome_texto,
        time_legado: resolved.time_legado,
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

  async function reloadSubsForParent(interacaoId: string) {
    const supabase = createClient();
    const { data: topicosRows } = await supabase
      .from('sirene_topicos')
      .select('id, interacao_id, descricao, times_ids, responsaveis_ids, data_fim, status, trava')
      .eq('interacao_id', interacaoId)
      .order('ordem', { ascending: true });
    const topicos = topicosRows ?? [];
    const timeTopMap = new Map(kanbanTimes.map((t) => [t.id, t.nome]));
    const tRespIds = [
      ...new Set(
        topicos.flatMap((t) => {
          const arr = (t as { responsaveis_ids?: unknown }).responsaveis_ids;
          return Array.isArray(arr) ? arr.map((x) => String(x)) : [];
        }),
      ),
    ] as string[];
    let profTop = new Map<string, { full_name: string | null }>();
    if (tRespIds.length > 0) {
      const { data: pr } = await supabase.from('profiles').select('id, full_name').in('id', tRespIds);
      profTop = new Map(
        (pr ?? []).map((r) => [
          String((r as { id: string }).id),
          { full_name: (r as { full_name?: string | null }).full_name ?? null },
        ]),
      );
    }
    const mapped: SubInteracaoModal[] = topicos.map((t) => {
      const iid = String((t as { interacao_id: string }).interacao_id);
      const rawTi = (t as { times_ids?: unknown }).times_ids;
      const ti = Array.isArray(rawTi) ? rawTi.map((x) => String(x)) : [];
      const rawRi = (t as { responsaveis_ids?: unknown }).responsaveis_ids;
      const ri = Array.isArray(rawRi) ? rawRi.map((x) => String(x)) : [];
      const st = String((t as { status?: string }).status ?? 'nao_iniciado') as SubInteracaoStatusDb;
      return {
        id: String((t as { id: number | string }).id),
        interacao_id: iid,
        descricao: String((t as { descricao?: string }).descricao ?? ''),
        times_ids: ti,
        responsaveis_ids: ri,
        times_resolvidos: ti.map((id) => ({ id, nome: timeTopMap.get(id) ?? id.slice(0, 8) })),
        responsaveis_resolvidos: ri.map((id) => ({
          id,
          nome: profTop.get(id)?.full_name?.trim() || id.slice(0, 8),
        })),
        data_fim:
          (t as { data_fim?: string | null }).data_fim != null
            ? String((t as { data_fim: string }).data_fim).slice(0, 10)
            : null,
        status: ['nao_iniciado', 'em_andamento', 'concluido', 'aprovado'].includes(st) ? st : 'nao_iniciado',
        trava: Boolean((t as { trava?: boolean }).trava),
      };
    });
    setSubInteracoesPorPai((prev) => ({ ...prev, [interacaoId]: mapped }));
  }

  async function handleCriarSubInteracao(interacaoId: string) {
    if (!subNovaDraft.titulo.trim()) return;
    if (!pode('criar_chamados')) {
      alert('Sem permissão para criar chamados.');
      return;
    }
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
      setSubNovaDraft({ titulo: '', timesIds: [], responsaveisIds: [], data: '', trava: false });
      setSubFormInteracaoId(interacaoId);
      setSubExpandida((s) => ({ ...s, [interacaoId]: true }));
      await reloadSubsForParent(interacaoId);
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

  async function handleConfirmarFinalizarCard() {
    if (!card || origem === 'legado') return;
    if (!pode('finalizar_cards')) {
      alert('Sem permissão para finalizar cards.');
      return;
    }
    setLoading(true);
    try {
      const r = await finalizarCard({ cardId: card.id, basePath });
      if (!r.ok) {
        alert(r.error ?? 'Não foi possível finalizar.');
        return;
      }
      setConfirmandoFinalizar(false);
      await loadCard();
      router.refresh();
    } catch {
      alert('Erro ao finalizar o card.');
    } finally {
      setLoading(false);
    }
  }

  async function registrarMovimentoLegadoKanban(fromSlug: string, toSlug: string) {
    if (origem !== 'legado' || !card) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const nome = String((prof as { full_name?: string | null } | null)?.full_name ?? '').trim();
    await supabase.from('processo_card_eventos').insert({
      processo_id: card.id,
      autor_id: user.id,
      autor_nome: nome.length > 0 ? nome : null,
      etapa_painel: toSlug,
      tipo: 'card_move',
      descricao: 'Movimentação no funil (legado)',
      detalhes: { from: fromSlug, to: toSlug },
    });
  }

  async function executarAvancarFase(proximaFase: KanbanFase) {
    if (!card || !faseAtual) return;
    setLoading(true);
    try {
      const supabase = createClient();
      if (origem === 'legado') {
        const slug = proximaFase.slug?.trim();
        if (!slug) {
          alert('Esta fase não tem slug cadastrado; não é possível avançar o processo por aqui.');
          return;
        }
        const fromSlug = faseAtual.slug?.trim();
        const { error } = await supabase.from('processo_step_one').update({ etapa_painel: slug }).eq('id', card.id);
        if (error) throw error;
        if (fromSlug) await registrarMovimentoLegadoKanban(fromSlug, slug);
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

  async function handleAvancarFase() {
    if (!card || !faseAtual) return;
    if (!pode('mover_fase')) {
      alert('Sem permissão para mover de fase.');
      return;
    }
    const proximaFase = fases.find((f) => f.ordem === faseAtual.ordem + 1);
    if (!proximaFase) {
      alert('Esta é a última fase do funil.');
      return;
    }
    if (!confirm(`Avançar para a fase "${proximaFase.nome}"?`)) return;

    const checklist = await verificarChecklistParaFase(card.id);
    if (checklist.bloqueado) {
      setModalAprovacaoFase({ fase: proximaFase, direcao: 'avancar', itensPendentes: checklist.itens_pendentes });
      return;
    }
    await executarAvancarFase(proximaFase);
  }

  async function handleRetrocederFase() {
    if (!card || !faseAtual) return;
    if (!pode('mover_fase')) {
      alert('Sem permissão para mover de fase.');
      return;
    }
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
        const fromSlug = faseAtual.slug?.trim();
        const { error } = await supabase.from('processo_step_one').update({ etapa_painel: slug }).eq('id', card.id);
        if (error) throw error;
        if (fromSlug) await registrarMovimentoLegadoKanban(fromSlug, slug);
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

  async function handleSolicitarAprovacaoFase() {
    if (!card || !modalAprovacaoFase) return;
    setSolicitandoAprovacaoFase(true);
    try {
      const res = await solicitarAprovacaoFase({
        card_id: card.id,
        fase_destino: modalAprovacaoFase.fase.nome ?? modalAprovacaoFase.fase.id,
        card_titulo: card.titulo,
        itens_pendentes: modalAprovacaoFase.itensPendentes,
        basePath,
      });
      if (!res.ok) {
        alert(`Erro ao solicitar aprovação: ${res.error}`);
        return;
      }
      setModalAprovacaoFase(null);
      alert('Solicitação enviada. Aguarde aprovação do Bombeiro.');
    } catch {
      alert('Erro ao enviar solicitação.');
    } finally {
      setSolicitandoAprovacaoFase(false);
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

  async function handleConfirmarArquivar() {
    if (!card || origem === 'legado') return;
    if (!pode('arquivar_cards')) {
      alert('Sem permissão para arquivar cards.');
      return;
    }
    const motivo = motivoArquivamento.trim();
    if (!motivo) {
      alert('Informe o motivo do arquivamento.');
      return;
    }
    setLoading(true);
    try {
      const r = await arquivarCard({ cardId: card.id, motivo, basePath });
      if (!r.ok) {
        alert(r.error);
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  function toggleSecaoEsquerda(id: SecaoEsquerdaId) {
    setSecaoAberta((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleSalvarPreObraKanban() {
    const pid = modalDetalhes.processo?.id;
    if (!pid) {
      alert('Sem processo vinculado para salvar pré-obra.');
      return;
    }
    setSalvandoPreObra(true);
    try {
      const res = await salvarDadosPreObra({
        processoId: pid,
        previsao_aprovacao_condominio: preObraDraft.previsao_aprovacao_condominio,
        previsao_aprovacao_prefeitura: preObraDraft.previsao_aprovacao_prefeitura,
        previsao_emissao_alvara: preObraDraft.previsao_emissao_alvara,
        previsao_liberacao_credito_obra: preObraDraft.previsao_liberacao_credito_obra,
        previsao_inicio_obra: preObraDraft.previsao_inicio_obra,
        data_aprovacao_condominio: preObraDraft.data_aprovacao_condominio,
        data_aprovacao_prefeitura: preObraDraft.data_aprovacao_prefeitura,
        data_emissao_alvara: preObraDraft.data_emissao_alvara,
        data_aprovacao_credito: preObraDraft.data_aprovacao_credito,
        basePath,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      await loadCard();
      router.refresh();
    } catch {
      alert('Erro ao salvar pré-obra.');
    } finally {
      setSalvandoPreObra(false);
    }
  }

  async function handleContratoFranquiaFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    const rid = modalDetalhes.redeIdContrato;
    if (!f || !rid) return;
    setUploadingContrato(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('franqueadoId', rid);
      fd.append('basePath', basePath);
      const r = await uploadContratoFranquia(fd);
      if (!r.ok) {
        alert(r.error);
        return;
      }
      await loadCard();
      router.refresh();
    } catch {
      alert('Erro ao enviar contrato.');
    } finally {
      setUploadingContrato(false);
    }
  }

  async function handleBaixarContratoFranquia() {
    const path = modalDetalhes.rede?.contrato_franquia_path;
    if (!path?.trim()) return;
    const supabase = createClient();
    const { data, error } = await supabase.storage.from('contratos-franquia').createSignedUrl(path.trim(), 3600);
    if (error || !data?.signedUrl) {
      alert(error?.message ?? 'Não foi possível gerar o link.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  const timesFiltroOpcoesModal = useMemo(
    () => timesFiltroOpcoesComCatalogoMoni(kanbanTimes),
    [kanbanTimes],
  );
  const responsaveisFiltroOpcoesModal = useMemo(
    () => responsaveisFiltroOpcoesComCatalogoMoni(responsaveisOpcoes),
    [responsaveisOpcoes],
  );

  const interacoesFiltradas = useMemo(() => {
    const situacaoEfetiva =
      filtros.lista === 'concluidas' ? ('qualquer' as const) : filtros.situacao;
    const prazoOrdKey = (a: InteracaoModal) =>
      prazoEfetivoParaChamado(a, subInteracoesPorPai[a.id] ?? []) ?? '9999-12-31';
    const criadoTs = (a: InteracaoModal) => {
      const t = new Date(a.created_at).getTime();
      return Number.isFinite(t) ? t : 0;
    };
    const buscaNorm = filtros.busca.trim().toLowerCase();
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
      if (!interacaoPassaFiltroResponsavel(it, filtros.responsavel)) return false;
      if (buscaNorm) {
        const blob = `${it.titulo} ${it.descricao ?? ''}`.toLowerCase();
        if (!blob.includes(buscaNorm)) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (filtros.lista === 'todas') {
        const ac = a.status === 'concluida';
        const bc = b.status === 'concluida';
        if (ac !== bc) return ac ? 1 : -1;
      }
      if (filtros.ordenacao === 'prazo_asc') return prazoOrdKey(a).localeCompare(prazoOrdKey(b));
      if (filtros.ordenacao === 'prazo_desc') return prazoOrdKey(b).localeCompare(prazoOrdKey(a));
      if (filtros.ordenacao === 'criado_asc') return criadoTs(a) - criadoTs(b);
      if (filtros.ordenacao === 'criado_desc') return criadoTs(b) - criadoTs(a);
      return 0;
    });
  }, [interacoes, filtros, kanbanTimes, subInteracoesPorPai]);

  const faseNomePorId = useMemo(() => new Map(fases.map((f) => [f.id, f.nome])), [fases]);

  const linhasCronologiaFases = useMemo(() => {
    if (!card || fases.length === 0) return [];
    if (origem === 'legado') {
      return buildLegadoFaseTimeline(
        fases,
        {
          created_at: card.created_at,
          fase_id: card.fase_id,
          etapa_slug: card.etapa_slug ?? null,
        },
        legadoCronologiaMoves,
      );
    }
    return buildNativeFaseTimeline(
      fases,
      { created_at: card.created_at, fase_id: card.fase_id },
      historico.map((h) => ({ acao: h.acao, detalhe: h.detalhe, criado_em: h.criado_em })),
    );
  }, [card, fases, historico, legadoCronologiaMoves, origem]);

  const abrirEdicaoInstrucoesFase = () => {
    if (!faseAtual || !pode('editar_instrucoes')) return;
    setDraftInstrucoesFase((faseAtual.instrucoes ?? '').trim() ? String(faseAtual.instrucoes) : '');
    setDraftMateriaisFase(
      faseAtual.materiais && faseAtual.materiais.length > 0 ? faseAtual.materiais.map((m) => ({ ...m })) : [],
    );
    setEditandoInstrucoesFase(true);
  };

  async function handleSalvarInstrucoesFase() {
    if (!faseAtual || !pode('editar_instrucoes')) return;
    setSalvandoInstrucoesFase(true);
    try {
      const res = await salvarInstrucoesFase(
        faseAtual.id,
        draftInstrucoesFase.trim() || null,
        draftMateriaisFase,
        basePath,
      );
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setEditandoInstrucoesFase(false);
      const materiais = parseKanbanFaseMateriais(draftMateriaisFase);
      const inst = draftInstrucoesFase.trim() || null;
      setFaseAtual((prev) => (prev ? { ...prev, instrucoes: inst, materiais } : prev));
      setFases((prev) => prev.map((f) => (f.id === faseAtual.id ? { ...f, instrucoes: inst, materiais } : f)));
      router.refresh();
    } catch {
      alert('Erro ao salvar instruções.');
    } finally {
      setSalvandoInstrucoesFase(false);
    }
  }

  function labelTipoVinculo(t: TipoVinculoKanbanCard): string {
    if (t === 'depende_de') return 'Depende de';
    if (t === 'bloqueia') return 'Bloqueia';
    return 'Relacionado';
  }

  async function handleRemoverVinculo(vinculoId: string) {
    const res = await removerVinculoCard(vinculoId, basePath);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    if (card && origem !== 'legado') {
      const vr = await listarVinculosCard(card.id);
      setVinculosCard(vr.ok ? vr.items : []);
    }
    router.refresh();
  }

  async function handleVincularCardDestino(destinoId: string) {
    if (!card || origem === 'legado') return;
    setLoading(true);
    try {
      const res = await criarVinculoCard({
        cardOrigemId: card.id,
        cardDestinoId: destinoId,
        tipo: tipoNovoVinculo,
        basePath,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setVincularAberto(false);
      setBuscaVinculo('');
      setResultadosBuscaVinculo([]);
      const vr = await listarVinculosCard(card.id);
      setVinculosCard(vr.ok ? vr.items : []);
      router.refresh();
    } catch {
      alert('Erro ao criar vínculo.');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !card) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="text-white">Carregando…</div>
      </div>
    );
  }

  if (!card) return null;

  const isLegado = origem === 'legado';

  const fmtDataHoraOuDash = (iso: string | null | undefined) => {
    const s = String(iso ?? '').trim();
    if (!s) return '—';
    return formatDataHoraHistorico(s);
  };

  const dataConclusaoExibicao =
    isLegado && card.processo_meta?.status === 'concluido' && card.processo_meta.updated_at?.trim()
      ? fmtDataHoraOuDash(card.processo_meta.updated_at)
      : !isLegado && card.concluido && card.concluido_em?.trim()
        ? fmtDataHoraOuDash(card.concluido_em)
        : '—';

  const createdDate = new Date(card.created_at);
  const slaCard = calcularStatusSLA(createdDate, faseAtual?.sla_dias ?? 999);
  const cardNativoConcluido = !isLegado && Boolean(card.concluido);
  const cardNativoArquivado = !isLegado && Boolean(card.arquivado);
  const podeRetrocederFase =
    !cardNativoConcluido && Boolean(faseAtual && fases.some((f) => f.ordem === faseAtual.ordem - 1));
  const podeAvancarFase =
    !cardNativoConcluido && Boolean(faseAtual && fases.some((f) => f.ordem === faseAtual.ordem + 1));
  const maxOrdemFases = fases.length > 0 ? Math.max(...fases.map((f) => f.ordem)) : 0;
  const estaNaUltimaFaseNativo = Boolean(faseAtual && faseAtual.ordem === maxOrdemFases);
  const exibirBotaoFinalizar =
    !isLegado && estaNaUltimaFaseNativo && !cardNativoConcluido && !cardNativoArquivado;
  const cardTitulo = card.titulo;
  const checklistExtra = card.fase_id && camposPorFase?.[card.fase_id];
  const faseChecklistFaseId = card.fase_id ?? '';

  const rede = modalDetalhes.rede;
  const proc = modalDetalhes.processo;
  const enderecoCasaLinha = rede
    ? [
        rede.endereco_casa_frank,
        rede.endereco_casa_frank_numero,
        rede.endereco_casa_frank_complemento,
        rede.cep_casa_frank,
        rede.cidade_casa_frank,
        rede.estado_casa_frank,
      ]
        .map((x) => (x ?? '').trim())
        .filter(Boolean)
        .join(', ')
    : '';
  const fmtDataBr = (iso: string | null | undefined) => {
    const s = String(iso ?? '').trim();
    if (!s) return '—';
    return formatIsoDateOnlyPtBr(s) ?? s;
  };
  const driveHref = (() => {
    const raw = proc?.link_pasta_drive?.trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
  })();

  const secaoHead = (id: SecaoEsquerdaId, label: string, body: ReactNode) => (
    <div
      className="mb-2 overflow-hidden rounded-lg bg-white text-xs"
      style={{
        border: '0.5px solid var(--moni-border-default)',
        boxShadow: 'var(--moni-shadow-sm)',
      }}
    >
      <button
        type="button"
        onClick={() => toggleSecaoEsquerda(id)}
        className="flex w-full items-center gap-2 p-2 text-left text-xs transition hover:bg-stone-50"
      >
        {secaoAberta[id] ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
        )}
        <span className="text-xs font-semibold text-stone-800">{label}</span>
      </button>
      {secaoAberta[id] ? (
        <div className="border-t px-2 pb-2 pt-1.5 text-xs text-stone-600" style={{ borderColor: 'var(--moni-border-subtle)' }}>
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
            {!isLegado && cardNativoConcluido ? (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  background: 'var(--moni-green-50)',
                  color: 'var(--moni-green-800)',
                  border: '0.5px solid var(--moni-green-400)',
                }}
              >
                CONCLUÍDO
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
            <div className="mb-6 flex flex-wrap items-center gap-1.5">
              {faseAtual ? (
                <span
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 text-xs font-semibold leading-none"
                  style={{
                    background: 'var(--moni-gold-50)',
                    color: 'var(--moni-gold-800)',
                    border: '0.5px solid var(--moni-gold-400)',
                    borderRadius: 'var(--moni-radius-pill)',
                  }}
                >
                  <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />
                  {faseAtual.nome}
                </span>
              ) : null}
              {slaCard.label && slaCard.status !== 'ok' ? (
                <span className={`text-xs leading-none ${slaCard.classe}`}>{slaCard.label}</span>
              ) : null}
            </div>

            <div className="mb-6">
              <h4
                className="mb-3 flex items-center gap-2 text-sm font-semibold"
                style={{ color: 'var(--moni-text-secondary)' }}
              >
                <BookOpen className="h-4 w-4 shrink-0 text-stone-500" aria-hidden />
                Instruções da fase
              </h4>
              <div
                className="rounded-lg p-4"
                style={{
                  background: 'var(--moni-surface-50)',
                  border: '0.5px solid var(--moni-border-default)',
                }}
              >
                {!faseAtual ? (
                  <p className="text-sm italic text-stone-400">Carregando fase…</p>
                ) : editandoInstrucoesFase && pode('editar_instrucoes') ? (
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-stone-600">
                      Texto (quebras de linha preservadas)
                      <textarea
                        value={draftInstrucoesFase}
                        onChange={(e) => setDraftInstrucoesFase(e.target.value)}
                        rows={8}
                        className="mt-1 w-full rounded-md border border-stone-300 px-2 py-2 text-sm text-stone-800 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
                        placeholder="Orientações para quem trabalha nesta fase…"
                      />
                    </label>
                    <div>
                      <p className="text-xs font-medium text-stone-600">Materiais (título, URL, tipo)</p>
                      <ul className="mt-2 space-y-2">
                        {draftMateriaisFase.map((m, idx) => (
                          <li
                            key={idx}
                            className="flex flex-wrap items-end gap-2 rounded-md border border-stone-200 bg-white p-2"
                          >
                            <input
                              type="text"
                              value={m.titulo}
                              onChange={(e) => {
                                const v = e.target.value;
                                setDraftMateriaisFase((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, titulo: v } : r)),
                                );
                              }}
                              placeholder="Título"
                              className="min-w-[6rem] flex-1 rounded border border-stone-300 px-2 py-1 text-xs"
                            />
                            <input
                              type="url"
                              value={m.url}
                              onChange={(e) => {
                                const v = e.target.value;
                                setDraftMateriaisFase((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, url: v } : r)),
                                );
                              }}
                              placeholder="https://…"
                              className="min-w-[8rem] flex-[2] rounded border border-stone-300 px-2 py-1 text-xs"
                            />
                            <select
                              value={m.tipo}
                              onChange={(e) => {
                                const v = e.target.value as KanbanFaseMaterial['tipo'];
                                setDraftMateriaisFase((rows) =>
                                  rows.map((r, i) => (i === idx ? { ...r, tipo: v } : r)),
                                );
                              }}
                              className="rounded border border-stone-300 px-2 py-1 text-xs"
                            >
                              <option value="link">link</option>
                              <option value="documento">documento</option>
                              <option value="video">video</option>
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                setDraftMateriaisFase((rows) => rows.filter((_, i) => i !== idx))
                              }
                              className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-red-600"
                              aria-label="Remover material"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftMateriaisFase((rows) => [
                            ...rows,
                            { titulo: '', url: '', tipo: 'link' as const },
                          ])
                        }
                        className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-stone-300 px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-50"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        Adicionar material
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSalvarInstrucoesFase()}
                        disabled={salvandoInstrucoesFase}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                        style={{ background: 'var(--moni-navy-800)' }}
                      >
                        {salvandoInstrucoesFase ? 'Salvando…' : 'Salvar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditandoInstrucoesFase(false);
                          setDraftInstrucoesFase('');
                          setDraftMateriaisFase([]);
                        }}
                        disabled={salvandoInstrucoesFase}
                        className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {(() => {
                      const txt = (faseAtual.instrucoes ?? '').trim();
                      const mats = faseAtual.materiais ?? [];
                      const tem = txt.length > 0 || mats.length > 0;
                      if (!tem) {
                        return (
                          <p className="text-sm italic text-stone-400">
                            Nenhuma instrução definida para esta fase
                          </p>
                        );
                      }
                      return (
                        <div className="space-y-3">
                          {txt ? (
                            <div
                              className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800"
                              style={{ color: 'var(--moni-text-primary)' }}
                            >
                              {txt}
                            </div>
                          ) : null}
                          {mats.length > 0 ? (
                            <ul className="space-y-1.5">
                              {mats.map((m, i) => (
                                <li key={`${m.url}-${i}`}>
                                  <a
                                    href={m.url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex max-w-full items-center gap-2 text-sm font-medium text-moni-primary hover:underline"
                                  >
                                    <IconeMaterialTipo tipo={m.tipo} />
                                    <span className="truncate">{m.titulo || m.url || 'Link'}</span>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      );
                    })()}
                    {pode('editar_instrucoes') ? (
                      <button
                        type="button"
                        onClick={abrirEdicaoInstrucoesFase}
                        className="mt-3 text-xs font-medium text-moni-primary hover:underline"
                      >
                        Editar instruções
                      </button>
                    ) : null}
                  </>
                )}
              </div>
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
                  <FaseChecklistCard
                    faseId={faseChecklistFaseId}
                    cardId={card.id}
                    isFrank={portalFrank}
                    isAdmin={isAdmin}
                  />
                )}
              </div>
              {!portalFrank && card.fase_id && (
                <div className="mt-3">
                  {linkCandidato ? (
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={linkCandidato}
                        className="flex-1 rounded-md border px-3 py-1.5 text-xs"
                        style={{
                          borderColor: 'var(--moni-border-default)',
                          background: 'var(--moni-surface-50)',
                          color: 'var(--moni-text-primary)',
                        }}
                        onFocus={(e) => e.target.select()}
                      />
                      <button
                        type="button"
                        title="Copiar link"
                        onClick={() => {
                          void navigator.clipboard.writeText(linkCandidato).then(() => {
                            setLinkCopiado(true);
                            setTimeout(() => setLinkCopiado(false), 2000);
                          });
                        }}
                        className="flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs"
                        style={{
                          borderColor: 'var(--moni-border-default)',
                          background: 'var(--moni-surface-100)',
                          color: linkCopiado ? 'var(--moni-status-success-text)' : 'var(--moni-text-secondary)',
                        }}
                      >
                        {linkCopiado ? <Check size={12} /> : <Copy size={12} />}
                        {linkCopiado ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={gerandoLink}
                      onClick={async () => {
                        setGerandoLink(true);
                        try {
                          const res = await gerarFormTokenCandidato(card.id, card.fase_id!);
                          if (res.ok) setLinkCandidato(res.url);
                        } finally {
                          setGerandoLink(false);
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs"
                      style={{
                        borderColor: 'var(--moni-border-default)',
                        background: 'var(--moni-surface-100)',
                        color: 'var(--moni-text-secondary)',
                      }}
                    >
                      {gerandoLink ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Link2 size={12} />
                      )}
                      {gerandoLink ? 'Gerando...' : 'Gerar link'}
                    </button>
                  )}
                </div>
              )}
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

              <div className="relative mb-4">
                <button
                  ref={filtrosBtnRef}
                  type="button"
                  onClick={() => {
                    if (filtrosOpen) {
                      setFiltrosDraft({ ...filtros });
                      setFiltrosOpen(false);
                    } else {
                      setFiltrosDraft({ ...filtros });
                      setFiltrosOpen(true);
                    }
                  }}
                  className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:opacity-95"
                  style={{
                    borderColor: 'var(--moni-border-default)',
                    background: 'var(--moni-surface-0)',
                    color: 'var(--moni-text-primary)',
                  }}
                >
                  Filtros ({countKanbanModalInteracoesFiltrosAtivos(filtros)})
                </button>
                {filtrosOpen ? (
                  <div
                    ref={filtrosPopoverRef}
                    className="absolute left-0 top-full z-[60] mt-2 w-[min(100vw-2rem,15rem)]"
                  >
                    <KanbanInteracoesFiltrosPanel
                      draft={filtrosDraft}
                      setDraft={setFiltrosDraft}
                      kanbanTimes={timesFiltroOpcoesModal}
                      responsaveisOpcoes={responsaveisFiltroOpcoesModal}
                      onLimpar={() => setFiltrosDraft(KANBAN_MODAL_INTERACOES_FILTROS_DEFAULT)}
                      onAplicar={() => {
                        setFiltros({ ...filtrosDraft });
                        setFiltrosOpen(false);
                      }}
                    />
                  </div>
                ) : null}
              </div>

              {interacoesFiltradas.length > 0 ? (
                <div className="mb-4 space-y-2">
                  {interacoesFiltradas.map((it) => {
                    const subs = subInteracoesPorPai[it.id] ?? [];
                    const deriv = derivarChamadoKanbanComSubs(it.status, subs);
                    const statusVisual = deriv.usarDerivado ? deriv.status : it.status;
                    const prazoEfetivo = prazoEfetivoParaChamado(it, subs);
                    const surfaceKind = resolveKanbanChamadoSurfaceKind(statusVisual, prazoEfetivo);
                    const iconKind = resolveKanbanChamadoIconKind({
                      status: statusVisual,
                      alertaSubAtrasada: deriv.alertaSubAtrasada,
                    });
                    const pillKind = kanbanStatusParaPillKind(statusVisual);
                    const slaLegacy = slaInteracaoBadge(prazoEfetivo, statusVisual);
                    const slaDu = rotuloSlaInteracaoPainel(
                      prazoEfetivo,
                      mapInteracaoStatusParaPainelSla(statusVisual),
                    );
                    const timeTags = tagsTimesParaLinha(it, kanbanTimes);
                    const demo = isInteracaoDemonstracao(it.id);
                    return (
                      <AtividadeVinculadaCard
                        key={it.id}
                        kind={surfaceKind}
                        as="div"
                        style={corFundoChamado(prazoEfetivo, statusVisual)}
                      >
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
                            <AtividadeVinculadaIcon kind={iconKind} size="md" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 flex-nowrap items-center gap-2">
                              {editingId === it.id ? (
                                <>
                                  <input
                                    type="text"
                                    value={editDraft.titulo}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, titulo: e.target.value }))}
                                    className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 text-sm font-medium text-stone-800 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
                                    aria-label="Título do chamado"
                                    autoFocus
                                  />
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={salvandoEdicao}
                                      onClick={() => void salvarEdicaoInteracao()}
                                      className="rounded px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                                      style={{ background: 'var(--moni-text-primary)' }}
                                    >
                                      {salvandoEdicao ? '…' : 'Salvar'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={salvandoEdicao}
                                      onClick={() => setEditingId(null)}
                                      className="rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 disabled:opacity-50"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  {!demo ? (
                                    <AnexosChamado
                                      chamadoId={it.id}
                                      portalFrank={portalFrank}
                                      uploader_nome={modalSessao.uploaderNome}
                                      basePath={basePath}
                                      chamadoCriadoPor={it.criado_por}
                                      sessionUserId={modalSessao.userId}
                                      sessionEhAdminOuTeam={modalSessao.ehAdminOuTeam}
                                      demo={demo}
                                    />
                                  ) : null}
                                  <h5 className="min-w-0 flex-1 truncate text-sm font-medium text-stone-800">
                                    {it.titulo}
                                  </h5>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <SlaTituloBolinha
                                      prazoIso={prazoEfetivo}
                                      statusPainel={mapInteracaoStatusParaPainelSla(statusVisual)}
                                      className="mt-0.5"
                                    />
                                    {!demo ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          abrirEdicaoInteracao(it);
                                        }}
                                        className="shrink-0 rounded p-1 text-stone-700 hover:bg-stone-200 hover:text-stone-900"
                                        aria-label="Editar título do chamado"
                                        title="Editar título"
                                      >
                                        <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                                      </button>
                                    ) : null}
                                  </div>
                                </>
                              )}
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
                                  <label className="mb-1 block text-[10px] font-medium text-stone-500">Time</label>
                                  <select
                                    value={editDraft.timeMoni}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setEditDraft((d) => ({
                                        ...d,
                                        timeMoni: v,
                                        responsavelMoni: responsaveisDoTimeMoni(v).includes(d.responsavelMoni)
                                          ? d.responsavelMoni
                                          : '',
                                      }));
                                    }}
                                    className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
                                  >
                                    <option value="">Selecione</option>
                                    {TIMES_MONI.map((t) => (
                                      <option key={t} value={t}>
                                        {t}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="mb-1 block text-[10px] font-medium text-stone-500">
                                    Responsável (opcional)
                                  </label>
                                  <select
                                    value={editDraft.responsavelMoni}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, responsavelMoni: e.target.value }))}
                                    disabled={!editDraft.timeMoni}
                                    className="w-full rounded border border-stone-300 px-2 py-1 text-xs disabled:cursor-not-allowed disabled:bg-stone-100"
                                  >
                                    <option value="">
                                      {editDraft.timeMoni ? 'Selecione' : 'Selecione um time primeiro'}
                                    </option>
                                    {responsaveisDoTimeMoni(editDraft.timeMoni).map((nome) => (
                                      <option key={nome} value={nome}>
                                        {nome}
                                      </option>
                                    ))}
                                  </select>
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
                              <AtividadeVinculadaStatusPill kind={pillKind}>
                                {labelKanbanAtividadeParaPill(statusVisual)}
                              </AtividadeVinculadaStatusPill>
                              {deriv.alertaSubAtrasada ? (
                                <span
                                  className="rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-900"
                                  title="Pelo menos uma sub-interação está com prazo vencido e não concluída"
                                >
                                  Sub-itens atrasados
                                </span>
                              ) : null}
                              {prazoEfetivo ? (
                                <span className="text-stone-600">
                                  Prazo{subs.length > 0 ? ' (efetivo)' : ''}: {formatIsoDateOnlyPtBr(prazoEfetivo)}
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
                                  {it.responsaveis_resolvidos && it.responsaveis_resolvidos.length > 0
                                    ? it.responsaveis_resolvidos.map((r) => r.nome).join(', ')
                                    : it.responsavel_id
                                      ? it.profiles?.full_name?.trim() || '—'
                                      : it.responsavel_nome_texto ?? 'Sem responsável'}
                                </span>
                              </span>
                            </div>
                            {!demo && subExpandida[it.id] ? (
                              <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50/80 p-3">
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                                    Sub-chamados ({subs.length})
                                  </p>
                                </div>
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
                                                Prazo: {formatIsoDateOnlyPtBr(sub.data_fim) ?? sub.data_fim}
                                              </p>
                                            ) : (
                                              <p className="text-[10px] text-stone-400">Sem prazo</p>
                                            )}
                                            <AnexosSubchamado
                                              subchamadoId={sub.id}
                                              uploader_nome={modalSessao.uploaderNome}
                                              basePath={basePath}
                                              sessionUserId={modalSessao.userId}
                                              sessionEhAdminOuTeam={modalSessao.ehAdminOuTeam}
                                            />
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
                                        Fechar
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {!demo && pode('criar_chamados') ? (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSubExpandida((s) => ({ ...s, [it.id]: true }));
                                    setSubFormInteracaoId(it.id);
                                    setSubNovaDraft({
                                      titulo: '',
                                      timesIds: [],
                                      responsaveisIds: [],
                                      data: '',
                                      trava: false,
                                    });
                                  }}
                                  className="text-left text-[11px] font-medium text-stone-700 underline-offset-2 hover:underline"
                                >
                                  + Sub-interação
                                </button>
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

              {pode('criar_chamados') ? (
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
                    {!portalFrank && (
                    <input
                      type="date"
                      value={novaInteracao.data}
                      onChange={(e) => setNovaInteracao({ ...novaInteracao, data: e.target.value })}
                      className="px-3 py-2 text-xs"
                      style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
                    />
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-stone-500">Time</label>
                    <select
                      value={novaInteracao.timeMoni}
                      onChange={(e) => {
                        const v = e.target.value;
                        setNovaInteracao((n) => ({
                          ...n,
                          timeMoni: v,
                          responsavelMoni: responsaveisDoTimeMoni(v).includes(n.responsavelMoni)
                            ? n.responsavelMoni
                            : '',
                        }));
                      }}
                      className="w-full px-3 py-2 text-xs"
                      style={{ border: '0.5px solid var(--moni-border-default)', borderRadius: 'var(--moni-radius-md)' }}
                    >
                      <option value="">Selecione</option>
                      {TIMES_MONI.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!portalFrank && (
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-stone-500">
                        Responsável (opcional)
                      </label>
                      <select
                        value={novaInteracao.responsavelMoni}
                        onChange={(e) =>
                          setNovaInteracao({ ...novaInteracao, responsavelMoni: e.target.value })
                        }
                        disabled={!novaInteracao.timeMoni}
                        className="w-full px-3 py-2 text-xs disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500"
                        style={{
                          border: '0.5px solid var(--moni-border-default)',
                          borderRadius: 'var(--moni-radius-md)',
                        }}
                      >
                        <option value="">
                          {novaInteracao.timeMoni ? 'Selecione' : 'Selecione um time primeiro'}
                        </option>
                        {responsaveisDoTimeMoni(novaInteracao.timeMoni).map((nome) => (
                          <option key={nome} value={nome}>
                            {nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
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
              ) : (
                <p className="mb-4 text-xs text-stone-500">Criar chamados não está disponível para o seu perfil.</p>
              )}
            </div>

            <div className="mt-auto border-t pt-4" style={{ borderColor: 'var(--moni-border-default)' }}>
              {/* Abas comentários / e-mail */}
              <div className="mb-3 flex gap-1">
                {(['comentarios', 'email'] as const).map((aba) => {
                  if (aba === 'email' && portalFrank) return null;
                  const ativo = abaComentarios === aba;
                  return (
                    <button
                      key={aba}
                      type="button"
                      onClick={() => setAbaComentarios(aba)}
                      className="rounded-md px-3 py-1 text-xs font-medium transition"
                      style={{
                        background: ativo ? 'var(--moni-primary-600)' : 'transparent',
                        color: ativo ? '#fff' : 'var(--moni-text-secondary)',
                        border: ativo ? 'none' : '0.5px solid var(--moni-border-default)',
                      }}
                    >
                      {aba === 'comentarios' ? 'Comentários' : 'E-mail'}
                    </button>
                  );
                })}
              </div>

              <div
                className="rounded-lg p-4"
                style={{
                  background: 'var(--moni-surface-50)',
                  border: '0.5px solid var(--moni-border-default)',
                }}
              >
                {abaComentarios === 'comentarios' ? (
                  <>
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
                  </>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                        Para
                      </label>
                      <input
                        type="email"
                        value={emailPara}
                        onChange={(e) => setEmailPara(e.target.value)}
                        placeholder="destinatario@email.com"
                        className="w-full rounded-lg p-2 text-sm focus:outline-none"
                        style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                        Assunto
                      </label>
                      <input
                        type="text"
                        value={emailAssunto}
                        onChange={(e) => setEmailAssunto(e.target.value)}
                        placeholder="Assunto do e-mail"
                        className="w-full rounded-lg p-2 text-sm focus:outline-none"
                        style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--moni-text-secondary)' }}>
                        Mensagem
                      </label>
                      <textarea
                        value={emailMensagem}
                        onChange={(e) => setEmailMensagem(e.target.value)}
                        placeholder="Escreva a mensagem…"
                        rows={4}
                        className="w-full resize-none rounded-lg p-3 text-sm focus:outline-none"
                        style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}
                      />
                    </div>
                    {erroEmail && <p className="text-xs text-red-500">{erroEmail}</p>}
                    <button
                      type="button"
                      disabled={enviandoEmail || !emailPara.trim() || !emailAssunto.trim() || !emailMensagem.trim()}
                      onClick={async () => {
                        if (!card) return;
                        setEnviandoEmail(true);
                        setErroEmail(null);
                        const res = await enviarEmailCard({
                          card_id: card.id,
                          para: emailPara.trim(),
                          assunto: emailAssunto.trim(),
                          mensagem: emailMensagem.trim(),
                          basePath,
                        });
                        setEnviandoEmail(false);
                        if (res.ok) {
                          setEmailAssunto('');
                          setEmailMensagem('');
                          setAbaComentarios('comentarios');
                          await loadCard();
                        } else {
                          setErroEmail(res.error);
                        }
                      }}
                      className="w-full rounded-lg px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                      style={{ background: 'var(--moni-text-primary)' }}
                    >
                      {enviandoEmail ? 'Enviando…' : 'Enviar e-mail'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {!ocultarGestaoCard && pode('arquivar_cards') && !isLegado && !card.concluido ? (
              <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--moni-border-default)' }}>
                {!arquivamentoAberto ? (
                  <button
                    type="button"
                    onClick={() => setArquivamentoAberto(true)}
                    disabled={loading}
                    className="w-full px-2 py-1 text-xs font-medium leading-tight disabled:opacity-50"
                    style={{
                      background: 'transparent',
                      color: 'var(--moni-status-overdue-text)',
                      border: '0.5px solid var(--moni-status-overdue-border)',
                      borderRadius: 'var(--moni-radius-md)',
                    }}
                  >
                    Arquivar card
                  </button>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-stone-600">Motivo do arquivamento</label>
                    <textarea
                      value={motivoArquivamento}
                      onChange={(e) => setMotivoArquivamento(e.target.value)}
                      rows={3}
                      placeholder="Descreva o motivo…"
                      className="w-full resize-none rounded-lg p-2 text-sm focus:outline-none"
                      style={{ border: '0.5px solid var(--moni-border-default)', background: 'var(--moni-surface-0)' }}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleConfirmarArquivar()}
                        disabled={loading || !motivoArquivamento.trim()}
                        className="flex-1 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        style={{ background: 'var(--moni-status-overdue-border)' }}
                      >
                        {loading ? 'Arquivando…' : 'Confirmar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setArquivamentoAberto(false);
                          setMotivoArquivamento('');
                        }}
                        disabled={loading}
                        className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Direita — ações de movimento do card (mobile: após o centro) */}
          {!ocultarGestaoCard && (pode('mover_fase') || pode('finalizar_cards')) ? (
          <aside
            className="moni-card-modal-acoes order-2 flex w-full shrink-0 flex-col gap-1.5 border-t p-2 text-xs sm:order-3 sm:h-full sm:min-w-0 sm:w-[120px] sm:max-w-[120px] sm:flex-none sm:border-l sm:border-t-0 sm:p-2"
            style={{
              borderColor: 'var(--moni-border-default)',
              background: 'var(--moni-surface-50)',
            }}
            aria-label="Ações do card"
          >
            {pode('mover_fase') ? (
              <>
                {!modalAprovacaoFase ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleRetrocederFase()}
                      disabled={loading || !podeRetrocederFase}
                      className="w-full px-2 py-1 text-xs font-medium leading-tight transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="w-full px-2 py-1 text-xs font-medium leading-tight transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        background: 'var(--moni-surface-0)',
                        color: 'var(--moni-green-800)',
                        border: '0.5px solid var(--moni-green-400)',
                        borderRadius: 'var(--moni-radius-md)',
                      }}
                    >
                      {loading ? '…' : 'Próxima Fase'}
                    </button>
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-center text-[10px] font-medium leading-snug text-stone-700">
                      Este card tem {modalAprovacaoFase.itensPendentes}{' '}
                      {modalAprovacaoFase.itensPendentes === 1 ? 'item' : 'itens'} de checklist
                      pendente{modalAprovacaoFase.itensPendentes === 1 ? '' : 's'}. Deseja solicitar
                      aprovação para avançar de fase?
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleSolicitarAprovacaoFase()}
                      disabled={solicitandoAprovacaoFase}
                      className="w-full px-2 py-1 text-xs font-semibold leading-tight text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        background: 'var(--moni-green-600)',
                        borderRadius: 'var(--moni-radius-md)',
                      }}
                    >
                      {solicitandoAprovacaoFase ? '…' : 'Solicitar aprovação'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalAprovacaoFase(null)}
                      disabled={solicitandoAprovacaoFase}
                      className="w-full px-2 py-1 text-xs font-medium leading-tight transition hover:bg-stone-100 disabled:opacity-50"
                      style={{
                        background: 'var(--moni-surface-0)',
                        color: 'var(--moni-text-primary)',
                        border: '0.5px solid var(--moni-border-default)',
                        borderRadius: 'var(--moni-radius-md)',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </>
            ) : null}
            {pode('finalizar_cards') && (exibirBotaoFinalizar || confirmandoFinalizar) ? (
              <div className="mt-1 border-t border-stone-200 pt-1.5">
                {!confirmandoFinalizar ? (
                  <button
                    type="button"
                    onClick={() => setConfirmandoFinalizar(true)}
                    disabled={loading}
                    className="w-full px-2 py-1 text-xs font-semibold leading-tight transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background: 'var(--moni-green-50)',
                      color: 'var(--moni-green-800)',
                      border: '0.5px solid var(--moni-green-400)',
                      borderRadius: 'var(--moni-radius-md)',
                    }}
                  >
                    Finalizar card
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-center text-[10px] font-medium leading-snug text-stone-700">
                      Confirmar conclusão deste card?
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleConfirmarFinalizarCard()}
                      disabled={loading}
                      className="w-full px-2 py-1 text-xs font-semibold leading-tight text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        background: 'var(--moni-green-600)',
                        borderRadius: 'var(--moni-radius-md)',
                      }}
                    >
                      {loading ? '…' : 'Confirmar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoFinalizar(false)}
                      disabled={loading}
                      className="w-full px-2 py-1 text-xs font-medium leading-tight transition hover:bg-stone-100 disabled:opacity-50"
                      style={{
                        background: 'var(--moni-surface-0)',
                        color: 'var(--moni-text-primary)',
                        border: '0.5px solid var(--moni-border-default)',
                        borderRadius: 'var(--moni-radius-md)',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </aside>
          ) : null}

          {/* Esquerda — dados colapsáveis (mobile: por último) */}
          <div
            className="moni-card-modal-left order-3 h-full w-full overflow-y-auto border-t p-4 text-xs sm:order-1 sm:min-w-0 sm:w-[min(45%,20rem)] sm:shrink-0 sm:border-r sm:border-t-0 sm:p-5"
            style={{
              borderColor: 'var(--moni-border-default)',
              background: 'var(--moni-surface-50)',
            }}
          >
            {secaoHead(
              'cronologia',
              'ID e datas do funil',
              <div className="space-y-2">
                <div>
                  <div className="text-[11px] font-medium text-stone-500">ID do card</div>
                  <div className="break-all font-mono text-[11px] text-stone-800">{card.id}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-stone-500">Data de entrada no funil</div>
                  <div className="text-xs text-stone-800">{fmtDataHoraOuDash(card.created_at)}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-stone-500">Data de conclusão</div>
                  <div className="text-xs text-stone-800">{dataConclusaoExibicao}</div>
                  {isLegado && card.processo_meta?.status === 'concluido' ? (
                    <p className="mt-0.5 text-[10px] leading-snug text-stone-500">
                      Legado: data do último update do processo com status &quot;concluído&quot; (aprox.).
                    </p>
                  ) : null}
                </div>
                <div className="border-t border-stone-100 pt-2">
                  <p className="mb-1 text-[11px] font-semibold text-stone-600">Por fase</p>
                  <div className="max-h-56 space-y-1.5 overflow-y-auto pr-0.5">
                    {linhasCronologiaFases.map((row) => (
                      <div
                        key={row.faseId}
                        className="rounded border border-stone-100 bg-stone-50/80 px-2 py-1.5"
                      >
                        <div className="text-[11px] font-medium text-stone-800">{row.faseNome}</div>
                        <div className="mt-0.5 grid grid-cols-1 gap-0.5 text-[10px] text-stone-600 sm:grid-cols-2">
                          <span>
                            <span className="text-stone-500">Entrada: </span>
                            {row.entrouEm ? fmtDataHoraOuDash(row.entrouEm) : '—'}
                          </span>
                          <span>
                            <span className="text-stone-500">Saída: </span>
                            {row.saiuEm ? fmtDataHoraOuDash(row.saiuEm) : '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>,
            )}
            {secaoHead(
              'franqueado',
              'Dados do Franqueado',
              <div className="space-y-2">
                {isAdmin && card.profiles ? (
                  <div className="mb-1 rounded border border-stone-100 bg-stone-50/80 p-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Responsável (card)</p>
                    <p className="mt-0.5 text-xs font-medium text-stone-800">
                      {card.profiles.full_name || 'Não informado'}
                    </p>
                  </div>
                ) : null}
                {!rede ? (
                  <p className="text-xs text-stone-500">Sem dados de franqueado vinculados ao card.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Nº Franquia</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.n_franquia)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Modalidade</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.modalidade)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Nome</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.nome_completo)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Status</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.status_franquia)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Classificação</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.classificacao_franqueado)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Área de atuação</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.area_atuacao)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">E-mail</div>
                        <div className="break-all text-xs text-stone-800">{displayOrDash(rede.email_frank)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Telefone</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.telefone_frank)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">CPF</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.cpf_frank)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Nascimento</div>
                        <div className="text-xs text-stone-800">{fmtDataBr(rede.data_nasc_frank)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Responsável comercial</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.responsavel_comercial)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Camiseta</div>
                        <div className="text-xs text-stone-800">{displayOrDash(rede.tamanho_camisa_frank)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Ass. COF</div>
                        <div className="text-xs text-stone-800">{fmtDataBr(rede.data_ass_cof)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Ass. Contrato</div>
                        <div className="text-xs text-stone-800">{fmtDataBr(rede.data_ass_contrato)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Expiração</div>
                        <div className="text-xs text-stone-800">{fmtDataBr(rede.data_expiracao_franquia)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">—</div>
                        <div className="text-xs text-stone-800">—</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-stone-500">Endereço (casa)</div>
                      <div className="text-xs text-stone-800">{displayOrDash(enderecoCasaLinha)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-stone-500">Sócios</div>
                      <div className="break-words text-xs text-stone-800">{displayOrDash(rede.socios)}</div>
                    </div>
                  </>
                )}
                <div className="mt-2 border-t border-stone-100 pt-2">
                  <p className="text-[11px] font-semibold text-stone-600">Anexo: Contrato de Franquia</p>
                  <input
                    ref={contratoFileRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => void handleContratoFranquiaFile(e)}
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,application/pdf"
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {rede?.contrato_franquia_path?.trim() ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleBaixarContratoFranquia()}
                          className="rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 transition hover:bg-stone-50"
                        >
                          Baixar contrato
                        </button>
                        <button
                          type="button"
                          onClick={() => contratoFileRef.current?.click()}
                          disabled={uploadingContrato || !modalDetalhes.redeIdContrato}
                          className="rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {uploadingContrato ? 'Enviando…' : 'Substituir'}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => contratoFileRef.current?.click()}
                        disabled={uploadingContrato || !modalDetalhes.redeIdContrato}
                        className="rounded border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {uploadingContrato ? 'Enviando…' : 'Anexar contrato'}
                      </button>
                    )}
                    {!modalDetalhes.redeIdContrato ? (
                      <span className="text-[11px] text-stone-500">Sem rede vinculada para anexar.</span>
                    ) : null}
                  </div>
                </div>
              </div>,
            )}
            {secaoHead(
              'novoNegocio',
              'Dados do Negócio',
              <div className="space-y-2">
                {!proc ? (
                  <p className="text-xs text-stone-500">Sem processo vinculado — dados de negócio indisponíveis.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Tipo de negociação</div>
                        <div className="text-xs text-stone-800">{displayOrDash(proc.tipo_aquisicao_terreno)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Valor do Terreno</div>
                        <div className="text-xs text-stone-800">{fmtMoedaKanban(proc.valor_terreno)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">VGV pretendido</div>
                        <div className="text-xs text-stone-800">{fmtMoedaKanban(proc.vgv_pretendido)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">Produto / Modelo</div>
                        <div className="text-xs text-stone-800">{displayOrDash(proc.produto_modelo_casa)}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-stone-500">Link pasta no Drive</div>
                        <div className="text-xs">
                          {driveHref ? (
                            <a
                              href={driveHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-moni-primary underline break-all"
                            >
                              {proc.link_pasta_drive?.trim()}
                            </a>
                          ) : (
                            '—'
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-stone-500">—</div>
                        <div className="text-xs text-stone-800">—</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-stone-500">Nome do Condomínio</div>
                      <div className="text-xs text-stone-800">{displayOrDash(proc.nome_condominio)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-stone-500">Quadra / Lote</div>
                      <div className="text-xs text-stone-800">{displayOrDash(proc.quadra_lote)}</div>
                    </div>
                  </>
                )}
              </div>,
            )}
            {secaoHead(
              'preObra',
              'Dados Pré Obra',
              !proc ? (
                <p className="text-xs text-stone-500">
                  Sem processo vinculado — não é possível editar pré-obra neste card.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="block">
                      <span className="text-[11px] font-medium text-stone-500">Previsão de Aprovação no Condomínio</span>
                      <input
                        type="text"
                        value={preObraDraft.previsao_aprovacao_condominio}
                        onChange={(e) =>
                          setPreObraDraft((d) => ({ ...d, previsao_aprovacao_condominio: e.target.value }))
                        }
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium text-stone-500">Previsão de Aprovação na Prefeitura</span>
                      <input
                        type="text"
                        value={preObraDraft.previsao_aprovacao_prefeitura}
                        onChange={(e) =>
                          setPreObraDraft((d) => ({ ...d, previsao_aprovacao_prefeitura: e.target.value }))
                        }
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium text-stone-500">Previsão de Emissão do Alvará</span>
                      <input
                        type="text"
                        value={preObraDraft.previsao_emissao_alvara}
                        onChange={(e) => setPreObraDraft((d) => ({ ...d, previsao_emissao_alvara: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium text-stone-500">
                        Previsão de Liberação do Crédito para Obra
                      </span>
                      <input
                        type="text"
                        value={preObraDraft.previsao_liberacao_credito_obra}
                        onChange={(e) =>
                          setPreObraDraft((d) => ({ ...d, previsao_liberacao_credito_obra: e.target.value }))
                        }
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-medium text-stone-500">Previsão de Início de Obra</span>
                      <input
                        type="text"
                        value={preObraDraft.previsao_inicio_obra}
                        onChange={(e) => setPreObraDraft((d) => ({ ...d, previsao_inicio_obra: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                    <label className="block min-w-0">
                      <span className="text-[11px] font-medium text-stone-500">Data de Aprovação no Condomínio</span>
                      <input
                        type="date"
                        value={preObraDraft.data_aprovacao_condominio}
                        onChange={(e) =>
                          setPreObraDraft((d) => ({ ...d, data_aprovacao_condominio: e.target.value }))
                        }
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-1 py-1 text-[11px] text-stone-800"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-[11px] font-medium text-stone-500">Data de Aprovação na Prefeitura</span>
                      <input
                        type="date"
                        value={preObraDraft.data_aprovacao_prefeitura}
                        onChange={(e) =>
                          setPreObraDraft((d) => ({ ...d, data_aprovacao_prefeitura: e.target.value }))
                        }
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-1 py-1 text-[11px] text-stone-800"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-[11px] font-medium text-stone-500">Data de Emissão do Alvará</span>
                      <input
                        type="date"
                        value={preObraDraft.data_emissao_alvara}
                        onChange={(e) => setPreObraDraft((d) => ({ ...d, data_emissao_alvara: e.target.value }))}
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-1 py-1 text-[11px] text-stone-800"
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-[11px] font-medium text-stone-500">Data de aprovação do crédito</span>
                      <input
                        type="date"
                        value={preObraDraft.data_aprovacao_credito}
                        onChange={(e) =>
                          setPreObraDraft((d) => ({ ...d, data_aprovacao_credito: e.target.value }))
                        }
                        className="mt-0.5 w-full rounded border border-stone-200 bg-white px-1 py-1 text-[11px] text-stone-800"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSalvarPreObraKanban()}
                    disabled={salvandoPreObra}
                    className="w-full rounded-lg border border-moni-primary bg-moni-primary px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {salvandoPreObra ? 'Salvando…' : 'Salvar pré-obra'}
                  </button>
                </div>
              ),
            )}
            {!isLegado ? (
              <>
                {secaoHead('obra', 'Dados Obra', <p className="text-xs italic text-stone-500">Placeholder.</p>)}
                {secaoHead(
                  'relacionamentos',
                  'Relacionamentos',
                  <div className="space-y-2">
                    {vinculosCard.length === 0 ? (
                      <p className="text-xs text-stone-500">Nenhum vínculo cadastrado.</p>
                    ) : (
                      <ul className="list-none space-y-2">
                        {vinculosCard.map((v) => {
                          const href = hrefAbrirCardKanban(v.outro_card.kanban_nome, v.outro_card.id);
                          return (
                            <li
                              key={v.id}
                              className="flex items-start justify-between gap-2 rounded border border-stone-100 bg-stone-50/80 px-2 py-1.5"
                            >
                              <div className="min-w-0 flex-1">
                                <a
                                  href={href}
                                  className="block text-[11px] font-medium text-moni-primary hover:underline"
                                >
                                  {v.outro_card.titulo}
                                </a>
                                <div className="mt-0.5 text-[10px] text-stone-500">
                                  {v.outro_card.kanban_nome}
                                  <span className="text-stone-400"> · </span>
                                  {labelTipoVinculo(v.tipo_vinculo)}
                                  <span className="text-stone-400"> · </span>
                                  {v.papel === 'origem' ? 'Saída' : 'Entrada'}
                                </div>
                              </div>
                              {pode('vincular_cards') ? (
                                <button
                                  type="button"
                                  onClick={() => void handleRemoverVinculo(v.id)}
                                  className="shrink-0 rounded p-0.5 text-stone-400 transition hover:bg-stone-200 hover:text-red-600"
                                  aria-label="Remover vínculo"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {pode('vincular_cards') ? (
                      <div className="border-t border-stone-100 pt-2">
                        {!vincularAberto ? (
                          <button
                            type="button"
                            onClick={() => setVincularAberto(true)}
                            className="text-[11px] font-medium text-moni-primary hover:underline"
                          >
                            + Vincular card
                          </button>
                        ) : (
                          <div className="space-y-2">
                            <label className="block text-[10px] font-medium text-stone-600">
                              Buscar por título
                              <input
                                type="search"
                                value={buscaVinculo}
                                onChange={(e) => setBuscaVinculo(e.target.value)}
                                placeholder="Mín. 2 caracteres…"
                                className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-800"
                              />
                            </label>
                            <label className="block text-[10px] font-medium text-stone-600">
                              Tipo de vínculo (este card → outro)
                              <select
                                value={tipoNovoVinculo}
                                onChange={(e) =>
                                  setTipoNovoVinculo(e.target.value as TipoVinculoKanbanCard)
                                }
                                className="mt-0.5 w-full rounded border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-800"
                              >
                                <option value="relacionado">Relacionado</option>
                                <option value="depende_de">Depende de</option>
                                <option value="bloqueia">Bloqueia</option>
                              </select>
                            </label>
                            {resultadosBuscaVinculo.length > 0 ? (
                              <ul className="max-h-40 list-none space-y-1 overflow-y-auto rounded border border-stone-100 bg-white p-1">
                                {resultadosBuscaVinculo.map((row) => (
                                  <li key={row.id}>
                                    <button
                                      type="button"
                                      onClick={() => void handleVincularCardDestino(row.id)}
                                      disabled={loading}
                                      className="w-full rounded px-2 py-1.5 text-left text-[11px] transition hover:bg-stone-50 disabled:opacity-50"
                                    >
                                      <span className="font-medium text-stone-800">{row.titulo}</span>
                                      <span className="mt-0.5 block text-[10px] text-stone-500">{row.kanban_nome}</span>
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : buscaVinculo.trim().length >= 2 ? (
                              <p className="text-[10px] text-stone-500">Nenhum card encontrado.</p>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                setVincularAberto(false);
                                setBuscaVinculo('');
                                setResultadosBuscaVinculo([]);
                              }}
                              className="text-[10px] text-stone-500 hover:underline"
                            >
                              Fechar
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>,
                )}
              </>
            ) : null}
            {card && (
              <ChecklistCard
                cardId={card.id}
                userId={modalSessao.userId}
                isFrank={portalFrank}
                responsaveisOpcoes={responsaveisOpcoes}
                basePath={basePath}
              />
            )}
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
                className="flex w-full items-center gap-2 p-2 text-left text-xs transition hover:bg-stone-50"
              >
                {secaoAberta.historico ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-500" aria-hidden />
                )}
                <span className="text-xs font-semibold text-stone-800">Histórico</span>
              </button>
              {secaoAberta.historico ? (
                <div className="border-t px-2 pb-2 pt-1.5 text-xs" style={{ borderColor: 'var(--moni-border-subtle)' }}>
                  {historico.length === 0 ? (
                    <p className="text-xs text-stone-500">Nenhum evento ainda.</p>
                  ) : (
                    <ul className="max-h-64 list-none space-y-0 overflow-y-auto">
                      {historico.map((h) => (
                        <li key={h.id} className="flex gap-2 border-b border-stone-100 py-2 text-xs last:border-0">
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
