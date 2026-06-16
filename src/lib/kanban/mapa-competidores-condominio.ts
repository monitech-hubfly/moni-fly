import type { CasaRow } from '@/app/step-one/[id]/etapa/Etapa4Casas';
import type {
  FaixaCondominioId,
  LinhaProspectCondominio,
} from '@/lib/kanban/condominio-prospect-pesquisa';
import { condominiosMapaCompativeis } from '@/lib/zap-condominio-busca';

export type SugestaoPrecoFaixaCondominio = {
  q_casas_faixas_preco: string;
  q_casas_preco_m2: string;
};

type CasaMapaPreco = Pick<CasaRow, 'condominio' | 'preco' | 'preco_m2' | 'area_casa_m2'>;

export type ClassificarFaixasMercadoOpts = {
  /** Universo para calcular tercis (padrão: o próprio array). Use todas as casas do mapa ZAP. */
  universoCortes?: { preco: number | null }[];
};

export function normalizarNomeCondominioMapa(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function casaMapaPertenceCondominio(
  casa: Pick<CasaRow, 'condominio'>,
  nomeCondominio: string,
): boolean {
  const alvo = normalizarNomeCondominioMapa(nomeCondominio);
  if (!alvo) return false;
  const cnd = normalizarNomeCondominioMapa(casa.condominio ?? '');
  if (!cnd) return false;
  if (cnd === alvo || cnd.includes(alvo) || alvo.includes(cnd)) return true;
  return condominiosMapaCompativeis(nomeCondominio, casa.condominio ?? '');
}

export function filtrarCasasMapaPorCondominio(casas: CasaRow[], nomeCondominio: string): CasaRow[] {
  const alvo = normalizarNomeCondominioMapa(nomeCondominio);
  if (!alvo) return [];
  return casas.filter((c) => casaMapaPertenceCondominio(c, nomeCondominio));
}

/** Alias usado no checklist do mapa de competidores. */
export const filtrarCasasPorCondominio = filtrarCasasMapaPorCondominio;

/** Pelo menos uma listagem vinculada ao condomínio da sessão. */
export function linhaMapaCompetidoresCompleta(
  linha: LinhaProspectCondominio,
  casas: CasaRow[],
): boolean {
  const nome = linha.condominio?.trim();
  if (!nome) return false;
  return filtrarCasasMapaPorCondominio(casas, nome).length > 0;
}

/** Classifica cada casa em faixa por tercis de VGV (universo ≥ R$ 4MM na busca ZAP). */
export type FaixaMercado =
  | 'entrada'
  | 'intermediaria'
  | 'premium'
  | 'premium_plus'
  | 'premium_plus2'
  | 'premium_plus3';

const LIMITE_PREMIUM_PLUS = 10_000_000;
const LIMITE_PREMIUM_PLUS2 = 15_000_000;
const LIMITE_PREMIUM_PLUS3 = 20_000_000;

function calcularCortes(casas: { preco: number | null }[]): { corte1: number; corte2: number } {
  const comPreco = casas.filter((c) => c.preco != null);
  if (comPreco.length < 3) return { corte1: 0, corte2: 0 };
  const ordenado = [...comPreco].sort((a, b) => (a.preco ?? 0) - (b.preco ?? 0));
  const n = ordenado.length;
  return {
    corte1: ordenado[Math.floor(n / 3)].preco ?? 0,
    corte2: ordenado[Math.floor((2 * n) / 3)].preco ?? 0,
  };
}

function resolverFaixa(preco: number, corte1: number, corte2: number): FaixaMercado {
  if (preco >= LIMITE_PREMIUM_PLUS3) return 'premium_plus3';
  if (preco >= LIMITE_PREMIUM_PLUS2) return 'premium_plus2';
  if (preco >= LIMITE_PREMIUM_PLUS) return 'premium_plus';
  if (preco <= corte1) return 'entrada';
  if (preco <= corte2) return 'intermediaria';
  return 'premium';
}

export function classificarFaixasMercado<T extends { preco: number | null }>(
  casas: T[],
  opts?: ClassificarFaixasMercadoOpts,
): (T & { faixa: FaixaMercado })[] {
  const base = opts?.universoCortes ?? casas;
  const { corte1, corte2 } = calcularCortes(base);
  return casas.map((c) => ({
    ...c,
    faixa: resolverFaixa(c.preco ?? 0, corte1, corte2),
  }));
}

/** Faixa de mercado ZAP → faixa de pesquisa do condomínio (Premium / Intermediária / Entrada). */
export function faixaMercadoParaFaixaCondominio(faixa: FaixaMercado): FaixaCondominioId {
  if (faixa === 'entrada') return 'entrada';
  if (faixa === 'intermediaria') return 'intermediaria';
  return 'premium';
}

export const ORDEM_FAIXAS_MERCADO: FaixaMercado[] = [
  'entrada',
  'intermediaria',
  'premium',
  'premium_plus',
  'premium_plus2',
  'premium_plus3',
];

export const LABEL_FAIXA_MERCADO: Record<FaixaMercado, string> = {
  entrada: 'Entrada',
  intermediaria: 'Intermediária',
  premium: 'Premium',
  premium_plus: 'Premium+',
  premium_plus2: 'Premium++',
  premium_plus3: 'Premium+++',
};

export function labelFaixaMercado(faixa: FaixaMercado): string {
  return LABEL_FAIXA_MERCADO[faixa] ?? faixa;
}

function ordemFaixaMercado(f: FaixaMercado | undefined): number {
  if (!f) return ORDEM_FAIXAS_MERCADO.length;
  const idx = ORDEM_FAIXAS_MERCADO.indexOf(f);
  return idx === -1 ? ORDEM_FAIXAS_MERCADO.length : idx;
}

/** Agrupa por faixa (Entrada → … → Premium+++) e ordena por preço decrescente dentro de cada faixa. */
export function ordenarCasasPorFaixaMercado<T extends { preco: number | null }>(
  casas: T[],
): (T & { faixa: FaixaMercado })[] {
  const comFaixa = classificarFaixasMercado(casas);
  return [...comFaixa].sort((a, b) => {
    const diff = ordemFaixaMercado(a.faixa) - ordemFaixaMercado(b.faixa);
    if (diff !== 0) return diff;
    return (b.preco ?? 0) - (a.preco ?? 0);
  });
}

export type CasaFaixaMercadoInput = {
  preco: number | null;
  preco_m2?: number | null;
  area_casa_m2?: number | null;
};

export type StatsFaixaMercado = {
  quantidade: number;
  precoMin: number | null;
  precoMax: number | null;
  precoM2Min: number | null;
  precoM2Max: number | null;
};

/** R$/m² informado ou derivado de preço ÷ área (mesma regra da listagem de casas). */
export function precoM2Efetivo(c: CasaFaixaMercadoInput): number | null {
  if (c.preco_m2 != null && Number.isFinite(c.preco_m2) && c.preco_m2 > 0) return c.preco_m2;
  if (c.preco != null && c.area_casa_m2 != null && c.area_casa_m2 > 0) {
    return c.preco / c.area_casa_m2;
  }
  return null;
}

function calcularStatsFaixa(
  casas: (CasaFaixaMercadoInput & { faixa: FaixaMercado })[],
  faixa: FaixaMercado,
): StatsFaixaMercado {
  const naFaixa = casas.filter((c) => c.faixa === faixa);
  if (naFaixa.length === 0) {
    return { quantidade: 0, precoMin: null, precoMax: null, precoM2Min: null, precoM2Max: null };
  }
  const precos = naFaixa.map((c) => c.preco!);
  const precosM2 = naFaixa
    .map((c) => precoM2Efetivo(c))
    .filter((v): v is number => v != null && v > 0);
  return {
    quantidade: naFaixa.length,
    precoMin: Math.min(...precos),
    precoMax: Math.max(...precos),
    precoM2Min: precosM2.length > 0 ? Math.min(...precosM2) : null,
    precoM2Max: precosM2.length > 0 ? Math.max(...precosM2) : null,
  };
}

/** Calcula resumo das faixas: cortes de tercis + faixas reais de preço e R$/m² por anúncio. */
export function resumoFaixasMercado(
  casas: CasaFaixaMercadoInput[],
  opts?: ClassificarFaixasMercadoOpts,
): {
  corte1: number;
  corte2: number;
  entrada: StatsFaixaMercado;
  intermediaria: StatsFaixaMercado;
  premium: StatsFaixaMercado;
  premium_plus: StatsFaixaMercado;
  premium_plus2: StatsFaixaMercado;
  premium_plus3: StatsFaixaMercado;
} | null {
  const comPreco = casas.filter((c) => c.preco != null && c.preco > 0);
  if (comPreco.length === 0) return null;
  const baseCortes = opts?.universoCortes ?? casas;
  const { corte1, corte2 } = calcularCortes(baseCortes);
  const comFaixa = comPreco.map((c) => ({
    ...c,
    faixa: resolverFaixa(c.preco ?? 0, corte1, corte2),
  }));
  const stats = (f: FaixaMercado) => calcularStatsFaixa(comFaixa, f);
  return {
    corte1,
    corte2,
    entrada: stats('entrada'),
    intermediaria: stats('intermediaria'),
    premium: stats('premium'),
    premium_plus: stats('premium_plus'),
    premium_plus2: stats('premium_plus2'),
    premium_plus3: stats('premium_plus3'),
  };
}

function mediana(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const ordenado = [...nums].sort((a, b) => a - b);
  const meio = Math.floor(ordenado.length / 2);
  return ordenado.length % 2 === 1
    ? ordenado[meio]
    : (ordenado[meio - 1] + ordenado[meio]) / 2;
}

function formatVgvMilhoes(preco: number): string {
  const milhoes = preco / 1_000_000;
  return `R$ ${milhoes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
}

function formatMoedaInteira(preco: number): string {
  return preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function formatTextoFaixasPrecoCasas(
  medianaPreco: number,
  minPreco: number,
  maxPreco: number,
  minM2: number | null,
  maxM2: number | null,
): string {
  let texto = `Produto a ${formatVgvMilhoes(medianaPreco)} está no centro do cluster. Os preços ficam entre ${formatVgvMilhoes(minPreco)} e ${formatVgvMilhoes(maxPreco)}, todas próximas ao ticket do produto.`;
  if (minM2 != null && maxM2 != null) {
    texto += ` O R$/m² oscila entre ${formatMoedaInteira(minM2)} e ${formatMoedaInteira(maxM2)}.`;
  }
  return texto;
}

/** Textos sugeridos para pesquisa do condomínio a partir das listagens ZAP do mapa (mesmos tercis da batalha). */
export function sugestoesPrecoFaixaCondominio(
  casas: CasaMapaPreco[],
  nomeCondominio: string,
  faixaId: FaixaCondominioId,
): SugestaoPrecoFaixaCondominio | null {
  const classificadas = classificarFaixasMercado(casas as CasaRow[], { universoCortes: casas });
  const comPreco = classificadas.filter(
    (c) =>
      casaMapaPertenceCondominio(c, nomeCondominio) &&
      faixaMercadoParaFaixaCondominio(c.faixa) === faixaId &&
      c.preco != null &&
      c.preco > 0,
  );
  if (comPreco.length === 0) return null;

  const precos = comPreco.map((c) => c.preco!);
  const minPreco = Math.min(...precos);
  const maxPreco = Math.max(...precos);
  const medianaPreco = mediana(precos);
  if (medianaPreco == null) return null;

  const precosM2 = comPreco
    .map((c) => precoM2Efetivo(c))
    .filter((v): v is number => v != null && v > 0);
  const minM2 = precosM2.length > 0 ? Math.min(...precosM2) : null;
  const maxM2 = precosM2.length > 0 ? Math.max(...precosM2) : null;
  const mediaM2 =
    precosM2.length > 0 ? precosM2.reduce((a, b) => a + b, 0) / precosM2.length : null;

  const n = comPreco.length;
  const listagens = n === 1 ? 'listagem' : 'listagens';

  const q_casas_faixas_preco = formatTextoFaixasPrecoCasas(
    medianaPreco,
    minPreco,
    maxPreco,
    minM2,
    maxM2,
  );

  let q_casas_preco_m2 = '';
  if (minM2 != null && maxM2 != null && mediaM2 != null) {
    q_casas_preco_m2 = `${formatMoedaInteira(minM2)} a ${formatMoedaInteira(maxM2)}/m² (média ${formatMoedaInteira(Math.round(mediaM2))}/m²)`;
  } else if (mediaM2 != null) {
    q_casas_preco_m2 = `Média ${formatMoedaInteira(Math.round(mediaM2))}/m²`;
  }
  q_casas_preco_m2 += `${q_casas_preco_m2 ? ' — ' : ''}${n} ${listagens} ZAP`;

  return { q_casas_faixas_preco, q_casas_preco_m2 };
}

export function sugestoesPrecoMapaPorCondominio(
  casas: CasaMapaPreco[],
  nomeCondominio: string,
): Partial<Record<FaixaCondominioId, SugestaoPrecoFaixaCondominio>> {
  const out: Partial<Record<FaixaCondominioId, SugestaoPrecoFaixaCondominio>> = {};
  for (const faixaId of ['premium', 'intermediaria', 'entrada'] as FaixaCondominioId[]) {
    const sug = sugestoesPrecoFaixaCondominio(casas, nomeCondominio, faixaId);
    if (sug) out[faixaId] = sug;
  }
  return out;
}
