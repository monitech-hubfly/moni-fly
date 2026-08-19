'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check } from 'lucide-react'
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca'
import { redeTh } from '@/app/rede-franqueados/rede-ui'
import { aprovarRedeCorretor } from '@/app/rede-franqueados/rede-corretores-actions'
import { RedeCorretorFichaModal } from '@/components/RedeCorretorFichaModal'
import { MoniTabelaScrollSync } from '@/components/MoniTabelaScrollSync'
import { labelBanco } from '@/lib/bancos-br'
import {
  ordenarRedeCorretoresPorCodigo,
  redeCorretorRowMatchesBusca,
  filtrarLinhasEmBrancoRedeCorretores,
  REDE_CORRETOR_CONTA_TIPO_LABEL,
  REDE_CORRETOR_PIX_TIPO_LABEL,
  REDE_CORRETOR_STATUS_LABEL,
  REDE_CORRETOR_TIPO_REGISTRO_LABEL,
  type RedeCorretorRow,
} from '@/lib/rede-corretores'

type Props = {
  rows: RedeCorretorRow[]
  children?: ReactNode
  solicitarCriacao?: number
}

const td = 'px-3 py-2.5 text-stone-700'
const tdNowrap = `${td} whitespace-nowrap`
const thGroup =
  'border-b border-stone-200 bg-stone-100/90 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-stone-600'

function dash(s: string | null | undefined): string {
  const t = String(s ?? '').trim()
  return t || '—'
}

function fmtDataBr(iso: string | null | undefined): string {
  const s = String(iso ?? '').slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return dash(s)
  return `${m[3]}/${m[2]}/${m[1]}`
}

function labelCidades(row: RedeCorretorRow): string {
  const list = row.atuacao_cidades ?? []
  if (list.length === 0) return '—'
  return list.map((c) => (c.uf ? `${c.nome}/${c.uf}` : c.nome)).join(', ')
}

