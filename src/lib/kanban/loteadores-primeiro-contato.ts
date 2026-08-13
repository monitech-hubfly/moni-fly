/** Checklist da fase «Primeiro Contato» — Funil Loteadores. */

import { isLoteadoresChecklistCampoVisivel } from '@/lib/kanban/loteadores-checklist-visibilidade';

export const LOTEADORES_PRIMEIRO_CONTATO_FASE_SLUG = 'primeiro_contato_moni_inc' as const;

/** Slug legado ainda presente em alguns ambientes (DEV) — mesmo checklist. */
export const LOTEADORES_PRIMEIRO_CONTATO_FASE_SLUG_LEGADO = 'loteador_cadastro' as const;

export const LOTEADORES_PRIMEIRO_CONTATO_CAMPOS = {
  nomeResponsavel: 'pc_nome_responsavel',
  cargoFuncao: 'pc_cargo_funcao',
  telefone: 'pc_telefone',
  email: 'pc_email',
  perfilLead: 'pc_perfil_lead',
  dataPrimeiroContato: 'pc_data_primeiro_contato',
  r1AgendamentoConfirmado: 'pc_r1_agendamento_confirmado',
  /** Legado — sync data/hora da reunião no card (oculto se sem dados). */
  dataReuniao: 'data_reuniao',
  horarioReuniao: 'horario_reuniao',
} as const;

export const LOTEADORES_PRIMEIRO_CONTATO_CAMPOS_VISIVEIS = [
  LOTEADORES_PRIMEIRO_CONTATO_CAMPOS.nomeResponsavel,
  LOTEADORES_PRIMEIRO_CONTATO_CAMPOS.cargoFuncao,
  LOTEADORES_PRIMEIRO_CONTATO_CAMPOS.telefone,
  LOTEADORES_PRIMEIRO_CONTATO_CAMPOS.email,
  LOTEADORES_PRIMEIRO_CONTATO_CAMPOS.perfilLead,
  LOTEADORES_PRIMEIRO_CONTATO_CAMPOS.dataPrimeiroContato,
  LOTEADORES_PRIMEIRO_CONTATO_CAMPOS.r1AgendamentoConfirmado,
] as const;

/** Horário padrão quando o card ainda não tem `hora_reuniao`. */
export const LOTEADORES_HORARIO_REUNIAO_PADRAO = '10:00';

export function isLoteadoresPrimeiroContatoFaseSlug(slug: string | null | undefined): boolean {
  const s = String(slug ?? '').trim();
  return s === LOTEADORES_PRIMEIRO_CONTATO_FASE_SLUG || s === LOTEADORES_PRIMEIRO_CONTATO_FASE_SLUG_LEGADO;
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
  return isLoteadoresChecklistCampoVisivel(item, LOTEADORES_PRIMEIRO_CONTATO_CAMPOS_VISIVEIS);
}
