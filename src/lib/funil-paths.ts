/**
 * Rotas de funis ativos — qualquer usuário autenticado com papel adequado (middleware + sidebar).
 */
export const FUNIL_PATH_PREFIXES: readonly string[] = [
  '/hub-funis',
  '/funil-stepone',
  '/portfolio',
  '/loteadores',
  '/funil-acoplamento',
  '/funil-juridico',
  '/funil-motor01',
  '/funil-moni-capital',
  '/funil-funding',
  '/funil-credito-obra',
  '/operacoes',
  '/corretores',
  '/funil-projeto-legal',
  '/projetos-locais',
  '/projetos-legais',
  '/funil-projetos-locais',
  '/funil-produto',
  '/funil-modelo-virtual',
  '/funil-homologacoes',
  '/funil-contratacoes',
  '/painel-contabilidade',
  '/funil-moni-inc',
  '/dashboard-novos-negocios',
  '/painel-novos-negocios',
] as const;

export function isFunilPath(pathname: string): boolean {
  return FUNIL_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
