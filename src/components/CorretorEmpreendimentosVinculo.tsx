'use client'

import type { EmpreendimentoVinculoOpcao } from '@/lib/corretor-empreendimentos-vinculo'

type Props = {
  empreendimentos: EmpreendimentoVinculoOpcao[]
  selecionados: string[]
  onChange: (ids: string[]) => void
  modo: 'publico' | 'interno'
}

export function CorretorEmpreendimentosVinculo({
  empreendimentos,
  selecionados,
  onChange,
  modo,
}: Props) {
  const marcados = new Set(selecionados)

  function alternar(id: string) {
    if (marcados.has(id)) onChange(selecionados.filter((item) => item !== id))
    else onChange([...selecionados, id])
  }

  return (
    <fieldset className="space-y-3">
      <legend
        className="text-sm font-semibold"
        style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-sans)' }}
      >
        Empreendimentos
      </legend>
      <p className="text-[11px]" style={{ color: 'var(--moni-text-tertiary)', fontFamily: 'var(--moni-font-sans)' }}>
        {modo === 'publico'
          ? 'Marque os empreendimentos em que você pode atuar. A lista mostra só os que estão abertos para vínculo.'
          : 'Marque os empreendimentos em que este corretor pode atuar. A lista mostra só os que estão abertos para vínculo.'}
      </p>
      {empreendimentos.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--moni-text-secondary)', fontFamily: 'var(--moni-font-sans)' }}>
          Nenhum empreendimento disponível para vínculo.
        </p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {empreendimentos.map((emp) => {
            const marcado = marcados.has(emp.id)
            return (
              <li key={emp.id}>
                <label
                  className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[var(--moni-radius-md)] px-3 py-2"
                  style={{
                    border: 'var(--moni-border-width) solid var(--moni-border-default)',
                    background: marcado ? 'var(--moni-surface-100)' : 'var(--moni-surface-0)',
                    color: 'var(--moni-text-primary)',
                    fontFamily: 'var(--moni-font-sans)',
                  }}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0"
                    checked={marcado}
                    onChange={() => alternar(emp.id)}
                  />
                  <span className="text-sm">{emp.nome}</span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </fieldset>
  )
}
