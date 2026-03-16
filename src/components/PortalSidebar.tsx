'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Activity, Bell, ChevronDown, ChevronRight, FileCheck, User, Users } from 'lucide-react';

type PortalSidebarProps = {
  user: { id: string; email?: string; full_name?: string | null } | null;
  userRole: string;
};

function getInicialNome(fullName: string | null | undefined): string {
  if (!fullName || !fullName.trim()) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    const ultima = parts[parts.length - 1];
    return (parts[0][0] + (ultima?.[0] ?? '')).toUpperCase().slice(0, 2);
  }
  return (parts[0][0] ?? '?').toUpperCase();
}

export function PortalSidebar({ user, userRole }: PortalSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [stepOneOpen, setStepOneOpen] = useState(true);
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [frankOpen, setFrankOpen] = useState(false);
  const [unidadeOpen, setUnidadeOpen] = useState(false);
  const [processoSeletivoOpen, setProcessoSeletivoOpen] = useState(false);
  const [creditoOpen, setCreditoOpen] = useState(false);
  const [acoplamentoPlOpen, setAcoplamentoPlOpen] = useState(false);
  const [wayzOpen, setWayzOpen] = useState(false);

  const isSirene = pathname.startsWith('/sirene');

  // Nível 0: itens principais da nav (Rede, Jurídico, Sirene, etc.)
  const linkClassPrincipal = (active: boolean) =>
    `block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
      isSirene
        ? active
          ? 'bg-stone-800 text-white'
          : 'text-stone-200 hover:bg-stone-800/80 hover:text-white'
        : active
          ? 'bg-moni-light text-moni-primary'
          : 'text-moni-primary hover:bg-moni-light/50 hover:text-moni-secondary'
    }`;

  // Nível 1: subitens dentro de Steps Viabilidade / outros blocos
  const linkClassNivel1 = (active: boolean) =>
    `block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
      isSirene
        ? active
          ? 'bg-stone-800 text-white border-l-2 border-red-500 -ml-px pl-3'
          : 'text-stone-300 hover:bg-stone-800/70 hover:text-white'
        : active
          ? 'bg-moni-light text-moni-secondary border-l-2 border-moni-accent -ml-px pl-3'
          : 'text-moni-muted hover:bg-stone-100 hover:text-moni-secondary'
    }`;

  // Nível 2: título do bloco expandível (Steps Viabilidade, Crédito, etc.)
  const linkClassTituloBloco = (active: boolean) =>
    `flex-1 min-w-0 rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
      isSirene
        ? active
          ? 'text-white'
          : 'text-stone-200 hover:text-white'
        : active
          ? 'text-moni-primary'
          : 'text-moni-secondary hover:text-moni-primary'
    }`;

  const isConsultorOrAdmin = userRole === 'consultor' || userRole === 'admin';
  const isAdmin = userRole === 'admin';
  const isAdminOrSupervisor = userRole === 'admin' || userRole === 'supervisor';
  const displayName = user?.full_name?.trim() || user?.email || 'Franqueado';
  const inicial = getInicialNome(user?.full_name ?? null);

  useEffect(() => {
    if (pathname.startsWith('/processo-seletivo-candidatos')) setProcessoSeletivoOpen(true);
  }, [pathname]);
  useEffect(() => {
    if (
      pathname.startsWith('/credito-checklist') ||
      pathname.startsWith('/credito-terreno') ||
      pathname.startsWith('/credito-obra') ||
      pathname.startsWith('/credito-abertura-conta')
    )
      setCreditoOpen(true);
  }, [pathname]);
  useEffect(() => {
    if (pathname.startsWith('/acoplamento-pl')) setAcoplamentoPlOpen(true);
  }, [pathname]);
  useEffect(() => {
    if (pathname.startsWith('/pre-obra') || pathname.startsWith('/obra-ways')) setWayzOpen(true);
  }, [pathname]);
  useEffect(() => {
    if (
      pathname === '/perfil' ||
      pathname.startsWith('/due-diligence-frank') ||
      pathname.startsWith('/unidade-franquia') ||
      pathname.startsWith('/due-diligence-empresas')
    ) {
      setPerfilOpen(true);
      if (pathname === '/perfil' || pathname.startsWith('/due-diligence-frank')) setFrankOpen(true);
      if (
        pathname.startsWith('/unidade-franquia') ||
        pathname.startsWith('/due-diligence-empresas')
      )
        setUnidadeOpen(true);
    }
  }, [pathname]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <aside
      className={`flex w-56 shrink-0 flex-col border-r ${
        isSirene ? 'border-stone-800 bg-stone-900 text-stone-100' : 'border-stone-200 bg-white'
      }`}
    >
      <div
        className={`flex h-14 items-center justify-between gap-2 border-b px-4 ${
          isSirene ? 'border-stone-800' : 'border-stone-200'
        }`}
      >
        <Link
          href="/"
          className={`text-lg font-semibold tracking-tight ${
            isSirene
              ? 'text-stone-100 hover:text-white'
              : 'text-moni-primary hover:text-moni-secondary'
          }`}
        >
          Moní
        </Link>
        <Link
          href="/alertas"
          className={`flex items-center justify-center rounded-full p-1.5 ${
            isSirene
              ? 'text-amber-400 hover:bg-stone-800 hover:text-amber-300'
              : 'text-amber-500 hover:bg-amber-50 hover:text-amber-600'
          }`}
          title="Alertas"
          aria-label="Alertas"
        >
          <Bell className="h-5 w-5" />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {isAdmin && (
          <Link
            href="/rede-franqueados"
            className={linkClassPrincipal(pathname.startsWith('/rede-franqueados'))}
          >
            Rede de Franqueados
          </Link>
        )}

        {isAdminOrSupervisor && (
          <div>
            <div className="flex w-full items-center justify-between gap-1 rounded-lg border-l-2 border-transparent">
              <Link
                href="/processo-seletivo-candidatos"
                className={linkClassTituloBloco(
                  pathname.startsWith('/processo-seletivo-candidatos'),
                )}
              >
                Processo seletivo candidatos
              </Link>
              <button
                type="button"
                onClick={() => setProcessoSeletivoOpen((o) => !o)}
                className="shrink-0 rounded p-0.5 text-moni-muted hover:bg-moni-light/50 hover:text-moni-primary"
                aria-label={processoSeletivoOpen ? 'Recolher' : 'Expandir'}
              >
                {processoSeletivoOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            {processoSeletivoOpen && (
              <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-moni-accent/30 pl-2">
                <Link
                  href="/processo-seletivo-candidatos/due-diligence-avaliacao-inicial"
                  className={linkClassNivel1(
                    pathname.startsWith(
                      '/processo-seletivo-candidatos/due-diligence-avaliacao-inicial',
                    ),
                  )}
                >
                  Due Diligence: avaliação inicial
                </Link>
                <Link
                  href="/processo-seletivo-candidatos/forms-cof"
                  className={linkClassNivel1(
                    pathname.startsWith('/processo-seletivo-candidatos/forms-cof'),
                  )}
                >
                  Forms + COF
                </Link>
                <Link
                  href="/processo-seletivo-candidatos/contrato-franquia"
                  className={linkClassNivel1(
                    pathname.startsWith('/processo-seletivo-candidatos/contrato-franquia'),
                  )}
                >
                  Contrato de Franquia
                </Link>
                <Link
                  href="/processo-seletivo-candidatos/termo-scr"
                  className={linkClassNivel1(
                    pathname.startsWith('/processo-seletivo-candidatos/termo-scr'),
                  )}
                >
                  Termo SCR
                </Link>
              </div>
            )}
          </div>
        )}

        <Link
          href="/catalogo-produtos-moni"
          className={linkClassPrincipal(pathname.startsWith('/catalogo-produtos-moni'))}
        >
          Catálogo de Produtos Moní
        </Link>

        <Link
          href="/rede"
          className={linkClassPrincipal(
            pathname.startsWith('/rede') && !pathname.startsWith('/rede-franqueados'),
          )}
        >
          Rede de contatos
        </Link>

        <div>
          <div className="flex w-full items-center justify-between gap-1 rounded-lg border-l-2 border-transparent">
            <Link
              href="/steps-viabilidade"
              className={linkClassTituloBloco(
                pathname.startsWith('/steps-viabilidade') || pathname.startsWith('/step-'),
              )}
            >
              Steps Viabilidade
            </Link>
            <button
              type="button"
              onClick={() => setStepOneOpen((o) => !o)}
              className="shrink-0 rounded p-0.5 text-moni-muted hover:bg-moni-light/50 hover:text-moni-primary"
              aria-label={stepOneOpen ? 'Recolher' : 'Expandir'}
            >
              {stepOneOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          {stepOneOpen && (
            <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-moni-accent/30 pl-2">
              <Link
                href="/steps-viabilidade"
                className={linkClassNivel1(pathname === '/steps-viabilidade')}
              >
                Kanban (acompanhamento)
              </Link>
              <Link href="/step-one" className={linkClassNivel1(pathname === '/step-one')}>
                Step 1: Região!
              </Link>
              <Link href="/step-2" className={linkClassNivel1(pathname === '/step-2')}>
                Step 2: Novo negócio
              </Link>
              <Link
                href="/analise-moni"
                className={linkClassNivel1(pathname.startsWith('/analise-moni'))}
              >
                Análise Moní (step 1 e 2)
              </Link>
              <Link href="/step-3" className={linkClassNivel1(pathname.startsWith('/step-3'))}>
                Step 3: Opções
              </Link>
              <Link href="/step-4" className={linkClassNivel1(pathname.startsWith('/step-4'))}>
                Step 4: Check Legal
              </Link>
              <Link
                href="/acoplamento-moni"
                className={linkClassNivel1(pathname.startsWith('/acoplamento-moni'))}
              >
                Acoplamento Moní
              </Link>
              <Link href="/step-5" className={linkClassNivel1(pathname.startsWith('/step-5'))}>
                Step 5: Comitê
              </Link>
              <Link href="/step-6" className={linkClassNivel1(pathname.startsWith('/step-6'))}>
                Step 06: Diligência
              </Link>
              <Link href="/step-7" className={linkClassNivel1(pathname.startsWith('/step-7'))}>
                Step 07: Contrato do Terreno
              </Link>
              {isConsultorOrAdmin && (
                <Link href="/painel" className={linkClassNivel1(pathname.startsWith('/painel'))}>
                  Painel
                </Link>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="flex w-full items-center justify-between gap-1 rounded-lg border-l-2 border-transparent">
            <Link
              href="/acoplamento-pl"
              className={linkClassTituloBloco(pathname.startsWith('/acoplamento-pl'))}
            >
              Acoplamento + PL
            </Link>
            <button
              type="button"
              onClick={() => setAcoplamentoPlOpen((o) => !o)}
              className="shrink-0 rounded p-0.5 text-moni-muted hover:bg-moni-light/50 hover:text-moni-primary"
              aria-label={acoplamentoPlOpen ? 'Recolher' : 'Expandir'}
            >
              {acoplamentoPlOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          {acoplamentoPlOpen && (
            <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-moni-accent/30 pl-2">
              <Link
                href="/acoplamento-pl/modelagem-terreno"
                className={linkClassNivel1(
                  pathname.startsWith('/acoplamento-pl/modelagem-terreno'),
                )}
              >
                Modelagem do Terreno
              </Link>
              <Link
                href="/acoplamento-pl/resumo-manuais"
                className={linkClassNivel1(pathname.startsWith('/acoplamento-pl/resumo-manuais'))}
              >
                Resumo dos Manuais
              </Link>
              <Link
                href="/acoplamento-pl/checklist-legal"
                className={linkClassNivel1(pathname.startsWith('/acoplamento-pl/checklist-legal'))}
              >
                Checklist Legal
              </Link>
              <Link
                href="/acoplamento-pl/modelagem-casa-gbox"
                className={linkClassNivel1(
                  pathname.startsWith('/acoplamento-pl/modelagem-casa-gbox'),
                )}
              >
                Modelagem da Casa e GBox
              </Link>
              <Link
                href="/acoplamento-pl/validacao-acoplamento"
                className={linkClassNivel1(
                  pathname.startsWith('/acoplamento-pl/validacao-acoplamento'),
                )}
              >
                Validação do Acoplamento
              </Link>
              <Link
                href="/acoplamento-pl/alteracoes-acoplamento"
                className={linkClassNivel1(
                  pathname.startsWith('/acoplamento-pl/alteracoes-acoplamento'),
                )}
              >
                Alterações do Acoplamento
              </Link>
            </div>
          )}
        </div>

        <div>
          <div className="flex w-full items-center justify-between gap-1 rounded-lg border-l-2 border-transparent">
            <Link
              href="/credito-checklist"
              className={linkClassTituloBloco(
                pathname.startsWith('/credito-checklist') ||
                  pathname.startsWith('/credito-terreno') ||
                  pathname.startsWith('/credito-obra') ||
                  pathname.startsWith('/credito-abertura-conta'),
              )}
            >
              Crédito
            </Link>
            <button
              type="button"
              onClick={() => setCreditoOpen((o) => !o)}
              className="shrink-0 rounded p-0.5 text-moni-muted hover:bg-moni-light/50 hover:text-moni-primary"
              aria-label={creditoOpen ? 'Recolher' : 'Expandir'}
            >
              {creditoOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          {creditoOpen && (
            <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-moni-accent/30 pl-2">
              <Link
                href="/credito-checklist"
                className={linkClassNivel1(pathname.startsWith('/credito-checklist'))}
              >
                Checklist de Crédito
              </Link>
              <Link
                href="/credito-terreno"
                className={linkClassNivel1(pathname.startsWith('/credito-terreno'))}
              >
                Crédito Terreno
              </Link>
              <Link
                href="/credito-obra"
                className={linkClassNivel1(pathname.startsWith('/credito-obra'))}
              >
                Crédito Obra
              </Link>
              <Link
                href="/credito-abertura-conta"
                className={linkClassNivel1(pathname.startsWith('/credito-abertura-conta'))}
              >
                Abertura de Conta
              </Link>
            </div>
          )}
        </div>

        <div>
          <div className="flex w-full items-center justify-between gap-1 rounded-lg border-l-2 border-transparent">
            <Link
              href="/pre-obra"
              className={linkClassTituloBloco(
                pathname.startsWith('/pre-obra') || pathname.startsWith('/obra-ways'),
              )}
            >
              Ways
            </Link>
            <button
              type="button"
              onClick={() => setWayzOpen((o) => !o)}
              className="shrink-0 rounded p-0.5 text-moni-muted hover:bg-moni-light/50 hover:text-moni-primary"
              aria-label={wayzOpen ? 'Recolher' : 'Expandir'}
            >
              {wayzOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          {wayzOpen && (
            <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-moni-accent/30 pl-2">
              <Link href="/pre-obra" className={linkClassNivel1(pathname.startsWith('/pre-obra'))}>
                Pré Obra
              </Link>
              <Link
                href="/obra-ways"
                className={linkClassNivel1(pathname.startsWith('/obra-ways'))}
              >
                Obra
              </Link>
            </div>
          )}
        </div>

        <Link
          href="/sirene"
          className={
            isSirene && pathname.startsWith('/sirene')
              ? 'block w-full rounded-lg bg-emerald-400 px-3 py-2 text-left text-sm font-semibold text-stone-900 transition hover:bg-emerald-300'
              : linkClassPrincipal(pathname.startsWith('/sirene'))
          }
        >
          Sirene
        </Link>
      </nav>

      <div className="space-y-1 border-t border-stone-200 p-3">
        <div className="flex w-full items-center gap-2 rounded-lg px-3 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-moni-primary text-xs font-semibold text-white">
            {inicial}
          </span>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-moni-primary">
              {displayName}
            </span>
            {user?.email && (
              <span className="mt-0.5 block truncate text-[10px] text-stone-300">{user.email}</span>
            )}
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => setPerfilOpen((o) => !o)}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
              perfilOpen
                ? 'bg-moni-light text-moni-primary'
                : 'text-moni-secondary hover:bg-moni-light/50 hover:text-moni-primary'
            }`}
          >
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">Perfil</span>
            <span className="shrink-0 text-moni-muted">
              {perfilOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </span>
          </button>
          {perfilOpen && (
            <div className="ml-3 mt-0.5 space-y-0.5 border-l-2 border-moni-accent/30 pl-2">
              <div>
                <button
                  type="button"
                  onClick={() => setFrankOpen((o) => !o)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium text-moni-secondary hover:bg-moni-light/50"
                >
                  Cadastro franqueado
                  <span className="text-moni-muted">
                    {frankOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </span>
                </button>
                {frankOpen && (
                  <div className="ml-2 mt-0.5 space-y-0.5 border-l-2 border-moni-accent/20 pl-2">
                    <Link
                      href="/perfil"
                      className={`block rounded px-2 py-1.5 text-sm ${
                        pathname === '/perfil'
                          ? 'bg-moni-light text-moni-secondary'
                          : 'text-moni-muted hover:text-moni-secondary'
                      }`}
                    >
                      Cadastro do Franqueado
                    </Link>
                    <Link
                      href="/due-diligence-frank"
                      className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                        pathname.startsWith('/due-diligence-frank')
                          ? 'bg-moni-light text-moni-secondary'
                          : 'text-moni-muted hover:text-moni-secondary'
                      }`}
                    >
                      <FileCheck className="h-4 w-4 shrink-0" />
                      Due Diligence Franqueado
                    </Link>
                  </div>
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setUnidadeOpen((o) => !o)}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm font-medium text-moni-secondary hover:bg-moni-light/50"
                >
                  Cadastro unidade franqueadora
                  <span className="text-moni-muted">
                    {unidadeOpen ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </span>
                </button>
                {unidadeOpen && (
                  <div className="ml-2 mt-0.5 space-y-0.5 border-l-2 border-moni-accent/20 pl-2">
                    <Link
                      href="/unidade-franquia#dados-franquia"
                      className={`block rounded px-2 py-1.5 text-sm ${
                        pathname === '/unidade-franquia'
                          ? 'bg-moni-light text-moni-secondary'
                          : 'text-moni-muted hover:text-moni-secondary'
                      }`}
                    >
                      Dados da Franquia
                    </Link>
                    <Link
                      href="/unidade-franquia#incorporadora-gestora"
                      className={`block rounded px-2 py-1.5 text-sm ${
                        pathname === '/unidade-franquia'
                          ? 'bg-moni-light text-moni-secondary'
                          : 'text-moni-muted hover:text-moni-secondary'
                      }`}
                    >
                      Dados das Empresas
                    </Link>
                    <Link
                      href="/due-diligence-empresas"
                      className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                        pathname.startsWith('/due-diligence-empresas')
                          ? 'bg-moni-light text-moni-secondary'
                          : 'text-moni-muted hover:text-moni-secondary'
                      }`}
                    >
                      <FileCheck className="h-4 w-4 shrink-0" />
                      Due Diligence das Empresas
                    </Link>
                    <Link
                      href="/unidade-franquia#empreendimentos"
                      className={`block rounded px-2 py-1.5 text-sm ${
                        pathname === '/unidade-franquia'
                          ? 'bg-moni-light text-moni-secondary'
                          : 'text-moni-muted hover:text-moni-secondary'
                      }`}
                    >
                      Dados dos Empreendimentos
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <Link
          href="/saude-unidade"
          className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
            pathname.startsWith('/saude-unidade')
              ? 'bg-moni-light text-moni-primary'
              : 'text-moni-secondary hover:bg-moni-light/50 hover:text-moni-primary'
          }`}
        >
          <Activity className="h-3.5 w-3.5 shrink-0" />
          SAÚDE da Unidade de Franquia
        </Link>

        <div className="rounded-lg border-2 border-moni-primary bg-moni-primary/5 p-0.5">
          <Link
            href="/comunidade"
            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition ${
              pathname.startsWith('/comunidade')
                ? 'bg-moni-light text-moni-primary'
                : 'text-moni-secondary hover:bg-moni-light/50 hover:text-moni-primary'
            }`}
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            COMUNIDADE Moní
          </Link>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-700"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
