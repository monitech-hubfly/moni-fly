/** Formata número para exibição BR: 300000 → "300.000" ou 1500.5 → "1.500,5". */
export function formatarNumeroInput(
  valor: number | string | null | undefined,
  opcoes?: { inteiro?: boolean },
): string {
  const num =
    typeof valor === 'string'
      ? parseFloat(valor.replace(/\./g, '').replace(',', '.'))
      : valor;
  if (num == null || Number.isNaN(num)) return '';
  if (opcoes?.inteiro) {
    return Math.round(num).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/** Converte valor digitado de volta para número: "300.000" → 300000. */
export function parsearNumeroInput(valor: string): number {
  const limpo = valor.replace(/\./g, '').replace(',', '.');
  return parseFloat(limpo) || 0;
}
