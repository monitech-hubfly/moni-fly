'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/carometro/pre-bone-day',        label: 'Plano Boné Day' },
  { href: '/carometro/dashboard-geral',     label: 'Dashboard Geral' },
  { href: '/carometro/fechamento-bone-day', label: 'Fechamento Boné Day' },
] as const;

export function BoneDayTabs() {
  const pathname = usePathname();
  return (
    <div className="border-b border-gray-200 bg-white sticky top-0 z-20">
      <div className="flex items-center gap-0 px-2">
        {TABS.map(t => (
          <Link key={t.href} href={t.href}
            className={`border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              pathname === t.href
                ? 'border-blue-500 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}>
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
