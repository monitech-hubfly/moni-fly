import React, { useCallback, useEffect, useState } from 'react'
import { semanasIsoAnoCalendario } from '../utils/periodos'
import { WL_H_CAP_SEMANA } from '../utils/workloadPlanejamentoData'

/**
 * Quadrinhos de semanas ISO do ano — range por dois cliques (início e fim inclusivos).
 */
export default function IsoWeekRangePicker({ ano, weekStart, weekEnd, onRangeChange }) {
  const semanasDoAno = React.useMemo(() => semanasIsoAnoCalendario(Number(ano) || new Date().getFullYear()), [ano])
  const [primeiroClique, setPrimeiroClique] = useState(null)

  useEffect(() => {
    setPrimeiroClique(null)
  }, [ano])

  const onCellClick = useCallback(
    sn => {
      const w = Number(sn)
      if (!Number.isFinite(w)) return
      if (primeiroClique == null) {
        setPrimeiroClique(w)
        onRangeChange(w, w)
        return
      }
      const a = Math.min(primeiroClique, w)
      const b = Math.max(primeiroClique, w)
      onRangeChange(a, b)
      setPrimeiroClique(null)
    },
    [primeiroClique, onRangeChange]
  )

  const a = Math.min(Number(weekStart), Number(weekEnd))
  const b = Math.max(Number(weekStart), Number(weekEnd))
  const nSem = semanasDoAno.filter(w => w >= a && w <= b).length
  const horasDisp = nSem * WL_H_CAP_SEMANA

  return (
    <div className="wl-iso-picker">
      <div className="wl-iso-picker-grid" role="group" aria-label="Seleção de semanas ISO por intervalo">
        {semanasDoAno.map(w => {
          const sel = w >= a && w <= b
          const anchor = primeiroClique === w
          return (
            <button
              key={w}
              type="button"
              className={`wl-iso-cell${sel ? ' wl-iso-cell--selected' : ''}${anchor ? ' wl-iso-cell--anchor' : ''}`}
              onClick={() => onCellClick(w)}
            >
              {w}
            </button>
          )
        })}
      </div>
      <p className="wl-iso-picker-summary">
        S{a} → S{b} · {nSem} {nSem === 1 ? 'semana' : 'semanas'} · {horasDisp} h disponíveis ({nSem} × {WL_H_CAP_SEMANA} h)
      </p>
    </div>
  )
}
