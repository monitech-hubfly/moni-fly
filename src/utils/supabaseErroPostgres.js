/**
 * Classifica erros do PostgREST/Postgres para mensagens corretas na UI (evita confundir schema com GRANT).
 * @returns {'permission'|'missing_table'|'schema_mismatch'|'other'}
 */
export function classificarErroSupabase(errorOrMessage) {
  const err = typeof errorOrMessage === 'string' ? { message: errorOrMessage } : errorOrMessage || {}
  const code = String(err.code ?? '').trim()
  const message = String(err.message ?? err.details ?? '').trim()
  const m = message.toLowerCase()

  if (
    code === '42501' ||
    m.includes('permission denied') ||
    m.includes('row-level security') ||
    m.includes('violates row-level security policy')
  ) {
    return 'permission'
  }

  if (
    m.includes('could not find') &&
    (m.includes('column') || m.includes('schema cache'))
  ) {
    return 'schema_mismatch'
  }

  if (
    (m.includes('does not exist') && (m.includes('relation') || m.includes('table'))) ||
    (m.includes('relation') && m.includes('not found') && !m.includes('column'))
  ) {
    return 'missing_table'
  }

  return 'other'
}

export function mensagemErroIndicadorConquistas(err, fallback = 'Erro ao registrar conquista do indicador.') {
  const kind = classificarErroSupabase(err)
  const raw = String(err?.message ?? err ?? '').trim()

  if (kind === 'missing_table') {
    return 'Tabela indicador_conquistas ausente. Execute no Supabase o arquivo supabase-indicador-conquistas.sql (ou a migration 187_indicador_conquistas_snapshot.sql) e recarregue a página.'
  }

  if (kind === 'schema_mismatch') {
    return `Estrutura da tabela indicador_conquistas incompatível com o app: ${raw || 'colunas ausentes no banco'}. Execute no Supabase a migration 187_indicador_conquistas_snapshot.sql e NOTIFY pgrst, 'reload schema';`
  }

  if (kind === 'permission') {
    return raw || 'Sem permissão para gravar em indicador_conquistas (verifique GRANT e políticas RLS para o papel authenticated).'
  }

  return raw || fallback
}
