/**
 * Cálculo de janela temporal, dias úteis e fatores de recorrência para a página Workload (/workload).
 * Regra fixa: 8 h por dia útil (seg–sex), 5 dias por semana calendário apenas como referência para fatores legados.
 */

export const HOURS_PER_DAY = 8
export const WORK_DAYS_PER_WEEK = 5

export const TIPOS_PERIODO_WORKLOAD = [
  { value: 'mes', label: 'Mês', max: 12 },
  { value: 'bimestre', label: 'Bimestre', max: 6 },
  { value: 'trimestre', label: 'Trimestre', max: 4 },
  { value: 'semestre', label: 'Semestre', max: 2 },
  { value: 'ano', label: 'Ano', max: 1 }
]

/** Presets da tela Workload da área (inclui Semana e Personalizado). */
export const PRESET_PERIODOS_WORKLOAD = [
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'bimestre', label: 'Bimestre' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'semestre', label: 'Semestre' },
  { value: 'ano', label: 'Ano' },
  { value: 'personalizado', label: 'Personalizado' }
]

function toYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Início e fim (YYYY-MM-DD) inclusivos para tipo + ano + número (1-based). */
export function boundsPeriodoWorkload(tipo, ano, numero) {
  const y = Number(ano)
  const n = Number(numero)
  if (!Number.isFinite(y)) return { inicio: null, fim: null }
  switch (tipo) {
    case 'mes': {
      if (!Number.isFinite(n) || n < 1 || n > 12) return { inicio: null, fim: null }
      const start = new Date(y, n - 1, 1)
      const end = new Date(y, n, 0)
      return { inicio: toYMD(start), fim: toYMD(end) }
    }
    case 'bimestre': {
      if (!Number.isFinite(n) || n < 1 || n > 6) return { inicio: null, fim: null }
      const m0 = (n - 1) * 2
      const start = new Date(y, m0, 1)
      const end = new Date(y, m0 + 2, 0)
      return { inicio: toYMD(start), fim: toYMD(end) }
    }
    case 'trimestre': {
      if (!Number.isFinite(n) || n < 1 || n > 4) return { inicio: null, fim: null }
      const m0 = (n - 1) * 3
      const start = new Date(y, m0, 1)
      const end = new Date(y, m0 + 3, 0)
      return { inicio: toYMD(start), fim: toYMD(end) }
    }
    case 'semestre': {
      if (!Number.isFinite(n) || n < 1 || n > 2) return { inicio: null, fim: null }
      const m0 = (n - 1) * 6
      const start = new Date(y, m0, 1)
      const end = new Date(y, m0 + 6, 0)
      return { inicio: toYMD(start), fim: toYMD(end) }
    }
    case 'ano':
      return { inicio: `${y}-01-01`, fim: `${y}-12-31` }
    default:
      return { inicio: null, fim: null }
  }
}

export function toYMDDate(d) {
  return toYMD(d)
}

/** Segunda-feira (00:00 local) da semana que contém `d`. */
export function mondayDaSemanaContendo(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return x
}

/** Segunda-feira da semana ISO `isoWeek` do ano `isoYear`. */
export function segundaIsoSemana(isoYear, isoWeek) {
  const jan4 = new Date(isoYear, 0, 4, 12, 0, 0)
  const w1Mon = mondayDaSemanaContendo(jan4)
  const mon = new Date(w1Mon)
  mon.setDate(w1Mon.getDate() + (isoWeek - 1) * 7)
  return mon
}

/** ISO ano e número da semana ISO para uma data (rótulos tipo S16). */
export function isoSemanaRotulo(d) {
  const mon = mondayDaSemanaContendo(d)
  const anchor = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate(), 12, 0, 0)
  anchor.setDate(anchor.getDate() + 3 - ((anchor.getDay() + 6) % 7))
  const isoYear = anchor.getFullYear()
  const week1Mon = mondayDaSemanaContendo(new Date(isoYear, 0, 4))
  const isoWeek = Math.floor((mon.getTime() - week1Mon.getTime()) / 604800000) + 1
  return { isoYear, isoWeek, monday: mon }
}

