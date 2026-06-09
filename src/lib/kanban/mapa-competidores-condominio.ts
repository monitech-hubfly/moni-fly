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

type CasaMapaPreco = Pick<CasaRow, 'condominio' | 'preco' | 'preco_m2'>;

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
): (T & { faixa: FaixaMercado })[] {
  const { corte1, corte2 } = calcularCortes(casas);
  return casas.map((c) => ({
    ...c,
    faixa: resolverFaixa(c.preco ?? 0, corte1, corte2),
  }));
}

/** Calcula resumo das faixas: cortes de tercis + contagem por faixa. */
export function resumoFaixasMercado(casas: { preco: number | null }[]): {
  corte1: number;
  corte2: number;
  entrada: { corteMax: number; quantidade: number };
  intermediaria: { corteMin: number; corteMax: number; quantidade: number };
  premium: { corteMin: number; corteMax: number; quantidade: number };
  premium_plus: { quantidade: number };
  premium_plus2: { quantidade: number };
  premium_plus3: { quantidade: number };
} | null {
  const comPreco = casas.filter((c) => c.preco != null);
  if (comPreco.length === 0) return null;
  const { corte1, corte2 } = calcularCortes(casas);
  const faixas = comPreco.map((c) => resolverFaixa(c.preco ?? 0, corte1, corte2));
  const count = (f: FaixaMercado) => faixas.filter((x) => x === f).length;
  return {
    corte1,
    corte2,
    entrada: { corteMax: corte1, quantidade: count('entrada') },
    intermediaria: { corteMin: corte1, corteMax: corte2, quantidade: count('intermediaria') },
    premium: {
      corteMin: corte2,
      corteMax: LIMITE_PREMIUM_PLUS,
      quantidade: count('premium'),
    },
    premium_plus: { quantidade: count('premium_plus') },
    premium_plus2: { quantidade: count('premium_plus2') },
    premium_plus3: { quantidade: count('premium_plus3') },
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

const LABEL_FAIXA: Record<FaixaCondominioId, string> = {
  premium: 'Premium',
  intermediaria: 'Intermediária',
  entrada: 'Entrada',
};

/** Textos sugeridos para pesquisa do condomínio a partir das listagens ZAP do mapa. */
export function sugestoesPrecoFaixaCondominio(
  casas: CasaMapaPreco[],
  nomeCondominio: string,
  faixaId: FaixaCondominioId,
): SugestaoPrecoFaixaCondominio | null {
  const doCondominio = filtrarCasasMapaPorCondominio(casas as CasaRow[], nomeCondominio);
  const naFaixa = classificarFaixasMercado(doCondominio).filter((c) => c.faixa === faixaId);
  const comPreco = naFaixa.filter((c) => c.preco != null && c.preco > 0);
  if (comPreco.length === 0) return null;

  const precos = comPreco.map((c) => c.preco!);
  const minPreco = Math.min(...precos);
  const maxPreco = Math.max(...precos);
  const medianaPreco = mediana(precos);
  if (medianaPreco == null) return null;

  const precosM2 = comPreco
    .map((c) => c.preco_m2)
    .filter((v): v is number => v != null && v > 0);
  const minM2 = precosM2.length > 0 ? Math.min(...precosM2) : null;
  const maxM2 = precosM2.length > 0 ? Math.max(...precosM2) : null;
  const mediaM2 =
    precosM2.length > 0 ? precosM2.reduce((a, b) => a + b, 0) / precosM2.length : null;

  const n = comPreco.length;
  const listagens = n === 1 ? 'listagem' : 'listagens';
  const faixaLabel = LABEL_FAIXA[faixaId];

  let q_casas_faixas_preco = `${n} ${listagens} na faixa ${faixaLabel} (mapa ZAP). Mediana em ${formatVgvMilhoes(medianaPreco)}. Os preços ficam entre ${formatVgvMilhoes(minPreco)} e ${formatVgvMilhoes(maxPreco)}.`;
  if (minM2 != null && maxM2 != null) {
    q_casas_faixas_preco += ` O R$/m² oscila entre ${formatMoedaInteira(minM2)} e ${formatMoedaInteira(maxM2)}.`;
  }

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
