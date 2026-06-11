/**
 * Ranking Pré Batalha: modelos Moní vs. listagem ZAP por faixa de mercado.
 * Nota final = Lote + Preço (INC + Kit Moní) + Produto — desempate: Lote > Preço > Produto.
 */

import {
  notaAtributosLote,
  notaFinalBatalha,
  notaPrecoPreBatalhaContraAnuncio,
  notaProdutoContraAnuncio,
  getPrecoIncMaisKitMoni,
  type AtributosLoteRespostas,
  type ProdutoDadosPar,
} from '@/app/step-one/[id]/etapa/REGRAS_BATALHA';
import { CHAVES_TOPOGRAFIA_LOTE } from '@/lib/kanban/lotes-disponiveis-condominio';
import {
  classificarFaixasMercado,
  labelFaixaMercado,
  ORDEM_FAIXAS_MERCADO,
  type FaixaMercado,
} from '@/lib/kanban/mapa-competidores-condominio';
import { filtrarCatalogoPorFaixaModelo } from '@/lib/kanban/modelo-faixa-elegibilidade';

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
  preco_custo?: number | null;
  preco_custo_m2?: number | null;
  preco_venda?: number | null;
  preco_venda_m2?: number | null;
};

export type AnuncioAmeacadorPreBatalha = {
  id: string;
  condominio: string;
  preco: number;
  notaPreco: number;
  notaProduto: number;
};

/** Uma linha: modelo Moní × anúncio ZAP na faixa (notas por eixo). */
export type BatalhaModeloAnuncioPreBatalha = {
  catalogoId: string;
  modelo: string;
  topografia: string;
  anuncioId: string;
  condominio: string;
  precoAnuncio: number;
  precoIncKitMoni: number | null;
  notaLote: number;
  notaPreco: number;
  notaProduto: number;
  notaFinalLinha: number;
};

export type RankingModeloPreBatalha = {
  catalogoId: string;
  modelo: string;
  topografia: string;
  faixa?: FaixaMercado;
  notaLote: number;
  notaPrecoMedia: number;
  notaProdutoMedia: number;
  notaFinal: number;
  precoIncKitMoni: number | null;
  anunciosAmeacadores: AnuncioAmeacadorPreBatalha[];
};

/** Alias usado na UI da Pré Batalha. */
export type ResultadoRankingModelo = RankingModeloPreBatalha;

export type RankingPorFaixaMercado = {
  faixa: FaixaMercado;
  faixaLabel: string;
  quantidadeAnuncios: number;
  /** Todas as combinações modelo × anúncio da faixa. */
  batalhas: BatalhaModeloAnuncioPreBatalha[];
  ranking: RankingModeloPreBatalha[];
};

const TOPOGRAFIA_LABEL: Record<string, string> = {
  aclive: 'Aclive',
  declive: 'Declive',
  plano: 'Plano',
};

export type TopografiaLote = (typeof CHAVES_TOPOGRAFIA_LOTE)[number];

/** Topografia marcada no lote (plano / aclive / declive — mutuamente exclusivos). */
export function resolverTopografiaLote(
  atributosLote: AtributosLoteRespostas,
): TopografiaLote | null {
  for (const chave of CHAVES_TOPOGRAFIA_LOTE) {
    if (atributosLote[chave] === true) return chave;
  }
  return null;
}

function normalizeTopografiaCatalogo(raw: string | null | undefined): TopografiaLote | null {
  const t = String(raw ?? '').trim().toLowerCase();
  if (t === 'plano' || t === 'aclive' || t === 'declive') return t;
  return null;
}

function labelTopografia(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim().toLowerCase();
  if (!t) return '—';
  return TOPOGRAFIA_LABEL[t] ?? raw!.trim();
}

