import { isFranquiaCasaMoniFk0000 } from '@/lib/franquia-casa-moni-fk0000';

/**
 * Franquia interna (Casa Moní) omitida de agregados na aba Visão geral e de regional/área
 * na visão do portal do franqueado (tabela da rede e bloco somente leitura do cadastro).
 */
export const FRANQUIA_OCULTA_REGIONAL_ATUACAO_FRANQUEADO = 'FK0000';

export function excluirFranquiaDosGraficosVisaoGeral(nFranquia: string | null | undefined): boolean {
  return isFranquiaCasaMoniFk0000(nFranquia);
}

export function ocultarRegionalEAtuacaoNaVisaoFranqueado(nFranquia: string | null | undefined): boolean {
  return excluirFranquiaDosGraficosVisaoGeral(nFranquia);
}

export function filtrarLinhasParaGraficosVisaoGeral<T extends { n_franquia?: string | null }>(
  rows: T[],
): T[] {
  return rows.filter((r) => !excluirFranquiaDosGraficosVisaoGeral(r.n_franquia));
}
