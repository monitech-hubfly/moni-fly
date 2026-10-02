/**
 * Conclusão de um Ponto Jurídico.
 * O banco aceita o ponto incompleto.
 * itensPendenciaPontoJuridico é a única lista do que falta.
 * O status visual e o gate da rodada (fase 3 → 4) saem dessa lista.
 */

export const JURIDICO_PONTO_TIPOS = ['duvida', 'alteracao'] as const;
export const JURIDICO_PONTO_FAQ_STATUS = ['ja_existe', 'retroalimentar', 'nao_se_aplica'] as const;
export const JURIDICO_PONTO_DECISOES = ['aceita', 'aceita_parcialmente', 'nao_aceita'] as const;
export const JURIDICO_PONTO_APLICACOES = [
  'somente_este_documento',
  'alterar_documento_padrao',
  'criar_nova_variacao',
  'alterar_variacao_existente',
] as const;

export type JuridicoPontoTipo = (typeof JURIDICO_PONTO_TIPOS)[number];
export type JuridicoPontoFaqStatus = (typeof JURIDICO_PONTO_FAQ_STATUS)[number];
export type JuridicoPontoDecisao = (typeof JURIDICO_PONTO_DECISOES)[number];
export type JuridicoPontoAplicacao = (typeof JURIDICO_PONTO_APLICACOES)[number];

export type JuridicoPontoConclusao = {
  tipo: string | null | undefined;
  duvidaRecebida?: string | null;
  resposta?: string | null;
  faqStatus?: string | null;
  faqArticleId?: string | null;
  clausulaTrecho?: string | null;
  solicitacaoAlteracao?: string | null;
  decisao?: string | null;
  textoFinalAprovado?: string | null;
  aplicacaoFutura?: string | null;
  motivoResposta?: string | null;
  repositorioTipoId?: string | null;
  repositorioVariacaoId?: string | null;
  novaVariacaoNome?: string | null;
  novaVariacaoQuando?: string | null;
};

function preenchido(valor: string | null | undefined): boolean {
  return String(valor ?? '').trim().length > 0;
}

type ItemPendencia = { codigo: string; mensagem: string };

/** Campos de abertura. Se algum faltar, o status visual é Pendente. */
const CODIGOS_PENDENTE = new Set(['duvida_recebida', 'resposta', 'clausula', 'solicitacao', 'decisao', 'tipo']);

function exigirFaq(ponto: JuridicoPontoConclusao, itens: ItemPendencia[]) {
  if (!JURIDICO_PONTO_FAQ_STATUS.includes(ponto.faqStatus as JuridicoPontoFaqStatus)) {
    itens.push({ codigo: 'faq_status', mensagem: 'Informe o status da FAQ.' });
    return;
  }
  if (
    (ponto.faqStatus === 'ja_existe' || ponto.faqStatus === 'retroalimentar') &&
    !preenchido(ponto.faqArticleId)
  ) {
    itens.push({
      codigo: 'faq_article',
      mensagem:
        ponto.faqStatus === 'retroalimentar'
          ? 'Envie a sugestão para a Central de Ajuda.'
          : 'Selecione o artigo da FAQ.',
    });
  }
}

export function itensPendenciaPontoJuridico(ponto: JuridicoPontoConclusao): ItemPendencia[] {
  const itens: ItemPendencia[] = [];
  const tipo = String(ponto.tipo ?? '').trim();

  if (tipo === 'duvida') {
    if (!preenchido(ponto.duvidaRecebida)) itens.push({ codigo: 'duvida_recebida', mensagem: 'Informe a dúvida recebida.' });
    if (!preenchido(ponto.resposta)) itens.push({ codigo: 'resposta', mensagem: 'Informe a resposta.' });
    exigirFaq(ponto, itens);
    return itens;
  }

  if (tipo === 'alteracao') {
    if (!preenchido(ponto.clausulaTrecho)) itens.push({ codigo: 'clausula', mensagem: 'Informe a cláusula ou o trecho.' });
    if (!preenchido(ponto.solicitacaoAlteracao)) {
      itens.push({ codigo: 'solicitacao', mensagem: 'Informe a solicitação de alteração.' });
    }
    const decisao = String(ponto.decisao ?? '').trim();
    if (!JURIDICO_PONTO_DECISOES.includes(decisao as JuridicoPontoDecisao)) {
      itens.push({ codigo: 'decisao', mensagem: 'Informe a decisão.' });
      return itens;
    }
    if (decisao === 'aceita' || decisao === 'aceita_parcialmente') {
      if (!preenchido(ponto.textoFinalAprovado)) itens.push({ codigo: 'texto_final', mensagem: 'Informe o texto final aprovado.' });
      if (!JURIDICO_PONTO_APLICACOES.includes(ponto.aplicacaoFutura as JuridicoPontoAplicacao)) {
        itens.push({ codigo: 'aplicacao', mensagem: 'Informe a aplicação futura.' });
      } else {
        itens.push(...pendenciasIntencaoRepositorio(ponto));
      }
    }
    if (decisao === 'nao_aceita') {
      if (!preenchido(ponto.motivoResposta)) itens.push({ codigo: 'motivo', mensagem: 'Informe o motivo da resposta.' });
      exigirFaq(ponto, itens);
    }
    return itens;
  }

  itens.push({ codigo: 'tipo', mensagem: 'Tipo do ponto inválido.' });
  return itens;
}

