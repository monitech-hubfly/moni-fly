import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { listarAreas } from '../utils/areasOrder'
import { isoWeek, semanasIsoAnoCalendario } from '../utils/periodos'
import {
  WL_H_CAP_SEMANA,
  acaoTemCronogramaNasSemanas,
  acaoTemGanttNasSemanasIso,
  agregarPlanejadoRealizadoPorSemana,
  detalharAcoesPlanejamento,
  fatorExecucoesRecorrenciaSemanal,
  mediaHorasCronogramaConcluidoPorAcao,
  primeiraEUltimaDataTocandoSemanasIsoNoAno,
  semanaISOAtualSeNoIntervalo,
  semanasIsoComPlanejamentoGanttNasLinhas,
  semanasOrdenadasUnicas,
  tarefaTemPlanejamentoGanttOuCronogramaNoPeriodo,
  totalRealizadoAteSemanaAtual
} from '../utils/workloadPlanejamentoData'
import WeekSelector from '../components/WeekSelector'
import WorkloadPlanningBarChart from '../components/WorkloadPlanningBarChart'
import WorkloadSimulacaoBarChart from '../components/WorkloadSimulacaoBarChart'

const RECORRENCIA_LABELS = {
  unica: 'Atividade única',
  diaria: 'Diária',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual'
}

function primeiroIsoSemanaNoAno(anoRef) {
  const lista = semanasIsoAnoCalendario(anoRef)
  const wNow = isoWeek(new Date())
  const y = Number(anoRef)
  const anoAtual = new Date().getFullYear()
  if (y === anoAtual && lista.includes(wNow)) return wNow
  return lista.length ? lista[0] : 1
}

function classeRecoSim(pctUtil) {
  if (pctUtil <= 70) return { cls: 'wl-rec--ok', titulo: 'Confortável', subt: 'margem suficiente no período' }
  if (pctUtil <= 90) return { cls: 'wl-rec--warn', titulo: 'Viável com cuidado · monitorar picos', subt: '' }
  return { cls: 'wl-rec--bad', titulo: 'Sobrecarregado · adicionar recursos ou redistribuir', subt: '' }
}

/** Cabeçalho de comportamento na simulação: checkbox tri-estado + clique seleciona todas. */
function SimGrupoHeader({ tarefa, simIncluido, onToggleGrupo }) {
  const inputRef = useRef(null)
  const ids = (tarefa.acoes || []).map(a => String(a.id)).filter(Boolean)
  const nOn = ids.filter(id => simIncluido[id] === true).length
  const all = ids.length > 0 && nOn === ids.length
  const some = nOn > 0 && !all
  useLayoutEffect(() => {
    const el = inputRef.current
    if (el) {
      el.indeterminate = some && !all
      el.checked = all
    }
  }, [all, some])
  const hint = all ? 'todas selecionadas' : 'clique para selecionar todas'
  return (
    <th colSpan={5} style={{ padding: 0 }}>
      <button type="button" className="wl-sim-grupo-head-btn" onClick={() => onToggleGrupo(tarefa)}>
        <input ref={inputRef} type="checkbox" readOnly tabIndex={-1} aria-hidden />
        <span className="wl-cbh-title">{String(tarefa.nome || '—').trim() || '—'}</span>
        <span className="wl-sim-grupo-hint">{hint}</span>
      </button>
    </th>
  )
}

