/**
 * Ordenação com `ordem` + `nome` (numerador no cadastro de áreas).
 * Ver `supabase-areas-ordem.sql` para criar a coluna no Supabase.
 */
export function ordenarListaAreas(query) {
  return query.order('ordem', { ascending: true }).order('nome', { ascending: true })
}

function erroPodeSerOrdemAusente(err) {
  const m = String(err?.message ?? '').toLowerCase()
  return (
    m.includes('ordem') ||
    m.includes('schema cache') ||
    m.includes('42703') ||
    (m.includes('column') && m.includes('does not exist')) ||
    m.includes('could not find')
  )
}

function selectSemColunaOrdem(selectFields) {
  const s = String(selectFields).trim()
  if (s === '*') return '*'
  return s
    .split(',')
    .map(x => x.trim())
    .filter(x => x && !/^ordem$/i.test(x))
    .join(', ')
}

/**
 * Lista áreas ordenadas por `ordem` e `nome`. Se a coluna `ordem` ainda não existir
 * no banco, faz fallback para ordenação só por `nome` (e remove `ordem` do select se necessário).
 */
export async function listarAreas(supabase, selectFields = 'id, nome') {
  try {
    let r = await ordenarListaAreas(supabase.from('areas').select(selectFields))
    if (!r.error) return r

    // Fallback amplo: se a ordenação por `ordem` falhar por qualquer motivo,
    // tenta ordenação simples por `nome` (mantém a tela acessível).
    r = await supabase.from('areas').select(selectFields).order('nome', { ascending: true })
    if (!r.error) return r
    if (!erroPodeSerOrdemAusente(r.error)) return r

    const reduzido = selectSemColunaOrdem(selectFields)
    if (reduzido && reduzido !== String(selectFields).trim()) {
      return supabase.from('areas').select(reduzido).order('nome', { ascending: true })
    }
    return r
  } catch (e) {
    return {
      data: [],
      error: { message: String(e?.message || e || 'Falha ao carregar áreas') }
    }
  }
}