/** Retorna as pendências que impedem concluir o ponto. Lista vazia = completo. */
export function pendenciasPontoJuridicoConcluido(ponto: JuridicoPontoConclusao): string[] {
  return itensPendenciaPontoJuridico(ponto).map((item) => item.mensagem);
}

export type StatusVisualPontoJuridico = 'Pendente' | 'Incompleta' | 'Respondida';

/** Status de leitura. Não é coluna no banco. O gate usa a lista, não este rótulo. */
export function statusVisualPontoJuridico(ponto: JuridicoPontoConclusao): StatusVisualPontoJuridico {
  const itens = itensPendenciaPontoJuridico(ponto);
  if (itens.length === 0) return 'Respondida';
  if (itens.some((item) => CODIGOS_PENDENTE.has(item.codigo))) return 'Pendente';
  return 'Incompleta';
}

export const JURIDICO_PONTO_FAQ_LABEL: Record<JuridicoPontoFaqStatus, string> = {
  ja_existe: 'Já existe',
  retroalimentar: 'Retroalimentar',
  nao_se_aplica: 'Não se aplica',
};

export const JURIDICO_PONTO_DECISAO_LABEL: Record<JuridicoPontoDecisao, string> = {
  aceita: 'Aceita',
  aceita_parcialmente: 'Aceita parcialmente',
  nao_aceita: 'Não aceita',
};

function pendenciasIntencaoRepositorio(ponto: JuridicoPontoConclusao): ItemPendencia[] {
  const aplicacao = String(ponto.aplicacaoFutura ?? '');
  const itens: ItemPendencia[] = [];
  if (aplicacao === 'somente_este_documento') return itens;
  if (aplicacao === 'alterar_documento_padrao' || aplicacao === 'criar_nova_variacao' || aplicacao === 'alterar_variacao_existente') {
    if (!preenchido(ponto.repositorioTipoId)) itens.push({ codigo: 'repo_tipo', mensagem: 'Selecione o tipo de documento.' });
  }
  if (aplicacao === 'criar_nova_variacao') {
    if (!preenchido(ponto.novaVariacaoNome)) itens.push({ codigo: 'repo_nome', mensagem: 'Informe o nome da variação.' });
    if (!preenchido(ponto.novaVariacaoQuando)) itens.push({ codigo: 'repo_quando', mensagem: 'Informe quando utilizar.' });
  }
  if (aplicacao === 'alterar_variacao_existente' && !preenchido(ponto.repositorioVariacaoId)) {
    itens.push({ codigo: 'repo_variacao', mensagem: 'Selecione a variação.' });
  }
  return itens;
}

export type PendenciaRepositorioPonto = 'nao_se_aplica' | 'pendente' | 'concluida';

export type IntencaoRepositorioPonto = {
  tipo?: string | null;
  decisao?: string | null;
  aplicacaoFutura?: string | null;
  temVersaoRepositorio?: boolean;
};

/** Pendência de atualização do Repositório. Não é coluna e não trava a fase. */
export function pendenciaRepositorioPonto(ponto: IntencaoRepositorioPonto): PendenciaRepositorioPonto {
  if (String(ponto.tipo ?? '') !== 'alteracao') return 'nao_se_aplica';
  const decisao = String(ponto.decisao ?? '');
  if (decisao !== 'aceita' && decisao !== 'aceita_parcialmente') return 'nao_se_aplica';
  const aplicacao = String(ponto.aplicacaoFutura ?? '');
  if (
    aplicacao !== 'alterar_documento_padrao' &&
    aplicacao !== 'criar_nova_variacao' &&
    aplicacao !== 'alterar_variacao_existente'
  ) {
    return 'nao_se_aplica';
  }
  return ponto.temVersaoRepositorio ? 'concluida' : 'pendente';
}

