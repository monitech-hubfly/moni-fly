/** Valor vazio ou só traço (placeholder de planilha / célula sem cadastro). */
export function isValorCadastroVazio(value: unknown): boolean {
  const s = String(value ?? '').trim();
  if (!s) return true;
  return /^[-–—−]+$/.test(s);
}

export function isLinhaCadastroSemIdentidade(...valores: unknown[]): boolean {
  return valores.every(isValorCadastroVazio);
}
