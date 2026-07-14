'use client'

import { useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import PericiaCard from './PericiaCard'
import PericiaDetalheModal from './PericiaDetalheModal'
import type { MetricasPericias, Pericia, PericiaStatus } from './page'

const COLUNAS: { status: PericiaStatus; label: string }[] = [
  { status: 'aberta', label: 'Aberta' },
  { status: 'investigando', label: 'Investigando' },
  { status: 'plano_acao', label: 'Plano de ação' },
  { status: 'concluida', label: 'Concluída' },
]

export default function PericiasBoardClient({
  pericias,
  metricas,
  dominios,
}: {
  pericias: Pericia[]
  metricas: MetricasPericias
  dominios: string[]
}) {
  const router = useRouter()
  const [dominio, setDominio] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return pericias.filter((p) => {
      if (dominio !== 'Todos' && p.dominio !== dominio) return false
      if (!q) return true
      return (
        p.titulo.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        (p.responsavel_nome || '').toLowerCase().includes(q)
      )
    })
  }, [pericias, dominio, busca])

  const porStatus = useMemo(() => {
    const map: Record<PericiaStatus, Pericia[]> = {
      aberta: [],
      investigando: [],
      plano_acao: [],
      concluida: [],
    }
    for (const p of filtradas) {
      if (map[p.status]) map[p.status].push(p)
    }
    return map
  }, [filtradas])

  const onUpdated = useCallback(() => {
    router.refresh()
  }, [router])

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1600px] px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{ color: 'var(--moni-text-primary)', fontFamily: 'var(--moni-font-display)' }}
          >
            Perícias
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--moni-text-secondary)' }}>
            {metricas.total} no total · {metricas.abertas} abertas · {metricas.investigando} investigando ·{' '}
            {metricas.plano_acao} plano de ação · {metricas.recidivas} recidivas
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar perícia..."
            className="h-11 w-full max-w-[260px] rounded-[var(--moni-radius-md)] px-3 text-sm sm:w-[240px]"
            style={{
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              color: 'var(--moni-text-primary)',
              background: 'var(--moni-bg-surface, #fff)',
            }}
          />
          <select
            value={dominio}
            onChange={(e) => setDominio(e.target.value)}
            className="h-11 w-auto max-w-[180px] rounded-[var(--moni-radius-md)] px-3 text-sm"
            style={{
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              color: 'var(--moni-text-primary)',
              background: 'var(--moni-bg-surface, #fff)',
            }}
          >
            {dominios.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="moni-kanban-board flex gap-3 overflow-x-auto pb-4">
        {COLUNAS.map((col) => (
          <section
            key={col.status}
            className="moni-kanban-column flex w-[280px] shrink-0 flex-col gap-2"
          >
            <h2
              className="px-1 text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--moni-text-tertiary)' }}
            >
              {col.label} ({porStatus[col.status].length})
            </h2>
            <div className="flex flex-col gap-2">
              {porStatus[col.status].map((p, idx) => (
                <PericiaCard
                  key={p.id}
                  pericia={p}
                  posicao={col.status === 'aberta' ? idx + 1 : undefined}
                  onClick={setSelectedId}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <PericiaDetalheModal
        periciaId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={onUpdated}
      />
    </main>
  )
}
