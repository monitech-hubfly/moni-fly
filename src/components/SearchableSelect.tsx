'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type SearchableSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  emptyOption?: SearchableSelectOption | null;
  searchPlaceholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
  listMaxHeightClassName?: string;
  size?: 'xs' | 'sm' | 'md';
  'aria-label'?: string;
};

function normalizarBusca(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Selecione…',
  emptyOption = { value: '', label: placeholder },
  searchPlaceholder = 'Buscar…',
  disabled = false,
  id,
  className = '',
  triggerClassName = '',
  listMaxHeightClassName = 'max-h-56',
  size = 'sm',
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const todasOpcoes = useMemo(() => {
    const base = emptyOption ? [emptyOption, ...options] : options;
    return base.filter((o, i, arr) => arr.findIndex((x) => x.value === o.value) === i);
  }, [emptyOption, options]);

  const rotuloSelecionado = useMemo(() => {
    const hit = todasOpcoes.find((o) => o.value === value);
    return hit?.label?.trim() || '';
  }, [todasOpcoes, value]);

  const opcoesFiltradas = useMemo(() => {
    const q = normalizarBusca(query);
    if (!q) return todasOpcoes;
    return todasOpcoes.filter(
      (o) =>
        normalizarBusca(o.label).includes(q) ||
        normalizarBusca(o.value).includes(q),
    );
  }, [todasOpcoes, query]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function selecionar(novoValor: string) {
    onChange(novoValor);
    setOpen(false);
    setQuery('');
  }

  const sizeClass =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[10px] rounded'
      : size === 'md'
        ? 'px-3 py-2 text-sm rounded-lg'
        : 'px-2 py-1 text-xs rounded-lg';

  const searchInputClass =
    size === 'md'
      ? 'px-2 py-1.5 text-sm'
      : size === 'xs'
        ? 'px-1.5 py-0.5 text-[10px]'
        : 'px-2 py-1 text-xs';

  const itemClass =
    size === 'md' ? 'px-2 py-2 text-sm' : size === 'xs' ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1.5 text-xs';

  const triggerBase =
    'flex w-full items-center justify-between gap-2 border bg-white text-left outline-none transition disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
          if (open) setQuery('');
        }}
        className={`${triggerBase} border-stone-200 text-stone-800 hover:border-stone-300 ${sizeClass} ${
          open ? 'border-moni-accent ring-1 ring-moni-accent/30' : ''
        } ${triggerClassName}`}
      >
        <span className={`min-w-0 truncate ${rotuloSelecionado ? '' : 'text-stone-500'}`}>
          {rotuloSelecionado || placeholder}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-stone-400 transition ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg"
          role="listbox"
        >
          <div className="border-b border-stone-100 p-1.5">
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className={`w-full rounded-md border border-stone-200 outline-none focus:border-moni-accent focus:ring-1 focus:ring-moni-accent/30 ${searchInputClass}`}
            />
          </div>
          <ul className={`overflow-y-auto py-0.5 ${listMaxHeightClassName}`}>
            {opcoesFiltradas.length === 0 ? (
              <li className={`px-2 py-2 text-stone-500 ${size === 'md' ? 'text-sm' : size === 'xs' ? 'text-[10px]' : 'text-xs'}`}>
                Nenhum resultado.
              </li>
            ) : (
              opcoesFiltradas.map((o) => {
                const selecionada = o.value === value;
                return (
                  <li key={`${o.value}::${o.label}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selecionada}
                      disabled={o.disabled}
                      onClick={() => {
                        if (o.disabled) return;
                        selecionar(o.value);
                      }}
                      className={`w-full text-left disabled:cursor-not-allowed disabled:opacity-50 ${itemClass} ${
                        selecionada
                          ? 'bg-moni-primary/10 font-medium text-moni-dark'
                          : 'text-stone-800 hover:bg-stone-50'
                      }`}
                    >
                      {o.label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
