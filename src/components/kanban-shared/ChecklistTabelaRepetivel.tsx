'use client';

import { useEffect, useMemo, useState } from 'react';

export type ColunaTabelaRepetivel = {
  key: string;
  label: string;
  tipo?: 'texto_curto' | 'texto_longo' | 'numero' | 'anexo' | string;
};

type Props = {
  label: string;
  colunas: ColunaTabelaRepetivel[];
  valorJson: string;
  onChange: (valor: string) => void;
  onBlur?: (valor: string) => void;
  readonly?: boolean;
};

function parseLinhas(valor: string, colunas: ColunaTabelaRepetivel[]): Record<string, string>[] {
  if (!valor?.trim()) return [];
  try {
    const parsed = JSON.parse(valor);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((row) => {
      const out: Record<string, string> = {};
      for (const col of colunas) {
        out[col.key] = String((row as Record<string, unknown>)?.[col.key] ?? '');
      }
      return out;
    });
  } catch {
    return [];
  }
}

function linhaVazia(colunas: ColunaTabelaRepetivel[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of colunas) out[col.key] = '';
  return out;
}

/** Tabela editável multi-coluna; valor persistido como JSON em `kanban_fase_checklist_respostas.valor`. */
export function ChecklistTabelaRepetivel({
  label,
  colunas,
  valorJson,
  onChange,
  onBlur,
  readonly,
}: Props) {
  const linhas = useMemo(() => parseLinhas(valorJson, colunas), [valorJson, colunas]);
  const [draft, setDraft] = useState<Record<string, string>[]>(() =>
    linhas.length > 0 ? linhas : [linhaVazia(colunas)],
  );

  useEffect(() => {
    setDraft(linhas.length > 0 ? linhas : [linhaVazia(colunas)]);
  }, [linhas, colunas]);

  function persist(next: Record<string, string>[]) {
    setDraft(next);
    const limpas = next.filter((row) => Object.values(row).some((v) => String(v).trim()));
    onChange(JSON.stringify(limpas));
  }

  function handleBlur() {
    if (!onBlur) return;
    const limpas = draft.filter((row) => Object.values(row).some((v) => String(v).trim()));
    onBlur(JSON.stringify(limpas));
  }

  function atualizarCelula(idx: number, key: string, value: string) {
    const next = draft.map((row, i) => (i === idx ? { ...row, [key]: value } : row));
    persist(next);
  }

  function adicionarLinha() {
    persist([...draft, linhaVazia(colunas)]);
  }

  function removerLinha(idx: number) {
    const next = draft.filter((_, i) => i !== idx);
    persist(next.length > 0 ? next : [linhaVazia(colunas)]);
  }

  return (
    <div className="space-y-2">
      <p
        className="text-xs font-medium"
        style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        {label}
      </p>
      <div
        className="overflow-x-auto"
        style={{
          border: 'var(--moni-border-width) solid var(--moni-border-default)',
          borderRadius: 'var(--moni-radius-md)',
        }}
      >
        <table className="min-w-full text-xs" style={{ fontFamily: 'var(--moni-font-sans)' }}>
          <thead>
            <tr style={{ background: 'var(--moni-surface-50)' }}>
              {colunas.map((col) => (
                <th
                  key={col.key}
                  className="px-2 py-1.5 text-left font-medium"
                  style={{ color: 'var(--moni-text-secondary)' }}
                >
                  {col.label}
                </th>
              ))}
              {!readonly ? (
                <th className="w-10 px-1 py-1.5" aria-label="Ações" />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {draft.map((row, idx) => (
              <tr
                key={idx}
                style={{ borderTop: 'var(--moni-border-width) solid var(--moni-border-default)' }}
              >
                {colunas.map((col) => (
                  <td key={col.key} className="px-1.5 py-1 align-top">
                    {col.tipo === 'texto_longo' ? (
                      <textarea
                        rows={2}
                        disabled={readonly}
                        value={row[col.key] ?? ''}
                        onChange={(e) => atualizarCelula(idx, col.key, e.target.value)}
                        onBlur={handleBlur}
                        className="w-full min-w-[8rem] px-1.5 py-1 text-xs"
                        style={{
                          border: 'var(--moni-border-width) solid var(--moni-border-default)',
                          borderRadius: 'var(--moni-radius-md)',
                          color: 'var(--moni-text-secondary)',
                          background: 'var(--moni-surface-0, #fff)',
                        }}
                      />
                    ) : (
                      <input
                        type={col.tipo === 'numero' ? 'number' : 'text'}
                        disabled={readonly}
                        value={row[col.key] ?? ''}
                        onChange={(e) => atualizarCelula(idx, col.key, e.target.value)}
                        onBlur={handleBlur}
                        placeholder={col.tipo === 'anexo' ? 'URL do anexo' : undefined}
                        className="w-full min-w-[6rem] px-1.5 py-1 text-xs"
                        style={{
                          border: 'var(--moni-border-width) solid var(--moni-border-default)',
                          borderRadius: 'var(--moni-radius-md)',
                          color: 'var(--moni-text-secondary)',
                          background: 'var(--moni-surface-0, #fff)',
                        }}
                      />
                    )}
                  </td>
                ))}
                {!readonly ? (
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => removerLinha(idx)}
                      className="text-[10px] underline-offset-2 hover:underline"
                      style={{ color: 'var(--moni-text-tertiary)' }}
                      title="Remover linha"
                    >
                      ×
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readonly ? (
        <button
          type="button"
          onClick={adicionarLinha}
          className="text-[11px] font-medium underline-offset-2 hover:underline"
          style={{ color: 'var(--moni-text-secondary)', minHeight: 44 }}
        >
          + Adicionar linha
        </button>
      ) : null}
    </div>
  );
}
