import { FASE_SLUGS } from '@/lib/constants/kanban-ids';

/** Tipos do bastão Jurídico → Portfólio. NDA, parceria e demais ficam de fora. */
export const TIPOS_BASTAO_JURIDICO_PORTFOLIO = [
  'opcao',
  'cto_com_precedentes',
  'cto_sem_precedentes',
] as const;

export type TipoBastaoJuridicoPortfolio = (typeof TIPOS_BASTAO_JURIDICO_PORTFOLIO)[number];

export type MomentoBastaoJuridicoPortfolio = 'assinaturas' | 'assinado';

/**
 * Trilha de cada documento no Portfólio, na ordem real.
 * Fase 5 do Jurídico empurra para o índice de assinaturas.
 * Fase 7 empurra para o índice assinado.
 */
const TRILHAS: Record<
  TipoBastaoJuridicoPortfolio,
  {
    fases: readonly string[];
    assinaturas: string;
    assinado: string;
    rotuloAssinado: string;
  }
> = {
  opcao: {
    fases: [
      FASE_SLUGS.PORTFOLIO_ENVIAR_OPCAO,
      FASE_SLUGS.PORTFOLIO_JURIDICO_OPCAO,
      FASE_SLUGS.PORTFOLIO_ASSINATURAS_OPCAO,
      FASE_SLUGS.PORTFOLIO_OPCAO_ASSINADA,
    ],
    assinaturas: FASE_SLUGS.PORTFOLIO_ASSINATURAS_OPCAO,
    assinado: FASE_SLUGS.PORTFOLIO_OPCAO_ASSINADA,
    rotuloAssinado: 'Opção assinada',
  },
  cto_com_precedentes: {
    fases: [
      FASE_SLUGS.CTO_CONDICOES_PRECEDENTES,
      FASE_SLUGS.PORTFOLIO_JURIDICO_CTO_PRECEDENTES,
      FASE_SLUGS.PORTFOLIO_ASSINATURAS_CTO_PRECEDENTES,
      FASE_SLUGS.PORTFOLIO_CTO_PRECEDENTES_ASSINADO,
    ],
    assinaturas: FASE_SLUGS.PORTFOLIO_ASSINATURAS_CTO_PRECEDENTES,
    assinado: FASE_SLUGS.PORTFOLIO_CTO_PRECEDENTES_ASSINADO,
    rotuloAssinado: 'Cto c/ Precedentes assinado',
  },
  cto_sem_precedentes: {
    fases: [
      FASE_SLUGS.PORTFOLIO_ENVIAR_CONTRATO,
      FASE_SLUGS.PORTFOLIO_JURIDICO_CONTRATO,
      FASE_SLUGS.PORTFOLIO_ASSINATURAS_CONTRATO,
      FASE_SLUGS.PORTFOLIO_CONTRATO_ASSINADO,
    ],
    assinaturas: FASE_SLUGS.PORTFOLIO_ASSINATURAS_CONTRATO,
    assinado: FASE_SLUGS.PORTFOLIO_CONTRATO_ASSINADO,
    rotuloAssinado: 'Cto s/ Precedentes assinado',
  },
};

/** Fases do Portfólio que abrem atendimento. Assinaturas e Assinado não entram. */
export const FASES_PORTFOLIO_CRIAM_ATENDIMENTO_JURIDICO = [
  FASE_SLUGS.PORTFOLIO_JURIDICO_OPCAO,
  FASE_SLUGS.PORTFOLIO_JURIDICO_CTO_PRECEDENTES,
  FASE_SLUGS.PORTFOLIO_JURIDICO_CONTRATO,
] as const;

export function fasePortfolioCriaAtendimentoJuridico(slug: string | null | undefined): boolean {
  const s = String(slug ?? '').trim();
  return (FASES_PORTFOLIO_CRIAM_ATENDIMENTO_JURIDICO as readonly string[]).includes(s);
}

export function isTipoBastaoJuridicoPortfolio(
  valor: string | null | undefined,
): valor is TipoBastaoJuridicoPortfolio {
  return (TIPOS_BASTAO_JURIDICO_PORTFOLIO as readonly string[]).includes(String(valor ?? '').trim());
}

