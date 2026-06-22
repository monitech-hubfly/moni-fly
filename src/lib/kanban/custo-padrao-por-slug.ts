/**
 * Texto padrão da coluna «Custo» na calculadora global (por slug de fase).
 * Fases sem entrada exibem «—».
 */
export const CUSTO_PADRAO_POR_SLUG: Record<string, string> = {
  // Funil Portfólio
  step_6: 'Franqueado: Forn. homologado',

  // Funil Contabilidade
  contabilidade_incorporadora: 'Franqueado: Todos os custos contábeis',
  contabilidade_spe: 'Franqueado: Todos os custos contábeis',
  contabilidade_gestora: 'Franqueado: Todos os custos contábeis',

  // Funil Operações
  planialtimetrico: 'Franqueado',
  aprovacao_condominio: 'Franqueado',
  aprovacao_prefeitura: 'Franqueado',
  processos_cartorarios: 'Franqueado',
};

export function custoPadraoPorSlug(slug: string | null | undefined): string | null {
  const s = String(slug ?? '').trim();
  if (!s) return null;
  return CUSTO_PADRAO_POR_SLUG[s] ?? null;
}
