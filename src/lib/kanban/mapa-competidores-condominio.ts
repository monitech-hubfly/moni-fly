import type { CasaRow } from '@/app/step-one/[id]/etapa/Etapa4Casas';
import type { LinhaProspectCondominio } from '@/lib/kanban/condominio-prospect-pesquisa';
import { condominiosMapaCompativeis } from '@/lib/zap-condominio-busca';

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

/** Classifica cada casa em faixa por tercis de VGV dentro do condomínio. */
export function classificarFaixasMercado<T extends { preco: number | null }>(
  casas: T[],
): (T & { faixa: 'entrada' | 'intermediaria' | 'premium' })[] {
  const comPreco = casas.filter((c) => c.preco != null);
  if (comPreco.length === 0) {
    return casas.map((c) => ({ ...c, faixa: 'entrada' as const }));
  }

  const ordenado = [...comPreco].sort((a, b) => (a.preco ?? 0) - (b.preco ?? 0));
  const n = ordenado.length;
  const corte1 = ordenado[Math.floor(n / 3)].preco ?? 0;
  const corte2 = ordenado[Math.floor((2 * n) / 3)].preco ?? 0;

  return casas.map((c) => {
    const preco = c.preco ?? 0;
    const faixa =
      preco <= corte1 ? 'entrada' : preco <= corte2 ? 'intermediaria' : 'premium';
    return { ...c, faixa };
  });
}

/** Calcula resumo das faixas: cortes de VGV e contagem por faixa. */
export function resumoFaixasMercado(casas: { preco: number | null }[]): {
  entrada: { corteMax: number; quantidade: number };
  intermediaria: { corteMin: number; corteMax: number; quantidade: number };
  premium: { corteMin: number; quantidade: number };
} | null {
  const comPreco = casas.filter((c) => c.preco != null);
  if (comPreco.length === 0) return null;

  const ordenado = [...comPreco].sort((a, b) => (a.preco ?? 0) - (b.preco ?? 0));
  const n = ordenado.length;
  const corte1 = ordenado[Math.floor(n / 3)].preco ?? 0;
  const corte2 = ordenado[Math.floor((2 * n) / 3)].preco ?? 0;

  return {
    entrada: {
      corteMax: corte1,
      quantidade: comPreco.filter((c) => (c.preco ?? 0) <= corte1).length,
    },
    intermediaria: {
      corteMin: corte1,
      corteMax: corte2,
      quantidade: comPreco.filter((c) => (c.preco ?? 0) > corte1 && (c.preco ?? 0) <= corte2)
        .length,
    },
    premium: {
      corteMin: corte2,
      quantidade: comPreco.filter((c) => (c.preco ?? 0) > corte2).length,
    },
  };
}
