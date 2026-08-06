/**
 * Rotas de funis ativos — qualquer usuário autenticado pode acessar (middleware + sidebar).
 * Funil Jurídico (`/funil-juridico`) permanece desativado e redireciona ao hub.
 */
export const FUNIL_PATH_PREFIXES: readonly string[] = [
  '/hub-funis',
  '/funil-stepone',
  '/portfolio',
  '/loteadores',
  '/funil-acoplamento',
  '/funil-motor01',
  '/funil-moni-capital',
  '/funil-funding',
  '/funil-credito-obra',
  '/operacoes',
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