export default function WorkloadNovo() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [areas, setAreas] = useState([])
  const [areaId, setAreaId] = useState(searchParams.get('area') || '')
  const anoPadrao = new Date().getFullYear()

  const [planAno, setPlanAno] = useState(anoPadrao)
  const [planSemanasSel, setPlanSemanasSel] = useState(() => [primeiroIsoSemanaNoAno(anoPadrao)])

  const [simAno, setSimAno] = useState(anoPadrao)
  const [simSemanasSel, setSimSemanasSel] = useState(() => [primeiroIsoSemanaNoAno(anoPadrao)])

  const [simRecursos, setSimRecursos] = useState(1)
  const [simIncluido, setSimIncluido] = useState({})
  const [simHoras, setSimHoras] = useState({})

  const [tarefas, setTarefas] = useState([])
  const [metaNomePorObjetivoId, setMetaNomePorObjetivoId] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [cronogramaRange, setCronogramaRange] = useState([])
  const [cronogramaHist, setCronogramaHist] = useState([])
  const [planejamentoRows, setPlanejamentoRows] = useState([])

  useEffect(() => {
    listarAreas(supabase, 'id, nome').then(({ data }) => {
      const list = data || []
      setAreas(list)
      if (list.length && !areaId) {
        setAreaId(list[0].id)
        setSearchParams({ area: list[0].id })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount
  }, [])

  useEffect(() => {
    if (!areaId) return
    setLoading(true)
    setError(null)
    supabase
      .from('tarefas')
      .select('id, nome, objetivo_id, ordem, acoes(*)')
      .eq('area_id', areaId)
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
          setTarefas([])
        } else {
          const ordenarAcoes = arr => (arr || []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
          setTarefas((data || []).map(t => ({ ...t, acoes: ordenarAcoes(t.acoes) })))
        }
        setLoading(false)
      })
  }, [areaId])

  useEffect(() => {
    if (!areaId || !tarefas.length) {
      setMetaNomePorObjetivoId({})
      return
    }
    const objIds = [...new Set(tarefas.map(t => t.objetivo_id).filter(Boolean))]
    if (!objIds.length) {
      setMetaNomePorObjetivoId({})
      return
    }
    supabase
      .from('objetivos')
      .select('id, descricao')
      .in('id', objIds)
      .then(({ data }) => {
        const m = {}
        ;(data || []).forEach(o => {
          if (o?.id) m[String(o.id)] = o.descricao || 'Meta'
        })
        setMetaNomePorObjetivoId(m)
      })
  }, [areaId, tarefas])

  const listaSemanasPlan = useMemo(() => semanasOrdenadasUnicas(planSemanasSel), [planSemanasSel])

  const listaSemanasSim = useMemo(() => semanasOrdenadasUnicas(simSemanasSel), [simSemanasSel])

  const semanasComGanttPlan = useMemo(
    () => semanasIsoComPlanejamentoGanttNasLinhas(planejamentoRows, planAno),
    [planejamentoRows, planAno]
  )

  const semanasComGanttSim = useMemo(
    () => semanasIsoComPlanejamentoGanttNasLinhas(planejamentoRows, simAno),
    [planejamentoRows, simAno]
  )

  const planSemanasSet = useMemo(() => new Set(listaSemanasPlan), [listaSemanasPlan])

  const semanasUnionParaCrono = useMemo(() => {
    const s = new Set([...(listaSemanasPlan || []), ...(listaSemanasSim || [])].map(Number).filter(Number.isFinite))
    return [...s].sort((a, b) => a - b)
  }, [listaSemanasPlan, listaSemanasSim])

  const { inicio: dataInicioPlan, fim: dataFimPlan } = useMemo(
    () => primeiraEUltimaDataTocandoSemanasIsoNoAno(planAno, listaSemanasPlan),
    [planAno, listaSemanasPlan]
  )

  const semanaAtualISO = useMemo(
    () => semanaISOAtualSeNoIntervalo(dataInicioPlan, dataFimPlan),
    [dataInicioPlan, dataFimPlan]
  )

  const acaoIdsLista = useMemo(() => {
    const s = []
    for (const t of tarefas || []) {
      for (const a of t.acoes || []) if (a?.id) s.push(a.id)
    }
    return [...new Set(s)]
  }, [tarefas])

  const acaoPorId = useMemo(() => {
    const m = {}
    for (const t of tarefas || []) {
      for (const a of t.acoes || []) {
        if (a?.id) m[String(a.id)] = a
      }
    }
    return m
  }, [tarefas])

  useEffect(() => {
    if (!acaoIdsLista.length || semanasUnionParaCrono.length === 0) {
      setCronogramaRange([])
      setPlanejamentoRows([])
      setCronogramaHist([])
      return
    }

    ;(async () => {
      const [rCrono, rPlano, rHist] = await Promise.all([
        supabase
          .from('cronograma')
          .select('acao_id, semana, horas_previstas, status')
          .in('acao_id', acaoIdsLista)
          .in('semana', semanasUnionParaCrono),
        supabase
          .from('gantt_planejamento')
          .select('id, acao_id, semanas_selecionadas, semana_inicio, semana_fim')
          .in('acao_id', acaoIdsLista),
        supabase
          .from('cronograma')
          .select('acao_id, horas_previstas, status')
          .in('acao_id', acaoIdsLista)
          .limit(12000)
      ])

      setCronogramaRange(rCrono.error ? [] : rCrono.data || [])
      setPlanejamentoRows(rPlano.error ? [] : rPlano.data || [])
      setCronogramaHist(rHist.error ? [] : rHist.data || [])
      if (rCrono.error) setError(e => e || rCrono.error.message)
    })()
  }, [acaoIdsLista, semanasUnionParaCrono])

  /** Padrão: nenhuma atividade incluída na simulação até o usuário marcar ou espelhar. */
  useEffect(() => {
    const next = {}
    tarefas.forEach(t => (t.acoes || []).forEach(a => {
      if (a?.id) next[String(a.id)] = false
    }))
    setSimIncluido(next)
  }, [tarefas])

  useEffect(() => {
    setSimHoras(prev => {
      const next = { ...prev }
      let changed = false
      for (const t of tarefas || []) {
        for (const a of t.acoes || []) {
          const id = String(a.id)
          const h = (Number(a.tempo_estimado_minutos) || 0) / 60
          if (next[id] === undefined && h > 0) {
            next[id] = Math.round(h * 100) / 100
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [tarefas])

  const agPlan = useMemo(
    () =>
      agregarPlanejadoRealizadoPorSemana({
        weeksList: listaSemanasPlan,
        cronogramaRows: cronogramaRange,
        planejamentoRows,
        acaoPorId
      }),
    [listaSemanasPlan, cronogramaRange, planejamentoRows, acaoPorId]
  )

  const capacidadePlan = listaSemanasPlan.length * WL_H_CAP_SEMANA
  const previstoTot = agPlan.planejadoArr.reduce((s, x) => s + x, 0)
  const realizAteSemanaAtual = useMemo(
    () => totalRealizadoAteSemanaAtual(agPlan.labelsNum, agPlan.realizadoArr, semanaAtualISO),
    [agPlan, semanaAtualISO]
  )

  const picoPlan = useMemo(() => {
    let maxPct = 0
    let maxSem = '—'
    agPlan.labelsNum.forEach((w, i) => {
      const h = agPlan.planejadoArr[i] || 0
      const pct = WL_H_CAP_SEMANA > 0 ? (h / WL_H_CAP_SEMANA) * 100 : 0
      if (pct > maxPct || (pct === maxPct && maxSem === '—')) {
        maxPct = pct
        maxSem = agPlan.labels[i] || `S${w}`
      }
    })
    return { pct: Math.round(maxPct), semana: maxSem }
  }, [agPlan])

  const grupoDetalhes = useMemo(
    () =>
      detalharAcoesPlanejamento({
        tarefas,
        weeksList: listaSemanasPlan,
        cronogramaRows: cronogramaRange,
        planejamentoRows,
        acaoPorId,
        objetivoNomePorId: metaNomePorObjetivoId
      }),
    [tarefas, listaSemanasPlan, cronogramaRange, planejamentoRows, acaoPorId, metaNomePorObjetivoId]
  )

  const mediaPorAcao = useMemo(() => mediaHorasCronogramaConcluidoPorAcao(cronogramaHist, acaoIdsLista), [
    cronogramaHist,
    acaoIdsLista
  ])

  const agSimSelecao = useMemo(
    () =>
      agregarPlanejadoRealizadoPorSemana({
        weeksList: listaSemanasSim,
        cronogramaRows: cronogramaRange,
        planejamentoRows,
        acaoPorId
      }),
    [listaSemanasSim, cronogramaRange, planejamentoRows, acaoPorId]
  )

  const simTotals = useMemo(() => {
    const n = listaSemanasSim.length
    let adj = 0
    for (const t of tarefas || []) {
      for (const a of t.acoes || []) {
        const id = String(a.id)
        if (simIncluido[id] !== true) continue
        const h = Number(simHoras[id])
        if (Number.isFinite(h) && h > 0) adj += h
      }
    }
    const capSemanal = WL_H_CAP_SEMANA * Math.max(1, simRecursos)
    const utilPct = n > 0 && capSemanal > 0 ? (adj / (n * capSemanal)) * 100 : 0
    const reco = classeRecoSim(utilPct)
    return { adjTot: adj, utilPct, reco, capSemanal }
  }, [listaSemanasSim, simIncluido, simHoras, tarefas, simRecursos])

  const graficoSimDadosSelecao =
    agSimSelecao.planejadoArr.length === listaSemanasSim.length
      ? agSimSelecao.planejadoArr
      : listaSemanasSim.map(() => 0)

  const graficoSimAzul = useMemo(() => {
    const n = listaSemanasSim.length
    const v = n > 0 ? simTotals.adjTot / n : 0
    return Array.from({ length: n }, () => v)
  }, [listaSemanasSim.length, simTotals.adjTot])

  const picoSimSemana = useMemo(() => {
    const capSem = WL_H_CAP_SEMANA * Math.max(1, simRecursos)
    const n = listaSemanasSim.length
    let maxPct = 0
    let semanaLbl = '—'
    for (let i = 0; i < n; i++) {
      const m = Math.max(graficoSimDadosSelecao[i] || 0, graficoSimAzul[i] || 0)
      const pct = capSem > 0 ? (m / capSem) * 100 : 0
      const w = listaSemanasSim[i]
      const lab = Number.isFinite(w) ? `S${w}` : '—'
      if (pct > maxPct || (pct === maxPct && lab !== '—')) {
        maxPct = pct
        semanaLbl = lab
      }
    }
    return { pct: Math.round(maxPct), semana: semanaLbl }
  }, [
    listaSemanasSim,
    simRecursos,
    graficoSimDadosSelecao,
    graficoSimAzul
  ])

  const grupoPorTarefaId = useMemo(() => {
    const m = {}
    grupoDetalhes.forEach(g => {
      m[String(g.tarefaId)] = g
    })
    return m
  }, [grupoDetalhes])

  const extendSimPorNSemanas = useCallback(
    n => {
      const lista = semanasIsoAnoCalendario(simAno)
      const atual = isoWeek(new Date())
      let idx = lista.indexOf(atual)
      if (idx < 0) idx = 0
      const out = []
      const nn = Math.max(1, Math.min(53, Number(n) || 1))
      for (let i = 0; i < nn && idx + i < lista.length; i++) out.push(lista[idx + i])
      if (out.length) setSimSemanasSel(out)
    },
    [simAno]
  )

  const desmarcarTodasSim = useCallback(() => {
    const next = {}
    tarefas.forEach(t => (t.acoes || []).forEach(a => {
      if (a?.id) next[String(a.id)] = false
    }))
    setSimIncluido(next)
  }, [tarefas])

  const marcarTodasSim = useCallback(() => {
    const next = {}
    tarefas.forEach(t => (t.acoes || []).forEach(a => {
      if (a?.id) next[String(a.id)] = true
    }))
    setSimIncluido(next)
  }, [tarefas])

  const espelharPlanejamento = useCallback(() => {
    setSimAno(planAno)
    setSimSemanasSel([...listaSemanasPlan])
    const setSem = new Set(listaSemanasPlan)
    const nextInc = {}
    const horasPatch = {}
    for (const t of tarefas || []) {
      for (const a of t.acoes || []) {
        if (!a?.id) continue
        const id = String(a.id)
        const incl =
          acaoTemGanttNasSemanasIso(a.id, planejamentoRows, setSem) ||
          acaoTemCronogramaNasSemanas(a.id, cronogramaRange, setSem)
        nextInc[id] = incl
        if (incl) {
          const base = (Number(a.tempo_estimado_minutos) || 0) / 60
          horasPatch[id] = Math.round(base * 10) / 10
        }
      }
    }
    setSimIncluido(nextInc)
    setSimHoras(prev => {
      const merged = { ...prev }
      Object.keys(horasPatch).forEach(k => {
        merged[k] = horasPatch[k]
      })
      return merged
    })
  }, [planAno, listaSemanasPlan, tarefas, planejamentoRows, cronogramaRange])

  const toggleGrupoSim = useCallback(tarefa => {
    const ids = (tarefa.acoes || []).map(a => String(a.id)).filter(Boolean)
    setSimIncluido(prev => {
      const allOn = ids.length > 0 && ids.every(id => prev[id] === true)
      const v = !allOn
      const next = { ...prev }
      ids.forEach(id => {
        next[id] = v
      })
      return next
    })
  }, [])

  const opcAnos = [anoPadrao - 1, anoPadrao, anoPadrao + 1]

  return (
    <div className="wl-workload-page workload-novo wl-novo-dois-paineis">
      <header className="workload-header wl-header wl-novo-header">
        <div>
          <h1 className="workload-title">Workload</h1>
          <p className="workload-subtitle wl-subtitle">
            Planejamento real versus simulação de capacidade (40 h/semana por recurso, semanas ISO).
          </p>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="wl-two-panels">
        <div className="wl-sync-row">
          <div className="wl-sync-cell wl-sync-cell--plan">
            <h2 className="wl-panel-title">Planejamento</h2>
            <div className="wl-panel-filters">
              {areas.length > 0 ? (
                <div className="workload-novo-field wl-field">
                  <label htmlFor="wl-novo-plan-area">Área</label>
                  <select
                    id="wl-novo-plan-area"
                    value={areaId}
                    onChange={e => {
                      setAreaId(e.target.value)
                      setSearchParams({ area: e.target.value })
                    }}
                  >
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>{a.nome}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="workload-novo-field wl-field">
                <label htmlFor="wl-plan-ano">Ano ISO (grade)</label>
                <select
                  id="wl-plan-ano"
                  value={planAno}
                  onChange={e => {
                    const y = Number(e.target.value)
                    setPlanAno(y)
                    setPlanSemanasSel([primeiroIsoSemanaNoAno(y)])
                  }}
                >
                  {opcAnos.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="wl-sync-cell wl-sync-cell--sim">
            <h2 className="wl-panel-title">Simulação</h2>
            <div className="wl-panel-filters">
              {areas.length > 0 ? (
                <div className="workload-novo-field wl-field">
                  <label htmlFor="wl-novo-sim-area">Área</label>
                  <select
                    id="wl-novo-sim-area"
                    value={areaId}
                    onChange={e => {
                      setAreaId(e.target.value)
                      setSearchParams({ area: e.target.value })
                    }}
                  >
                    {areas.map(a => (
                      <option key={a.id} value={a.id}>{a.nome}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="workload-novo-field wl-field">
                <label htmlFor="wl-sim-ano">Ano ISO (grade)</label>
                <select
                  id="wl-sim-ano"
                  value={simAno}
                  onChange={e => {
                    const y = Number(e.target.value)
                    setSimAno(y)
                    setSimSemanasSel([primeiroIsoSemanaNoAno(y)])
                  }}
                >
                  {opcAnos.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="wl-sync-row">
          <div className="wl-sync-cell wl-sync-cell--plan">
            <WeekSelector
              className="wl-week-selector--paired"
              ano={planAno}
              semanasComGantt={semanasComGanttPlan}
              selecionadas={planSemanasSel}
              onChange={setPlanSemanasSel}
            />
          </div>
          <div className="wl-sync-cell wl-sync-cell--sim">
            <WeekSelector
              className="wl-week-selector--paired"
              ano={simAno}
              semanasComGantt={semanasComGanttSim}
              selecionadas={simSemanasSel}
              onChange={setSimSemanasSel}
            />
          </div>
        </div>

        <div className="wl-sync-row">
          <div className="wl-sync-cell wl-sync-cell--plan">
            {!areaId ? (
              <p className="wl-muted">Selecione uma área.</p>
            ) : loading ? (
              <p>Carregando…</p>
            ) : (
              <div className="wl-cards-grid wl-cards-grid--4">
                <div className="wl-card">
                  <span className="wl-card-label">Capacidade total</span>
                  <span className="wl-card-valor">{capacidadePlan} h</span>
                  <span className="wl-card-hint">{listaSemanasPlan.length} sem × {WL_H_CAP_SEMANA} h</span>
                </div>
                <div className="wl-card">
                  <span className="wl-card-label">Horas previstas</span>
                  <span className="wl-card-valor">{Math.round(previstoTot * 10) / 10} h</span>
                  <span className="wl-card-hint">Gantt (planejamento + cronograma)</span>
                </div>
                <div className="wl-card">
                  <span className="wl-card-label">Horas executadas</span>
                  <span className="wl-card-valor">{Math.round(realizAteSemanaAtual * 10) / 10} h</span>
                  <span className="wl-card-hint">Cronograma concluído até a semana atual</span>
                </div>
                <div className="wl-card">
                  <span className="wl-card-label">Pico</span>
                  <span className="wl-card-valor">{picoPlan.semana} · {picoPlan.pct}%</span>
                  <span className="wl-card-hint">Sobre {WL_H_CAP_SEMANA} h</span>
                </div>
              </div>
            )}
          </div>
          <div className="wl-sync-cell wl-sync-cell--sim">
            <div className="wl-sync-mid-stack">
              <p className="wl-novo-hint-muted">
                Capacidade base: {WL_H_CAP_SEMANA} h/semana por recurso · Feriados e ajustes serão configurados em Cadastros.
              </p>
              <div className="wl-sim-controles wl-novo-sim-controls">
                <div className="wl-sim-slider">
                  <label htmlFor="wl-sim-rec2">
                    <span className="wl-sim-label-text">Recursos: </span>
                    <span className="wl-sim-value">{simRecursos}</span>
                    <span className="wl-sim-label-text"> pessoa(s)</span>
                  </label>
                  <input
                    id="wl-sim-rec2"
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={simRecursos}
                    onChange={e => setSimRecursos(Number(e.target.value))}
                  />
                </div>
                <div className="wl-sim-quick wl-novo-chips">
                  <button type="button" className="btn wl-sim-btn" onClick={() => extendSimPorNSemanas(4)}>4 sem</button>
                  <button type="button" className="btn wl-sim-btn" onClick={() => extendSimPorNSemanas(8)}>8 sem</button>
                  <button type="button" className="btn wl-sim-btn" onClick={() => extendSimPorNSemanas(13)}>13 sem</button>
                </div>
              </div>
              <div className="wl-cards-grid wl-cards-grid--3">
                <div className="wl-card wl-card--compact">
                  <span className="wl-card-label">Utilização simulada</span>
                  <span className="wl-card-valor">{Math.round(simTotals.utilPct)}%</span>
                </div>
                <div className="wl-card wl-card--compact">
                  <span className="wl-card-label">Pico simulado</span>
                  <span className="wl-card-valor">
                    {picoSimSemana.semana} · {picoSimSemana.pct}%
                  </span>
                  <span className="wl-card-hint">Sobre {WL_H_CAP_SEMANA} × {simRecursos} h</span>
                </div>
                <div className={`wl-card wl-card--compact wl-rec-card ${simTotals.reco.cls} wl-rec-card--border`}>
                  <span className="wl-card-label">Recomendação</span>
                  <span className="wl-rec-tit">{simTotals.reco.titulo}</span>
                  {simTotals.reco.subt ? <span className="wl-rec-sub">{simTotals.reco.subt}</span> : null}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="wl-sync-row">
          <div className="wl-sync-cell wl-sync-cell--plan">
            {areaId && !loading ? (
              <div className="card wl-section wl-novo-section wl-sync-section-fill">
                <h3 className="wl-section-title">Gráfico de barras semanais</h3>
                <p className="wl-muted" style={{ margin: '0 0 8px', fontSize: 12 }}>
                  Legenda: barras Planejado e Realizado; linhas de referência 32 h, 36 h e 40 h.
                </p>
                <WorkloadPlanningBarChart
                  labels={agPlan.labels}
                  planejado={agPlan.planejadoArr}
                  realizado={agPlan.realizadoArr}
                />
              </div>
            ) : (
              <div className="card wl-section wl-novo-section wl-sync-section-fill wl-sync-chart-placeholder" aria-hidden>
                <h3 className="wl-section-title">Gráfico de barras semanais</h3>
                <p className="wl-muted" style={{ margin: '0 0 8px', fontSize: 12 }}>
                  Selecione uma área e aguarde o carregamento para ver o gráfico de planejamento.
                </p>
                <div className="wl-chart-canvas-wrap wl-chart-canvas-wrap--fixed-h" />
              </div>
            )}
          </div>
          <div className="wl-sync-cell wl-sync-cell--sim">
            <div className="card wl-section wl-novo-section wl-sync-section-fill">
              <h3 className="wl-section-title">Gráfico de barras semanais (simulação)</h3>
              <p className="wl-muted" style={{ margin: '0 0 8px', fontSize: 12 }}>
                Legenda: Selecionado (planejado) e Simulação ajustada; capacidade e alerta 80%.
              </p>
              <WorkloadSimulacaoBarChart
                labels={agSimSelecao.labels.length ? agSimSelecao.labels : listaSemanasSim.map(w => `S${w}`)}
                dadosSelecionado={graficoSimDadosSelecao}
                dadosAjustado={graficoSimAzul}
                capTotalSemana={simTotals.capSemanal}
              />
            </div>
          </div>
        </div>

        <div className="wl-sync-row wl-sync-row--lists">
          <div className="wl-sync-cell wl-sync-cell--plan">
            {areaId && !loading ? (
              <div className="card wl-section wl-novo-section wl-sync-section-fill">
                <h3 className="wl-section-title">Comportamentos e atividades</h3>
                <div className="wl-novo-table-scroll wl-novo-table-scroll--plan">
                  {tarefas.length === 0 ? (
                    <p className="wl-muted">Nenhum comportamento nesta área.</p>
                  ) : (
                    tarefas.map(t => {
                      const g = grupoPorTarefaId[String(t.id)]
                      const temPlano = tarefaTemPlanejamentoGanttOuCronogramaNoPeriodo(
                        t,
                        planejamentoRows,
                        cronogramaRange,
                        planSemanasSet
                      )
                      const linhas =
                        g?.linhas?.length > 0
                          ? g.linhas
                          : (t.acoes || []).map(a => {
                              const tr = Number(a.tempo_estimado_minutos) / 60 || 0
                              const fx = fatorExecucoesRecorrenciaSemanal(a.recorrencia)
                              const lbl = RECORRENCIA_LABELS[a.recorrencia] || a.recorrencia || '—'
                              const fatorTexto =
                                fx >= 1 && String(a.recorrencia || '').toLowerCase() === 'diaria'
                                  ? `${tr.toFixed(1)} h · Diária · ${fx}×/sem`
                                  : `${tr.toFixed(1)} h · ${lbl} · ~${fx.toFixed(fx < 1 ? 2 : 0)}×/sem`
                              return {
                                acaoId: String(a.id),
                                nomeAcao: String(a.nome || '—').trim() || '—',
                                fatorTexto,
                                previsto: 0,
                                executado: 0
                              }
                            })
                      if (!linhas.length) return null
                      return (
                        <table
                          key={String(t.id)}
                          className={`wl-novo-detail-table${temPlano ? '' : ' wl-novo-detail-table--dim'}`}
                        >
                          <thead>
                            <tr className={`wl-novo-grupo-head${temPlano ? '' : ' wl-novo-grupo-head--dim'}`}>
                              <th colSpan={4}>
                                <div className="wl-cbh-row">
                                  {temPlano ? (
                                    <>
                                      <span className="wl-cbh-gantt-check" aria-hidden>✓</span>
                                      <span className="wl-cbh-badge">Gantt</span>
                                    </>
                                  ) : (
                                    <span className="wl-cbh-badge wl-cbh-badge--muted">Sem planejamento</span>
                                  )}
                                  <span className="wl-cbh-title">
                                    {String(t.nome || '—').trim() || '—'}
                                    {g?.metaNome && g.metaNome !== '—' ? ` · ${g.metaNome}` : ''}
                                  </span>
                                </div>
                              </th>
                            </tr>
                            <tr>
                              <th>Atividade</th>
                              <th>Recorrência / fator</th>
                              <th className="wl-num">Previsto (h)</th>
                              <th className="wl-num wl-th-exec">Executado (h)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {linhas.map(linha => (
                              <tr key={linha.acaoId}>
                                <td>{linha.nomeAcao}</td>
                                <td>{linha.fatorTexto || RECORRENCIA_LABELS[linha.recorrencia] || linha.recorrencia || '—'}</td>
                                <td className="wl-num">{Number(linha.previsto).toFixed(1)}</td>
                                <td className="wl-num wl-exec-val">{Number(linha.executado).toFixed(1)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="card wl-section wl-novo-section wl-sync-section-fill" aria-hidden>
                <h3 className="wl-section-title">Comportamentos e atividades</h3>
                <div className="wl-novo-table-scroll wl-novo-table-scroll--plan wl-sync-list-placeholder" />
              </div>
            )}
          </div>
          <div className="wl-sync-cell wl-sync-cell--sim">
            <div className="card wl-section wl-novo-section wl-sync-section-fill">
              <h3 className="wl-section-title">Atividades — selecione para incluir no cenário</h3>
              <div className="wl-sim-toolbar">
                <button type="button" className="btn btn-sm wl-sim-toolbar-btn" onClick={desmarcarTodasSim}>
                  Nenhuma
                </button>
                <button type="button" className="btn btn-sm wl-sim-toolbar-btn" onClick={marcarTodasSim}>
                  Selecionar todas
                </button>
                <button type="button" className="btn btn-sm wl-sim-toolbar-btn" onClick={espelharPlanejamento}>
                  Espelhar Planejamento
                </button>
              </div>
              <div className="wl-novo-table-scroll wl-novo-table-scroll--sim">
                {tarefas.length === 0 ? (
                  <p className="wl-muted">Sem comportamentos cadastrados.</p>
                ) : (
                  tarefas.map(t => (
                    <table key={`sim-${t.id}`} className="wl-novo-detail-table">
                      <thead>
                        <tr className="wl-novo-grupo-head">
                          <SimGrupoHeader tarefa={t} simIncluido={simIncluido} onToggleGrupo={toggleGrupoSim} />
                        </tr>
                        <tr>
                          <th className="wl-col-check-narrow" aria-label="Incluir" />
                          <th>Atividade</th>
                          <th>Recorrência / fator</th>
                          <th className="wl-num">Tempo planejado (h)</th>
                          <th className="wl-num">Tempo médio realizado (h)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(t.acoes || []).map(a => {
                          const id = String(a.id)
                          const media = mediaPorAcao[id]
                          const inc = simIncluido[id] === true
                          return (
                            <tr key={id} className={inc ? '' : 'wl-row--excluido'}>
                              <td>
                                <input
                                  type="checkbox"
                                  className="workload-wl-check"
                                  checked={inc}
                                  onChange={e => setSimIncluido(s => ({ ...s, [id]: e.target.checked }))}
                                />
                              </td>
                              <td>{String(a.nome || '—')}</td>
                              <td>
                                {(() => {
                                  const tr = (Number(a.tempo_estimado_minutos) || 0) / 60
                                  const fx = fatorExecucoesRecorrenciaSemanal(a.recorrencia)
                                  const lbl = RECORRENCIA_LABELS[a.recorrencia] || a.recorrencia || '—'
                                  if (String(a.recorrencia || '').toLowerCase() === 'diaria') {
                                    return `${tr.toFixed(1)} h · Diária · ${fx}×/sem`
                                  }
                                  return `${tr.toFixed(1)} h · ${lbl} · ~${fx.toFixed(fx < 1 ? 2 : 0)}×/sem`
                                })()}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  className="wl-novo-input-h"
                                  min={0}
                                  step={0.1}
                                  value={simHoras[id] ?? ''}
                                  disabled={!inc}
                                  onChange={e => {
                                    const v = Number(e.target.value.replace(',', '.'))
                                    setSimHoras(s => ({
                                      ...s,
                                      [id]: Number.isFinite(v) ? v : 0
                                    }))
                                  }}
                                />
                              </td>
                              <td className="wl-num wl-muted-strong">
                                {media != null && Number.isFinite(media) ? Math.round(media * 100) / 100 : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
