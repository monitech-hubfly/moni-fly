import type { PainelCardDTO, PainelFaseDTO } from '@/lib/kanban/painel-performance-types';

/** Posição da fase atual do card em relação à(s) fase(s) de conversão. */
export type PosicaoConversaoFase = 'antes' | 'na_conversao' | 'depois';

export type StatusCardFunil = 'ativo' | 'concluido' | 'arquivado';

export type MomentoArquivamentoConversao = 'antes' | 'na_conversao' | 'depois' | 'nao_aplicavel';

export type ConversaoContext = {
  convFaseIds: Set<string>;
  minConvOrdem: number | null;
  maxConvOrdem: number | null;
  faseById: Map<string, PainelFaseDTO>;
  conversaoConfigurada: boolean;
};

export type ClassificacaoConversaoCard = {
  status: StatusCardFunil;
  posicaoFase: PosicaoConversaoFase;
  converteu: boolean;
  inconsistencia: boolean;
  inconsistenciaCodigo: 'concluido_antes_conversao' | null;
  rotulo: string;
  momentoArquivamento: MomentoArquivamentoConversao;
};

export function buildConversaoContext(fases: PainelFaseDTO[]): ConversaoContext {
  const convFases = fases.filter((f) => f.fase_conversao);
  return {
    convFaseIds: new Set(convFases.map((f) => f.id)),
    minConvOrdem: convFases.length ? Math.min(...convFases.map((f) => f.ordem)) : null,
    maxConvOrdem: convFases.length ? Math.max(...convFases.map((f) => f.ordem)) : null,
    faseById: new Map(fases.map((f) => [f.id, f])),
    conversaoConfigurada: convFases.length > 0,
  };
}

/** Posição relativa de uma fase à conversão (fase atual do card). */
export function posicaoRelativaConversao(
  faseId: string,
  ctx: ConversaoContext,
): PosicaoConversaoFase {
  if (!ctx.conversaoConfigurada) return 'antes';
  if (ctx.convFaseIds.has(faseId)) return 'na_conversao';
  const ord = ctx.faseById.get(faseId)?.ordem;
  if (ord == null) return 'antes';
  if (ctx.minConvOrdem != null && ord < ctx.minConvOrdem) return 'antes';
  if (ctx.maxConvOrdem != null && ord > ctx.maxConvOrdem) return 'depois';
  if (ctx.minConvOrdem != null && ord >= ctx.minConvOrdem) return 'depois';
  return 'antes';
}

export function statusCardFunil(card: PainelCardDTO): StatusCardFunil {
  if (card.arquivado) return 'arquivado';
  if (card.concluido) return 'concluido';
  return 'ativo';
}

function buildRotuloClassificacao(
  status: StatusCardFunil,
  posicao: PosicaoConversaoFase,
  inconsistencia: boolean,
): string {
  if (status === 'ativo') {
    return posicao === 'antes' ? 'Ainda não converteu' : 'Converteu';
  }
  if (status === 'concluido') {
    return inconsistencia ? 'Não converteu (inconsistente)' : 'Converteu';
  }
  if (posicao === 'antes') return 'Perda antes da conversão';
  if (posicao === 'na_conversao') return 'Converteu — arquivado na conversão';
  return 'Converteu — perda pós-conversão';
}

/**
 * Classifica conversão considerando status (ativo/concluído/arquivado) e fase atual.
 *
 * Regras:
 * - Ativo antes da conversão → não converteu
 * - Ativo na/depois da conversão → converteu
 * - Concluído antes da conversão → não converteu + inconsistência
 * - Concluído na/depois → converteu
 * - Arquivado antes → perda antes (não converteu)
 * - Arquivado na conversão → converteu, arquivado na conversão
 * - Arquivado depois → converteu, perda pós-conversão
 */
export function classificarConversaoCard(
  card: PainelCardDTO,
  ctx: ConversaoContext,
): ClassificacaoConversaoCard {
  const status = statusCardFunil(card);
  const posicaoFase = posicaoRelativaConversao(card.fase_id, ctx);
  const converteu = ctx.conversaoConfigurada && posicaoFase !== 'antes';

  const inconsistencia =
    ctx.conversaoConfigurada && status === 'concluido' && posicaoFase === 'antes';
  const inconsistenciaCodigo: ClassificacaoConversaoCard['inconsistenciaCodigo'] =
    inconsistencia ? 'concluido_antes_conversao' : null;

  let momentoArquivamento: MomentoArquivamentoConversao = 'nao_aplicavel';
  if (status === 'arquivado' && ctx.conversaoConfigurada) {
    momentoArquivamento = posicaoFase;
  }

  return {
    status,
    posicaoFase,
    converteu,
    inconsistencia,
    inconsistenciaCodigo,
    rotulo: buildRotuloClassificacao(status, posicaoFase, inconsistencia),
    momentoArquivamento,
  };
}

export function cardConverteuPorRegras(card: PainelCardDTO, ctx: ConversaoContext): boolean {
  return classificarConversaoCard(card, ctx).converteu;
}

/** Arquivamento que reduz a taxa de conversão do funil (perda antes da conversão). */
export function arquivamentoPerdaAntesConversao(cl: ClassificacaoConversaoCard): boolean {
  return cl.status === 'arquivado' && cl.momentoArquivamento === 'antes';
}

/** Arquivamento na fase de conversão (converteu, mas saiu na conversão). */
export function arquivamentoNaConversao(cl: ClassificacaoConversaoCard): boolean {
  return cl.status === 'arquivado' && cl.momentoArquivamento === 'na_conversao';
}

/** Arquivamento após a fase de conversão (perda pós-conversão). */
export function arquivamentoPosConversao(cl: ClassificacaoConversaoCard): boolean {
  return cl.status === 'arquivado' && cl.momentoArquivamento === 'depois';
}

export function labelMomentoArquivamento(
  momento: MomentoArquivamentoConversao,
  conversaoConfigurada: boolean,
): string {
  if (!conversaoConfigurada || momento === 'nao_aplicavel') {
    return 'Conversão não configurada';
  }
  if (momento === 'antes') return 'Antes da conversão';
  if (momento === 'na_conversao') return 'Na fase de conversão';
  return 'Depois da conversão';
}

/** Compatível com filtro `momentoConversao` do drawer (antes | depois | indeterminado). */
export function momentoArquivamentoDrawer(
  cl: ClassificacaoConversaoCard,
): 'antes' | 'depois' | 'na_conversao' | 'indeterminado' {
  if (!cl.momentoArquivamento || cl.momentoArquivamento === 'nao_aplicavel') {
    return 'indeterminado';
  }
  return cl.momentoArquivamento;
}
