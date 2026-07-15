'use client'

import { useMemo, useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Save } from 'lucide-react'
import PericiaCard from './PericiaCard'
import PericiaDetalheModal from './PericiaDetalheModal'
import type { MetricasPericias, Pericia, PericiaStatus, PrioridadeLevel } from './page'
import { criarPericia, PERICIAS_DOMINIOS, type PericiaDominio, type PericiaTipo } from './actions'

const COLUNAS: { status: PericiaStatus; label: string }[] = [
  { status: 'aberta', label: 'Aberta' },
  { status: 'investigando', label: 'Investigando' },
  { status: 'plano_acao', label: 'Plano de ação' },
  { status: 'concluida', label: 'Concluída' },
]

const PRIORIDADES: { value: PrioridadeLevel; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Crítica' },
]

const TIPOS: { value: PericiaTipo; label: string }[] = [
  { value: 'investigacao', label: 'Investigação' },
  { value: 'projeto', label: 'Projeto de melhoria' },
  { value: 'auditoria', label: 'Auditoria' },
]

// ─── Modal Nova Perícia ────────────────────────────────────────────────────────

function NovaPericia({
  onClose,
  onCriada,
}: {
  onClose: () => void
  onCriada: () => void
}) {
  const [titulo, setTitulo] = useState('')
  const [dominio, setDominio] = useState<PericiaDominio>(PERICIAS_DOMINIOS[0])
  const [prioridade, setPrioridade] = useState<PrioridadeLevel>('media')
  const [tipo, setTipo] = useState<PericiaTipo>('investigacao')
  const [erro, setErro] = useState<string | null>(null)
  const [saving, startSave] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) return
    setErro(null)
    startSave(async () => {
      const r = await criarPericia({
        titulo: titulo.trim(),
        dominio,
        prioridade,
        tipo,
      })
      if ('error' in r) {
        setErro(r.error as string)
        return
      }
      onCriada()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div
        className="relative w-full max-w-md rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-800">Nova Perícia</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nome da perícia <span className="text-red-500">*</span>
            </label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
              autoFocus
              placeholder="Ex: Custo de fundação não modelado no BCA"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent"
            />
          </div>

          {/* Domínio */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Domínio <span className="text-red-500">*</span>
            </label>
            <select
              value={dominio}
              onChange={(e) => setDominio(e.target.value as PericiaDominio)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-700"
            >
              {PERICIAS_DOMINIOS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Tipo + Prioridade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as PericiaTipo)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-700"
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prioridade</label>
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as PrioridadeLevel)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-700"
              >
                {PRIORIDADES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {erro && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{erro}</p>}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !titulo.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Criando...' : 'Criar perícia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Board principal ───────────────────────────────────────────────────────────

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
  const [responsavel, setResponsavel] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [novaPericia, setNovaPericia] = useState(false)

  // Lista única de responsáveis para o filtro
  const responsaveis = useMemo(() => {
    const nomes = Array.from(
      new Set(pericias.map((p) => p.responsavel_nome).filter(Boolean))
    ).sort() as string[]
    return ['Todos', ...nomes]
  }, [pericias])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return pericias.filter((p) => {
      if (dominio !== 'Todos' && p.dominio !== dominio) return false
      if (responsavel !== 'Todos' && p.responsavel_nome !== responsavel) return false
      if (!q) return true
      return (
        p.titulo.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        (p.responsavel_nome || '').toLowerCase().includes(q)
      )
    })
  }, [pericias, dominio, responsavel, busca])

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
          {/* Busca */}
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar perícia..."
            className="h-11 w-full max-w-[220px] rounded-[var(--moni-radius-md)] px-3 text-sm sm:w-[200px]"
            style={{
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              color: 'var(--moni-text-primary)',
              background: 'var(--moni-bg-surface, #fff)',
            }}
          />
          {/* Filtro domínio */}
          <select
            value={dominio}
            onChange={(e) => setDominio(e.target.value)}
            className="h-11 w-auto max-w-[160px] rounded-[var(--moni-radius-md)] px-3 text-sm"
            style={{
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              color: 'var(--moni-text-primary)',
              background: 'var(--moni-bg-surface, #fff)',
            }}
          >
            {dominios.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {/* Filtro responsável */}
          <select
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            className="h-11 w-auto max-w-[160px] rounded-[var(--moni-radius-md)] px-3 text-sm"
            style={{
              border: 'var(--moni-border-width) solid var(--moni-border-default)',
              color: 'var(--moni-text-primary)',
              background: 'var(--moni-bg-surface, #fff)',
            }}
          >
            {responsaveis.map((r) => (
              <option key={r} value={r}>{r === 'Todos' ? 'Todos responsáveis' : r}</option>
            ))}
          </select>
          {/* Nova perícia */}
          <button
            onClick={() => setNovaPericia(true)}
            className="flex h-11 items-center gap-1.5 rounded-[var(--moni-radius-md)] px-4 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ background: 'var(--moni-green-800, #166534)' }}
          >
            <Plus className="h-4 w-4" />
            Nova perícia
          </button>
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

      {novaPericia && (
        <NovaPericia
          onClose={() => setNovaPericia(false)}
          onCriada={onUpdated}
        />
      )}
    </main>
  )
}
