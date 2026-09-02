import { normalizarSlaTipo, type SlaTipo } from '@/lib/dias-uteis';
import type { CondominioPrazosAprovacaoSla } from '@/lib/kanban/condominio-prazos-aprovacao';

/** SLAs canônicos da calculadora (independem do banco quando definidos). */
export const SLA_CALCULADORA_CANONICO_POR_SLUG: Record<
  string,
  { dias: number; tipo: Extract<SlaTipo, 'corridos' | 'uteis'> }
> = {
  aguardando_credito: { dias: 30, tipo: 'corridos' },
  em_obra: { dias: 180, tipo: 'corridos' },
};

/** SLAs padrão da calculadora quando a fase não tem sla_dias no banco. */
export const SLA_FALLBACK_CALCULADORA_POR_SLUG: Record<
  string,
  { dias: number; tipo: Extract<SlaTipo, 'corridos'> }
> = {
  aprovacao_condominio: { dias: 45, tipo: 'corridos' },
  aprovacao_prefeitura: { dias: 60, tipo: 'corridos' },
  processos_cartorarios: { dias: 30, tipo: 'corridos' },
};

export type SlaCalculadoraResolvido = {
  slaDias: number | null;
  slaTipo: SlaTipo;
  /** true quando usa fallback (banco sem SLA) — exibir tag «Prazo não definido». */
  slaPrazoNaoDefinido: boolean;
};

export function resolverSlaCalculadoraFase(
  slug: string | null | undefined,
  slaDias: number | null | undefined,
  slaTipo: string | null | undefined,
  condominioPrazos?: CondominioPrazosAprovacaoSla | null,
): SlaCalculadoraResolvido {
  const s = String(slug ?? '').trim();
  const canonico = s ? SLA_CALCULADORA_CANONICO_POR_SLUG[s] : undefined;
  if (canonico) {
    return {
      slaDias: canonico.dias,
      slaTipo: canonico.tipo,
      slaPrazoNaoDefinido: false,
    };
  }

  const condOverride =
    s === 'aprovacao_condominio'
      ? condominioPrazos?.aprovacao_condominio
      : s === 'aprovacao_prefeitura'
        ? condominioPrazos?.aprovacao_prefeitura
        : null;
  if (condOverride && condOverride.dias > 0) {
    return {
      slaDias: condOverride.dias,
      slaTipo: normalizarSlaTipo(condOverride.tipo),
      slaPrazoNaoDefinido: false,
    };
  }

  const diasBanco = slaDias != null && slaDias > 0 ? slaDias : null;
  if (diasBanco != null) {
    return {
      slaDias: diasBanco,
      slaTipo: normalizarSlaTipo(slaTipo),
      slaPrazoNaoDefinido: false,
    };
  }

  const fallback = s ? SLA_FALLBACK_CALCULADORA_POR_SLUG[s] : undefined;
  if (fallback) {
    return {
      slaDias: fallback.dias,
      slaTipo: fallback.tipo,
      slaPrazoNaoDefinido: true,
    };
  }

  return {
    slaDias: null,
    slaTipo: normalizarSlaTipo(slaTipo),
    slaPrazoNaoDefinido: false,
  };
}
