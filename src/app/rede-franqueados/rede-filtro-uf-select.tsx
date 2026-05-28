'use client';

type Props = {
  id: string;
  value: string;
  ufs: string[];
  onChange: (uf: string) => void;
};

/** Campo de lista (select) para filtrar cidades por UF — não usa pills. */
export function RedeFiltroUfSelect({ id, value, ufs, onChange }: Props) {
  const sorted = [...ufs].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  return (
    <div className="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <label
        htmlFor={id}
        className="shrink-0 text-[11px] font-medium"
        style={{ color: 'var(--moni-text-tertiary)' }}
      >
        Estado
      </label>
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg border py-2 pl-3 pr-9 text-sm shadow-sm"
          style={{
            borderColor: 'var(--moni-border-default)',
            backgroundColor: 'var(--moni-surface-0)',
            color: 'var(--moni-text-secondary)',
          }}
          aria-label="Filtrar por estado (UF)"
        >
          <option value="">Todos os estados</option>
          {sorted.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs"
          style={{ color: 'var(--moni-text-tertiary)' }}
          aria-hidden
        >
          ▾
        </span>
      </div>
    </div>
  );
}
