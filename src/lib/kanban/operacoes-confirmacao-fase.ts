import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';

/** Slugs da fase atual (Operações) que disparam confirmação ao sair manualmente. */
export const OPERACOES_FASES_CONFIRMACAO_SAIDA = {
  prefeitura: [FASE_SLUGS.APROVACAO_PREFEITURA],
  em_obra: [FASE_SLUGS.EM_OBRA],
} as const;

/** Slugs da fase de destino (Operações) que disparam confirmação ao avançar. */
export const OPERACOES_FASES_CONFIRMACAO_ENTRADA = {
  entregue: [FASE_SLUGS.OPERACOES_ENTREGUE],
} as const;

export type OperacoesConfirmacaoSaidaTipo = keyof typeof OPERACOES_FASES_CONFIRMACAO_SAIDA;
export type OperacoesConfirmacaoEntradaTipo = keyof typeof OPERACOES_FASES_CONFIRMACAO_ENTRADA;
export type OperacoesConfirmacaoFaseTipo =
  | OperacoesConfirmacaoSaidaTipo
  | OperacoesConfirmacaoEntradaTipo;

const SLUGS_SAIDA: Record<OperacoesConfirmacaoSaidaTipo, readonly string[]> =
  OPERACOES_FASES_CONFIRMACAO_SAIDA;

const SLUGS_ENTRADA: Record<OperacoesConfirmacaoEntradaTipo, readonly string[]> =
  OPERACOES_FASES_CONFIRMACAO_ENTRADA;

const PERGUNTA_POR_TIPO: Record<OperacoesConfirmacaoFaseTipo, string> = {
  prefeitura: 'Aprovação na Prefeitura concluída?',
  em_obra: 'Obra iniciada?',
  entregue: 'Obra finalizada?',
};

export function operacoesConfirmacaoPergunta(tipo: OperacoesConfirmacaoFaseTipo): string {
  return PERGUNTA_POR_TIPO[tipo];
}

export function resolverOperacoesConfirmacaoSaidaTipo(
  faseSlug: string | null | undefined,
): OperacoesConfirmacaoSaidaTipo | null {
  const slug = String(faseSlug ?? '').trim();
  if (!slug) return null;
  for (const [tipo, slugs] of Object.entries(SLUGS_SAIDA) as [
    OperacoesConfirmacaoSaidaTipo,
    readonly string[],
  ][]) {
    if (slugs.includes(slug)) return tipo;
  }
  return null;
}

export function resolverOperacoesConfirmacaoEntradaTipo(
  destinoFaseSlug: string | null | undefined,
): OperacoesConfirmacaoEntradaTipo | null {
  const slug = String(destinoFaseSlug ?? '').trim();
  if (!slug) return null;
  for (const [tipo, slugs] of Object.entries(SLUGS_ENTRADA) as [
    OperacoesConfirmacaoEntradaTipo,
    readonly string[],
  ][]) {
    if (slugs.includes(slug)) return tipo;
  }
  return null;
}

export function deveConfirmarSaidaFaseOperacoes(input: {
  kanbanId: string | null | undefined;
  faseSlug: string | null | undefined;
  origemCard?: 'legado' | 'nativo';
}): OperacoesConfirmacaoSaidaTipo | null {
  if (input.origemCard === 'legado') return null;
  if (String(input.kanbanId ?? '').trim() !== KANBAN_IDS.OPERACOES) return null;
  return resolverOperacoesConfirmacaoSaidaTipo(input.faseSlug);
}

export function deveConfirmarEntradaFaseOperacoes(input: {
  kanbanId: string | null | undefined;
  destinoFaseSlug: string | null | undefined;
  origemCard?: 'legado' | 'nativo';
  direcao?: 'avancar' | 'retroceder';
}): OperacoesConfirmacaoEntradaTipo | null {
  if (input.direcao === 'retroceder') return null;
  if (input.origemCard === 'legado') return null;
  if (String(input.kanbanId ?? '').trim() !== KANBAN_IDS.OPERACOES) return null;
  return resolverOperacoesConfirmacaoEntradaTipo(input.destinoFaseSlug);
}
