import { createClient } from '@/lib/supabase/client'
import { isAdminRole } from '@/lib/authz'

function trimStr(v) {
  if (v == null) return ''
  const s = String(v).trim()
  return s
}

/**
 * Identificação para a coluna `usuario` (NOT NULL).
 * `is_admin` no log reflete `profiles.role` (papel admin no sistema).
 * O nome da área do próprio evento (`area`) evita insert inválido quando o storage está vazio.
 */
async function resolverUsuario(areaDoEvento) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) return user.email
    if (user?.user_metadata?.name) return user.user_metadata.name
  } catch {}
  const localUsuario = trimStr(typeof localStorage !== 'undefined' ? localStorage.getItem('carometro_usuario') : '')
  return localUsuario || trimStr(areaDoEvento) || 'Desconhecido'
}

/**
 * Registra evento na tabela `audit_log`. Nunca deve bloquear o fluxo principal.
 * Chamar apenas após insert/update/delete no Supabase sem erro.
 */
export async function registrarLog({
  modulo,
  area,
  entidade,
  entidade_id,
  operacao,
  campo,
  valor_anterior,
  valor_novo,
  descricao
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let isAdmin = false
  if (user?.id) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    isAdmin = isAdminRole(profile?.role)
  }

  const { error } = await supabase.from('audit_log').insert({
    usuario: user?.email ?? null,
    is_admin: isAdmin,
    modulo,
    area: area ?? null,
    entidade,
    entidade_id: entidade_id ? String(entidade_id) : null,
    operacao,
    campo: campo ?? null,
    valor_anterior: valor_anterior ?? null,
    valor_novo: valor_novo ?? null,
    descricao: descricao ?? null
  })

  if (error) {
    console.error('[AuditLog] ERRO ao registrar:', error)
  } else {
    console.log('[AuditLog] Registrado com sucesso')
  }
}
