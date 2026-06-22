import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';

/** Slugs da fase atual (Operações) que disparam confirmação ao sair manualmente. */
export const OPERACOES_FASES_CONFIRMACAO_SAIDA = {
  prefeitura: [FASE_SLUGS.APROVACAO_PREFEITURA],
  em_obra: [FASE_SLUGS.EM_OBRA],
} as const;

export type OperacoesConfirmacaoFaseTipo = keyof typeof OPERACOES_FASES_CONFIRMACAO_SAIDA;

const SLUGS_POR_TIPO: Record<OperacoesConfirmacaoFaseTipo, readonly string[]> =
  OPERACOES_FASES_CONFIRMACAO_SAIDA;

const PERGUNTA_POR_TIPO: Record<OperacoesConfirmacaoFaseTipo, string> = {
  prefeitura: 'Aprovação na Prefeitura concluída?',
  em_obra: 'Obra finalizada?',
};

export function operacoesConfirmacaoPergunta(tipo: OperacoesConfirmacaoFaseTipo): string {
  return PERGUNTA_POR_TIPO[tipo];
}

export function resolverOperacoesConfirmacaoFaseTipo(
  faseSlug: string | null | undefined,
): OperacoesConfirmacaoFaseTipo | null {
  const slug = String(faseSlug ?? '').trim();
  if (!slug) return null;
  for (const [tipo, slugs] of Object.entries(SLUGS_POR_TIPO) as [OperacoesConfirmacaoFaseTipo, readonly string[]][]) {
    if (slugs.includes(slug)) return tipo;
  }
  return null;
}

export function deveConfirmarSaidaFaseOperacoes(input: {
  kanbanId: string | null | undefined;
  faseSlug: string | null | undefined;
  origemCard?: 'legado' | 'nativo';
}): OperacoesConfirmacaoFaseTipo | null {
  if (input.origemCard === 'legado') return null;
  if (String(input.kanbanId ?? '').trim() !== KANBAN_IDS.OPERACOES) return null;
  return resolverOperacoesConfirmacaoFaseTipo(input.faseSlug);
}
