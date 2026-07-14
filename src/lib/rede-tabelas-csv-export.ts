import { escapeCsvCell, linhasParaCsv } from '@/lib/csv-tabela-rede';
import {
  FRANQUEADO_EMPRESA_STATUS_LABEL,
  formatContaBancariaEmpresa,
} from '@/lib/franqueado-empresas';
import type { CadastroEmpresasLinhaComSpe } from '@/lib/franqueado-spe';
import type { CondominioRow } from '@/lib/condominios';
import {
  formatCidadeEstadoCondominio,
  formatCondominioInteiro,
  formatCondominioMoeda,
  formatEnderecoNumero,
} from '@/lib/condominios';
import {
  REDE_LOTEADOR_STATUS_LABEL,
  type RedeLoteadorRow,
} from '@/lib/rede-loteadores';
import type { MoniCapitalCadastroRow } from '@/lib/moni-capital-cadastros';

export const REDE_LOTEADOR_CSV_HEADERS = [
  'id',
  'codigo',
  'nome',
  'cnpj',
  'cidade',
  'estado',
  'contato_nome',
  'contato_telefone',
  'contato_email',
  'portfolio_descricao',
  'status',
  'observacoes',
] as const;

export const CONDOMINIO_CSV_HEADERS = [
  'id',
  'nome',
  'endereco',
  'numero',
  'cep',
  'cidade',
  'estado',
  'ticket_medio_lote',
  'ticket_medio_casas',
  'ticket_medio_casas_rsm2',
  'estimativa_casas_vendidas_ano',
  'extrato_como_eram_casas',
  'extrato_tempo_venda',
  'recuo_frontal_m',
  'recuo_fundo_m',
  'recuo_lateral_m',
] as const;

export const CADASTRO_EMPRESAS_CSV_HEADERS = [
  'n_franquia',
  'nome_completo',
  'inc_razao_social',
  'inc_cnpj',
  'inc_inscricao_municipal',
  'inc_inscricao_estadual',
  'inc_status',
  'inc_conta_banco',
  'inc_conta_agencia',
  'inc_conta_numero',
  'inc_conta_pix_tipo',
  'inc_conta_pix_chave',
  'gest_razao_social',
  'gest_cnpj',
  'gest_inscricao_municipal',
  'gest_inscricao_estadual',
  'gest_status',
] as const;

export function csvRedeLoteadores(rows: RedeLoteadorRow[]): string {
  const data = rows.map((r) => ({
    id: r.id,
    codigo: r.codigo ?? '',
    nome: r.nome ?? '',
    cnpj: r.cnpj ?? '',
    cidade: r.cidade ?? '',
    estado: r.estado ?? '',
    contato_nome: r.contato_nome ?? '',
    contato_telefone: r.contato_telefone ?? '',
    contato_email: r.contato_email ?? '',
    portfolio_descricao: r.portfolio_descricao ?? '',
    status: REDE_LOTEADOR_STATUS_LABEL[r.status] ?? r.status,
    observacoes: r.observacoes ?? '',
  }));
  return linhasParaCsv(REDE_LOTEADOR_CSV_HEADERS, data);
}

export function csvCondominios(rows: CondominioRow[]): string {
  const data = rows.map((r) => ({
    id: r.id,
    nome: r.nome ?? '',
    endereco: r.endereco ?? '',
    numero: r.numero ?? '',
    cep: r.cep ?? '',
    cidade: r.cidade ?? '',
    estado: r.estado ?? '',
    ticket_medio_lote: r.ticket_medio_lote != null ? String(r.ticket_medio_lote) : '',
    ticket_medio_casas: r.ticket_medio_casas != null ? String(r.ticket_medio_casas) : '',
    ticket_medio_casas_rsm2: r.ticket_medio_casas_rsm2 != null ? String(r.ticket_medio_casas_rsm2) : '',
    estimativa_casas_vendidas_ano:
      r.estimativa_casas_vendidas_ano != null ? String(r.estimativa_casas_vendidas_ano) : '',
    extrato_como_eram_casas: r.extrato_como_eram_casas ?? '',
    extrato_tempo_venda: r.extrato_tempo_venda ?? '',
    recuo_frontal_m: r.recuo_frontal_m != null ? String(r.recuo_frontal_m) : '',
    recuo_fundo_m: r.recuo_fundo_m != null ? String(r.recuo_fundo_m) : '',
    recuo_lateral_m: r.recuo_lateral_m != null ? String(r.recuo_lateral_m) : '',
  }));
  return linhasParaCsv(CONDOMINIO_CSV_HEADERS, data);
}

export const MONI_CAPITAL_CADASTROS_CSV_HEADERS = [
  'n_cadastro',
  'broker_nome',
  'broker_email',
  'broker_telefone',
  'investidor_nome',
  'investidor_email',
  'investidor_telefone',
] as const;

export function csvMoniCapitalCadastros(rows: MoniCapitalCadastroRow[]): string {
  const data = rows.map((r) => ({
    n_cadastro: r.n_cadastro ?? '',
    broker_nome: r.broker_nome ?? '',
    broker_email: r.broker_email ?? '',
    broker_telefone: r.broker_telefone ?? '',
    investidor_nome: r.investidor_nome ?? '',
    investidor_email: r.investidor_email ?? '',
    investidor_telefone: r.investidor_telefone ?? '',
  }));
  return linhasParaCsv(MONI_CAPITAL_CADASTROS_CSV_HEADERS, data);
}

