import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const META_COR = '#3B6D11'
const IND_COR = '#185FA5'
const PRAZO_OK = '#1D9E75'
const PRAZO_FORA = '#E24B4A'

const optsBase = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  }
}

/**
 * Barras agrupadas por área: Metas vs Indicadores.
 */
export function ConquistasPorAreaChart({ labels, metasPorArea, indicadoresPorArea }) {
  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Metas',
          data: metasPorArea,
          backgroundColor: META_COR,
          borderRadius: 4,
          maxBarThickness: 22
        },
        {
          label: 'Indicadores',
          data: indicadoresPorArea,
          backgroundColor: IND_COR,
          borderRadius: 4,
          maxBarThickness: 22
        }
      ]
    }),
    [labels, metasPorArea, indicadoresPorArea]
  )

  const options = useMemo(
    () => ({
      ...optsBase,
      scales: {
        x: {
          stacked: false,
          grid: { display: false },
          ticks: { font: { size: 11 }, maxRotation: 45, minRotation: 0 }
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, precision: 0 },
          grid: { color: 'rgba(0,0,0,0.06)' }
        }
      }
    }),
    []
  )

  return (
    <div className="conquistas-chart-wrap">
      <div className="conquistas-chart-legend" aria-hidden>
        <span className="conquistas-chart-legend__item">
          <span className="conquistas-chart-legend__sw" style={{ background: META_COR }} />
          Metas
        </span>
        <span className="conquistas-chart-legend__item">
          <span className="conquistas-chart-legend__sw" style={{ background: IND_COR }} />
          Indicadores
        </span>
      </div>
      <div className="conquistas-chart-canvas" style={{ height: 260 }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  )
}

/**
 * Barras empilhadas por mês: no prazo vs fora (últimos 6 meses fixos no eixo).
 */
export function ConquistasHistoricoMensalChart({ labels, noPrazoPorMes, foraPrazoPorMes }) {
  const data = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'No prazo',
          data: noPrazoPorMes,
          backgroundColor: PRAZO_OK,
          borderRadius: 4,
          stack: 'h'
        },
        {
          label: 'Fora do prazo',
          data: foraPrazoPorMes,
          backgroundColor: PRAZO_FORA,
          borderRadius: 4,
          stack: 'h'
        }
      ]
    }),
    [labels, noPrazoPorMes, foraPrazoPorMes]
  )

  const options = useMemo(
    () => ({
      ...optsBase,
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { font: { size: 11 } }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { stepSize: 1, precision: 0 },
          grid: { color: 'rgba(0,0,0,0.06)' }
        }
      }
    }),
    []
  )

  return (
    <div className="conquistas-chart-wrap">
      <div className="conquistas-chart-legend" aria-hidden>
        <span className="conquistas-chart-legend__item">
          <span className="conquistas-chart-legend__sw" style={{ background: PRAZO_OK }} />
          No prazo
        </span>
        <span className="conquistas-chart-legend__item">
          <span className="conquistas-chart-legend__sw" style={{ background: PRAZO_FORA }} />
          Fora do prazo
        </span>
      </div>
      <div className="conquistas-chart-canvas" style={{ height: 260 }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  )
}