export function RedeCorretoresTabelaComBusca({ rows, children, solicitarCriacao = 0 }: Props) {
  const [busca, setBusca] = useState('')
  const [modalRow, setModalRow] = useState<RedeCorretorRow | null | undefined>(undefined)
  const [aprovandoId, setAprovandoId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (solicitarCriacao > 0) setModalRow(null)
  }, [solicitarCriacao])

  const rowsComCadastro = useMemo(() => filtrarLinhasEmBrancoRedeCorretores(rows), [rows])

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim()
    const base = q ? rowsComCadastro.filter((r) => redeCorretorRowMatchesBusca(r, q)) : rowsComCadastro
    return ordenarRedeCorretoresPorCodigo(base)
  }, [rowsComCadastro, busca])

  async function aprovar(id: string) {
    setAprovandoId(id)
    await aprovarRedeCorretor(id)
    setAprovandoId(null)
    router.refresh()
  }

  const colCount = 21

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

      <MoniTabelaScrollSync className="rounded-lg border border-stone-200 bg-white shadow-sm">
        <table className="min-w-[2400px] border-collapse text-left text-sm">
          <thead>
            <tr>
              <th colSpan={3} className={thGroup}>
                Identificação
              </th>
              <th colSpan={4} className={`${thGroup} border-l border-stone-200`}>
                CRECI
              </th>
              <th colSpan={2} className={`${thGroup} border-l border-stone-200`}>
                Atuação
              </th>
              <th colSpan={2} className={`${thGroup} border-l border-stone-200`}>
                Contato
              </th>
              <th colSpan={6} className={`${thGroup} border-l border-stone-200`}>
                Dados bancários
              </th>
              <th colSpan={3} className={`${thGroup} border-l border-stone-200`}>
                Cadastro
              </th>
              <th rowSpan={2} className={`${thGroup} w-12 border-l border-stone-200`}>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className={redeTh}>Código</th>
              <th className={redeTh}>Nome / Razão social</th>
              <th className={redeTh}>CPF/CNPJ</th>
              <th className={`${redeTh} border-l border-stone-200`}>Número</th>
              <th className={redeTh}>UF</th>
              <th className={redeTh}>Tipo</th>
              <th className={redeTh}>Validade</th>
              <th className={`${redeTh} border-l border-stone-200`}>UFs</th>
              <th className={redeTh}>Cidades</th>
              <th className={`${redeTh} border-l border-stone-200`}>E-mail</th>
              <th className={redeTh}>Telefone</th>
              <th className={`${redeTh} border-l border-stone-200`}>Banco</th>
              <th className={redeTh}>Agência</th>
              <th className={redeTh}>Conta</th>
              <th className={redeTh}>Tipo</th>
              <th className={redeTh}>Titular</th>
              <th className={redeTh}>Pix</th>
              <th className={`${redeTh} border-l border-stone-200`}>Status</th>
              <th className={redeTh}>Observações</th>
              <th className={redeTh}>Link simulador</th>
            </tr>
          </thead>
          <tbody>
            {rowsFiltradas.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="px-3 py-8 text-center text-sm text-stone-500">
                  {busca.trim()
                    ? 'Nenhum corretor encontrado para essa busca.'
                    : 'Nenhum corretor cadastrado ainda. Clique em “Novo Corretor” para adicionar o primeiro.'}
                </td>
              </tr>
            ) : (
              rowsFiltradas.map((row) => {
                const pixTipo = row.conta_pix_tipo
                  ? REDE_CORRETOR_PIX_TIPO_LABEL[row.conta_pix_tipo]
                  : ''
                const pix = [pixTipo, row.conta_pix_chave?.trim()].filter(Boolean).join(' · ')
                return (
                  <tr key={row.id} className="border-b border-stone-100 hover:bg-stone-50/70">
                    <td className={`${tdNowrap} font-medium text-stone-900`}>
                      {dash(row.n_corretor)}
                    </td>
                    <td className={`${td} min-w-[12rem] text-stone-800`}>{dash(row.nome)}</td>
                    <td className={tdNowrap}>{dash(row.cpf_cnpj)}</td>
                    <td className={`${tdNowrap} border-l border-stone-100`}>
                      {dash(row.creci_numero)}
                    </td>
                    <td className={tdNowrap}>{dash(row.creci_uf)}</td>
                    <td className={`${td} min-w-[10rem]`}>
                      {row.creci_tipo_registro
                        ? REDE_CORRETOR_TIPO_REGISTRO_LABEL[row.creci_tipo_registro]
                        : '—'}
                    </td>
                    <td className={tdNowrap}>{fmtDataBr(row.creci_validade)}</td>
                    <td className={`${tdNowrap} border-l border-stone-100`}>
                      {(row.atuacao_ufs ?? []).length > 0
                        ? (row.atuacao_ufs ?? []).join(', ')
                        : '—'}
                    </td>
                    <td className={`${td} min-w-[14rem]`}>{labelCidades(row)}</td>
                    <td className={`${td} min-w-[12rem] border-l border-stone-100`}>
                      {dash(row.email)}
                    </td>
                    <td className={tdNowrap}>{dash(row.telefone)}</td>
                    <td className={`${tdNowrap} border-l border-stone-100`}>
                      {labelBanco(row.conta_banco_codigo)}
                    </td>
                    <td className={tdNowrap}>{dash(row.conta_agencia)}</td>
                    <td className={tdNowrap}>{dash(row.conta_numero)}</td>
                    <td className={tdNowrap}>
                      {row.conta_tipo ? REDE_CORRETOR_CONTA_TIPO_LABEL[row.conta_tipo] : '—'}
                    </td>
                    <td className={`${td} min-w-[10rem]`}>{dash(row.conta_titular)}</td>
                    <td className={`${td} min-w-[12rem]`}>{dash(pix)}</td>
                    <td className={`${tdNowrap} border-l border-stone-100`}>
                      {REDE_CORRETOR_STATUS_LABEL[row.status] ?? row.status}
                    </td>
                    <td className={`${td} min-w-[12rem]`}>{dash(row.observacoes)}</td>
                    <td className={`${td} min-w-[12rem]`}>
                      {row.link_simulador?.trim() ? (
                        <a
                          href={row.link_simulador}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-[var(--moni-navy-800)] underline-offset-2 hover:underline"
                        >
                          {row.link_simulador}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`${td} border-l border-stone-100`}>
                      <div className="flex items-center gap-0.5">
                        {row.status === 'pendente' ? (
                          <button
                            type="button"
                            title="Aprovar cadastro"
                            disabled={aprovandoId === row.id}
                            onClick={() => void aprovar(row.id)}
                            className="rounded-md p-1.5 text-[var(--moni-green-800)] hover:bg-[var(--moni-surface-100)] disabled:opacity-50"
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
                )
              })
            )}
          </tbody>
        </table>
      </MoniTabelaScrollSync>

      {modalRow !== undefined ? (
        <RedeCorretorFichaModal
          row={modalRow}
          onClose={() => setModalRow(undefined)}
        />
      ) : null}
    </div>
  )
}
