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

const PLANEJADO = '#F5C842'
const REALIZADO = '#4CAF7D'
const LINE_MIN = '#1B5E20'
const LINE_MEDIA = '#C49000'
const LINE_MAX = '#C62828'

export default function WorkloadPlanningBarChart({ labels, planejado, realizado }) {
  const n = labels.length
  const data = useMemo(() => {
    const fillLine = val => Array.from({ length: n }, () => val)
    return {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Planejado',
          data: planejado || [],
          backgroundColor: PLANEJADO,
          borderWidth: 0,
          borderRadius: 4,
          maxBarThickness: 28,
          order: 2
        },
        {
          type: 'bar',
          label: 'Realizado',
          data: realizado || [],
          backgroundColor: REALIZADO,
          borderWidth: 0,
          borderRadius: 4,
          maxBarThickness: 28,
          order: 2
        },
        {
          type: 'line',
          label: 'Mínimo esperado (32 h)',
          data: fillLine(32),
          borderColor: LINE_MIN,
          borderWidth: 1.5,
          borderDash: [5, 4],
          fill: false,
          pointRadius: 0,
          tension: 0,
          order: 1
        },
        {
          type: 'line',
          label: 'Média esperada (36 h)',
          data: fillLine(36),
          borderColor: LINE_MEDIA,
          borderWidth: 1.5,
          borderDash: [5, 4],
          fill: false,
          pointRadius: 0,
          tension: 0,
          order: 1
        },
        {
          type: 'line',
          label: 'Capacidade máxima (40 h)',
          data: fillLine(40),
          borderColor: LINE_MAX,
          borderWidth: 1.5,
          borderDash: [5, 4],
          fill: false,
          pointRadius: 0,
          tension: 0,
          order: 1
        }
      ]
    }
  }, [labels, planejado, realizado, n])

  const maxY = useMemo(() => {
    const flat = [...(planejado || []), ...(realizado || []), 32, 36, 40].filter(Number.isFinite)
    return Math.max(8, ...flat, 1) * 1.12
  }, [planejado, realizado])

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { boxWidth: 12, padding: 10, font: { size: 11 }, usePointStyle: false }
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
          title: {
            display: true,
            text: 'Horas',
            font: { size: 11, weight: '600' }
          },
          ticks: { font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.06)' },
          border: { display: false }
        }
      }
    }),
    [maxY]
  )

  if (!n) {
    return <p className="wl-muted" style={{ margin: '0.5rem 0' }}>Selecione semanas ISO para visualizar o gráfico.</p>
  }

  return (
    <div className="wl-chart-canvas-wrap wl-chart-canvas-wrap--fixed-h">
      <Chart type="bar" data={data} options={options} />
    </div>
  )
}
