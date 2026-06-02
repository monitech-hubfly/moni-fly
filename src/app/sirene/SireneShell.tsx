'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    const dest = pathname?.startsWith('/portal-frank') ? '/portal-frank/login' : '/login';
    router.push(dest);
    router.refresh();
  }
  const tabs = [...TABS_BASE];

  const tabAtivo =
    pathname === '/sirene'
      ? '/sirene'
      : pathname?.startsWith('/sirene/chamados')
        ? '/sirene/chamados'
        : pathname?.startsWith('/sirene/pericias')
          ? '/sirene/pericias'
          : pathname?.startsWith('/sirene/monitor')
            ? '/sirene/monitor'
            : pathname?.startsWith('/sirene/kanban')
              ? '/sirene'
              : '/sirene';

  return (
    <div className="min-h-screen" style={{ background: 'var(--moni-surface-50)' }}>
      <header
        className="border-b"
        style={{
          background: 'var(--moni-surface-0)',
          borderBottomColor: 'var(--moni-border-default)',
        }}
      >
        <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-[color:var(--moni-text-tertiary)] transition hover:text-[color:var(--moni-text-secondary)]"
            >
              ← Portal
            </Link>
            <span className="text-[color:var(--moni-text-tertiary)]">/</span>
            <Link href="/sirene" className="flex items-center gap-2 hover:opacity-90">
              <span className="text-2xl" aria-hidden>
                🔥
              </span>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-[color:var(--moni-text-primary)]">
                  Sirene — Central de Chamados
                </h1>
                <p className="text-xs text-[color:var(--moni-text-tertiary)]">Bombeiro &amp; Perícia</p>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[color:var(--moni-text-tertiary)]">Olá, {userName}</span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="rounded-lg border border-[color:var(--moni-border-default)] bg-[var(--moni-surface-0)] px-3 py-1.5 text-xs font-medium text-[color:var(--moni-text-secondary)] hover:bg-[var(--moni-surface-100)]"
            >
              Sair
            </button>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--moni-surface-100)] text-[color:var(--moni-text-secondary)]">
              {userName.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      <nav
        className="border-b"
        style={{
          background: 'var(--moni-surface-0)',
          borderBottomColor: 'var(--moni-border-default)',
        }}
      >
        <div className="mx-auto flex w-full max-w-[1600px] gap-0 px-6">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`border-b-2 px-4 py-3 text-sm font-medium ${
                tabAtivo === t.href
                  ? 'border-red-500 text-[color:var(--moni-text-primary)]'
                  : 'border-transparent text-[color:var(--moni-text-tertiary)] hover:text-[color:var(--moni-text-primary)]'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </nav>

      {children}
    </div>
  );
}
