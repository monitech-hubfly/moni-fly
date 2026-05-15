'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Award, BookOpen, ChevronDown, ChevronRight, LayoutDashboard, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { calcularProgressoGeral, getCasasComProgresso } from '@/lib/universidade/queries';

type Props = {
  userId: string | undefined;
  resolvedRole: string;
  linkClassPrincipal: (active: boolean) => string;
  linkClassSub: (active: boolean) => string;
};

function isUniversidadePath(p: string) {
  return p === '/universidade' || p.startsWith('/universidade/');
}

function isAdminUniversidadePath(p: string) {
  return p === '/admin/universidade' || p.startsWith('/admin/universidade/');
}

export function SidebarUniversidadeLinks({
  userId,
  resolvedRole,
  linkClassPrincipal,
  linkClassSub,
}: Props) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(() => isUniversidadePath(pathname) || isAdminUniversidadePath(pathname));
  const [pct, setPct] = useState<number | null>(null);

  const isFrank = resolvedRole === 'frank';
  const isStaff = resolvedRole === 'admin' || resolvedRole === 'team';
  /** Tabuleiro / Biblioteca / Certificados: apenas franqueado (spec). Gestão: admin e team. */
  const showFranqueadoLinks = isFrank;

  useEffect(() => {
    if (isUniversidadePath(pathname) || isAdminUniversidadePath(pathname)) setOpen(true);
  }, [pathname]);

  useEffect(() => {
    if (!isFrank || !userId) {
      setPct(null);
      return;
    }
    const supabase = createClient();
    void getCasasComProgresso(supabase, userId)
      .then((c) => setPct(calcularProgressoGeral(c)))
      .catch(() => setPct(null));
  }, [isFrank, userId]);

  if (!showFranqueadoLinks && !isStaff) return null;

  const active = isUniversidadePath(pathname) || isAdminUniversidadePath(pathname);
  const macroClass = linkClassPrincipal(active);

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-0.5">
        <button type="button" onClick={() => setOpen(!open)} className={`flex flex-1 items-center gap-2 ${macroClass}`}>
          Universidade
        </button>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded p-1.5 text-stone-500 hover:text-moni-primary"
          aria-expanded={open}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {showFranqueadoLinks && (
            <>
              <Link
                href="/universidade"
                className={`flex items-center justify-between gap-2 ${linkClassSub(pathname === '/universidade' || pathname.startsWith('/universidade/jornada'))}`}
              >
                <span className="flex items-center gap-2">
                  <LayoutDashboard className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  Tabuleiro
                </span>
                {isFrank && pct != null && pct > 0 ? (
                  <span className="shrink-0 text-[10px] font-medium text-stone-500">{pct}%</span>
                ) : null}
              </Link>
              <Link
                href="/universidade/biblioteca"
                className={`flex items-center gap-2 ${linkClassSub(pathname.startsWith('/universidade/biblioteca'))}`}
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                Biblioteca
              </Link>
              <Link
                href="/universidade/certificados"
                className={`flex items-center gap-2 ${linkClassSub(pathname.startsWith('/universidade/certificados'))}`}
              >
                <Award className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                Certificados
              </Link>
            </>
          )}
          {isStaff && (
            <Link
              href="/admin/universidade"
              className={`flex items-center gap-2 ${linkClassSub(isAdminUniversidadePath(pathname))}`}
            >
              <Shield className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
              Gestão
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
