import { calcularStatusSLA } from '@/lib/dias-uteis';
import { FASE_SLUGS } from '@/lib/constants/kanban-ids';

export const TAG_AGUARDANDO_DOCUMENTACAO = 'Aguardando Documentação';
export const CLASSE_TAG_AGUARDANDO_DOCUMENTACAO = 'moni-tag-atencao';

export type SlaKanbanResult = {
  status: 'ok' | 'atencao' | 'atrasado';
  label: string;
  classe: string;
  /** SLA pausado (ex.: aguardando documentação na fase de alvará). */
  pausado: boolean;
};

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

export function resolveDataBaseSlaKanban(input: {
  created_at: string;
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
  const slaIso = String(input.sla_iniciado_em ?? '').trim();
  if (slaIso) {
    const d = new Date(slaIso);
    if (Number.isFinite(d.getTime())) return d;
  }
  const created = new Date(input.created_at);
  return Number.isFinite(created.getTime()) ? created : null;
}

export function calcularSlaKanbanCard(input: {
  created_at: string;
  sla_iniciado_em?: string | null;
  faseSlug?: string | null;
  alvara_url?: string | null;
  docs_terreno_url?: string | null;
  sla_dias?: number | null;
}): SlaKanbanResult {
  const aguardando = creditoObraAguardandoDocumentacao({
    faseSlug: input.faseSlug,
    alvara_url: input.alvara_url,
    docs_terreno_url: input.docs_terreno_url,
  });
  if (aguardando) {
    return { status: 'ok', label: '', classe: '', pausado: true };
  }

  const base = resolveDataBaseSlaKanban(input);
  const slaDias = input.sla_dias != null && input.sla_dias > 0 ? input.sla_dias : 999;
  if (!base) {
    return { status: 'ok', label: '', classe: '', pausado: false };
  }
  const sla = calcularStatusSLA(base, slaDias);
  return { ...sla, pausado: false };
}
