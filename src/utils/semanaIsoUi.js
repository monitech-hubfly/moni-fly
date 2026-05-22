import { endOfISOWeek, format, getISOWeeksInYear, setISOWeek, setISOWeekYear, startOfISOWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/** Segunda-feira = início da semana ISO (mesmo critério do CalendarioComSemanas). */
const WEEK_OPTS = { weekStartsOn: 1 }

export function dataReferenciaSemanaIso(ano, semanaNum) {
  const y = Number(ano)
  const w = Number(semanaNum)
  if (!Number.isFinite(y) || !Number.isFinite(w) || w < 1 || w > 53) return null
  return setISOWeek(setISOWeekYear(new Date(), y), w, WEEK_OPTS)
}

export function numeroSemanasIsoNoAno(ano) {
  const y = Number(ano)
  if (!Number.isFinite(y)) return 52
  return getISOWeeksInYear(new Date(y, 6, 1))
}

/** Ex.: "S22 — 25 a 31 de maio" */
export function labelSemanaIsoOpcao(ano, semanaNum) {
  const ref = dataReferenciaSemanaIso(ano, semanaNum)
  if (!ref) return `S${semanaNum}`
  const start = startOfISOWeek(ref, WEEK_OPTS)
  const end = endOfISOWeek(ref, WEEK_OPTS)
  const ini = format(start, 'd', { locale: ptBR })
  const fim =
    start.getMonth() === end.getMonth()
      ? format(end, 'd', { locale: ptBR })
      : format(end, "d 'de' MMMM", { locale: ptBR })
  const mes = format(start, 'MMMM', { locale: ptBR })
  const fimTxt =
    start.getMonth() === end.getMonth() ? `${ini} a ${fim} de ${mes}` : `${ini} a ${fim}`
  return `S${semanaNum} — ${fimTxt}`
}

export function mesIndiceDaSemanaIso(ano, semanaNum) {
  const ref = dataReferenciaSemanaIso(ano, semanaNum)
  return ref ? ref.getMonth() : new Date().getMonth()
}
