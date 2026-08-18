'use client';

import Link from 'next/link';
import { UserPlus } from 'lucide-react';

type Props = {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
};

const cls =
  'inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-stone-200 bg-transparent px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-100/80 disabled:opacity-50';

export function NovoRegistroToolbarButton({ label, onClick, href, disabled }: Props) {
  if (href) {
    return (
      <Link href={href} className={cls} aria-disabled={disabled}>
        <UserPlus className="h-4 w-4" />
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      <UserPlus className="h-4 w-4" />
      {label}
    </button>
  );
}
