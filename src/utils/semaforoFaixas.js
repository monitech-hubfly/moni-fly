/**
 * Normalização do JSON semaforo_faixas (array legado ou objeto { escala_tipo, faixas }).
 */

import { getEscalaCustom } from './escalasCustom'

export const ESCALA_OPCOES = [
  { id: 'percentual', label: 'Percentual (0–100%)', dbTipo: 'percentual' },
  { id: 'numero', label: 'Número', dbTipo: 'quantidade' },
  { id: 'sim_nao', label: 'SIM / NÃO', dbTipo: 'binario' },
  { id: 'status_3', label: 'OK / Andamento / Não OK', dbTipo: 'outro' }
]

export function dbTipoParaEscala(tipo) {
  switch (tipo) {
    case 'percentual':
      return 'percentual'
    case 'binario':
      return 'sim_nao'
    case 'outro':
      return 'status_3'
    case 'quantidade':
    default:
      return 'numero'
  }
}

/** @returns {{ escala_tipo: string, escala_custom_id: string|null, faixas: Array|null }} */
export function normalizarSemaforo(ind) {
  const raw = ind?.semaforo_faixas
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.faixas) && raw.faixas.length >= 4) {
    const customId = raw.escala_custom_id || null
    // Com `escala_custom_id`, o tipo efetivo é sempre "custom" (faixas + getEscalaCustom). Sem isso,
    // `tipo` na linha (quantidade/outro) fazia o Gantt inferir número e omitir <select> nas outras linhas.
    const escalaTipoEfetiva = customId
      ? 'custom'
      : (raw.escala_tipo || dbTipoParaEscala(ind?.tipo))
    return {
      escala_tipo: escalaTipoEfetiva,
      escala_custom_id: customId,
      faixas: raw.faixas
    }
  }
  if (Array.isArray(raw) && raw.length >= 4) {
    return { escala_tipo: dbTipoParaEscala(ind?.tipo), escala_custom_id: null, faixas: raw }
  }
  return { escala_tipo: dbTipoParaEscala(ind?.tipo), escala_custom_id: null, faixas: null }
}

const OP_LABEL = { lt: '<', lte: '<=', eq: '=', gt: '>', gte: '>=' }

export function opToLabel(op) {
  return OP_LABEL[op] || '>='
}

/** Rótulo curto para chips (Indicadores / Gantt). escalaTipo pode ser id built-in ou "custom:uuid". */
export function faixaTextoResumo(f, escalaTipo) {
  if (!f || f.limite === '' || f.limite == null) return '—'
  if (typeof escalaTipo === 'string' && escalaTipo.startsWith('custom:')) {
    return `${opToLabel(f.comparacao)} ${f.limite}`
  }
  if (escalaTipo === 'sim_nao' || escalaTipo === 'status_3') {
    return `${opToLabel(f.comparacao)} ${rotuloLimiteCategorico(f.limite)}`
  }
  return `${opToLabel(f.comparacao)} ${f.limite}`
}

function rotuloLimiteCategorico(lim) {
  const k = String(lim).toUpperCase()
  if (k === 'SIM') return 'SIM'
  if (k === 'NAO' || k === 'NÃO') return 'NÃO'
  if (k === 'OK') return 'OK'
  if (k === 'ANDAMENTO') return 'Andamento'
  if (k === 'NAO_OK') return 'Não OK'
  return String(lim)
}

function idxToFarol(i) {
  if (i === 0) return 've'
  if (i === 1) return 'vc'
  if (i === 2) return 'am'
  return 'vm'
}

function comparaNum(n, op, alvo) {
  if (n == null || alvo == null) return false
  const p = Number(n)
  const a = Number(alvo)
  if (Number.isNaN(p) || Number.isNaN(a)) return false
  switch (op) {
    case 'lte':
      return p <= a
    case 'eq':
      return p === a
    case 'gt':
      return p > a
    case 'lt':
      return p < a
    case 'gte':
    default:
      return p >= a
  }
}

