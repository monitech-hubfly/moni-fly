'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ChevronRight, MessageCircle, Paperclip, User, X } from 'lucide-react';
import Link from 'next/link';
import type { InteracaoSireneRow } from './InteracoesLista';
import {
  SireneChamadoEdicaoKanbanForm,
  SireneChamadoEdicaoSireneForm,
  type EditLinhaDraft,
  type EditSireneDraft,
} from './SireneChamadoEdicaoForms';
import { formatChamadoNumero } from '@/lib/kanban/chamado-numero';
import { SlaAtividadeBadge } from '@/components/SlaAtividadeBadge';
import { chamadoEditavelNaSirene } from '@/lib/kanban/sirene-chamado-permissoes';
import { rotaCardOrigem } from '@/lib/rota-card-origem';
import type { StatusInteracaoDb } from './actions';
import type { SubInteracaoStatusDb } from '@/lib/actions/card-actions';
import { ChamadoAtividadeCollapsibleSection } from '@/components/kanban-shared/ChamadoAtividadeCollapsibleSection';
import {
  KanbanAtividadeFormFields,
  type AtividadeFormDraft,
} from '@/components/kanban-shared/KanbanAtividadeFormFields';
import { responsaveisFiltradosPorTimesIds, timesOpcoesReceberChamado } from '@/lib/times-responsaveis';
import {
  filtrarSubAtividadesPorConclusao,
  isSubAtividadeConcluida,
} from '@/components/kanban-shared/SubInteracaoLista';
import { PrazoNegociacaoPanel } from '@/components/kanban-shared/PrazoNegociacaoPanel';
import { AtribuicaoAceitePanel } from '@/components/sirene/AtribuicaoAceitePanel';
import {
  listarComentariosCardSirene,
  listarComentariosSireneChamado,
  publicarComentarioCardSirene,
  publicarComentarioSireneChamado,
  type ComentarioCardSireneRow,
} from './actions';
import { MencaoContentEditable } from '@/components/kanban-shared/MencaoContentEditable';
import type { TopicoPainelLinha } from '../actions';
import { listAnexosChamado, uploadAnexoChamado, getAnexoChamadoDownloadUrl } from '../actions';

type AnexoRow = {
  id: number;
  chamado_id: number;
  topico_id: number | null;
  uploader_nome: string | null;
  nome_original: string | null;
  origem: string | null;
  created_at: string;
};

const selectClass =
  'rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)] outline-none focus:border-[color:var(--moni-navy-400)] focus:ring-1 focus:ring-[color:var(--moni-navy-400)]';

type TopicoLinha = TopicoPainelLinha;

type TimeOpt = { id: string; nome: string };
type RespOpt = { id: string; nome: string; email?: string | null };

type Props = {
  row: InteracaoSireneRow;
  onClose: () => void;
  topicos: TopicoLinha[];
  topicosLoading: boolean;
  nomePorUserId: Map<string, string>;
  textoResponsavel: string;
  parseTimesNomes: (raw: unknown) => string[];
  statusSelect: StatusInteracaoDb;
  temSubAberta: boolean;
  pending: boolean;
  onStatusChange: (id: string, status: StatusInteracaoDb) => void;
  onSubStatusChange: (topicoId: number, status: SubInteracaoStatusDb) => void;
  onEdit?: () => void;
  onArquivar?: () => void;
  podeArquivar: boolean;
  badgeTipo: { label: string; className: string };
  editingKanban?: boolean;
  editDraft?: EditLinhaDraft | null;
  setEditDraft?: React.Dispatch<React.SetStateAction<EditLinhaDraft | null>>;
  editingSirene?: boolean;
  editSireneDraft?: EditSireneDraft | null;
  setEditSireneDraft?: React.Dispatch<React.SetStateAction<EditSireneDraft | null>>;
  times: TimeOpt[];
  responsaveis: RespOpt[];
  timesSireneEditOpcoes?: string[];
  salvandoEdicao?: boolean;
  salvandoSirene?: boolean;
  onSalvarEdicao?: () => void;
  onSalvarEdicaoSirene?: () => void;
  onCancelarEdicao?: () => void;
  novaAtivDraft: AtividadeFormDraft;
  setNovaAtivDraft: React.Dispatch<React.SetStateAction<AtividadeFormDraft>>;
  onAdicionarAtividade: () => void;
  salvandoNovaAtividade: boolean;
  currentUserId: string | null;
  onArquivarTopico?: (topicoId: number) => void;
  onEncerrarAtividadeRecusada?: (topicoId: number) => void;
  highlightTopicoId?: number | null;
  sessionEhAdmin?: boolean;
  onRecarregarTopicos?: () => void;
  rankLabel?: string | null;
};

function iniciaisNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}

function badgePrioridade(p: string | null | undefined): { label: string; className: string } | null {
  if (!p) return null;
  const label = p.toUpperCase();
  const className =
    label === 'P1' || label === 'P2'
      ? 'border-red-200 bg-red-50 text-red-800'
      : label === 'P3' || label === 'P4'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : label === 'P5'
      ? 'border-green-200 bg-green-50 text-green-700'
      : 'border-[color:var(--moni-border-default)] bg-[var(--moni-surface-100)] text-[color:var(--moni-text-secondary)]';
  return { label, className };
}

function statusBadgeLabel(status: StatusInteracaoDb): string {
  if (status === 'concluida') return 'Concluída';
  if (status === 'em_andamento') return 'Em andamento';
  return 'A fazer';
}

function statusBadgeClass(status: StatusInteracaoDb): string {
  if (status === 'concluida') return 'border-green-200 bg-green-50 text-green-800';
  if (status === 'em_andamento') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-[color:var(--moni-border-default)] bg-[var(--moni-surface-100)] text-[color:var(--moni-text-secondary)]';
}

function resolverNomeResponsavelTopico(
  t: TopicoLinha,
  nomePorUserId: Map<string, string>,
): string | null {
  if (t.responsavel_id) {
    const nome = nomePorUserId.get(t.responsavel_id);
    if (nome) return nome;
  }
  if (t.responsaveis_ids.length > 0) {
    const nomes = t.responsaveis_ids
      .map((id) => nomePorUserId.get(id))
      .filter((n): n is string => Boolean(n));
    if (nomes.length > 0) return nomes.join(', ');
  }
  return null;
}

