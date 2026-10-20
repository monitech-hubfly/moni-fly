/**
 * Gera slug único para jornada pública do card.
 * Formato: {nome_condominio normalizado até 30 chars}-{primeiros 6 chars do card UUID}
 */
export function gerarSlugCard(
  nomeCondominio: string | null | undefined,
  titulo: string | null | undefined,
  cardId: string
): string {
  const base = (nomeCondominio || titulo || 'empreendimento').trim()
  const normalizado = base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30)
    .replace(/-$/, '')
  const sufixo = cardId.replace(/-/g, '').slice(0, 6)
  return `${normalizado}-${sufixo}`
}