export function formatIsoWeekKey(d) {
  const { isoYear, isoWeek } = isoSemanaRotulo(d)
  return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`
}

export function parseIsoWeekKey(key) {
  const m = String(key || '').match(/^(\d{4})-W(\d{1,2})$/)
  if (!m) return null
  return { isoYear: Number(m[1]), isoWeek: Number(m[2]) }
}

/**
 * Semanas (segunda a sexta no intervalo) com pelo menos um dia útil em [inicio,fim].
 * Cada item: mondayStr, label tipo S16, isoYear, isoWeek.
 */
export function enumerarSemanasIntervalo(inicioStr, fimStr) {
  if (!inicioStr || !fimStr) return []
  const ini = new Date(`${inicioStr}T12:00:00`)
  const fim = new Date(`${fimStr}T12:00:00`)
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime()) || ini > fim) return []
  const seen = new Set()
  const out = []
  const cur = new Date(ini)
  while (cur <= fim) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) {
      const mon = mondayDaSemanaContendo(cur)
      const key = toYMD(mon)
      if (!seen.has(key)) {
        seen.add(key)
        const { isoYear, isoWeek } = isoSemanaRotulo(cur)
        out.push({
          mondayStr: key,
          label: `S${isoWeek}`,
          isoYear,
          isoWeek
        })
      }
    }
    cur.setDate(cur.getDate() + 1)
  }
  return out.sort((a, b) => a.mondayStr.localeCompare(b.mondayStr))
}

/** Chave padrão de Seleção para o preset (referência: período atual). */
export function defaultChaveSelecaoWorkload(tipo, ref = new Date()) {
  const y = ref.getFullYear()
  const mo = ref.getMonth() + 1
  switch (tipo) {
    case 'semana':
      return formatIsoWeekKey(ref)
    case 'mes':
      return `${y}-${String(mo).padStart(2, '0')}`
    case 'bimestre':
      return `${y}-B${Math.floor((mo - 1) / 2) + 1}`
    case 'trimestre':
      return `${y}-Q${Math.floor((mo - 1) / 3) + 1}`
    case 'semestre':
      return `${y}-S${mo <= 6 ? 1 : 2}`
    case 'ano':
      return `${y}`
    default:
      return ''
  }
}

/**
 * Limites [inicio,fim] YYYY-MM-DD para preset + chave (ex.: 2026-04, 2026-W15).
 * Semana: segunda a sexta da semana ISO. Personalizado: retorna null (datas livres).
 */
export function boundsParaWorkloadPreset(tipo, chave, _ref = new Date()) {
  if (tipo === 'personalizado') return null
  if (tipo === 'semana') {
    const p = parseIsoWeekKey(chave) || parseIsoWeekKey(formatIsoWeekKey(_ref))
    if (!p) return null
    const mon = segundaIsoSemana(p.isoYear, p.isoWeek)
    const fri = new Date(mon)
    fri.setDate(mon.getDate() + 4)
    return { inicio: toYMD(mon), fim: toYMD(fri) }
  }
  if (tipo === 'mes') {
    const m = String(chave || '').match(/^(\d{4})-(\d{2})$/)
    if (!m) return null
    const yy = Number(m[1])
    const mm = Number(m[2])
    const start = new Date(yy, mm - 1, 1)
    const end = new Date(yy, mm, 0)
    return { inicio: toYMD(start), fim: toYMD(end) }
  }
  if (tipo === 'bimestre') {
    const m = String(chave || '').match(/^(\d{4})-B(\d)$/)
    if (!m) return null
    const yy = Number(m[1])
    const b = Number(m[2])
    if (b < 1 || b > 6) return null
    const m0 = (b - 1) * 2
    const start = new Date(yy, m0, 1)
    const end = new Date(yy, m0 + 2, 0)
    return { inicio: toYMD(start), fim: toYMD(end) }
  }
  if (tipo === 'trimestre') {
    const m = String(chave || '').match(/^(\d{4})-Q(\d)$/)
    if (!m) return null
    const yy = Number(m[1])
    const q = Number(m[2])
    if (q < 1 || q > 4) return null
    const m0 = (q - 1) * 3
    const start = new Date(yy, m0, 1)
    const end = new Date(yy, m0 + 3, 0)
    return { inicio: toYMD(start), fim: toYMD(end) }
  }
  if (tipo === 'semestre') {
    const m = String(chave || '').match(/^(\d{4})-S(\d)$/)
    if (!m) return null
    const yy = Number(m[1])
    const s = Number(m[2])
    if (s < 1 || s > 2) return null
    const m0 = (s - 1) * 6
    const start = new Date(yy, m0, 1)
    const end = new Date(yy, m0 + 6, 0)
    return { inicio: toYMD(start), fim: toYMD(end) }
  }
  if (tipo === 'ano') {
    const yy = Number(String(chave || '').match(/^(\d{4})$/)?.[1])
    if (!Number.isFinite(yy)) return null
    return { inicio: `${yy}-01-01`, fim: `${yy}-12-31` }
  }
  return null
}

/** Dias de segunda a sexta inclusivos entre duas datas (YYYY-MM-DD). */
export function diasUteisNoIntervalo(inicioStr, fimStr) {
  if (!inicioStr || !fimStr) return 0
  const ini = new Date(`${inicioStr}T12:00:00`)
  const fim = new Date(`${fimStr}T12:00:00`)
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime()) || ini > fim) return 0
  let n = 0
  const cur = new Date(ini)
  while (cur <= fim) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) n++
    cur.setDate(cur.getDate() + 1)
  }
  return n
}

function diasCalendarioInclusivos(inicioStr, fimStr) {
  if (!inicioStr || !fimStr) return 0
  const a = new Date(`${inicioStr}T12:00:00`)
  const b = new Date(`${fimStr}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) return 0
  return Math.floor((b - a) / 86400000) + 1
}

