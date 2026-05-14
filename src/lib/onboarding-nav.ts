/**
 * Secções do Onboarding (URL: /onboarding/[slug]).
 * Ordem pedagógica: início → conceitos → funis/Step One → esteira contratual → custos/SLAs/operação → ferramentas (parte em React, parte em portal.html).
 */

export type OnboardingNavGroup = {
  title: string | null;
  items: { slug: string; label: string }[];
};

export const ONBOARDING_NAV_GROUPS: OnboardingNavGroup[] = [
  {
    title: null,
    items: [
      { slug: 'introducao', label: 'Introdução' },
      { slug: 'acessos-e-links', label: 'Acessos, links e planilhas' },
      { slug: 'meta-frank', label: 'Meta Frank (ritmo mensal)' },
      { slug: 'jornada-tabuleiro', label: 'Jornada — tabuleiro' },
      { slug: 'portal-html-moni', label: 'Portal HTML completo' },
    ],
  },
  {
    title: 'Conceitos',
    items: [
      { slug: 'o-que-e-moni', label: 'O que é a Moní' },
      { slug: 'modelo-de-negocio', label: 'Modelos de negócio' },
      { slug: 'glossario-completo', label: 'Glossário comercial e jurídico' },
      { slug: 'estrutura-juridica', label: 'Estrutura jurídica' },
    ],
  },
  {
    title: 'Funis e Step One',
    items: [
      { slug: 'funis-kanban-guia', label: 'Kanban Moní e Frank' },
      { slug: 'funil-step-one-guia', label: 'Funil Step One no Hub' },
      { slug: 'step-one-viabilidade-hub', label: 'Step One — 11 etapas (viabilidade)' },
      { slug: 'step-one-operacional', label: 'Step One — demanda e campo' },
      { slug: 'mapa-batalha-bca-spe', label: 'Mapa, batalha, BCA e SPE' },
    ],
  },
  {
    title: 'Negociação ao contrato',
    items: [
      { slug: 'esteira-negociacao-comite', label: 'Negociação, opção e comitê' },
      { slug: 'acoplamento-legal-credito', label: 'Acoplamento + legal e crédito' },
      { slug: 'diligencia-contrato', label: 'Diligência e contrato final' },
    ],
  },
  {
    title: 'Custos, SLAs e operação',
    items: [
      { slug: 'custos-slas-drive', label: 'Custos, SLAs, Drive e lição de casa' },
      { slug: 'operacoes-pre-obra', label: 'Operações pré-obra' },
    ],
  },
  {
    title: 'Ferramentas e documentos',
    items: [
      { slug: 'gadgets-configurador', label: 'Gadgets e configurador' },
      { slug: 'configurador', label: 'Configurador (portal)' },
      { slug: 'bca-guia', label: 'BCA — guia (portal)' },
      { slug: 'batalha-casas', label: 'Batalha de casas (portal)' },
      { slug: 'contratos-moni', label: 'Contratos (portal)' },
      { slug: 'repositorio-materiais', label: 'Repositório (portal)' },
    ],
  },
];

const ALL_SLUGS = new Set(
  ONBOARDING_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.slug)),
);

export type OnboardingSidebarEntry =
  | { kind: 'link'; href: string; label: string }
  | { kind: 'divider'; label: string };

export function getOnboardingSidebarNav(): OnboardingSidebarEntry[] {
  const out: OnboardingSidebarEntry[] = [];
  for (const g of ONBOARDING_NAV_GROUPS) {
    if (g.title) {
      out.push({ kind: 'divider', label: g.title });
    }
    for (const item of g.items) {
      out.push({ kind: 'link', href: `/onboarding/${item.slug}`, label: item.label });
    }
  }
  return out;
}

export function isValidOnboardingSection(slug: string): boolean {
  return ALL_SLUGS.has(slug);
}
