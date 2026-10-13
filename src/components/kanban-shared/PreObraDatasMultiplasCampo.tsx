'use client';

import { useEffect, useState } from 'react';
import { datasPreObraFromValor, valorChecklistDatasPreObra } from '@/lib/kanban/preobra-checklist-sync';

type Props = {
  label: string;
  valor: string;
  botao: string;
  disabled?: boolean;
  onCommit: (json: string) => void;
};

const inputCls =
  'mt-0.5 w-full rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-[var(--moni-border-default)] bg-white px-2 py-1 text-xs font-[family-name:var(--moni-font-sans)] text-[var(--moni-text-primary)] min-h-[44px] sm:min-h-0';

export function PreObraDatasMultiplasCampo({ label, valor, botao, disabled, onCommit }: Props) {
  const [rows, setRows] = useState<string[]>(() => {
    const filled = datasPreObraFromValor(valor);
    return filled.length > 0 ? filled : [''];
  });

  useEffect(() => {
    const filled = datasPreObraFromValor(valor);
    setRows(filled.length > 0 ? filled : ['']);
  }, [valor]);

  function commit(next: string[]) {
    const visiveis = next.length > 0 ? next : [''];
    setRows(visiveis);
    onCommit(valorChecklistDatasPreObra(visiveis));
  }

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
        {label}
      </span>
      {rows.map((data, index) => (
        <div key={`${index}-${rows.length}`} className="flex items-center gap-1.5">
          <input
            type="date"
            value={data}
            disabled={disabled}
            className={inputCls}
            onChange={(e) => {
              const next = rows.slice();
              next[index] = e.target.value;
              commit(next);
            }}
          />
          {rows.length > 1 ? (
            <button
              type="button"
              disabled={disabled}
              className="shrink-0 rounded-[var(--moni-radius-md)] border-[length:var(--moni-border-width)] border-[var(--moni-border-default)] px-2 text-[11px] text-[var(--moni-text-secondary)] min-h-[44px] sm:min-h-8"
              style={{ fontFamily: 'var(--moni-font-sans)' }}
              onClick={() => commit(rows.filter((_, i) => i !== index))}
            >
              Remover
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        disabled={disabled}
        className="text-[11px] font-medium underline-offset-2 hover:underline disabled:opacity-50 min-h-[44px] sm:min-h-0"
        style={{ color: 'var(--moni-navy-800)', fontFamily: 'var(--moni-font-sans)' }}
        onClick={() => setRows((atual) => [...atual, ''])}
      >
        {botao}
      </button>
    </div>
  );
}
