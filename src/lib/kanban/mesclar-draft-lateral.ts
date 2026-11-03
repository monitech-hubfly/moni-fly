function valorPreenchido(valor: unknown): boolean {
  if (valor == null) return false;
  if (typeof valor === 'string') return valor.trim().length > 0;
  if (typeof valor === 'number') return Number.isFinite(valor);
  if (typeof valor === 'boolean') return valor;
  if (Array.isArray(valor)) return valor.length > 0;
  if (typeof valor === 'object') return Object.values(valor as object).some(valorPreenchido);
  return true;
}

function objetoSimples(valor: unknown): valor is Record<string, unknown> {
  return valor != null && typeof valor === 'object' && !Array.isArray(valor);
}

/** Mantém o que o usuário já digitou e completa com o que veio do banco. Valor vazio local não apaga dado salvo. */
export function mesclarDraftLateral<T>(local: T, servidor: T): T {
  if (Array.isArray(local) || Array.isArray(servidor)) {
    return valorPreenchido(local) ? local : servidor;
  }
  if (objetoSimples(local) && objetoSimples(servidor)) {
    const saida: Record<string, unknown> = { ...servidor };
    for (const chave of Object.keys(local)) {
      saida[chave] = mesclarDraftLateral(local[chave], servidor[chave]);
    }
    return saida as T;
  }
  return valorPreenchido(local) ? local : servidor;
}
