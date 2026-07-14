import { calcularStatusSLAPorTipo, normalizarSlaTipo, rotuloUnidadeSla, type SlaTipo } from '@/lib/dias-uteis';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';

export const TAG_AGUARDANDO_DOCUMENTACAO = 'Aguardando Documentação';
export const CLASSE_TAG_AGUARDANDO_DOCUMENTACAO = 'moni-tag-atencao';

export type SlaKanbanResult = {
  status: 'ok' | 'atencao' | 'atrasado';
  label: string;
  classe: string;
  /** SLA pausado (ex.: aguardando documentação na fase de alvará). */
  pausado: boolean;
  /** Fase sem `sla_dias` configurado — faixa lateral cinza, sem chip. */
  semSla?: boolean;
  diasAtraso?: number;
  diasRestantes?: number;
  slaTipo?: SlaTipo;
};

/** Tag textual padronizada para cards — formato curto "X d.u." (ok não exibe tag). */
export function tagSlaKanbanParaExibicao(
  sla: SlaKanbanResult,
): { texto: string; variante: 'ok' | 'atencao' | 'atrasado' } | null {
  if (sla.pausado || sla.status === 'ok') return null;
  const unidade = rotuloUnidadeSla(sla.slaTipo);
  const n =
    sla.status === 'atrasado'
      ? Math.max(1, sla.diasAtraso ?? 1)
      : sla.diasRestantes ?? 0;
  return {
    texto: `${n} ${unidade}`,
    variante: sla.status,
  };
}

/** @deprecated Preferir tagSlaKanbanParaExibicao — mantido para follow-up (FU). */
export function indicadorBolinhaSlaKanban(
  sla: SlaKanbanResult,
): { variante: 'atrasado' | 'atencao'; numero: number; title: string } | null {
  if (sla.pausado || sla.status === 'ok') return null;
  const unidade = rotuloUnidadeSla(sla.slaTipo);
  if (sla.status === 'atrasado') {
    const n = sla.diasAtraso ?? 0;
    return {
      variante: 'atrasado',
      numero: Math.max(1, n),
      title: `SLA da fase: ${n} ${unidade} em atraso`,
    };
  }
  const n = sla.diasRestantes ?? (sla.label === 'Vence hoje' ? 0 : 1);
  return {
    variante: 'atencao',
    numero: n,
    title: n === 0 ? 'SLA da fase vence hoje' : `SLA da fase vence em ${n} ${unidade}`,
  };
}

export function urlDocumentacaoCreditoObraPreenchida(value: string | null | undefined): boolean {
  return String(value ?? '').trim().length > 0;
}

/** Card nativo na fase Documentação Alvará com pelo menos um documento pendente. */
export function creditoObraAguardandoDocumentacao(input: {
  faseSlug: string | null | undefined;
  alvara_url?: string | null;
  docs_terreno_url?: string | null;
}): boolean {
  const slug = String(input.faseSlug ?? '').trim();
  if (slug !== FASE_SLUGS.CO_DOCUMENTACAO_ALVARA) return false;
  return (
    !urlDocumentacaoCreditoObraPreenchida(input.alvara_url) ||
    !urlDocumentacaoCreditoObraPreenchida(input.docs_terreno_url)
  );
}

function parseDataIso(iso: string | null | undefined): Date | null {
  const s = String(iso ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function resolveDataBaseSlaKanban(input: {
  created_at: string;
  entered_fase_at?: string | null;
  sla_iniciado_em?: string | null;
  faseSlug?: string | null;
  alvara_url?: string | null;
  docs_terreno_url?: string | null;
}): Date | null {
  if (
    creditoObraAguardandoDocumentacao({
      faseSlug: input.faseSlug,
      alvara_url: input.alvara_url,
      docs_terreno_url: input.docs_terreno_url,
    })
  ) {
    return null;
  }
  // sla_iniciado_em: override explícito (ex.: Crédito Obra após docs).
  const slaIniciado = parseDataIso(input.sla_iniciado_em);
  if (slaIniciado) return slaIniciado;
  // entered_fase_at: entrada na fase atual (migration 213) — base correta do SLA por fase.
  const enteredFase = parseDataIso(input.entered_fase_at);
  if (enteredFase) return enteredFase;
  return parseDataIso(input.created_at);
}

export function calcularSlaKanbanCard(input: {
  created_at: string;
  entered_fase_at?: string | null;
  sla_iniciado_em?: string | null;
  faseSlug?: string | null;
  alvara_url?: string | null;
  docs_terreno_url?: string | null;
  sla_dias?: number | null;
  sla_tipo?: SlaTipo | string | null;
}): SlaKanbanResult {
  const aguardando = creditoObraAguardandoDocumentacao({
    faseSlug: input.faseSlug,
    alvara_url: input.alvara_url,
    docs_terreno_url: input.docs_terreno_url,
  });
  if (aguardando) {
    return { status: 'ok', label: '', classe: '', pausado: true };
  }

  const slaDias = input.sla_dias != null && input.sla_dias > 0 ? input.sla_dias : 0;
  if (slaDias <= 0) {
    // Sem SLA na fase: não inventar 999 dias (falso "no prazo" verde).
    return { status: 'ok', label: '', classe: '', pausado: false, semSla: true };
  }

  const base = resolveDataBaseSlaKanban(input);
  if (!base) {
    return { status: 'ok', label: '', classe: '', pausado: false, semSla: true };
  }
  const slaTipo = normalizarSlaTipo(input.sla_tipo);
  const sla = calcularStatusSLAPorTipo(base, slaDias, slaTipo);
  return { ...sla, pausado: false, semSla: false };
}
