'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { fetchMunicipiosPorUfs, type CidadeIbgeLite } from '@/lib/ibge'
import type { RedeCorretorCidadeAtuacao } from '@/lib/rede-corretores'
import { UFS_BRASIL } from '@/lib/uf'

const labelCls = 'mb-1 block text-xs font-medium text-stone-600'
const hintCls = 'mt-0.5 text-[11px] text-stone-500'

type Props = {
  ufs: string[]
  cidades: RedeCorretorCidadeAtuacao[]
  onChange: (patch: { atuacao_ufs?: string[]; atuacao_cidades?: RedeCorretorCidadeAtuacao[] }) => void
}

export function CorretorAreaAtuacaoFields({ ufs, cidades, onChange }: Props) {
  const [municipios, setMunicipios] = useState<CidadeIbgeLite[]>([])
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState('')
  const [openCidades, setOpenCidades] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (ufs.length === 0) {
      setMunicipios([])
      return
    }
    const controller = new AbortController()
    ;(async () => {
      try {
        setLoading(true)
        const lista = await fetchMunicipiosPorUfs(ufs, controller.signal)
        setMunicipios(lista)
      } catch {
        if (!controller.signal.aborted) setMunicipios([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    return () => controller.abort()
  }, [ufs.join(',')])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpenCidades(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selecionados = useMemo(() => new Set(cidades.map((c) => c.ibge_id)), [cidades])

  const filtrados = useMemo(() => {
    const q = busca
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
    if (!q) return municipios.slice(0, 80)
    return municipios
      .filter((m) => {
        const n = m.nome
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
        return n.includes(q) || m.uf.toLowerCase().includes(q)
      })
      .slice(0, 80)
  }, [municipios, busca])

  function toggleUf(sigla: string) {
    const has = ufs.includes(sigla)
    const nextUfs = has ? ufs.filter((u) => u !== sigla) : [...ufs, sigla].sort()
    const nextCidades = has ? cidades.filter((c) => c.uf !== sigla) : cidades
    onChange({ atuacao_ufs: nextUfs, atuacao_cidades: nextCidades })
  }

  function toggleCidade(m: CidadeIbgeLite) {
    if (selecionados.has(m.id)) {
      onChange({ atuacao_cidades: cidades.filter((c) => c.ibge_id !== m.id) })
      return
    }
    onChange({
      atuacao_cidades: [
        ...cidades,
        { ibge_id: m.id, nome: m.nome, uf: m.uf },
      ].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    })
  }

  function removeCidade(ibgeId: number) {
    onChange({ atuacao_cidades: cidades.filter((c) => c.ibge_id !== ibgeId) })
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-stone-900">Área de atuação</legend>

      <div>
        <span className={labelCls}>Estados de corretagem</span>
        <p className={hintCls}>Selecione uma ou mais UFs onde o corretor atua.</p>
        <div className="mt-2 grid max-h-40 grid-cols-3 gap-1.5 overflow-y-auto rounded-md border border-stone-200 bg-stone-50/50 p-2 sm:grid-cols-4 md:grid-cols-6">
          {UFS_BRASIL.map((u) => {
            const checked = ufs.includes(u.sigla)
            return (
              <label
                key={u.sigla}
                className={`flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-xs ${
                  checked ? 'bg-[#0c2633]/10 font-medium text-[#0c2633]' : 'text-stone-700 hover:bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleUf(u.sigla)}
                  className="rounded border-stone-300"
                />
                {u.sigla}
              </label>
            )
          })}
        </div>
        {ufs.length > 0 ? (
          <p className="mt-1 text-[11px] text-stone-500">Selecionados: {ufs.join(', ')}</p>
        ) : null}
      </div>

      <div ref={wrapRef}>
        <span className={labelCls}>Cidades de corretagem</span>
        <p className={hintCls}>
          Busca filtrada pelos estados selecionados (base IBGE). Selecione quantas precisar.
        </p>

        {cidades.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cidades.map((c) => (
              <span
                key={c.ibge_id}
                className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs text-stone-800"
              >
                {c.nome}/{c.uf}
                <button
                  type="button"
                  onClick={() => removeCidade(c.ibge_id)}
                  className="rounded p-0.5 text-stone-500 hover:bg-stone-200 hover:text-stone-800"
                  aria-label={`Remover ${c.nome}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="relative mt-2">
          <div className="flex items-center gap-2 rounded-md border border-stone-300 bg-white px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-stone-400" />
            <input
              type="search"
              value={busca}
              disabled={ufs.length === 0}
              onFocus={() => setOpenCidades(true)}
              onChange={(e) => {
                setBusca(e.target.value)
                setOpenCidades(true)
              }}
              placeholder={
                ufs.length === 0
                  ? 'Selecione pelo menos um estado'
                  : loading
                    ? 'Carregando cidades…'
                    : 'Pesquisar cidade…'
              }
              className="min-w-0 flex-1 bg-transparent text-sm outline-none disabled:text-stone-400"
            />
          </div>

          {openCidades && ufs.length > 0 ? (
            <ul
              role="listbox"
              className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-stone-200 bg-white py-1 shadow-lg"
            >
              {loading ? (
                <li className="px-3 py-2 text-sm text-stone-500">Carregando…</li>
              ) : filtrados.length === 0 ? (
                <li className="px-3 py-2 text-sm text-stone-500">Nenhuma cidade encontrada.</li>
              ) : (
                filtrados.map((m) => {
                  const on = selecionados.has(m.id)
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={on}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          toggleCidade(m)
                        }}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50 ${
                          on ? 'bg-emerald-50/80 text-emerald-900' : 'text-stone-700'
                        }`}
                      >
                        <span>
                          {m.nome} <span className="text-stone-400">({m.uf})</span>
                        </span>
                        {on ? <span className="text-xs font-medium">✓</span> : null}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          ) : null}
        </div>
      </div>
    </fieldset>
  )
}
