import React, { useMemo, useCallback } from 'react'
import { semanasIsoAnoCalendario } from '../utils/periodos'
import { WL_H_CAP_SEMANA, semanasOrdenadasUnicas } from '../utils/workloadPlanejamentoData'

/**
 * Grade de semanas ISO do ano: toggle individual, destaque semanas com Gantt, legenda e resumo de capacidade.
 * @param {number} ano
 * @param {number[]} semanasComGantt — semanas que possuem dados em gantt_planejamento (área/período)
 * @param {number[]} selecionadas
 * @param {(semanas: number[]) => void} onChange
 * @param {boolean} [readOnly]
 * @param {string} [className] — classes extras no wrapper (ex.: pareamento de altura entre painéis)
 */
export default function WeekSelector({
  ano,
  semanasComGantt = [],
  selecionadas = [],
  onChange,
  readOnly = false,
  className
}) {
  const semanasDoAno = useMemo(() => semanasIsoAnoCalendario(Number(ano) || new Date().getFullYear()), [ano])
  const ganttSet = useMemo(
    () => new Set((semanasComGantt || []).map(Number).filter(n => Number.isFinite(n) && n >= 1 && n <= 53)),
    [semanasComGantt]
  )
  const selSet = useMemo(() => new Set(semanasOrdenadasUnicas(selecionadas)), [selecionadas])

  const toggle = useCallback(
    w => {
      if (readOnly) return
      const next = new Set(selSet)
      if (next.has(w)) next.delete(w)
      else next.add(w)
      onChange(semanasOrdenadasUnicas([...next]))
    },
    [readOnly, selSet, onChange]
  )

  const selecionarTodas = useCallback(() => {
    if (readOnly) return
    onChange([...semanasDoAno])
  }, [readOnly, semanasDoAno, onChange])

  const limpar = useCallback(() => {
    if (readOnly) return
    onChange([])
  }, [readOnly, onChange])

  const ordenadas = semanasOrdenadasUnicas(selecionadas)
  const nSel = ordenadas.length
  const horasDisp = nSel * WL_H_CAP_SEMANA
  const resumoSemanas =
    nSel === 0
      ? 'Nenhuma selecionada'
      : ordenadas.map(w => `S${w}`).join(', ') + ` · ${nSel} ${nSel === 1 ? 'semana' : 'semanas'}`

  return (
    <div className={['wl-week-selector', className].filter(Boolean).join(' ')}>
      <div className="wl-week-selector-actions">
        <button type="button" className="btn btn-sm wl-week-selector-btn" onClick={selecionarTodas} disabled={readOnly}>
          Selecionar todas
        </button>
        <button type="button" className="btn btn-sm wl-week-selector-btn" onClick={limpar} disabled={readOnly}>
          Limpar seleção
        </button>
      </div>
      <div
        className="wl-week-selector-grid"
        role="group"
        aria-label={`Semanas ISO do ano ${ano}`}
        aria-readonly={readOnly || undefined}
      >
        {semanasDoAno.map(w => {
          const temGantt = ganttSet.has(w)
          const sel = selSet.has(w)
          let cellClass = 'wl-week-cell'
          if (temGantt && sel) cellClass += ' wl-week-cell--gantt-sel'
          else if (sel) cellClass += ' wl-week-cell--selected'
          else if (temGantt) cellClass += ' wl-week-cell--gantt'
          return (
            <button
              key={w}
              type="button"
              className={cellClass}
              onClick={() => toggle(w)}
              disabled={readOnly}
              aria-pressed={sel}
              aria-label={`Semana ${w}${temGantt ? ', com planejamento Gantt' : ''}${sel ? ', selecionada' : ''}`}
            >
              {w}
            </button>
          )
        })}
      </div>
      <div className="wl-week-selector-legend">
        <span className="wl-week-legend-item">
          <span className="wl-week-sq wl-week-sq--sel" aria-hidden />
          Selecionada
        </span>
        <span className="wl-week-legend-item">
          <span className="wl-week-sq wl-week-sq--gantt" aria-hidden />
          Com planejamento Gantt
        </span>
      </div>
      <p className="wl-week-selector-summary">
        {resumoSemanas} · {horasDisp} h disponíveis
        {nSel > 0 ? ` (${nSel} × ${WL_H_CAP_SEMANA} h)` : ''}
      </p>
    </div>
  )
}
