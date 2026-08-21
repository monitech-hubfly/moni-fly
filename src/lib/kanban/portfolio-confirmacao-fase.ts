import { KANBAN_IDS, PORTFOLIO_FASES_CONFIRMACAO_SAIDA } from '@/lib/constants/kanban-ids';

export type PortfolioConfirmacaoFaseTipo = keyof typeof PORTFOLIO_FASES_CONFIRMACAO_SAIDA;

/** Modal encadeado após confirmação de saída do Comitê (não mapeado por slug). */
export type PortfolioConfirmacaoChainTipo = 'condicoes_precedentes';

export type PortfolioConfirmacaoModalTipo =
  | PortfolioConfirmacaoFaseTipo
  | PortfolioConfirmacaoChainTipo;

/** Slugs da fase atual (Portfólio) que disparam confirmação ao sair manualmente. */
const SLUGS_POR_TIPO: Record<PortfolioConfirmacaoFaseTipo, readonly string[]> =
  PORTFOLIO_FASES_CONFIRMACAO_SAIDA;
const PERGUNTA_POR_TIPO: Record<PortfolioConfirmacaoFaseTipo, string> = {
  opcao: 'A opção foi assinada com o terrenista?',
  comite: 'O card foi aprovado em Comitê?',
  contrato: 'O contrato foi assinado?',
};

const PERGUNTA_CHAIN: Record<PortfolioConfirmacaoChainTipo, string> = {
  condicoes_precedentes: 'Contrato com Condições Precedentes?',
};

export function portfolioConfirmacaoPergunta(tipo: PortfolioConfirmacaoFaseTipo): string {
  return PERGUNTA_POR_TIPO[tipo];
}

export function portfolioConfirmacaoChainPergunta(tipo: PortfolioConfirmacaoChainTipo): string {
  return PERGUNTA_CHAIN[tipo];
}

export function portfolioConfirmacaoModalPergunta(tipo: PortfolioConfirmacaoModalTipo): string {
  if (tipo === 'condicoes_precedentes') {
    return portfolioConfirmacaoChainPergunta(tipo);
  }
  return portfolioConfirmacaoPergunta(tipo);
}

export function resolverPortfolioConfirmacaoFaseTipo(
  faseSlug: string | null | undefined,
): PortfolioConfirmacaoFaseTipo | null {
  const slug = String(faseSlug ?? '').trim();
  if (!slug) return null;
  for (const [tipo, slugs] of Object.entries(SLUGS_POR_TIPO) as [PortfolioConfirmacaoFaseTipo, readonly string[]][]) {
    if (slugs.includes(slug)) return tipo;
  }
  return null;
}

export function deveConfirmarSaidaFasePortfolio(input: {
  kanbanId: string | null | undefined;
  faseSlug: string | null | undefined;
  origemCard?: 'legado' | 'nativo';
}): PortfolioConfirmacaoFaseTipo | null {
  if (input.origemCard === 'legado') return null;
  if (String(input.kanbanId ?? '').trim() !== KANBAN_IDS.PORTFOLIO) return null;
  return resolverPortfolioConfirmacaoFaseTipo(input.faseSlug);
}
