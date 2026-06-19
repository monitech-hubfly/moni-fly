'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import {
  TAG_AGUARDANDO_DOCUMENTACAO,
  CLASSE_TAG_AGUARDANDO_DOCUMENTACAO,
  creditoObraAguardandoDocumentacao,
  indicadorBolinhaSlaKanban,
} from '@/lib/kanban/kanban-card-sla';
import { KanbanPrazoBolinha } from '@/components/kanban-shared/KanbanCardPrazoIndicadores';
import type { PipelineCardDisplay } from '@/lib/kanban/pipeline-cards-types';
import {
  loadPipelineCardDrawerData,
  labelUnidadePipelineDrawer,
  type PipelineCardDrawerData,
} from '@/lib/kanban/load-pipeline-card-drawer';
import {
  formatDataEntradaFaseAtualKanbanCard,
  PIPELINE_READONLY_NOTA,
} from '@/lib/kanban/pipeline-card-readonly';
import { formatChamadoNumero } from '@/lib/kanban/chamado-numero';
import { formatDataHoraHistorico } from '@/components/kanban-shared/kanban-card-modal-helpers';

type Props = {
  card: PipelineCardDisplay | null;
  onClose: () => void;
};

function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  return formatDataHoraHistorico(iso) || formatIsoDateOnlyPtBr(iso) || '—';
}

function statusTagClass(statusLabel: string): string {
  if (statusLabel === 'Atrasado') return 'moni-tag-atrasado';
  if (statusLabel === 'Vencendo em breve') return 'moni-tag-atencao';
  if (statusLabel === 'Em dia') return 'moni-tag-concluido';
  return '';
}

