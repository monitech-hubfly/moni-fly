// @ts-nocheck
'use client';

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { listarAreas } from '@/utils/areasOrder'
import { isoWeek } from '@/utils/periodos'
import { TodoPainelSirene } from '@/components/carometro/todo/TodoPainelSirene'

const MAX_VISIBLE = 5

function PainelHeader({ titulo, badge, badgeStyle, expandido, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'none', border: 'none', borderRadius: expandido ? '8px 8px 0 0' : 8,
        padding: '10px 14px', cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1D2F25' }}>{titulo}</span>
        {badge != null && (
          <span style={{ fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 999, ...badgeStyle }}>
            {badge}
          </span>
        )}
      </span>
      <span style={{ fontSize: 12, color: '#888780', flexShrink: 0 }}>{expandido ? '▲' : '▼'}</span>
    </button>
  )
}

function ItemLista({ t, onClick }) {
  return (
    <div
      title={t.acaoNome}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
        borderBottom: '1px solid #f0ece5', cursor: 'pointer', fontSize: 13, color: '#1D2F25',
      }}
    >
      <span style={{
        flexShrink: 0, width: 7, height: 7, borderRadius: '50%',
        background: t.urgencia === 'atrasada' ? '#c62828' : '#1a5a8a',
      }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {t.acaoNome}
      </span>
      <span style={{ flexShrink: 0, fontSize: 11, color: '#888780' }}>S{t.semana}</span>
    </div>
  )
}

