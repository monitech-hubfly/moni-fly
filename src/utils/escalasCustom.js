/**
 * Escalas de indicador — persistidas na tabela `escalas_custom` do banco.
 * Um cache de módulo mantém `getEscalaCustom` síncrono (compatível com semaforoFaixas.js).
 * Chame `carregarEscalasCustom(supabase)` durante o data-loading do componente para
 * popular o cache antes do primeiro render que precise de `getEscalaCustom`.
 */

/** @typedef {{ id: string, nome: string, modo: 'lista'|'percentual'|'numero', valores?: string[], criadoEm?: string }} EscalaCustom */

/** @type {EscalaCustom[] | null} */
let _cache = null

/** Cache síncrono — populado por carregarEscalasCustom(). */
export function listarEscalasCustom() {
  return _cache || []
}

/**
 * Lookup síncrono (lê do cache).
 * @param {string} id
 * @returns {EscalaCustom | null}
 */
export function getEscalaCustom(id) {
  if (!id || !_cache) return null
  return _cache.find(e => e.id === id) || null
}

/**
 * Carrega escalas do banco e popula o cache. Deve ser chamado no data-loading do componente.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<EscalaCustom[]>}
 */
export async function carregarEscalasCustom(supabase) {
  try {
    const { data, error } = await supabase
      .from('escalas_custom')
      .select('id, nome, modo, valores, criado_em')
      .order('nome')
    if (error) {
      console.warn('[escalasCustom] erro ao carregar:', error.message)
      return _cache || []
    }
    _cache = (data || []).map(r => ({
      id: r.id,
      nome: r.nome,
      modo: r.modo,
      valores: Array.isArray(r.valores) ? r.valores : [],
      criadoEm: r.criado_em,
    }))
    return _cache
  } catch (e) {
    console.warn('[escalasCustom] erro inesperado:', e?.message || e)
    return _cache || []
  }
}

/**
 * Salva nova escala no banco e atualiza o cache.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ nome: string, modo: 'lista'|'percentual'|'numero', valores?: string[] }} def
 * @returns {Promise<{ ok: true, escala: EscalaCustom } | { ok: false, erro: string }>}
 */
export async function salvarNovaEscalaCustom(supabase, def) {
  const nome = (def.nome || '').trim()
  if (!nome) return { ok: false, erro: 'Informe o nome da escala.' }
  const modo = def.modo
  if (!['lista', 'percentual', 'numero'].includes(modo)) {
    return { ok: false, erro: 'Modo de escala inválido.' }
  }
  let valores = []
  if (modo === 'lista') {
    valores = (def.valores || [])
      .map(v => String(v ?? '').trim())
      .filter(Boolean)
    if (valores.length < 2) {
      return { ok: false, erro: 'Informe pelo menos dois valores distintos na lista.' }
    }
    const set = new Set(valores.map(v => v.toLowerCase()))
    if (set.size !== valores.length) {
      return { ok: false, erro: 'Há valores duplicados na lista (ignorando maiúsculas).' }
    }
  }

  const { data, error } = await supabase
    .from('escalas_custom')
    .insert({ nome, modo, valores: modo === 'lista' ? valores : null })
    .select('id, nome, modo, valores, criado_em')
    .single()

  if (error || !data) {
    return { ok: false, erro: error?.message || 'Erro ao salvar escala.' }
  }

  const escala = {
    id: data.id,
    nome: data.nome,
    modo: data.modo,
    valores: Array.isArray(data.valores) ? data.valores : [],
    criadoEm: data.criado_em,
  }

  if (_cache) _cache.push(escala)
  else _cache = [escala]

  return { ok: true, escala }
}

/** Dispara evento para outras partes da UI recarregarem a lista (mesma aba). */
export function notificarEscalasCustomAtualizadas() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('carometro-escalas-custom-changed'))
}
