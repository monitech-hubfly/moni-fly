'use client';

import Link from 'next/link';
import { ExternalLink, History } from 'lucide-react';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import {
  TAG_AGUARDANDO_DOCUMENTACAO,
  CLASSE_TAG_AGUARDANDO_DOCUMENTACAO,
  creditoObraAguardandoDocumentacao,
} from '@/lib/kanban/kanban-card-sla';
import type { PipelineCardDisplay } from '@/lib/kanban/pipeline-cards-types';
import { montarPipelineProgressCardMeta } from '@/lib/kanban/pipeline-progress-utils';
import { PipelineProgressBar } from '@/components/pipeline/PipelineProgressBar';

export type PipelineProgressCardProps = {
  card: PipelineCardDisplay;
  showUnidade?: boolean;
  onHistorico: (card: PipelineCardDisplay) => void;
  className?: string;
};

export function PipelineProgressCard({
  card,
  showUnidade = true,
  onHistorico,
  className,
}: PipelineProgressCardProps) {
  const meta = montarPipelineProgressCardMeta(card);
  const hrefCard = hrefAbrirCardKanban(card.kanban_nome, card.id);

  const aguardandoDoc = creditoObraAguardandoDocumentacao({
    faseSlug: card.fase_slug,
    alvara_url: card.alvara_url,
    docs_terreno_url: card.docs_terreno_url,
  });

  const statusTagClass =
    meta.statusOperacional === 'atrasado'
      ? 'moni-tag-atrasado'
      : meta.statusOperacional === 'vencendo_breve'
        ? 'moni-tag-atencao'
        : meta.statusOperacional === 'sem_movimentacao'
          ? ''
          : 'moni-tag-concluido';

  return (
    <article
      className={className}
      style={{
        border: '0.5px solid var(--moni-border-default)',
        borderRadius: 'var(--moni-radius-lg, 12px)',
        background: 'var(--moni-surface-50, #fff)',
        boxShadow: 'var(--moni-shadow-card, 0 1px 2px rgba(12,38,51,0.04))',
      }}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-mono text-[10px] tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              {meta.cardId}
            </p>
            <h3
              className="text-base font-semibold leading-snug"
              style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}
            >
              {meta.titulo}
            </h3>
            {showUnidade ? (
              <p className="text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
                {meta.unidadeLabel}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {statusTagClass ? (
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${statusTagClass}`}>
                {meta.statusLabel}
              </span>
            ) : (
              <span
                className="rounded-full px-2.5 py-1 text-[10px] font-medium"
                style={{
                  border: '0.5px solid var(--moni-border-default)',
                  background: 'var(--moni-surface-100)',
                  color: 'var(--moni-text-secondary)',
                }}
              >
                {meta.statusLabel}
              </span>
            )}
            {aguardandoDoc ? (
              <span className={`text-[10px] ${CLASSE_TAG_AGUARDANDO_DOCUMENTACAO}`}>{TAG_AGUARDANDO_DOCUMENTACAO}</span>
            ) : meta.slaLabel && !meta.slaPausado ? (
              <span className={`text-[10px] ${meta.slaClasse}`}>{meta.slaLabel}</span>
            ) : null}
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <dt style={{ color: 'var(--moni-text-tertiary)' }}>Funil atual</dt>
            <dd className="mt-0.5 font-medium" style={{ color: 'var(--moni-text-primary)' }}>
              {meta.funilAtual}
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--moni-text-tertiary)' }}>Fase atual</dt>
            <dd className="mt-0.5 font-medium" style={{ color: 'var(--moni-text-primary)' }}>
              {meta.faseAtual}
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--moni-text-tertiary)' }}>Entrada na fase</dt>
            <dd className="mt-0.5" style={{ color: 'var(--moni-text-secondary)' }}>
              {meta.dataEntradaFase ?? '—'}
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--moni-text-tertiary)' }}>Dias na fase</dt>
            <dd className="mt-0.5 tabular-nums" style={{ color: 'var(--moni-text-secondary)' }}>
              {meta.diasNaFase}
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--moni-text-tertiary)' }}>SLA da fase</dt>
            <dd className="mt-0.5">
              {aguardandoDoc ? (
                <span className={CLASSE_TAG_AGUARDANDO_DOCUMENTACAO}>{TAG_AGUARDANDO_DOCUMENTACAO}</span>
              ) : meta.slaLabel ? (
                <span className={meta.slaClasse}>{meta.slaLabel}</span>
              ) : (
                <span style={{ color: 'var(--moni-text-secondary)' }}>—</span>
              )}
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--moni-text-tertiary)' }}>Status</dt>
            <dd className="mt-0.5 font-medium" style={{ color: 'var(--moni-text-primary)' }}>
              {meta.statusLabel}
            </dd>
          </div>
        </dl>

        <PipelineProgressBar
          progresso={meta.progresso}
          statusOperacional={meta.statusOperacional}
          faseAtualNome={meta.faseAtual}
        />

        <footer className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => onHistorico(card)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition hover:opacity-90"
            style={{
              border: '0.5px solid var(--moni-border-default)',
              color: 'var(--moni-text-primary)',
              background: 'var(--moni-surface-50)',
              fontFamily: 'var(--moni-font-sans)',
            }}
          >
            <History className="h-4 w-4" aria-hidden />
            Histórico
          </button>
          <Link
            href={hrefCard}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
          >
            Abrir card
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
        </footer>
      </div>
    </article>
  );
}
