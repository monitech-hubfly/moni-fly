/** Score automático R1 — Funil Loteadores (0–100). */

export type LoteadorR1ScoreInput = {
  preco_atratividade?: string | null;
  produto_atratividade?: string | null;
  showroom_interesse?: string | null;
  linhas_receita?: string | null;
};

const PRECO: Record<string, number> = {
  Atrativo: 30,
  'Não expôs': 15,
  'Não atrativo': 0,
};

const PRODUTO: Record<string, number> = {
  Atrativo: 30,
  'Algumas alterações': 20,
  'Não expôs': 10,
  'Não atrativo': 0,
};

const SHOWROOM: Record<string, number> = {
  Sim: 20,
  'Não expôs': 10,
  Não: 0,
};

export function calcularScoreLoteadorR1(input: LoteadorR1ScoreInput): number {
  const preco = PRECO[String(input.preco_atratividade ?? '').trim()] ?? 0;
  const produto = PRODUTO[String(input.produto_atratividade ?? '').trim()] ?? 0;
  const showroom = SHOWROOM[String(input.showroom_interesse ?? '').trim()] ?? 0;
  const linhas = String(input.linhas_receita ?? '').trim() ? 20 : 0;
  return Math.min(100, Math.max(0, preco + produto + showroom + linhas));
}

export function classificarLoteadorR1(score: number): string {
  if (score >= 80) return '🔥 Alta aderência';
  if (score >= 60) return '🟢 Boa aderência';
  if (score >= 40) return '🟡 Média aderência';
  return '🔴 Baixa aderência';
}

export const LOTEADORES_R1_SCORE_SLUGS = [
  'preco_atratividade',
  'produto_atratividade',
  'showroom_interesse',
  'linhas_receita',
] as const;

export const LOTEADORES_R1_CALCULADO_SLUGS = ['score_loteador', 'classificacao_loteador'] as const;
