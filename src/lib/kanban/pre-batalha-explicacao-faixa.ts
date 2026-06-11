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

function notaLoteRanking(item: RankingModeloPreBatalha): number {
  if (item.totalAtributosLote <= 0) return item.matchScore;
  return item.matchScore / item.totalAtributosLote;
}

function eixoMaisForte(item: RankingModeloPreBatalha): EixoNota {
  const eixos: { eixo: EixoNota; v: number }[] = [
    { eixo: 'Lote', v: notaLoteRanking(item) },
    { eixo: 'Preço', v: item.notaPrecoMedia },
    { eixo: 'Produto', v: item.notaProdutoMedia },
  ];
  eixos.sort((a, b) => b.v - a.v || a.eixo.localeCompare(b.eixo, 'pt-BR'));
  return eixos[0]!.eixo;
}

function eixoMaisFraco(item: RankingModeloPreBatalha): EixoNota {
  const eixos: { eixo: EixoNota; v: number }[] = [
    { eixo: 'Lote', v: notaLoteRanking(item) },
    { eixo: 'Preço', v: item.notaPrecoMedia },
    { eixo: 'Produto', v: item.notaProdutoMedia },
  ];
  eixos.sort((a, b) => a.v - b.v || a.eixo.localeCompare(b.eixo, 'pt-BR'));
  return eixos[0]!.eixo;
}

function textoEixo(eixo: EixoNota, item: RankingModeloPreBatalha): string {
  if (eixo === 'Lote') {
    if (item.matchScore >= item.totalAtributosLote && item.totalAtributosLote > 0) {
      return 'a casa coincide com todos os atributos marcados no lote (vista, mata, lago etc.)';
    }
    if (item.matchScore > 0) {
      return `a casa coincide com ${item.matchScore} de ${item.totalAtributosLote} atributos do lote`;
    }
    return 'a casa não compartilha atributos de localização com o lote escolhido';
  }
  const nota =
    eixo === 'Preço' ? item.notaPrecoMedia : item.notaProdutoMedia;
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
  if (primeiro.matchScore !== segundo.matchScore) {
    return `${primeiro.modelo} fica à frente pelo match de atributos do lote (${primeiro.matchScore}/${primeiro.totalAtributosLote} vs ${segundo.matchScore}/${segundo.totalAtributosLote} de ${segundo.modelo})`;
  }
  if (primeiro.notaPrecoMedia !== segundo.notaPrecoMedia) {
    return `${primeiro.modelo} fica à frente pela média de Preço (${primeiro.notaPrecoMedia} vs ${segundo.notaPrecoMedia})`;
  }
  if (primeiro.notaProdutoMedia !== segundo.notaProdutoMedia) {
    return `${primeiro.modelo} fica à frente pela média de Produto (${primeiro.notaProdutoMedia} vs ${segundo.notaProdutoMedia})`;
  }
  return null;
}

function explicarLider(ranking: RankingModeloPreBatalha[]): string {
  if (ranking.length === 0) return 'Não há modelos ranqueados nesta faixa.';

  const lider = ranking[0]!;
  const segundo = ranking[1];
  const compat = labelCompatibilidade(lider.notaFinal);
  const forte = eixoMaisForte(lider);

  let texto = `${lider.modelo} lidera com match de ${lider.matchScore}/${lider.totalAtributosLote} atributos do lote (nota final ${lider.notaFinal}, compatibilidade ${compat}). `;
  texto += `Seu principal diferencial nesta faixa é ${forte.toLowerCase()}: ${textoEixo(forte, lider)}. `;
  texto += `Notas parciais — Lote: ${lider.matchScore}/${lider.totalAtributosLote}, Preço: ${lider.notaPrecoMedia}, Produto: ${lider.notaProdutoMedia}.`;

  if (segundo) {
    const desempate = motivoDesempate(lider, segundo);
    if (desempate) {
      texto += ` ${desempate}.`;
    } else if (lider.matchScore > segundo.matchScore) {
      texto += ` Fica à frente de ${segundo.modelo} pelo match de atributos (${lider.matchScore}/${lider.totalAtributosLote} vs ${segundo.matchScore}/${segundo.totalAtributosLote}).`;
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

  if (ultimo.matchScore >= lider.matchScore && ultimo.notaFinal >= lider.notaFinal) return null;

  return `${ultimo.modelo} aparece por último entre os elegíveis (match ${ultimo.matchScore}/${ultimo.totalAtributosLote}, final ${ultimo.notaFinal}) principalmente porque ${textoEixo(fraco, ultimo)}.`;
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
  const anunciosTxt =
    quantidadeAnuncios === 1 ? '1 anúncio' : `${quantidadeAnuncios} anúncios`;
  const batalhasTxt =
    batalhas.length === 1 ? '1 confronto' : `${batalhas.length} confrontos`;

  const paragrafos: string[] = [
    `Faixa ${faixaLabel}: ${DESCRICAO_FAIXA[faixa]}. Foram considerados ${anunciosTxt} deste segmento no Mapa de Competidores.`,
    `Só entram modelos Moní autorizados para esta faixa: ${elegiveis.join(', ')}. Cada um foi comparado individualmente com todos os anúncios da faixa (${batalhasTxt} no total).`,
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
