'use client';

import { UserPlus } from 'lucide-react';

type Props = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

export function NovoRegistroToolbarButton({ label, onClick, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-stone-200 bg-transparent px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100/80 disabled:opacity-50"
    >
      <UserPlus className="h-4 w-4" />
      {label}
    </button>
  );
}
