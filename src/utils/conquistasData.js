import { parseSemanaMetaTexto, semanaMetaNoPrazo } from './metaCiclo'
import { isoWeekToMondayUtc } from './isoWeekDate'

/** Intervalo [start, end] inclusive para filtros de período na tela Conquistas. */
export function intervaloPresetConquistas(preset) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const endDia = new Date(y, m + 1, 0, 23, 59, 59, 999)
  if (preset === 'ultimos_6_meses') {
    const start = new Date(y, m - 5, 1, 0, 0, 0, 0)
    return { start, end: endDia }
  }
  if (preset === 'ano_atual') {
    return { start: new Date(y, 0, 1, 0, 0, 0, 0), end: new Date(y, 11, 31, 23, 59, 59, 999) }
  }
  return null
}

export function dataEstimadaPrazoMeta(meta, anoRef) {
  const sn = parseSemanaMetaTexto(meta?.meta_unidade)
  if (sn == null) return null
  const year = Number.isFinite(anoRef) ? anoRef : new Date().getFullYear()
  try {
    return isoWeekToMondayUtc(year, sn)
  } catch {
    return null
  }
}

/** Data aproximada da conclusão da meta (só semana ISO em `concluido_em`). */
export function dataEstimadaConclusaoMeta(meta, anoRef) {
  const sn = parseSemanaMetaTexto(meta?.concluido_em)
  if (sn == null) return null
  const year = Number.isFinite(anoRef) ? anoRef : new Date().getFullYear()
  try {
    return isoWeekToMondayUtc(year, sn)
  } catch {
    return null
  }
}

export function metaDentroDoIntervalo(meta, intervalo) {
  if (!intervalo) return true
  const d = dataEstimadaConclusaoMeta(meta, new Date().getFullYear())
  if (!d) return true
  return d >= intervalo.start && d <= intervalo.end
}

export function indicadorConquistaDentroDoIntervalo(row, intervalo) {
  if (!intervalo) return true
  const d = row?.data_conclusao ? new Date(row.data_conclusao) : null
  if (!d || Number.isNaN(d.getTime())) return true
  return d >= intervalo.start && d <= intervalo.end
}

export function metaNoPrazo(meta) {
  if (String(meta?.tipo || '').toLowerCase() !== 'atingivel') return true
  return semanaMetaNoPrazo(meta?.meta_unidade, meta?.concluido_em) === true
}

export function deltaSemanasVsPrazo(prazoRaw, semanaConclusaoNum) {
  const pr = parseSemanaMetaTexto(prazoRaw)
  const sc = Number(semanaConclusaoNum)
  if (!Number.isFinite(pr) || !Number.isFinite(sc)) return null
  if (sc < pr) return { modo: 'antes', n: pr - sc }
  if (sc > pr) return { modo: 'depois', n: sc - pr }
  return { modo: 'no_dia', n: 0 }
}

export function formatarDataCurtaPt(d) {
  if (!d || Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
}
