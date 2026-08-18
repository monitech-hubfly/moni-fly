import type { PixTipo } from '@/lib/br-docs'
import {
  maskCpfCnpj,
  maskPixChave,
  maskTelefoneCelular,
} from '@/lib/br-docs'
import type {
  RedeCorretorContaTipo,
  RedeCorretorPatch,
  RedeCorretorRow,
  RedeCorretorStatus,
  RedeCorretorTipoRegistro,
} from '@/lib/rede-corretores'

export type RedeCorretorFichaDraft = {
  nome: string
  cpf_cnpj: string
  creci_numero: string
  creci_uf: string
  creci_tipo_registro: RedeCorretorTipoRegistro | ''
  creci_validade: string
  email: string
  telefone: string
  conta_banco_codigo: string
  conta_agencia: string
  conta_numero: string
  conta_tipo: RedeCorretorContaTipo | ''
  conta_titular: string
  conta_pix_tipo: PixTipo | ''
  conta_pix_chave: string
  status: RedeCorretorStatus
  observacoes: string
}

export function emptyRedeCorretorFichaDraft(
  status: RedeCorretorStatus = 'em_analise',
): RedeCorretorFichaDraft {
  return {
    nome: '',
    cpf_cnpj: '',
    creci_numero: '',
    creci_uf: '',
    creci_tipo_registro: '',
    creci_validade: '',
    email: '',
    telefone: '',
    conta_banco_codigo: '',
    conta_agencia: '',
    conta_numero: '',
    conta_tipo: 'corrente',
    conta_titular: '',
    conta_pix_tipo: '',
    conta_pix_chave: '',
    status,
    observacoes: '',
  }
}

export function redeCorretorRowToFichaDraft(row: RedeCorretorRow): RedeCorretorFichaDraft {
  return {
    nome: row.nome ?? '',
    cpf_cnpj: row.cpf_cnpj ? maskCpfCnpj(row.cpf_cnpj) : '',
    creci_numero: row.creci_numero ?? '',
    creci_uf: row.creci_uf ?? '',
    creci_tipo_registro: row.creci_tipo_registro ?? '',
    creci_validade: row.creci_validade ? String(row.creci_validade).slice(0, 10) : '',
    email: row.email ?? '',
    telefone: row.telefone ? maskTelefoneCelular(row.telefone) : '',
    conta_banco_codigo: row.conta_banco_codigo ?? '',
    conta_agencia: row.conta_agencia ?? '',
    conta_numero: row.conta_numero ?? '',
    conta_tipo: row.conta_tipo ?? 'corrente',
    conta_titular: row.conta_titular ?? row.nome ?? '',
    conta_pix_tipo: row.conta_pix_tipo ?? '',
    conta_pix_chave:
      row.conta_pix_chave && row.conta_pix_tipo
        ? maskPixChave(row.conta_pix_tipo, row.conta_pix_chave)
        : (row.conta_pix_chave ?? ''),
    status: row.status ?? 'em_analise',
    observacoes: row.observacoes ?? '',
  }
}

export function redeCorretorFichaDraftToPatch(draft: RedeCorretorFichaDraft): RedeCorretorPatch {
  const emptyToNull = (s: string) => {
    const t = s.trim()
    return t === '' ? null : t
  }
  return {
    nome: emptyToNull(draft.nome),
    cpf_cnpj: emptyToNull(draft.cpf_cnpj),
    creci_numero: emptyToNull(draft.creci_numero),
    creci_uf: emptyToNull(draft.creci_uf),
    creci_tipo_registro: draft.creci_tipo_registro || null,
    creci_validade: emptyToNull(draft.creci_validade),
    email: emptyToNull(draft.email),
    telefone: emptyToNull(draft.telefone),
    conta_banco_codigo: emptyToNull(draft.conta_banco_codigo),
    conta_agencia: emptyToNull(draft.conta_agencia),
    conta_numero: emptyToNull(draft.conta_numero),
    conta_tipo: draft.conta_tipo || null,
    conta_titular: emptyToNull(draft.conta_titular),
    conta_pix_tipo: draft.conta_pix_tipo || null,
    conta_pix_chave: emptyToNull(draft.conta_pix_chave),
    status: draft.status,
    observacoes: emptyToNull(draft.observacoes),
  }
}
