import type { RankingPorFaixaMercado } from '@/lib/kanban/pre-batalha-compatibilidade';
import { modeloElegivelParaFaixa } from '@/lib/kanban/modelo-faixa-elegibilidade';
import {
  labelFaixaMercado,
  ORDEM_FAIXAS_MERCADO,
  type FaixaMercado,
} from '@/lib/kanban/mapa-competidores-condominio';

export type ColocacaoFaixaConfigurador = {
  faixa: FaixaMercado;
  faixaLabel: string;
  posicao: number;
};

export type CasaConfiguradorRanking = {
  /** Chave estável: `catalogoId|topografia`. */
  chave: string;
  catalogoId: string;
  modelo: string;
  topografia: string;
  rotulo: string;
  colocacoesTop3: ColocacaoFaixaConfigurador[];
  colocacoesOutras: ColocacaoFaixaConfigurador[];
  descricaoColocacoes: string;
  faixasComColocacao: FaixaMercado[];
  primeiros: number;
  segundos: number;
  terceiros: number;
  /** Soma de colocações a partir do 4º lugar (elegíveis). */
  demaisColocacoes: number;
  /** Contagem por posição absoluta no ranking (1-based, só elegíveis). */
  contagemPorPosicao: Record<number, number>;
  melhorPosicao: number;
};

export type ConfiguradorCasasValoresJson = {
  v: 1;
  /** chave modelo → faixa → valor digitado (string bruta ou numérica) */
  valores: Record<string, Partial<Record<FaixaMercado, string>>>;
};

/** Chave legada BCA / custo por catálogo × topografia. */
export function chaveModeloConfigurador(catalogoId: string, topografia: string): string {
  return `${catalogoId}|${topografia.trim().toLowerCase()}`;
}

