// @ts-nocheck
'use client';

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listarAreas } from '@/utils/areasOrder'
import { isoWeek } from '@/utils/periodos'

export default function Page() {
  const supabase = createClient()
  const [periodoId, setPeriodoId] = useState(null)
  const [periodo, setPeriodo] = useState(null)
  const [areas, setAreas] = useState([])
  const [ganttList, setGanttList] = useState([])
  const [cronogramaStatus, setCronogramaStatus] = useState({})
  const [filtroArea, setFiltroArea] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [kanbanFiltro, setKanbanFiltro] = useState('todas') // 'atrasadas' | 'semana' | 'proximas' | 'todas'
  const [taskAberta, setTaskAberta] = useState(null) // id da tarefa expandida

  useEffect(() => {
    async function carregarPeriodoAtual() {
      const hoje = new Date()
      const ano = hoje.getFullYear()
      const mesNum = hoje.getMonth() + 1
      const mes = String(mesNum).padStart(2, '0')

      // 1) Modelo canônico: tipo 'mes' + ano + numero (1–12), ver supabase-periodos.sql
      const { data: porAnoMes, error: errAnoMes } = await supabase
        .from('periodos')
        .select('id')
        .eq('tipo', 'mes')
        .eq('ano', ano)
        .eq('numero', mesNum)
        .eq('ativo', true)
        .limit(1)
        .maybeSingle()

      if (!errAnoMes && porAnoMes?.id) {
        setPeriodoId(porAnoMes.id)
        return
      }

      // 2) Se existir coluna `nome` no banco (ex.: "Mês 05/2026"), alinha ao padrão de labelPeriodo
      const { data: porNome, error: errNome } = await supabase
        .from('periodos')
        .select('id')
        .eq('tipo', 'mes')
        .ilike('nome', `%${mes}/${ano}%`)
        .limit(1)
        .maybeSingle()

      if (!errNome && porNome?.id) {
        setPeriodoId(porNome.id)
        return
      }

      // 3) Fallback: período mensal mais recente
      const { data: fallback } = await supabase
        .from('periodos')
        .select('id')
        .eq('tipo', 'mes')
        .eq('ativo', true)
        .order('criado_em', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (fallback?.id) setPeriodoId(fallback.id)
    }
    carregarPeriodoAtual()
  }, [])

  useEffect(() => {
    console.log('[TODO] periodoId carregado:', periodoId)
  }, [periodoId])

  async function carregarDados() {
    if (!periodoId) return
    setLoading(true)
    setError(null)

    const { data: p, error: errPer } = await supabase.from('periodos').select('*').eq('id', periodoId).single()
    if (errPer) {
      setError(errPer.message)
      setLoading(false)
      return
    }
    setPeriodo(p)

    const { data: areasData } = await listarAreas(supabase, 'id, nome')
    const list = areasData || []
    setAreas(list)
    if (list.length && !filtroArea) {
      const ids = new Set(list.map((a) => String(a?.id ?? '')).filter(Boolean))
      const fromStorage = localStorage.getItem('carometro_ultima_area')
      if (fromStorage && ids.has(fromStorage)) {
        setFiltroArea(fromStorage)
        localStorage.setItem('carometro_ultima_area', fromStorage)
      }
    }

    let gantt = []
    const { data: ganttData, error: errGantt } = await supabase
      .from('gantt_planejamento')
      .select('id, acao_id, responsavel, semanas_selecionadas, semana_inicio, semana_fim, acoes(nome, tarefas(area_id))')
      .eq('periodo_id', periodoId)
    if (errGantt) {
      setError(errGantt.message)
      setLoading(false)
      return
    }
    gantt = ganttData || []

    console.log('[TODO] ganttData recebido:', ganttData?.length, 'itens')
    console.log('[TODO] semanaAtual:', semanaAtual)

    const acaoIds = gantt.map(g => g.acao_id).filter(Boolean)
    let cronoByKey = {}
    if (acaoIds.length > 0) {
      const { data: cronoList, error: errCrono } = await supabase
        .from('cronograma')
        .select('acao_id, semana, status')
        .eq('periodo_id', periodoId)
        .in('acao_id', acaoIds)
        .not('semana', 'is', null)
      if (errCrono) {
        setError(errCrono.message)
        setLoading(false)
        return
      }
      ;(cronoList || []).forEach(c => {
        const sem = Number(c.semana)
        if (!Number.isFinite(sem)) return
        cronoByKey[`${c.acao_id}_${sem}`] = c.status || 'pendente'
      })
    }

    setCronogramaStatus(cronoByKey)
    setGanttList(gantt)
    setLoading(false)
  }

  useEffect(() => { carregarDados() }, [periodoId])

  const semanaAtual = useMemo(() => {
    return isoWeek(new Date())
  }, [])

  const areaMap = useMemo(() => {
    const m = new Map()
    ;(areas || []).forEach(a => { m.set(a.id, a.nome) })
    return m
  }, [areas])

  const responsaveis = useMemo(() => {
    const set = new Set((ganttList || []).map(g => g.responsavel).filter(Boolean))
    return Array.from(set).sort()
  }, [ganttList])

  const todasTarefas = useMemo(() => {
    if (!periodoId || semanaAtual == null) return []
    const lista = []
    try {
      ;(ganttList || []).forEach(g => {
        const areaId = g.acoes?.tarefas?.area_id
        if (!areaId) return
        if (filtroArea && areaId !== filtroArea) return
        if (filtroResponsavel && g.responsavel !== filtroResponsavel) return
        const areaNome = areaMap.get(areaId) || '—'
        const responsavel = g.responsavel || 'Sem responsável'
        const semanasRaw =
          Array.isArray(g.semanas_selecionadas) && g.semanas_selecionadas.length > 0
            ? g.semanas_selecionadas
            : g.semana_inicio != null && g.semana_fim != null
            ? Array.from({ length: g.semana_fim - g.semana_inicio + 1 }, (_, i) => g.semana_inicio + i)
            : []
        ;(semanasRaw || []).forEach(s => {
          const semIso = Number(s)
          if (!Number.isFinite(semIso)) return
          const status = cronogramaStatus[`${g.acao_id}_${semIso}`] || 'pendente'
          if (status === 'concluido') return
          let urgencia
          if (semIso < semanaAtual) urgencia = 'atrasada'
          else if (semIso === semanaAtual) urgencia = 'semana'
          else if (semIso <= semanaAtual + 2) urgencia = 'proximas'
          else urgencia = 'futura'
          lista.push({
            id: `${g.id}_${semIso}`,
            acaoNome: g.acoes?.nome || 'Atividade',
            semana: semIso,
            responsavel,
            areaNome,
            areaId,
            urgencia,
          })
        })
      })
      lista.sort((a, b) => {
        const ordem = { atrasada: 0, semana: 1, proximas: 2, futura: 3 }
        return ordem[a.urgencia] - ordem[b.urgencia] || a.semana - b.semana
      })
    } catch (e) {
      console.error('Erro ao montar tarefas do TO DO', e)
    }
    return lista
  }, [ganttList, cronogramaStatus, filtroArea, filtroResponsavel, semanaAtual, areaMap, periodoId])

  const counts = useMemo(() => ({
    atrasadas: todasTarefas.filter(t => t.urgencia === 'atrasada').length,
    semana:    todasTarefas.filter(t => t.urgencia === 'semana').length,
    proximas:  todasTarefas.filter(t => t.urgencia === 'proximas').length,
    todas:     todasTarefas.length,
  }), [todasTarefas])

  const tarefasFiltradas = useMemo(() => {
    if (kanbanFiltro === 'todas')     return todasTarefas
    if (kanbanFiltro === 'atrasadas') return todasTarefas.filter(t => t.urgencia === 'atrasada')
    if (kanbanFiltro === 'semana')    return todasTarefas.filter(t => t.urgencia === 'semana')
    if (kanbanFiltro === 'proximas')  return todasTarefas.filter(t => t.urgencia === 'proximas' || t.urgencia === 'semana')
    return todasTarefas
  }, [todasTarefas, kanbanFiltro])

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <h1 className="carometro-page-title">TO DO — Entregas da semana</h1>
        <p className="carometro-page-subtitle">
          Atividades pendentes ordenadas por urgência e semana.
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 13, color: '#888780', margin: 0, whiteSpace: 'nowrap' }}>Área</label>
          <select
            id="todo-filtro-area"
            value={filtroArea}
            onChange={e => {
              const v = e.target.value
              setFiltroArea(v)
              if (v) localStorage.setItem('carometro_ultima_area', v)
            }}
            style={{ fontSize: 13, border: '0.5px solid #e0d9ce', borderRadius: 6, padding: '6px 10px', minWidth: 160, background: '#fff', color: '#1D2F25' }}
          >
            <option value="">Todas as áreas</option>
            {areas.map(a => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 10, borderLeft: '1px solid #e0d9ce' }}>
          <label style={{ fontSize: 13, color: '#888780', margin: 0, whiteSpace: 'nowrap' }}>Responsável</label>
          <select
            id="todo-filtro-resp"
            value={filtroResponsavel}
            onChange={e => setFiltroResponsavel(e.target.value)}
            style={{ fontSize: 13, border: '0.5px solid #e0d9ce', borderRadius: 6, padding: '6px 10px', minWidth: 160, background: '#fff', color: '#1D2F25' }}
          >
            <option value="">Todos</option>
            {responsaveis.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p>Carregando…</p>
      ) : (
        <>
          {/* Bloco 1 — Metas & Indicadores */}
          <section className="todo-metas-section">
            <div className="todo-metas-header">
              <span className="todo-metas-titulo">Metas &amp; Indicadores</span>
              <span className="todo-metas-sub">ordenados por prioridade e status</span>
            </div>
            <div className="todo-metas-cols">
              <div className="todo-metas-grupo">
                <div className="todo-metas-grupo-label todo-metas-grupo-label--ruim">
                  Precisam de atenção
                </div>
                {/* TODO: mapear indicadores com status ruim vindos do Supabase */}
                <p className="todo-metas-placeholder">
                  Integração com indicadores pendente — conectar à tabela de metas do Supabase.
                </p>
              </div>
              <div className="todo-metas-grupo">
                <div className="todo-metas-grupo-label todo-metas-grupo-label--ok">
                  Mantendo o ritmo
                </div>
                {/* TODO: mapear indicadores com status bom vindos do Supabase */}
                <p className="todo-metas-placeholder">
                  Integração com indicadores pendente — conectar à tabela de metas do Supabase.
                </p>
              </div>
            </div>
          </section>

          <div className="todo-section-divider">
            <span>Atividades</span>
          </div>

          {/* Bloco 2 — Atividades */}
          <section style={{ marginTop: 0 }}>

            {/* Kanban strip */}
            <div className="todo-kanban-strip">
              {[
                { key: 'atrasadas', label: 'Atrasadas',      cor: 'vermelho', count: counts.atrasadas },
                { key: 'semana',    label: 'Esta semana',    cor: 'amarelo',  count: counts.semana },
                { key: 'proximas',  label: 'Próx. 2 sem.',   cor: 'azul',     count: counts.proximas },
                { key: 'todas',     label: 'Todas',          cor: 'cinza',    count: counts.todas },
              ].map(col => (
                <button
                  key={col.key}
                  type="button"
                  className={`todo-kanban-card todo-kanban-card--${col.cor}${kanbanFiltro === col.key ? ' todo-kanban-card--ativo' : ''}`}
                  onClick={() => setKanbanFiltro(col.key)}
                >
                  <span className="todo-kanban-num">{col.count}</span>
                  <span className="todo-kanban-label">{col.label}</span>
                </button>
              ))}
            </div>

            {/* Lista de tarefas */}
            <div className="todo-task-list">
              {tarefasFiltradas.length === 0 ? (
                <p className="empty-state">Nenhuma entrega para o período selecionado.</p>
              ) : (
                tarefasFiltradas.map(t => (
                  <div key={t.id} className="todo-task-item">
                    <button
                      className="todo-task-row"
                      onClick={() => setTaskAberta(prev => prev === t.id ? null : t.id)}
                    >
                      <span className={`todo-task-dot todo-task-dot--${t.urgencia}`} />
                      <span className="todo-task-nome">{t.acaoNome}</span>
                      <span className={`todo-task-badge todo-task-badge--${t.urgencia}`}>
                        {{ atrasada: 'Atrasada', semana: 'Esta semana', proximas: 'Próx. 2 sem.', futura: 'Futura' }[t.urgencia]}
                      </span>
                      <span className="todo-task-semana">Sem. {t.semana}</span>
                      <span className={`todo-task-chevron${taskAberta === t.id ? ' todo-task-chevron--aberto' : ''}`}>›</span>
                    </button>
                    {taskAberta === t.id && (
                      <div className="todo-task-detalhe">
                        <span>Responsável: <strong>{t.responsavel}</strong></span>
                        <span>Área: <strong>{t.areaNome}</strong></span>
                        <span>Semana <strong>{t.semana}</strong></span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </>
  )
}
