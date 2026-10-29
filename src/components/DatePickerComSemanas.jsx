/**
 * DatePickerComSemanas — seletor de data com semanas ISO visíveis.
 *
 * Props:
 *  value: string — data atual no formato 'YYYY-MM-DD' (pode ser vazio)
 *  onChange: (date: string) => void — chamado ao selecionar um dia
 *  placeholder?: string — texto exibido quando não há data selecionada
 *  disabled?: boolean
 *  className?: string — classes extras para o botão trigger
 */

import { useEffect, useRef, useState } from 'react'
import CalendarioComSemanas from './CalendarioComSemanas'

/** Formata 'YYYY-MM-DD' como 'DD/MM · Snn'. Retorna '' se inválido. */
function formatarDataComSemana(iso) {
  if (!iso || iso.length < 10) return ''
  const d = new Date(iso + 'T12:00:00')
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  // semana ISO
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const semana = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7)
  return `${dd}/${mm} · S${semana}`
}

export default function DatePickerComSemanas({
  value = '',
  onChange,
  placeholder = 'Selecionar data',
  disabled = false,
  className = '',
}) {
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState({ top: undefined, bottom: undefined, left: 0, width: 280 })
  const containerRef = useRef(null)
  const triggerRef = useRef(null)

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [aberto])

  // Derivar ano e mês inicial do valor atual
  const anoInicial = value ? parseInt(value.slice(0, 4), 10) : new Date().getFullYear()
  const mesInicial = value ? parseInt(value.slice(5, 7), 10) - 1 : new Date().getMonth()

  const handleToggle = () => {
    if (!aberto && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const CAL_H = 330 // altura estimada do calendário
      const spaceBelow = window.innerHeight - r.bottom - 8
      const flipUp = spaceBelow < CAL_H
      setPos({
        top: flipUp ? undefined : r.bottom + 4,
        bottom: flipUp ? (window.innerHeight - r.top + 4) : undefined,
        left: r.left,
        width: Math.max(r.width, 280),
      })
    }
    setAberto(v => !v)
  }

  const handleSelectDate = (dateStr) => {
    onChange?.(dateStr)
    setAberto(false)
  }

  const label = formatarDataComSemana(value)

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full text-left text-xs border border-gray-300 rounded px-2 py-1 bg-white hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      >
        {label || <span className="text-gray-400">{placeholder}</span>}
        <span className="float-right text-gray-400 text-[10px]">▾</span>
      </button>

      {/* Popover com calendário — position:fixed escapa de qualquer overflow:hidden do ancestral */}
      {aberto && (
        <div
          style={{
            position: 'fixed',
            top: pos.top,
            bottom: pos.bottom,
            left: pos.left,
            minWidth: pos.width,
            zIndex: 9999,
            background: '#fff',
            border: '0.5px solid #e5e7eb',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
          onClick={e => e.stopPropagation()}
        >
          <CalendarioComSemanas
            ano={anoInicial}
            mesInicial={mesInicial}
            selectedDate={value || null}
            onSelectDate={handleSelectDate}
          />
        </div>
      )}
    </div>
  )
}
