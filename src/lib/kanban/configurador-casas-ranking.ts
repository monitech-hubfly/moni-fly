import {
  formatModeloTopografia,
  type RankingPorFaixaMercado,
} from '@/lib/kanban/pre-batalha-compatibilidade';
import {
  labelFaixaMercado,
  ORDEM_FAIXAS_MERCADO,
  type FaixaMercado,
} from '@/lib/kanban/mapa-competidores-condominio';

export type ColocacaoFaixaConfigurador = {
  faixa: FaixaMercado;
  faixaLabel: string;
  posicao: 1 | 2 | 3;
};

export type CasaConfiguradorRanking = {
  chave: string;
  catalogoId: string;
  modelo: string;
  topografia: string;
  rotulo: string;
  colocacoesTop3: ColocacaoFaixaConfigurador[];
  descricaoColocacoes: string;
  primeiros: number;
  segundos: number;
  terceiros: number;
};

export type ConfiguradorCasasValoresJson = {
  v: 1;
  /** chave modelo → faixa → valor digitado (string bruta ou numérica) */
  valores: Record<string, Partial<Record<FaixaMercado, string>>>;
};

export function chaveModeloConfigurador(catalogoId: string, topografia: string): string {
  return `${catalogoId}|${topografia.trim().toLowerCase()}`;
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

/**
 * Agrega modelos únicos da Pré Batalha, ordenados por pódios (1º → 2º → 3º).
 * Inclui todos os elegíveis em alguma faixa; a descrição cita só faixas com top 3.
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
    colocacoesTop3: ColocacaoFaixaConfigurador[];
    primeiros: number;
    segundos: number;
    terceiros: number;
    melhorPosicao: number;
  };

  const map = new Map<string, Acc>();

  for (const grupo of grupos) {
    const elegiveis = grupo.ranking.filter((r) => r.elegivel !== false);
    for (let i = 0; i < elegiveis.length; i++) {
      const item = elegiveis[i];
      const pos = i + 1;
      const chave = chaveModeloConfigurador(item.catalogoId, item.topografia);
      let acc = map.get(chave);
      if (!acc) {
        acc = {
          catalogoId: item.catalogoId,
          modelo: item.modelo,
          topografia: item.topografia,
          colocacoesTop3: [],
          primeiros: 0,
          segundos: 0,
          terceiros: 0,
          melhorPosicao: 99,
        };
        map.set(chave, acc);
      }
      if (pos < acc.melhorPosicao) acc.melhorPosicao = pos;
      if (pos > 3) continue;
      const posTop: 1 | 2 | 3 = pos as 1 | 2 | 3;
      acc.colocacoesTop3.push({
        faixa: grupo.faixa,
        faixaLabel: grupo.faixaLabel || labelFaixaMercado(grupo.faixa),
        posicao: posTop,
      });
      if (posTop === 1) acc.primeiros++;
      else if (posTop === 2) acc.segundos++;
      else acc.terceiros++;
    }
  }

  const casas = [...map.values()]
    .sort((a, b) => {
      if (b.primeiros !== a.primeiros) return b.primeiros - a.primeiros;
      if (b.segundos !== a.segundos) return b.segundos - a.segundos;
      if (b.terceiros !== a.terceiros) return b.terceiros - a.terceiros;
      if (a.melhorPosicao !== b.melhorPosicao) return a.melhorPosicao - b.melhorPosicao;
      return a.modelo.localeCompare(b.modelo, 'pt-BR');
    })
    .map((acc) => ({
      chave: chaveModeloConfigurador(acc.catalogoId, acc.topografia),
      catalogoId: acc.catalogoId,
      modelo: acc.modelo,
      topografia: acc.topografia,
      rotulo: formatModeloTopografia(acc.modelo, acc.topografia),
      colocacoesTop3: acc.colocacoesTop3,
      descricaoColocacoes: formatDescricaoColocacoes(acc.colocacoesTop3),
      primeiros: acc.primeiros,
      segundos: acc.segundos,
      terceiros: acc.terceiros,
    }));

  return { casas, faixasAtivas };
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
): number | null {
  if (!faixa) return null;
  const chave = chaveModeloConfigurador(catalogoId, topografia ?? '');
  const raw = custos.valores[chave]?.[faixa];
  return parseValorMonetarioConfigurador(raw);
}