/** Chave legada agregada por nome de modelo (sem topografia). */
export function chaveCasaConfiguradorLista(modelo: string): string {
  return modelo
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function rotuloModeloTopografia(modelo: string, topografia: string): string {
  const nome = modelo.trim();
  const topo = topografia.trim().toLowerCase() || '—';
  return `${nome}/${topo}`;
}

function formatDescricaoColocacoes(colocacoes: ColocacaoFaixaConfigurador[]): string {
  if (colocacoes.length === 0) return '—';
  return [...colocacoes]
    .sort((a, b) => {
      const ordFaixa =
        ORDEM_FAIXAS_MERCADO.indexOf(a.faixa) - ORDEM_FAIXAS_MERCADO.indexOf(b.faixa);
      if (ordFaixa !== 0) return ordFaixa;
      return a.posicao - b.posicao;
    })
    .map((c) => `${c.faixaLabel} (${c.posicao}º)`)
    .join(', ');
}

function compareCasasPorColocacoes(a: CasaConfiguradorRanking, b: CasaConfiguradorRanking): number {
  const posicoes = new Set<number>([
    ...Object.keys(a.contagemPorPosicao).map(Number),
    ...Object.keys(b.contagemPorPosicao).map(Number),
    1,
    2,
    3,
  ]);
  const maxPos = Math.max(...posicoes, 1);
  for (let pos = 1; pos <= maxPos; pos++) {
    const ca = a.contagemPorPosicao[pos] ?? 0;
    const cb = b.contagemPorPosicao[pos] ?? 0;
    if (cb !== ca) return cb - ca;
  }
  if (a.melhorPosicao !== b.melhorPosicao) return a.melhorPosicao - b.melhorPosicao;
  const cmpRotulo = a.rotulo.localeCompare(b.rotulo, 'pt-BR', { sensitivity: 'base' });
  if (cmpRotulo !== 0) return cmpRotulo;
  return a.modelo.localeCompare(b.modelo, 'pt-BR', { sensitivity: 'base' });
}

/** Linhas visíveis com a tabela minimizada (top 3 do ranking). */
export const CONFIGURADOR_CASAS_LINHAS_MINIMIZADO = 3;

/**
 * Agrega combinações modelo × topografia da Pré Batalha (uma linha por par).
 * Ordenação: mais 1º → mais 2º → mais 3º → mais 4º → …
 */
export function agregarCasasConfiguradorDePreBatalha(grupos: RankingPorFaixaMercado[]): {
  casas: CasaConfiguradorRanking[];
  faixasAtivas: FaixaMercado[];
} {
  const faixasAtivas = grupos.map((g) => g.faixa);

  type Acc = {
    catalogoId: string;
    modelo: string;
    topografia: string;
    colocacoes: ColocacaoFaixaConfigurador[];
    faixasComColocacao: Set<FaixaMercado>;
    contagemPorPosicao: Record<number, number>;
    melhorPosicao: number;
  };

  const map = new Map<string, Acc>();

  for (const grupo of grupos) {
    const faixaLabel = grupo.faixaLabel || labelFaixaMercado(grupo.faixa);
    for (let i = 0; i < grupo.ranking.length; i++) {
      const item = grupo.ranking[i];
      const pos = i + 1;
      const topo = item.topografia?.trim() || '—';
      const chavePar = chaveModeloConfigurador(item.catalogoId, topo);
      let acc = map.get(chavePar);
      if (!acc) {
        acc = {
          catalogoId: item.catalogoId,
          modelo: item.modelo.trim(),
          topografia: topo,
          colocacoes: [],
          faixasComColocacao: new Set(),
          contagemPorPosicao: {},
          melhorPosicao: 99,
        };
        map.set(chavePar, acc);
      }

      if (item.elegivel === false) continue;

      acc.faixasComColocacao.add(grupo.faixa);
      if (pos < acc.melhorPosicao) acc.melhorPosicao = pos;
      acc.contagemPorPosicao[pos] = (acc.contagemPorPosicao[pos] ?? 0) + 1;
      acc.colocacoes.push({
        faixa: grupo.faixa,
        faixaLabel,
        posicao: pos,
      });
    }
  }

  const casas = [...map.values()]
    .map((acc) => {
      const colocacoesTop3 = acc.colocacoes.filter((c) => c.posicao <= 3);
      const colocacoesOutras = acc.colocacoes.filter((c) => c.posicao > 3);
      const primeiros = acc.contagemPorPosicao[1] ?? 0;
      const segundos = acc.contagemPorPosicao[2] ?? 0;
      const terceiros = acc.contagemPorPosicao[3] ?? 0;
      let demaisColocacoes = 0;
      for (const [posStr, n] of Object.entries(acc.contagemPorPosicao)) {
        const pos = Number(posStr);
        if (pos >= 4) demaisColocacoes += n;
      }
      const chave = chaveModeloConfigurador(acc.catalogoId, acc.topografia);
      const rotulo = rotuloModeloTopografia(acc.modelo, acc.topografia);
      return {
        chave,
        catalogoId: acc.catalogoId,
        modelo: acc.modelo,
        topografia: acc.topografia,
        rotulo,
        colocacoesTop3,
        colocacoesOutras,
        descricaoColocacoes: formatDescricaoColocacoes(acc.colocacoes),
        faixasComColocacao: [...acc.faixasComColocacao],
        primeiros,
        segundos,
        terceiros,
        demaisColocacoes,
        contagemPorPosicao: acc.contagemPorPosicao,
        melhorPosicao: acc.melhorPosicao === 99 ? 999 : acc.melhorPosicao,
      } satisfies CasaConfiguradorRanking;
    })
    .sort(compareCasasPorColocacoes);

  return { casas, faixasAtivas };
}

/** Mescla valores legados (por modelo ou `uuid|topografia`) para chaves atuais. */
export function mesclarValoresConfiguradorPorModelo(
  valores: ConfiguradorCasasValoresJson,
  casas: CasaConfiguradorRanking[],
): ConfiguradorCasasValoresJson {
  const merged: Record<string, Partial<Record<FaixaMercado, string>>> = {};

  for (const casa of casas) {
    const dest = { ...(merged[casa.chave] ?? {}) };

    const direto = valores.valores[casa.chave];
    if (direto) Object.assign(dest, direto);

    const chaveModelo = chaveCasaConfiguradorLista(casa.modelo);
    const legadoModelo = valores.valores[chaveModelo];
    if (legadoModelo) Object.assign(dest, legadoModelo);

    for (const [oldKey, faixas] of Object.entries(valores.valores)) {
      if (!oldKey.includes('|')) continue;
      const [catId, topoRaw] = oldKey.split('|');
      if (catId === casa.catalogoId && topoRaw === casa.topografia.trim().toLowerCase()) {
        Object.assign(dest, faixas);
      }
    }

    if (Object.keys(dest).length > 0) merged[casa.chave] = dest;
  }

  return { v: 1, valores: merged };
}

export function parseConfiguradorCasasValores(raw: string | null | undefined): ConfiguradorCasasValoresJson {
  if (!raw?.trim()) return { v: 1, valores: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<ConfiguradorCasasValoresJson>;
    if (parsed && typeof parsed === 'object' && parsed.valores && typeof parsed.valores === 'object') {
      return { v: 1, valores: parsed.valores as Record<string, Partial<Record<FaixaMercado, string>>> };
    }
  } catch {
    /* valor legado ou corrompido */
  }
  return { v: 1, valores: {} };
}

export function serializeConfiguradorCasasValores(data: ConfiguradorCasasValoresJson): string {
  return JSON.stringify({ v: 1, valores: data.valores });
}

export function parseValorMonetarioConfigurador(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === '') return null;
  const s = raw.trim();
  const v = s.includes(',')
    ? parseFloat(s.replace(/\./g, '').replace(',', '.'))
    : parseFloat(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(v) ? v : null;
}

/** Custo do configurador (fase Configurador de Casas) para modelo × faixa. */
export function resolverCustoConfigurador(
  custos: ConfiguradorCasasValoresJson,
  catalogoId: string,
  topografia: string | null | undefined,
  faixa: FaixaMercado | null | undefined,
  modeloNome?: string | null,
): number | null {
  if (!faixa) return null;

  if (modeloNome?.trim() && !modeloElegivelParaFaixa(modeloNome, faixa)) return null;

  const chave = chaveModeloConfigurador(catalogoId, topografia ?? '');
  const raw = custos.valores[chave]?.[faixa];
  const v = parseValorMonetarioConfigurador(raw);
  if (v != null) return v;

  if (modeloNome?.trim()) {
    const chaveLista = chaveCasaConfiguradorLista(modeloNome);
    const rawLista = custos.valores[chaveLista]?.[faixa];
    return parseValorMonetarioConfigurador(rawLista);
  }

  return null;
}

/** Destaque visual por pódio (1º–3º) sem ocultar demais colocações. */
export function classeDestaquePodioConfigurador(casa: CasaConfiguradorRanking): string {
  if (casa.primeiros > 0) return 'bg-amber-50/90';
  if (casa.segundos > 0) return 'bg-stone-50/95';
  if (casa.terceiros > 0) return 'bg-orange-50/50';
  return 'bg-white';
}
