/** Labels de checklist da fase Pré Batalha (Funil Step One, slug `batalha`). */

import type { RankingPorFaixaMercado } from '@/lib/kanban/pre-batalha-compatibilidade';

export const PRE_BATALHA_CHECKLIST_LABEL_APLICADA =
  'Pré-batalha aplicada (Produto + Localização)';

export const PRE_BATALHA_CHECKLIST_LABEL_RANKING =
  'Ranking inicial — casas candidatas confirmadas';

export type RankingInicialChecklistItem = {
  modelo: string;
  topografia: string;
  notaFinal: number;
  notaLote?: number;
  notaPreco?: number;
  notaProduto?: number;
};

export type RankingInicialGrupoFaixa = {
  faixaLabel: string;
  quantidadeAnuncios: number;
  itens: RankingInicialChecklistItem[];
};

/** Texto fixo exibido acima do campo de ranking (Kanban e etapa Pré Batalha). */
export const PRE_BATALHA_TEXTO_EXPLICATIVO_RANKING = `Por que este ranking?

Com o Mapa de Competidores preenchido e a topografia do lote definida em Lotes Disponíveis, o sistema ranqueia todos os modelos Moní compatíveis com o lote, separados por faixa de mercado (Entrada, Intermediária, Premium, etc.).

Cada modelo só aparece nas faixas em que é elegível (ex.: Lu/Isa/Val só Entrada; Liz/Ivy/Mia/Cissa/Sol Entrada e Intermediária; Eva/Gal Premium e Premium+; Lena Premium+ em diante).

Em cada faixa, cada modelo elegível batalha contra todos os anúncios daquela faixa nos três eixos:
• Lote — atributos de localização do lote escolhido
• Preço — VGV Moní (preço INC + Kit Moní do catálogo) vs. preço de cada anúncio
• Produto — quartos, banheiros, vagas e metragem vs. cada anúncio

Nota final = Lote + Preço + Produto (médias na faixa). Quanto maior, melhor o encaixe. Todos os modelos elegíveis aparecem em cada faixa com anúncios. Desempate: Lote > Preço > Produto.`;

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
      notaLote: r.notaLote,
      notaPreco: r.notaPrecoMedia,
      notaProduto: r.notaProdutoMedia,
    })),
  }));
}

function formatLinhaRankingPreBatalha(item: RankingInicialChecklistItem, idx: number): string {
  const palavra = item.modelo.trim().split(/\s+/)[0] || item.modelo.trim();
  const abrev = palavra.length <= 4 ? palavra : palavra.slice(0, 3);
  const topoRaw = item.topografia.trim().toLowerCase();
  const topoSlug = topoRaw === '—' || !topoRaw ? '—' : topoRaw;
  const detalhe =
    item.notaLote != null && item.notaPreco != null && item.notaProduto != null
      ? ` | L:${item.notaLote} P:${item.notaPreco} Prod:${item.notaProduto}`
      : '';
  return `${idx + 1}º ${abrev}/${topoSlug} (Final: ${item.notaFinal}${detalhe})`;
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
  const palavra = b.modelo.trim().split(/\s+/)[0] || b.modelo.trim();
  const abrev = palavra.length <= 4 ? palavra : palavra.slice(0, 3);
  const topoRaw = b.topografia.trim().toLowerCase();
  const topoSlug = topoRaw === '—' || !topoRaw ? '—' : topoRaw;
  const precoAnuncio = formatPrecoChecklist(b.precoAnuncio);
  const precoMoni =
    b.precoIncKitMoni != null && b.precoIncKitMoni > 0
      ? formatPrecoChecklist(b.precoIncKitMoni)
      : '—';
  return `${abrev}/${topoSlug} vs ${b.condominio} (Anúncio: ${precoAnuncio} | Moní: ${precoMoni}) → L:${b.notaLote} P:${b.notaPreco} Prod:${b.notaProduto} (Final:${b.notaFinalLinha})`;
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
