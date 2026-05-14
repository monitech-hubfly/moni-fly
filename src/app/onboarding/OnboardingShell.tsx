'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ONBOARDING_NAV_GROUPS } from '@/lib/onboarding-nav';

type Props = {
  userName: string;
  children: React.ReactNode;
};

export function OnboardingShell({ userName, children }: Props) {
  const pathname = usePathname() ?? '/onboarding/introducao';
  const router = useRouter();
  const section = pathname.replace(/^\/onboarding\/?/, '').split('/')[0] || 'introducao';

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    const dest = pathname?.startsWith('/portal-frank') ? '/portal-frank/login' : '/login';
    router.push(dest);
    router.refresh();
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-stone-100">
      <header className="shrink-0 border-b border-stone-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              className="shrink-0 text-xs font-medium text-stone-500 transition hover:text-moni-primary md:text-sm"
            >
              ← Hub Fly
            </Link>
            <span className="text-stone-300">/</span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-moni-primary md:text-lg">Onboarding Moní</h1>
              <p className="hidden text-[11px] text-stone-500 sm:block">Portal do franqueado e da equipa</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <span className="hidden max-w-[140px] truncate text-xs text-stone-500 md:inline md:max-w-[200px]">
              Olá, {userName}
            </span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[11px] font-medium text-stone-600 hover:bg-stone-50 md:px-3 md:text-xs"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <nav className="shrink-0 border-b border-stone-200 bg-white shadow-sm">
        <div className="flex items-stretch gap-0 overflow-x-auto px-2 py-1 md:px-4">
          {ONBOARDING_NAV_GROUPS.map((group, gi) => (
            <Fragment key={gi}>
              {group.title && (
                <div
                  className="flex shrink-0 items-center border-l border-stone-200 px-2 first:border-l-0 first:pl-1"
                  role="presentation"
                >
                  <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                    {group.title}
                  </span>
                </div>
              )}
              {group.items.map((item) => {
                const href = `/onboarding/${item.slug}`;
                const active = section === item.slug;
                return (
                  <Link
                    key={item.slug}
                    href={href}
                    className={`shrink-0 whitespace-nowrap border-b-2 px-2.5 py-2.5 text-xs font-medium transition md:px-3 md:text-sm ${
                      active
                        ? 'border-moni-primary text-moni-primary'
                        : 'border-transparent text-stone-500 hover:text-moni-primary'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </Fragment>
          ))}
        </div>
      </nav>

      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
