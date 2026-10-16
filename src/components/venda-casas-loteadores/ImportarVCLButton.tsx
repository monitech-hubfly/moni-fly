'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { ImportarVCLModal } from '@/components/venda-casas-loteadores/ImportarVCLModal';
import type { VclSubfunil } from '@/components/venda-casas-loteadores/VendaCasasSubfunilTabs';

export function ImportarVCLButton({
  subfunil,
  basePath,
}: {
  subfunil: VclSubfunil;
  basePath: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 34,
          padding: '0 14px',
          borderRadius: 'var(--moni-radius-md)',
          border: '0.5px solid var(--moni-border-default)',
          background: 'var(--moni-surface-0)',
          color: 'var(--moni-navy-800)',
          fontFamily: 'var(--moni-font-sans)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <Upload className="h-3.5 w-3.5" />
        Importar
      </button>

      {aberto && (
        <ImportarVCLModal
          subfunilAtual={subfunil}
          basePath={basePath}
          onClose={() => setAberto(false)}
        />
      )}
    </>
  );
}
