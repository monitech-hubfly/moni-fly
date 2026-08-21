/** Valor vazio ou só traço — nas tabelas vira "—". */
export function isCadastroValorVazio(value: unknown): boolean {
  const s = String(value ?? '').trim();
  if (!s) return true;
  return /^[—–−\-]+$/.test(s);
}

export function filtrarLinhasCadastroSemNome<T>(rows: T[], nomeDe: (row: T) => unknown): T[] {
  return rows.filter((r) => !isCadastroValorVazio(nomeDe(r)));
}
