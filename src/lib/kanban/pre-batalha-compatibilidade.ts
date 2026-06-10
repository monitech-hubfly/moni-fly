/**
 * Ranking Pré Batalha: modelos Moní vs. listagem ZAP + atributos do lote escolhido.
 */

import {
  notaAtributosLote,
  notaProdutoContraAnuncio,
  type AtributosLoteRespostas,
  type ProdutoDadosPar,
} from '@/app/step-one/[id]/etapa/REGRAS_BATALHA';

/** Anúncio ZAP (`listings_casas`). */
export type CasaRowPreBatalha = {
  id: string;
  condominio: string | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  preco: number | null;
  area_casa_m2: number | null;
  piscina?: boolean | null;
  marcenaria?: boolean | null;
};

/** Modelo Moní (`catalogo_casas`). */
export type CatalogoItem = {
  id: string;
  nome: string | null;
  topografia?: string | null;
  area_m2?: number | null;
  quartos: number | null;
  banheiros: number | null;
  vagas: number | null;
  preco_venda?: number | null;
  preco_venda_m2?: number | null;
};

export type AnuncioAmeacadorPreBatalha = {
  id: string;
  condominio: string;
  preco: number;
  notaProduto: number;
};

export type RankingModeloPreBatalha = {
  catalogoId: string;
  modelo: string;
  topografia: string;
  notaLote: number;
  notaProdutoMedia: number;
  notaFinal: number;
  anunciosAmeacadores: AnuncioAmeacadorPreBatalha[];
};

/** Alias usado na UI da Pré Batalha. */
export type ResultadoRankingModelo = RankingModeloPreBatalha;

const TOPOGRAFIA_LABEL: Record<string, string> = {
  aclive: 'Aclive',
  declive: 'Declive',
  plano: 'Plano',
};

function labelTopografia(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim().toLowerCase();
  if (!t) return '—';
  return TOPOGRAFIA_LABEL[t] ?? raw!.trim();
}

function roundNota(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

export type CalcularRankingModelosOpts = {
  /** Design/idade (ou banheiros/vagas manuais) por anúncio — chave = listing id. */
  produtoDadosPorAnuncio?: Record<string, ProdutoDadosPar | undefined>;
};

/**
 * Ranqueia todos os modelos do catálogo contra a listagem ZAP e os atributos do lote.
 * `notaFinal = notaLote + média das notas de produto vs. cada anúncio`.
 */
export function calcularRankingModelos(
  casas: CasaRowPreBatalha[],
  catalogo: CatalogoItem[],
  atributosLote: AtributosLoteRespostas,
  opts?: CalcularRankingModelosOpts,
): RankingModeloPreBatalha[] {
  const notaLote = notaAtributosLote(atributosLote);
  const produtoDadosPorAnuncio = opts?.produtoDadosPorAnuncio ?? {};

  const rankings = catalogo.map((mod) => {
    const notasPorAnuncio: AnuncioAmeacadorPreBatalha[] = casas.map((c) => {
      const dados = produtoDadosPorAnuncio[c.id];
      const notaProduto = notaProdutoContraAnuncio(mod, c, dados);
      return {
        id: c.id,
        condominio: c.condominio?.trim() || '—',
        preco: c.preco ?? 0,
        notaProduto: roundNota(notaProduto),
      };
    });

    const notaProdutoMedia =
      notasPorAnuncio.length > 0
        ? roundNota(
            notasPorAnuncio.reduce((s, a) => s + a.notaProduto, 0) / notasPorAnuncio.length,
          )
        : 0;

    const notaFinal = roundNota(notaLote + notaProdutoMedia);

    const anunciosAmeacadores = [...notasPorAnuncio]
      .sort((a, b) => a.notaProduto - b.notaProduto || a.condominio.localeCompare(b.condominio, 'pt-BR'))
      .slice(0, 3);

    return {
      catalogoId: mod.id,
      modelo: mod.nome?.trim() || mod.id.slice(0, 8),
      topografia: labelTopografia(mod.topografia),
      notaLote: roundNota(notaLote),
      notaProdutoMedia,
      notaFinal,
      anunciosAmeacadores,
    };
  });

  return rankings.sort((a, b) => {
    if (b.notaFinal !== a.notaFinal) return b.notaFinal - a.notaFinal;
    return a.modelo.localeCompare(b.modelo, 'pt-BR');
  });
}

/** Rótulo de compatibilidade a partir da nota final Pré Batalha (não do score 0–100 legado). */
export function labelCompatibilidade(nota: number): string {
  if (nota >= 1.5) return 'Alta';
  if (nota >= 0) return 'Média';
  return 'Baixa';
}

export type BadgeCompatibilidade = {
  label: string;
  className: string;
};

/** Classes Tailwind para badge Alta (verde) / Média (amarelo) / Baixa (vermelho). */
export function badgeCompatibilidade(nota: number): BadgeCompatibilidade {
  const label = labelCompatibilidade(nota);
  if (label === 'Alta') {
    return {
      label,
      className: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300',
    };
  }
  if (label === 'Média') {
    return {
      label,
      className: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300',
    };
  }
  return {
    label,
    className: 'bg-red-100 text-red-800 ring-1 ring-red-300',
  };
}

export function formatPrecoAnuncio(preco: number): string {
  if (!Number.isFinite(preco) || preco <= 0) return '—';
  return preco.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

// --- Legado: score 0–100 (mapa / UI antiga) — preferir `calcularRankingModelos`. ---

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

/** 0–100 — maior = melhor aderência ao mercado da listagem (legado). */
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

/** Rótulo para score legado 0–100 (`scoreCompatibilidadeModelo`). */
export function labelCompatibilidadeScore(score: number): string {
  if (score >= 75) return 'Alta';
  if (score >= 50) return 'Média';
  if (score >= 25) return 'Baixa';
  return 'Muito baixa';
}
