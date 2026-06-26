/** Título e breadcrumb do cabeçalho fixo (AppStickyHeader). */

import { isFrankRedeFranqueadoDetalhePath } from '@/lib/access-matrix';
import { isFrankOrFranqueadoRole } from '@/lib/authz';

export type StickyBreadcrumb = { href?: string; label: string };

const PREFIX_TITLE: { prefix: string; title: string }[] = [
  { prefix: '/portal-frank/rede', title: 'Rede de Franqueados' },
  { prefix: '/portal-frank', title: 'Portal Fly' },
  { prefix: '/carometro/todo', title: 'TO DO' },
  { prefix: '/rede-franqueados', title: 'Rede de Franqueados' },
  { prefix: '/dashboard-novos-negocios', title: 'Dashboard Novos Negócios' },
  { prefix: '/loteadores', title: 'Funil Loteadores' },
  { prefix: '/funil-moni-inc', title: 'Funil Loteadores' },
  { prefix: '/funil-stepone', title: 'Funil Step One' },
  { prefix: '/painel-contabilidade', title: 'Funil Contabilidade' },
  { prefix: '/funil-credito-obra', title: 'Funil Cash Me' },
  { prefix: '/painel-novos-negocios', title: 'Portfolio + Operações' },
  { prefix: '/comunidade', title: 'Comunidade' },
  { prefix: '/catalogo-produtos-moni', title: 'Catálogo de Produtos Moní' },
  { prefix: '/operacoes', title: 'Funil Pré Obra e Obra' },
  { prefix: '/portfolio', title: 'Funil Portfolio' },
  { prefix: '/funil-acoplamento', title: 'Funil Acoplamento' },
  { prefix: '/funil-juridico', title: 'Funil Jurídico' },
  { prefix: '/funil-moni-capital', title: 'Funil Divify' },
  { prefix: '/funil-funding', title: 'Funding' },
  { prefix: '/funil-contratacoes', title: 'Contratações' },
  { prefix: '/funil-produto', title: 'Funil Produto' },
  { prefix: '/funil-modelo-virtual', title: 'Funil Modelo Virtual' },
  { prefix: '/funil-homologacoes', title: 'Funil Homologações' },
  { prefix: '/funil-projeto-legal', title: 'Funil Projeto Legal' },
  { prefix: '/projetos-locais', title: 'Funil Projetos Locais' },
  { prefix: '/projetos-legais', title: 'Funil Projetos Legais' },
  { prefix: '/funil-projetos-locais', title: 'Funil Projetos Locais' },
  { prefix: '/dashboard', title: 'Dashboard' },
  { prefix: '/sirene', title: 'Sirene' },
  { prefix: '/alertas', title: 'Alertas' },
  { prefix: '/perfil', title: 'Perfil' },
  { prefix: '/casa0', title: 'Casa 0 — Onboarding' },
  { prefix: '/casa1', title: 'Casa 1 — Onboarding' },
  { prefix: '/preview-casa0', title: 'Preview Casa 0' },
  { prefix: '/preview-casa1', title: 'Preview Casa 1' },
  { prefix: '/treinamento-bca/leitura', title: 'Treinamento BCA — leitura' },
  { prefix: '/treinamento-bca', title: 'Treinamento BCA' },
  { prefix: '/universidade', title: 'Universidade' },
  { prefix: '/admin/universidade', title: 'Universidade — Gestão' },
  { prefix: '/admin/pastelaria/mapeamento', title: 'Mapeamento Pastelaria' },
  { prefix: '/admin/sla', title: 'SLA das fases' },
  { prefix: '/admin', title: 'Admin' },
  { prefix: '/acoplamento-pl', title: 'Acoplamento PL' },
  { prefix: '/step-one', title: 'Step 1: Mapeamento da Região' },
  { prefix: '/step-2', title: 'Novo Negócio' },
  { prefix: '/step-3', title: 'Opção' },
  { prefix: '/step-5', title: 'Comitê' },
  { prefix: '/step-6', title: 'Diligência' },
  { prefix: '/step-7', title: 'Contrato' },
  { prefix: '/painel', title: 'Check Legal e Crédito' },
  { prefix: '/rede', title: 'Rede de Contatos' },
  { prefix: '/juridico', title: 'Dúvidas jurídicas' },
  { prefix: '/iniciar-processo', title: 'Iniciar processo' },
].sort((a, b) => b.prefix.length - a.prefix.length);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizePathname(pathname: string): string {
  const raw = pathname.split('?')[0] || '/';
  return raw.endsWith('/') && raw.length > 1 ? raw.slice(0, -1) : raw;
}

function humanizeSegment(seg: string): string {
  if (UUID_RE.test(seg)) return 'Detalhe';
  return seg
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getStickyRouteTitle(pathname: string): string {
  const path = normalizePathname(pathname);

  for (const { prefix, title } of PREFIX_TITLE) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return title;
  }

  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return 'Hub Fly';
  return humanizeSegment(parts[parts.length - 1] ?? '');
}

/** Breadcrumb do cabeçalho fixo; último item é a página atual (sem link). */
export function getStickyRouteBreadcrumbs(pathname: string, userRole?: string | null): StickyBreadcrumb[] {
  const path = normalizePathname(pathname);

  if (isFrankRedeFranqueadoDetalhePath(path)) {
    const redeListHref = isFrankOrFranqueadoRole(userRole) ? '/portal-frank/rede' : '/rede-franqueados';
    return [
      { href: '/', label: 'Hub Fly' },
      { href: redeListHref, label: 'Rede de Franqueados' },
      { label: 'Documentos' },
    ];
  }

  const title = getStickyRouteTitle(pathname);
  return [
    { href: '/', label: 'Hub Fly' },
    { label: title },
  ];
}
