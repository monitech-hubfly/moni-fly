/**
 * Escalas de indicador definidas pelo admin (armazenamento local no navegador).
 * Permite adicionar tipos além dos pré-definidos sem migração de banco.
 * Indicadores que usam uma escala custom gravam escala_custom_id em semaforo_faixas (JSON).
 */

const STORAGE_KEY = 'carometro_escalas_indicador_v1'

function safeParse(json) {
  try {
    return JSON.parse(json)
  } catch {
    return []
  }
}

/** @typedef {{ id: string, nome: string, modo: 'lista'|'percentual'|'numero', valores?: string[], criadoEm?: string }} EscalaCustom */

/** @returns {EscalaCustom[]} */
export function listarEscalasCustom() {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(STORAGE_KEY)
  const arr = safeParse(raw || '[]')
  return Array.isArray(arr) ? arr.filter(x => x && x.id && x.nome && x.modo) : []
}

/** @param {string} id */
export function getEscalaCustom(id) {
  if (!id) return null
  return listarEscalasCustom().find(e => e.id === id) || null
}

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `ec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * @param {{ nome: string, modo: 'lista'|'percentual'|'numero', valores?: string[] }} def
 * @returns {{ ok: true, escala: EscalaCustom } | { ok: false, erro: string }}
 */
export function salvarNovaEscalaCustom(def) {
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

  const escala = {
    id: uid(),
    nome,
    modo,
    valores: modo === 'lista' ? valores : undefined,
    criadoEm: new Date().toISOString()
  }

  const lista = listarEscalasCustom()
  lista.push(escala)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  } catch (e) {
    return { ok: false, erro: 'Não foi possível salvar (armazenamento cheio ou bloqueado).' }
  }
  return { ok: true, escala }
}

/** Dispara evento para outras partes da UI recarregarem a lista (mesma aba). */
export function notificarEscalasCustomAtualizadas() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('carometro-escalas-custom-changed'))
}
