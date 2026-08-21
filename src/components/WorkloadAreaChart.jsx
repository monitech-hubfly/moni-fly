import React, { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const VERDE = '#3B6D11'
const AMARELO = '#c9a227'
const VERMELHO = '#b91c1c'
const AZUL_SIM = '#85B7EB'
const LINHA_VM = '#b91c1c'
const LINHA_AM = '#d4a20c'
const TICK_COLOR = '#5c5c5c'
const GRID_COLOR = 'rgba(0, 0, 0, 0.06)'

function corBarraPlanejada(pct) {
  if (pct >= 100) return VERMELHO
  if (pct >= 80) return AMARELO
  return VERDE
}

function pluginLinhasReferencia(cap100, cap80) {
  return {
    id: 'workloadRefLines',
    afterDraw(chart) {
      const { ctx, chartArea, scales } = chart
      const yScale = scales.y
      if (!yScale || !chartArea) return
      const x0 = chartArea.left
      const x1 = chartArea.right
      const y100 = yScale.getPixelForValue(cap100)
      const y80 = yScale.getPixelForValue(cap80)
      if (Number.isFinite(y100) && y100 >= chartArea.top && y100 <= chartArea.bottom) {
        ctx.save()
        ctx.strokeStyle = LINHA_VM
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(x0, y100)
        ctx.lineTo(x1, y100)
        ctx.stroke()
        ctx.restore()
      }
      if (Number.isFinite(y80) && y80 >= chartArea.top && y80 <= chartArea.bottom) {
        ctx.save()
        ctx.strokeStyle = LINHA_AM
        ctx.lineWidth = 1
        ctx.setLineDash([5, 4])
        ctx.beginPath()
        ctx.moveTo(x0, y80)
        ctx.lineTo(x1, y80)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()
      }
    }
  }
}

export default function WorkloadAreaChart({
  labels,
  horasPlanejadas,
  horasSimulacao,
  capacidadePorSemana,
  capReferenciaLinha,
  recursos
}) {
  const cap100 = capReferenciaLinha ?? (40 * Math.max(1, recursos))
  const cap80 = cap100 * 0.8

  const data = useMemo(() => {
    const plannedColors = horasPlanejadas.map((h, i) => {
      const cap = capacidadePorSemana[i] || 1
      const pct = (h / cap) * 100
      return corBarraPlanejada(pct)
    })
    return {
      labels,
      datasets: [
        {
          label: 'Horas planejadas',
          data: horasPlanejadas,
          backgroundColor: plannedColors,
          borderWidth: 0,
          borderRadius: 4,
          maxBarThickness: 36
        },
        {
          label: 'Simulação',
          data: horasSimulacao,
          backgroundColor: AZUL_SIM,
          borderWidth: 0,
          borderRadius: 4,
          maxBarThickness: 36
        }
      ]
    }
  }, [labels, horasPlanejadas, horasSimulacao, capacidadePorSemana])

  const maxY = useMemo(() => {
    const vals = [
      ...horasPlanejadas,
      ...horasSimulacao,
      cap100
    ].filter(x => Number.isFinite(x))
    const m = Math.max(1, ...vals)
    return m * 1.15
  }, [horasPlanejadas, horasSimulacao, cap100])

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { top: 4, right: 4, bottom: 0, left: 0 }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          titleColor: '#2d2d2d',
          bodyColor: '#2d2d2d',
          borderColor: '#e0d9ce',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label(ctx) {
              const v = ctx.raw
              return `${ctx.dataset.label}: ${typeof v === 'number' ? v.toFixed(1) : v} h`
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: TICK_COLOR,
            font: { size: 11 }
          },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          suggestedMax: maxY,
          title: {
            display: true,
            text: 'Horas',
            color: TICK_COLOR,
            font: { size: 12, weight: '500' }
          },
          ticks: { color: TICK_COLOR },
          grid: { color: GRID_COLOR },
          border: { display: false }
        }
      }
    }),
    [maxY]
  )

  const plugins = useMemo(() => [pluginLinhasReferencia(cap100, cap80)], [cap100, cap80])

  return (
    <div className="wl-chart-wrap">
      <div className="wl-chart-legend" aria-hidden="true">
        <span className="wl-chart-legend-item">
          <span className="wl-chart-legend-sq" style={{ background: VERDE }} /> Horas planejadas
        </span>
        <span className="wl-chart-legend-item">
          <span className="wl-chart-legend-sq" style={{ background: AZUL_SIM }} /> Simulação (recursos ajustados)
        </span>
        <span className="wl-chart-legend-item">
          <span className="wl-chart-legend-line wl-chart-legend-line--red" /> Capacidade 100%
        </span>
        <span className="wl-chart-legend-item">
          <span className="wl-chart-legend-line wl-chart-legend-line--yellow" /> Alerta 80%
        </span>
      </div>
      <div className="wl-chart-canvas-wrap">
        <Bar data={data} options={options} plugins={plugins} />
      </div>
    </div>
  )
}
