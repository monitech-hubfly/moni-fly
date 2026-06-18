export const PRE_BATALHA_SECOES_PROD = [
  { id: 'visao-geral', label: 'Visão geral' },
  { id: 'faixas', label: 'Faixas de mercado' },
  { id: 'filtros', label: 'Filtros de elegibilidade' },
  { id: 'produto', label: 'Nota de Produto' },
  { id: 'preco', label: 'Nota de Preço' },
  { id: 'ranking', label: 'Ranking e resultado' },
] as const;

export type PreBatalhaSecao = (typeof PRE_BATALHA_SECOES_PROD)[number]['id'];

export const PRE_BATALHA_PUBLIC_LEITURA_PATH = '/pre-batalha/leitura';

export function getPreBatalhaSecoesParaHub() {
  return PRE_BATALHA_SECOES_PROD;
}

export function isPreBatalhaSecao(s: string): s is PreBatalhaSecao {
  return PRE_BATALHA_SECOES_PROD.some((x) => x.id === s);
}

export function isPreBatalhaSecaoHubAtiva(s: string): s is PreBatalhaSecao {
  return isPreBatalhaSecao(s);
}
