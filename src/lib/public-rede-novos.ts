/**
 * Modo visitante / app pública removido — login obrigatório nas rotas do portal.
 * Mantido só para evitar imports quebrados; sempre retorna false.
 * @deprecated Não use em código novo.
 */
export function isPublicRedeNovosNegociosEnabled(): boolean {
  return false;
}

/** @deprecated Não use em código novo. */
export function isAppFullyPublic(): boolean {
  return false;
}

/** @deprecated Não use em código novo. */
export function isPublicRedeNovosPath(_pathname: string): boolean {
  return false;
}

/** @deprecated Não use em código novo. */
export function allowPublicAccessRedeNovos(_pathname: string): boolean {
  return false;
}