/** Normaliza valor lançado para chave canônica (SIM, NAO, OK, ANDAMENTO, NAO_OK). */
export function normalizarEntradaCategorica(valor, escalaTipo) {
  const s = String(valor ?? '').trim().toUpperCase()
  if (!s) return ''
  if (escalaTipo === 'sim_nao') {
    if (['SIM', 'S', '1', 'TRUE', 'VERDADEIRO'].includes(s)) return 'SIM'
    if (['NAO', 'NÃO', 'N', '0', 'FALSE', 'FALSO'].includes(s)) return 'NAO'
    return s
  }
  if (escalaTipo === 'status_3') {
    if (s === 'OK' || (s.includes('OK') && !s.includes('NAO') && !s.includes('NÃO'))) return 'OK'
    if (s.includes('ANDAMENTO')) return 'ANDAMENTO'
    if (s.includes('NAO') || s.includes('NÃO')) return 'NAO_OK'
    return s
  }
  return s
}

function normalizarLimiteFaixa(lim, escalaTipo) {
  return normalizarEntradaCategorica(lim, escalaTipo)
}

function normalizarTextoIgualdade(s) {
  return String(s ?? '').trim().toLowerCase()
}

function regraDoIndicadorLegacy(ind) {
  const ve = ind?.regra_verde_escuro
  const vc = ind?.regra_verde_claro
  const am = ind?.regra_amarelo
  const hasAny = ve != null || vc != null || am != null
  return {
    verdeEscuro: hasAny ? (ve ?? 75) : 75,
    verdeClaro: hasAny ? (vc ?? 60) : 60,
    amarelo: hasAny ? (am ?? 30) : 30,
    verdeEscuroOp: ind?.regra_verde_escuro_op || 'gte',
    verdeClaroOp: ind?.regra_verde_claro_op || 'gte',
    amareloOp: ind?.regra_amarelo_op || 'gte'
  }
}

function statusSemaforoPorPctLegacy(pct, regra) {
  if (pct == null) return null
  const ve = regra?.verdeEscuro
  const vc = regra?.verdeClaro
  const am = regra?.amarelo
  const veOp = regra?.verdeEscuroOp || 'gte'
  const vcOp = regra?.verdeClaroOp || 'gte'
  const amOp = regra?.amareloOp || 'gte'
  if (ve != null && comparaNum(pct, veOp, ve)) return 've'
  if (vc != null && comparaNum(pct, vcOp, vc)) return 'vc'
  if (am != null && comparaNum(pct, amOp, am)) return 'am'
  return 'vm'
}

/**
 * Cor do semáforo para célula: ve | vc | am | vm | null
 * @param {object} ind — linha indicadores
 * @param {string|null} valor — valor lançado (texto)
 */
