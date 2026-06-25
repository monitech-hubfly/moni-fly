/**
 * Texto padrão da coluna «Custo» na calculadora global (por slug de fase).
 * Fases sem entrada exibem «—».
 */
export const CUSTO_PADRAO_POR_SLUG: Record<string, string> = {
  // Funil Portfólio
  step_3: 'Franqueado: autenticação de documentos e custos administrativos.',
  opcao: 'Franqueado: autenticação de documentos e custos administrativos.',
  step_6:
    'Franqueado: lista obrigatória e complementares: certidões negativas, análises jurídicas, avaliações técnicas, estudos ambientais e despesas administrativas.',
  step_7: 'Franqueado: autenticação de documentos e custos administrativos.',

  // Funil Contabilidade
  contabilidade_incorporadora: 'Franqueado: Todos os custos contábeis',
  contabilidade_spe: 'Franqueado: Todos os custos contábeis',
  contabilidade_gestora: 'Franqueado: Todos os custos contábeis',

  // Funil Operações
  planialtimetrico:
    'Franqueado: levantamento planialtimétrico, sondagem de solo e análises técnicas do terreno.',
  aprovacao_condominio: 'Franqueado: registros de responsabilidade técnica e taxas de aprovação',
  aprovacao_prefeitura:
    'Franqueado: registro de responsabilidade e taxas municipais e protocolos necessários para aprovação de obras.',
  processos_cartorarios:
    'Franqueado: ITBI, impostos, taxas para transferência e custas do terreno',
};

export function custoPadraoPorSlug(slug: string | null | undefined): string | null {
  const s = String(slug ?? '').trim();
  if (!s) return null;
  return CUSTO_PADRAO_POR_SLUG[s] ?? null;
}
