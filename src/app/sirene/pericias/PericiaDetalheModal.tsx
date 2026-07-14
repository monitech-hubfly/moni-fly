'use client'

// components/sirene/pericias/PericiaDetalheModal.tsx

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  Fragment,
} from 'react'
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Save,
  ChevronRight,
  MessageSquare,
  PenLine,
  Pencil,
  Check,
} from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Pericia, PericiaStatus, PrioridadeLevel } from '@/app/sirene/pericias/page'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PericiaDetalheModalProps {
  periciaId: number | null
  onClose: () => void
  onUpdated?: () => void // callback opcional para re-fetch no pai
}

type AcaoStatus = 'pendente' | 'em_andamento' | 'concluida'

interface PericiaAcao {
  id: number
  pericia_id: number
  descricao: string
  status: AcaoStatus
  resolucao: string | null
  responsavel_nome: string | null
  created_at: string
  updated_at: string
}

interface ChamadoVinculado {
  id: number
  titulo: string
  recorrente: boolean
  created_at: string
}

interface CarometroItem {
  id: number
  titulo: string
  caneta_verde: boolean
  created_at: string
}

interface HistoricoItem {
  id: number
  pericia_id: number
  descricao: string
  created_at: string
  autor_nome: string
}

interface PericiaDetalhe extends Pericia {
  acoes: PericiaAcao[]
  chamados: ChamadoVinculado[]
  carometro_itens: CarometroItem[]
  historico: HistoricoItem[]
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const FASES: { key: PericiaStatus; label: string }[] = [
  { key: 'aberta', label: 'Aberta' },
  { key: 'investigando', label: 'Investigando' },
  { key: 'plano_acao', label: 'Plano de ação' },
  { key: 'concluida', label: 'Concluída' },
]

const FASE_INDEX: Record<PericiaStatus, number> = {
  aberta: 0,
  investigando: 1,
  plano_acao: 2,
  concluida: 3,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatarDataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

function prioridadeClasses(p: PrioridadeLevel) {
  const map: Record<PrioridadeLevel, string> = {
    baixa: 'bg-gray-100 text-gray-600',
    media: 'bg-blue-100 text-blue-700',
    alta: 'bg-amber-100 text-amber-700',
    critica: 'bg-red-100 text-red-700',
  }
  return map[p] ?? map.media
}

function prioridadeLabel(p: PrioridadeLevel) {
  const map: Record<PrioridadeLevel, string> = {
    baixa: 'Baixa',
    media: 'Média',
    alta: 'Alta',
    critica: 'Crítica',
  }
  return map[p] ?? p
}

function acaoStatusIcon(status: AcaoStatus) {
  if (status === 'concluida')
    return <CheckCircle2 className="h-4 w-4 text-green-700 shrink-0" />
  if (status === 'em_andamento')
    return <Clock className="h-4 w-4 text-amber-500 shrink-0" />
  return <Circle className="h-4 w-4 text-gray-400 shrink-0" />
}

function acaoStatusLabel(status: AcaoStatus) {
  if (status === 'concluida') return 'Concluída'
  if (status === 'em_andamento') return 'Em andamento'
  return 'Pendente'
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
      {children}
    </h3>
  )
}

function Divider() {
  return <div className="border-t border-gray-100 my-5" />
}

// ─── Component principal ──────────────────────────────────────────────────────

export default function PericiaDetalheModal({
  periciaId,
  onClose,
  onUpdated,
}: PericiaDetalheModalProps) {
  const supabase = createClientComponentClient()

  // Estado principal
  const [detalhe, setDetalhe] = useState<PericiaDetalhe | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edição do título
  const [editandoTitulo, setEditandoTitulo] = useState(false)
  const [tituloLocal, setTituloLocal] = useState('')
  const tituloRef = useRef<HTMLInputElement>(null)

  // Causa raiz
  const [causaLocal, setCausaLocal] = useState('')
  const [salvandoCausa, setSalvandoCausa] = useState(false)

  // Nova ação
  const [novaAcao, setNovaAcao] = useState('')
  const [adicionandoAcao, setAdicionandoAcao] = useState(false)

  // Resolução inline por ação
  const [resolucaoAberta, setResolucaoAberta] = useState<number | null>(null)
  const [resolucaoTexto, setResolucaoTexto] = useState('')

  // Avançar fase
  const [avancando, setAvancando] = useState(false)

  // ── Busca de dados ──────────────────────────────────────────────────────────

  const fetchDetalhe = useCallback(async (id: number) => {
    setLoading(true)
    setError(null)
    try {
      const { data: pericia, error: errP } = await supabase
        .from('sirene_pericias')
        .select('*')
        .eq('id', id)
        .single()

      if (errP || !pericia) throw new Error(errP?.message ?? 'Perícia não encontrada')

      const [{ data: acoes }, { data: chamados }, { data: carometro_itens }, { data: historico }] =
        await Promise.all([
          supabase
            .from('sirene_pericia_acoes')
            .select('*')
            .eq('pericia_id', id)
            .order('created_at', { ascending: true }),
          supabase
            .from('sirene_pericia_chamados')
            .select('*')
            .eq('pericia_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('sirene_pericia_carometro')
            .select('*')
            .eq('pericia_id', id)
            .order('created_at', { ascending: false }),
          supabase
            .from('sirene_pericia_historico')
            .select('*')
            .eq('pericia_id', id)
            .order('created_at', { ascending: true }),
        ])

      const completo: PericiaDetalhe = {
        ...pericia,
        acoes: acoes ?? [],
        chamados: chamados ?? [],
        carometro_itens: carometro_itens ?? [],
        historico: historico ?? [],
      }

      setDetalhe(completo)
      setTituloLocal(completo.titulo)
      setCausaLocal(completo.causa_raiz ?? '')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (periciaId !== null) {
      fetchDetalhe(periciaId)
    } else {
      setDetalhe(null)
    }
  }, [periciaId, fetchDetalhe])

  // Foco no input de título ao abrir edição
  useEffect(() => {
    if (editandoTitulo) tituloRef.current?.focus()
  }, [editandoTitulo])

  // Fechar com Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // ── Ações do usuário ────────────────────────────────────────────────────────

  async function salvarTitulo() {
    if (!detalhe || tituloLocal.trim() === detalhe.titulo) {
      setEditandoTitulo(false)
      return
    }
    await supabase
      .from('sirene_pericias')
      .update({ titulo: tituloLocal.trim() })
      .eq('id', detalhe.id)
    setDetalhe((d) => (d ? { ...d, titulo: tituloLocal.trim() } : d))
    setEditandoTitulo(false)
    onUpdated?.()
  }

  async function salvarCausaRaiz() {
    if (!detalhe) return
    setSalvandoCausa(true)
    await supabase
      .from('sirene_pericias')
      .update({ causa_raiz: causaLocal })
      .eq('id', detalhe.id)
    setDetalhe((d) => (d ? { ...d, causa_raiz: causaLocal } : d))
    setSalvandoCausa(false)
    onUpdated?.()
  }

  async function avancarFase() {
    if (!detalhe) return
    const idx = FASE_INDEX[detalhe.status]
    if (idx >= 3) return
    const novaFase = FASES[idx + 1].key
    setAvancando(true)
    await supabase
      .from('sirene_pericias')
      .update({
        status: novaFase,
        ...(novaFase === 'concluida' ? { data_conclusao: new Date().toISOString() } : {}),
      })
      .eq('id', detalhe.id)
    // Registro no histórico
    await supabase.from('sirene_pericia_historico').insert({
      pericia_id: detalhe.id,
      descricao: `Avançou para "${FASES[idx + 1].label}"`,
      autor_nome: 'Caneta Verde', // substituir pelo usuário real via session
    })
    setAvancando(false)
    await fetchDetalhe(detalhe.id)
    onUpdated?.()
  }

  async function adicionarAtividade() {
    if (!detalhe || novaAcao.trim() === '') return
    setAdicionandoAcao(true)
    const { data } = await supabase
      .from('sirene_pericia_acoes')
      .insert({
        pericia_id: detalhe.id,
        descricao: novaAcao.trim(),
        status: 'pendente',
      })
      .select()
      .single()
    if (data) {
      setDetalhe((d) => (d ? { ...d, acoes: [...d.acoes, data] } : d))
    }
    setNovaAcao('')
    setAdicionandoAcao(false)
  }

  async function concluirAcao(acaoId: number) {
    if (!detalhe || resolucaoTexto.trim() === '') return
    await supabase
      .from('sirene_pericia_acoes')
      .update({ status: 'concluida', resolucao: resolucaoTexto.trim() })
      .eq('id', acaoId)
    setDetalhe((d) =>
      d
        ? {
            ...d,
            acoes: d.acoes.map((a) =>
              a.id === acaoId
                ? { ...a, status: 'concluida', resolucao: resolucaoTexto.trim() }
                : a
            ),
          }
        : d
    )
    setResolucaoAberta(null)
    setResolucaoTexto('')
    onUpdated?.()
  }

  async function cancelarPericia() {
    if (!detalhe) return
    if (!confirm(`Cancelar a perícia ${detalhe.codigo}? Esta ação não pode ser desfeita.`)) return
    await supabase
      .from('sirene_pericias')
      .update({ status: 'concluida', data_conclusao: new Date().toISOString() })
      .eq('id', detalhe.id)
    onUpdated?.()
    onClose()
  }

  // ── Early returns ───────────────────────────────────────────────────────────

  if (periciaId === null) return null

  // ── Render ──────────────────────────────────────────────────────────────────

  const faseAtualIdx = detalhe ? FASE_INDEX[detalhe.status] : 0
  const podeAvancar = detalhe ? faseAtualIdx < 3 : false
  const mostrarCausaRaiz = detalhe
    ? ['investigando', 'plano_acao', 'concluida'].includes(detalhe.status)
    : false
  const mostrarPlanoAcoes = detalhe
    ? ['plano_acao', 'concluida'].includes(detalhe.status)
    : false

  const acoesTotal = detalhe?.acoes.length ?? 0
  const acoesConcluidas = detalhe?.acoes.filter((a) => a.status === 'concluida').length ?? 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-10 px-4 pb-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-y-auto flex flex-col">
        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl">
          {loading ? (
            <div className="flex items-center gap-3 py-2">
              <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
              <div className="h-4 w-48 bg-gray-200 animate-pulse rounded" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : detalhe ? (
            <>
              {/* Linha de código + badges */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold font-mono text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                    {detalhe.codigo}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {detalhe.tipo}
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${prioridadeClasses(
                      detalhe.prioridade
                    )}`}
                  >
                    {prioridadeLabel(detalhe.prioridade)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditandoTitulo(true)}
                    className="text-xs text-gray-500 hover:text-green-800 border border-gray-200 hover:border-green-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </button>
                  <button
                    onClick={cancelarPericia}
                    className="text-xs text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Cancelar perícia
                  </button>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Título editável */}
              <div className="mt-2">
                {editandoTitulo ? (
                  <div className="flex items-center gap-2">
                    <input
                      ref={tituloRef}
                      value={tituloLocal}
                      onChange={(e) => setTituloLocal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') salvarTitulo()
                        if (e.key === 'Escape') setEditandoTitulo(false)
                      }}
                      className="flex-1 text-lg font-semibold text-gray-800 border-b-2 border-green-700 outline-none bg-transparent pb-0.5"
                    />
                    <button
                      onClick={salvarTitulo}
                      className="p-1 text-green-700 hover:bg-green-50 rounded"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setEditandoTitulo(false)}
                      className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <h2 className="text-lg font-semibold text-gray-800 leading-snug">
                    {detalhe.titulo}
                  </h2>
                )}
              </div>

              {/* Meta: domínio · responsável · desde */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-gray-500">{detalhe.dominio}</span>
                <span className="text-gray-300 text-xs">·</span>
                <span className="text-xs text-gray-500">{detalhe.responsavel_nome}</span>
                <span className="text-gray-300 text-xs">·</span>
                <span className="text-xs text-gray-500">
                  desde {formatarData(detalhe.data_inicio)}
                </span>
                {detalhe.data_conclusao && (
                  <>
                    <span className="text-gray-300 text-xs">·</span>
                    <span className="text-xs text-green-700 font-medium">
                      Concluída em {formatarData(detalhe.data_conclusao)}
                    </span>
                  </>
                )}
              </div>

              {/* Banner de recidiva */}
              {detalhe.recidivas_count > 0 && (
                <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-800 font-medium">
                    Atenção: {detalhe.recidivas_count}{' '}
                    {detalhe.recidivas_count === 1 ? 'recidiva registrada' : 'recidivas registradas'}
                    . Este problema já foi reportado anteriormente.
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* ── BODY ───────────────────────────────────────────────────────── */}
        {detalhe && !loading && (
          <div className="px-6 py-5 flex-1 space-y-0">

            {/* Stepper de fases */}
            <div className="mb-5">
              <div className="flex items-center gap-0">
                {FASES.map((fase, idx) => {
                  const ativa = fase.key === detalhe.status
                  const concluida = idx < faseAtualIdx
                  const futura = idx > faseAtualIdx

                  return (
                    <Fragment key={fase.key}>
                      <button
                        onClick={() => {
                          if (idx === faseAtualIdx + 1) avancarFase()
                        }}
                        disabled={futura && idx !== faseAtualIdx + 1}
                        title={
                          idx === faseAtualIdx + 1
                            ? `Avançar para ${fase.label}`
                            : fase.label
                        }
                        className={`
                          flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
                          transition-all duration-150
                          ${ativa
                            ? 'bg-green-800 text-white shadow-sm'
                            : concluida
                            ? 'bg-green-100 text-green-800'
                            : idx === faseAtualIdx + 1
                            ? 'bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-700 cursor-pointer'
                            : 'bg-gray-50 text-gray-400 cursor-default'
                          }
                        `}
                      >
                        {concluida && <CheckCircle2 className="h-3 w-3" />}
                        {ativa && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        {fase.label}
                      </button>
                      {idx < FASES.length - 1 && (
                        <ChevronRight
                          className={`h-4 w-4 mx-0.5 shrink-0 ${
                            idx < faseAtualIdx ? 'text-green-500' : 'text-gray-300'
                          }`}
                        />
                      )}
                    </Fragment>
                  )
                })}
              </div>
            </div>

            <Divider />

            {/* Ocorrências — dois boxes */}
            <div>
              <SectionTitle>Ocorrências</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Box Sirene */}
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">
                      Sirene ({detalhe.chamados.length})
                    </span>
                  </div>
                  {detalhe.chamados.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Nenhum chamado vinculado</p>
                  ) : (
                    <ul className="space-y-2">
                      {detalhe.chamados.map((c) => (
                        <li key={c.id} className="flex items-start gap-2">
                          <span className="text-xs text-gray-500 leading-snug flex-1 line-clamp-2">
                            {c.titulo}
                          </span>
                          {c.recorrente && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                              recorrente
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Box Carômetro */}
                <div className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <PenLine className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">
                      Carômetro ({detalhe.carometro_itens.length})
                    </span>
                  </div>
                  {detalhe.carometro_itens.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Nenhum item do carômetro</p>
                  ) : (
                    <ul className="space-y-2">
                      {detalhe.carometro_itens.map((ci) => (
                        <li key={ci.id} className="flex items-start gap-2">
                          <span className="text-xs text-gray-500 leading-snug flex-1 line-clamp-2">
                            {ci.titulo}
                          </span>
                          {ci.caneta_verde && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                              caneta verde
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* Causa raiz — visível a partir de Investigando */}
            {mostrarCausaRaiz && (
              <>
                <Divider />
                <div>
                  <SectionTitle>Causa raiz</SectionTitle>
                  <textarea
                    value={causaLocal}
                    onChange={(e) => setCausaLocal(e.target.value)}
                    rows={4}
                    placeholder="Descreva a causa raiz identificada..."
                    className="
                      w-full text-sm text-gray-700 placeholder:text-gray-400
                      border border-gray-200 rounded-xl px-3 py-2.5
                      focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent
                      resize-none
                    "
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={salvarCausaRaiz}
                      disabled={salvandoCausa}
                      className="
                        flex items-center gap-1.5 text-xs font-medium
                        bg-green-800 text-white px-3 py-1.5 rounded-lg
                        hover:bg-green-700 disabled:opacity-60 transition-colors
                      "
                    >
                      <Save className="h-3.5 w-3.5" />
                      {salvandoCausa ? 'Salvando...' : 'Salvar causa raiz'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Plano de ações — visível a partir de Plano de ação */}
            {mostrarPlanoAcoes && (
              <>
                <Divider />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <SectionTitle>
                      Plano de ações — {acoesConcluidas}/{acoesTotal} concluídas
                    </SectionTitle>
                  </div>

                  {/* Barra de progresso */}
                  {acoesTotal > 0 && (
                    <div className="w-full h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
                      <div
                        className="h-full bg-green-700 rounded-full transition-all duration-500"
                        style={{ width: `${(acoesConcluidas / acoesTotal) * 100}%` }}
                      />
                    </div>
                  )}

                  {/* Lista de ações */}
                  <ul className="space-y-3 mb-4">
                    {detalhe.acoes.map((acao) => (
                      <li key={acao.id} className="border border-gray-200 rounded-xl p-3.5">
                        <div className="flex items-start gap-2.5">
                          {acaoStatusIcon(acao.status)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 leading-snug">{acao.descricao}</p>
                            {acao.resolucao && (
                              <p className="text-xs text-gray-500 mt-1 italic">
                                Resolução: {acao.resolucao}
                              </p>
                            )}
                            {acao.status !== 'concluida' && (
                              <div className="mt-2">
                                {resolucaoAberta === acao.id ? (
                                  <div className="space-y-2">
                                    <textarea
                                      value={resolucaoTexto}
                                      onChange={(e) => setResolucaoTexto(e.target.value)}
                                      placeholder="Como foi resolvida?"
                                      rows={2}
                                      className="
                                        w-full text-xs text-gray-700 placeholder:text-gray-400
                                        border border-gray-200 rounded-lg px-2.5 py-2
                                        focus:outline-none focus:ring-2 focus:ring-green-700
                                        resize-none
                                      "
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => concluirAcao(acao.id)}
                                        disabled={resolucaoTexto.trim() === ''}
                                        className="
                                          text-xs bg-green-800 text-white px-2.5 py-1 rounded-lg
                                          hover:bg-green-700 disabled:opacity-50 transition-colors
                                        "
                                      >
                                        Marcar como concluída
                                      </button>
                                      <button
                                        onClick={() => {
                                          setResolucaoAberta(null)
                                          setResolucaoTexto('')
                                        }}
                                        className="text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1 rounded-lg transition-colors"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setResolucaoAberta(acao.id)
                                      setResolucaoTexto('')
                                    }}
                                    className="
                                      text-xs text-gray-500 hover:text-green-800
                                      border border-gray-200 hover:border-green-300
                                      px-2 py-0.5 rounded-lg transition-colors
                                    "
                                  >
                                    Marcar como concluída
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <span className={`
                            text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0
                            ${acao.status === 'concluida'
                              ? 'bg-green-100 text-green-700'
                              : acao.status === 'em_andamento'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-500'
                            }
                          `}>
                            {acaoStatusLabel(acao.status)}
                          </span>
                        </div>
                      </li>
                    ))}
                    {detalhe.acoes.length === 0 && (
                      <p className="text-xs text-gray-400 italic">
                        Nenhuma atividade cadastrada ainda.
                      </p>
                    )}
                  </ul>

                  {/* Adicionar atividade */}
                  <div className="flex items-center gap-2">
                    <input
                      value={novaAcao}
                      onChange={(e) => setNovaAcao(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') adicionarAtividade()
                      }}
                      placeholder="Descreva a nova atividade..."
                      className="
                        flex-1 text-sm text-gray-700 placeholder:text-gray-400
                        border border-gray-200 rounded-xl px-3 py-2
                        focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent
                      "
                    />
                    <button
                      onClick={adicionarAtividade}
                      disabled={adicionandoAcao || novaAcao.trim() === ''}
                      className="
                        flex items-center gap-1.5 text-xs font-medium
                        bg-green-800 text-white px-3 py-2 rounded-xl
                        hover:bg-green-700 disabled:opacity-60 transition-colors shrink-0
                      "
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Histórico */}
            <Divider />
            <div className="pb-2">
              <SectionTitle>Histórico</SectionTitle>
              {detalhe.historico.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Nenhum registro de histórico.</p>
              ) : (
                <ol className="space-y-2 border-l-2 border-gray-100 pl-4">
                  {detalhe.historico.map((h) => (
                    <li key={h.id} className="relative">
                      {/* Dot na timeline */}
                      <span className="absolute -left-[1.35rem] top-1 h-2 w-2 rounded-full bg-gray-300 border-2 border-white" />
                      <p className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">
                          {formatarDataCurta(h.created_at)}
                        </span>
                        {' · '}
                        <span className="text-gray-600">{h.autor_nome}</span>
                        {' — '}
                        {h.descricao}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        {detalhe && !loading && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl flex items-center justify-between gap-4">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Fechar
            </button>

            {podeAvancar && (
              <button
                onClick={avancarFase}
                disabled={avancando}
                className="
                  flex items-center gap-2 text-sm font-semibold
                  bg-green-800 hover:bg-green-700 text-white
                  px-5 py-2.5 rounded-xl
                  shadow-sm hover:shadow-md
                  disabled:opacity-60 transition-all duration-150
                "
              >
                {avancando ? 'Avançando...' : `Avançar para ${FASES[faseAtualIdx + 1]?.label}`}
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {detalhe.status === 'concluida' && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Perícia concluída
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
