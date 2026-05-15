import { useEffect, useState, useCallback, Fragment } from 'react'
import { supabase } from '../services/supabase'

const OPERACAO_CONFIG = {
  INSERT: { label: 'Inserção', cor: '#22c55e', bg: '#dcfce7' },
  UPDATE: { label: 'Edição', cor: '#f59e0b', bg: '#fef9c3' },
  DELETE: { label: 'Exclusão', cor: '#ef4444', bg: '#fee2e2' }
}

const PAGE_SIZE = 50

function escapeIlikePattern(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

export default function LogAuditoria() {
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [filtroModulo, setFiltroModulo] = useState('')
  const [filtroArea, setFiltroArea] = useState('')
  const [filtroOperacao, setFiltroOperacao] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtroBusca, setFiltroBusca] = useState('')
  const [erroFetch, setErroFetch] = useState(null)

  const buscarLogs = useCallback(async () => {
    setLoading(true)
    setErroFetch(null)
    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pagina * PAGE_SIZE, (pagina + 1) * PAGE_SIZE - 1)

    if (filtroModulo) query = query.eq('modulo', filtroModulo)
    if (filtroArea) query = query.ilike('area', `%${escapeIlikePattern(filtroArea)}%`)
    if (filtroOperacao) query = query.eq('operacao', filtroOperacao)
    if (filtroUsuario) query = query.ilike('usuario', `%${escapeIlikePattern(filtroUsuario)}%`)
    if (filtroDataInicio) query = query.gte('created_at', filtroDataInicio)
    if (filtroDataFim) query = query.lte('created_at', `${filtroDataFim}T23:59:59`)
    if (filtroBusca.trim()) {
      const q = escapeIlikePattern(filtroBusca.trim())
      query = query.or(
        `descricao.ilike.%${q}%,entidade.ilike.%${q}%,entidade_id.ilike.%${q}%`
      )
    }

    const { data, count, error } = await query
    if (error) {
      console.error('[LogAuditoria] Erro ao listar audit_log:', error)
      setErroFetch(error.message || String(error))
      setLogs([])
      setTotal(0)
    } else {
      setLogs(data || [])
      setTotal(count || 0)
    }
    setLoading(false)
  }, [
    pagina,
    filtroModulo,
    filtroArea,
    filtroOperacao,
    filtroUsuario,
    filtroDataInicio,
    filtroDataFim,
    filtroBusca
  ])

  useEffect(() => {
    buscarLogs()
  }, [buscarLogs])

  const limparFiltros = () => {
    setFiltroModulo('')
    setFiltroArea('')
    setFiltroOperacao('')
    setFiltroUsuario('')
    setFiltroDataInicio('')
    setFiltroDataFim('')
    setFiltroBusca('')
    setPagina(0)
  }

  const formatarData = (iso) => {
    const d = new Date(iso)
    return (
      d.toLocaleDateString('pt-BR') +
      ' ' +
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    )
  }

  const totalPaginas = Math.ceil(total / PAGE_SIZE)

  const inp = (extra = {}) => ({
    padding: '6px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    color: '#374151',
    background: '#fff',
    outline: 'none',
    ...extra
  })

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1a2e1a', margin: 0 }}>Log de Auditoria</h1>
        <p style={{ color: '#6b7280', fontSize: 13, margin: '4px 0 0' }}>
          Rastreio completo de inserções, edições e exclusões realizadas na plataforma
        </p>
      </div>

      {erroFetch && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            fontSize: 13
          }}
        >
          Não foi possível carregar o log: {erroFetch}. Confira o console, as policies RLS e se a migração{' '}
          <code style={{ fontSize: 12 }}>supabase-log-auditoria.sql</code> foi executada no projeto Supabase.
        </div>
      )}

      <ResumoContadores />

      <div
        style={{
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <input
          placeholder="Buscar por descrição, entidade ou ID..."
          value={filtroBusca}
          onChange={(e) => {
            setFiltroBusca(e.target.value)
            setPagina(0)
          }}
          style={inp({ flex: '1 1 240px' })}
        />
        <select
          value={filtroModulo}
          onChange={(e) => {
            setFiltroModulo(e.target.value)
            setPagina(0)
          }}
          style={inp()}
        >
          <option value="">Todos os módulos</option>
          {['Planejamento', 'Carômetro', 'Indicadores', 'Cadastros', 'Workload'].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          placeholder="Área..."
          value={filtroArea}
          onChange={(e) => {
            setFiltroArea(e.target.value)
            setPagina(0)
          }}
          style={inp({ width: 140 })}
        />
        <select
          value={filtroOperacao}
          onChange={(e) => {
            setFiltroOperacao(e.target.value)
            setPagina(0)
          }}
          style={inp()}
        >
          <option value="">Todas as operações</option>
          <option value="INSERT">Inserção</option>
          <option value="UPDATE">Edição</option>
          <option value="DELETE">Exclusão</option>
        </select>
        <input
          placeholder="Usuário..."
          value={filtroUsuario}
          onChange={(e) => {
            setFiltroUsuario(e.target.value)
            setPagina(0)
          }}
          style={inp({ width: 140 })}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="date"
            value={filtroDataInicio}
            onChange={(e) => {
              setFiltroDataInicio(e.target.value)
              setPagina(0)
            }}
            style={inp({ width: 140 })}
          />
          <span style={{ color: '#9ca3af', fontSize: 12 }}>até</span>
          <input
            type="date"
            value={filtroDataFim}
            onChange={(e) => {
              setFiltroDataFim(e.target.value)
              setPagina(0)
            }}
            style={inp({ width: 140 })}
          />
        </div>
        <button
          type="button"
          onClick={limparFiltros}
          style={{
            padding: '6px 16px',
            background: '#fff',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
            color: '#374151'
          }}
        >
          Limpar filtros
        </button>
      </div>

      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 10 }}>
        {loading ? 'Carregando...' : `${total.toLocaleString('pt-BR')} registro(s) encontrado(s)`}
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
              {['Data e Hora', 'Usuário', 'Módulo', 'Área', 'Entidade', 'Operação', 'Descrição', 'Detalhes'].map(
                (col) => (
                  <th
                    key={col}
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#374151',
                      fontSize: 12,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {col}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
                  Carregando...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
                  Nenhum registro encontrado
                </td>
              </tr>
            ) : (
              logs.map((log, i) => {
                const op = OPERACAO_CONFIG[log.operacao] || {}
                const aberto = expandido === log.id
                return (
                  <Fragment key={log.id}>
                    <tr
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        background: i % 2 === 0 ? '#fff' : '#fafafa'
                      }}
                    >
                      <td
                        style={{
                          padding: '8px 12px',
                          whiteSpace: 'nowrap',
                          fontFamily: 'monospace',
                          fontSize: 12
                        }}
                      >
                        {formatarData(log.created_at)}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {log.is_admin && (
                            <span
                              style={{
                                fontSize: 10,
                                background: '#1e3a1e',
                                color: '#fff',
                                borderRadius: 4,
                                padding: '1px 5px'
                              }}
                            >
                              ADMIN
                            </span>
                          )}
                          {log.usuario}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#6b7280' }}>{log.modulo}</td>
                      <td style={{ padding: '8px 12px', color: '#6b7280' }}>{log.area || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          style={{
                            background: '#f3f4f6',
                            borderRadius: 4,
                            padding: '2px 7px',
                            fontSize: 11
                          }}
                        >
                          {log.entidade}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          style={{
                            background: op.bg,
                            color: op.cor,
                            borderRadius: 12,
                            padding: '2px 10px',
                            fontSize: 11,
                            fontWeight: 600
                          }}
                        >
                          {op.label}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: '#374151', maxWidth: 320 }}>
                        <span
                          title={log.descricao}
                          style={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {log.descricao || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {(log.valor_anterior != null || log.valor_novo != null) && (
                          <button
                            type="button"
                            onClick={() => setExpandido(aberto ? null : log.id)}
                            style={{
                              background: 'none',
                              border: '1px solid #d1d5db',
                              borderRadius: 4,
                              cursor: 'pointer',
                              padding: '2px 10px',
                              fontSize: 11,
                              color: '#374151'
                            }}
                          >
                            {aberto ? 'Fechar' : 'Ver diff'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {aberto && (
                      <tr>
                        <td
                          colSpan={8}
                          style={{
                            background: '#f8f9fa',
                            padding: '12px 24px',
                            borderBottom: '1px solid #e5e7eb'
                          }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            {log.valor_anterior !== null && log.valor_anterior !== undefined && (
                              <div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: '#6b7280',
                                    marginBottom: 6
                                  }}
                                >
                                  ANTES
                                </div>
                                <pre
                                  style={{
                                    background: '#fee2e2',
                                    border: '1px solid #fca5a5',
                                    borderRadius: 6,
                                    padding: 10,
                                    fontSize: 11,
                                    overflow: 'auto',
                                    margin: 0,
                                    maxHeight: 200
                                  }}
                                >
                                  {JSON.stringify(log.valor_anterior, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.valor_novo !== null && log.valor_novo !== undefined && (
                              <div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: '#6b7280',
                                    marginBottom: 6
                                  }}
                                >
                                  DEPOIS
                                </div>
                                <pre
                                  style={{
                                    background: '#dcfce7',
                                    border: '1px solid #86efac',
                                    borderRadius: 6,
                                    padding: 10,
                                    fontSize: 11,
                                    overflow: 'auto',
                                    margin: 0,
                                    maxHeight: 200
                                  }}
                                >
                                  {JSON.stringify(log.valor_novo, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                          {log.entidade_id && (
                            <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af' }}>
                              ID do registro:{' '}
                              <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>
                                {log.entidade_id}
                              </code>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button
            type="button"
            disabled={pagina === 0}
            onClick={() => setPagina((p) => p - 1)}
            style={{
              padding: '6px 16px',
              background: pagina === 0 ? '#f3f4f6' : '#fff',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              cursor: pagina === 0 ? 'default' : 'pointer',
              fontSize: 13,
              color: pagina === 0 ? '#9ca3af' : '#374151'
            }}
          >
            ← Anterior
          </button>
          <span style={{ padding: '6px 12px', fontSize: 13, color: '#374151' }}>
            Página {pagina + 1} de {totalPaginas}
          </span>
          <button
            type="button"
            disabled={pagina >= totalPaginas - 1}
            onClick={() => setPagina((p) => p + 1)}
            style={{
              padding: '6px 16px',
              background: pagina >= totalPaginas - 1 ? '#f3f4f6' : '#fff',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              cursor: pagina >= totalPaginas - 1 ? 'default' : 'pointer',
              fontSize: 13,
              color: pagina >= totalPaginas - 1 ? '#9ca3af' : '#374151'
            }}
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  )
}

function ResumoContadores() {
  const [counts, setCounts] = useState({ INSERT: 0, UPDATE: 0, DELETE: 0 })

  useEffect(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const iso = hoje.toISOString()
    Promise.all(
      ['INSERT', 'UPDATE', 'DELETE'].map((op) =>
        supabase.from('audit_log').select('id', { count: 'exact', head: true }).eq('operacao', op).gte('created_at', iso)
      )
    ).then((results) => {
      const comErro = results.find((r) => r.error)
      if (comErro?.error) {
        console.error('[LogAuditoria] Erro nos contadores (audit_log):', comErro.error)
      }
      setCounts({
        INSERT: results[0].error ? 0 : results[0].count || 0,
        UPDATE: results[1].error ? 0 : results[1].count || 0,
        DELETE: results[2].error ? 0 : results[2].count || 0
      })
    })
  }, [])

  const cfg = {
    INSERT: { label: 'Inserções hoje', icon: '＋', cor: '#22c55e', bg: '#dcfce7' },
    UPDATE: { label: 'Edições hoje', icon: '✎', cor: '#f59e0b', bg: '#fef9c3' },
    DELETE: { label: 'Exclusões hoje', icon: '✕', cor: '#ef4444', bg: '#fee2e2' }
  }

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
      {['INSERT', 'UPDATE', 'DELETE'].map((op) => (
        <div
          key={op}
          style={{
            flex: 1,
            background: cfg[op].bg,
            border: `1px solid ${cfg[op].cor}30`,
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}
        >
          <span style={{ fontSize: 20, color: cfg[op].cor }}>{cfg[op].icon}</span>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: cfg[op].cor }}>{counts[op]}</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>{cfg[op].label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