export function statusSemaforoPorValor(ind, valor) {
  if (valor == null || String(valor).trim() === '') return null
  const { escala_tipo, escala_custom_id, faixas } = normalizarSemaforo(ind)

  if (!faixas || faixas.length < 4) {
    /* Categóricos built-in sem JSON (ou select reduzido sem semaforo_faixas): não usar Number('OK'). */
    if (escala_tipo === 'status_3') {
      const vNorm = normalizarEntradaCategorica(valor, 'status_3')
      if (!vNorm) return null
      if (vNorm === 'OK') return 've'
      if (vNorm === 'ANDAMENTO') return 'am'
      if (vNorm === 'NAO_OK') return 'vm'
      return 'vm'
    }
    if (escala_tipo === 'sim_nao') {
      const vNorm = normalizarEntradaCategorica(valor, 'sim_nao')
      if (!vNorm) return null
      if (vNorm === 'SIM') return 've'
      if (vNorm === 'NAO') return 'vm'
      return 'vm'
    }
    const n = Number(String(valor).replace(',', '.'))
    if (!Number.isFinite(n)) return null
    return statusSemaforoPorPctLegacy(n, regraDoIndicadorLegacy(ind))
  }

  if (escala_tipo === 'custom' && escala_custom_id) {
    const def = getEscalaCustom(escala_custom_id)
    if (!def) {
      const n = Number(String(valor).replace(',', '.'))
      if (!Number.isFinite(n)) return null
      return statusSemaforoPorPctLegacy(n, regraDoIndicadorLegacy(ind))
    }
    if (def.modo === 'lista') {
      const vNorm = normalizarTextoIgualdade(valor)
      if (!vNorm) return null
      for (let i = 0; i < 4; i++) {
        const f = faixas[i]
        const lim = f?.limite
        if (lim === '' || lim == null) continue
        const lNorm = normalizarTextoIgualdade(lim)
        const op = f?.comparacao || 'eq'
        if (op === 'eq' && vNorm === lNorm) return idxToFarol(i)
      }
      return 'vm'
    }
    const n = Number(String(valor).replace(',', '.'))
    if (!Number.isFinite(n)) return null
    const escalaEfetiva = def.modo === 'percentual' ? 'percentual' : 'numero'
    for (let i = 0; i < 4; i++) {
      const f = faixas[i]
      const limite = f?.limite
      const op = f?.comparacao || 'gte'
      if (limite === '' || limite == null) continue
      const alvo = Number(limite)
      if (!Number.isFinite(alvo)) continue
      if (escalaEfetiva === 'percentual') {
        const clamped = Math.min(100, Math.max(0, n))
        if (comparaNum(clamped, op, alvo)) return idxToFarol(i)
      } else if (comparaNum(n, op, alvo)) return idxToFarol(i)
    }
    return 'vm'
  }

  if (escala_tipo === 'sim_nao' || escala_tipo === 'status_3') {
    const vNorm = normalizarEntradaCategorica(valor, escala_tipo)
    if (!vNorm) return null
    for (let i = 0; i < 4; i++) {
      const f = faixas[i]
      const lim = f?.limite
      if (lim === '' || lim == null) continue
      const lNorm = normalizarLimiteFaixa(lim, escala_tipo)
      const op = f?.comparacao || 'eq'
      if (op === 'eq' && vNorm === lNorm) return idxToFarol(i)
    }
    return 'vm'
  }

  const n = Number(String(valor).replace(',', '.'))
  if (!Number.isFinite(n)) return null

  for (let i = 0; i < 4; i++) {
    const f = faixas[i]
    const limite = f?.limite
    const op = f?.comparacao || 'gte'
    if (limite === '' || limite == null) continue
    const alvo = Number(limite)
    if (!Number.isFinite(alvo)) continue
    if (escala_tipo === 'percentual') {
      const clamped = Math.min(100, Math.max(0, n))
      if (comparaNum(clamped, op, alvo)) return idxToFarol(i)
    } else {
      if (comparaNum(n, op, alvo)) return idxToFarol(i)
    }
  }
  return 'vm'
}

export function unidadeColunaPorEscala(escalaId) {
  const o = ESCALA_OPCOES.find(x => x.id === escalaId)
  return o ? o.label : '—'
}

export function escalaTipoDoIndicador(ind) {
  const n = normalizarSemaforo(ind)
  if (n.escala_tipo === 'custom' && n.escala_custom_id) {
    return `custom:${n.escala_custom_id}`
  }
  return n.escala_tipo
}

/** Indica se o lançamento na planilha deve ser um &lt;select&gt; (valores discretos). */
export function indicadorLancamentoEhSelectDiscreto(ind) {
  const n = normalizarSemaforo(ind)
  if (n.escala_tipo === 'sim_nao' || n.escala_tipo === 'status_3') return true
  if (n.escala_tipo === 'custom' && n.escala_custom_id) {
    const def = getEscalaCustom(n.escala_custom_id)
    return def?.modo === 'lista'
  }
  return false
}

/**
 * Entrada livre no Gantt (não select) como número/percentual — inputMode decimal e pill um pouco mais larga.
 * Falso para texto/categoria ou escala custom sem definição.
 */
export function indicadorEntradaLancamentoNumerica(ind) {
  if (indicadorLancamentoEhSelectDiscreto(ind)) return false
  const n = normalizarSemaforo(ind)
  if (n.escala_tipo === 'percentual' || n.escala_tipo === 'numero') return true
  if (n.escala_tipo === 'custom' && n.escala_custom_id) {
    const def = getEscalaCustom(n.escala_custom_id)
    if (!def) return false
    return def.modo === 'percentual' || def.modo === 'numero'
  }
  if (!n.faixas || n.faixas.length < 4) return true
  return false
}

/**
 * inputMode para edição inline no Gantt (sem alterar o que `salvarLancamento` persiste — texto livre onde não for numérico).
 * Percentual: decimal (vírgula/ponto); quantidade / número inteiro: numeric.
 */
