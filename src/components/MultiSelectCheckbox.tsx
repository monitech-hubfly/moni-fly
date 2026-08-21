'use client';

import { useMemo, useRef, useState } from 'react';

export type MultiSelectCheckboxVariant = 'times' | 'responsaveis';

export type MultiSelectCheckboxOption = { id: string; label: string };

const VARIANT_STYLES: Record<
  MultiSelectCheckboxVariant,
  { pillBg: string; pillText: string; checkboxChecked: string }
> = {
  times: { pillBg: '#EEEDFE', pillText: '#3C3489', checkboxChecked: '#534AB7' },
  responsaveis: { pillBg: '#EAF3DE', pillText: '#3B6D11', checkboxChecked: '#3B6D11' },
};

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

type Props = {
  options: MultiSelectCheckboxOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  placeholder: string;
  variant: MultiSelectCheckboxVariant;
  listClassName?: string;
  /** Placeholder do campo de busca; padrão: "Pesquisar…" */
  searchPlaceholder?: string;
  /** Lista oculta até focar na busca (formulários compactos). */
  expandOnFocus?: boolean;
};

export function MultiSelectCheckbox({
  options,
  selectedIds,
  onToggle,
  placeholder,
  variant,
  listClassName = 'max-h-24',
  searchPlaceholder = 'Pesquisar…',
  expandOnFocus = false,
}: Props) {
  const styles = VARIANT_STYLES[variant];
  const selectedSet = new Set(selectedIds);
  const selectedPills = options.filter((o) => selectedSet.has(o.id));
  const [searchQuery, setSearchQuery] = useState('');
  const [listExpanded, setListExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    if (!q) return options;
    return options.filter((o) => normalizeSearchText(o.label).includes(q));
  }, [options, searchQuery]);

  function handleToggle(id: string) {
    onToggle(id);
    setSearchQuery('');
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  const showList = !expandOnFocus || listExpanded;

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-md"
      style={{ border: '0.5px solid var(--moni-border-default)' }}
    >
      <div
        className={`flex min-h-[1.5rem] flex-wrap items-center gap-1 px-2 py-1 ${selectedPills.length === 0 ? 'text-[10px] text-stone-400' : ''}`}
      >
        {selectedPills.length === 0 ? (
          <span className="leading-snug">{placeholder}</span>
        ) : (
          selectedPills.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-medium leading-tight"
              style={{ backgroundColor: styles.pillBg, color: styles.pillText }}
            >
              {o.label}
              <button
                type="button"
                onClick={() => handleToggle(o.id)}
                className="text-[10px] leading-none opacity-70 hover:opacity-100"
                style={{ color: styles.pillText }}
                aria-label={`Remover ${o.label}`}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <div
        className="border-t border-[color:var(--moni-border-default)] px-2 py-1"
        style={{ background: 'var(--moni-surface-0)' }}
      >
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setListExpanded(true)}
          onBlur={() => {
            window.setTimeout(() => {
              if (!containerRef.current?.contains(document.activeElement)) {
                setListExpanded(false);
              }
            }, 120);
          }}
          placeholder={searchPlaceholder}
          className="w-full border-0 bg-transparent p-0 text-[10px] leading-snug text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-0"
          aria-label={searchPlaceholder}
          autoComplete="off"
        />
      </div>
      {showList ? (
      <ul
        className={`overflow-y-auto border-t border-[color:var(--moni-border-default)] ${listClassName}`}
        role="listbox"
        aria-multiselectable="true"
      >
        {filteredOptions.length === 0 ? (
          <li className="px-2 py-1.5 text-[10px] text-stone-500">Nenhum resultado.</li>
        ) : (
          filteredOptions.map((o) => {
            const checked = selectedSet.has(o.id);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => handleToggle(o.id)}
                  onMouseDown={(e) => {
                    if (expandOnFocus) e.preventDefault();
                  }}
                  className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[10px] leading-snug text-stone-800 hover:bg-stone-50"
                >
                  <span
                    className="flex h-3 w-3 shrink-0 items-center justify-center rounded border"
                    style={{
                      borderColor: checked ? styles.checkboxChecked : 'var(--moni-border-default)',
                      backgroundColor: checked ? styles.checkboxChecked : 'transparent',
                    }}
                    aria-hidden
                  >
                    {checked ? (
                      <svg
                        viewBox="0 0 12 12"
                        className="h-2 w-2 text-white"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    ) : null}
                  </span>
                  <span>{o.label}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
      ) : null}
    </div>
  );
}
