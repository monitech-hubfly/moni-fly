'use client';

import { Download } from 'lucide-react';
import { redeBtnGhost } from './rede-ui';

type Props = {
  disabled?: boolean;
  filenamePrefix: string;
  gerarCsv: () => string;
  label?: string;
};

export function ExportarEntidadeCSVButton({
  disabled = false,
  filenamePrefix,
  gerarCsv,
  label = 'Exportar tabela (CSV)',
}: Props) {
  const exportar = () => {
    const csv = gerarCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" onClick={exportar} disabled={disabled} className={redeBtnGhost}>
      <Download className="h-4 w-4" />
      {label}
    </button>
  );
}