/** Meses civil (1..N) tocados pelo intervalo, mínimo 1. */
export function mesesSpanInclusivos(inicioStr, fimStr) {
  if (!inicioStr || !fimStr) return 1
  const a = new Date(`${inicioStr}T12:00:00`)
  const b = new Date(`${fimStr}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a > b) return 1
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1)
}

/**
 * Métricas derivadas do intervalo para fatores de recorrência.
 */
export function metricasIntervalo(inicioStr, fimStr) {
  const diasUteis = diasUteisNoIntervalo(inicioStr, fimStr)
  const diasCalendario = diasCalendarioInclusivos(inicioStr, fimStr)
  const semanasLista = enumerarSemanasIntervalo(inicioStr, fimStr)
  const semanasPeriodo = Math.max(1, semanasLista.length)
  const semanasAprox = Math.max(1, Math.ceil(diasCalendario / 7))
  const mesesSpan = mesesSpanInclusivos(inicioStr, fimStr)
  const horasPorRecursoNoPeriodo = diasUteis * HOURS_PER_DAY
  return {
    diasUteis,
    diasCalendario,
    semanasAprox,
    semanasPeriodo,
    semanasLista,
    mesesSpan,
    horasPorRecursoNoPeriodo
  }
}

/**
 * Fator de repetições no intervalo [inicio,fim] conforme tipo de recorrência.
 */
export function calcularFatorRecorrencia(recorrencia, metricas) {
  const { diasUteis, semanasAprox, semanasPeriodo, mesesSpan } = metricas
  const d = Math.max(0, diasUteis)
  const w = Math.max(1, semanasAprox)
  const sp = Math.max(1, semanasPeriodo ?? w)
  const m = Math.max(1, mesesSpan)
  switch (recorrencia) {
    case 'diaria':
      return Math.max(1, d)
    case 'semanal':
      return sp
    case 'quinzenal':
      return Math.max(1, Math.floor(sp / 2))
    case 'mensal':
      return m
    case 'bimestral':
      return Math.max(1, Math.ceil(m / 2))
    case 'trimestral':
      return Math.max(1, Math.ceil(m / 3))
    case 'semestral':
      return Math.max(1, Math.ceil(m / 6))
    case 'anual':
      return Math.max(1, Math.ceil(m / 12))
    case 'unica':
    default:
      return 1
  }
}

export function labelTipoPeriodoWorkload(tipo, ano, numero) {
  const y = Number(ano)
  const n = Number(numero)
  if (!Number.isFinite(y)) return '—'
  switch (tipo) {
    case 'mes':
      if (!Number.isFinite(n) || n < 1 || n > 12) return '—'
      return `${String(n).padStart(2, '0')}/${y}`
    case 'bimestre':
      if (!Number.isFinite(n) || n < 1 || n > 6) return '—'
      return `Bimestre ${n}/${y}`
    case 'trimestre':
      if (!Number.isFinite(n) || n < 1 || n > 4) return '—'
      return `Q${n} ${y}`
    case 'semestre':
      if (!Number.isFinite(n) || n < 1 || n > 2) return '—'
      return `S${n} ${y}`
    case 'ano':
      return `Ano ${y}`
    default:
      return '—'
  }
}

export function labelPeriodoLongo(tipo, ano, numero) {
  if (tipo === 'ano') {
    const y = Number(ano)
    return Number.isFinite(y) ? `Ano ${y}` : 'Ano'
  }
  const t = TIPOS_PERIODO_WORKLOAD.find(x => x.value === tipo)
  const base = t?.label || 'Período'
  const rest = labelTipoPeriodoWorkload(tipo, ano, numero)
  if (rest === '—') return base
  return `${base} ${rest}`
}
