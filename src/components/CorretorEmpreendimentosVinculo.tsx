'use client'

import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { EmpreendimentoVinculoOpcao } from '@/lib/corretor-empreendimentos-vinculo'

type Props = {
  empreendimentos: EmpreendimentoVinculoOpcao[]
  selecionados: string[]
  onChange: (ids: string[]) => void
  modo: 'publico' | 'interno'
}

function semAcento(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function CorretorEmpreendimentosVinculo({
  empreendimentos,
  selecionados,
  onChange,
  modo,
}: Props) {
  const [busca, setBusca] = useState('')
  const marcados = useMemo(() => new Set(selecionados), [selecionados])
  const porId = useMemo(
    () => new Map(empreendimentos.map((emp) => [emp.id, emp.nome])),
    [empreendimentos],
  )

  const chips = useMemo(
    () =>
      selecionados
        .map((id) => ({ id, nome: porId.get(id) ?? 'Empreendimento' }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [porId, selecionados],
  )

  const filtrados = useMemo(() => {
    const q = semAcento(busca)
    if (!q) return empreendimentos
    return empreendimentos.filter((emp) => semAcento(emp.nome).includes(q))
  }, [busca, empreendimentos])

  function alternar(id: string) {
    if (marcados.has(id)) onChange(selecionados.filter((item) => item !== id))
    else onChange([...selecionados, id])
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-stone-900">Empreendimentos</legend>
      <p className="text-[11px] text-stone-500">
        {modo === 'publico'
          ? 'Pesquise e marque os empreendimentos em que você pode atuar. Pode escolher mais de um. A lista abaixo mostra os que estão abertos para vínculo.'
          : 'Pesquise e marque os empreendimentos em que este corretor pode atuar. Pode escolher mais de um. A lista abaixo mostra os que estão abertos para vínculo.'}
      </p>

      {empreendimentos.length === 0 ? (
        <p className="text-sm text-stone-600">Nenhum empreendimento disponível para vínculo.</p>
      ) : (
        <div>
          {chips.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <span
                  key={chip.id}
                  className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-800"
                >
                  {chip.nome}
                  <button
                    type="button"
                    onClick={() => alternar(chip.id)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-stone-500 hover:bg-stone-200 hover:text-stone-800"
                    aria-label={`Remover ${chip.nome}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex min-h-[44px] items-center gap-2 rounded-md border border-stone-300 bg-white px-3">
            <Search className="h-4 w-4 shrink-0 text-stone-400" aria-hidden />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar empreendimento…"
              className="min-h-[28px] min-w-0 flex-1 bg-transparent text-sm outline-none"
              aria-label="Pesquisar empreendimento"
            />
          </div>

          <p className="mb-1 mt-2 text-xs font-medium text-stone-600">Disponíveis</p>
          <ul
            role="listbox"
            aria-label="Empreendimentos disponíveis"
            aria-multiselectable="true"
            className="max-h-56 overflow-auto rounded-md border border-stone-200 bg-white py-1"
          >
            {filtrados.length === 0 ? (
              <li className="px-3 py-2 text-sm text-stone-500">Nenhum empreendimento encontrado.</li>
            ) : (
              filtrados.map((emp) => {
                const marcado = marcados.has(emp.id)
                return (
                  <li key={emp.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={marcado}
                      onClick={() => alternar(emp.id)}
                      className={`flex min-h-[44px] w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50 ${
                        marcado ? 'bg-stone-100 font-medium text-stone-900' : 'text-stone-700'
                      }`}
                    >
                      <span>{emp.nome}</span>
                      {marcado ? <span className="text-xs font-medium">✓</span> : null}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </fieldset>
  )
}
