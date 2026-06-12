'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronRight, User } from 'lucide-react';
import { AlertasBellLink } from '@/components/AlertasBellLink';
import { createClient } from '@/lib/supabase/client';
import { canAccessFunilContratacoes, isAdminRole, isRedeStaffRole, normalizeAccessRole } from '@/lib/authz';
import { isLiveLimitedRelease, showDevOnlySidebarNav } from '@/lib/release-scope';
import { SidebarUniversidadeLinks } from '@/components/universidade/SidebarUniversidadeLinks';
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

type NavItem = { href: string; label: string };
const REDE_FRANQUEADOS_SUBITENS: NavItem[] = [
  { href: '/rede-franqueados', label: 'Rede Casa Moní' },
  { href: '/comunidade', label: 'Comunidade' },
  { href: '/rede', label: 'Rede de Contatos' },
];
const CATALOGO_SUBITENS: NavItem[] = [
  { href: '/catalogo-produtos-moni', label: 'Catálogo de Produtos Moní' },
];
const STEPS_SUBITENS: NavItem[] = [
  { href: '/step-one', label: 'Step 1: Mapeamento da Região' },
  { href: '/step-2', label: 'Novo Negócio' },
  { href: '/step-3', label: 'Opção' },
  { href: '/painel', label: 'Check Legal e Crédito' },
  { href: '/acoplamento-pl', label: 'Acoplamento (paralelo Check Legal e Crédito)' },
  { href: '/step-5', label: 'Comitê' },
  { href: '/step-6', label: 'Diligência' },
  { href: '/step-7', label: 'Contrato' },
];
const NOVOS_NEGOCIOS_SUBITENS: NavItem[] = [
  { href: '/funil-stepone', label: 'Funil Step One' },
  { href: '/portfolio', label: 'Funil Portfolio' },
  { href: '/loteadores', label: 'Funil Loteadores' },
  { href: '/funil-acoplamento', label: 'Funil Acoplamento' },
];
const NOVOS_NEGOCIOS_SUBITENS_FRANK: NavItem[] = [
  { href: '/funil-stepone', label: 'Funil Step One' },
  { href: '/portfolio', label: 'Funil Portfolio' },
];
const CREDITO_JURIDICO_SUBITENS: NavItem[] = [
  { href: '/funil-moni-capital', label: 'Moní Capital' },
  { href: '/funil-credito-obra', label: 'Crédito Obra' },
  { href: '/painel-contabilidade', label: 'Funil Contabilidade' },
];
const PRE_OBRA_SUBITENS: NavItem[] = [
  { href: '/operacoes', label: 'Funil Pré Obra e Obra' },
  { href: '/funil-projeto-legal', label: 'Funil Projeto Legal' },
  { href: '/projetos-locais', label: 'Projetos Locais' },
];
const HDM_SUBITENS: NavItem[] = [
  { href: '/funil-produto', label: 'Produto' },
  { href: '/funil-modelo-virtual', label: 'Modelo Virtual' },
  { href: '/funil-homologacoes', label: 'Homologações' },
];
const INTERNO_SUBITENS: NavItem[] = [{ href: '/funil-contratacoes', label: 'Contratações' }];
const SIRENE_SUBITENS: NavItem[] = [{ href: '/sirene/chamados', label: 'Chamados' }];
const CAROMETRO_SUBITENS: NavItem[] = [
  { href: '/carometro/comportamentos-e-atividades', label: 'Comportamentos e Atividades' },
  { href: '/carometro/gantt', label: 'Planejamento (Gantt)' },
  { href: '/carometro/status-preenchimento', label: 'Status de Preenchimento' },
  { href: '/carometro/conquistas', label: 'Conquistas' },
  { href: '/carometro/indicadores', label: 'Indicadores' },
  { href: '/carometro/workload', label: 'Workload' },
  { href: '/carometro/pastelaria', label: 'Pastelaria' },
  { href: '/carometro', label: 'Carômetro' },
  { href: '/carometro/dashboard-produtos', label: 'Dashboard Casas Moní' },
  { href: '/carometro/todo', label: 'TO DO' },
  { href: '/carometro/cadastros', label: 'Cadastros' },
  { href: '/carometro/log', label: 'Log' },
];