/** Fase 5 = assinaturas. Fase 7 = assinado. Qualquer outra fase não dispara este bastão. */
export function momentoBastaoPorFaseJuridico(
  slug: string | null | undefined,
): MomentoBastaoJuridicoPortfolio | null {
  const s = String(slug ?? '').trim();
  if (s === FASE_SLUGS.JURIDICO_SUBIR_ASSINATURA) return 'assinaturas';
  if (s === FASE_SLUGS.JURIDICO_POS_ASSINATURA) return 'assinado';
  return null;
}

export function faseDestinoBastaoPortfolio(
  tipo: TipoBastaoJuridicoPortfolio,
  momento: MomentoBastaoJuridicoPortfolio,
): string {
  return TRILHAS[tipo][momento];
}

export function rotuloDocumentoAssinado(tipo: TipoBastaoJuridicoPortfolio): string {
  return TRILHAS[tipo].rotuloAssinado;
}

export function mensagemNotificacaoDocumentoAssinado(tipo: TipoBastaoJuridicoPortfolio): string {
  return `Jurídico concluído: ${rotuloDocumentoAssinado(tipo)}.`;
}

export type DecisaoBastaoPortfolio =
  | { acao: 'mover'; faseDestinoSlug: string }
  | { acao: 'ja_no_destino' }
  | { acao: 'nao_regredir' }
  | { acao: 'incompativel'; erro: string };

type TrilhaDocumento = {
  fases: readonly string[];
  assinaturas: string;
  assinado: string;
  rotuloAssinado: string;
};

/**
 * Mesma regra do Portfólio e do Loteadores.
 * Já no destino: noop. Mais adiante na mesma trilha: não regride.
 * Fora da trilha — outro documento, fase histórica ou ordem maior de outra trilha: erro, sem movimento.
 * Ordem global do funil não conta como “já avançou”.
 */
export function decidirBastaoPorTrilha(input: {
  trilha: TrilhaDocumento;
  outrasTrilhas: readonly TrilhaDocumento[];
  momento: MomentoBastaoJuridicoPortfolio;
  fasePaiSlug: string;
  fasePaiNome: string;
  ordemPai: number | null;
  ordemDestino: number | null;
  faseDestinoNome: string;
  funil: string;
  slugsIgnorados?: readonly string[];
}): DecisaoBastaoPortfolio {
  const destino = input.trilha[input.momento];
  const slug = String(input.fasePaiSlug ?? '').trim();
  const erro = () => ({
    acao: 'incompativel' as const,
    erro: mensagemFaseIncompativel(input.fasePaiNome, input.faseDestinoNome, input.funil),
  });

  if ((input.slugsIgnorados ?? []).includes(slug)) return erro();

  const idx = input.trilha.fases.indexOf(slug);
  const idxDestino = input.trilha.fases.indexOf(destino);

  if (idx >= 0 && idxDestino >= 0) {
    if (idx === idxDestino) return { acao: 'ja_no_destino' };
    if (idx > idxDestino) return { acao: 'nao_regredir' };
    if (idx === idxDestino - 1) return { acao: 'mover', faseDestinoSlug: destino };
    return erro();
  }

  if (input.outrasTrilhas.some((trilha) => trilha.fases.includes(slug))) return erro();

  return erro();
}

/**
 * Decide o movimento do card de origem do Portfólio.
 */
export function decidirBastaoJuridicoPortfolio(input: {
  tipo: TipoBastaoJuridicoPortfolio;
  momento: MomentoBastaoJuridicoPortfolio;
  fasePaiSlug: string;
  fasePaiNome: string;
  ordemPai: number | null;
  ordemDestino: number | null;
  faseDestinoNome: string;
}): DecisaoBastaoPortfolio {
  const trilha = TRILHAS[input.tipo];
  const outras = (Object.entries(TRILHAS) as [TipoBastaoJuridicoPortfolio, TrilhaDocumento][])
    .filter(([tipo]) => tipo !== input.tipo)
    .map(([, item]) => item);
  return decidirBastaoPorTrilha({
    ...input,
    trilha,
    outrasTrilhas: outras,
    funil: 'Portfólio',
  });
}

export function mensagemFaseIncompativel(
  fasePaiNome: string,
  faseDestinoNome: string,
  funil = 'Portfólio',
): string {
  const atual = String(fasePaiNome ?? '').trim() || 'fase atual';
  const destino = String(faseDestinoNome ?? '').trim() || 'fase de destino';
  return `Bastão Jurídico → ${funil} não executado: o card de origem está em «${atual}», incompatível com «${destino}». O atendimento jurídico não permanece nesta fase.`;
}

