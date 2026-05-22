'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import CalendarioComSemanas from '@/components/CalendarioComSemanas'
import { labelSemanaIsoOpcao, mesIndiceDaSemanaIso, numeroSemanasIsoNoAno } from '@/utils/semanaIsoUi'

/**
 * Prazo ISO compacto para indicador atingível: ano + semana em selects;
 * calendário mensal só no popover.
 */
export default function IndicadorPrazoAtingivelField({
  idPrefix = 'ind-modal-prazo',
  ano,
  semana,
  anos = [],
  onAnoChange,
  onSemanaChange,
  onSemanaSelecionada
}) {
  const [calendarioAberto, setCalendarioAberto] = useState(false)
  const popoverRef = useRef(null)
  const toggleRef = useRef(null)

  const anoNum = ano ? Number(ano) : new Date().getFullYear()
  const semanasNoAno = useMemo(() => numeroSemanasIsoNoAno(anoNum), [anoNum])

  const opcoesSemana = useMemo(() => {
    const list = []
    for (let w = 1; w <= semanasNoAno; w++) {
      list.push({ value: String(w), label: labelSemanaIsoOpcao(anoNum, w) })
    }
    return list
  }, [anoNum, semanasNoAno])

  const mesCalendario = useMemo(() => {
    if (semana) return mesIndiceDaSemanaIso(anoNum, Number(semana))
    return new Date().getMonth()
  }, [anoNum, semana])

  const resumoSelecionado = semana ? labelSemanaIsoOpcao(anoNum, Number(semana)) : null

  useEffect(() => {
    if (!calendarioAberto) return
    const onDoc = e => {
      const t = e.target
      if (popoverRef.current?.contains(t) || toggleRef.current?.contains(t)) return
      setCalendarioAberto(false)
    }
    const onKey = e => {
      if (e.key === 'Escape') setCalendarioAberto(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [calendarioAberto])

  function handleSemanaChange(next) {
    onSemanaChange?.(next)
    if (next) onSemanaSelecionada?.()
  }

  function handleCalendarioSelect(num) {
    if (num == null || !Number.isFinite(Number(num))) return
    const n = Math.trunc(Number(num))
    if (n < 1 || n > 53) return
    handleSemanaChange(String(n))
    setCalendarioAberto(false)
  }

  return (
    <div className="indicadores-prazo-atingivel">
      <div className="indicadores-prazo-atingivel-row">
        <div className="indicadores-prazo-atingivel-field">
          <label htmlFor={`${idPrefix}-ano`}>Ano</label>
          <select
            id={`${idPrefix}-ano`}
            value={ano}
            onChange={e => {
              onAnoChange?.(e.target.value)
              onSemanaChange?.('')
            }}
          >
            {(anos || []).map(a => (
              <option key={a} value={String(a)}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="indicadores-prazo-atingivel-field indicadores-prazo-atingivel-field--semana">
          <label htmlFor={`${idPrefix}-semana`}>Semana</label>
          <select
            id={`${idPrefix}-semana`}
            value={semana}
            onChange={e => handleSemanaChange(e.target.value)}
          >
            <option value="">Selecione a semana</option>
            {opcoesSemana.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {resumoSelecionado ? (
        <p className="indicadores-prazo-atingivel-resumo" role="status">
          <span className="indicadores-prazo-atingivel-badge">Prazo</span>
          {resumoSelecionado}
        </p>
      ) : (
        <p className="indicadores-prazo-atingivel-hint">Escolha o ano e a semana ISO de conclusão.</p>
      )}

      <div className="indicadores-prazo-atingivel-cal-wrap">
        <button
          ref={toggleRef}
          type="button"
          className="indicadores-prazo-atingivel-cal-btn"
          aria-expanded={calendarioAberto}
          aria-haspopup="dialog"
          onClick={() => setCalendarioAberto(v => !v)}
        >
          {calendarioAberto ? 'Ocultar calendário' : 'Abrir calendário'}
        </button>
        {calendarioAberto && (
          <div
            ref={popoverRef}
            className="indicadores-prazo-atingivel-popover"
            role="dialog"
            aria-label="Calendário para escolher semana"
          >
            <CalendarioComSemanas
              ano={anoNum}
              mesInicial={mesCalendario}
              selectedSemanaNum={semana ? Number(semana) : null}
              onSelectSemanaNumero={handleCalendarioSelect}
              className="indicadores-prazo-atingivel-calendario"
            />
          </div>
        )}
      </div>
    </div>
  )
}