export function PipelineCardMiniDrawer({ card, onClose }: Props) {
  const [entered, setEntered] = useState(false);
  const [drawerData, setDrawerData] = useState<PipelineCardDrawerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!card) {
      setEntered(false);
      return;
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(id);
  }, [card]);

  useEffect(() => {
    if (!card) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [card]);

  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [card, onClose]);

  useEffect(() => {
    if (!card) {
      setDrawerData(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const supabase = createClient();
        const data = await loadPipelineCardDrawerData(supabase, card);
        if (!cancelled) setDrawerData(data);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Erro ao carregar histórico.');
          setDrawerData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [card]);

  if (!card) return null;

  const aguardandoDoc = creditoObraAguardandoDocumentacao({
    faseSlug: card.fase_slug,
    alvara_url: card.alvara_url,
    docs_terreno_url: card.docs_terreno_url,
  });
  const slaBolinha = !aguardandoDoc ? indicadorBolinhaSlaKanban(card.sla) : null;

  const hrefCard = hrefAbrirCardKanban(card.kanban_nome, card.id);
  const statusLabel = drawerData?.statusLabel ?? '—';
  const tagClass = statusTagClass(statusLabel);

  return (
    <div
      className={`fixed inset-0 z-[120] transition-opacity duration-200 ${
        entered ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      aria-hidden={!entered}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-lg flex-col bg-white transition-transform duration-200 ${
          entered ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ borderLeft: '0.5px solid var(--moni-border-default)' }}
        role="dialog"
        aria-labelledby="pipeline-card-drawer-title"
      >
        <header
          className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: 'var(--moni-border-default)' }}
        >
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-wide" style={{ color: 'var(--moni-text-tertiary)' }}>
              {card.id}
            </p>
            <h2
              id="pipeline-card-drawer-title"
              className="mt-1 font-semibold leading-snug"
              style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-display)' }}
            >
              {card.titulo}
            </h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--moni-text-secondary)' }}>
              {labelUnidadePipelineDrawer(card)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-md p-2 hover:bg-stone-100"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" style={{ color: 'var(--moni-text-secondary)' }} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
            <div>
              <dt style={{ color: 'var(--moni-text-tertiary)' }}>Funil atual</dt>
              <dd className="mt-0.5 font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                {card.kanban_nome}
              </dd>
            </div>
            <div>
              <dt style={{ color: 'var(--moni-text-tertiary)' }}>Fase atual</dt>
              <dd className="mt-0.5 font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                {card.fase_nome}
              </dd>
            </div>
            <div>
              <dt style={{ color: 'var(--moni-text-tertiary)' }}>Entrada na fase</dt>
              <dd className="mt-0.5" style={{ color: 'var(--moni-text-secondary)' }}>
                {formatDataEntradaFaseAtualKanbanCard(card) ?? '—'}
              </dd>
            </div>
            <div>
              <dt style={{ color: 'var(--moni-text-tertiary)' }}>Status atual</dt>
              <dd className="mt-0.5">
                {tagClass ? (
                  <span className={`text-[10px] ${tagClass}`}>{statusLabel}</span>
                ) : (
                  <span style={{ color: 'var(--moni-text-secondary)' }}>{statusLabel}</span>
                )}
              </dd>
            </div>
            <div>
              <dt style={{ color: 'var(--moni-text-tertiary)' }}>SLA da fase</dt>
              <dd className="mt-0.5">
                {aguardandoDoc ? (
                  <span className={CLASSE_TAG_AGUARDANDO_DOCUMENTACAO}>{TAG_AGUARDANDO_DOCUMENTACAO}</span>
                ) : slaBolinha ? (
                  <KanbanPrazoBolinha
                    {...slaBolinha}
                    sigla={slaBolinha.variante === 'atencao' ? 'SLA' : undefined}
                  />
                ) : card.sla.status === 'ok' && card.sla.label ? (
                  <span style={{ color: 'var(--moni-text-secondary)' }}>{card.sla.label}</span>
                ) : (
                  <span style={{ color: 'var(--moni-text-secondary)' }}>—</span>
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex items-center justify-between gap-2">
            <h3
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--moni-text-tertiary)' }}
            >
              Histórico de fases
            </h3>
            {drawerData?.historicoParcial ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  border: '0.5px solid var(--moni-border-default)',
                  color: 'var(--moni-text-secondary)',
                  background: 'var(--moni-surface-100)',
                }}
              >
                Histórico parcial
              </span>
            ) : null}
          </div>

          {loading ? (
            <p className="mt-3 text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
              Carregando histórico…
            </p>
          ) : loadError ? (
            <p className="mt-3 text-sm text-red-700">{loadError}</p>
          ) : !drawerData?.fasesPercorridas.length ? (
            <p className="mt-3 text-sm" style={{ color: 'var(--moni-text-tertiary)' }}>
              Nenhuma fase registrada no histórico disponível.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {drawerData.fasesPercorridas.map((fase) => (
                <li
                  key={fase.faseId}
                  className="rounded-xl px-3 py-3"
                  style={{
                    border: '0.5px solid var(--moni-border-default)',
                    background: 'var(--moni-surface-50, #fafaf9)',
                    outline: fase.faseAtual ? '1px solid var(--moni-navy-800)' : undefined,
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                      {fase.faseNome}
                      {fase.faseAtual ? (
                        <span className="ml-2 text-[10px] font-normal" style={{ color: 'var(--moni-text-tertiary)' }}>
                          (atual)
                        </span>
                      ) : null}
                    </p>
                    {fase.atrasado ? (
                      <span className="moni-tag-atrasado text-[10px]">Atrasado</span>
                    ) : fase.slaClasse ? (
                      <span className={`text-[10px] ${fase.slaClasse}`}>{fase.slaLabel}</span>
                    ) : (
                      <span className="text-[10px]" style={{ color: 'var(--moni-text-tertiary)' }}>
                        {fase.slaLabel}
                      </span>
                    )}
                  </div>

                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                    <div>
                      <dt style={{ color: 'var(--moni-text-tertiary)' }}>Entrada</dt>
                      <dd style={{ color: 'var(--moni-text-secondary)' }}>{fmtDataHora(fase.entrouEm)}</dd>
                    </div>
                    <div>
                      <dt style={{ color: 'var(--moni-text-tertiary)' }}>Saída</dt>
                      <dd style={{ color: 'var(--moni-text-secondary)' }}>
                        {fase.saiuEm ? fmtDataHora(fase.saiuEm) : fase.faseAtual ? 'Em andamento' : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt style={{ color: 'var(--moni-text-tertiary)' }}>Dias na fase</dt>
                      <dd className="tabular-nums" style={{ color: 'var(--moni-text-secondary)' }}>
                        {fase.diasNaFase ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt style={{ color: 'var(--moni-text-tertiary)' }}>SLA</dt>
                      <dd style={{ color: 'var(--moni-text-secondary)' }}>{fase.slaLabel}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}

          {drawerData && drawerData.chamadosSirene.length > 0 ? (
            <>
              <h3
                className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--moni-text-tertiary)' }}
              >
                Chamados Sirene
              </h3>
              <ul className="space-y-2">
                {drawerData.chamadosSirene.map((ch) => (
                  <li key={`${ch.href}-${ch.id}`}>
                    <Link
                      href={ch.href}
                      className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition hover:bg-stone-50"
                      style={{ border: '0.5px solid var(--moni-border-default)' }}
                    >
                      <span className="min-w-0">
                        <span className="font-medium" style={{ color: 'var(--moni-text-primary)' }}>
                          {formatChamadoNumero(ch.numero) || `#${ch.sireneChamadoId ?? ch.id}`} — {ch.titulo}
                        </span>
                        <span className="mt-0.5 block text-[11px] capitalize" style={{ color: 'var(--moni-text-tertiary)' }}>
                          {ch.status.replace(/_/g, ' ')}
                        </span>
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--moni-text-tertiary)' }} />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        <footer
          className="shrink-0 border-t px-5 py-4"
          style={{ borderColor: 'var(--moni-border-default)' }}
        >
          <Link
            href={hrefCard}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white"
            style={{ background: 'var(--moni-navy-800)' }}
          >
            Abrir card
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
        </footer>
      </aside>
    </div>
  );
}