export function mudancaRepositorioBloqueada(
  temVersao: boolean,
  atual: {
    aplicacaoFutura?: string | null;
    repositorioTipoId?: string | null;
    repositorioVariacaoId?: string | null;
    novaVariacaoNome?: string | null;
    novaVariacaoQuando?: string | null;
  },
  proximo: {
    aplicacaoFutura?: string | null;
    repositorioTipoId?: string | null;
    repositorioVariacaoId?: string | null;
    novaVariacaoNome?: string | null;
    novaVariacaoQuando?: string | null;
  },
): boolean {
  if (!temVersao) return false;
  return (
    (atual.aplicacaoFutura ?? null) !== (proximo.aplicacaoFutura ?? null) ||
    (atual.repositorioTipoId ?? null) !== (proximo.repositorioTipoId ?? null) ||
    (atual.repositorioVariacaoId ?? null) !== (proximo.repositorioVariacaoId ?? null) ||
    (atual.novaVariacaoNome ?? null) !== (proximo.novaVariacaoNome ?? null) ||
    (atual.novaVariacaoQuando ?? null) !== (proximo.novaVariacaoQuando ?? null)
  );
}

export function erroVariacaoForaDoTipo(tipoId: string, variacaoTipoId: string | null | undefined): string | null {
  if (!variacaoTipoId || variacaoTipoId !== tipoId) return 'A variação não pertence ao tipo selecionado.';
  return null;
}

/** Rótulo curto da visão central. A regra continua em pendenciaRepositorioPonto. */
export function rotuloRepositorioConsulta(ponto: IntencaoRepositorioPonto): string {
  const estado = pendenciaRepositorioPonto(ponto);
  if (estado === 'pendente') return 'Pendente no Repositório';
  if (estado === 'concluida') return 'Atualização concluída';
  if (String(ponto.aplicacaoFutura ?? '') === 'somente_este_documento') return 'Somente este documento';
  return '—';
}

export type VisaoPontosJuridicos = 'duvidas' | 'aceitas' | 'nao_aceitas';

/** Em qual das três consultas o ponto entra. Sem decisão, a alteração ainda não entra. */
export function visaoDoPontoJuridico(ponto: {
  tipo?: string | null;
  decisao?: string | null;
}): VisaoPontosJuridicos | null {
  if (String(ponto.tipo ?? '') === 'duvida') return 'duvidas';
  if (String(ponto.tipo ?? '') !== 'alteracao') return null;
  const decisao = String(ponto.decisao ?? '');
  if (decisao === 'aceita' || decisao === 'aceita_parcialmente') return 'aceitas';
  if (decisao === 'nao_aceita') return 'nao_aceitas';
  return null;
}

/**
 * Quem opera o Funil Jurídico e os Pontos.
 * Papel cru admin ou team, o mesmo da política RLS de juridico_pontos.
 * consultor e supervisor continuam admin no resto do Hub, mas não neste funil.
 * frank e franqueado não entram.
 */
export function podeLerPontosJuridicos(role: string | null | undefined): boolean {
  const r = String(role ?? '').trim().toLowerCase();
  return r === 'admin' || r === 'team';
}

