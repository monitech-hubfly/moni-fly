import { CORRETORES_FASES_CONFIRMACAO_SAIDA, FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';

export type CorretoresConfirmacaoFaseTipo = keyof typeof CORRETORES_FASES_CONFIRMACAO_SAIDA;

const SLUGS_POR_TIPO: Record<CorretoresConfirmacaoFaseTipo, readonly string[]> =
  CORRETORES_FASES_CONFIRMACAO_SAIDA;

export function corretoresConfirmacaoPergunta(
  tipo: CorretoresConfirmacaoFaseTipo,
  nomeCliente?: string | null,
): string {
  const nome = String(nomeCliente ?? '').trim() || 'este lead';
  if (tipo === 'forecast') {
    return `Confirmar conversão do lead ${nome}? Esta ação arquivará o card como Convertido.`;
  }
  return 'Confirmar movimentação?';
}

export function resolverCorretoresConfirmacaoFaseTipo(
  faseSlug: string | null | undefined,
): CorretoresConfirmacaoFaseTipo | null {
  const slug = String(faseSlug ?? '').trim();
  if (!slug) return null;
  for (const [tipo, slugs] of Object.entries(SLUGS_POR_TIPO) as [
    CorretoresConfirmacaoFaseTipo,
    readonly string[],
  ][]) {
    if (slugs.includes(slug)) return tipo;
  }
  return null;
}

/** Confirma somente Forecast → Convertido (não em outras saídas de Forecast). */
export function deveConfirmarMovimentoCorretores(input: {
  kanbanId: string | null | undefined;
  faseSlugAtual: string | null | undefined;
  destinoFaseSlug: string | null | undefined;
  origemCard?: 'legado' | 'nativo';
}): CorretoresConfirmacaoFaseTipo | null {
  if (input.origemCard === 'legado') return null;
  if (String(input.kanbanId ?? '').trim() !== KANBAN_IDS.CORRETORES) return null;
  if (String(input.destinoFaseSlug ?? '').trim() !== FASE_SLUGS.COR_CONVERTIDO) return null;
  return resolverCorretoresConfirmacaoFaseTipo(input.faseSlugAtual);
}
