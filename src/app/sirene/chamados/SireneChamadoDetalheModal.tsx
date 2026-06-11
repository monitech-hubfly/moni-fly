'use client';

import { useEffect, useMemo, useState } from 'react';
import { Archive, ChevronRight, Pencil, User, X } from 'lucide-react';
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
import type { TopicoPainelLinha } from '../actions';

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
  editingKanban: boolean;
  editDraft: EditLinhaDraft | null;
  setEditDraft: React.Dispatch<React.SetStateAction<EditLinhaDraft | null>>;
  editingSirene: boolean;
  editSireneDraft: EditSireneDraft | null;
  setEditSireneDraft: React.Dispatch<React.SetStateAction<EditSireneDraft | null>>;
  times: TimeOpt[];
  responsaveis: RespOpt[];
  timesSireneEditOpcoes: string[];
  salvandoEdicao: boolean;
  salvandoSirene: boolean;
  onSalvarEdicao: () => void;
  onSalvarEdicaoSirene: () => void;
  onCancelarEdicao: () => void;
  novaAtivDraft: AtividadeFormDraft;
  setNovaAtivDraft: React.Dispatch<React.SetStateAction<AtividadeFormDraft>>;
  onAdicionarAtividade: () => void;
  salvandoNovaAtividade: boolean;
  currentUserId: string | null;
  onArquivarTopico?: (topicoId: number) => void;
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
  onEdit,
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
              {prioridadeBadge ? (
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${prioridadeBadge.className}`}>
                  {prioridadeBadge.label}
                </span>
              ) : rankLabel ? (
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
          {editingKanban && editDraft ? (
            <SireneChamadoEdicaoKanbanForm
              draft={editDraft}
              setDraft={setEditDraft}
              times={times}
              responsaveis={responsaveis}
              salvando={salvandoEdicao}
              onSalvar={onSalvarEdicao}
              onCancelar={onCancelarEdicao}
            />
          ) : null}

          {editingSirene && editSireneDraft ? (
            <SireneChamadoEdicaoSireneForm
              draft={editSireneDraft}
              setDraft={setEditSireneDraft}
              timesSireneEditOpcoes={timesSireneEditOpcoes}
              salvando={salvandoSirene}
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
                  statusSelect === 'em_andamento' ? (
                    <span className={`min-w-[9.5rem] text-center text-sm ${selectClass}`}>
                      Em andamento
                    </span>
                  ) : (
                    <select
                      value={statusSelect}
                      disabled={pending}
                      onChange={(e) => onStatusChange(row.id, e.target.value as StatusInteracaoDb)}
                      className={`min-w-[9.5rem] ${selectClass}`}
                      aria-label="Status do chamado"
                    >
                      <option value="pendente">A fazer</option>
                      <option value="concluida" disabled={temSubAberta}>
                        Concluída
                      </option>
                    </select>
                  )
                ) : (
                  <span className={`rounded border px-2 py-1 text-xs font-medium ${statusBadgeClass(statusSelect)}`}>
                    {statusBadgeLabel(statusSelect)}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {podeEditar && onEdit ? (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="inline-flex items-center gap-1 rounded border border-[color:var(--moni-border-default)] px-2 py-1 text-xs hover:bg-[var(--moni-surface-50)]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                ) : null}
                {podeArquivar && !row.sirene_arquivado && onArquivar ? (
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
                          {t.prazo_status &&
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
