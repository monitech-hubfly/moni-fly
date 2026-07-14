'use client'

import { useState, useTransition } from 'react'
import { listPericiasParaSelect, PERICIAS_DOMINIOS, PericiaParaSelect, PericiaDominio } from '@/app/sirene/pericias/actions'

interface PericiaSelectProps {
  onSelect: (periciaId: number, periciaInfo: { numero: string; titulo: string; status: string; dominio: string }) => void
  onCriarNova?: (dominio: string) => void
  disabled?: boolean
  className?: string
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: 'rascunho',
  aberta: 'aberta',
  investigando: 'investigando',
  plano_acao: 'plano de ação',
  concluida: 'concluída',
}

function translateStatus(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export function PericiaSelect({ onSelect, onCriarNova, disabled = false, className }: PericiaSelectProps) {
  const [dominio, setDominio] = useState<string>('')
  const [periciaId, setPericiaId] = useState<number | null>(null)
  const [opcoes, setOpcoes] = useState<PericiaParaSelect[]>([])
  const [isPending, startTransition] = useTransition()

  const periciaAtual = periciaId !== null ? opcoes.find((p) => p.id === periciaId) ?? null : null
  const isRecidiva = periciaAtual?.status === 'concluida'

  function handleDominioChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const novoDominio = e.target.value
    setDominio(novoDominio)
    setPericiaId(null)
    setOpcoes([])

    if (!novoDominio) return

    startTransition(async () => {
      const resultado = await listPericiasParaSelect(novoDominio)
      setOpcoes(resultado)
    })
  }

  function handlePericiaChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const valor = e.target.value

    if (valor === '__criar_nova__') {
      if (onCriarNova && dominio) {
        onCriarNova(dominio)
      }
      return
    }

    const id = Number(valor)
    if (Number.isNaN(id)) {
      setPericiaId(null)
      return
    }

    const pericia = opcoes.find((p) => p.id === id)
    if (!pericia) return

    setPericiaId(id)
    onSelect(id, {
      numero: pericia.numero,
      titulo: pericia.titulo,
      status: pericia.status,
      dominio: pericia.dominio,
    })
  }

  const dominioSelecionado = Boolean(dominio)
  const carregando = isPending

  return (
    <div className={`flex flex-col gap-3${className ? ` ${className}` : ''}`}>
      {/* Primeiro select — Domínio */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">
          Domínio
        </label>
        <select
          value={dominio}
          onChange={handleDominioChange}
          disabled={disabled}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-green-700 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
        >
          <option value="">Selecione um domínio...</option>
          {(PERICIAS_DOMINIOS as readonly PericiaDominio[]).map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {/* Segundo select — Perícia */}
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">
          {dominioSelecionado && !carregando
            ? `Perícia * (${opcoes.length} ${opcoes.length === 1 ? 'opção' : 'opções'})`
            : 'Perícia'}
        </label>
        <div className="relative">
          <select
            value={periciaId !== null ? String(periciaId) : ''}
            onChange={handlePericiaChange}
            disabled={disabled || !dominioSelecionado || carregando}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-green-700 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
          >
            {!dominioSelecionado ? (
              <option value="">— selecione o domínio primeiro —</option>
            ) : carregando ? (
              <option value="">Carregando...</option>
            ) : (
              <>
                <option value="">Selecione uma perícia...</option>
                {opcoes.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.numero} · {p.titulo} ({translateStatus(p.status)})
                  </option>
                ))}
                <option value="__criar_nova__">+ Criar nova perícia neste domínio</option>
              </>
            )}
          </select>

          {/* Spinner de loading sobreposto ao select */}
          {carregando && (
            <span
              className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2"
              aria-label="Carregando perícias"
            >
              <svg
                className="animate-spin h-4 w-4 text-green-700"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </span>
          )}
        </div>

        {/* Alert de recidiva */}
        {isRecidiva && (
          <div
            role="alert"
            className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1"
          >
            <span aria-hidden="true" className="mt-px shrink-0">⚠</span>
            <span>
              Esta perícia já foi concluída — esta vinculação será registrada como recidiva.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
