/** Cadastro de corretores (`rede_corretores`). */

import type { createClient } from '@/lib/supabase/server'
import type { PixTipo } from '@/lib/br-docs'

export type RedeCorretorStatus = 'ativo' | 'inativo' | 'em_analise' | 'pendente' | 'aprovado'

export type RedeCorretorTipoRegistro =
  | 'estagiario'
  | 'tecnico_transacoes'
  | 'corretor_titular'

export type RedeCorretorContaTipo = 'corrente' | 'poupanca'

export type RedeCorretorCidadeAtuacao = {
  ibge_id: number
  nome: string
  uf: string
}

export type RedeCorretorRow = {
  id: string
  n_corretor: string | null
  ordem: number | null
  nome: string
  cpf_cnpj: string | null
  creci_numero: string | null
  creci_uf: string | null
  creci_tipo_registro: RedeCorretorTipoRegistro | null
  creci_validade: string | null
  email: string | null
  telefone: string | null
  atuacao_ufs: string[] | null
  atuacao_cidades: RedeCorretorCidadeAtuacao[] | null
  conta_banco_codigo: string | null
  conta_banco_nome: string | null
  conta_agencia: string | null
  conta_numero: string | null
  conta_tipo: RedeCorretorContaTipo | null
  conta_titular: string | null
  conta_pix_tipo: PixTipo | null
  conta_pix_chave: string | null
  status: RedeCorretorStatus
  observacoes: string | null
  link_simulador?: string | null
  email_enviado_em?: string | null
  criado_por?: string | null
  ultima_atualizacao_por?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type RedeCorretorPatch = Partial<{
  nome: string | null
  cpf_cnpj: string | null
  creci_numero: string | null
  creci_uf: string | null
  creci_tipo_registro: RedeCorretorTipoRegistro | null
  creci_validade: string | null
  email: string | null
  telefone: string | null
  atuacao_ufs: string[] | null
  atuacao_cidades: RedeCorretorCidadeAtuacao[] | null
  conta_banco_codigo: string | null
  conta_banco_nome: string | null
  conta_agencia: string | null
  conta_numero: string | null
  conta_tipo: RedeCorretorContaTipo | null
  conta_titular: string | null
  conta_pix_tipo: PixTipo | null
  conta_pix_chave: string | null
  status: RedeCorretorStatus
  observacoes: string | null
  n_corretor: string | null
}>

export const REDE_CORRETOR_STATUS_LABEL: Record<RedeCorretorStatus, string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  em_analise: 'Em análise',
  pendente: 'Pendente',
  aprovado: 'Aprovado',
}

export const REDE_CORRETOR_TIPO_REGISTRO_LABEL: Record<RedeCorretorTipoRegistro, string> = {
  estagiario: 'Estagiário',
  tecnico_transacoes: 'Técnico em Transações Imobiliárias',
  corretor_titular: 'Corretor Titular',
}

export const REDE_CORRETOR_PIX_TIPO_LABEL: Record<PixTipo, string> = {
  cpf_cnpj: 'CPF/CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Chave aleatória',
}

export function normalizarParaBuscaCorretor(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function redeCorretorRowMatchesBusca(row: RedeCorretorRow, busca: string): boolean {
  const q = normalizarParaBuscaCorretor(busca)
  if (!q) return true
  const parts = [
    row.n_corretor,
    row.nome,
    row.cpf_cnpj,
    row.creci_numero,
    row.creci_uf,
    row.email,
    row.telefone,
    row.conta_titular,
    row.status,
    REDE_CORRETOR_STATUS_LABEL[row.status],
    ...(row.atuacao_ufs ?? []),
    ...(row.atuacao_cidades ?? []).map((c) => `${c.nome} ${c.uf}`),
  ]
  return parts.some((p) => normalizarParaBuscaCorretor(String(p ?? '')).includes(q))
}

export function ordenarRedeCorretoresPorCodigo(rows: RedeCorretorRow[]): RedeCorretorRow[] {
  return [...rows].sort((a, b) => {
    const na = Number.parseInt(String(a.n_corretor ?? '').replace(/\D/g, ''), 10)
    const nb = Number.parseInt(String(b.n_corretor ?? '').replace(/\D/g, ''), 10)
    const aOk = Number.isFinite(na)
    const bOk = Number.isFinite(nb)
    if (!aOk && !bOk) return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR', { sensitivity: 'base' })
    if (!aOk) return 1
    if (!bOk) return -1
    return na - nb
  })
}

const SELECT_COLS =
  'id, n_corretor, ordem, nome, cpf_cnpj, creci_numero, creci_uf, creci_tipo_registro, creci_validade, email, telefone, atuacao_ufs, atuacao_cidades, conta_banco_codigo, conta_banco_nome, conta_agencia, conta_numero, conta_tipo, conta_titular, conta_pix_tipo, conta_pix_chave, status, observacoes, criado_por, ultima_atualizacao_por, created_at, updated_at'

export async function fetchRedeCorretoresRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<RedeCorretorRow[] | null> {
  const { data, error } = await supabase
    .from('rede_corretores')
    .select(SELECT_COLS)
    .order('ordem', { ascending: true })

  if (error) {
    console.error('[rede_corretores] fetch:', error.message)
    return null
  }
  return (data ?? []) as RedeCorretorRow[]
}