function roundNota(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

function filtrarCatalogoPorTopografia(
  catalogo: CatalogoItem[],
  atributosLote: AtributosLoteRespostas,
): CatalogoItem[] {
  const topografiaLote = resolverTopografiaLote(atributosLote);
  if (!topografiaLote) return catalogo;
  return catalogo.filter(
    (mod) => normalizeTopografiaCatalogo(mod.topografia) === topografiaLote,
  );
}

function compararRankingModelo(a: RankingModeloPreBatalha, b: RankingModeloPreBatalha): number {
  if (b.notaFinal !== a.notaFinal) return b.notaFinal - a.notaFinal;
  if (b.notaLote !== a.notaLote) return b.notaLote - a.notaLote;
  if (b.notaPrecoMedia !== a.notaPrecoMedia) return b.notaPrecoMedia - a.notaPrecoMedia;
  if (b.notaProdutoMedia !== a.notaProdutoMedia) return b.notaProdutoMedia - a.notaProdutoMedia;
  return a.modelo.localeCompare(b.modelo, 'pt-BR');
}

function gerarBatalhasModeloAnuncio(
  catalogoFiltrado: CatalogoItem[],
  casasFaixa: CasaRowPreBatalha[],
  notaLote: number,
  produtoDadosPorAnuncio: Record<string, ProdutoDadosPar | undefined>,
): BatalhaModeloAnuncioPreBatalha[] {
  const notaLoteR = roundNota(notaLote);
  const batalhas: BatalhaModeloAnuncioPreBatalha[] = [];

  for (const mod of catalogoFiltrado) {
    const precoIncKitMoni = getPrecoIncMaisKitMoni(mod);
    const modelo = mod.nome?.trim() || mod.id.slice(0, 8);
    const topografia = labelTopografia(mod.topografia);

    for (const c of casasFaixa) {
      const notaPreco = roundNota(
        notaPrecoPreBatalhaContraAnuncio(precoIncKitMoni, c.preco),
      );
      const notaProduto = roundNota(
        notaProdutoContraAnuncio(mod, c, produtoDadosPorAnuncio[c.id]),
      );
      batalhas.push({
        catalogoId: mod.id,
        modelo,
        topografia,
        anuncioId: c.id,
        condominio: c.condominio?.trim() || '—',
        precoAnuncio: c.preco ?? 0,
        precoIncKitMoni,
        notaLote: notaLoteR,
        notaPreco,
        notaProduto,
        notaFinalLinha: roundNota(notaFinalBatalha(notaLoteR, notaPreco, notaProduto)),
      });
    }
  }

  return batalhas.sort(
    (a, b) =>
      a.modelo.localeCompare(b.modelo, 'pt-BR') ||
      a.condominio.localeCompare(b.condominio, 'pt-BR'),
  );
}

function rankearModelosContraAnuncios(
  catalogoFiltrado: CatalogoItem[],
  casasFaixa: CasaRowPreBatalha[],
  notaLote: number,
  faixa: FaixaMercado | undefined,
  produtoDadosPorAnuncio: Record<string, ProdutoDadosPar | undefined>,
): RankingModeloPreBatalha[] {
  const rankings = catalogoFiltrado.map((mod) => {
    const precoIncKitMoni = getPrecoIncMaisKitMoni(mod);

    const notasPorAnuncio: AnuncioAmeacadorPreBatalha[] = casasFaixa.map((c) => {
      const dados = produtoDadosPorAnuncio[c.id];
      const notaPreco = notaPrecoPreBatalhaContraAnuncio(precoIncKitMoni, c.preco);
      const notaProduto = notaProdutoContraAnuncio(mod, c, dados);
      return {
        id: c.id,
        condominio: c.condominio?.trim() || '—',
        preco: c.preco ?? 0,
        notaPreco: roundNota(notaPreco),
        notaProduto: roundNota(notaProduto),
      };
    });

    const notaPrecoMedia =
      notasPorAnuncio.length > 0
        ? roundNota(
            notasPorAnuncio.reduce((s, a) => s + a.notaPreco, 0) / notasPorAnuncio.length,
          )
        : 0;

    const notaProdutoMedia =
      notasPorAnuncio.length > 0
        ? roundNota(
            notasPorAnuncio.reduce((s, a) => s + a.notaProduto, 0) / notasPorAnuncio.length,
          )
        : 0;

    const notaFinal = roundNota(notaFinalBatalha(notaLote, notaPrecoMedia, notaProdutoMedia));

    const anunciosAmeacadores = [...notasPorAnuncio]
      .sort(
        (a, b) =>
          a.notaPreco + a.notaProduto - (b.notaPreco + b.notaProduto) ||
          a.condominio.localeCompare(b.condominio, 'pt-BR'),
      )
      .slice(0, 3);

    return {
      catalogoId: mod.id,
      modelo: mod.nome?.trim() || mod.id.slice(0, 8),
      topografia: labelTopografia(mod.topografia),
      faixa,
      notaLote: roundNota(notaLote),
      notaPrecoMedia,
      notaProdutoMedia,
      notaFinal,
      precoIncKitMoni,
      anunciosAmeacadores,
    };
  });

  return rankings.sort(compararRankingModelo);
}

export type CalcularRankingModelosOpts = {
  /** Design/idade (ou banheiros/vagas manuais) por anúncio — chave = listing id. */
  produtoDadosPorAnuncio?: Record<string, ProdutoDadosPar | undefined>;
};

/**
 * Ranqueia modelos por faixa de mercado do mapa de competidores.
 * Cada faixa batalha todos os anúncios daquela faixa (Preço INC+Kit + Produto + Lote).
 */
export function calcularRankingPreBatalhaPorFaixas(
  casas: CasaRowPreBatalha[],
  catalogo: CatalogoItem[],
  atributosLote: AtributosLoteRespostas,
  opts?: CalcularRankingModelosOpts,
): RankingPorFaixaMercado[] {
  if (casas.length === 0 || catalogo.length === 0) return [];

  const notaLote = notaAtributosLote(atributosLote);
  const produtoDadosPorAnuncio = opts?.produtoDadosPorAnuncio ?? {};
  const catalogoFiltrado = filtrarCatalogoPorTopografia(catalogo, atributosLote);
  if (catalogoFiltrado.length === 0) return [];

  const casasComFaixa = classificarFaixasMercado(casas);
  const porFaixa = new Map<FaixaMercado, CasaRowPreBatalha[]>();
  for (const c of casasComFaixa) {
    const lista = porFaixa.get(c.faixa) ?? [];
    lista.push(c);
    porFaixa.set(c.faixa, lista);
  }

  const grupos: RankingPorFaixaMercado[] = [];
  for (const faixa of ORDEM_FAIXAS_MERCADO) {
    const casasFaixa = porFaixa.get(faixa);
    if (!casasFaixa?.length) continue;

    const catalogoFaixa = filtrarCatalogoPorFaixaModelo(catalogoFiltrado, faixa);
    if (catalogoFaixa.length === 0) continue;

    const ranking = rankearModelosContraAnuncios(
      catalogoFaixa,
      casasFaixa,
      notaLote,
      faixa,
      produtoDadosPorAnuncio,
    );
    if (ranking.length === 0) continue;

    const batalhas = gerarBatalhasModeloAnuncio(
      catalogoFaixa,
      casasFaixa,
      notaLote,
      produtoDadosPorAnuncio,
    );

    grupos.push({
      faixa,
      faixaLabel: labelFaixaMercado(faixa),
      quantidadeAnuncios: casasFaixa.length,
      batalhas,
      ranking,
    });
  }

  return grupos;
}

/** Lista plana (1ª ocorrência por modelo, ordem faixa → rank). */
export function flattenRankingPreBatalhaPorFaixas(
  grupos: RankingPorFaixaMercado[],
): RankingModeloPreBatalha[] {
  const seen = new Set<string>();
  const out: RankingModeloPreBatalha[] = [];
  for (const g of grupos) {
    for (const item of g.ranking) {
      if (seen.has(item.catalogoId)) continue;
      seen.add(item.catalogoId);
      out.push(item);
    }
  }
  return out;
}

/**
 * @deprecated Preferir `calcularRankingPreBatalhaPorFaixas`. Mantém compatibilidade agregando todas as faixas.
 */
export function calcularRankingModelos(
  casas: CasaRowPreBatalha[],
  catalogo: CatalogoItem[],
  atributosLote: AtributosLoteRespostas,
  opts?: CalcularRankingModelosOpts,
): RankingModeloPreBatalha[] {
  const grupos = calcularRankingPreBatalhaPorFaixas(casas, catalogo, atributosLote, opts);
  if (grupos.length === 0 && casas.length > 0 && catalogo.length > 0) {
    const notaLote = notaAtributosLote(atributosLote);
    const catalogoFiltrado = filtrarCatalogoPorTopografia(catalogo, atributosLote);
    return rankearModelosContraAnuncios(
      catalogoFiltrado,
      casas,
      notaLote,
      undefined,
      opts?.produtoDadosPorAnuncio ?? {},
    );
  }
  return flattenRankingPreBatalhaPorFaixas(grupos);
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

// --- Legado: score 0–100 (mapa / UI antiga) — preferir `calcularRankingPreBatalhaPorFaixas`. ---

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
