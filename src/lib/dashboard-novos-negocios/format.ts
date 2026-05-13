const br = new Intl.NumberFormat('pt-BR');

export function fmtInt(n: number): string {
  return br.format(Math.round(n));
}

export function fmtPct(n: number, decimals = 0): string {
  return `${Number(n.toFixed(decimals)).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

export function fmtMoneyBRL(n: number): string {
  return br.format(Math.round(n * 100) / 100);
}

/** Valor em milhões (R$) para eixos e labels MM */
export function fmtMM(n: number): string {
  const v = Number(n.toFixed(2));
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} MM`;
}

export function fmtCompactMillions(n: number): string {
  if (n >= 1e6) return `R$ ${(n / 1e6).toFixed(1)}M`;
  return fmtMoneyBRL(n);
}
