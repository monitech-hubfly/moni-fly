/** Classificação do franqueado usada nos gráficos da visão geral (sem Corporação). */

function norm(s: string | null | undefined): string {
  return (s ?? '').toString().trim();
}

export function isRedeClassificacaoCorporacao(classificacao: string | null | undefined): boolean {
  return /corpora/i.test(norm(classificacao));
}

export function isRedeClassificacaoPagante(classificacao: string | null | undefined): boolean {
  const c = norm(classificacao);
  return /pagante/i.test(c) && !isRedeClassificacaoCorporacao(c);
}

export function isRedeClassificacaoBeta(classificacao: string | null | undefined): boolean {
  const c = norm(classificacao);
  return /beta/i.test(c) && !isRedeClassificacaoCorporacao(c) && !/pagante/i.test(c);
}
