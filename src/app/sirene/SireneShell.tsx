'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
import { marcarNotificacaoLida } from './actions';

const TABS = [
  { href: '/sirene', label: 'Dashboard' },
  { href: '/sirene/chamados', label: 'Chamados' },
  { href: '/sirene/kanban', label: 'Organização (Kanban)' },
  { href: '/sirene/pericias', label: 'Perícias (Caneta Verde)' },
] as const;

type Notif = {
  id: number;
  chamado_id: number | null;
  tipo: string;
  texto: string | null;
  lida: boolean;
  created_at: string;
};

type Props = {
  userName: string;
  totalNaoLidas: number;
  ultimasNotificacoes: Notif[];
  children: React.ReactNode;
};

export function SireneShell({ userName, totalNaoLidas, ultimasNotificacoes, children }: Props) {
  const pathname = usePathname();
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [pending, startTransition] = useTransition();

  const isDetailPage = /^\/sirene\/[0-9]+$/.test(pathname ?? '');
  const tabAtivo =
    pathname === '/sirene'
      ? '/sirene'
      : pathname?.startsWith('/sirene/chamados')
        ? '/sirene/chamados'
        : pathname?.startsWith('/sirene/kanban')
          ? '/sirene/kanban'
          : pathname?.startsWith('/sirene/pericias')
            ? '/sirene/pericias'
            : '/sirene';

  function handleClickNotif(notif: Notif) {
    if (!notif.lida) {
      startTransition(() => {
        marcarNotificacaoLida(notif.id).then(() => setDropdownAberto(false));
      });
    }
    setDropdownAberto(false);
  }

  return (
    <div className="min-h-screen bg-stone-900">
      {/* Header único: Portal, Sirene, usuário + sino */}
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
            {/* Sino de notificações */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownAberto((v) => !v)}
                className="relative rounded-lg p-2 text-stone-400 hover:bg-stone-700 hover:text-white"
                aria-label="Notificações"
              >
                <span className="text-xl">🔔</span>
                {totalNaoLidas > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {totalNaoLidas > 99 ? '99+' : totalNaoLidas}
                  </span>
                )}
              </button>
              {dropdownAberto && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    aria-hidden
                    onClick={() => setDropdownAberto(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-xl border border-stone-600 bg-stone-800 py-2 shadow-xl">
                    <p className="px-3 py-1 text-xs font-semibold uppercase text-stone-500">
                      Notificações
                    </p>
                    {ultimasNotificacoes.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-stone-500">Nenhuma notificação</p>
                    ) : (
                      <ul className="max-h-72 overflow-y-auto">
                        {ultimasNotificacoes.map((n) => (
                          <li key={n.id}>
                            <Link
                              href={n.chamado_id ? `/sirene/${n.chamado_id}` : '/sirene'}
                              onClick={() => handleClickNotif(n)}
                              className={`block px-3 py-2 text-sm hover:bg-stone-700 ${!n.lida ? 'font-medium text-white' : 'text-stone-400'}`}
                            >
                              {n.texto ?? n.tipo}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
            <span className="text-sm text-stone-400">Olá, {userName}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-600 text-stone-200">
              {userName.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      {/* Abas: Dashboard | Chamados | Kanban | Perícias — só se não for página de detalhe */}
      {!isDetailPage && (
        <nav className="border-b border-stone-700 bg-stone-800/60">
          <div className="mx-auto flex max-w-7xl gap-0 px-4">
            {TABS.map((t) => (
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

      {/* Conteúdo da aba ou da página de detalhe */}
      {children}
    </div>
  );
}
