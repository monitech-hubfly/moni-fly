import { FASE_SLUGS } from '@/lib/constants/kanban-ids';
import { isCheckboxTrue } from '@/lib/kanban/checklist-compartilhado';
import {
  itensPendenciaPontoJuridico,
  pendenciaRepositorioPonto,
  rotuloPendenciaRepositorio,
  type JuridicoPontoConclusao,
} from '@/lib/kanban/juridico-pontos';

/** Checklist da fase Pós-Assinatura. Não é campo novo. */
export const CAMPO_DOCUMENTO_FINAL_ASSINADO = 'juridico_contrato_anexado';

export type PontoParaPendenciaAtendimento = JuridicoPontoConclusao & {
  id: string;
  temVersaoRepositorio?: boolean;
};

export type ItemPendenciaAtendimento = {
  id: string;
  origem: string;
  acao: string;
  aplicacao?: string | null;
};

export type PendenciasAtendimentoJuridico = {
  documentoFinalAssinado: boolean;
  pontosIncompletos: ItemPendenciaAtendimento[];
  faqPendentes: ItemPendenciaAtendimento[];
  faqResolvidas: number;
  repositorioPendentes: ItemPendenciaAtendimento[];
  repositorioConcluidas: number;
};

export function documentoFinalAssinadoRegistrado(input: {
  valor?: string | null;
  arquivoPath?: string | null;
}): boolean {
  if (String(input.arquivoPath ?? '').trim()) return true;
  return isCheckboxTrue(input.valor);
}

function origemDoPonto(ponto: PontoParaPendenciaAtendimento): string {
  if (String(ponto.tipo ?? '') === 'duvida') {
    return String(ponto.duvidaRecebida ?? '').trim() || 'Dúvida';
  }
  return String(ponto.clausulaTrecho ?? '').trim() || String(ponto.solicitacaoAlteracao ?? '').trim() || 'Alteração';
}

/**
 * Única lista do que falta para sair de Pós-Assinatura e entrar em Atendimentos Concluídos.
 * FAQ e Repositório usam as regras já existentes dos Pontos Jurídicos.
 */
export function avaliarPendenciasAtendimentoJuridico(
  documentoFinalAssinado: boolean,
  pontos: readonly PontoParaPendenciaAtendimento[],
): PendenciasAtendimentoJuridico {
  const pontosIncompletos: ItemPendenciaAtendimento[] = [];
  const faqPendentes: ItemPendenciaAtendimento[] = [];
  const repositorioPendentes: ItemPendenciaAtendimento[] = [];
  let faqResolvidas = 0;
  let repositorioConcluidas = 0;

  for (const ponto of pontos) {
    const origem = origemDoPonto(ponto);
    const itens = itensPendenciaPontoJuridico(ponto);
    const retroalimentarSemArtigo =
      ponto.faqStatus === 'retroalimentar' && !String(ponto.faqArticleId ?? '').trim();
    const faltas = itens
      .filter((item) => !(retroalimentarSemArtigo && item.codigo === 'faq_article'))
      .map((item) => item.mensagem);
    if (faltas.length > 0) {
      pontosIncompletos.push({ id: ponto.id, origem, acao: faltas.join(' ') });
    }

    if (retroalimentarSemArtigo) {
      faqPendentes.push({
        id: ponto.id,
        origem,
        acao: 'Enviar para a Central de Ajuda.',
      });
    } else if (
      (ponto.faqStatus === 'retroalimentar' || ponto.faqStatus === 'ja_existe') &&
      String(ponto.faqArticleId ?? '').trim()
    ) {
      faqResolvidas += 1;
    }

    const repo = pendenciaRepositorioPonto({
      tipo: ponto.tipo,
      decisao: ponto.decisao,
      aplicacaoFutura: ponto.aplicacaoFutura,
      temVersaoRepositorio: ponto.temVersaoRepositorio === true,
    });
    if (repo === 'pendente') {
      repositorioPendentes.push({
        id: ponto.id,
        origem,
        aplicacao: ponto.aplicacaoFutura ?? null,
        acao: rotuloPendenciaRepositorio({
          tipo: ponto.tipo,
          decisao: ponto.decisao,
          aplicacaoFutura: ponto.aplicacaoFutura,
          temVersaoRepositorio: false,
        }) ?? 'Resolver no Repositório.',
      });
    } else if (repo === 'concluida') {
      repositorioConcluidas += 1;
    }
  }

  return {
    documentoFinalAssinado,
    pontosIncompletos,
    faqPendentes,
    faqResolvidas,
    repositorioPendentes,
    repositorioConcluidas,
  };
}

export function atendimentoJuridicoSemPendencia(pendencias: PendenciasAtendimentoJuridico): boolean {
  return (
    pendencias.documentoFinalAssinado &&
    pendencias.pontosIncompletos.length === 0 &&
    pendencias.faqPendentes.length === 0 &&
    pendencias.repositorioPendentes.length === 0
  );
}

function linhaContagem(n: number, um: string, varios: string): string {
  return n === 1 ? um : varios.replace('{n}', String(n));
}

/** Mensagem do gate. Null quando a conclusão é permitida. */
export function mensagemPendenciasAtendimentoJuridico(pendencias: PendenciasAtendimentoJuridico): string | null {
  if (atendimentoJuridicoSemPendencia(pendencias)) return null;
  const linhas: string[] = [];
  if (!pendencias.documentoFinalAssinado) linhas.push('Anexar documento final assinado');
  if (pendencias.pontosIncompletos.length > 0) {
    linhas.push(
      linhaContagem(
        pendencias.pontosIncompletos.length,
        '1 ponto jurídico incompleto',
        '{n} pontos jurídicos incompletos',
      ),
    );
  }
  if (pendencias.faqPendentes.length > 0) {
    linhas.push(
      linhaContagem(
        pendencias.faqPendentes.length,
        '1 retroalimentação da Central de Ajuda',
        '{n} retroalimentações da Central de Ajuda',
      ),
    );
  }
  if (pendencias.repositorioPendentes.length > 0) {
    linhas.push(
      linhaContagem(
        pendencias.repositorioPendentes.length,
        '1 atualização do Repositório',
        '{n} atualizações do Repositório',
      ),
    );
  }
  return `Este atendimento ainda possui pendências antes da conclusão:\n\n${linhas.map((linha) => `• ${linha}`).join('\n')}`;
}

/**
 * O gate de pendências (FAQ, Repositório, pontos, documento) só vale na saída
 * da fase 7 para Atendimentos Concluídos. Entrar na fase 7 não é bloqueado.
 */
export function movimentoExigeGateConclusaoAtendimentoJuridico(
  faseDestinoSlug: string | null | undefined,
): boolean {
  return String(faseDestinoSlug ?? '').trim() === FASE_SLUGS.JURIDICO_ATENDIMENTOS_CONCLUIDOS;
}

/** Saída de Em alterações e respostas para Enviado ao Parceiro. Não vale em outro destino. */
export function movimentoExigeGatePontosRodadaJuridico(
  faseDestinoSlug: string | null | undefined,
): boolean {
  return String(faseDestinoSlug ?? '').trim() === FASE_SLUGS.JURIDICO_ENVIADO_PARCEIRO;
}
