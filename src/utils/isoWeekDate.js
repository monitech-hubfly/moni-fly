/**
 * Segunda-feira (UTC) da semana ISO `isoWeek` (1–53) no ano ISO `isoYear`.
 */
export function isoWeekToMondayUtc(isoYear, isoWeek) {
  const w = Number(isoWeek)
  const y = Number(isoYear)
  if (!Number.isFinite(w) || w < 1 || w > 53 || !Number.isFinite(y)) {
    return new Date(NaN)
  }
  const simple = new Date(Date.UTC(y, 0, 4))
  const dayNum = simple.getUTCDay() || 7
  const week1Mon = new Date(simple)
  week1Mon.setUTCDate(simple.getUTCDate() - dayNum + 1)
  const d = new Date(week1Mon)
  d.setUTCDate(week1Mon.getUTCDate() + (w - 1) * 7)
  return d
}
