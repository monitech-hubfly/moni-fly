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

const TIPO_REGISTRO: RedeCorretorTipoRegistro[] = [
  'estagiario',
  'tecnico_transacoes',
  'corretor_titular',
]
const PIX_TIPOS: PixTipo[] = ['cpf_cnpj', 'email', 'telefone', 'aleatoria']
export const REDE_CORRETOR_STATUS_VALUES: RedeCorretorStatus[] = [
  'ativo',
  'inativo',
  'em_analise',
  'pendente',
  'aprovado',
]

export function validarCamposCorretor(patch: RedeCorretorPatch): string | null {
  const nome = String(patch.nome ?? '').trim()
  if (!nome) return 'Informe o nome completo ou razão social.'

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
  if (patch.status && !REDE_CORRETOR_STATUS_VALUES.includes(patch.status)) return 'Status inválido.'
  return null
}

export function cleanCorretorPatch(patch: RedeCorretorPatch): Record<string, unknown> {
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
  if (patch.atuacao_ufs !== undefined) {
    out.atuacao_ufs = Array.isArray(patch.atuacao_ufs)
      ? patch.atuacao_ufs.map((u) => String(u).trim().toUpperCase()).filter(Boolean)
      : []
  }
  if (patch.atuacao_cidades !== undefined) {
    out.atuacao_cidades = Array.isArray(patch.atuacao_cidades) ? patch.atuacao_cidades : []
  }
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

export async function insertRedeCorretorRow(opts: {
  supabase: { from: (t: string) => any }
  patch: RedeCorretorPatch
  status: RedeCorretorStatus
  userId?: string | null
}): Promise<{ ok: true; id: string; n_corretor: string } | { ok: false; error: string }> {
  const errVal = validarCamposCorretor(opts.patch)
  if (errVal) return { ok: false, error: errVal }

  const nome = String(opts.patch.nome ?? '').trim()
  const row = cleanCorretorPatch({ ...opts.patch, nome, status: opts.status })
  if (!row.conta_titular) row.conta_titular = nome

  const informado = String(opts.patch.n_corretor ?? '').trim()
  const parsedIn = parseCRValue(informado)
  const n_corretor = parsedIn
    ? formatCRValue(parsedIn.num, parsedIn.width)
    : await getNextCRFromRedeCorretores(opts.supabase as never)
  const ordem = parseCRValue(n_corretor)?.num ?? 0

  const { data, error } = await opts.supabase
    .from('rede_corretores')
    .insert({
      ...row,
      n_corretor,
      ordem,
      status: opts.status,
      criado_por: opts.userId ?? null,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: String(data?.id ?? ''), n_corretor }
}

export function buildCadastroCorretorPublicUrl(origin?: string): string {
  const base =
    (origin?.replace(/\/$/, '') ||
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/\/$/, '')}` : '') ||
      '') || ''
  const root = base.startsWith('http') ? base : base ? `https://${base}` : ''
  return root ? `${root}/cadastro/corretor` : '/cadastro/corretor'
}
