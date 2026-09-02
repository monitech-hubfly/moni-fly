/** Labels de checklist da fase Pré Batalha (Funil Step One, slug `batalha`). */

import { formatModeloTopografia, formatConfrontosModeloGEP, type RankingPorFaixaMercado } from '@/lib/kanban/pre-batalha-compatibilidade';
import { formatExplicacaoRankingFaixaChecklist } from '@/lib/kanban/pre-batalha-explicacao-faixa';

export const PRE_BATALHA_CHECKLIST_LABEL_APLICADA =
  'Pré-batalha aplicada (match lote + Preço + Produto)';

export const PRE_BATALHA_CHECKLIST_LABEL_RANKING =
  'Ranking inicial — casas candidatas confirmadas';

export type RankingInicialChecklistItem = {
  modelo: string;
  topografia: string;
  notaFinal: number;
  matchScore?: number;
  totalAtributosLote?: number;
  notaLote?: number;
  notaPreco?: number;
  notaProduto?: number;
  confrontosModelos?: { ganhos: number; empates: number; perdas: number };
};

export type RankingInicialGrupoFaixa = {
  faixaLabel: string;
  quantidadeAnuncios: number;
  itens: RankingInicialChecklistItem[];
};

/** Instruções principais da fase Pré Batalha (Kanban `kanban_fases.instrucoes`). */
export const PRE_BATALHA_INSTRUCOES_FASE = `Com o mapa de competidores preenchido e os atributos do lote definidos em Lotes Disponíveis, o sistema ranqueia automaticamente todos os modelos Moní do catálogo, separados por faixa de mercado (Entrada, Intermediária, Premium, Premium+, etc.).

Em cada faixa, cada modelo elegível batalha contra todos os anúncios daquela faixa nos eixos Preço e Produto.`;

/** Texto fixo exibido após as instruções da fase (Kanban) na Pré Batalha. */
export const PRE_BATALHA_TEXTO_EXPLICATIVO_RANKING = `Por que este ranking?

Cada modelo só aparece nas faixas em que é elegível (ex.: Lu/Isa/Val só Entrada; Liz/Ivy/Mia/Cissa/Sol Entrada e Intermediária; Eva/Gal Premium e Premium+; Lena Premium+ em diante).

Ordem entre modelos elegíveis:
1. Match de atributos do lote — quantos atributos marcados no lote a casa também possui no catálogo (vista, mata, lago, etc.)
2. Topografia — modelos com topografia diferente do lote vão ao final, sem pontuação
3. Desempate: média de Preço (VGV INC + Kit Moní vs anúncios) e depois Produto (quartos, banheiros, vagas, metragem)

A nota final (Preço + Produto) resume o encaixe frente aos anúncios da faixa; o match de atributos do lote ordena o ranking mas não soma pontos. G/E/P nos confrontos entre modelos também usam só Preço + Produto.`;

export function rankingGruposFromPorFaixas(
  grupos: RankingPorFaixaMercado[],
): RankingInicialGrupoFaixa[] {
  return grupos.map((g) => ({
    faixaLabel: g.faixaLabel,
    quantidadeAnuncios: g.quantidadeAnuncios,
    itens: g.ranking.map((r) => ({
      modelo: r.modelo,
      topografia: r.topografia,
      notaFinal: r.notaFinal,
      matchScore: r.matchScore,
      totalAtributosLote: r.totalAtributosLote,
      notaLote: r.notaLote,
      notaPreco: r.notaPrecoMedia,
      notaProduto: r.notaProdutoMedia,
      confrontosModelos: r.confrontosModelos,
    })),
  }));
}