/** Tipos do bastão Jurídico → Loteadores. Opção e contratos do Portfólio ficam de fora. */
export const TIPOS_BASTAO_JURIDICO_LOTEADORES = ['nda', 'parceria'] as const;

export type TipoBastaoJuridicoLoteadores = (typeof TIPOS_BASTAO_JURIDICO_LOTEADORES)[number];

/**
 * NDA começa em Jurídico NDA. Parceria começa em Enviar Cto de Parceria.
 * `loteador_juridico` não entra: fase histórica, fora do fluxo.
 */
const TRILHAS_LOTEADORES: Record<TipoBastaoJuridicoLoteadores, TrilhaDocumento> = {
  nda: {
    fases: [
      FASE_SLUGS.LOTEADORES_NDA,
      FASE_SLUGS.LOTEADORES_NDA_ASSINATURAS,
      FASE_SLUGS.LOTEADORES_NDA_ASSINADO,
    ],
    assinaturas: FASE_SLUGS.LOTEADORES_NDA_ASSINATURAS,
    assinado: FASE_SLUGS.LOTEADORES_NDA_ASSINADO,
    rotuloAssinado: 'NDA assinado',
  },
  parceria: {
    fases: [
      FASE_SLUGS.LOTEADORES_ENVIAR_CTO_PARCERIA,
      FASE_SLUGS.LOTEADORES_CONTRATO_PARCERIA,
      FASE_SLUGS.LOTEADORES_CTO_PARCERIA_ASSINATURAS,
      FASE_SLUGS.LOTEADORES_CTO_PARCERIA_ASSINADO,
    ],
    assinaturas: FASE_SLUGS.LOTEADORES_CTO_PARCERIA_ASSINATURAS,
    assinado: FASE_SLUGS.LOTEADORES_CTO_PARCERIA_ASSINADO,
    rotuloAssinado: 'Cto de Parceria assinado',
  },
};

/** Fases do Loteadores que abrem atendimento. Assinaturas e Assinado não entram. */
export const FASES_LOTEADORES_CRIAM_ATENDIMENTO_JURIDICO = [
  FASE_SLUGS.LOTEADORES_NDA,
  FASE_SLUGS.LOTEADORES_CONTRATO_PARCERIA,
] as const;

export function faseLoteadoresCriaAtendimentoJuridico(slug: string | null | undefined): boolean {
  const s = String(slug ?? '').trim();
  return (FASES_LOTEADORES_CRIAM_ATENDIMENTO_JURIDICO as readonly string[]).includes(s);
}

export function isTipoBastaoJuridicoLoteadores(
  valor: string | null | undefined,
): valor is TipoBastaoJuridicoLoteadores {
  return (TIPOS_BASTAO_JURIDICO_LOTEADORES as readonly string[]).includes(String(valor ?? '').trim());
}

export function faseDestinoBastaoLoteadores(
  tipo: TipoBastaoJuridicoLoteadores,
  momento: MomentoBastaoJuridicoPortfolio,
): string {
  return TRILHAS_LOTEADORES[tipo][momento];
}

export function rotuloDocumentoAssinadoLoteadores(tipo: TipoBastaoJuridicoLoteadores): string {
  return TRILHAS_LOTEADORES[tipo].rotuloAssinado;
}

export function mensagemNotificacaoDocumentoAssinadoLoteadores(
  tipo: TipoBastaoJuridicoLoteadores,
): string {
  return `Jurídico concluído: ${rotuloDocumentoAssinadoLoteadores(tipo)}.`;
}

export function decidirBastaoJuridicoLoteadores(input: {
  tipo: TipoBastaoJuridicoLoteadores;
  momento: MomentoBastaoJuridicoPortfolio;
  fasePaiSlug: string;
  fasePaiNome: string;
  ordemPai: number | null;
  ordemDestino: number | null;
  faseDestinoNome: string;
}): DecisaoBastaoPortfolio {
  const trilha = TRILHAS_LOTEADORES[input.tipo];
  const outras = (
    Object.entries(TRILHAS_LOTEADORES) as [TipoBastaoJuridicoLoteadores, TrilhaDocumento][]
  )
    .filter(([tipo]) => tipo !== input.tipo)
    .map(([, item]) => item);
  return decidirBastaoPorTrilha({
    ...input,
    trilha,
    outrasTrilhas: outras,
    funil: 'Loteadores',
    slugsIgnorados: [FASE_SLUGS.LOTEADOR_JURIDICO],
  });
}
