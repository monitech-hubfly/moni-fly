'use client';

import type { RedeFranqueadoRowDb } from '@/lib/rede-franqueados';
import { REDE_FRANQUEADOS_DB_KEYS } from '@/lib/rede-franqueados';
import { Download } from 'lucide-react';
import { redeBtnGhost } from './rede-ui';

function escapeCsvCell(val: string | null | undefined): string {
  const s = (val ?? '').toString().trim();
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function ExportarRedeCSVButton({ rows }: { rows: RedeFranqueadoRowDb[] }) {
  const exportar = () => {
    const header = REDE_FRANQUEADOS_DB_KEYS.join(',');
    const lines = rows.map((r) =>
      REDE_FRANQUEADOS_DB_KEYS.map((k) => escapeCsvCell(r[k] ?? '')).join(','),
    );
    const csv = [header, ...lines].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rede-franqueados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={exportar}
      disabled={rows.length === 0}
      className={redeBtnGhost}
    >
      <Download className="h-4 w-4" />
      Exportar tabela (CSV)
    </button>
  );
}
