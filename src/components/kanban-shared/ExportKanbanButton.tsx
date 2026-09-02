'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportKanbanCardsForTable } from '@/lib/actions/kanban-export';
import { linhasParaCsv } from '@/lib/csv-tabela-rede';
import { ExportKanbanModal, type KanbanExportFormat } from './ExportKanbanModal';
import type { KanbanCardBrief, KanbanFase, KanbanNomeDisplay } from './types';

type Props = {
  kanbanId: string;
  kanbanNome?: KanbanNomeDisplay | string;
  fases: KanbanFase[];
  cards: KanbanCardBrief[];
  disabled?: boolean;
};

function slugArquivo(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function baixarCsv(headers: readonly string[], rows: Record<string, string>[], filename: string) {
  const csv = linhasParaCsv(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function baixarXlsx(headers: readonly string[], rows: Record<string, string>[], filename: string) {
  const aoa: string[][] = [headers.slice(), ...rows.map((row) => headers.map((h) => row[h] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cards');
  XLSX.writeFile(wb, filename);
}

export function ExportKanbanButton({
  kanbanId,
  kanbanNome = 'Kanban',
  fases,
  cards,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardCount = cards.length;
  const nomeSlug = useMemo(() => slugArquivo(String(kanbanNome)), [kanbanNome]);
  const dataHoje = new Date().toISOString().slice(0, 10);

  const handleExport = async (selectedFieldIds: string[], format: KanbanExportFormat) => {
    setExporting(true);
    setError(null);
    try {
      const res = await exportKanbanCardsForTable({
        kanbanId,
        kanbanNome: String(kanbanNome),
        fases,
        cards,
        selectedFieldIds,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const ext = format === 'xlsx' ? 'xlsx' : 'csv';
      const filename = `${nomeSlug}-cards-${dataHoje}.${ext}`;
      if (format === 'csv') {
        baixarCsv(res.headers, res.rows, filename);
      } else {
        baixarXlsx(res.headers, res.rows, filename);
      }
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao exportar.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        disabled={disabled || cardCount === 0}
        className="moni-kanban-fpill inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
        title={cardCount === 0 ? 'Nenhum card visível para exportar' : 'Exportar cards visíveis como tabela'}
      >
        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Exportar
      </button>

      <ExportKanbanModal
        open={open}
        onClose={() => {
          if (!exporting) setOpen(false);
        }}
        kanbanId={kanbanId}
        kanbanNome={String(kanbanNome)}
        fases={fases}
        cards={cards}
        cardCount={cardCount}
        exporting={exporting}
        error={error}
        onExport={handleExport}
      />
    </>
  );
}
