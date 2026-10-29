'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';

export type SearchableSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  value?: string;
  onChange?: (value: string) => void;
  multiple?: boolean;
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  emptyOption?: SearchableSelectOption | null;
  searchPlaceholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
  listMaxHeightClassName?: string;
  size?: 'xs' | 'compact' | 'sm' | 'md';
  /** Rótulo no gatilho quando `value` está vazio (ex.: franqueado da rede sem login). */
  selectedLabelOverride?: string;
  /** Renderiza o menu em portal fixo (evita corte por overflow no painel lateral). */
  menuPortal?: boolean;
  searchClassName?: string;
  optionClassName?: string;
  'aria-label'?: string;
};

function normalizarBusca(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function rotuloSemOpcao(valor: string): string {
  const partes = valor.split('|');
  if (partes.length === 2 && /^[A-Za-z]{2}$/.test(partes[1].trim())) {
    return `${partes[0].trim()} — ${partes[1].trim().toUpperCase()}`;
  }
  return valor;
}

export function SearchableSelect({
  value = '',
  onChange = () => undefined,
  multiple = false,
  values = [],
  onValuesChange,
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
  selectedLabelOverride,
  menuPortal = false,
  searchClassName = '',
  optionClassName = '',
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const todasOpcoes = useMemo(() => {
    const base = emptyOption ? [emptyOption, ...options] : options;
    return base.filter((o, i, arr) => arr.findIndex((x) => x.value === o.value) === i);
  }, [emptyOption, options]);

  const rotulosMultiplos = useMemo(() => {
    if (!multiple) return [];
    return values.map((item) => {
      const hit = todasOpcoes.find((o) => o.value === item);
      const label = hit?.label?.trim() || rotuloSemOpcao(item);
      return { value: item, label };
    });
  }, [multiple, todasOpcoes, values]);

  const rotuloSelecionado = useMemo(() => {
    const vNorm = String(value ?? '').trim().toLowerCase();
    const hit = todasOpcoes.find(
      (o) => o.value === value || (vNorm && o.value.trim().toLowerCase() === vNorm),
    );
    const label = hit?.label?.trim() || '';
    if (label) return label;
    if (selectedLabelOverride?.trim()) return selectedLabelOverride.trim();
    return '';
  }, [todasOpcoes, value, selectedLabelOverride]);

  const opcoesFiltradas = useMemo(() => {
    const q = normalizarBusca(query);
    if (!q) return todasOpcoes;
    return todasOpcoes.filter(
      (o) =>
        normalizarBusca(o.label).includes(q) ||
        normalizarBusca(o.value).includes(q),
    );
  }, [todasOpcoes, query]);

  useLayoutEffect(() => {
    if (!open || !menuPortal) {
      setMenuStyle(null);
      return;
    }
    function atualizarPosicao() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
    atualizarPosicao();
    window.addEventListener('resize', atualizarPosicao);
    window.addEventListener('scroll', atualizarPosicao, true);
    return () => {
      window.removeEventListener('resize', atualizarPosicao);
      window.removeEventListener('scroll', atualizarPosicao, true);
    };
  }, [open, menuPortal]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      const alvo = e.target as Node;
      if (containerRef.current?.contains(alvo)) return;
      if (menuPortal && (e.target as Element).closest?.('[data-searchable-select-menu]')) return;
      setOpen(false);
      setQuery('');
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, menuPortal]);

  function selecionar(novoValor: string) {
    onChange(novoValor);
    setOpen(false);
    setQuery('');
  }

  function alternar(novoValor: string) {
    if (!novoValor) return;
    const proximo = values.includes(novoValor)
      ? values.filter((item) => item !== novoValor)
      : [...values, novoValor];
    onValuesChange?.(proximo);
  }

  const sizeClass =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[10px] rounded'
      : size === 'compact'
        ? 'px-2 py-0.5 text-[11px] leading-tight rounded-md'
      : size === 'md'
        ? 'px-3 py-2 text-sm rounded-lg'
        : 'px-2 py-1 text-xs rounded-lg';

  const searchInputClass =
    size === 'md'
      ? 'px-2 py-1.5 text-sm'
      : size === 'xs'
        ? 'px-1.5 py-0.5 text-[10px]'
        : size === 'compact'
          ? 'px-2 py-0.5 text-[11px]'
        : 'px-2 py-1 text-xs';

  const itemClass =
    size === 'md'
      ? 'px-2 py-2 text-sm'
      : size === 'xs'
        ? 'px-1.5 py-1 text-[10px]'
        : size === 'compact'
          ? 'px-2 py-1 text-[11px] leading-tight'
        : 'px-2 py-1.5 text-xs';

  const triggerBase =
    'flex w-full items-center justify-between gap-2 border bg-white text-left outline-none transition disabled:cursor-not-allowed disabled:opacity-60';

  const menuEl = open && (!menuPortal || menuStyle) ? (
    <div
      data-searchable-select-menu
      className={`overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg ${
        menuPortal ? 'fixed z-[200]' : 'absolute z-50 mt-1 w-full'
      }`}
      style={
        menuPortal && menuStyle
          ? { top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }
          : undefined
      }
      role="listbox"
      aria-multiselectable={multiple || undefined}
    >
      <div className="border-b border-stone-100 p-1.5">
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setOpen(false);
              setQuery('');
              return;
            }
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const termo = query.trim();
            if (!termo) return;
            const escolhida = opcoesFiltradas.find((o) => !o.disabled && o.value !== '');
            if (!escolhida) return;
            if (multiple) alternar(escolhida.value);
            else selecionar(escolhida.value);
          }}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className={`w-full rounded-md border border-stone-200 outline-none focus:border-moni-accent focus:ring-1 focus:ring-moni-accent/30 ${searchInputClass} ${searchClassName}`}
        />
      </div>
      <ul className={`overflow-y-auto py-0.5 ${listMaxHeightClassName}`}>
        {opcoesFiltradas.length === 0 ? (
          <li
            className={`px-2 py-2 text-stone-500 ${size === 'md' ? 'text-sm' : size === 'xs' ? 'text-[10px]' : size === 'compact' ? 'text-[11px]' : 'text-xs'}`}
          >
            Nenhum resultado.
          </li>
        ) : (
          opcoesFiltradas.map((o) => {
            const selecionada = multiple ? values.includes(o.value) : o.value === value;
            return (
              <li key={`${o.value}::${o.label}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selecionada}
                  disabled={o.disabled}
                  onClick={() => {
                    if (o.disabled) return;
                    if (multiple) alternar(o.value);
                    else selecionar(o.value);
                  }}
                  className={`w-full text-left disabled:cursor-not-allowed disabled:opacity-50 ${itemClass} ${optionClassName} ${
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
  ) : null;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {multiple ? (
        <div
          ref={(el) => {
            triggerRef.current = el;
          }}
          id={id}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-disabled={disabled || undefined}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key !== 'Enter' && e.key !== ' ') return;
            if ((e.target as HTMLElement).closest('[data-searchable-chip-remove]')) return;
            e.preventDefault();
            setOpen((v) => !v);
            if (open) setQuery('');
          }}
          onClick={() => {
            if (disabled) return;
            setOpen((v) => !v);
            if (open) setQuery('');
          }}
          className={`${triggerBase} h-auto border-stone-200 text-stone-800 hover:border-stone-300 ${sizeClass} ${
            open ? 'border-moni-accent ring-1 ring-moni-accent/30' : ''
          } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${triggerClassName}`}
        >
          <span className="flex min-w-0 flex-1 flex-wrap gap-1.5 py-0.5">
            {rotulosMultiplos.length === 0 ? (
              <span className="text-stone-500">{placeholder}</span>
            ) : (
              rotulosMultiplos.map((item) => (
                <span
                  key={item.value}
                  title={item.label}
                  className="inline-flex max-w-full items-center gap-1 px-2 py-0.5 text-[13px] leading-5"
                  style={{
                    borderRadius: 'var(--moni-radius-md)',
                    border: 'var(--moni-border-width) solid var(--moni-border-default)',
                    background: 'var(--moni-surface-100)',
                    color: 'var(--moni-text-primary)',
                    fontFamily: 'var(--moni-font-sans)',
                  }}
                >
                  <span className="truncate">{item.label}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    data-searchable-chip-remove
                    aria-label={`Remover ${item.label}`}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onValuesChange?.(values.filter((atual) => atual !== item.value));
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      e.stopPropagation();
                      onValuesChange?.(values.filter((atual) => atual !== item.value));
                    }}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center"
                    style={{ color: 'var(--moni-text-tertiary)' }}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </span>
              ))
            )}
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-stone-400 transition ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </div>
      ) : (
        <button
          ref={(el) => {
            triggerRef.current = el;
          }}
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
      )}

      {menuPortal && typeof document !== 'undefined'
        ? menuEl
          ? createPortal(menuEl, document.body)
          : null
        : menuEl}
    </div>
  );
}
