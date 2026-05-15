// @ts-nocheck
'use client';

import { useCallback, useEffect, useMemo, useState, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'

const NOMES_AREAS_ALVO = ['Produto', 'Projetos - Modelo Virtual']

const PALETA_CASAS = [
  { bg: '#E6F1FB', border: '#B5D4F4' },
  { bg: '#F3EEFE', border: '#AFA9EC' },
  { bg: '#FEF3E6', border: '#EF9F27' },
  { bg: '#E6FBF3', border: '#1D9E75' },
  { bg: '#FEE6E6', border: '#E24B4A' },
  { bg: '#F3F3FE', border: '#7F77DD' },
  { bg: '#FEFCE6', border: '#BA7517' },
  { bg: '#F1EFE8', border: '#888780' }
]

function getCorCasa(index) {
  return PALETA_CASAS[index % PALETA_CASAS.length]
}

function getCorProgresso(pct) {
  if (pct === null) return { text: 'var(--color-text-secondary)', bar: '#D3D1C7' }
  if (pct === 100) return { text: '#0A5C38', bar: '#0F7A4A' }
  if (pct >= 75) return { text: '#2A5A00', bar: '#5A9A1A' }
  if (pct >= 50) return { text: '#7A4200', bar: '#C07800' }
  return { text: '#8B1A1A', bar: '#B01A1A' }
}

function statusCronogramaConcluido(status) {
  const x = String(status ?? '')
    .toLowerCase()
    .trim()
  return (
    x === 'concluido' ||
    x === 'concluído' ||
    x === 'realizado' ||
    x === 'feito' ||
    x === 'done' ||
    x === 'completo' ||
    x === 'finalizado'
  )
}

/**
 * Agrupa casas pelo nome exibido (normalizado), guardando todos os ids.
 */
function agruparCasasPorNome(todasCasas) {
  const casasAgrupadas = []
  const nomesSeen = {}
  for (const casa of todasCasas || []) {
    const nomeNorm = String(casa.nome ?? '')
      .trim()
      .toLowerCase()
    if (!nomeNorm) continue
    if (nomesSeen[nomeNorm] !== undefined) {
      casasAgrupadas[nomesSeen[nomeNorm]].ids.push(casa.id)
    } else {
      nomesSeen[nomeNorm] = casasAgrupadas.length
      casasAgrupadas.push({
        nome: String(casa.nome).trim() || casa.nome,
        ids: [casa.id]
      })
    }
  }
  return casasAgrupadas
}

export default function Page() {
  const supabase = createClient()
  const [areasAlvo, setAreasAlvo] = useState([])
  const [filtroArea, setFiltroArea] = useState('ambos')
  /** Filtro por nome exibido da casa agrupada; vazio = todas */
  const [casaFiltro, setCasaFiltro] = useState('')

  const [casas, setCasas] = useState([])
  const [tarefas, setTarefas] = useState([])
  const [acoes, setAcoes] = useState([])
  const [ganttPlanejamento, setGanttPlanejamento] = useState([])
  const [cronograma, setCronograma] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const areaIdsFiltrados = useMemo(() => {
    if (filtroArea === 'ambos') return areasAlvo.map(a => a.id).filter(Boolean)
    const nome = filtroArea === 'produto' ? 'Produto' : 'Projetos - Modelo Virtual'
    return areasAlvo.filter(a => a.nome === nome).map(a => a.id).filter(Boolean)
  }, [areasAlvo, filtroArea])

  const areasOrdenadasExibicao = useMemo(() => {
    const order = ['Produto', 'Projetos - Modelo Virtual']
    return order
      .map(nome => areasAlvo.find(a => a.nome === nome))
      .filter(Boolean)
      .filter(a => areaIdsFiltrados.includes(a.id))
  }, [areasAlvo, areaIdsFiltrados])

  const casasAgrupadas = useMemo(() => {
    return agruparCasasPorNome(casas || [])
  }, [casas])

  const casasVisiveis = useMemo(() => {
    if (!casaFiltro) return casasAgrupadas
    return casasAgrupadas.filter(cg => cg.nome === casaFiltro)
  }, [casasAgrupadas, casaFiltro])

  const tarefasVisiveis = useMemo(
    () => tarefas.filter(t => areaIdsFiltrados.includes(t.area_id)),
    [tarefas, areaIdsFiltrados]
  )

  const tarefasComGantt = useMemo(() => {
    const acaoIdsComGantt = new Set(
      (ganttPlanejamento || []).filter(g => g.casa_id != null).map(g => String(g.acao_id))
    )
    return tarefasVisiveis.filter(t =>
      acoes.some(a => a.tarefa_id === t.id && acaoIdsComGantt.has(String(a.id)))
    )
  }, [tarefasVisiveis, ganttPlanejamento, acoes])

  const totalAtividades = useMemo(
    () =>
      tarefasComGantt.reduce((sum, t) => sum + acoes.filter(a => a.tarefa_id === t.id).length, 0),
    [tarefasComGantt, acoes]
  )

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const { data: areasData, error: errAreas } = await supabase
          .from('areas')
          .select('id, nome')
          .in('nome', NOMES_AREAS_ALVO)
        if (errAreas) throw errAreas
        if (cancel) return
        setAreasAlvo(areasData || [])

        const areaIds = (areasData || []).map(a => a.id).filter(Boolean)
        if (areaIds.length === 0) return

        const { data: tarefasData, error: errTar } = await supabase
          .from('tarefas')
          .select('id, nome, area_id, ordem')
          .in('area_id', areaIds)
          .order('ordem', { ascending: true })
        if (errTar) throw errTar

        const tIds = (tarefasData || []).map(t => t.id).filter(Boolean)
        let acoesData = []
        if (tIds.length > 0) {
          const { data: ar, error: errA } = await supabase
            .from('acoes')
            .select('id, nome, tarefa_id, tipo_atividade, ordem')
            .in('tarefa_id', tIds)
            .order('ordem', { ascending: true })
          if (errA) throw errA
          acoesData = ar || []
        }

        if (cancel) return
        setTarefas(tarefasData || [])
        setAcoes(acoesData)
      } catch (e) {
        if (!cancel) setError(e?.message || String(e))
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (casaFiltro && !casasAgrupadas.some(cg => cg.nome === casaFiltro)) {
      setCasaFiltro('')
    }
  }, [casasAgrupadas, casaFiltro])

  useEffect(() => {
    if (acoes.length === 0) return
    let cancel = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const acaoIds = acoes.map(a => a.id).filter(Boolean)
        if (acaoIds.length === 0) return

        const { data: ganttData, error: errG } = await supabase
          .from('gantt_planejamento')
          .select('id, acao_id, casa_id, periodo_id, semana_ano_inicio, criado_em')
          .in('acao_id', acaoIds)
          .not('casa_id', 'is', null)
        if (errG) throw errG

        const casaIdsUnicos = [...new Set((ganttData || []).map(g => g.casa_id).filter(Boolean).map(String))]
        let casasData = []
        if (casaIdsUnicos.length > 0) {
          const { data: cd, error: errCasas } = await supabase
            .from('casas')
            .select('id, nome, area_id')
            .in('id', casaIdsUnicos)
            .order('nome', { ascending: true })
          if (errCasas) throw errCasas
          casasData = cd || []
        }

        const { data: cronData, error: errC } = await supabase
          .from('cronograma')
          .select('id, acao_id, status, planejamento_id, periodo_id, semana_ano')
          .in('acao_id', acaoIds)
        if (errC) throw errC

        if (cancel) return
        setCasas(casasData)
        setGanttPlanejamento(ganttData || [])
        setCronograma(cronData || [])
      } catch (e) {
        if (!cancel) setError(e?.message || String(e))
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [acoes])

  const medirProgresso = useCallback(
    (tarefaId, casaGroup, tipoFiltro = null) => {
      const tipoNorm = tipoFiltro == null ? null : String(tipoFiltro).toLowerCase().trim()
      const acoesDaTarefa = acoes.filter(a => {
        if (a.tarefa_id !== tarefaId) return false
        if (tipoNorm == null) return true
        return String(a.tipo_atividade ?? '').toLowerCase().trim() === tipoNorm
      })

      const total = acoesDaTarefa.length
      if (total === 0) return { pct: null, concluidas: 0, total: 0 }

      const idsSet = new Set((casaGroup.ids || []).filter(Boolean).map(String))
      const acaoIdsSet = new Set(acoesDaTarefa.map(a => String(a.id)))

      const ganttDaCasa = (ganttPlanejamento || []).filter(g => {
        if (!acaoIdsSet.has(String(g.acao_id))) return false
        if (!g.casa_id) return false
        return idsSet.has(String(g.casa_id))
      })
      if (ganttDaCasa.length === 0) return { pct: null, concluidas: 0, total }

      const maisRecente = {}
      for (const g of ganttDaCasa) {
        const aid = String(g.acao_id)
        const cur = maisRecente[aid]
        const semG = Number(g.semana_ano_inicio ?? 0)
        const semCur = Number(cur?.semana_ano_inicio ?? 0)
        if (!cur || semG > semCur) {
          maisRecente[aid] = g
          continue
        }
        if (semG === semCur) {
          const tCur = cur?.criado_em ? new Date(cur.criado_em).getTime() : 0
          const tG = g?.criado_em ? new Date(g.criado_em).getTime() : 0
          if (tG > tCur) maisRecente[aid] = g
        }
      }

      const planejamentosRecentesIds = new Set(Object.values(maisRecente).map(g => String(g.id)))
      const acoesConcluidasSet = new Set()

      for (const c of cronograma || []) {
        if (!acaoIdsSet.has(String(c.acao_id))) continue
        if (!statusCronogramaConcluido(c.status)) continue

        const pid = c?.planejamento_id
        if (pid && planejamentosRecentesIds.has(String(pid))) {
          acoesConcluidasSet.add(String(c.acao_id))
        } else if (!pid) {
          const temVinculo = (cronograma || []).some(
            x =>
              String(x.acao_id) === String(c.acao_id) &&
              x.planejamento_id &&
              planejamentosRecentesIds.has(String(x.planejamento_id))
          )
          if (!temVinculo) acoesConcluidasSet.add(String(c.acao_id))
        }
      }

      const n = acoesConcluidasSet.size
      const pct = Math.min(100, Math.round((n / total) * 100))
      return { pct: n === 0 && ganttDaCasa.length === 0 ? null : pct, concluidas: n, total }
    },
    [acoes, cronograma, ganttPlanejamento]
  )

  const renderCelula = (casaGroup, med, compacto = false) => {
    const pct = med.pct
    const cor = getCorProgresso(pct)
    return (
      <td
        key={casaGroup.nome}
        style={{
          textAlign: 'center',
          padding: compacto ? '3px 4px' : '6px 4px',
          verticalAlign: 'middle'
        }}
      >
        {pct === null ? (
          <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>—</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: compacto ? 11 : 12, fontWeight: 500, color: cor.text }}>{pct}%</span>
            <div
              style={{
                width: '100%',
                height: 3,
                background: 'var(--color-border-tertiary)',
                borderRadius: 2,
                overflow: 'hidden'
              }}
            >
              <div style={{ width: `${pct}%`, height: '100%', background: cor.bar, borderRadius: 2 }} />
            </div>
            {!compacto && (
              <span style={{ fontSize: 8, color: 'var(--color-text-secondary)' }}>
                {med.concluidas}/{med.total} ativ.
              </span>
            )}
          </div>
        )}
      </td>
    )
  }

  const renderLinhasTarefa = tarefa => {
    const totalAcoes = acoes.filter(a => a.tarefa_id === tarefa.id).length
    return (
      <tr
        key={tarefa.id}
        style={{
          background: 'var(--color-background-primary)',
          borderBottom: '0.5px solid var(--color-border-tertiary)'
        }}
      >
        <td style={{ padding: '8px 10px' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{tarefa.nome}</div>
          <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {totalAcoes} atividades
          </div>
        </td>
        {casasVisiveis.map(casaGroup => {
          const med = medirProgresso(tarefa.id, casaGroup, null)
          return renderCelula(casaGroup, med)
        })}
      </tr>
    )
  }

  const calcularPctArea = (areaId, casaGroup) => {
    const tarefasDaArea = tarefasComGantt.filter(t => t.area_id === areaId)
    let totalConcluidas = 0
    let totalAtividadesArea = 0
    for (const t of tarefasDaArea) {
      const med = medirProgresso(t.id, casaGroup, null)
      totalConcluidas += med.concluidas
      totalAtividadesArea += acoes.filter(a => a.tarefa_id === t.id).length
    }
    if (totalAtividadesArea === 0) return null
    return Math.min(100, Math.round((totalConcluidas / totalAtividadesArea) * 100))
  }

  const renderLinhaProjeto = tarefa => {
    const totalAcoes = acoes.filter(a => a.tarefa_id === tarefa.id).length
    const temMod = acoes.some(
      a => a.tarefa_id === tarefa.id && String(a.tipo_atividade ?? '').toLowerCase().trim() === 'modelagem'
    )
    const temDoc = acoes.some(
      a => a.tarefa_id === tarefa.id && String(a.tipo_atividade ?? '').toLowerCase().trim() === 'documentacao'
    )

    return (
      <tr
        key={tarefa.id}
        style={{
          background: 'var(--color-background-primary)',
          borderBottom: '0.5px solid var(--color-border-tertiary)'
        }}
      >
        <td style={{ padding: '8px 10px' }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{tarefa.nome}</div>
          <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {totalAcoes} atividades
          </div>
        </td>
        {casasVisiveis.map(casaGroup => {
          const medGeral = medirProgresso(tarefa.id, casaGroup, null)
          const medMod = medirProgresso(tarefa.id, casaGroup, 'modelagem')
          const medDoc = medirProgresso(tarefa.id, casaGroup, 'documentacao')
          const pct = medGeral.pct
          const cor = getCorProgresso(pct)

          return (
            <td
              key={casaGroup.nome}
              style={{ textAlign: 'center', padding: '5px 4px', verticalAlign: 'middle' }}
            >
              {pct === null ? (
                <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>—</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: cor.text }}>{pct}%</span>
                  <div
                    style={{
                      width: '100%',
                      height: 3,
                      background: 'var(--color-border-tertiary)',
                      borderRadius: 2,
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ width: `${pct}%`, height: '100%', background: cor.bar, borderRadius: 2 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {temMod && medMod.pct !== null && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          padding: '1px 4px',
                          borderRadius: 3,
                          background: '#EAF3DE',
                          color: '#3B6D11',
                          border: '0.5px solid #C0DD97'
                        }}
                      >
                        Mod {medMod.pct}%
                      </span>
                    )}
                    {temDoc && medDoc.pct !== null && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          padding: '1px 4px',
                          borderRadius: 3,
                          background: '#EEEDFE',
                          color: '#3C3489',
                          border: '0.5px solid #AFA9EC'
                        }}
                      >
                        Doc {medDoc.pct}%
                      </span>
                    )}
                  </div>
                </div>
              )}
            </td>
          )
        })}
      </tr>
    )
  }

  return (
    <>
      <h1>Dashboard Casas Moní</h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.25rem', maxWidth: '720px' }}>
        Evolução acumulada dos comportamentos por casa — Produto e Projetos - Modelo Virtual
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          marginBottom: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Casa</span>
          <select
            value={casaFiltro}
            onChange={e => setCasaFiltro(e.target.value)}
            style={{
              fontSize: 13,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-primary)',
              minWidth: 140
            }}
          >
            <option value="">Todas as casas</option>
            {casasAgrupadas.map(cg => (
              <option key={cg.nome} value={cg.nome}>
                {cg.nome}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Área</span>
          <select
            value={filtroArea}
            onChange={e => setFiltroArea(e.target.value)}
            style={{
              fontSize: 13,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid var(--color-border-secondary)',
              background: 'var(--color-background-primary)',
              minWidth: 200
            }}
          >
            <option value="ambos">Produto + Projetos</option>
            <option value="produto">Produto</option>
            <option value="projetos">Projetos - Modelo Virtual</option>
          </select>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: '1rem',
          flexWrap: 'wrap',
          fontSize: 12,
          color: 'var(--color-text-secondary)'
        }}
      >
        <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>Progresso:</span>
        {[
          { cor: '#0F7A4A', label: '100% — Concluído' },
          { cor: '#5A9A1A', label: '≥75% — Quase lá' },
          { cor: '#C07800', label: '≥50% — Em andamento' },
          { cor: '#B01A1A', label: '<50% — Atrasado' },
          { cor: '#D3D1C7', label: '— Não iniciado' }
        ].map(({ cor, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: cor, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>

      {loading ? (
        <p>Carregando…</p>
      ) : casasAgrupadas.length === 0 ? (
        <p className="empty-state">
          Nenhuma casa cadastrada para as áreas Produto e Projetos - Modelo Virtual (ou ajuste o filtro de casa).
        </p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--color-border-tertiary)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 400 }}>
            <colgroup>
              <col style={{ width: 180 }} />
              {casasVisiveis.map(cg => (
                <col key={cg.nome} style={{ width: 85 }} />
              ))}
            </colgroup>

            <thead>
              {/* Linha 1 — "Comportamento" e "Casas" (fundo explícito em cada th para vencer App.css `th { background: ... }`) */}
              <tr>
                <th
                  rowSpan={2}
                  style={{
                    background: '#243B26',
                    textAlign: 'left',
                    verticalAlign: 'middle',
                    padding: '8px 10px',
                    color: '#C8E6A0',
                    fontSize: 10,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderRight: '0.5px solid rgba(255,255,255,0.08)',
                    borderBottom: 'none'
                  }}
                >
                  Atividade
                </th>
                <th
                  colSpan={Math.max(1, casasVisiveis.length)}
                  style={{
                    background: '#243B26',
                    textAlign: 'center',
                    padding: '8px 10px',
                    color: '#C8E6A0',
                    fontSize: 10,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    borderBottom: 'none'
                  }}
                >
                  Casas
                </th>
              </tr>

              {/* Linha 2 — nome de cada casa com bolinha colorida */}
              <tr>
                {casasVisiveis.map((casaGroup, idx) => {
                  const cor = getCorCasa(idx)
                  return (
                    <th
                      key={casaGroup.nome}
                      style={{
                        background: '#3A5528',
                        textAlign: 'center',
                        padding: '5px 4px',
                        color: '#C8E6A0',
                        fontSize: 9,
                        fontWeight: 500,
                        borderRight: '0.5px solid rgba(255,255,255,0.08)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: cor.bg,
                            border: `1px solid ${cor.border}`,
                            flexShrink: 0
                          }}
                        />
                        {casaGroup.nome}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody>
              {areasOrdenadasExibicao.map(area => (
                <Fragment key={`area-${area.id}`}>
                  <tr>
                    <td
                      style={{
                        background: '#1a2e1a',
                        color: '#C8E6A0',
                        fontSize: 10,
                        fontWeight: 500,
                        padding: '5px 8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {area.nome}
                    </td>
                    {casasVisiveis.map(casaGroup => {
                      const pct = calcularPctArea(area.id, casaGroup)
                      const cor =
                        pct === null
                          ? null
                          : pct === 100
                            ? '#0F7A4A'
                            : pct >= 75
                              ? '#5A9A1A'
                              : pct >= 50
                                ? '#EF9F27'
                                : '#B01A1A'
                      return (
                        <td
                          key={casaGroup.nome}
                          style={{
                            background: '#1a2e1a',
                            textAlign: 'center',
                            borderBottom: '0.5px solid rgba(255,255,255,0.08)',
                            padding: '5px 4px'
                          }}
                        >
                          {pct === null ? (
                            <span style={{ color: '#a8d080', fontSize: 10 }}>—</span>
                          ) : (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 500,
                                color: cor,
                                background: `${cor}22`,
                                padding: '1px 7px',
                                borderRadius: 10,
                                display: 'inline-block'
                              }}
                            >
                              {pct}%
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>

                  {area.nome === 'Projetos - Modelo Virtual'
                    ? tarefasComGantt
                        .filter(t => t.area_id === area.id)
                        .map(tarefa => renderLinhaProjeto(tarefa))
                    : tarefasComGantt
                        .filter(t => t.area_id === area.id)
                        .map(tarefa => renderLinhasTarefa(tarefa))}
                </Fragment>
              ))}

              <tr style={{ background: '#F4F9EE', borderTop: '1px solid #8FBA6A' }}>
                <td
                  style={{
                    padding: '7px 10px',
                    fontWeight: 500,
                    fontSize: 12,
                    color: 'var(--color-text-primary)'
                  }}
                >
                  Total Produto + Projetos
                </td>
                {casasVisiveis.map(casaGroup => {
                  let totalConcluidas = 0
                  for (const t of tarefasComGantt) {
                    const med = medirProgresso(t.id, casaGroup, null)
                    totalConcluidas += med.concluidas
                  }

                  const pctTotal =
                    totalAtividades > 0
                      ? Math.min(100, Math.round((totalConcluidas / totalAtividades) * 100))
                      : null
                  const cor = getCorProgresso(pctTotal)

                  return (
                    <td key={casaGroup.nome} style={{ textAlign: 'center', padding: '6px 4px' }}>
                      {pctTotal === null ? (
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>—</span>
                      ) : (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 500, color: cor.text }}>{pctTotal}%</div>
                          <div style={{ fontSize: 8, color: 'var(--color-text-secondary)' }}>
                            {totalConcluidas}/{totalAtividades} ativ.
                          </div>
                        </>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
