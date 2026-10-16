export const CATEGORIAS_HUB = [
  'Qualificação de Franqueados',
  'Produto',
  'Onboarding',
  'Portfólio',
  'Loteadores',
  'Jurídico',
  'Acoplamento',
  'Projeto Legal',
  'Pré Obra',
  'Crédito',
  'Projetos Locais',
  'Obra',
  'Pós Obra',
  'Moní Care',
  'Marketing',
] as const;

export type CategoriaHub = (typeof CATEGORIAS_HUB)[number];

export function categoriaHubOuNull(valor: string | null | undefined): CategoriaHub | null {
  const texto = String(valor ?? '').trim();
  return (CATEGORIAS_HUB as readonly string[]).includes(texto) ? (texto as CategoriaHub) : null;
}
