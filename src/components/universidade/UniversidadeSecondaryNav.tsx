'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, HelpCircle } from 'lucide-react';

const ABAS = [
  { href: '/universidade', label: 'Tabuleiro', icon: LayoutDashboard, match: (p: string) => p === '/universidade' || p === '/universidade/tabuleiro' || p.startsWith('/universidade/jornada') },
  { href: '/universidade/faq', label: 'FAQ', icon: HelpCircle, match: (p: string) => p === '/universidade/faq' || p.startsWith('/universidade/faq/') },
] as const;

/** Navegação secundária da Universidade: Tabuleiro | FAQ. Áreas independentes. */
export function UniversidadeSecondaryNav() {
  const pathname = usePathname() ?? '';
  return (
    <div className="mx-auto max-w-6xl px-4">
      <nav className="flex flex-wrap gap-1 border-b border-stone-200" aria-label="Seções da Universidade">
        {ABAS.map((aba) => {
          const ativo = aba.match(pathname);
          const Icon = aba.icon;
          return (
            <Link
              key={aba.href}
              href={aba.href}
              className={`relative -mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                ativo
                  ? 'border-green-600 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
              aria-current={ativo ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {aba.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
