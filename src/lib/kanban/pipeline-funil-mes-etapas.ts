import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import type { PipelineFunilMesEtapaKey } from '@/lib/kanban/pipeline-cards-types';

/** Funil Pré Obra e Obra = Kanban Operações no Hub Fly. */
export const KANBAN_PRE_OBRA_OBRA = KANBAN_IDS.OPERACOES;

export type FunilMesEtapaFaseRegra = {
  kanbanIds: readonly string[];
  slugs: readonly string[];
};

/** Slugs da fase Opção (legado `step_3` + canônico `opcao`). */
export const SLUGS_FASE_OPCAO = [FASE_SLUGS.STEP_3, FASE_SLUGS.OPCAO] as const;

/** Slug canônico — Análise de Novo Negócio (Funil Portfólio). */
export const SLUG_APROVACAO_MONI_NOVO_NEGOCIO = 'aprovacao_moni_novo_negocio' as const;

/** Slug canônico — Planialtimétrico (Funil Pré Obra e Obra). */
export const SLUG_PLANIALTIMETRICO = 'planialtimetrico' as const;

/** Slug canônico — Revisão BCA + Instrumento Garantidor (Funil Pré Obra e Obra). */
export const SLUG_REVISAO_BCA = 'revisao_bca' as const;

/**
 * Mapeamento das colunas do Funil do mês — rede → funil + fases que alimentam contagem/lista.
 * Contagem: cards ativos atualmente em qualquer fase mapeada (soma das fases com «+»).
 * Período Mês/Tri aplica-se apenas à etapa Hipóteses.
 */
export const FUNIL_MES_ETAPA_FASES: Partial<Record<PipelineFunilMesEtapaKey, FunilMesEtapaFaseRegra>> = {
  /** Funil Portfólio — Análise de Novo Negócio + Opção */
  opcoes: {
    kanbanIds: [KANBAN_IDS.PORTFOLIO],
    slugs: [SLUG_APROVACAO_MONI_NOVO_NEGOCIO, ...SLUGS_FASE_OPCAO],
  },
  /** Funil Portfólio — Check Legal e Crédito + Acoplamento + Comitê */
  comites: {
    kanbanIds: [KANBAN_IDS.PORTFOLIO],
    slugs: [FASE_SLUGS.STEP_4, FASE_SLUGS.ACOPLAMENTO, FASE_SLUGS.STEP_5],
  },
  /** Funil Portfólio — CTO Condições Precedentes + Diligência + Contrato + Captação Moní Capital */
  contratos: {
    kanbanIds: [KANBAN_IDS.PORTFOLIO],
    slugs: [
      FASE_SLUGS.CTO_CONDICOES_PRECEDENTES,
      FASE_SLUGS.STEP_6,
      FASE_SLUGS.STEP_7,
      FASE_SLUGS.CAPTACAO_CAPITAL,
    ],
  },
  /** Funil Pré Obra e Obra — Planialtimétrico + Projeto Legal + Aprovação Condomínio + Prefeitura */
  aprovacoes: {
    kanbanIds: [KANBAN_PRE_OBRA_OBRA],
    slugs: [
      SLUG_PLANIALTIMETRICO,
      FASE_SLUGS.PROJETO_LEGAL,
      FASE_SLUGS.APROVACAO_CONDOMINIO,
      FASE_SLUGS.APROVACAO_PREFEITURA,
    ],
  },
  /** Funil Pré Obra e Obra — Revisão BCA + Instrumento Garantidor + Transferência do Terreno */
  garantia_transferencia: {
    kanbanIds: [KANBAN_PRE_OBRA_OBRA],
    slugs: [SLUG_REVISAO_BCA, FASE_SLUGS.PROCESSOS_CARTORARIOS],
  },
  /** Funil Pré Obra e Obra — Aguardando Crédito */
  aguardando_credito: {
    kanbanIds: [KANBAN_PRE_OBRA_OBRA],
    slugs: [FASE_SLUGS.AGUARDANDO_CREDITO],
  },
  /** Funil Pré Obra e Obra — Em Obra */
  obras_iniciadas: {
    kanbanIds: [KANBAN_PRE_OBRA_OBRA],
    slugs: [FASE_SLUGS.EM_OBRA],
  },
  obras_finalizadas: {
    kanbanIds: [KANBAN_PRE_OBRA_OBRA],
    slugs: [FASE_SLUGS.OPERACOES_ENTREGUE],
  },
};

const SLUG_SET_CACHE = new Map<PipelineFunilMesEtapaKey, Set<string>>();

export function slugsFunilMesEtapa(key: PipelineFunilMesEtapaKey): Set<string> | null {
  const cached = SLUG_SET_CACHE.get(key);
  if (cached) return cached;
  const regra = FUNIL_MES_ETAPA_FASES[key];
  if (!regra) return null;
  const set = new Set(regra.slugs.map((s) => String(s).trim()).filter(Boolean));
  SLUG_SET_CACHE.set(key, set);
  return set;
}

export function kanbanIdsFunilMesEtapa(key: PipelineFunilMesEtapaKey): readonly string[] | null {
  return FUNIL_MES_ETAPA_FASES[key]?.kanbanIds ?? null;
}
