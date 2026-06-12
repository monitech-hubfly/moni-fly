/** Checklist da fase «Primeiro Contato» — Funil Loteadores. */

export const LOTEADORES_PRIMEIRO_CONTATO_FASE_SLUG = 'primeiro_contato_moni_inc' as const;

export const LOTEADORES_PRIMEIRO_CONTATO_CAMPOS = {
  comoFoi: 'como_foi_primeiro_contato',
  dataReuniao: 'data_reuniao',
  horarioReuniao: 'horario_reuniao',
} as const;

export const LOTEADORES_PRIMEIRO_CONTATO_CAMPOS_VISIVEIS = Object.values(
  LOTEADORES_PRIMEIRO_CONTATO_CAMPOS,
);

/** Slugs legados removidos da UI (migration 341). */
export const LOTEADORES_PRIMEIRO_CONTATO_CAMPOS_REMOVIDOS = [
  'primeiro_contato_descricao',
  'responsavel_contato',
  'canal_contato',
  'participantes_previstos',
  'observacoes_reuniao',
] as const;

/** Horário padrão quando o card ainda não tem `hora_reuniao`. */
export const LOTEADORES_HORARIO_REUNIAO_PADRAO = '10:00';

export function isLoteadoresPrimeiroContatoFaseSlug(slug: string | null | undefined): boolean {
  return String(slug ?? '').trim() === LOTEADORES_PRIMEIRO_CONTATO_FASE_SLUG;
}

export function horarioReuniaoPadraoDoCard(horaReuniao: string | null | undefined): string {
  const h = String(horaReuniao ?? '').trim();
  return h || LOTEADORES_HORARIO_REUNIAO_PADRAO;
}

export function isChecklistItemOcultoUi(item: { config_json?: Record<string, unknown> | null }): boolean {
  const v = item.config_json?.oculto_ui;
  return v === true || v === 'true';
}

export function isLoteadoresPrimeiroContatoCampoVisivel(item: {
  campo_slug?: string | null;
  label?: string | null;
}): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if (slug) {
    return (LOTEADORES_PRIMEIRO_CONTATO_CAMPOS_VISIVEIS as readonly string[]).includes(slug);
  }
  const label = String(item.label ?? '').trim();
  return (
    label === 'Como foi o primeiro contato?' ||
    label === 'Data da Reunião' ||
    label === 'Data da reunião' ||
    label === 'Horário da Reunião' ||
    label === 'Horário da reunião'
  );
}
