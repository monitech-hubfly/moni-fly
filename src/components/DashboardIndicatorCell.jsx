/**
 * Célula de indicador semanal para dashboard.
 * Exibe círculo de status (verde/amarelo/vermelho) + percentual.
 * Tooltip elegante no hover com detalhes da semana.
 */
import { useState } from 'react'

/**
 * @param {Object} props
 * @param {number} props.semana - Número da semana (1-13)
 * @param {number} props.planejado - Quantidade planejada
 * @param {number} props.realizado - Quantidade realizada
 * @param {number} props.atrasado - Quantidade atrasada
 * @param {number|null} props.pctSemana - Percentual realizado na semana
 * @param {number|null} props.pctAcumulado - Percentual acumulado no trimestre
 * @param {'verde-escuro'|'verde-claro'|'amarelo'|'vermelho'|'vazio'} props.status - Status do farol (use getStatusFromPercent de statusUtils)
 * @param {boolean} [props.isCurrentWeek] - Se é a semana atual
 * @param {boolean} [props.embedded] - Se true, não aplica fundo (para uso dentro de td)
 * @param {string} [props.className] - Classes CSS adicionais
 * @param {string} [props.comportamentoNome] - Nome do indicador (para tooltip)
 * @param {string} [props.areaNome] - Nome da área (para tooltip)
 */
export default function DashboardIndicatorCell({
  semana,
  planejado,
  realizado,
  atrasado,
  pctSemana,
  pctAcumulado,
  status = 'vazio',
  isCurrentWeek = false,
  embedded = false,
  className = '',
  comportamentoNome = '',
  areaNome = ''
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  const semanaLabel = `S${String(semana).padStart(2, '0')}`

  const isPlanejada = planejado != null && planejado > 0
  const dotStatus = status
  const statusClass = embedded ? '' : (status === 'vazio' ? 'indicator-cell-vazio' : `indicator-cell-${status}`)

  return (
    <div
      className={`indicator-cell ${statusClass} ${isCurrentWeek && !embedded ? 'indicator-cell-atual' : ''} ${embedded ? 'indicator-cell-embedded' : ''} ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      role="cell"
    >
      <div className="indicator-cell-inner">
        <span
          className={`indicator-dot indicator-dot-${dotStatus}`}
          aria-hidden
        />
        <span className="indicator-pct">
          {isPlanejada && pctSemana != null ? `${pctSemana}%` : '—'}
        </span>
      </div>

      {showTooltip && (
        <div className="indicator-tooltip" role="tooltip">
          {(areaNome || comportamentoNome) && (
            <div className="indicator-tooltip-header">
              {areaNome && <span className="indicator-tooltip-area">{areaNome}</span>}
              {comportamentoNome && <span className="indicator-tooltip-comportamento">{comportamentoNome}</span>}
            </div>
          )}
          <div className="indicator-tooltip-row">
            <span className="indicator-tooltip-label">Semana:</span>
            <span className="indicator-tooltip-value">{semanaLabel}</span>
          </div>
          <div className="indicator-tooltip-row">
            <span className="indicator-tooltip-label">Planejado:</span>
            <span className="indicator-tooltip-value">{planejado ?? '—'}</span>
          </div>
          <div className="indicator-tooltip-row">
            <span className="indicator-tooltip-label">Realizado:</span>
            <span className="indicator-tooltip-value">{realizado ?? '—'}</span>
          </div>
          <div className="indicator-tooltip-row">
            <span className="indicator-tooltip-label">Atrasado:</span>
            <span className="indicator-tooltip-value">{atrasado ?? '—'}</span>
          </div>
          <div className="indicator-tooltip-row">
            <span className="indicator-tooltip-label">% Semana:</span>
            <span className="indicator-tooltip-value">
              {pctSemana != null ? `${pctSemana}%` : '—'}
            </span>
          </div>
          <div className="indicator-tooltip-row">
            <span className="indicator-tooltip-label">% Acumulado Trimestre:</span>
            <span className="indicator-tooltip-value">
              {pctAcumulado != null ? `${pctAcumulado}%` : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