export function SireneChamadoDetalheModal({
  row,
  onClose,
  topicos,
  topicosLoading,
  nomePorUserId,
  textoResponsavel,
  parseTimesNomes,
  statusSelect,
  temSubAberta,
  pending,
  onStatusChange,
  onSubStatusChange,
  onArquivar,
  podeArquivar,
  badgeTipo,
  editingKanban,
  editDraft,
  setEditDraft,
  editingSirene,
  editSireneDraft,
  setEditSireneDraft,
  times,
  responsaveis,
  timesSireneEditOpcoes,
  salvandoEdicao,
  salvandoSirene,
  onSalvarEdicao,
  onSalvarEdicaoSirene,
  onCancelarEdicao,
  novaAtivDraft,
  setNovaAtivDraft,
  onAdicionarAtividade,
  salvandoNovaAtividade,
  currentUserId,
  onArquivarTopico,
  onEncerrarAtividadeRecusada,
  highlightTopicoId = null,
  sessionEhAdmin = false,
  onRecarregarTopicos,
  rankLabel,
}: Props) {
  const ccid = row.card_id;
  const hrefCard = ccid ? rotaCardOrigem(row.kanban_nome, ccid) : null;
  const editando = editingKanban || editingSirene;
  const podeEditar = chamadoEditavelNaSirene(row);
  const [novaAtivAberta, setNovaAtivAberta] = useState(false);
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);

  const topicosAbertos = useMemo(
    () => topicos.filter((t) => t.status !== 'concluido' && t.status !== 'aprovado'),
    [topicos],
  );
  const topicosConcluidos = useMemo(
    () => topicos.filter((t) => t.status === 'concluido' || t.status === 'aprovado'),
    [topicos],
  );
  const topicosVisiveis = mostrarConcluidas ? topicos : topicosAbertos;

  useEffect(() => {
    if (highlightTopicoId == null) return;
    const t = topicos.find((x) => x.id === highlightTopicoId);
    if (t && isSubAtividadeConcluida(t.status)) {
      setMostrarConcluidas(true);
    }
  }, [highlightTopicoId, topicos]);

  const timesChamadoOpcoes = useMemo(() => timesOpcoesReceberChamado(times), [times]);
  const kanbanTimesForm = useMemo(
    () => timesChamadoOpcoes.map((t) => ({ id: t.id, nome: t.nome, ordem: 0 })),
    [timesChamadoOpcoes],
  );
  const responsaveisNovaAtiv = useMemo(
    () => responsaveisFiltradosPorTimesIds(novaAtivDraft.timesIds, timesChamadoOpcoes, responsaveis),
    [responsaveis, novaAtivDraft.timesIds, timesChamadoOpcoes],
  );

  const prioridadeBadge = badgePrioridade(row.sirene_prioridade);
  const ehCriador = Boolean(currentUserId && row.criado_por && row.criado_por === currentUserId);

  const [anexos, setAnexos] = useState<AnexoRow[]>([]);
  const [anexosLoading, setAnexosLoading] = useState(false);
  const [anexosFetched, setAnexosFetched] = useState(false);
  const [anexosAbertos, setAnexosAbertos] = useState(false);
  const [uploadAnexoErr, setUploadAnexoErr] = useState<string | null>(null);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const anexoFileRef = useRef<HTMLInputElement>(null);

  function abrirAnexos() {
    setAnexosAbertos((v) => !v);
    if (!anexosFetched && row.sirene_chamado_id != null) {
      setAnexosFetched(true);
      setAnexosLoading(true);
      void listAnexosChamado(row.sirene_chamado_id).then((res) => {
        setAnexosLoading(false);
        if (res.ok) setAnexos(res.anexos);
      });
    }
  }

  async function baixarAnexo(anexoId: number) {
    const res = await getAnexoChamadoDownloadUrl(anexoId);
    if (res.ok) window.open(res.url, '_blank');
  }

  async function enviarAnexo() {
    const scid = row.sirene_chamado_id;
    if (!anexoFileRef.current?.files?.length || scid == null) return;
    const formData = new FormData();
    formData.set('file', anexoFileRef.current.files[0]!);
    setEnviandoAnexo(true);
    setUploadAnexoErr(null);
    const res = await uploadAnexoChamado(scid, 'criador', formData);
    setEnviandoAnexo(false);
    if (!res.ok) { setUploadAnexoErr(res.error ?? 'Erro ao enviar.'); return; }
    if (anexoFileRef.current) anexoFileRef.current.value = '';
    setAnexosLoading(true);
    void listAnexosChamado(scid).then((res2) => {
      setAnexosLoading(false);
      if (res2.ok) setAnexos(res2.anexos);
    });
  }

  const commentKey = row.card_id ?? (row.sirene_chamado_id != null ? `sirene-${row.sirene_chamado_id}` : null);
  const [comentarios, setComentarios] = useState<ComentarioCardSireneRow[]>([]);
  const [comentariosLoading, setComentariosLoading] = useState(false);
  const [comentariosFetched, setComentariosFetched] = useState(false);
  const [novoComentario, setNovoComentario] = useState('');
  const [salvandoComentario, setSalvandoComentario] = useState(false);
  const [comentariosAbertos, setComentariosAbertos] = useState(false);
  const [erroComentario, setErroComentario] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  function abrirComentarios() {
    setComentariosAbertos(true);
    if (!comentariosFetched) {
      setComentariosFetched(true);
      setComentariosLoading(true);
      const scid = row.sirene_chamado_id;
      const cid = row.card_id;
      if (scid != null) {
        void listarComentariosSireneChamado(scid).then((res) => {
          setComentariosLoading(false);
          if (res.ok) setComentarios(res.items);
        });
      } else if (cid) {
        void listarComentariosCardSirene(cid).then((res) => {
          setComentariosLoading(false);
          if (res.ok) setComentarios(res.items);
        });
      }
    }
  }

  async function publicarComentarioModal() {
    const html = editorRef.current?.innerHTML.trim() ?? '';
    if (!html) return;
    setSalvandoComentario(true);
    setErroComentario(null);
    try {
      const referenciaPath = row.sirene_chamado_id != null
        ? `/sirene/chamados?interacao=${encodeURIComponent(row.id)}`
        : '/sirene/chamados';
      let res: { ok: boolean; error?: string };
      if (row.sirene_chamado_id != null) {
        res = await publicarComentarioSireneChamado(row.sirene_chamado_id, html, {
          referenciaPath,
          contextoTitulo: row.titulo || 'Chamado',
        });
      } else if (row.card_id) {
        res = await publicarComentarioCardSirene(row.card_id, html, {
          referenciaPath,
          contextoTitulo: row.titulo || row.card_titulo || 'Chamado',
        });
      } else {
        setErroComentario('Não foi possível identificar o chamado.');
        return;
      }
      if (!res.ok) { setErroComentario(res.error ?? 'Erro'); return; }
      if (editorRef.current) editorRef.current.innerHTML = '';
      setNovoComentario('');
      // Recarrega comentários
      setComentariosLoading(true);
      const scid = row.sirene_chamado_id;
      const cid = row.card_id;
      if (scid != null) {
        void listarComentariosSireneChamado(scid).then((res2) => {
          setComentariosLoading(false);
          if (res2.ok) setComentarios(res2.items);
        });
      } else if (cid) {
        void listarComentariosCardSirene(cid).then((res2) => {
          setComentariosLoading(false);
          if (res2.ok) setComentarios(res2.items);
        });
      }
    } finally {
      setSalvandoComentario(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sirene-chamado-detalhe-titulo"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[color:var(--moni-border-default)] bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {(row.numero ?? row.sirene_numero) != null ? (
                <span className="rounded bg-[var(--moni-surface-100)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[color:var(--moni-text-secondary)]">
                  {formatChamadoNumero(row.numero ?? row.sirene_numero)}
                </span>
              ) : null}
              {row.trava ? (
                <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-800">
                  Trava
                </span>
              ) : null}
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${badgeTipo.className}`}>
                {badgeTipo.label}
              </span>
              {rankLabel ? (
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                  rankLabel === 'P1' || rankLabel === 'P2' ? 'border-red-200 bg-red-50 text-red-800'
                  : rankLabel === 'P3' || rankLabel === 'P4' ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : rankLabel === 'P5' ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-[color:var(--moni-border-default)] bg-[var(--moni-surface-100)] text-[color:var(--moni-text-secondary)]'
                }`}>
                  {rankLabel}
                </span>
              ) : null}
            </div>
            <h2 id="sirene-chamado-detalhe-titulo" className="mt-1 text-base font-semibold text-[color:var(--moni-text-primary)]">
              {row.titulo}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-[color:var(--moni-text-tertiary)] hover:bg-[var(--moni-surface-100)]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {editingKanban && editDraft && setEditDraft && onSalvarEdicao && onCancelarEdicao ? (
            <SireneChamadoEdicaoKanbanForm
              draft={editDraft}
              setDraft={setEditDraft}
              times={times}
              responsaveis={responsaveis}
              salvando={salvandoEdicao ?? false}
              onSalvar={onSalvarEdicao}
              onCancelar={onCancelarEdicao}
            />
          ) : null}

          {editingSirene && editSireneDraft && setEditSireneDraft && onSalvarEdicaoSirene && onCancelarEdicao ? (
            <SireneChamadoEdicaoSireneForm
              draft={editSireneDraft}
              setDraft={setEditSireneDraft}
              timesSireneEditOpcoes={timesSireneEditOpcoes ?? []}
              salvando={salvandoSirene ?? false}
              onSalvar={onSalvarEdicaoSirene}
              onCancelar={onCancelarEdicao}
            />
          ) : null}

          {!editando ? (
            <>
              {row.descricao?.trim() ? (
                <p className="whitespace-pre-wrap text-sm text-[color:var(--moni-text-secondary)]">{row.descricao.trim()}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--moni-text-tertiary)]">
                <span className="rounded bg-[var(--moni-surface-100)] px-1.5 py-0.5 text-[10px]">{row.kanban_nome}</span>
                {ccid && hrefCard ? (
                  <Link href={hrefCard} className="text-[color:var(--moni-navy-600)] underline-offset-2 hover:underline">
                    Card: {row.card_titulo?.trim() || '—'}
                  </Link>
                ) : null}
                {parseTimesNomes(row.times_nomes).map((tn) => (
                  <span key={tn} className="rounded bg-[var(--moni-surface-100)] px-1.5 py-0.5 text-[10px]">
                    {tn}
                  </span>
                ))}
              </div>

              {(row.franqueado_nome ?? '').trim() ? (
                <div className="flex items-center gap-1 text-xs text-[color:var(--moni-text-tertiary)]">
                  <User className="h-3.5 w-3.5" aria-hidden />
                  <span>{row.franqueado_nome!.trim()}</span>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-[color:var(--moni-text-tertiary)]">
                  Aberto por: <span className="font-medium text-[color:var(--moni-text-primary)]">{textoResponsavel}</span>
                </span>
                {row.data_vencimento ? (
                  <span className="text-[color:var(--moni-text-tertiary)]">
                    Prazo {row.data_vencimento.split('-').reverse().join('/')}
                  </span>
                ) : null}
                <SlaAtividadeBadge
                  prazoIso={row.data_vencimento}
                  status={statusSelect === 'concluida' ? 'concluida' : statusSelect}
                />

                {/* Status: select only for creator, static badge for others */}
                {ehCriador ? (
                    <select
                      value={statusSelect}
                      disabled={pending}
                      onChange={(e) => onStatusChange(row.id, e.target.value as StatusInteracaoDb)}
                      className={`min-w-[9.5rem] ${selectClass}`}
                      aria-label="Status do chamado"
                    >
                      <option value="pendente">A fazer</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="concluida">
                        Concluída
                      </option>
                    </select>
                ) : (
                  <span className={`rounded border px-2 py-1 text-xs font-medium ${statusBadgeClass(statusSelect)}`}>
                    {statusBadgeLabel(statusSelect)}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {podeArquivar && ehCriador && !row.sirene_arquivado && onArquivar ? (
                  <button
                    type="button"
                    onClick={onArquivar}
                    className="inline-flex items-center gap-1 rounded border border-[color:var(--moni-border-default)] px-2 py-1 text-xs hover:bg-red-50 hover:text-red-700"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Arquivar
                  </button>
                ) : null}
              </div>
            </>
          ) : null}

          {/* Atividades */}
          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
                Atividades ({topicosAbertos.length}
                {topicosConcluidos.length > 0 ? ` de ${topicos.length}` : ''})
              </h3>
              {topicosConcluidos.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setMostrarConcluidas((v) => !v)}
                  className="inline-flex items-center gap-0.5 text-[10px] text-[color:var(--moni-text-secondary)] hover:text-[color:var(--moni-text-primary)]"
                >
                  {mostrarConcluidas ? 'Ocultar concluídas' : `Ver concluídas (${topicosConcluidos.length})`}
                  <ChevronRight className={`h-3 w-3 transition-transform ${mostrarConcluidas ? 'rotate-90' : ''}`} />
                </button>
              ) : null}
            </div>

            {topicosLoading ? (
              <p className="text-xs text-[color:var(--moni-text-tertiary)]">Carregando atividades…</p>
            ) : topicosVisiveis.length > 0 ? (
              <ul className="space-y-2">
                {topicosVisiveis.map((t) => {
                  const nomeResp = resolverNomeResponsavelTopico(t, nomePorUserId);
                  return (
                    <li
                      key={t.id}
                      className={`rounded-lg border px-3 py-2 ${
                        highlightTopicoId != null && highlightTopicoId === t.id
                          ? 'border-[color:var(--moni-status-attention-border)] bg-[var(--moni-status-attention-bg)]'
                          : 'border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)]'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[color:var(--moni-text-primary)]">{t.descricao}</p>
                          {t.descricao_detalhe ? (
                            <p className="mt-0.5 text-[11px] text-[color:var(--moni-text-tertiary)]">{t.descricao_detalhe}</p>
                          ) : null}
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[color:var(--moni-text-tertiary)]">
                            <span>{t.time_responsavel}</span>
                            {t.data_fim ? (
                              <span>Prazo {t.data_fim.split('-').reverse().join('/')}</span>
                            ) : null}
                            <SlaAtividadeBadge
                              prazoIso={t.data_fim}
                              status={t.status}
                              showOkText={false}
                              size="compact"
                            />
                          </p>
                          {nomeResp ? (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--moni-navy-100)] text-[9px] font-bold text-[color:var(--moni-navy-700)]">
                                {iniciaisNome(nomeResp)}
                              </span>
                              <span className="text-[10px] text-[color:var(--moni-text-secondary)]">
                                {nomeResp}
                                <span className="ml-1 text-[color:var(--moni-text-tertiary)]">· responsável</span>
                              </span>
                            </div>
                          ) : null}
                          {(t.atribuicao_status === 'pendente_aceite' || t.atribuicao_status === 'recusado') ? (
                            <AtribuicaoAceitePanel
                              topicoId={String(t.id)}
                              atribuicaoStatus={t.atribuicao_status ?? null}
                              atribuicaoJustificativa={t.atribuicao_justificativa ?? null}
                              atribuicaoRecusadoPor={t.atribuicao_recusado_por ?? null}
                              recusadoPorNome={t.atribuicao_recusado_por ? (nomePorUserId.get(t.atribuicao_recusado_por) ?? null) : null}
                              sessionUserId={currentUserId}
                              responsavelId={t.responsavel_id}
                              abridorId={row.criado_por ?? null}
                              responsaveisOpcoes={responsaveis.map(r => ({ id: r.id, nome: r.nome }))}
                              onArquivar={onEncerrarAtividadeRecusada ? () => onEncerrarAtividadeRecusada(t.id) : undefined}
                              basePath="/sirene/chamados"
                              compact
                              onUpdated={onRecarregarTopicos}
                            />
                          ) : null}
                          {t.atribuicao_status !== 'pendente_aceite' &&
                          t.prazo_status &&
                          (t.prazo_status !== 'aceito' || sessionEhAdmin) ? (
                            <PrazoNegociacaoPanel
                              topicoId={String(t.id)}
                              row={{
                                prazo_proposto: t.prazo_proposto ?? null,
                                prazo_status: t.prazo_status ?? null,
                                prazo_abridor_id: t.prazo_abridor_id ?? null,
                                prazo_proposto_por: t.prazo_proposto_por ?? null,
                                prazo_negociacao_expira_em: t.prazo_negociacao_expira_em ?? null,
                                responsaveis_ids: t.responsaveis_ids,
                              }}
                              sessionUserId={currentUserId}
                              abridorId={row.criado_por ?? null}
                              isAdmin={sessionEhAdmin}
                              atribuicaoAceita={t.atribuicao_status === 'aceito'}
                              basePath="/sirene/chamados"
                              compact
                              onUpdated={onRecarregarTopicos}
                            />
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {podeArquivar && onArquivarTopico ? (
                            <button
                              type="button"
                              onClick={() => onArquivarTopico(t.id)}
                              className="rounded p-1 text-[color:var(--moni-text-tertiary)] hover:bg-red-50 hover:text-red-700"
                              title="Arquivar sub-chamado"
                              aria-label="Arquivar sub-chamado"
                            >
                              <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            </button>
                          ) : null}
                          <select
                            value={t.status}
                            onChange={(e) => onSubStatusChange(t.id, e.target.value as SubInteracaoStatusDb)}
                            className={`min-w-[7.5rem] text-[10px] ${selectClass}`}
                            aria-label="Status da atividade"
                          >
                            <option value="nao_iniciado">Não iniciado</option>
                            <option value="em_andamento">Em andamento</option>
                            <option value="concluido">Concluído</option>
                            <option value="aprovado">Aprovado</option>
                          </select>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-[color:var(--moni-text-tertiary)]">
                {!mostrarConcluidas && topicos.length > 0
                  ? 'Só há atividades concluídas. Clique em "Ver concluídas" acima.'
                  : 'Nenhuma atividade registrada.'}
              </p>
            )}
          </section>

          {commentKey ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={abrirComentarios}
                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)] hover:text-[color:var(--moni-text-primary)]"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Comentários {comentarios.length > 0 ? `(${comentarios.length})` : ''}
                  {!comentariosAbertos ? <ChevronRight className="h-3 w-3" /> : <ChevronRight className="h-3 w-3 rotate-90" />}
                </button>
              </div>
              {comentariosAbertos ? (
                <div className="rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] p-3">
                  {comentariosLoading ? (
                    <p className="text-xs text-[color:var(--moni-text-tertiary)]">Carregando…</p>
                  ) : comentarios.length > 0 ? (
                    <ul className="mb-3 max-h-48 space-y-2 overflow-y-auto">
                      {[...comentarios]
                        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                        .map((c) => (
                          <li key={c.id} className="flex gap-2 rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] text-[10px] font-semibold text-[color:var(--moni-text-secondary)]">
                              {iniciaisNome(c.autor_nome ?? '')}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs leading-snug">
                                <span className="font-medium text-[color:var(--moni-text-primary)]">{(c.autor_nome ?? '—').trim() || '—'}</span>
                                {c.created_at ? <span className="ml-1 tabular-nums text-[color:var(--moni-text-tertiary)]">{new Date(c.created_at).toLocaleString('pt-BR')}</span> : null}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--moni-text-primary)]">{c.texto}</p>
                            </div>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="mb-3 text-xs text-[color:var(--moni-text-tertiary)]">Nenhum comentário ainda.</p>
                  )}
                  <div className="flex flex-col gap-2">
                    <div className="overflow-visible rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)]">
                      <MencaoContentEditable
                        editorRef={editorRef}
                        onInput={(html) => setNovoComentario(html)}
                        className="min-h-[60px] w-full p-2 text-sm text-[color:var(--moni-text-primary)] focus:outline-none empty:before:text-[color:var(--moni-text-tertiary)] empty:before:content-[attr(data-placeholder)]"
                        placeholder="Escreva um comentário… Use @ para mencionar"
                      />
                    </div>
                    {erroComentario ? <p className="text-xs text-red-600">{erroComentario}</p> : null}
                    <button
                      type="button"
                      disabled={salvandoComentario}
                      onClick={() => void publicarComentarioModal()}
                      className="self-end rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      {salvandoComentario ? '…' : 'Publicar'}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {row.sirene_chamado_id != null ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={abrirAnexos}
                  className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)] hover:text-[color:var(--moni-text-primary)]"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Anexos {anexos.length > 0 ? `(${anexos.length})` : ''}
                  {!anexosAbertos ? <ChevronRight className="h-3 w-3" /> : <ChevronRight className="h-3 w-3 rotate-90" />}
                </button>
              </div>
              {anexosAbertos ? (
                <div className="rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] p-3">
                  {anexosLoading ? (
                    <p className="text-xs text-[color:var(--moni-text-tertiary)]">Carregando…</p>
                  ) : anexos.length > 0 ? (
                    <ul className="mb-3 max-h-48 space-y-2 overflow-y-auto">
                      {anexos.map((a) => (
                        <li key={a.id} className="flex items-center gap-2 rounded border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-2">
                          <Paperclip className="h-4 w-4 shrink-0 text-[color:var(--moni-text-tertiary)]" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-[color:var(--moni-text-primary)]">{a.nome_original ?? 'Arquivo'}</p>
                            <p className="text-[10px] text-[color:var(--moni-text-tertiary)]">
                              {a.uploader_nome ?? '—'} · {new Date(a.created_at).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void baixarAnexo(a.id)}
                            className="shrink-0 rounded border border-[color:var(--moni-border-default)] px-2 py-0.5 text-[10px] hover:bg-[var(--moni-surface-100)]"
                          >
                            Baixar
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mb-3 text-xs text-[color:var(--moni-text-tertiary)]">Nenhum anexo ainda.</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={anexoFileRef}
                      type="file"
                      className="text-xs text-[color:var(--moni-text-secondary)] file:mr-2 file:rounded file:border file:border-[color:var(--moni-border-default)] file:bg-[var(--moni-surface-50)] file:px-2 file:py-1 file:text-xs"
                    />
                    {uploadAnexoErr ? <p className="w-full text-xs text-red-600">{uploadAnexoErr}</p> : null}
                    <button
                      type="button"
                      disabled={enviandoAnexo}
                      onClick={() => void enviarAnexo()}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      {enviandoAnexo ? '…' : 'Enviar'}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {podeEditar && !editando ? (
            <ChamadoAtividadeCollapsibleSection
              aberto={novaAtivAberta}
              onAbrir={() => setNovaAtivAberta(true)}
              onFechar={() => setNovaAtivAberta(false)}
            >
              <KanbanAtividadeFormFields
                draft={novaAtivDraft}
                setDraft={setNovaAtivDraft}
                kanbanTimes={kanbanTimesForm}
                responsaveisOpcoes={responsaveisNovaAtiv}
                sessionUserId={currentUserId}
                compact
                idPrefix="sirene-modal-nova-ativ"
                showAnexosDraft={false}
                maxResponsaveis={1}
              />
              <button
                type="button"
                disabled={
                  salvandoNovaAtividade ||
                  !novaAtivDraft.nome.trim() ||
                  novaAtivDraft.timesIds.length === 0 ||
                  novaAtivDraft.responsaveisIds.length === 0
                }
                onClick={onAdicionarAtividade}
                className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {salvandoNovaAtividade ? 'Salvando…' : 'Adicionar atividade'}
              </button>
            </ChamadoAtividadeCollapsibleSection>
          ) : null}
        </div>
      </div>
    </div>
  );
}
