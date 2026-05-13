/** Título exibido ao lado do breadcrumb « Hub Fly » no cabeçalho fixo (AppStickyHeader). */

const PREFIX_TITLE: { prefix: string; title: string }[] = [
  { prefix: '/portal-frank/rede', title: 'Rede de Franqueados' },
  { prefix: '/portal-frank', title: 'Portal Fly' },
  { prefix: '/rede-franqueados', title: 'Rede de Franqueados' },
  { prefix: '/dashboard-novos-negocios', title: 'Dashboard Novos Negócios' },
  { prefix: '/funil-moni-inc', title: 'Funil Moní INC' },
  { prefix: '/funil-stepone', title: 'Funil Step One' },
  { prefix: '/painel-contabilidade', title: 'Funil Contabilidade' },
  { prefix: '/painel-credito', title: 'Funil Crédito' },
  { prefix: '/painel-novos-negocios', title: 'Portfolio + Operações' },
  { prefix: '/comunidade', title: 'Comunidade' },
  { prefix: '/catalogo-produtos-moni', title: 'Catálogo de Produtos Moní' },
  { prefix: '/operacoes', title: 'Funil Operações' },
  { prefix: '/portfolio', title: 'Funil Portfolio' },
  { prefix: '/funil-acoplamento', title: 'Funil Acoplamento' },
  { prefix: '/sirene', title: 'Sirene' },
  { prefix: '/alertas', title: 'Alertas' },
  { prefix: '/perfil', title: 'Perfil' },
  { prefix: '/admin/usuarios', title: 'Gerenciar Usuários' },
  { prefix: '/admin/sla', title: 'SLA das fases' },
  { prefix: '/admin', title: 'Admin' },
  { prefix: '/acoplamento-pl', title: 'Acoplamento PL' },
  { prefix: '/step-one', title: 'Step 1: Mapeamento da Região' },
  { prefix: '/step-2', title: 'Step 2: Novo Negócio' },
  { prefix: '/step-3', title: 'Step 3: Opção' },
  { prefix: '/step-5', title: 'Step 5: Comitê' },
  { prefix: '/step-6', title: 'Step 6: Diligência' },
  { prefix: '/step-7', title: 'Step 7: Contrato' },
  { prefix: '/painel', title: 'Step 4: Check Legal' },
  { prefix: '/rede', title: 'Rede de Contatos' },
  { prefix: '/juridico', title: 'Dúvidas jurídicas' },
  { prefix: '/iniciar-processo', title: 'Iniciar processo' },
].sort((a, b) => b.prefix.length - a.prefix.length);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function humanizeSegment(seg: string): string {
  if (UUID_RE.test(seg)) return 'Detalhe';
  return seg
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getStickyRouteTitle(pathname: string): string {
  const raw = pathname.split('?')[0] || '/';
  const path = raw.endsWith('/') && raw.length > 1 ? raw.slice(0, -1) : raw;

  for (const { prefix, title } of PREFIX_TITLE) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return title;
  }

  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return 'Hub Fly';
  return humanizeSegment(parts[parts.length - 1] ?? '');
}
