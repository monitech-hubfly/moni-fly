export const TIPOS_PERIODO = [
  { value: 'semana', label: 'Semana', min: 1, max: 53 },
  { value: 'mes', label: 'Mês', min: 1, max: 12 },
  { value: 'bimestre', label: 'Bimestre', min: 1, max: 6 },
  { value: 'trimestre', label: 'Trimestre', min: 1, max: 4 },
  { value: 'semestre', label: 'Semestre', min: 1, max: 2 },
  { value: 'ano', label: 'Ano', min: null, max: null }
]

export function labelPeriodo(p) {
  if (!p) return '—'
  const num = p.numero != null ? Number(p.numero) : null
  const ano = p.ano
  switch (p.tipo) {
    case 'ano': return `Ano ${ano}`
    case 'semestre': return `Semestre ${num}/${ano}`
    case 'bimestre': return `Bimestre ${num}/${ano}`
    case 'trimestre': return `Trimestre ${num}/${ano}`
    case 'mes': return `Mês ${String(num).padStart(2, '0')}/${ano}`
    case 'semana': return `Semana ${String(num).padStart(2, '0')}/${ano}`
    default: return `${p.tipo} ${num ?? ''}/${ano}`
  }
}

// ISO week number (1..53)
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return weekNo
}

/** Ano da semana ISO (algoritmo alinhado a `isoWeek` — quinta da semana em UTC). */
export function isoWeekYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  return d.getUTCFullYear()
}

/**
 * Segunda-feira 00:00 UTC do início da semana ISO `weekNum` (1–53) no ano civil ISO `isoWeekYear`
 * (semana 1 = semana que contém 4 de janeiro — ISO 8601).
 */
/**
 * Posição relativa dentro do período gravado (1 = semana âncora em `data_inicio`) → número da semana ISO.
 * Igual ao Gantt.jsx — evita discrepâncias entre telas quando `semana` no banco é 1-based relativo ao período.
 */
