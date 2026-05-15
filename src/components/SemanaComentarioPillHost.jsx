import { useState } from 'react'

/**
 * Tooltip (padrão .indicator-tooltip) ao passar o mouse — filhos incluem a pill e o ··· dentro dela.
 * @param {string|null|undefined} props.tooltipText — textos já unidos (ex.: "a — b")
 */
export default function SemanaComentarioPillHost({ tooltipText, children }) {
  const [show, setShow] = useState(false)
  const tip = tooltipText != null ? String(tooltipText).trim() : ''
  if (!tip) return children

  return (
    <span
      className="gantt-comentario-pill-host"
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="indicator-tooltip gantt-comentario-indicator-tooltip" role="tooltip">
          <div className="indicator-tooltip-row" style={{ borderBottom: 'none', padding: 0 }}>
            <span className="indicator-tooltip-value" style={{ whiteSpace: 'normal', textAlign: 'left' }}>
              {tip}
            </span>
          </div>
        </div>
      )}
    </span>
  )
}
