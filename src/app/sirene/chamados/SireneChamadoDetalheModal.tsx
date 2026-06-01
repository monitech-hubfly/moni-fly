'use client';

import { Archive, Pencil, User, X } from 'lucide-react';
import Link from 'next/link';
import type { InteracaoSireneRow } from './InteracoesLista';
import { formatChamadoNumero } from '@/lib/kanban/chamado-numero';
import { chamadoEditavelNaSirene } from '@/lib/kanban/sirene-chamado-permissoes';
import { rotaCardOrigem } from '@/lib/rota-card-origem';
import type { StatusInteracaoDb } from './actions';
import type { SubInteracaoStatusDb } from '@/lib/actions/card-actions';

const selectClass =
  'rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-2 py-1.5 text-sm text-[color:var(--moni-text-primary)] outline-none focus:border-[color:var(--moni-navy-400)] focus:ring-1 focus:ring-[color:var(--moni-navy-400)]';

type TopicoLinha = {
  id: number;
  descricao: string;
  tipo: string;
  status: string;
  data_fim: string | null;
  trava: boolean;
  time_responsavel: string;
};

type Props = {
  row: InteracaoSireneRow;
  onClose: () => void;
  topicos: TopicoLinha[];
  topicosLoading: boolean;
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
};

export function SireneChamadoDetalheModal({
  row,
  onClose,
  topicos,
  topicosLoading,
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
}: Props) {
  const ccid = row.card_id;
  const hrefCard = ccid ? rotaCardOrigem(row.kanban_nome, ccid) : null;

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
              Resp.: <span className="font-medium text-[color:var(--moni-text-primary)]">{textoResponsavel}</span>
            </span>
            {row.data_vencimento ? (
              <span className="text-[color:var(--moni-text-tertiary)]">
                Prazo {row.data_vencimento.split('-').reverse().join('/')}
              </span>
            ) : null}
            <select
              value={statusSelect}
              disabled={pending}
              onChange={(e) => onStatusChange(row.id, e.target.value as StatusInteracaoDb)}
              className={`min-w-[9.5rem] ${selectClass}`}
              aria-label="Status do chamado"
            >
              <option value="pendente">A fazer</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluida" disabled={temSubAberta}>
                Concluída
              </option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            {chamadoEditavelNaSirene(row) && onEdit ? (
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

          <section>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--moni-text-tertiary)]">
              Atividades ({topicos.length})
            </h3>
            {topicosLoading ? (
              <p className="text-xs text-[color:var(--moni-text-tertiary)]">Carregando atividades…</p>
            ) : topicos.length > 0 ? (
              <ul className="space-y-2">
                {topicos.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-50)] px-3 py-2"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {t.trava ? (
                          <span className="mb-1 inline-block rounded border border-red-200 bg-red-50 px-1 py-0.5 text-[9px] font-bold uppercase text-red-800">
                            Trava
                          </span>
                        ) : null}
                        <p className="text-sm font-medium text-[color:var(--moni-text-primary)]">{t.descricao}</p>
                        <p className="mt-1 text-[10px] text-[color:var(--moni-text-tertiary)]">
                          {t.time_responsavel}
                          {t.data_fim ? ` · Prazo ${t.data_fim.split('-').reverse().join('/')}` : ''}
                        </p>
                      </div>
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
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[color:var(--moni-text-tertiary)]">Nenhuma atividade registrada.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
