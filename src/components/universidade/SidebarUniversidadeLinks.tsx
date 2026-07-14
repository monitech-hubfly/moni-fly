'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Award, Check, ChevronDown, ChevronRight, GraduationCap, HelpCircle, LayoutDashboard, LayoutGrid, Lock, Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getCasa0TudoConcluidoServer } from '@/lib/casa0-onboarding-setup';
import { calcularProgressoGeral, getCasasComProgresso } from '@/lib/universidade/queries';
import { CASA1_ID, computeCasa1TudoConcluido } from '@/hooks/useCasa1Progresso';

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

function isFaqPath(p: string) {
  return p === '/universidade/faq' || p.startsWith('/universidade/faq/');
}

function isAdminFaqPath(p: string) {
  return p === '/admin/universidade/faq' || p.startsWith('/admin/universidade/faq/');
}

function isCasa0Path(p: string) {
  return p === '/casa0' || p.startsWith('/casa0/');
}

function isCasa1Path(p: string) {
  return p === '/casa1' || p.startsWith('/casa1/');
}

function isTreinamentoBcaHubPath(p: string) {
  return p === '/treinamento-bca' || p.startsWith('/treinamento-bca/');
}

export function SidebarUniversidadeLinks({
  userId,
  resolvedRole,
  linkClassPrincipal,
  linkClassSub,
}: Props) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(
    () =>
      isUniversidadePath(pathname) ||
      isAdminUniversidadePath(pathname) ||
      isCasa0Path(pathname) ||
      isCasa1Path(pathname) ||
      isTreinamentoBcaHubPath(pathname),
  );
  const [pct, setPct] = useState<number | null>(null);
  const [casa0TudoConcluido, setCasa0TudoConcluido] = useState<boolean | null>(null);
  const [casa1TudoConcluido, setCasa1TudoConcluido] = useState<boolean | null>(null);

  const isFrank = resolvedRole === 'frank';
  const isStaff = resolvedRole === 'admin' || resolvedRole === 'team';
  /** Tabuleiro / Ferramentas (biblioteca) / Certificados: franqueado; mesmo trio + Gestão para admin/team. */
  const showFranqueadoLinks = isFrank;

  useEffect(() => {
    if (
      isUniversidadePath(pathname) ||
      isAdminUniversidadePath(pathname) ||
      isCasa0Path(pathname) ||
      isCasa1Path(pathname) ||
      isTreinamentoBcaHubPath(pathname)
    ) {
      setOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (!isFrank || !userId) {
      setPct(null);
      setCasa0TudoConcluido(null);
      setCasa1TudoConcluido(null);
      return;
    }
    const supabase = createClient();
    void getCasasComProgresso(supabase, userId)
      .then((c) => setPct(calcularProgressoGeral(c)))
      .catch(() => setPct(null));

    void (async () => {
      const c0 = await getCasa0TudoConcluidoServer(supabase, userId);
      const { data: rowsC1, error: errC1 } = await supabase
        .from('franqueado_onboarding_progresso')
        .select('item_id, status, conteudo')
        .eq('user_id', userId)
        .eq('casa_id', CASA1_ID);
      if (errC1) {
        setCasa0TudoConcluido(c0);
        setCasa1TudoConcluido(false);
        return;
      }
      setCasa0TudoConcluido(c0);
      setCasa1TudoConcluido(computeCasa1TudoConcluido(rowsC1 ?? []));
    })();
  }, [isFrank, userId, pathname]);

  if (!showFranqueadoLinks && !isStaff) return null;

  const active =
    isUniversidadePath(pathname) ||
    isAdminUniversidadePath(pathname) ||
    isCasa0Path(pathname) ||
    isCasa1Path(pathname) ||
    isTreinamentoBcaHubPath(pathname);
  const macroClass = linkClassPrincipal(active);

  const ferramentasActive =
    pathname.startsWith('/universidade/ferramentas') ||
    pathname.startsWith('/universidade/biblioteca') ||
    isTreinamentoBcaHubPath(pathname);

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
                href="/casa0"
                className={`flex items-center gap-2 ${linkClassSub(isCasa0Path(pathname))}`}
              >
                <GraduationCap className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                Universidade Moní
              </Link>
              {casa0TudoConcluido === true ? (
                <Link
                  href="/casa1"
                  className={`flex items-center gap-2 ${linkClassSub(isCasa1Path(pathname))}`}
                >
                  <GraduationCap className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">Casa 1 — Ecossistema Moní</span>
                  {casa1TudoConcluido === true ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2.5} aria-hidden />
                  ) : null}
                </Link>
              ) : (
                <span
                  className={`flex cursor-not-allowed items-center gap-2 ${linkClassSub(false)} opacity-50`}
                  title="Conclua a Casa 0 (Universidade Moní) para desbloquear"
                  aria-disabled="true"
                >
                  <Lock className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">Casa 1 — Ecossistema Moní</span>
                </span>
              )}
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
                href="/universidade/ferramentas"
                className={`flex items-center gap-2 ${linkClassSub(ferramentasActive)}`}
              >
                <LayoutGrid className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                Ferramentas
              </Link>
              <Link
                href="/universidade/faq"
                className={`flex items-center gap-2 ${linkClassSub(isFaqPath(pathname))}`}
              >
                <HelpCircle className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                FAQ
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
            <>
              <Link
                href="/universidade"
                className={`flex items-center justify-between gap-2 ${linkClassSub(pathname === '/universidade' || pathname.startsWith('/universidade/jornada'))}`}
              >
                <span className="flex items-center gap-2">
                  <LayoutDashboard className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  Tabuleiro
                </span>
              </Link>
              <Link
                href="/universidade/ferramentas"
                className={`flex items-center gap-2 ${linkClassSub(ferramentasActive)}`}
              >
                <span className="flex items-center gap-2">
                  <LayoutGrid className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  Ferramentas
                </span>
              </Link>
              <Link
                href="/universidade/certificados"
                className={`flex items-center gap-2 ${linkClassSub(pathname.startsWith('/universidade/certificados'))}`}
              >
                <span className="flex items-center gap-2">
                  <Award className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  Certificados
                </span>
              </Link>
              <Link
                href="/admin/universidade"
                className={`flex items-center gap-2 ${linkClassSub(isAdminUniversidadePath(pathname) && !isAdminFaqPath(pathname))}`}
              >
                <Shield className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                Gestão
              </Link>
              <Link
                href="/universidade/faq"
                className={`flex items-center gap-2 ${linkClassSub(isFaqPath(pathname))}`}
              >
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  FAQ
                </span>
              </Link>
              <Link
                href="/admin/universidade/faq"
                className={`flex items-center gap-2 ${linkClassSub(isAdminFaqPath(pathname))}`}
              >
                <HelpCircle className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                Gestão FAQ
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
