/** Score de compatibilidade do modelo Moní vs. listagens do mapa (Pré Batalha). */

export type ModeloCatalogoCompat = {
  id: string;
  nome: string | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  preco_venda_m2: number | null;
  area_m2?: number | null;
};

export type ListingCompat = {
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  preco_m2: number | null;
  area_casa_m2: number | null;
};

function diffToScore(diff: number): number {
  if (diff <= -2) return -2;
  if (diff === -1) return -1;
  if (diff === 0) return 0;
  if (diff === 1) return 1;
  return 2;
}

function notaProdutoRapida(
  modelo: Pick<ModeloCatalogoCompat, 'quartos' | 'banheiros' | 'vagas'>,
  listing: ListingCompat,
): number {
  const campos: Array<'quartos' | 'banheiros' | 'vagas'> = ['quartos', 'banheiros', 'vagas'];
  const notas: number[] = [];
  for (const campo of campos) {
    const baseVal = modelo[campo];
    const anuncioVal = listing[campo];
    if (baseVal == null || anuncioVal == null) continue;
    notas.push(diffToScore(Number(baseVal) - Number(anuncioVal)));
  }
  if (notas.length === 0) return 0;
  return Math.round(notas.reduce((s, n) => s + n, 0) / notas.length);
}

function notaPrecoRapida(precoM2Modelo: number | null, precoM2Listing: number | null): number {
  if (precoM2Modelo == null || precoM2Modelo <= 0 || precoM2Listing == null) return 0;
  const diffPerc = (precoM2Listing - precoM2Modelo) / precoM2Modelo;
  if (diffPerc <= -0.1) return -2;
  if (diffPerc <= -0.05) return -1;
  if (Math.abs(diffPerc) < 0.05) return 0;
  if (diffPerc < 0.1) return 1;
  return 2;
}

/** 0–100 — maior = melhor aderência ao mercado da listagem. */
export function scoreCompatibilidadeModelo(
  modelo: ModeloCatalogoCompat,
  casas: ListingCompat[],
): number {
  const ativas = casas.filter(
    (c) => c.preco_m2 != null || c.quartos != null || c.banheiros != null || c.vagas != null,
  );
  if (ativas.length === 0) return 0;

  let soma = 0;
  for (const c of ativas) {
    const produto = notaProdutoRapida(modelo, c);
    const preco = notaPrecoRapida(modelo.preco_venda_m2, c.preco_m2);
    soma += (produto + preco) / 2;
  }
  const media = soma / ativas.length;
  return Math.round(((media + 2) / 4) * 100);
}

export function ordenarCatalogoPorCompatibilidade<T extends ModeloCatalogoCompat>(
  catalogo: T[],
  casas: ListingCompat[],
): (T & { scoreCompatibilidade: number })[] {
  return catalogo
    .map((m) => ({ ...m, scoreCompatibilidade: scoreCompatibilidadeModelo(m, casas) }))
    .sort((a, b) => {
      if (b.scoreCompatibilidade !== a.scoreCompatibilidade) {
        return b.scoreCompatibilidade - a.scoreCompatibilidade;
      }
      return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR');
    });
}

export function labelCompatibilidade(score: number): string {
  if (score >= 75) return 'Alta';
  if (score >= 50) return 'Média';
  if (score >= 25) return 'Baixa';
  return 'Muito baixa';
}
