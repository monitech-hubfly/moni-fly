'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check } from 'lucide-react'
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca'
import { redeTh } from '@/app/rede-franqueados/rede-ui'
import { aprovarRedeCorretor } from '@/app/rede-franqueados/rede-corretores-actions'
import { RedeCorretorFichaModal } from '@/components/RedeCorretorFichaModal'
import { labelBanco } from '@/lib/bancos-br'
import {
  ordenarRedeCorretoresPorCodigo,
  redeCorretorRowMatchesBusca,
  REDE_CORRETOR_STATUS_LABEL,
  REDE_CORRETOR_TIPO_REGISTRO_LABEL,
  type RedeCorretorRow,
} from '@/lib/rede-corretores'

type Props = {
  rows: RedeCorretorRow[]
  children?: ReactNode
  solicitarCriacao?: number
}

export function RedeCorretoresTabelaComBusca({ rows, children, solicitarCriacao = 0 }: Props) {
  const [busca, setBusca] = useState('')
  const [modalRow, setModalRow] = useState<RedeCorretorRow | null | undefined>(undefined)
  const [aprovandoId, setAprovandoId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (solicitarCriacao > 0) setModalRow(null)
  }, [solicitarCriacao])

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim()
    const base = q ? rows.filter((r) => redeCorretorRowMatchesBusca(r, q)) : rows
    return ordenarRedeCorretoresPorCodigo(base)
  }, [rows, busca])

  async function aprovar(id: string) {
    setAprovandoId(id)
    await aprovarRedeCorretor(id)
    setAprovandoId(null)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <RedeTabelaToolbarBusca
        value={busca}
        onChange={setBusca}
        placeholder="Pesquisar corretores…"
        ariaLabel="Pesquisar corretores"
      >
        {children}
      </RedeTabelaToolbarBusca>

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-stone-50">
            <tr className="border-b border-stone-200">
              <th className={redeTh}>Código</th>
              <th className={redeTh}>Nome / Razão social</th>
              <th className={redeTh}>CPF/CNPJ</th>
              <th className={redeTh}>CRECI</th>
              <th className={redeTh}>Atuação</th>
              <th className={redeTh}>Tipo</th>
              <th className={redeTh}>Contato</th>
              <th className={redeTh}>Banco</th>
              <th className={redeTh}>Status</th>
              <th className={`${redeTh} w-12`} />
            </tr>
          </thead>
          <tbody>
            {rowsFiltradas.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-sm text-stone-500">
                  {busca.trim()
                    ? 'Nenhum corretor encontrado para essa busca.'
                    : 'Nenhum corretor cadastrado ainda. Clique em “Novo Corretor” para adicionar o primeiro.'}
                </td>
              </tr>
            ) : (
              rowsFiltradas.map((row) => (
                <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50/70">
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-stone-900">
                    {row.n_corretor ?? '—'}
                  </td>
                  <td className="max-w-[14rem] px-3 py-2.5 text-stone-800">{row.nome}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-stone-700">
                    {row.cpf_cnpj?.trim() || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-stone-700">
                    {[row.creci_numero, row.creci_uf].filter(Boolean).join(' / ') || '—'}
                  </td>
                  <td className="max-w-[10rem] px-3 py-2.5 text-stone-700">
                    {(row.atuacao_ufs ?? []).length > 0
                      ? (row.atuacao_ufs ?? []).join(', ')
                      : '—'}
                    {(row.atuacao_cidades ?? []).length > 0 ? (
                      <div className="mt-0.5 text-[10px] text-stone-500">
                        {(row.atuacao_cidades ?? []).length} cidade
                        {(row.atuacao_cidades ?? []).length === 1 ? '' : 's'}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-stone-700">
                    {row.creci_tipo_registro
                      ? REDE_CORRETOR_TIPO_REGISTRO_LABEL[row.creci_tipo_registro]
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-stone-700">
                    <div className="flex flex-col gap-0.5">
                      <span>{row.email?.trim() || '—'}</span>
                      <span className="text-xs text-stone-500">{row.telefone?.trim() || ''}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-stone-700">
                    {labelBanco(row.conta_banco_codigo)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-stone-700">
                    {REDE_CORRETOR_STATUS_LABEL[row.status] ?? row.status}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-0.5">
                      {row.status === 'pendente' ? (
                        <button
                          type="button"
                          title="Aprovar cadastro"
                          disabled={aprovandoId === row.id}
                          onClick={() => void aprovar(row.id)}
                          className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        title="Editar ficha"
                        onClick={() => setModalRow(row)}
                        className="rounded-md p-1.5 text-stone-600 hover:bg-stone-200/80"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalRow !== undefined ? (
        <RedeCorretorFichaModal
          row={modalRow}
          onClose={() => setModalRow(undefined)}
        />
      ) : null}
    </div>
  )
}
