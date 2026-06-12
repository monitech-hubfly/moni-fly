/** Checklist da fase «Primeiro Contato» — Funil Loteadores. */

export const LOTEADORES_PRIMEIRO_CONTATO_FASE_SLUG = 'primeiro_contato_moni_inc' as const;

export const LOTEADORES_PRIMEIRO_CONTATO_CAMPOS = {
  comoFoi: 'como_foi_primeiro_contato',
  dataReuniao: 'data_reuniao',
  horarioReuniao: 'horario_reuniao',
} as const;

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
  return item.config_json?.oculto_ui === true;
}
