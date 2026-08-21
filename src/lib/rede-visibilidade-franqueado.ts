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

/** Card só entra em gráfico/KPI de rede se estiver vinculado a uma linha do cadastro. */
export function cardVinculadoAoCadastroRedeFranqueados(card: {
  rede_franqueado_id?: string | null;
  n_franquia?: string | null;
}): boolean {
  if (excluirFranquiaDosGraficosVisaoGeral(card.n_franquia)) return false;
  return Boolean(String(card.rede_franqueado_id ?? '').trim());
}

/**
 * Cards da esteira que pertencem ao cadastro Rede de Franqueados (exclui FK0000 e órfãos).
 * Totais de funil/KPI da franqueadora não podem contar kanban sem `rede_franqueado_id`.
 */
export function cardsVinculadosAoCadastroRedeFranqueados<
  T extends { rede_franqueado_id?: string | null; n_franquia?: string | null },
>(
  cards: T[],
  franqueados: { rede_franqueado_id: string; n_franquia?: string | null }[],
): T[] {
  const ids = new Set(
    filtrarLinhasParaGraficosVisaoGeral(franqueados).map((f) => f.rede_franqueado_id),
  );
  return cards.filter((c) => {
    const rid = String(c.rede_franqueado_id ?? '').trim();
    return Boolean(rid && ids.has(rid));
  });
}
