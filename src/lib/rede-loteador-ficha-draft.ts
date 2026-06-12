import type { RedeLoteadorPatch, RedeLoteadorRow, RedeLoteadorStatus } from '@/lib/rede-loteadores';

export type RedeLoteadorFichaDraft = {
  nome: string;
  cnpj: string;
  cidade: string;
  estado: string;
  contato_nome: string;
  contato_telefone: string;
  contato_email: string;
  portfolio_descricao: string;
  status: RedeLoteadorStatus;
  observacoes: string;
  interlocutor_nome: string;
  interlocutor_cargo: string;
  interlocutor_telefone: string;
  interlocutor_email: string;
  condominio_nome: string;
  condominio_data_lancamento: string;
  condominio_cidade: string;
  condominio_qtd_lotes: string;
  condominio_preco_lotes: string;
  condominio_metragem_lotes: string;
  condominio_preco_casas: string;
  condominio_metragem_casas: string;
  anexo_planta_cadastral: string;
  anexo_manual_obras: string;
  anexo_casas_concorrentes: string;
  carteira_lotes_disponiveis: string;
  carteira_lotes_vendidos_quitados: string;
  carteira_carteira_curta_qtd: string;
  carteira_curta_financiamento: string;
  carteira_longa_qtd: string;
  carteira_longa_financiamento: string;
  anexo_tabela_precos: string;
  campo_livre: string;
  anexo_material_extra: string;
};

export function emptyRedeLoteadorFichaDraft(status: RedeLoteadorStatus = 'em_analise'): RedeLoteadorFichaDraft {
  return {
    nome: '',
    cnpj: '',
    cidade: '',
    estado: '',
    contato_nome: '',
    contato_telefone: '',
    contato_email: '',
    portfolio_descricao: '',
    status,
    observacoes: '',
    interlocutor_nome: '',
    interlocutor_cargo: '',
    interlocutor_telefone: '',
    interlocutor_email: '',
    condominio_nome: '',
    condominio_data_lancamento: '',
    condominio_cidade: '',
    condominio_qtd_lotes: '',
    condominio_preco_lotes: '',
    condominio_metragem_lotes: '',
    condominio_preco_casas: '',
    condominio_metragem_casas: '',
    anexo_planta_cadastral: '',
    anexo_manual_obras: '',
    anexo_casas_concorrentes: '',
    carteira_lotes_disponiveis: '',
    carteira_lotes_vendidos_quitados: '',
    carteira_carteira_curta_qtd: '',
    carteira_curta_financiamento: '',
    carteira_longa_qtd: '',
    carteira_longa_financiamento: '',
    anexo_tabela_precos: '',
    campo_livre: '',
    anexo_material_extra: '',
  };
}

function str(v: string | null | undefined): string {
  return (v ?? '').trim();
}

function intStr(v: number | null | undefined): string {
  return v == null ? '' : String(v);
}

export function redeLoteadorRowToFichaDraft(r: RedeLoteadorRow): RedeLoteadorFichaDraft {
  return {
    nome: str(r.nome),
    cnpj: str(r.cnpj),
    cidade: str(r.cidade),
    estado: str(r.estado),
    contato_nome: str(r.contato_nome),
    contato_telefone: str(r.contato_telefone),
    contato_email: str(r.contato_email),
    portfolio_descricao: str(r.portfolio_descricao),
    status: r.status,
    observacoes: str(r.observacoes),
    interlocutor_nome: str(r.interlocutor_nome),
    interlocutor_cargo: str(r.interlocutor_cargo),
    interlocutor_telefone: str(r.interlocutor_telefone),
    interlocutor_email: str(r.interlocutor_email),
    condominio_nome: str(r.condominio_nome),
    condominio_data_lancamento: str(r.condominio_data_lancamento),
    condominio_cidade: str(r.condominio_cidade),
    condominio_qtd_lotes: intStr(r.condominio_qtd_lotes),
    condominio_preco_lotes: str(r.condominio_preco_lotes),
    condominio_metragem_lotes: str(r.condominio_metragem_lotes),
    condominio_preco_casas: str(r.condominio_preco_casas),
    condominio_metragem_casas: str(r.condominio_metragem_casas),
    anexo_planta_cadastral: str(r.anexo_planta_cadastral),
    anexo_manual_obras: str(r.anexo_manual_obras),
    anexo_casas_concorrentes: str(r.anexo_casas_concorrentes),
    carteira_lotes_disponiveis: intStr(r.carteira_lotes_disponiveis),
    carteira_lotes_vendidos_quitados: intStr(r.carteira_lotes_vendidos_quitados),
    carteira_carteira_curta_qtd: intStr(r.carteira_carteira_curta_qtd),
    carteira_curta_financiamento: str(r.carteira_curta_financiamento),
    carteira_longa_qtd: intStr(r.carteira_longa_qtd),
    carteira_longa_financiamento: str(r.carteira_longa_financiamento),
    anexo_tabela_precos: str(r.anexo_tabela_precos),
    campo_livre: str(r.campo_livre),
    anexo_material_extra: str(r.anexo_material_extra),
  };
}

function parseIntField(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export function redeLoteadorFichaDraftToPatch(d: RedeLoteadorFichaDraft): RedeLoteadorPatch {
  const t = (s: string) => s.trim() || null;
  return {
    nome: d.nome.trim(),
    cnpj: t(d.cnpj),
    cidade: t(d.cidade),
    estado: t(d.estado),
    contato_nome: t(d.contato_nome),
    contato_telefone: t(d.contato_telefone),
    contato_email: t(d.contato_email),
    portfolio_descricao: t(d.portfolio_descricao),
    status: d.status,
    observacoes: t(d.observacoes),
    interlocutor_nome: t(d.interlocutor_nome),
    interlocutor_cargo: t(d.interlocutor_cargo),
    interlocutor_telefone: t(d.interlocutor_telefone),
    interlocutor_email: t(d.interlocutor_email),
    condominio_nome: t(d.condominio_nome),
    condominio_data_lancamento: t(d.condominio_data_lancamento),
    condominio_cidade: t(d.condominio_cidade),
    condominio_qtd_lotes: parseIntField(d.condominio_qtd_lotes),
    condominio_preco_lotes: t(d.condominio_preco_lotes),
    condominio_metragem_lotes: t(d.condominio_metragem_lotes),
    condominio_preco_casas: t(d.condominio_preco_casas),
    condominio_metragem_casas: t(d.condominio_metragem_casas),
    anexo_planta_cadastral: t(d.anexo_planta_cadastral),
    anexo_manual_obras: t(d.anexo_manual_obras),
    anexo_casas_concorrentes: t(d.anexo_casas_concorrentes),
    carteira_lotes_disponiveis: parseIntField(d.carteira_lotes_disponiveis),
    carteira_lotes_vendidos_quitados: parseIntField(d.carteira_lotes_vendidos_quitados),
    carteira_carteira_curta_qtd: parseIntField(d.carteira_carteira_curta_qtd),
    carteira_curta_financiamento: t(d.carteira_curta_financiamento),
    carteira_longa_qtd: parseIntField(d.carteira_longa_qtd),
    carteira_longa_financiamento: t(d.carteira_longa_financiamento),
    anexo_tabela_precos: t(d.anexo_tabela_precos),
    campo_livre: t(d.campo_livre),
    anexo_material_extra: t(d.anexo_material_extra),
  };
}