export default function Page() {
  const supabase = createClient()
  const router = useRouter()
  const [periodoId, setPeriodoId] = useState(null)
  const [periodo, setPeriodo] = useState(null)
  const [areas, setAreas] = useState([])
  const [ganttList, setGanttList] = useState([])
  const [cronogramaStatus, setCronogramaStatus] = useState({})
  const [filtroArea, setFiltroArea] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [filtroResponsavel, setFiltroResponsavel] = useState('')
  const [sireneStats, setSireneStats] = useState(null)

  const [expandidoAtrasadas, setExpandidoAtrasadas] = useState(true)
  const [expandidoSemana, setExpandidoSemana] = useState(true)
  const [expandidoSirene, setExpandidoSirene] = useState(true)
  const [verMaisAtrasadas, setVerMaisAtrasadas] = useState(false)
  const [verMaisSemana, setVerMaisSemana] = useState(false)

  useEffect(() => {
    async function carregarPeriodoAtual() {
      const hoje = new Date()
      const ano = hoje.getFullYear()
      const mesNum = hoje.getMonth() + 1
      const mes = String(mesNum).padStart(2, '0')

      const { data: porAnoMes, error: errAnoMes } = await supabase
        .from('periodos')
        .select('id')
        .eq('tipo', 'mes')
        .eq('ano', ano)
        .eq('numero', mesNum)
        .eq('ativo', true)
        .limit(1)
        .maybeSingle()
      if (!errAnoMes && porAnoMes?.id) { setPeriodoId(porAnoMes.id); return }

      const { data: porNome, error: errNome } = await supabase
        .from('periodos')
        .select('id')
        .eq('tipo', 'mes')
        .ilike('nome', `%${mes}/${ano}%`)
        .limit(1)
        .maybeSingle()
      if (!errNome && porNome?.id) { setPeriodoId(porNome.id); return }

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

  async function carregarDados() {
    if (!periodoId) return
    setLoading(true)
    setError(null)

    const { data: p, error: errPer } = await supabase.from('periodos').select('*').eq('id', periodoId).single()
    if (errPer) { setError(errPer.message); setLoading(false); return }
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

    const { data: ganttData, error: errGantt } = await supabase
      .from('gantt_planejamento')
      .select('id, acao_id, responsavel, semanas_selecionadas, semana_inicio, semana_fim, acoes(nome, tarefas(area_id))')
      .eq('periodo_id', periodoId)
    if (errGantt) { setError(errGantt.message); setLoading(false); return }
    const gantt = ganttData || []

    const acaoIds = gantt.map(g => g.acao_id).filter(Boolean)
    let cronoByKey = {}
    if (acaoIds.length > 0) {
      const { data: cronoList, error: errCrono } = await supabase
        .from('cronograma')
        .select('acao_id, semana, status')
        .eq('periodo_id', periodoId)
        .in('acao_id', acaoIds)
        .not('semana', 'is', null)
      if (errCrono) { setError(errCrono.message); setLoading(false); return }
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

  const semanaAtual = useMemo(() => isoWeek(new Date()), [])

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

  const tarefasAtrasadas = useMemo(() => todasTarefas.filter(t => t.urgencia === 'atrasada'), [todasTarefas])
  const tarefasSemana    = useMemo(() => todasTarefas.filter(t => t.urgencia === 'semana'),   [todasTarefas])
  const tarefasS1        = useMemo(() => todasTarefas.filter(t => t.semana === semanaAtual + 1), [todasTarefas, semanaAtual])
  const tarefasS2        = useMemo(() => todasTarefas.filter(t => t.semana === semanaAtual + 2), [todasTarefas, semanaAtual])
  const countProximas    = tarefasS1.length + tarefasS2.length

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <h1 className="carometro-page-title">TO DO — Entregas da semana</h1>
        <p className="carometro-page-subtitle">Atividades pendentes ordenadas por urgência e semana.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filtros */}
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
          {/* Resumo agrupado — 3 grupos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 28 }}>

            {/* Grupo 1 — Atividades planejadas */}
            <div style={{ border: '1px solid #e0d9ce', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: '#faf9f6', padding: '10px 14px', borderBottom: '1px solid #e0d9ce', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="ti ti-calendar-week" style={{ fontSize: 16, color: '#1D2F25' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1D2F25' }}>Atividades planejadas</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e0d9ce' }}>
                {[
                  { label: 'Atrasadas',    count: tarefasAtrasadas.length, bg: '#fef2f2', color: '#c62828' },
                  { label: 'Esta semana',  count: tarefasSemana.length,    bg: '#eff6ff', color: '#1a5a8a' },
                  { label: 'Próx. 2 sem.', count: countProximas,           bg: '#fff',    color: '#555'    },
                  { label: 'Total',        count: todasTarefas.length,     bg: '#fff',    color: '#888780' },
                ].map(c => (
                  <div key={c.label} style={{ background: c.bg, padding: '10px 12px' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.count}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{c.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grupo 2 — Sirene / Pastelaria */}
            <div style={{ border: '1px solid #e0d9ce', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: '#faf9f6', padding: '10px 14px', borderBottom: '1px solid #e0d9ce', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="ti ti-bell-ringing" style={{ fontSize: 16, color: '#b45309' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1D2F25' }}>Sirene / Pastelaria</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e0d9ce' }}>
                {[
                  { label: 'Abertos',   count: sireneStats?.total    ?? '—', bg: '#fffbeb', color: '#b45309' },
                  { label: 'Com trava', count: sireneStats?.comTrava ?? '—', bg: '#fef2f2', color: '#c62828' },
                  { label: 'Atrasados', count: sireneStats?.atrasados ?? '—',bg: '#fef2f2', color: '#c62828' },
                  { label: 'Sem prazo', count: sireneStats?.semPrazo ?? '—', bg: '#fff',    color: '#888780' },
                ].map(c => (
                  <div key={c.label} style={{ background: c.bg, padding: '10px 12px' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.count}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 1 }}>{c.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Grupo 3 — Cards e Prazos */}
            <div style={{ border: '1px solid #e0d9ce', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: '#faf9f6', padding: '10px 14px', borderBottom: '1px solid #e0d9ce', display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="ti ti-layout-kanban" style={{ fontSize: 16, color: '#888780' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1D2F25' }}>Cards e Prazos</span>
              </div>
              <div style={{ padding: '16px 14px', fontSize: 12, color: '#aaa9a6', fontStyle: 'italic' }}>
                Disponível após vincular responsável nos funnéis.
              </div>
            </div>
          </div>

          {/* Divisor — ATIVIDADES PLANEJADAS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa9a6', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Atividades planejadas</span>
            <div style={{ flex: 1, height: 1, background: '#e0d9ce' }} />
          </div>

          {/* Grid 1fr 1fr — Atrasadas + Esta Semana */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

            {/* Painel Atrasadas */}
            <div style={{ border: '1px solid #e0d9ce', borderRadius: 8 }}>
              <PainelHeader
                titulo="Atrasadas"
                badge={tarefasAtrasadas.length}
                badgeStyle={{ background: '#c62828', color: '#fff' }}
                expandido={expandidoAtrasadas}
                onToggle={() => setExpandidoAtrasadas(v => !v)}
              />
              {expandidoAtrasadas && (
                <>
                  {tarefasAtrasadas.length === 0 ? (
                    <div style={{ padding: '16px 14px', background: '#f0fdf4', borderRadius: '0 0 8px 8px', fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                      🎉 Parabéns, você não tem nada atrasado!
                    </div>
                  ) : (
                    <>
                      {(verMaisAtrasadas ? tarefasAtrasadas : tarefasAtrasadas.slice(0, MAX_VISIBLE)).map(t => (
                        <ItemLista key={t.id} t={t} onClick={() => router.push(`/carometro/gantt?area=${t.areaId}&semana=S${t.semana}`)} />
                      ))}
                      {tarefasAtrasadas.length > MAX_VISIBLE && (
                        <button
                          type="button"
                          onClick={() => setVerMaisAtrasadas(v => !v)}
                          style={{ width: '100%', padding: '8px', fontSize: 12, color: '#888780', background: 'none', border: 'none', borderTop: '1px solid #f0ece5', cursor: 'pointer' }}
                        >
                          {verMaisAtrasadas ? '▲ Ver menos' : `▼ Ver mais ${tarefasAtrasadas.length - MAX_VISIBLE}`}
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Painel Esta Semana */}
            <div style={{ border: '1px solid #e0d9ce', borderRadius: 8 }}>
              <PainelHeader
                titulo={`Esta semana — S${semanaAtual}`}
                badge={tarefasSemana.length}
                badgeStyle={{ background: '#1a5a8a', color: '#fff' }}
                expandido={expandidoSemana}
                onToggle={() => setExpandidoSemana(v => !v)}
              />
              {expandidoSemana && (
                <>
                  {tarefasSemana.length === 0 ? (
                    <div style={{ padding: '16px 14px', background: '#f0fdf4', borderRadius: '0 0 8px 8px', fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                      Nenhuma atividade para esta semana.
                    </div>
                  ) : (
                    <>
                      {(verMaisSemana ? tarefasSemana : tarefasSemana.slice(0, MAX_VISIBLE)).map(t => (
                        <ItemLista key={t.id} t={t} onClick={() => router.push(`/carometro/gantt?area=${t.areaId}&semana=S${t.semana}`)} />
                      ))}
                      {tarefasSemana.length > MAX_VISIBLE && (
                        <button
                          type="button"
                          onClick={() => setVerMaisSemana(v => !v)}
                          style={{ width: '100%', padding: '8px', fontSize: 12, color: '#888780', background: 'none', border: 'none', borderTop: '1px solid #f0ece5', cursor: 'pointer' }}
                        >
                          {verMaisSemana ? '▲ Ver menos' : `▼ Ver mais ${tarefasSemana.length - MAX_VISIBLE}`}
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Divisor — SIRENE / PASTELARIA */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa9a6', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Sirene / Pastelaria</span>
            <div style={{ flex: 1, height: 1, background: '#e0d9ce' }} />
          </div>

          {/* Painel Sirene — full width */}
          <div style={{ border: '1px solid #e0d9ce', borderRadius: 8, marginBottom: 24 }}>
            <PainelHeader
              titulo="🚨 Sirene / Pastelaria"
              badge={sireneStats != null ? `${sireneStats.total} aberto${sireneStats.total !== 1 ? 's' : ''}` : undefined}
              badgeStyle={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d' }}
              expandido={expandidoSirene}
              onToggle={() => setExpandidoSirene(v => !v)}
            />
            {expandidoSirene && (
              <div style={{ padding: '4px 0 12px' }}>
                {sireneStats?.total === 0 ? (
                  <div style={{ padding: '16px 14px', background: '#f0fdf4', fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                    🎉 Nenhuma Sirene em aberto para você!
                  </div>
                ) : (
                  <TodoPainelSirene onCountReady={setSireneStats} />
                )}
              </div>
            )}
          </div>

          {/* Divisor — CARDS E PRAZOS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa9a6', letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Cards e Prazos</span>
            <div style={{ flex: 1, height: 1, background: '#e0d9ce' }} />
          </div>

          {/* Banner Cards e Prazos */}
          <div style={{ border: '2px dashed #e0d9ce', borderRadius: 10, background: '#faf9f6', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <i className="ti ti-layout-kanban" style={{ fontSize: 28, color: '#c8c3bc', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1D2F25' }}>Cards e Prazos — Em construção</div>
              <div style={{ fontSize: 12, color: '#aaa9a6', marginTop: 4 }}>
                Disponível após vincular responsável nos funnéis.
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
