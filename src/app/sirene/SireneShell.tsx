'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS_BASE = [
  { href: '/sirene', label: 'Dashboard' },
  { href: '/sirene/chamados', label: 'Chamados' },
  { href: '/sirene/pericias', label: 'Perícias (Caneta Verde)' },
] as const;

type Props = {
  userName: string;
  isBombeiro?: boolean;
  children: React.ReactNode;
};

export function SireneShell({ userName, isBombeiro, children }: Props) {
  const pathname = usePathname();
  /** Bombeiro: Dashboard | Chamados | Perícias | Monitor */
  const tabs = isBombeiro
    ? [...TABS_BASE, { href: '/sirene/monitor', label: 'Monitor dos times' } as const]
    : [...TABS_BASE];

  const isDetailPage = /^\/sirene\/[0-9]+$/.test(pathname ?? '');
  const tabAtivo =
    pathname === '/sirene'
      ? '/sirene'
      : pathname?.startsWith('/sirene/interacoes') || pathname?.startsWith('/sirene/chamados')
        ? '/sirene/interacoes'
        : pathname?.startsWith('/sirene/pericias')
          ? '/sirene/pericias'
          : pathname?.startsWith('/sirene/monitor')
            ? '/sirene/monitor'
            : pathname?.startsWith('/sirene/kanban')
              ? '/sirene'
              : '/sirene';

  return (
    <div className="min-h-screen bg-stone-900">
      <header className="border-b border-stone-700 bg-stone-800/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-stone-400 transition hover:text-stone-200">
              ← Portal
            </Link>
            <span className="text-stone-600">/</span>
            <Link href="/sirene" className="flex items-center gap-2 hover:opacity-90">
              <span className="text-2xl" aria-hidden>
                🔥
              </span>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Sirene — Central de Chamados
                </h1>
                <p className="text-xs text-stone-400">Bombeiro &amp; Perícia</p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-stone-400">Olá, {userName}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-600 text-stone-200">
              {userName.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      {!isDetailPage && (
        <nav className="border-b border-stone-700 bg-stone-800/60">
          <div className="mx-auto flex max-w-7xl gap-0 px-4">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`border-b-2 px-4 py-3 text-sm font-medium ${
                  tabAtivo === t.href
                    ? 'border-red-500 text-white'
                    : 'border-transparent text-stone-400 hover:text-stone-200'
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </nav>
      )}

      {children}
    </div>
  );
}