/** Rodada gravada no card. Valor ausente ou inválido conta como a rodada 1. */
export function rodadaAtualJuridico(valor: number | null | undefined): number {
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function pontosIncompletosDaRodada(
  pontos: readonly (JuridicoPontoConclusao & { rodada?: number | null })[],
  rodadaAtual: number,
): number {
  const rodada = rodadaAtualJuridico(rodadaAtual);
  return pontos.filter(
    (ponto) => Number(ponto.rodada) === rodada && pendenciasPontoJuridicoConcluido(ponto).length > 0,
  ).length;
}

/** Null quando a rodada atual pode seguir para Enviado ao Parceiro. */
export function mensagemGateEnvioParceiro(
  pontos: readonly (JuridicoPontoConclusao & { rodada?: number | null })[],
  rodadaAtual: number,
): string | null {
  const rodada = rodadaAtualJuridico(rodadaAtual);
  const n = pontosIncompletosDaRodada(pontos, rodada);
  if (n === 0) return null;
  const quantidade =
    n === 1
      ? '1 Ponto Jurídico ainda está incompleto'
      : `${n} Pontos Jurídicos ainda estão incompletos`;
  return `${quantidade} na Rodada ${rodada} antes do envio ao parceiro.`;
}

export type FiltroVisaoPontos = {
  texto?: string;
  tipoDocumento?: string;
  rodada?: string;
  faqStatus?: string;
  decisao?: string;
  aplicacao?: string;
  repositorio?: '' | 'somente' | 'pendente' | 'concluida';
};

export type PontoVisaoFiltro = {
  tipo: string;
  decisao: string | null;
  aplicacaoFutura: string | null;
  temVersaoRepositorio: boolean;
  rodada: number;
  tipoDocumento: string | null;
  faqStatus: string | null;
  duvida: string | null;
  resposta: string | null;
  clausula: string | null;
  solicitacao: string | null;
  textoFinal: string | null;
  motivo: string | null;
};

export function filtrarPontosVisao<T extends PontoVisaoFiltro>(pontos: readonly T[], filtro: FiltroVisaoPontos): T[] {
  const texto = String(filtro.texto ?? '').trim().toLowerCase();
  return pontos.filter((ponto) => {
    if (filtro.tipoDocumento && ponto.tipoDocumento !== filtro.tipoDocumento) return false;
    if (filtro.rodada && String(ponto.rodada) !== filtro.rodada) return false;
    if (filtro.faqStatus && (ponto.faqStatus ?? '') !== filtro.faqStatus) return false;
    if (filtro.decisao && (ponto.decisao ?? '') !== filtro.decisao) return false;
    if (filtro.aplicacao && (ponto.aplicacaoFutura ?? '') !== filtro.aplicacao) return false;
    if (filtro.repositorio) {
      const estado = pendenciaRepositorioPonto({
        tipo: ponto.tipo,
        decisao: ponto.decisao,
        aplicacaoFutura: ponto.aplicacaoFutura,
        temVersaoRepositorio: ponto.temVersaoRepositorio,
      });
      if (filtro.repositorio === 'somente') {
        if (!(estado === 'nao_se_aplica' && ponto.aplicacaoFutura === 'somente_este_documento')) return false;
      } else if (estado !== filtro.repositorio) return false;
    }
    if (!texto) return true;
    const blob = [ponto.duvida, ponto.resposta, ponto.clausula, ponto.solicitacao, ponto.textoFinal, ponto.motivo]
      .join('\n')
      .toLowerCase();
    return blob.includes(texto);
  });
}

export function rotuloFaqConsulta(
  faqStatus: string | null | undefined,
  pergunta: string | null | undefined,
  artigoStatus: string | null | undefined,
): { rotulo: string; detalhe: string | null } {
  if (faqStatus === 'nao_se_aplica') return { rotulo: 'Não se aplica', detalhe: null };
  if (faqStatus === 'ja_existe') return { rotulo: String(pergunta ?? '').trim() || 'Artigo vinculado', detalhe: null };
  if (faqStatus === 'retroalimentar') {
    const detalhe =
      artigoStatus === 'draft' ? 'Rascunho' : artigoStatus === 'published' ? 'Publicado' : artigoStatus === 'archived' ? 'Arquivado' : null;
    return { rotulo: String(pergunta ?? '').trim() || 'Enviado para Central de Ajuda', detalhe };
  }
  return { rotulo: '—', detalhe: null };
}

export function rotuloPendenciaRepositorio(ponto: IntencaoRepositorioPonto): string | null {
  const estado = pendenciaRepositorioPonto(ponto);
  if (estado === 'nao_se_aplica') return null;
  const aplicacao = String(ponto.aplicacaoFutura ?? '');
  if (aplicacao === 'alterar_documento_padrao') {
    return estado === 'concluida' ? 'Documento padrão atualizado' : 'Atualização do padrão pendente';
  }
  if (aplicacao === 'criar_nova_variacao') {
    return estado === 'concluida' ? 'Variação criada' : 'Criação da variação pendente';
  }
  if (aplicacao === 'alterar_variacao_existente') {
    return estado === 'concluida' ? 'Variação atualizada' : 'Atualização da variação pendente';
  }
  return null;
}

export const JURIDICO_PONTO_APLICACAO_LABEL: Record<JuridicoPontoAplicacao, string> = {
  somente_este_documento: 'Somente este documento',
  alterar_documento_padrao: 'Alterar documento padrão',
  criar_nova_variacao: 'Criar nova variação',
  alterar_variacao_existente: 'Alterar variação existente',
};
