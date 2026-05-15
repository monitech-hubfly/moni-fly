import React, { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  LineController,
  BarController,
  Legend,
  Tooltip
} from 'chart.js'
import { Chart } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  LineController,
  BarController,
  Legend,
  Tooltip
)

const SELECIONADO = '#F5C842'
const AJUSTADO = '#5BA4E5'
const LINHA_CAP = '#C62828'
const LINHA_80 = '#C49000'

export default function WorkloadSimulacaoBarChart({ labels, dadosSelecionado, dadosAjustado, capTotalSemana }) {
  const n = labels.length
  const data = useMemo(() => {
    const capArr = Array.from({ length: n }, () => capTotalSemana)
    const alerta80 = Array.from({ length: n }, () => (Number(capTotalSemana) || 0) * 0.8)

    return {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Selecionado (planejado)',
          data: dadosSelecionado || [],
          backgroundColor: SELECIONADO,
          borderWidth: 0,
          borderRadius: 4,
          maxBarThickness: 28,
          order: 2
        },
        {
          type: 'bar',
          label: 'Simulação ajustada',
          data: dadosAjustado || [],
          backgroundColor: AJUSTADO,
          borderWidth: 0,
          borderRadius: 4,
          maxBarThickness: 28,
          order: 2
        },
        {
          type: 'line',
          label: `Capacidade (${Number(capTotalSemana) || 0} h/semana)`,
          data: capArr,
          borderColor: LINHA_CAP,
          borderWidth: 2,
          borderDash: [],
          fill: false,
          pointRadius: 0,
          tension: 0,
          order: 1
        },
        {
          type: 'line',
          label: 'Alerta 80%',
          data: alerta80,
          borderColor: LINHA_80,
          borderWidth: 1.5,
          borderDash: [5, 4],
          fill: false,
          pointRadius: 0,
          tension: 0,
          order: 1
        }
      ]
    }
  }, [labels, dadosSelecionado, dadosAjustado, capTotalSemana, n])

  const maxY = useMemo(() => {
    const flat = [...(dadosSelecionado || []), ...(dadosAjustado || []), capTotalSemana || 0].filter(Number.isFinite)
    return Math.max(10, ...flat, 1) * 1.15
  }, [dadosSelecionado, dadosAjustado, capTotalSemana])

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { boxWidth: 12, padding: 10, font: { size: 11 } }
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const v = ctx.raw
              return `${ctx.dataset.label}: ${typeof v === 'number' ? `${v.toFixed(1)} h` : v}`
            }
          }
        }
      },
      scales: {
        x: {
          stacked: false,
          grid: { display: false },
          ticks: { font: { size: 10 } },
          border: { display: false }
        },
        y: {
          stacked: false,
          beginAtZero: true,
          suggestedMax: maxY,
          title: { display: true, text: 'Horas', font: { size: 11, weight: '600' } },
          ticks: { font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.06)' },
          border: { display: false }
        }
      }
    }),
    [maxY]
  )

  if (!n) {
    return <p className="wl-muted" style={{ margin: '0.5rem 0' }}>Defina um intervalo de semanas para a simulação.</p>
  }

  return (
    <div className="wl-chart-canvas-wrap wl-chart-canvas-wrap--fixed-h">
      <Chart type="bar" data={data} options={options} />
    </div>
  )
}
