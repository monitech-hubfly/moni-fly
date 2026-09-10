import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { PipelineFunilMesEtapaKey } from '@/lib/kanban/pipeline-cards-types';

/** Funil Pré Obra e Obra = Kanban Operações no Hub Fly. */
export const KANBAN_FUNIL_PRE_OBRA_OBRA = KANBAN_IDS.OPERACOES;

/** Funil Portfólio. */
export const KANBAN_FUNIL_PORTFOLIO = KANBAN_IDS.PORTFOLIO;

export type FunilMesEtapaFaseRegra = {
  kanbanIds: readonly string[];
  slugs: readonly string[];
};

/**
 * Funil do mês — rede: cada coluna soma cards **ativos** nas fases listadas («+»).
 * Fonte única de mapeamento coluna → funil + slugs de fase.
 */
export const FUNIL_MES_ETAPA_FASES: Record<PipelineFunilMesEtapaKey, FunilMesEtapaFaseRegra> = {
  /** Funil Portfólio — Análise de Novo Negócio */
  hipoteses: {
    kanbanIds: [KANBAN_FUNIL_PORTFOLIO],
    slugs: ['aprovacao_moni_novo_negocio'],
  },
  /** Funil Portfólio — Enviar / Jurídico / Assinaturas / Opção Assinada */
  opcoes: {
    kanbanIds: [KANBAN_FUNIL_PORTFOLIO],
    slugs: [
      FASE_SLUGS.STEP_3,
      FASE_SLUGS.OPCAO,
      FASE_SLUGS.PORTFOLIO_JURIDICO_OPCAO,
      FASE_SLUGS.PORTFOLIO_ASSINATURAS_OPCAO,
      FASE_SLUGS.PORTFOLIO_OPCAO_ASSINADA,
    ],
  },
  /** Funil Portfólio — Check Legal + Pré Comitê + Acoplamento + Comitê / Revisões / 2º Comitê */
  comites: {
    kanbanIds: [KANBAN_FUNIL_PORTFOLIO],
    slugs: [
      FASE_SLUGS.STEP_4,
      FASE_SLUGS.PORTFOLIO_PRE_COMITE,
      FASE_SLUGS.ACOPLAMENTO,
      FASE_SLUGS.STEP_5,
      FASE_SLUGS.PORTFOLIO_REVISOES_COMITE,
      FASE_SLUGS.PORTFOLIO_SEGUNDO_COMITE,
    ],
  },
  /** Funil Portfólio — CTO c/ Precedentes + Diligência + Contrato s/ Precedentes + Passagem / Convertidos */
  contratos: {
    kanbanIds: [KANBAN_FUNIL_PORTFOLIO],
    slugs: [
      FASE_SLUGS.CTO_CONDICOES_PRECEDENTES,
      FASE_SLUGS.PORTFOLIO_JURIDICO_CTO_PRECEDENTES,
      FASE_SLUGS.PORTFOLIO_ASSINATURAS_CTO_PRECEDENTES,
      FASE_SLUGS.PORTFOLIO_CTO_PRECEDENTES_ASSINADO,
      FASE_SLUGS.STEP_6,
      FASE_SLUGS.STEP_7,
      FASE_SLUGS.PORTFOLIO_JURIDICO_CONTRATO,
      FASE_SLUGS.PORTFOLIO_ASSINATURAS_CONTRATO,
      FASE_SLUGS.PORTFOLIO_CONTRATO_ASSINADO,
      FASE_SLUGS.PASSAGEM_WAYSER,
      FASE_SLUGS.PORTFOLIO_CONVERTIDOS,
    ],
  },
  /** Funil Pré Obra e Obra — Planialtimétrico + Projeto Legal + Aprovação Condomínio + Prefeitura */
  aprovacoes: {
    kanbanIds: [KANBAN_FUNIL_PRE_OBRA_OBRA],
    slugs: [
      'planialtimetrico',
      FASE_SLUGS.PROJETO_LEGAL,
      FASE_SLUGS.APROVACAO_CONDOMINIO,
      FASE_SLUGS.APROVACAO_PREFEITURA,
    ],
  },
  /**
   * Funil Pré Obra e Obra — Revisão BCA + Instrumento Garantidor (slug `revisao_bca`) + Transferência do Terreno
   */
  garantia_transferencia: {
    kanbanIds: [KANBAN_FUNIL_PRE_OBRA_OBRA],
    slugs: ['revisao_bca', FASE_SLUGS.PROCESSOS_CARTORARIOS],
  },
  /** Funil Pré Obra e Obra — Aguardando Crédito */
  aguardando_credito: {
    kanbanIds: [KANBAN_FUNIL_PRE_OBRA_OBRA],
    slugs: [FASE_SLUGS.AGUARDANDO_CREDITO],
  },
  /** Funil Pré Obra e Obra — Em Obra */
  obras_iniciadas: {
    kanbanIds: [KANBAN_FUNIL_PRE_OBRA_OBRA],
    slugs: [FASE_SLUGS.EM_OBRA],
  },
  /** Funil Pré Obra e Obra — Entregue */
  obras_finalizadas: {
    kanbanIds: [KANBAN_FUNIL_PRE_OBRA_OBRA],
    slugs: [FASE_SLUGS.OPERACOES_ENTREGUE],
  },
};

const SLUG_SET_CACHE = new Map<PipelineFunilMesEtapaKey, Set<string>>();

export function slugsFunilMesEtapa(key: PipelineFunilMesEtapaKey): Set<string> {
  const cached = SLUG_SET_CACHE.get(key);
  if (cached) return cached;
  const regra = FUNIL_MES_ETAPA_FASES[key];
  const set = new Set(regra.slugs.map((s) => String(s).trim()).filter(Boolean));
  SLUG_SET_CACHE.set(key, set);
  return set;
}

export function kanbanIdsFunilMesEtapa(key: PipelineFunilMesEtapaKey): readonly string[] {
  return FUNIL_MES_ETAPA_FASES[key].kanbanIds;
}

/** Card ativo conta na etapa quando está no funil e em uma das fases mapeadas. */
export function cardAtivoNaEtapaFunilMes(
  card: { kanban_id?: string | null; fase_slug?: string | null },
  key: PipelineFunilMesEtapaKey,
): boolean {
  const kanbanId = String(card.kanban_id ?? '').trim();
  if (!kanbanId) return false;

  const kanbanIds = kanbanIdsFunilMesEtapa(key);
  if (!kanbanIds.includes(kanbanId)) return false;

  const slug = String(card.fase_slug ?? '').trim();
  if (!slug) return false;

  return slugsFunilMesEtapa(key).has(slug);
}