export function csvCadastrosEmpresas(linhas: CadastroEmpresasLinhaComSpe[]): string {
  const data = linhas.map((l) => {
    const inc = l.incorporadora;
    const gest = l.gestora;
    return {
      n_franquia: l.n_franquia ?? '',
      nome_completo: l.nome_completo ?? '',
      inc_razao_social: inc?.razao_social ?? '',
      inc_cnpj: inc?.cnpj ?? '',
      inc_inscricao_municipal: inc?.inscricao_municipal ?? '',
      inc_inscricao_estadual: inc?.inscricao_estadual ?? '',
      inc_status: inc ? FRANQUEADO_EMPRESA_STATUS_LABEL[inc.status] : '',
      inc_conta_banco: inc?.conta_banco ?? '',
      inc_conta_agencia: inc?.conta_agencia ?? '',
      inc_conta_numero: inc?.conta_numero ?? '',
      inc_conta_pix_tipo: inc?.conta_pix_tipo ?? '',
      inc_conta_pix_chave: inc?.conta_pix_chave ?? '',
      gest_razao_social: gest?.razao_social ?? '',
      gest_cnpj: gest?.cnpj ?? '',
      gest_inscricao_municipal: gest?.inscricao_municipal ?? '',
      gest_inscricao_estadual: gest?.inscricao_estadual ?? '',
      gest_status: gest ? FRANQUEADO_EMPRESA_STATUS_LABEL[gest.status] : '',
    };
  });
  return linhasParaCsv(CADASTRO_EMPRESAS_CSV_HEADERS, data);
}

/** Linhas legíveis para exportação ampliada (condomínios — colunas da tabela). */
export function csvCondominiosTabela(rows: CondominioRow[]): string {
  const headers = [
    'nome',
    'endereco_numero',
    'cep',
    'cidade_estado',
    'ticket_medio_lote',
    'ticket_medio_casas',
    'ticket_medio_casas_rsm2',
    'estimativa_casas_vendidas_ano',
    'extrato_como_eram_casas',
    'extrato_tempo_venda',
  ] as const;
  const data = rows.map((r) => ({
    nome: r.nome,
    endereco_numero: formatEnderecoNumero(r.endereco, r.numero),
    cep: r.cep ?? '',
    cidade_estado: formatCidadeEstadoCondominio(r.cidade, r.estado),
    ticket_medio_lote: formatCondominioMoeda(r.ticket_medio_lote),
    ticket_medio_casas: formatCondominioMoeda(r.ticket_medio_casas),
    ticket_medio_casas_rsm2: formatCondominioMoeda(r.ticket_medio_casas_rsm2),
    estimativa_casas_vendidas_ano: formatCondominioInteiro(r.estimativa_casas_vendidas_ano),
    extrato_como_eram_casas: r.extrato_como_eram_casas ?? '',
    extrato_tempo_venda: r.extrato_tempo_venda ?? '',
  }));
  return linhasParaCsv(headers, data);
}

export function csvLoteadoresTabela(rows: RedeLoteadorRow[]): string {
  const headers = ['nome', 'cnpj', 'cidade_estado', 'contato', 'portfolio', 'status'] as const;
  const data = rows.map((r) => ({
    nome: r.nome,
    cnpj: r.cnpj ?? '',
    cidade_estado: [r.cidade, r.estado].filter(Boolean).join(' / '),
    contato: [r.contato_nome, r.contato_telefone, r.contato_email].filter(Boolean).join(' · '),
    portfolio: r.portfolio_descricao ?? '',
    status: REDE_LOTEADOR_STATUS_LABEL[r.status],
  }));
  return linhasParaCsv(headers, data);
}

export function csvEmpresasTabela(linhas: CadastroEmpresasLinhaComSpe[]): string {
  const headers = [
    'n_franquia',
    'nome_completo',
    'inc_razao_social',
    'inc_cnpj',
    'inc_status',
    'inc_conta',
    'gest_razao_social',
    'gest_cnpj',
    'gest_status',
    'spe_resumo',
  ] as const;
  const data = linhas.map((l) => ({
    n_franquia: l.n_franquia ?? '',
    nome_completo: l.nome_completo ?? '',
    inc_razao_social: l.incorporadora?.razao_social ?? '',
    inc_cnpj: l.incorporadora?.cnpj ?? '',
    inc_status: l.incorporadora ? FRANQUEADO_EMPRESA_STATUS_LABEL[l.incorporadora.status] : '',
    inc_conta: formatContaBancariaEmpresa(
      l.incorporadora?.conta_banco,
      l.incorporadora?.conta_agencia,
      l.incorporadora?.conta_numero,
      l.incorporadora?.conta_pix_tipo,
      l.incorporadora?.conta_pix_chave,
    ),
    gest_razao_social: l.gestora?.razao_social ?? '',
    gest_cnpj: l.gestora?.cnpj ?? '',
    gest_status: l.gestora ? FRANQUEADO_EMPRESA_STATUS_LABEL[l.gestora.status] : '',
    spe_resumo: l.spes.map((s) => s.nome_projeto || s.razao_social || s.id.slice(0, 8)).join('; '),
  }));
  return linhasParaCsv(headers, data);
}
