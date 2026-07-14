'use client'

// components/sirene/pericias/PericiaCard.tsx

import { AlertTriangle, MessageSquare, PenLine } from 'lucide-react'
import { Pericia, PrioridadeLevel } from '@/app/sirene/pericias/page'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PericiaCardProps {
  pericia: Pericia
  posicao?: number // só para coluna Aberta
  onClick: (id: number) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prioridadeBadge(prioridade: PrioridadeLevel) {
  const map: Record<PrioridadeLevel, { label: string; className: string }> = {
    baixa: { label: 'Baixa', className: 'bg-gray-100 text-gray-600' },
    media: { label: 'Média', className: 'bg-blue-100 text-blue-700' },
    alta: { label: 'Alta', className: 'bg-amber-100 text-amber-700' },
    critica: { label: 'Crítica', className: 'bg-red-100 text-red-700' },
  }
  const { label, className } = map[prioridade] ?? map.media
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  )
}

function ultimaOcorrencia(updatedAt: string): string {
  const now = new Date()
  const updated = new Date(updatedAt)
  const diffMs = now.getTime() - updated.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMins = Math.floor(diffMs / (1000 * 60))

  if (diffMins < 1) return 'agora mesmo'
  if (diffMins < 60) return `há ${diffMins} min`
  if (diffHours < 24) return `há ${diffHours}h`
  if (diffDays === 1) return 'ontem'
  if (diffDays <= 7) return `há ${diffDays} dias`

  return updated.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PericiaCard({ pericia, posicao, onClick }: PericiaCardProps) {
  const temRecidiva = pericia.recidivas_count > 0

  return (
    <button
      type="button"
      onClick={() => onClick(pericia.id)}
      className="
        w-full text-left
        bg-white rounded-xl border border-gray-200 shadow-sm
        hover:shadow-md hover:border-green-700
        transition-all duration-150
        p-4 space-y-3
        relative
        focus:outline-none focus:ring-2 focus:ring-green-700 focus:ring-offset-1
      "
    >
      {/* Badge de posição — coluna Aberta */}
      {posicao !== undefined && (
        <span className="
          absolute top-3 right-3
          bg-green-800 text-white
          text-[10px] font-bold
          w-6 h-6 rounded-full flex items-center justify-center
          leading-none
        ">
          #{posicao}
        </span>
      )}

      {/* Linha superior: código · domínio · responsável */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pr-7">
        <span className="text-xs font-semibold text-green-800 font-mono">
          {pericia.codigo}
        </span>
        <span className="text-gray-400 text-xs">·</span>
        <span className="text-xs text-gray-500 truncate max-w-[120px]">
          {pericia.dominio}
        </span>
        <span className="text-gray-400 text-xs">·</span>
        <span className="text-xs text-gray-500 truncate max-w-[100px]">
          {pericia.responsavel_nome}
        </span>
      </div>

      {/* Título */}
      <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2">
        {pericia.titulo}
      </p>

      {/* Banner de recidiva */}
      {temRecidiva && (
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-700 font-medium">
            Recidiva — {pericia.recidivas_count}{' '}
            {pericia.recidivas_count === 1 ? 'nova ocorrência' : 'novas ocorrências'}
          </span>
        </div>
      )}

      {/* Contadores + prioridade */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {/* Chamados Sirene */}
          {pericia.chamados_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <MessageSquare className="h-3.5 w-3.5 text-gray-400" />
              {pericia.chamados_count}{' '}
              {pericia.chamados_count === 1 ? 'chamado' : 'chamados'}
            </span>
          )}

          {/* Itens Carômetro */}
          {pericia.carometro_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <PenLine className="h-3.5 w-3.5 text-gray-400" />
              {pericia.carometro_count}{' '}
              {pericia.carometro_count === 1 ? 'item' : 'itens'}
            </span>
          )}
        </div>

        {prioridadeBadge(pericia.prioridade)}
      </div>

      {/* Última ocorrência */}
      <p className="text-[11px] text-gray-400">
        Última ocorrência: {ultimaOcorrencia(pericia.updated_at)}
      </p>
    </button>
  )
}
