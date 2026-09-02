import { KANBAN_IDS, LOTEADORES_FASES_CONFIRMACAO_SAIDA, FASE_SLUGS } from '@/lib/constants/kanban-ids';

export type LoteadoresConfirmacaoFaseTipo = keyof typeof LOTEADORES_FASES_CONFIRMACAO_SAIDA;

const SLUGS_POR_TIPO: Record<LoteadoresConfirmacaoFaseTipo, readonly string[]> =
  LOTEADORES_FASES_CONFIRMACAO_SAIDA;

const PERGUNTA_POR_TIPO: Record<LoteadoresConfirmacaoFaseTipo, string> = {
  opcao: 'Opção — Assinou?',
  comite: 'O card foi aprovado em Comitê?',
  cto_precedentes: 'Cto c/ Precedentes — Assinou?',
  cto_showroom: 'Cto Showroom — Assinou?',
  cto_parceria: 'Cto de Parceria — Assinou?',
};

/** Display dinâmico do título «{nome} — Assinou?» (Prompt 9). */
export const LOTEADORES_ASSINOU_NOME_POR_SLUG: Readonly<Record<string, string>> = {
  [FASE_SLUGS.LOTEADORES_OPCAO]: 'Opção',
  [FASE_SLUGS.LOTEADORES_CTO_PRECEDENTES]: 'Cto c/ Precedentes',
  [FASE_SLUGS.LOTEADORES_CTO_SHOWROOM]: 'Cto Showroom',
  [FASE_SLUGS.LOTEADORES_CONTRATO_PARCERIA]: 'Cto de Parceria',
};

export function loteadoresAssinouTituloPorSlug(slug: string | null | undefined): string | null {
  const s = String(slug ?? '').trim();
  const nome = LOTEADORES_ASSINOU_NOME_POR_SLUG[s];
  if (!nome) return null;
  return `${nome} — Assinou?`;
}

export function loteadoresConfirmacaoTitulo(tipo: LoteadoresConfirmacaoFaseTipo): string {
  return PERGUNTA_POR_TIPO[tipo] ?? 'Confirmação';
}

export function loteadoresConfirmacaoPergunta(tipo: LoteadoresConfirmacaoFaseTipo): string {
  return PERGUNTA_POR_TIPO[tipo];
}

export function resolverLoteadoresConfirmacaoFaseTipo(
  faseSlug: string | null | undefined,
): LoteadoresConfirmacaoFaseTipo | null {
  const slug = String(faseSlug ?? '').trim();
  if (!slug) return null;
  for (const [tipo, slugs] of Object.entries(SLUGS_POR_TIPO) as [
    LoteadoresConfirmacaoFaseTipo,
    readonly string[],
  ][]) {
    if (slugs.includes(slug)) return tipo;
  }
  return null;
}

export function deveConfirmarSaidaFaseLoteadores(input: {
  kanbanId: string | null | undefined;
  faseSlug: string | null | undefined;
  origemCard?: 'legado' | 'nativo';
  /** Só ao avançar (sair da fase). Retrocesso não exige pop-up. */
  direcao?: 'avancar' | 'retroceder';
}): LoteadoresConfirmacaoFaseTipo | null {
  if (input.origemCard === 'legado') return null;
  if (input.direcao === 'retroceder') return null;
  if (String(input.kanbanId ?? '').trim() !== KANBAN_IDS.LOTEADORES) return null;
  return resolverLoteadoresConfirmacaoFaseTipo(input.faseSlug);
}

/** Helper DnD: sai desta fase (slug origem exige confirmação). */
export function loteadoresRequerAssinouAoSair(faseSlugOrigem: string | null | undefined): boolean {
  return resolverLoteadoresConfirmacaoFaseTipo(faseSlugOrigem) != null;
}
