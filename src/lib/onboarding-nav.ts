/**
 * Secções do Onboarding (URL: /onboarding/[slug]).
 * `jornada-tabuleiro` abre o tabuleiro React; demais embutem o portal HTML com âncora.
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
      { slug: 'jornada-tabuleiro', label: 'Jornada — Tabuleiro' },
    ],
  },
  {
    title: 'Base de Conhecimento',
    items: [
      { slug: 'o-que-e-moni', label: 'O que é a Moní' },
      { slug: 'modelo-de-negocio', label: 'Modelo de Negócio' },
      { slug: 'estrutura-juridica', label: 'Estrutura Jurídica' },
      { slug: 'glossario', label: 'Glossário Completo' },
    ],
  },
  {
    title: 'Esteira de Viabilidade',
    items: [
      { slug: 'step-1-perimetro', label: 'Step 1 — Perímetro' },
      { slug: 'step-2-hipotese', label: 'Step 2 — Hipótese' },
      { slug: 'step-3-negociacao', label: 'Step 3 — Negociação' },
      { slug: 'steps-4-8', label: 'Steps 4–8' },
    ],
  },
  {
    title: 'Análises Integradas',
    items: [
      { slug: 'step-1-2-juntos', label: 'Step 1+2 Juntos' },
      { slug: 'check-legal-credito', label: 'Check Legal + Crédito' },
    ],
  },
  {
    title: 'Ferramentas',
    items: [
      { slug: 'configurador', label: 'Configurador' },
      { slug: 'bca-guia', label: 'BCA — Guia Completo' },
      { slug: 'batalha-casas', label: 'Batalha de Casas' },
      { slug: 'contratos-moni', label: 'Contratos Moní' },
      { slug: 'repositorio-materiais', label: 'Repositório de Materiais' },
    ],
  },
  {
    title: 'Operação',
    items: [
      { slug: 'pastas-drive', label: 'Pastas do Drive' },
      { slug: 'licao-de-casa', label: 'Lição de Casa' },
      { slug: 'pre-obra', label: 'Pré-Obra (em breve)' },
    ],
  },
];

const ALL_SLUGS = new Set(
  ONBOARDING_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.slug)),
);

export function isValidOnboardingSection(slug: string): boolean {
  return ALL_SLUGS.has(slug);
}
