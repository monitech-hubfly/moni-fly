import {
  pontosIncompletosDaRodada,
  rodadaAtualJuridico,
  type JuridicoPontoConclusao,
} from '@/lib/kanban/juridico-pontos';

export type PontoRespostaRodada = JuridicoPontoConclusao & {
  rodada?: number | null;
  ordem?: number | null;
};

export type RespostaRodadaGerada = {
  ok: true;
  texto: string;
  textosFinais: string[];
};

export type RespostaRodadaBloqueada = {
  ok: false;
  mensagem: string;
};

function campo(valor: string | null | undefined): string {
  return String(valor ?? '').trim();
}

function blocoDuvida(ponto: PontoRespostaRodada): string {
  return ['DÚVIDA', 'Pergunta:', campo(ponto.duvidaRecebida), '', 'Resposta:', campo(ponto.resposta)].join('\n');
}

function blocoAlteracao(ponto: PontoRespostaRodada): string {
  const decisao = String(ponto.decisao ?? '');
  const titulo =
    decisao === 'aceita_parcialmente'
      ? 'ALTERAÇÃO ACEITA PARCIALMENTE'
      : decisao === 'nao_aceita'
        ? 'ALTERAÇÃO NÃO ACEITA'
        : 'ALTERAÇÃO ACEITA';
  const linhas = [titulo];
  const trecho = campo(ponto.clausulaTrecho);
  if (trecho) {
    linhas.push('Trecho / cláusula:', trecho, '');
  }
  linhas.push('Solicitação:', campo(ponto.solicitacaoAlteracao), '', 'Resposta:');
  if (decisao === 'nao_aceita') {
    linhas.push(campo(ponto.motivoResposta));
    return linhas.join('\n');
  }
  linhas.push(
    decisao === 'aceita_parcialmente' ? 'A alteração foi aceita parcialmente.' : 'A alteração foi aceita.',
    '',
    'Texto final aprovado:',
    campo(ponto.textoFinalAprovado),
  );
  return linhas.join('\n');
}

function pontosDaRodada(pontos: readonly PontoRespostaRodada[], rodada: number): PontoRespostaRodada[] {
  return pontos
    .filter((ponto) => Number(ponto.rodada) === rodada)
    .slice()
    .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0));
}

/**
 * Texto para copiar. Não grava nada.
 * Completude = pendenciasPontoJuridicoConcluido, via pontosIncompletosDaRodada.
 */
export function gerarRespostaRodada(
  pontos: readonly PontoRespostaRodada[],
  rodadaInformada: number,
): RespostaRodadaGerada | RespostaRodadaBloqueada {
  const rodada = rodadaAtualJuridico(rodadaInformada);
  if (pontosIncompletosDaRodada(pontos, rodada) > 0) {
    return {
      ok: false,
      mensagem: `Conclua os Pontos Jurídicos da Rodada ${rodada} antes de gerar a resposta.`,
    };
  }

  const daRodada = pontosDaRodada(pontos, rodada);
  const blocos = daRodada.map((ponto) =>
    String(ponto.tipo ?? '') === 'duvida' ? blocoDuvida(ponto) : blocoAlteracao(ponto),
  );
  const partes = ['Olá,', '', 'Segue o retorno do Jurídico sobre os pontos encaminhados:'];
  if (blocos.length > 0) partes.push('', blocos.join('\n\n'));
  partes.push('', 'Ficamos à disposição para eventuais esclarecimentos.');

  const textosFinais = daRodada
    .filter((ponto) => ponto.decisao === 'aceita' || ponto.decisao === 'aceita_parcialmente')
    .map((ponto) => campo(ponto.textoFinalAprovado));

  return { ok: true, texto: partes.join('\n'), textosFinais };
}

export function textoCopiaFinais(textos: readonly string[]): string {
  return textos.join('\n\n');
}
