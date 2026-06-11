/**
 * Texto explicativo do ranking Pré Batalha por faixa — linguagem acessível,
 * sem exigir conhecimento prévio das regras de pontuação.
 */

import {
  labelCompatibilidade,
  type RankingPorFaixaMercado,
  type RankingModeloPreBatalha,
} from '@/lib/kanban/pre-batalha-compatibilidade';
import {
  FAIXAS_ELEGIVEIS_POR_MODELO,
  type ModeloMoniSlug,
} from '@/lib/kanban/modelo-faixa-elegibilidade';
import type { FaixaMercado } from '@/lib/kanban/mapa-competidores-condominio';

const NOME_MODELO: Record<ModeloMoniSlug, string> = {
  lu: 'Lu',
  isa: 'Isa',
  val: 'Val',
  liz: 'Liz',
  ivy: 'Ivy',
  mia: 'Mia',
  cissa: 'Cissa',
  sol: 'Sol',
  eva: 'Eva',
  gal: 'Gal',
  lena: 'Lena',
};

const DESCRICAO_FAIXA: Record<FaixaMercado, string> = {
  entrada:
    'segmento de preços mais acessível do condomínio (terço inferior dos anúncios mapeados no Mapa de Competidores)',
  intermediaria:
    'segmento de preços intermediário (terço central do mercado local mapeado)',
  premium:
    'segmento premium (terço superior de preços do mapa, abaixo de R$ 10 milhões)',
  premium_plus: 'imóveis anunciados a partir de R$ 10 milhões',
  premium_plus2: 'imóveis anunciados a partir de R$ 15 milhões',
  premium_plus3: 'imóveis anunciados a partir de R$ 20 milhões',
};

type EixoNota = 'Lote' | 'Preço' | 'Produto';

function modelosElegiveisFaixa(faixa: FaixaMercado): string[] {
  return (Object.keys(FAIXAS_ELEGIVEIS_POR_MODELO) as ModeloMoniSlug[])
    .filter((slug) => FAIXAS_ELEGIVEIS_POR_MODELO[slug].includes(faixa))
    .map((slug) => NOME_MODELO[slug]);
}

function eixoMaisForte(item: RankingModeloPreBatalha): EixoNota {
  const eixos: { eixo: EixoNota; v: number }[] = [
    { eixo: 'Lote', v: item.notaLote },
    { eixo: 'Preço', v: item.notaPrecoMedia },
    { eixo: 'Produto', v: item.notaProdutoMedia },
  ];
  eixos.sort((a, b) => b.v - a.v || a.eixo.localeCompare(b.eixo, 'pt-BR'));
  return eixos[0]!.eixo;
}

function eixoMaisFraco(item: RankingModeloPreBatalha): EixoNota {
  const eixos: { eixo: EixoNota; v: number }[] = [
    { eixo: 'Lote', v: item.notaLote },
    { eixo: 'Preço', v: item.notaPrecoMedia },
    { eixo: 'Produto', v: item.notaProdutoMedia },
  ];
  eixos.sort((a, b) => a.v - b.v || a.eixo.localeCompare(b.eixo, 'pt-BR'));
  return eixos[0]!.eixo;
}

function textoEixo(eixo: EixoNota, nota: number): string {
  if (eixo === 'Lote') {
    if (nota >= 1.5) return 'o lote escolhido agrega valor (vista, área verde, lago etc.)';
    if (nota >= 0) return 'o lote tem atributos neutros ou levemente positivos';
    return 'o lote tem atributos que reduzem a atratividade (ex.: proximidade de lixeira, muro com rodovia)';
  }
  if (eixo === 'Preço') {
    if (nota >= 0.5) return 'o VGV Moní (INC + Kit) tende a ficar abaixo ou alinhado aos anúncios desta faixa';
    if (nota >= 0) return 'o preço Moní está próximo da média dos anúncios';
    return 'o VGV Moní tende a ficar acima dos anúncios desta faixa, o que pesa contra a competitividade';
  }
  if (nota >= 0.5) return 'quartos, banheiros, vagas e metragem encaixam bem com a maioria dos anúncios';
  if (nota >= 0) return 'o produto Moní é comparável ao padrão dos anúncios';
  return 'o produto Moní diverge do padrão dos anúncios (tamanho ou configuração menos competitivos)';
}

function motivoDesempate(
  primeiro: RankingModeloPreBatalha,
  segundo: RankingModeloPreBatalha,
): string | null {
  if (primeiro.notaFinal !== segundo.notaFinal) return null;
  if (primeiro.notaLote !== segundo.notaLote) {
    return `empate na nota final (${primeiro.notaFinal}); ${primeiro.modelo} fica à frente porque a nota de Lote (${primeiro.notaLote}) supera a de ${segundo.modelo} (${segundo.notaLote})`;
  }
  if (primeiro.notaPrecoMedia !== segundo.notaPrecoMedia) {
    return `empate na nota final (${primeiro.notaFinal}); ${primeiro.modelo} fica à frente pela média de Preço (${primeiro.notaPrecoMedia} vs ${segundo.notaPrecoMedia})`;
  }
  if (primeiro.notaProdutoMedia !== segundo.notaProdutoMedia) {
    return `empate na nota final (${primeiro.notaFinal}); ${primeiro.modelo} fica à frente pela média de Produto (${primeiro.notaProdutoMedia} vs ${segundo.notaProdutoMedia})`;
  }
  return null;
}