const CAROMETRO_SUBITENS_TEAM: NavItem[] = [
  { href: '/carometro/comportamentos-e-atividades', label: 'Comportamentos e Atividades' },
  { href: '/carometro/gantt', label: 'Planejamento (Gantt)' },
  { href: '/carometro/status-preenchimento', label: 'Status de Preenchimento' },
  { href: '/carometro/conquistas', label: 'Conquistas' },
  { href: '/carometro/pastelaria', label: 'Pastelaria' },
  { href: '/carometro', label: 'Carômetro' },
  { href: '/carometro/dashboard-produtos', label: 'Dashboard Casas Moní' },
  { href: '/carometro/todo', label: 'TO DO' },
];

const REDE_HREFS_DEV_ONLY = new Set(['/comunidade', '/rede']);

function filterRedeFranqueadosSubitensParaProd(items: NavItem[], showDevNav: boolean): NavItem[] {
  if (showDevNav) return items;
  return items.filter((i) => !REDE_HREFS_DEV_ONLY.has(i.href));
}

function isRedeFranqueadosActive(pathname: string) {
  if (
    pathname.startsWith('/rede-franqueados') ||
    pathname.startsWith('/comunidade') ||
    pathname.startsWith('/portal-frank/rede')
  ) {
    return true;
  }
  return pathname === '/rede' || (pathname.startsWith('/rede') && !pathname.startsWith('/rede-franqueados'));
}
function buildNovosNegociosSubitens(role: string): NavItem[] {
  const base =
    normalizeAccessRole(role) !== 'frank' ? NOVOS_NEGOCIOS_SUBITENS : NOVOS_NEGOCIOS_SUBITENS_FRANK;

  if (!isRedeStaffRole(role)) return base;

  return [{ href: '/portfolio/saude', label: 'Saúde' }, ...base];
}

