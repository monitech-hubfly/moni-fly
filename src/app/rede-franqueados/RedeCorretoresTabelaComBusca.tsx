'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, Check, Maximize2, Minimize2, Pencil } from 'lucide-react'
import { RedeTabelaToolbarBusca } from '@/app/rede-franqueados/RedeTabelaToolbarBusca'
import { redeTh } from '@/app/rede-franqueados/rede-ui'
import { aprovarRedeCorretor, arquivarRedeCorretor } from '@/app/rede-franqueados/rede-corretores-actions'
import { RedeCorretorFichaModal } from '@/components/RedeCorretorFichaModal'
import { MoniTabelaScrollSync } from '@/components/MoniTabelaScrollSync'
import { labelBanco } from '@/lib/bancos-br'
import { useDebounce } from '@/hooks/useDebounce'
import {
  ordenarRedeCorretoresPorCodigo,
  filtrarLinhasEmBrancoRedeCorretores,
  redeCorretorRowMatchesBusca,
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
  'border-b border-stone-200 bg-[var(--moni-surface-0)] px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-stone-600'

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

const MAX_LINHAS_LISTA = 3

function BotaoMaisLinhas({
  aberto,
  restantes,
  singular,
  plural,
  onToggle,
}: {
  aberto: boolean
  restantes: number
  singular: string
  plural: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className="mt-0.5 inline-flex min-h-[28px] w-fit items-center gap-1 rounded-md px-1 py-0.5 text-[10px] font-semibold text-[var(--moni-navy-800)] underline-offset-2 hover:underline"
      aria-expanded={aberto}
    >
      {aberto ? (
        <>
          <Minimize2 className="h-3 w-3 shrink-0" aria-hidden />
          Minimizar
        </>
      ) : (
        <>
          <Maximize2 className="h-3 w-3 shrink-0" aria-hidden />
          +{restantes} {restantes === 1 ? singular : plural}
        </>
      )}
    </button>
  )
}

function EmpreendimentosVinculadosCell({
  links,
}: {
  links: NonNullable<RedeCorretorRow['links_jornada']>
}) {
  const [aberto, setAberto] = useState(false)
  if (links.length === 0) return <span className="text-[var(--moni-text-tertiary)]">—</span>
  const precisa = links.length > MAX_LINHAS_LISTA
  const visiveis = aberto || !precisa ? links : links.slice(0, MAX_LINHAS_LISTA)
  return (
    <div className="flex min-w-0 max-w-[min(18rem,100%)] flex-col gap-1.5 text-xs leading-snug text-[var(--moni-text-secondary)]">
      {visiveis.map((link) => (
        <div key={link.empreendimentoId} className="min-w-0">
          <div className="break-words">{link.nome}</div>
          {link.url ? (
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="block break-all text-[11px] leading-snug text-[var(--moni-navy-800)] underline-offset-2 hover:underline"
            >
              {link.url}
            </a>
          ) : (
            <p className="text-[11px] text-[var(--moni-text-tertiary)]">Jornada ainda não disponível</p>
          )}
        </div>
      ))}
      {precisa ? (
        <BotaoMaisLinhas
          aberto={aberto}
          restantes={links.length - MAX_LINHAS_LISTA}
          singular="empreendimento"
          plural="empreendimentos"
          onToggle={() => setAberto((atual) => !atual)}
        />
      ) : null}
    </div>
  )
}

function linhasCidades(row: RedeCorretorRow): string[] {
  return (row.atuacao_cidades ?? [])
    .map((cidade) => {
      const nome = String(cidade.nome ?? '').trim()
      const uf = String(cidade.uf ?? '').trim()
      if (uf && nome) return `${uf} - ${nome}`
      return nome || uf
    })
    .filter(Boolean)
}

function CidadesAtuacaoCell({ row }: { row: RedeCorretorRow }) {
  const [aberto, setAberto] = useState(false)
  const linhas = linhasCidades(row)
  if (linhas.length === 0) return <span className="text-[var(--moni-text-tertiary)]">—</span>
  const precisa = linhas.length > MAX_LINHAS_LISTA
  const visiveis = aberto || !precisa ? linhas : linhas.slice(0, MAX_LINHAS_LISTA)
  return (
    <div className="flex min-w-0 max-w-[min(16rem,100%)] flex-col gap-0.5 text-xs leading-snug text-[var(--moni-text-secondary)]">
      {visiveis.map((linha, i) => (
        <div key={`${i}-${linha}`} className="block min-w-0 break-words">
          {linha}
        </div>
      ))}
      {precisa ? (
        <BotaoMaisLinhas
          aberto={aberto}
          restantes={linhas.length - MAX_LINHAS_LISTA}
          singular="cidade"
          plural="cidades"
          onToggle={() => setAberto((atual) => !atual)}
        />
      ) : null}
    </div>
  )
}

export function RedeCorretoresTabelaComBusca({ rows, children, solicitarCriacao = 0 }: Props) {
  const [busca, setBusca] = useState('')
  const debouncedBusca = useDebounce(busca);
  const [modalRow, setModalRow] = useState<RedeCorretorRow | null | undefined>(undefined)
  const [aprovandoId, setAprovandoId] = useState<string | null>(null)
  const [arquivandoId, setArquivandoId] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (solicitarCriacao > 0) setModalRow(null)
  }, [solicitarCriacao])

  const rowsComCadastro = useMemo(() => filtrarLinhasEmBrancoRedeCorretores(rows), [rows])

  const rowsFiltradas = useMemo(() => {
    const q = debouncedBusca.trim()
    const base = q ? rowsComCadastro.filter((r) => redeCorretorRowMatchesBusca(r, q)) : rowsComCadastro
    return ordenarRedeCorretoresPorCodigo(base)
  }, [rowsComCadastro, debouncedBusca])

  async function aprovar(id: string) {
    setAprovandoId(id)
    setAviso(null)
    const r = await aprovarRedeCorretor(id)
    setAprovandoId(null)
    setAviso(r.ok ? r.mensagem : r.error)
    router.refresh()
  }

  async function arquivar(id: string, nome: string) {
    if (!confirm(`Arquivar ${nome}? O status passa para inativo.`)) return
    setArquivandoId(id)
    setAviso(null)
    const r = await arquivarRedeCorretor(id)
    setArquivandoId(null)
    setAviso(r.ok ? 'Corretor arquivado. Status: inativo.' : r.error)
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

      {aviso ? (
        <p className="text-sm text-[var(--moni-text-secondary)]" role="status">
          {aviso}
        </p>
      ) : null}

      <MoniTabelaScrollSync className="rounded-lg border border-stone-200 bg-[var(--moni-surface-0)] shadow-sm">
        <table className="moni-tabela-corretores min-w-[2400px] border-collapse bg-[var(--moni-surface-0)] text-left text-sm">
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
            <tr className="border-b border-stone-200 bg-[var(--moni-surface-0)]">
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
              <th className={redeTh}>Empreendimentos vinculados</th>
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
                  <tr key={row.id} className="border-b border-stone-100">
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
                    <td className={`${td} min-w-[14rem]`}>
                      <CidadesAtuacaoCell row={row} />
                    </td>
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
                    <td className={`${td} min-w-[18rem] max-w-[22rem]`}>
                      <EmpreendimentosVinculadosCell links={row.links_jornada ?? []} />
                    </td>
                    <td className={`${td} border-l border-stone-100`}>
                      <div className="flex items-center gap-0.5">
                        {row.status === 'pendente' ? (
                          <button
                            type="button"
                            title="Aprovar cadastro"
                            disabled={aprovandoId === row.id}
                            onClick={() => void aprovar(row.id)}
                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-[var(--moni-green-800)] hover:bg-[var(--moni-surface-100)] disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        ) : null}
                        {row.status !== 'inativo' ? (
                          <button
                            type="button"
                            title="Arquivar"
                            disabled={arquivandoId === row.id}
                            onClick={() => void arquivar(row.id, row.nome)}
                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-[var(--moni-text-secondary)] hover:bg-[var(--moni-surface-100)] disabled:opacity-50"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          title="Editar ficha"
                          onClick={() => setModalRow(row)}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-stone-600 hover:bg-stone-200/80"
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
