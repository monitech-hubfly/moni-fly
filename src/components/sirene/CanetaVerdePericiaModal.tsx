'use client'

import { useState, useTransition } from 'react'
import { PericiaSelect } from '@/components/sirene/PericiaSelect'
import { vincularCarometroPericia } from '@/app/sirene/pericias/actions'

interface CanetaVerdePericiaModalProps {
  /** UUID de `acoes.id` ou `tarefas.id` */
  acaoId: string
  /** Nome da ação, usado como item_descricao no vínculo */
  acaoNome: string
  /** franqueado_id opcional (passado ao vínculo) */
  franqueadoId?: string | null
  /** Callback ao fechar (Pular ou Vincular) */
  onFechar: () => void
}

/**
 * Modal exibido ao ativar a caneta verde em um comportamento do carômetro.
 * Permite vincular (opcionalmente) aquele comportamento a uma perícia Sirene.
 */
export function CanetaVerdePericiaModal({
  acaoId,
  acaoNome,
  franqueadoId,
  onFechar,
}: CanetaVerdePericiaModalProps) {
  const [periciaVinculada, setPericiaVinculada] = useState<{
    id: number
    numero: string
    titulo: string
    status: string
    dominio: string
  } | null>(null)
  const [vinculando, startVinculo] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  function handleVincular() {
    if (!periciaVinculada) return
    setErro(null)
    startVinculo(async () => {
      const result = await vincularCarometroPericia(
        periciaVinculada.id,
        'acao',
        acaoId,
        acaoNome,
        franqueadoId ?? null,
      )
      if (result && 'error' in result && result.error) {
        setErro(result.error as string)
        return
      }
      onFechar()
    })
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} />
      <div
        className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-base font-semibold text-stone-800">
          Vincular a uma classificação
        </h3>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-stone-400">
          Comportamento chave ativado
        </p>
        <p
          className="mb-4 text-sm text-stone-700 leading-snug line-clamp-2"
          title={acaoNome}
        >
          {acaoNome}
        </p>

        <PericiaSelect
          onSelect={(id, info) => setPericiaVinculada({ id, ...info })}
          onCriarNova={(dominio) => {
            window.open(
              `/sirene/pericias?criar=true&dominio=${encodeURIComponent(dominio)}`,
              '_blank',
            )
          }}
        />

        {erro && (
          <p className="mt-2 text-xs text-red-600">{erro}</p>
        )}

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            disabled={vinculando}
            onClick={onFechar}
            className="text-sm text-stone-400 hover:text-stone-600 disabled:opacity-50"
          >
            Pular
          </button>
          <button
            type="button"
            disabled={!periciaVinculada || vinculando}
            onClick={handleVincular}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {vinculando ? 'Vinculando...' : 'Vincular e fechar'}
          </button>
        </div>
      </div>
    </div>
  )
}