function isNovosNegociosSubitemActive(pathname: string, href: string): boolean {
  if (href === '/portfolio') {
    return pathname === '/portfolio';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isNovosNegociosActive(pathname: string) {
  return (
    pathname.startsWith('/painel-novos-negocios') ||
    pathname.startsWith('/portfolio') ||
    pathname.startsWith('/funil-acoplamento') ||
    pathname.startsWith('/dashboard-novos-negocios') ||
    pathname.startsWith('/funil-stepone') ||
    pathname.startsWith('/loteadores') ||
    pathname.startsWith('/funil-moni-inc')
  );
}

function isCreditoJuridicoActive(pathname: string) {
  return (
    pathname.startsWith('/funil-juridico') ||
    pathname.startsWith('/funil-moni-capital') ||
    pathname.startsWith('/painel-contabilidade') ||
    pathname.startsWith('/funil-credito-obra')
  );
}

function isPreObraActive(pathname: string) {
  return (
    pathname.startsWith('/operacoes') ||
    pathname.startsWith('/funil-projeto-legal') ||
    pathname.startsWith('/projetos-locais') ||
    pathname.startsWith('/projetos-legais')
  );
}

function isHdmActive(pathname: string) {
  return (
    pathname.startsWith('/funil-produto') ||
    pathname.startsWith('/funil-modelo-virtual') ||
    pathname.startsWith('/funil-homologacoes')
  );
}

function isInternoNavActive(pathname: string) {
  return pathname.startsWith('/funil-contratacoes');
}

function isSireneNavActive(pathname: string) {
  return pathname.startsWith('/sirene');
}
function isCarometroNavActive(pathname: string) {
  return pathname.startsWith('/carometro');
}
function isCatalogoActive(pathname: string) {
  return pathname.startsWith('/catalogo-produtos-moni');
}
function isStepsActive(pathname: string) {
  return (
    pathname.startsWith('/step-one') ||
    pathname.startsWith('/step-2') ||
    pathname.startsWith('/step-3') ||
    pathname.startsWith('/step-5') ||
    pathname.startsWith('/step-6') ||
    pathname.startsWith('/step-7') ||
    pathname.startsWith('/painel') ||
    pathname.startsWith('/acoplamento-pl')
  );
}
export function PortalSidebar({ user, userRole }: PortalSidebarProps) {
  const pathname = usePathname();
  const [resolvedRole, setResolvedRole] = useState(userRole);
  const [resolvedCargo, setResolvedCargo] = useState<string | null>(null);
  const isAdmin = isAdminRole(resolvedRole);
  const showInternoNav = canAccessFunilContratacoes(resolvedRole, resolvedCargo);
  const limitedRelease = isLiveLimitedRelease();
  const showDevNav = showDevOnlySidebarNav();
  const roleNorm = normalizeAccessRole(resolvedRole);
  const isFrank = roleNorm === 'frank';
  const isStaff = isAdmin || roleNorm === 'team';
  const showNovosNegociosNav = isStaff || isFrank;
  const showCreditoJuridicoNav = isStaff;
  const showPreObraNav = isStaff;
  const showHdmNav = isStaff;

  const novosNegociosSubitens = useMemo(() => buildNovosNegociosSubitens(resolvedRole), [resolvedRole]);

  useEffect(() => {
    setResolvedRole(userRole);
  }, [userRole]);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    void supabase
      .from('profiles')
      .select('role, cargo')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.role != null) {
          setResolvedRole(normalizeAccessRole(String(data.role)));
        }
        if (data?.cargo != null) {
          setResolvedCargo(String(data.cargo));
        }
      });
  }, [user?.id]);
  const [perfilOpen, setPerfilOpen] = useState(() => (pathname ?? '') === '/perfil');
  const [redeFranqueadosOpen, setRedeFranqueadosOpen] = useState(() => isRedeFranqueadosActive(pathname ?? ''));
  const [catalogoOpen, setCatalogoOpen] = useState(() => isCatalogoActive(pathname ?? ''));
  const [stepsOpen, setStepsOpen] = useState(() => isStepsActive(pathname ?? ''));
  const [novosNegociosOpen, setNovosNegociosOpen] = useState(() => isNovosNegociosActive(pathname ?? ''));
  const [creditoJuridicoOpen, setCreditoJuridicoOpen] = useState(() =>
    isCreditoJuridicoActive(pathname ?? ''),
  );
  const [preObraOpen, setPreObraOpen] = useState(() => isPreObraActive(pathname ?? ''));
  const [hdmOpen, setHdmOpen] = useState(() => isHdmActive(pathname ?? ''));
  const [internoOpen, setInternoOpen] = useState(() => isInternoNavActive(pathname ?? ''));
  const [sireneOpen, setSireneOpen] = useState(() => isSireneNavActive(pathname ?? ''));
  const [carometroOpen, setCarometroOpen] = useState(() => isCarometroNavActive(pathname ?? ''));
  /** Franqueado não acessa `/rede-franqueados` (middleware); visão consolidada em `/portal-frank/rede`. */
  const redeFranqueadosNavSubitens = useMemo((): NavItem[] => {
    if (!user?.id) return filterRedeFranqueadosSubitensParaProd(REDE_FRANQUEADOS_SUBITENS, showDevNav);
    if (resolvedRole === 'frank') {
      return [{ href: '/portal-frank/rede', label: 'Rede Casa Moní' }];
    }
    return filterRedeFranqueadosSubitensParaProd(REDE_FRANQUEADOS_SUBITENS, showDevNav);
  }, [user?.id, resolvedRole, showDevNav]);

  useEffect(() => {
    const p = pathname ?? '';
    if (
      p === '/perfil' ||
      p.startsWith('/admin/usuarios') ||
      p.startsWith('/admin/pastelaria')
    ) {
      setPerfilOpen(true);
    }
    if (isNovosNegociosActive(p)) setNovosNegociosOpen(true);
    if (isCreditoJuridicoActive(p)) setCreditoJuridicoOpen(true);
    if (isPreObraActive(p)) setPreObraOpen(true);
    if (isHdmActive(p)) setHdmOpen(true);
    if (isInternoNavActive(p)) setInternoOpen(true);
    if (isSireneNavActive(p)) setSireneOpen(true);
    if (isCarometroNavActive(p)) setCarometroOpen(true);
    if (isRedeFranqueadosActive(p)) setRedeFranqueadosOpen(true);
    else if (isCatalogoActive(p)) setCatalogoOpen(true);
    else if (isStepsActive(p)) setStepsOpen(true);
  }, [pathname]);

  const displayName = user?.full_name?.trim() || user?.email || 'Franqueado';
  const inicial = getInicialNome(user?.full_name ?? null);

  const linkClassPrincipal = (active: boolean) =>
    `block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${
      active
        ? 'bg-moni-light text-moni-primary'
        : 'text-moni-primary hover:bg-moni-light/50 hover:text-moni-secondary'
    }`;

  const linkClassSub = (active: boolean) =>
    `block w-full rounded py-1.5 pl-5 pr-3 text-left text-xs transition ${
      active
        ? 'bg-moni-light/80 font-medium text-moni-primary'
        : 'text-stone-600 hover:bg-stone-100 hover:text-moni-secondary'
    }`;

  const renderMacro = (
    key:
      | 'rede'
      | 'catalogo'
      | 'steps'
      | 'novosNegocios'
      | 'creditoJuridico'
      | 'preObra'
      | 'hdm'
      | 'interno'
      | 'sirene'
      | 'carometro',
    label: string,
    isActive: boolean,
    open: boolean,
    setOpen: (v: boolean) => void,
    subitens: NavItem[],
    isActiveHref: (href: string) => boolean,
  ) => {
    const macroClass = linkClassPrincipal(isActive);
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className={`flex flex-1 items-center gap-2 ${macroClass}`}
          >
            {label}
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
            {subitens.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className={linkClassSub(isActiveHref(s.href))}
              >
                {s.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 w-56 shrink-0 flex-col border-r border-stone-200 bg-white">
      {/* Topo: logo + sino */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-stone-200 px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-moni-primary hover:text-moni-secondary">
          Moní
        </Link>
        <AlertasBellLink userId={user?.id} />
      </div>

      {/* Navegação principal com macro-itens e subitens */}
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {renderMacro(
          'rede',
          'Rede Casa Moní',
          isRedeFranqueadosActive(pathname ?? ''),
          redeFranqueadosOpen,
          setRedeFranqueadosOpen,
          redeFranqueadosNavSubitens,
          (href) => {
            if (href === '/rede') {
              return (
                pathname === '/rede' ||
                (Boolean(pathname?.startsWith('/rede/')) && !pathname.startsWith('/rede-franqueados'))
              );
            }
            return pathname?.startsWith(href) ?? false;
          },
        )}

        {!limitedRelease && (isAdmin || resolvedRole === 'team') &&
          renderMacro(
            'carometro',
            'Carômetro',
            isCarometroNavActive(pathname ?? ''),
            carometroOpen,
            setCarometroOpen,
            isAdmin ? CAROMETRO_SUBITENS : CAROMETRO_SUBITENS_TEAM,
            (href) => Boolean(pathname === href || pathname?.startsWith(`${href}/`)),
          )}

        {!limitedRelease && (
          <SidebarUniversidadeLinks
            userId={user?.id}
            resolvedRole={resolvedRole}
            linkClassPrincipal={linkClassPrincipal}
            linkClassSub={linkClassSub}
          />
        )}

        {showNovosNegociosNav &&
          renderMacro(
            'novosNegocios',
            'Novos Negócios',
            isNovosNegociosActive(pathname ?? ''),
            novosNegociosOpen,
            setNovosNegociosOpen,
            novosNegociosSubitens,
            (href) => isNovosNegociosSubitemActive(pathname ?? '', href),
          )}

        {showCreditoJuridicoNav &&
          renderMacro(
            'creditoJuridico',
            'Crédito e Contabilidade',
            isCreditoJuridicoActive(pathname ?? ''),
            creditoJuridicoOpen,
            setCreditoJuridicoOpen,
            CREDITO_JURIDICO_SUBITENS,
            (href) => pathname === href || (pathname?.startsWith(href + '/') ?? false),
          )}

        {showPreObraNav &&
          renderMacro(
            'preObra',
            'Operações',
            isPreObraActive(pathname ?? ''),
            preObraOpen,
            setPreObraOpen,
            PRE_OBRA_SUBITENS,
            (href) => pathname === href || (pathname?.startsWith(href + '/') ?? false),
          )}

        {showHdmNav &&
          renderMacro(
            'hdm',
            'HDM',
            isHdmActive(pathname ?? ''),
            hdmOpen,
            setHdmOpen,
            HDM_SUBITENS,
            (href) => pathname === href || (pathname?.startsWith(href + '/') ?? false),
          )}

        {!limitedRelease && showInternoNav &&
          renderMacro(
            'interno',
            'Interno',
            isInternoNavActive(pathname ?? ''),
            internoOpen,
            setInternoOpen,
            INTERNO_SUBITENS,
            (href) => pathname === href || (pathname?.startsWith(`${href}/`) ?? false),
          )}

        {!limitedRelease && (isAdmin || resolvedRole === 'team') && (
          <Link
            href="/repositorio"
            className={linkClassPrincipal(Boolean(pathname?.startsWith('/repositorio')))}
          >
            Repositório
          </Link>
        )}

        {!limitedRelease &&
          (isAdmin || resolvedRole === 'team') &&
          renderMacro(
            'sirene',
            'Sirene',
            isSireneNavActive(pathname ?? ''),
            sireneOpen,
            setSireneOpen,
            SIRENE_SUBITENS,
            (href) => Boolean(pathname === href || pathname?.startsWith(`${href}/`)),
          )}

        {isFrank && (
          <Link
            href="/minhas-empresas"
            className={`${linkClassPrincipal(Boolean(pathname?.startsWith('/minhas-empresas')))} flex items-center gap-2`}
          >
            <Building2 className="h-4 w-4 shrink-0" aria-hidden />
            Minhas Empresas
          </Link>
        )}

        {!limitedRelease && showDevNav && isAdmin &&
          renderMacro(
            'catalogo',
            'Catálogo de Produtos Moní',
            isCatalogoActive(pathname ?? ''),
            catalogoOpen,
            setCatalogoOpen,
            CATALOGO_SUBITENS,
            (href) => pathname?.startsWith(href) ?? false,
          )}

        {!limitedRelease && showDevNav && isAdmin &&
          renderMacro(
            'steps',
            'Steps Viabilidade',
            isStepsActive(pathname ?? ''),
            stepsOpen,
            setStepsOpen,
            STEPS_SUBITENS,
            (href) => {
              if (href === '/step-one') {
                return Boolean(pathname?.startsWith('/step-one') && !pathname?.startsWith('/step-2'));
              }
              return pathname === href || (pathname?.startsWith(href + '/') ?? false);
            },
          )}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-stone-200 p-3">
        <div className="flex w-full items-center gap-2 rounded-lg px-3 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-moni-primary text-xs font-semibold text-white">
            {inicial}
          </span>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-moni-primary">{displayName}</span>
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
                  : 'text-moni-primary hover:bg-moni-light/70 hover:text-moni-secondary'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span>Perfil</span>
              </span>
              {perfilOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
            {perfilOpen && (
              <div className="mt-1 space-y-0.5 pl-6 text-[11px]">
                <div className="text-stone-500">Papel: {resolvedRole || 'franqueado'}</div>
                {isAdmin && (
                  <>
                    <Link
                      href="/admin/usuarios"
                      className="mt-1 block text-left font-semibold text-moni-primary hover:text-moni-secondary"
                    >
                      Gerenciar Usuários
                    </Link>
                    <Link
                      href="/admin/pastelaria/mapeamento"
                      className="mt-1 block text-left font-semibold text-moni-primary hover:text-moni-secondary"
                    >
                      Mapeamento Pastelaria
                    </Link>
                  </>
                )}
                <Link
                  href="/perfil"
                  className="mt-1 block text-left text-moni-primary hover:text-moni-secondary"
                >
                  Ver perfil e configurações
                </Link>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}