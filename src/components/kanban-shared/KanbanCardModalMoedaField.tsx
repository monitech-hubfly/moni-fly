'use client';

import { sanitizeMoedaCampoDigitos } from '@/lib/kanban/moeda-campo';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function KanbanCardModalMoedaField({
  value,
  onChange,
  placeholder = '0,00',
  className = 'mt-0.5 flex min-h-[44px] items-center rounded border border-stone-200 bg-white px-2 py-1 sm:min-h-0',
}: Props) {
  return (
    <div className={className}>
      <span className="mr-1.5 shrink-0 text-xs font-medium text-stone-500">R$</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(sanitizeMoedaCampoDigitos(e.target.value))}
        placeholder={placeholder}
        className="w-full border-0 bg-transparent p-0 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none"
      />
    </div>
  );
}
