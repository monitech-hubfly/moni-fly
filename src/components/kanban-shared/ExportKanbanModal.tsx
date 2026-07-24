'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import type { KanbanCardBrief, KanbanFase } from './types';
import {
  buildKanbanExportVisibilityContext,
  defaultKanbanExportFieldIds,
  groupKanbanExportFieldsBySection,
  listKanbanExportFieldsVisible,
  type KanbanExportSectionId,
} from '@/lib/kanban/kanban-export-fields';

export type KanbanExportFormat = 'xlsx' | 'csv';

type Props = {
  open: boolean;
  onClose: () => void;
  kanbanId: string;
  kanbanNome: string;
  fases: KanbanFase[];
  cards: KanbanCardBrief[];
  cardCount: number;
  exporting: boolean;
  error: string | null;
  onExport: (selectedFieldIds: string[], format: KanbanExportFormat) => void;
};

const btnPrimaryStyle = {
  background: 'var(--moni-navy-800)',
  borderRadius: 'var(--moni-radius-md)',
  fontFamily: 'var(--moni-font-sans)',
} as const;

const btnGhostStyle = {
  border: 'var(--moni-border-width) solid var(--moni-border-default)',
  borderRadius: 'var(--moni-radius-md)',
  fontFamily: 'var(--moni-font-sans)',
  color: 'var(--moni-text-secondary)',
} as const;

export function ExportKanbanModal({
  open,
  onClose,
  kanbanId,
  kanbanNome,
  fases,
  cards,
  cardCount,
  exporting,
  error,
  onExport,
}: Props) {
  const visibility = useMemo(() => {
    const sample = cards[0];
    if (!sample) {
      return buildKanbanExportVisibilityContext({
        kanbanId,
        kanbanNome,
        card: {
          id: '',
          titulo: '',
          status: '',
          created_at: '',
          fase_id: '',
          franqueado_id: '',
          kanban_id: kanbanId,
        },
        fases,
      });
    }
    return buildKanbanExportVisibilityContext({ kanbanId, kanbanNome, card: sample, fases });
  }, [cards, fases, kanbanId, kanbanNome]);

  const visibleFields = useMemo(() => listKanbanExportFieldsVisible(visibility), [visibility]);
  const grouped = useMemo(() => groupKanbanExportFieldsBySection(visibleFields), [visibleFields]);

  const [selectedIds, setSelectedIds] = useState<string[]>(() => defaultKanbanExportFieldIds(visibility));
  const [format, setFormat] = useState<KanbanExportFormat>('xlsx');

  useEffect(() => {
    if (open) {
      setSelectedIds(defaultKanbanExportFieldIds(visibility));
      setFormat('xlsx');
    }
  }, [open, visibility]);

  if (!open) return null;

  const selectedSet = new Set(selectedIds);

  const toggleField = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSection = (section: KanbanExportSectionId, checked: boolean) => {
    const sectionIds = visibleFields.filter((f) => f.section === section).map((f) => f.id);
    setSelectedIds((prev) => {
      const set = new Set(prev);
      for (const id of sectionIds) {
        if (checked) set.add(id);
        else set.delete(id);
      }
      return [...set];
    });
  };

  const selectAll = () => setSelectedIds(visibleFields.map((f) => f.id));
  const clearAll = () => setSelectedIds([]);

  return (
    <div
      className="fixed inset-0 z-[220] flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: 'rgba(12, 38, 51, 0.45)' }}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !exporting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-kanban-titulo"
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden bg-white shadow-xl sm:max-h-[85vh]"
        style={{
          borderRadius: 'var(--moni-radius-lg)',
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          boxShadow: 'var(--moni-shadow-card)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-4 sm:px-5"
          style={{ borderColor: 'var(--moni-border-default)' }}
        >
          <div className="min-w-0">
            <h2
              id="export-kanban-titulo"
              className="text-base font-semibold sm:text-lg"
              style={{ fontFamily: 'var(--moni-font-display)', color: 'var(--moni-text-primary)' }}
            >
              Exportar tabela
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
              {cardCount} card{cardCount === 1 ? '' : 's'} visíveis · escolha os campos e o formato
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition hover:bg-[var(--moni-surface-100)] disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" style={{ color: 'var(--moni-text-tertiary)' }} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--moni-text-tertiary)' }}>
              Formato
            </span>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm" style={btnGhostStyle}>
              <input
                type="radio"
                name="export-format"
                checked={format === 'xlsx'}
                onChange={() => setFormat('xlsx')}
                disabled={exporting}
              />
              Excel (.xlsx)
            </label>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm" style={btnGhostStyle}>
              <input
                type="radio"
                name="export-format"
                checked={format === 'csv'}
                onChange={() => setFormat('csv')}
                disabled={exporting}
              />
              CSV (Google Sheets)
            </label>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" onClick={selectAll} disabled={exporting} className="min-h-[44px] px-3 py-2 text-xs" style={btnGhostStyle}>
              Selecionar todos
            </button>
            <button type="button" onClick={clearAll} disabled={exporting} className="min-h-[44px] px-3 py-2 text-xs" style={btnGhostStyle}>
              Limpar
            </button>
          </div>

          <div className="space-y-4">
            {grouped.map(({ section, label, fields }) => {
              const sectionIds = fields.map((f) => f.id);
              const allChecked = sectionIds.every((id) => selectedSet.has(id));
              const someChecked = sectionIds.some((id) => selectedSet.has(id));
              return (
                <fieldset
                  key={section}
                  className="rounded-lg p-3"
                  style={{
                    border: 'var(--moni-border-width) solid var(--moni-border-default)',
                    background: 'var(--moni-surface-50)',
                  }}
                >
                  <legend className="px-1 text-xs font-semibold" style={{ color: 'var(--moni-text-primary)' }}>
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = !allChecked && someChecked;
                        }}
                        onChange={(e) => toggleSection(section, e.target.checked)}
                        disabled={exporting}
                      />
                      {label}
                    </label>
                  </legend>
                  <ul className="mt-1 space-y-1 pl-1">
                    {fields.map((f) => (
                      <li key={f.id}>
                        <label
                          className="flex min-h-[44px] cursor-pointer items-center gap-2 py-1 text-sm"
                          style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSet.has(f.id)}
                            onChange={() => toggleField(f.id)}
                            disabled={exporting}
                          />
                          {f.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              );
            })}
          </div>

          {error ? (
            <p className="mt-3 text-sm" role="alert" style={{ color: 'var(--moni-text-secondary)' }}>
              {error}
            </p>
          ) : null}
        </div>

        <div
          className="flex shrink-0 flex-col gap-2 border-t p-4 sm:flex-row sm:justify-end sm:px-5"
          style={{ borderColor: 'var(--moni-border-default)' }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="min-h-[44px] px-4 py-2 text-sm font-medium disabled:opacity-50"
            style={btnGhostStyle}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={exporting || selectedIds.length === 0 || cardCount === 0}
            onClick={() => onExport(selectedIds, format)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            style={btnPrimaryStyle}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
            {exporting ? 'Exportando…' : 'Baixar'}
          </button>
        </div>
      </div>
    </div>
  );
}
