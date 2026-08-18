'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { normalizeAccessRole } from '@/lib/authz'
import { nomeBancoPorCodigo } from '@/lib/bancos-br'
import {
  validarCpfCnpjOpcional,
  validarCreciOpcional,
  validarEmailOpcional,
  validarPixChaveOpcional,
  validarTelefoneCelularOpcional,
  type PixTipo,
} from '@/lib/br-docs'
import { formatCRValue, getNextCRFromRedeCorretores, parseCRValue } from '@/lib/next-cr-corretor'
import type {
  RedeCorretorPatch,
  RedeCorretorStatus,
  RedeCorretorTipoRegistro,
} from '@/lib/rede-corretores'

type Ok = { ok: true; mensagem: string; id?: string }
type Err = { ok: false; error: string }

async function requireRedeCorretoresStaff(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Faça login.' }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const access = normalizeAccessRole((profile as { role?: string } | null)?.role)
  if (access !== 'admin' && access !== 'team') {
    return { ok: false, error: 'Apenas administradores ou time podem gerir corretores.' }
  }
  return { ok: true, supabase, userId: user.id }
}

const STATUS_VALUES: RedeCorretorStatus[] = ['ativo', 'inativo', 'em_analise']
const TIPO_REGISTRO: RedeCorretorTipoRegistro[] = [
  'estagiario',
  'tecnico_transacoes',
  'corretor_titular',
]
const PIX_TIPOS: PixTipo[] = ['cpf_cnpj', 'email', 'telefone', 'aleatoria']

function validarCamposCorretor(patch: RedeCorretorPatch): string | null {
  const cpf = validarCpfCnpjOpcional(String(patch.cpf_cnpj ?? ''))
  if (!cpf.ok) return cpf.error
  const creci = validarCreciOpcional(String(patch.creci_numero ?? ''))
  if (!creci.ok) return creci.error
  const email = validarEmailOpcional(String(patch.email ?? ''))
  if (!email.ok) return email.error
  const tel = validarTelefoneCelularOpcional(String(patch.telefone ?? ''))
  if (!tel.ok) return tel.error
  const pixTipo = (patch.conta_pix_tipo ?? '') as PixTipo | ''
  if (pixTipo && !PIX_TIPOS.includes(pixTipo as PixTipo)) return 'Tipo de chave Pix inválido.'
  const pix = validarPixChaveOpcional(pixTipo, String(patch.conta_pix_chave ?? ''))
  if (!pix.ok) return pix.error
  if (patch.creci_tipo_registro && !TIPO_REGISTRO.includes(patch.creci_tipo_registro)) {
    return 'Tipo de registro CRECI inválido.'
  }
  if (patch.status && !STATUS_VALUES.includes(patch.status)) return 'Status inválido.'
  return null
}

function cleanPatch(patch: RedeCorretorPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const set = (k: string, v: string | null | undefined) => {
    if (v === undefined) return
    out[k] = v === '' ? null : v
  }

  set('nome', patch.nome)
  set('cpf_cnpj', patch.cpf_cnpj)
  set('creci_numero', patch.creci_numero)
  set('creci_uf', patch.creci_uf)
  if (patch.creci_tipo_registro !== undefined) out.creci_tipo_registro = patch.creci_tipo_registro
  set('creci_validade', patch.creci_validade)
  set('email', patch.email)
  set('telefone', patch.telefone)
  set('conta_banco_codigo', patch.conta_banco_codigo)
  if (patch.conta_banco_codigo !== undefined) {
    out.conta_banco_nome = nomeBancoPorCodigo(patch.conta_banco_codigo)
  }
  if (patch.conta_banco_nome !== undefined) set('conta_banco_nome', patch.conta_banco_nome)
  set('conta_agencia', patch.conta_agencia)
  set('conta_numero', patch.conta_numero)
  if (patch.conta_tipo !== undefined) out.conta_tipo = patch.conta_tipo
  set('conta_titular', patch.conta_titular)
  if (patch.conta_pix_tipo !== undefined) out.conta_pix_tipo = patch.conta_pix_tipo
  set('conta_pix_chave', patch.conta_pix_chave)
  if (patch.status !== undefined) out.status = patch.status
  set('observacoes', patch.observacoes)

  return out
}

export async function criarRedeCorretor(patch: RedeCorretorPatch): Promise<Ok | Err> {
  const gate = await requireRedeCorretoresStaff()
  if (!gate.ok) return gate
  const nome = String(patch.nome ?? '').trim()
  if (!nome) return { ok: false, error: 'Informe o nome completo ou razão social.' }

  const errVal = validarCamposCorretor(patch)
  if (errVal) return { ok: false, error: errVal }

  const row = cleanPatch({ ...patch, nome })
  if (!row.conta_titular) row.conta_titular = nome

  const informado = String(patch.n_corretor ?? '').trim()
  const parsedIn = parseCRValue(informado)
  const n_corretor = parsedIn
    ? formatCRValue(parsedIn.num, parsedIn.width)
    : await getNextCRFromRedeCorretores(gate.supabase as never)
  const ordem = parseCRValue(n_corretor)?.num ?? 0

  const { data, error } = await gate.supabase
    .from('rede_corretores')
    .insert({
      ...row,
      n_corretor,
      ordem,
      criado_por: gate.userId,
      updated_at: new Date().toISOString(),
    } as never)
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/rede-franqueados')
  return { ok: true, mensagem: 'Corretor cadastrado.', id: String(data?.id ?? '') }
}

export async function atualizarRedeCorretor(id: string, patch: RedeCorretorPatch): Promise<Ok | Err> {
  const gate = await requireRedeCorretoresStaff()
  if (!gate.ok) return gate
  if (!id) return { ok: false, error: 'ID inválido.' }

  if (patch.nome !== undefined && !String(patch.nome).trim()) {
    return { ok: false, error: 'Informe o nome completo ou razão social.' }
  }
  const errVal = validarCamposCorretor(patch)
  if (errVal) return { ok: false, error: errVal }

  const row = cleanPatch(patch)
  if (Object.keys(row).length === 0) return { ok: false, error: 'Nada para atualizar.' }

  row.updated_at = new Date().toISOString()
  row.ultima_atualizacao_por = gate.userId

  const { error } = await gate.supabase.from('rede_corretores').update(row as never).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/rede-franqueados')
  return { ok: true, mensagem: 'Corretor atualizado.' }
}

export async function arquivarRedeCorretor(id: string): Promise<Ok | Err> {
  return atualizarRedeCorretor(id, { status: 'inativo' })
}
