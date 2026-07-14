// app/sirene/pericias/page.tsx
// Server Component — busca dados e passa para o Client

import { createClient } from '@/lib/supabase/server'
import PericiasBoardClient from './PericiasBoardClient'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PericiaStatus = 'aberta' | 'investigando' | 'plano_acao' | 'concluida'
export type PericiaOrigem = 'sirene' | 'carometro' | 'ambos'
export type PrioridadeLevel = 'baixa' | 'media' | 'alta' | 'critica'

export interface Pericia {
  id: number
  codigo: string           // e.g. "P-007"
  titulo: string
  tipo: string
  dominio: string
  responsavel_nome: string
  responsavel_id: string
  status: PericiaStatus
  prioridade: PrioridadeLevel
  origem: PericiaOrigem
  chamados_count: number
  carometro_count: number
  recidivas_count: number
  causa_raiz: string | null
  data_inicio: string
  data_conclusao: string | null
  updated_at: string
  created_at: string
}

export interface MetricasPericias {
  total: number
  abertas: number
  investigando: number
  plano_acao: number
  recidivas: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOMINIOS = [
  'Todos',
  'BCA',
  'Crédito',
  'Cobrança',
  'Onboarding',
  'Renegociação',
  'Compliance',
  'Tecnologia',
  'Produto',
  'Operações',
  'Financeiro',
  'Jurídico',
  'RH',
  'Marketing',
  'Parceiros',
  'Suporte',
  'Segurança',
  'Dados',
]

// ─── Server Component ─────────────────────────────────────────────────────────

export default async function PericiasPage() {
  const supabase = await createClient()

  const { data: pericias, error } = await supabase
    .from('sirene_pericias')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[PericiasPage] erro ao buscar perícias:', error.message)
  }

  // Banco usa nome_pericia/numero; interface usa titulo/codigo — mapear
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lista: Pericia[] = (pericias ?? []).map((p: any) => ({
    ...p,
    titulo: p.nome_pericia ?? '',
    codigo: p.numero ?? `P-${p.id}`,
  }))

  const metricas: MetricasPericias = {
    total: lista.length,
    abertas: lista.filter((p) => p.status === 'aberta').length,
    investigando: lista.filter((p) => p.status === 'investigando').length,
    plano_acao: lista.filter((p) => p.status === 'plano_acao').length,
    recidivas: lista.reduce((acc, p) => acc + (p.recidivas_count ?? 0), 0),
  }

  return (
    <PericiasBoardClient
      pericias={lista}
      metricas={metricas}
      dominios={DOMINIOS}
    />
  )
}