export function indicadorInputModeLancamento(ind) {
  if (!indicadorEntradaLancamentoNumerica(ind)) return 'text'
  const n = normalizarSemaforo(ind)
  const tipoDb = String(ind?.tipo ?? '').toLowerCase()
  if (tipoDb === 'percentual') return 'decimal'
  if (n.escala_tipo === 'percentual') return 'decimal'
  if (n.escala_tipo === 'custom' && n.escala_custom_id) {
    const def = getEscalaCustom(n.escala_custom_id)
    if (def?.modo === 'percentual') return 'decimal'
    if (def?.modo === 'numero') return 'numeric'
  }
  if (n.escala_tipo === 'percentual') return 'decimal'
  if (n.escala_tipo === 'numero') return 'numeric'
  if (tipoDb === 'quantidade') return 'numeric'
  return 'decimal'
}

/** Opções para &lt;select&gt; no Gantt (valor = texto salvo no lançamento). */
export function opcoesSelectLancamento(ind) {
  const n = normalizarSemaforo(ind)
  if (n.escala_tipo === 'sim_nao') {
    return [{ value: 'SIM', label: 'SIM' }, { value: 'NAO', label: 'NÃO' }]
  }
  if (n.escala_tipo === 'status_3') {
    return [
      { value: 'OK', label: 'OK' },
      { value: 'ANDAMENTO', label: 'Andamento' },
      { value: 'NAO_OK', label: 'Não OK' }
    ]
  }
  if (n.escala_tipo === 'custom' && n.escala_custom_id) {
    const def = getEscalaCustom(n.escala_custom_id)
    if (def?.modo === 'lista' && Array.isArray(def.valores)) {
      return def.valores.map(v => ({ value: v, label: v }))
    }
  }
  return []
}

/**
 * Opções do &lt;select&gt; no Gantt: ordem das faixas (limite) quando existir, depois o restante do catálogo.
 * Valores alinhados a statusSemaforoPorValor (SIM/NAO/OK/… ou itens da lista custom).
 */
export function opcoesLancamentoGanttOrdenadas(ind) {
  if (!indicadorLancamentoEhSelectDiscreto(ind)) return []
  const n = normalizarSemaforo(ind)
  const base = opcoesSelectLancamento(ind)
  if (base.length === 0) return []
  const labelByValue = new Map(base.map(o => [o.value, o.label]))
  const faixas = Array.isArray(n.faixas) ? n.faixas : []
  const ordered = []
  const seen = new Set()

  for (let i = 0; i < Math.min(faixas.length, 4); i++) {
    const lim = faixas[i]?.limite
    if (lim === '' || lim == null) continue

    if (n.escala_tipo === 'custom' && n.escala_custom_id) {
      const v = String(lim).trim()
      if (!v || seen.has(v)) continue
      seen.add(v)
      const label = base.find(o => String(o.value).toLowerCase() === v.toLowerCase())?.label ?? v
      ordered.push({ value: v, label })
      continue
    }

    if (n.escala_tipo === 'sim_nao' || n.escala_tipo === 'status_3') {
      const v = normalizarEntradaCategorica(lim, n.escala_tipo)
      if (!v || seen.has(v)) continue
      seen.add(v)
      ordered.push({ value: v, label: labelByValue.get(v) ?? v })
    }
  }

  for (const o of base) {
    if (!seen.has(o.value)) {
      seen.add(o.value)
      ordered.push(o)
    }
  }
  return ordered
}

/**
 * Valor gravado no lançamento → value canônico de &lt;option&gt;, ou '' se não houver opção compatível.
 */
export function valorParaSelectIndicador(ind, valorStored, opcoes) {
  if (!opcoes?.length) return ''
  if (valorStored == null || String(valorStored).trim() === '') return ''
  const n = normalizarSemaforo(ind)
  if (n.escala_tipo === 'sim_nao' || n.escala_tipo === 'status_3') {
    const c = normalizarEntradaCategorica(valorStored, n.escala_tipo)
    return opcoes.some(o => o.value === c) ? c : ''
  }
  const s = String(valorStored).trim()
  const hit = opcoes.find(o => String(o.value).toLowerCase() === s.toLowerCase())
  return hit ? hit.value : ''
}