export function posicaoRelativaParaSemanaIso(semanaRelativa, dataInicioPeriodo) {
  const rel = Number(semanaRelativa)
  if (!Number.isFinite(rel) || rel < 1) return null
  const raw = String(dataInicioPeriodo ?? '').trim().slice(0, 10)
  if (!raw) return null
  const d = new Date(`${raw}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + (rel - 1) * 7)
  const w = isoWeek(d)
  return Number.isFinite(w) ? w : null
}

export function segundaUtcIsoWeekStart(isoWeekYear, weekNum) {
  const y = Number(isoWeekYear)
  const w = Number(weekNum)
  if (!Number.isFinite(y) || !Number.isFinite(w) || w < 1 || w > 53) return null
  const jan4 = new Date(Date.UTC(y, 0, 4))
  const day = jan4.getUTCDay() || 7
  const mondayWeek1 = new Date(jan4)
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (day - 1))
  const mondayTarget = new Date(mondayWeek1)
  mondayTarget.setUTCDate(mondayWeek1.getUTCDate() + (w - 1) * 7)
  return mondayTarget
}

/**
 * Ano ISO da coluna `semana_iso` na grade do intervalo [data_inicio, data_fim] (primeiro dia do período nessa semana).
 */
export function anoIsoParaSemanaNoIntervalo(semanaIso, dataInicio, dataFim) {
  const sn = Number(semanaIso)
  if (!Number.isFinite(sn)) return new Date().getFullYear()
  if (!dataInicio || !dataFim) return new Date().getFullYear()
  const ini = new Date(dataInicio)
  const fim = new Date(dataFim)
  ini.setHours(0, 0, 0, 0)
  fim.setHours(0, 0, 0, 0)
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime()) || ini > fim) {
    return new Date().getFullYear()
  }
  const cur = new Date(ini)
  while (cur <= fim) {
    if (isoWeek(cur) === sn) return isoWeekYear(cur)
    cur.setDate(cur.getDate() + 1)
  }
  return new Date(`${dataInicio}T12:00:00`).getFullYear()
}

// Lista de semanas ISO (1..53) que existem entre as datas (inclusive)
export function semanasIsoNoIntervalo(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return []
  const ini = new Date(dataInicio)
  const fim = new Date(dataFim)
  ini.setHours(0, 0, 0, 0)
  fim.setHours(0, 0, 0, 0)
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) return []
  if (ini > fim) return []
  const set = new Set()
  const cur = new Date(ini)
  while (cur <= fim) {
    set.add(Number(isoWeek(cur)))
    cur.setDate(cur.getDate() + 1)
  }
  return Array.from(set).sort((a, b) => a - b)
}

/** Semanas ISO (1..53) que possuem pelo menos um dia no ano civil informado (1/jan a 31/dez). */
export function semanasIsoAnoCalendario(ano) {
  const y = Number(ano)
  if (!Number.isFinite(y)) return []
  return semanasIsoNoIntervalo(`${y}-01-01`, `${y}-12-31`)
}

/**
 * Normaliza `semanas_selecionadas` vinda do PostgREST (int[] ou texto "{1,2,3}").
 */
export function normalizarSemanasSelecionadasGantt(raw) {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw.map(Number).filter(n => Number.isFinite(n) && n >= 1 && n <= 53)
  }
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return Object.values(raw)
      .map(Number)
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 53)
  }
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (s === '' || s === '{}') return []
    const inner = s.replace(/^\{|\}$/g, '')
    if (!inner) return []
    return inner.split(',').map(x => Number(String(x).trim())).filter(n => Number.isFinite(n) && n >= 1 && n <= 53)
  }
  return []
}

/** Valor salvo na célula: 14, "14", "S14" → semana ISO. */
export function parseSemanaIsoTextoArmazenada(raw) {
  if (raw == null || raw === '') return null
  const s = String(raw).trim().replace(',', '.')
  if (/^s\d+$/i.test(s)) return Number(s.replace(/^s/i, ''))
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function semanaNaGridSet(w, gridSet) {
  const n = Number(w)
  if (!Number.isFinite(n)) return false
  if (gridSet.has(n)) return true
  for (const x of gridSet) {
    if (Number(x) === n) return true
  }
  return false
}

/**
 * Resolve semana_exibição na grade (uma coluna) a partir de uma linha de cronograma ou indicador.
 * Retorna null se não houver interseção com semanasGrid.
 */
export function cronogramaColunaIsoNaGrade(cronogramaRow, semanasGrid) {
  if (!cronogramaRow || !semanasGrid?.length) return null
  const gridSet = new Set(semanasGrid.map(x => Number(x)).filter(n => Number.isFinite(n)))
  const getSemanaISO = row => {
    if (row?.semana_ano != null && row.semana_ano !== '') {
      const n = Number(row.semana_ano)
      if (Number.isFinite(n)) return n
      const p = parseSemanaIsoTextoArmazenada(row.semana_ano)
      if (p != null) return Number(p)
    }
    if (row?.semana != null && row.semana !== '') {
      const n = Number(row.semana)
      if (Number.isFinite(n)) return n
      const p = parseSemanaIsoTextoArmazenada(row.semana)
      if (p != null) return Number(p)
    }
    return null
  }

  const w = getSemanaISO(cronogramaRow)
  if (w != null && semanaNaGridSet(w, gridSet)) return w
  return null
}

/**
 * Converte planejamento Gantt para semanas ISO que existem na grade do período.
 * @param {object} ganttRow - linha de gantt_planejamento
 * @param {number[]} semanasGrid - semanas ISO do período (`semanasIsoNoIntervalo`)
 *
 * Junta `semana_inicio`/`semana_fim` com `semanas_selecionadas`: não retornar cedo só com o intervalo —
 * senão linhas que ainda têm início/fim legado mas já usam `semanas_selecionadas` (ISO) somem da grade
 * (ex.: várias casas na mesma semana, só a primeira “batia” no expand).
 */
export function expandGanttSemanasParaGradeIso(ganttRow, semanasGrid) {
  const out = new Set()
  const semanasGridNorm = (semanasGrid || []).map(Number).filter(Number.isFinite)
  const gridSet = new Set(semanasGridNorm)

  /* Intervalo: assumimos semana_inicio/semana_fim como ISO (1–53). */
  if (ganttRow.semana_inicio != null && ganttRow.semana_fim != null) {
    const si = Number(ganttRow.semana_inicio)
    const sf = Number(ganttRow.semana_fim)
    if (Number.isFinite(si) && Number.isFinite(sf) && si <= sf) {
      for (let x = si; x <= sf; x++) {
        if (gridSet.has(x)) out.add(x)
      }
    }
  }

  const ss = normalizarSemanasSelecionadasGantt(ganttRow?.semanas_selecionadas)
  if (ss.length > 0) {
    ss.forEach(num => {
      if (!Number.isFinite(num)) return
      if (gridSet.has(num)) out.add(num)
    })
  }

  if (out.size > 0) return Array.from(out).sort((a, b) => a - b)
  return []
}

