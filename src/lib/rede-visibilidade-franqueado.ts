/**
 * Franquia cuja regional e área de atuação não são exibidas na visão do portal do franqueado
 * (tabela da rede, gráficos agregados e bloco somente leitura do cadastro).
 */
export const FRANQUIA_OCULTA_REGIONAL_ATUACAO_FRANQUEADO = 'FK0000';

export function ocultarRegionalEAtuacaoNaVisaoFranqueado(nFranquia: string | null | undefined): boolean {
  const n = String(nFranquia ?? '').trim().toUpperCase();
  return n === FRANQUIA_OCULTA_REGIONAL_ATUACAO_FRANQUEADO;
}
