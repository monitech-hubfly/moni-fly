/**
 * PROVISÓRIO: valor do acoplamento pela coluna "Classificação acoplamento" da planilha de lotes,
 * até existir a fórmula definitiva (medidas + topografia). Para mudar os valores, altere só esta tabela.
 * Vale para "Não tenho lote" e "Já tenho lote". Classificação vazia ou fora da tabela = 0.
 */
export const VALOR_ACOPLAMENTO_POR_CLASSIFICACAO: Readonly<Record<string, number>> = {
  A: 200_000,
  // B: 0,
  // C: 0,
};

export function normalizarClassificacaoAcoplamento(raw: unknown): string | null {
  const t = String(raw ?? '').trim().toUpperCase();
  return t || null;
}

export function valorAcoplamentoPorClassificacao(classificacao: string | null | undefined): number {
  const chave = normalizarClassificacaoAcoplamento(classificacao);
  if (!chave) return 0;
  const v = VALOR_ACOPLAMENTO_POR_CLASSIFICACAO[chave];
  return v != null && Number.isFinite(v) && v > 0 ? v : 0;
}