function explicarLider(ranking: RankingModeloPreBatalha[]): string {
  if (ranking.length === 0) return 'Não há modelos ranqueados nesta faixa.';

  const lider = ranking[0]!;
  const segundo = ranking[1];
  const compat = labelCompatibilidade(lider.notaFinal);
  const forte = eixoMaisForte(lider);
  const notaForte =
    forte === 'Lote'
      ? lider.notaLote
      : forte === 'Preço'
        ? lider.notaPrecoMedia
        : lider.notaProdutoMedia;

  let texto = `${lider.modelo} lidera com nota final ${lider.notaFinal} (compatibilidade ${compat}). `;
  texto += `Seu principal diferencial nesta faixa é ${forte.toLowerCase()}: ${textoEixo(forte, notaForte)}. `;
  texto += `Notas parciais — Lote: ${lider.notaLote}, Preço: ${lider.notaPrecoMedia}, Produto: ${lider.notaProdutoMedia}.`;

  if (segundo) {
    const desempate = motivoDesempate(lider, segundo);
    if (desempate) {
      texto += ` ${desempate}.`;
    } else if (lider.notaFinal > segundo.notaFinal) {
      texto += ` Fica ${(lider.notaFinal - segundo.notaFinal).toFixed(1).replace(/\.0$/, '')} ponto(s) acima de ${segundo.modelo} (${segundo.notaFinal}).`;
    }
  }

  return texto;
}

function explicarCauda(ranking: RankingModeloPreBatalha[]): string | null {
  if (ranking.length < 2) return null;
  const ultimo = ranking[ranking.length - 1]!;
  const lider = ranking[0]!;
  if (ultimo.catalogoId === lider.catalogoId) return null;

  const fraco = eixoMaisFraco(ultimo);
  const notaFraca =
    fraco === 'Lote'
      ? ultimo.notaLote
      : fraco === 'Preço'
        ? ultimo.notaPrecoMedia
        : ultimo.notaProdutoMedia;

  if (ultimo.notaFinal >= lider.notaFinal) return null;

  return `${ultimo.modelo} aparece por último (${ultimo.notaFinal}) principalmente porque ${textoEixo(fraco, notaFraca)} — eixo ${fraco.toLowerCase()} com nota ${notaFraca}.`;
}

function resumirCompatibilidade(ranking: RankingModeloPreBatalha[]): string {
  const altas = ranking.filter((r) => labelCompatibilidade(r.notaFinal) === 'Alta').length;
  const medias = ranking.filter((r) => labelCompatibilidade(r.notaFinal) === 'Média').length;
  const baixas = ranking.filter((r) => labelCompatibilidade(r.notaFinal) === 'Baixa').length;

  const partes: string[] = [];
  if (altas) partes.push(`${altas} com compatibilidade Alta (nota ≥ 1,5)`);
  if (medias) partes.push(`${medias} com Média (0 a 1,4)`);
  if (baixas) partes.push(`${baixas} com Baixa (< 0)`);

  if (partes.length === 0) return '';
  return `Nesta faixa: ${partes.join('; ')}. Alta indica encaixe forte; Média pede análise caso a caso; Baixa sinaliza desvantagem relevante frente aos anúncios mapeados.`;
}

/** Gera parágrafos explicativos do ranking de uma faixa (para UI e checklist). */
export function gerarExplicacaoRankingFaixaPreBatalha(
  grupo: RankingPorFaixaMercado,
): string[] {
  const { faixa, faixaLabel, quantidadeAnuncios, ranking, batalhas } = grupo;
  if (ranking.length === 0 && batalhas.length === 0) return [];

  const rankingElegiveis = ranking.filter((r) => r.elegivel !== false);
  const elegiveis = modelosElegiveisFaixa(faixa);
  const notaLote = rankingElegiveis[0]?.notaLote ?? 0;
  const anunciosTxt =
    quantidadeAnuncios === 1 ? '1 anúncio' : `${quantidadeAnuncios} anúncios`;
  const batalhasTxt =
    batalhas.length === 1 ? '1 confronto' : `${batalhas.length} confrontos`;

  const paragrafos: string[] = [
    `Faixa ${faixaLabel}: ${DESCRICAO_FAIXA[faixa]}. Foram considerados ${anunciosTxt} deste segmento no Mapa de Competidores.`,
    `Só entram modelos Moní autorizados para esta faixa: ${elegiveis.join(', ')}. Cada um foi comparado individualmente com todos os anúncios da faixa (${batalhasTxt} no total).`,
    `A nota final de cada modelo soma três critérios, de −3 a +2 cada: Lote (atributos do lote escolhido em Lotes Disponíveis), Preço (VGV Moní INC + Kit vs preço de cada anúncio) e Produto (quartos, banheiros, vagas e metragem vs cada anúncio). Preço e Produto entram como média dos confrontos da faixa. Todos partem com a mesma nota de Lote (${notaLote}), pois o lote é único para o projeto.`,
    explicarLider(rankingElegiveis),
  ];

  const cauda = explicarCauda(rankingElegiveis);
  if (cauda) paragrafos.push(cauda);

  const compat = resumirCompatibilidade(rankingElegiveis);
  if (compat) paragrafos.push(compat);

  return paragrafos;
}

/** Texto contínuo para checklist (parágrafos separados por linha em branco). */
export function formatExplicacaoRankingFaixaChecklist(grupo: RankingPorFaixaMercado): string {
  const paragrafos = gerarExplicacaoRankingFaixaPreBatalha(grupo);
  if (paragrafos.length === 0) return '';
  return ['— Por que este ranking nesta faixa? —', '', ...paragrafos].join('\n');
}