function formatLinhaRankingPreBatalha(item: RankingInicialChecklistItem, idx: number): string {
  const rotulo = formatModeloTopografia(item.modelo, item.topografia);
  const detalhe =
    item.matchScore != null && item.totalAtributosLote != null
      ? ` | Lote:${item.matchScore}/${item.totalAtributosLote} P:${item.notaPreco ?? '—'} Prod:${item.notaProduto ?? '—'}`
      : item.notaLote != null && item.notaPreco != null && item.notaProduto != null
        ? ` | L:${item.notaLote} P:${item.notaPreco} Prod:${item.notaProduto}`
        : '';
  const confrontos = item.confrontosModelos
    ? ` | ${formatConfrontosModeloGEP(item.confrontosModelos)}`
    : '';
  return `${idx + 1}º ${rotulo} (Final: ${item.notaFinal}${detalhe}${confrontos})`;
}

/** Formato checklist — seções por faixa, uma linha por modelo. */
export function formatRankingInicialChecklistPreBatalha(
  grupos: RankingInicialGrupoFaixa[],
): string {
  const blocos: string[] = [];
  for (const g of grupos) {
    if (g.itens.length === 0) continue;
    blocos.push(
      `[${g.faixaLabel} — ${g.quantidadeAnuncios} ${g.quantidadeAnuncios === 1 ? 'anúncio' : 'anúncios'}]`,
    );
    g.itens.forEach((item, idx) => {
      blocos.push(formatLinhaRankingPreBatalha(item, idx));
    });
    blocos.push('');
  }
  return blocos.join('\n').trim();
}

function formatPrecoChecklist(preco: number): string {
  if (!Number.isFinite(preco) || preco <= 0) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(preco);
}

function formatLinhaBatalhaPreBatalha(
  b: RankingPorFaixaMercado['batalhas'][number],
): string {
  const rotulo = formatModeloTopografia(b.modelo, b.topografia);
  const precoAnuncio = formatPrecoChecklist(b.precoAnuncio);
  const precoMoni =
    b.precoIncKitMoni != null && b.precoIncKitMoni > 0
      ? formatPrecoChecklist(b.precoIncKitMoni)
      : '—';
  return `${rotulo} vs ${b.condominio} (Anúncio: ${precoAnuncio} | Moní: ${precoMoni}) → Match:${b.matchScore}/${b.totalAtributosLote} P:${b.notaPreco} Prod:${b.notaProduto} (Final:${b.notaFinalLinha})`;
}

/**
 * Checklist completo: batalhas modelo × anúncio por faixa, depois ranking agregado.
 */
export function formatPreBatalhaChecklistCompleto(grupos: RankingPorFaixaMercado[]): string {
  const blocos: string[] = [];

  for (const g of grupos) {
    if (g.batalhas.length === 0 && g.ranking.length === 0) continue;

    blocos.push(
      `[${g.faixaLabel} — ${g.quantidadeAnuncios} ${g.quantidadeAnuncios === 1 ? 'anúncio' : 'anúncios'}]`,
    );
    blocos.push('');
    const explicacao = formatExplicacaoRankingFaixaChecklist(g);
    if (explicacao) {
      blocos.push(explicacao);
      blocos.push('');
    }
    blocos.push('— Batalhas (modelo × anúncio) —');
    for (const b of g.batalhas) {
      blocos.push(formatLinhaBatalhaPreBatalha(b));
    }
    blocos.push('');
    blocos.push('— Ranking agregado —');
    g.ranking.forEach((item, idx) => {
      blocos.push(
        formatLinhaRankingPreBatalha(
          {
            modelo: item.modelo,
            topografia: item.topografia,
            notaFinal: item.notaFinal,
            notaLote: item.notaLote,
            notaPreco: item.notaPrecoMedia,
            notaProduto: item.notaProdutoMedia,
            matchScore: item.matchScore,
            totalAtributosLote: item.totalAtributosLote,
            confrontosModelos: item.confrontosModelos,
          },
          idx,
        ),
      );
    });
    blocos.push('');
  }

  return blocos.join('\n').trim();
}

/** Converte lista plana legada em um único grupo (retrocompat). */
export function rankingGrupoUnicoFromItens(
  itens: RankingInicialChecklistItem[],
  faixaLabel = 'Geral',
  quantidadeAnuncios = 0,
): RankingInicialGrupoFaixa[] {
  if (itens.length === 0) return [];
  return [{ faixaLabel, quantidadeAnuncios, itens }];
}
