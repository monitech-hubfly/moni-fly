import { supabase } from '../services/supabase'

function trimStr(v) {
  if (v == null) return ''
  const s = String(v).trim()
  return s
}

/**
 * Identificação para a coluna `usuario` (NOT NULL).
 * No app, só `carometro_admin` é gravado hoje; `carometro_usuario` / `carometro_area` são opcionais.
 * O nome da área do próprio evento (`area`) evita insert inválido quando o storage está vazio.
 */
function resolverUsuario(areaDoEvento) {
  return (
    trimStr(typeof localStorage !== 'undefined' ? localStorage.getItem('carometro_usuario') : '') ||
    trimStr(typeof localStorage !== 'undefined' ? localStorage.getItem('carometro_area') : '') ||
    trimStr(areaDoEvento) ||
    'Desconhecido'
  )
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
  const isAdmin =
    typeof localStorage !== 'undefined' && localStorage.getItem('carometro_admin') === 'true'
  const usuario = resolverUsuario(area)

  console.log('[AuditLog] Tentando registrar:', { usuario, isAdmin, modulo, operacao, entidade })

  const { error } = await supabase.from('audit_log').insert({
    usuario,
    is_admin: isAdmin,
    modulo,
    area: area || null,
    entidade,
    entidade_id: entidade_id ? String(entidade_id) : null,
    operacao,
    campo: campo || null,
    valor_anterior: valor_anterior !== undefined ? valor_anterior : null,
    valor_novo: valor_novo !== undefined ? valor_novo : null,
    descricao: descricao || null
  })

  if (error) {
    console.error('[AuditLog] ERRO ao registrar:', error)
  } else {
    console.log('[AuditLog] Registrado com sucesso')
  }
}
