/** Campos da ficha «Dados do Loteador» usados para estatísticas de preenchimento. */
import type { RedeLoteadorFichaDraft } from '@/lib/rede-loteador-ficha-draft';

export const REDE_LOTEADOR_FICHA_TRACKED_KEYS: (keyof RedeLoteadorFichaDraft)[] = [
  'interlocutor_nome',
  'interlocutor_cargo',
  'interlocutor_telefone',
  'interlocutor_email',
  'condominio_nome',
  'condominio_data_lancamento',
  'condominio_cidade',
  'estado',
  'condominio_qtd_lotes',
  'condominio_preco_lotes',
  'condominio_metragem_lotes',
  'condominio_preco_casas',
  'condominio_metragem_casas',
  'anexo_planta_cadastral',
  'anexo_manual_obras',
  'anexo_casas_concorrentes',
  'carteira_lotes_disponiveis',
  'carteira_lotes_vendidos_quitados',
  'carteira_carteira_curta_qtd',
  'carteira_curta_financiamento',
  'carteira_longa_qtd',
  'carteira_longa_financiamento',
  'anexo_tabela_precos',
  'campo_livre',
  'anexo_material_extra',
];

function isFilled(v: string | undefined): boolean {
  return Boolean(String(v ?? '').trim());
}

export function calcularStatsFichaLoteador(draft: RedeLoteadorFichaDraft): {
  total: number;
  preenchidos: number;
  pendentes: number;
  percentual: number;
} {
  const total = REDE_LOTEADOR_FICHA_TRACKED_KEYS.length;
  const preenchidos = REDE_LOTEADOR_FICHA_TRACKED_KEYS.filter((k) => isFilled(draft[k] as string)).length;
  const pendentes = total - preenchidos;
  const percentual = total > 0 ? Math.round((preenchidos / total) * 100) : 0;
  return { total, preenchidos, pendentes, percentual };
}

/** Mapeamento spec → colunas legadas (331). */
export const REDE_LOTEADOR_CAMPO_COMPAT: Record<string, string> = {
  nome_responsavel: 'interlocutor_nome',
  cargo_funcao: 'interlocutor_cargo',
  telefone: 'interlocutor_telefone',
  email: 'interlocutor_email',
  nome_condominio: 'condominio_nome',
  data_lancamento_tvo: 'condominio_data_lancamento',
  cidade: 'condominio_cidade',
  estado: 'condominio_estado',
  quantidade_lotes: 'condominio_qtd_lotes',
  preco_lotes: 'condominio_preco_lotes',
  metragem_lotes: 'condominio_metragem_lotes',
  preco_casas: 'condominio_preco_casas',
  metragem_media_casas: 'condominio_metragem_casas',
  planta_cadastral: 'anexo_planta_cadastral',
  manual_obras: 'anexo_manual_obras',
  casas_concorrentes: 'anexo_casas_concorrentes',
  lotes_disponiveis: 'carteira_lotes_disponiveis',
  lotes_vendidos_quitados: 'carteira_lotes_vendidos_quitados',
  lotes_carteira_curta: 'carteira_carteira_curta_qtd',
  modelo_carteira_curta: 'carteira_curta_financiamento',
  lotes_carteira_longa: 'carteira_longa_qtd',
  modelo_carteira_longa: 'carteira_longa_financiamento',
  tabela_precos: 'anexo_tabela_precos',
  informacoes_adicionais: 'campo_livre',
  materiais_complementares: 'anexo_material_extra',
};
