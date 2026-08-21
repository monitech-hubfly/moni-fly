/**
 * Agregações Workload Planejamento: cronograma + gantt_planejamento por semanas ISO.
 */

import {
  expandGanttSemanasParaGradeIso,
  isoWeek,
  semanasIsoAnoCalendario
} from './periodos'

export const WL_H_CAP_SEMANA = 40

/** Lista ordenada de semanas ISO dentro [wIni,wFim] contidas nas semanas do ano. */
export function semanasPickerIntervalo(ano, wIni, wFim, semanasDoAnoOverride) {
  const lista = semanasDoAnoOverride || semanasIsoAnoCalendario(ano)
  const a = Math.min(Number(wIni), Number(wFim))
  const b = Math.max(Number(wIni), Number(wFim))
  return lista.filter(w => Number(w) >= a && Number(w) <= b).map(Number).sort((x, y) => x - y)
}

/** Semanas ISO únicas 1–53, ordenadas (entrada para agregações). */
export function semanasOrdenadasUnicas(semanas) {
  const set = new Set(
    (semanas || []).map(Number).filter(n => Number.isFinite(n) && n >= 1 && n <= 53)
  )
  return Array.from(set).sort((a, b) => a - b)
}

/**
 * Semanas ISO do ano em que existe linha em `gantt_planejamento` (via expand),
 * restrito às semanas que existem no calendário civil do ano.
 */
export function semanasIsoComPlanejamentoGanttNasLinhas(planejamentoRows, anoRef) {
  const y = Number(anoRef)
  const grid = semanasIsoAnoCalendario(Number.isFinite(y) ? y : new Date().getFullYear())
  const set = new Set()
  for (const p of planejamentoRows || []) {
    const wks = expandGanttSemanasParaGradeIso(p, grid)
    wks.forEach(w => set.add(w))
  }
  return Array.from(set).sort((a, b) => a - b)
}

/** Há interseção entre planejamento Gantt da ação e o conjunto de semanas ISO. */
export function acaoTemGanttNasSemanasIso(acaoId, planejamentoRows, semanasSet) {
  if (!acaoId || !semanasSet?.size) return false
  const grid = [...semanasSet].sort((a, b) => a - b)
  const rows = (planejamentoRows || []).filter(p => String(p.acao_id) === String(acaoId))
  for (const p of rows) {
    if (expandGanttSemanasParaGradeIso(p, grid).length > 0) return true
  }
  return false
}

/** Ação com linha em cronograma em alguma das semanas ISO (horas ou status). */
export function acaoTemCronogramaNasSemanas(acaoId, cronogramaRows, semanasSet) {
  if (!acaoId || !semanasSet?.size) return false
  for (const c of cronogramaRows || []) {
    if (String(c.acao_id) !== String(acaoId)) continue
    const w = Number(c.semana)
    if (Number.isFinite(w) && semanasSet.has(w)) return true
  }
  return false
}

export function tarefaTemPlanejamentoGanttOuCronogramaNoPeriodo(tarefa, planejamentoRows, cronogramaRows, semanasSet) {
  for (const a of tarefa.acoes || []) {
    if (!a?.id) continue
    if (acaoTemGanttNasSemanasIso(a.id, planejamentoRows, semanasSet)) return true
    if (acaoTemCronogramaNasSemanas(a.id, cronogramaRows, semanasSet)) return true
  }
  return false
}

export function primeiraEUltimaDataTocandoSemanasIsoNoAno(ano, semanasSet) {
  const set = new Set((semanasSet || []).map(Number).filter(Number.isFinite))
  if (set.size === 0) return { inicio: null, fim: null }
  let minStr = null
  let maxStr = null
  const ini = new Date(Number(ano), 0, 1)
  const fim = new Date(Number(ano), 11, 31)
  const cur = new Date(ini)
  const pad = n => String(n).padStart(2, '0')
  while (cur <= fim) {
    const sn = isoWeek(cur)
    if (set.has(sn)) {
      const ys = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`
      if (minStr == null || ys < minStr) minStr = ys
      if (maxStr == null || ys > maxStr) maxStr = ys
    }
    cur.setDate(cur.getDate() + 1)
  }
  return { inicio: minStr, fim: maxStr }
}

/**
 * Soma horas planejadas (cronograma) + preenchimento por gantt sem linha de cronograma naquela semana.
 */
export function agregarPlanejadoRealizadoPorSemana({
  weeksList,
  cronogramaRows,
  planejamentoRows,
  acaoPorId
}) {
  const labels = [...weeksList].map(Number).sort((a, b) => a - b)
  const planned = Object.fromEntries(labels.map(w => [w, 0]))
  const done = Object.fromEntries(labels.map(w => [w, 0]))
  const gridSet = new Set(labels)

  const cronByAcaoSemana = new Set()
  for (const c of cronogramaRows || []) {
    const w = Number(c.semana)
    if (!gridSet.has(w)) continue
    const h = Number(c.horas_previstas)
    const hh = Number.isFinite(h) ? h : 0
    planned[w] += hh
    cronByAcaoSemana.add(`${String(c.acao_id)}|${w}`)
    if (String(c.status || '').toLowerCase() === 'concluido') {
      done[w] += hh
    }
  }

  for (const p of planejamentoRows || []) {
    const aid = p.acao_id
    if (!aid) continue
    const acao = acaoPorId[String(aid)]
    const tempoH = acao && acao.tempo_estimado_minutos != null
      ? Number(acao.tempo_estimado_minutos) / 60
      : 0
    if (!Number.isFinite(tempoH) || tempoH <= 0) continue
    const weeksHit = expandGanttSemanasParaGradeIso(p, labels)
    if (!weeksHit.length) continue
    const nh = weeksHit.filter(w => gridSet.has(w)).length
    if (nh === 0) continue
    const per = tempoH / weeksHit.length
    for (const w of weeksHit) {
      if (!gridSet.has(w)) continue
      const key = `${String(aid)}|${w}`
      if (cronByAcaoSemana.has(key)) continue
      planned[w] += per
    }
  }

  const planejadoArr = labels.map(w => planned[w] || 0)
  const realizadoArr = labels.map(w => done[w] || 0)
  return { labels: labels.map(w => `S${w}`), labelsNum: labels, planejadoArr, realizadoArr }
}

/** Total realizado até a semana ISO atual (inclusive); se `semanaAtualIso` ausente, soma todo o intervalo. */
export function totalRealizadoAteSemanaAtual(labelsNum, realizadoArr, semanaAtualIso) {
  const atual = Number(semanaAtualIso)
  let s = 0
  labelsNum.forEach((w, i) => {
    if (!Number.isFinite(atual) || w <= atual) s += realizadoArr[i] || 0
  })
  return s
}

export function semanaISOAtualSeNoIntervalo(dataInicio, dataFim) {
  const hoje = new Date()
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const t = ymd(hoje)
  if (!dataInicio || !dataFim) return isoWeek(hoje)
  if (t < dataInicio || t > dataFim) return null
  return isoWeek(hoje)
}

/** Fator texto para coluna «Recorrência» na tabela Workload (ex.: 5× por semana). */
export function fatorExecucoesRecorrenciaSemanal(recorrencia) {
  const r = String(recorrencia || '').toLowerCase()
  switch (r) {
    case 'diaria':
      return 5
    case 'unica':
      return 1
    case 'semanal':
      return 1
    case 'quinzenal':
      return 0.5
    case 'mensal':
      return 0.23
    case 'bimestral':
      return 0.115
    case 'trimestral':
      return 0.077
    case 'semestral':
      return 0.038
    case 'anual':
      return 0.019
    default:
      return 1
  }
}

/**
 * Linhas para tabela Planajemento: todas as acoes das tarefas, com previsto/executado no intervalo ISO.
 */
export function detalharAcoesPlanejamento({
  tarefas,
  weeksList,
  cronogramaRows,
  planejamentoRows,
  acaoPorId,
  objetivoNomePorId
}) {
  const listaW = [...weeksList].map(Number).filter(Number.isFinite).sort((a, b) => a - b)
  const gridSet = new Set(listaW)
  const previsto = {}
  const executado = {}
  const mark = id => {
    const k = String(id)
    if (!(k in previsto)) previsto[k] = 0
    if (!(k in executado)) executado[k] = 0
  }

  for (const c of cronogramaRows || []) {
    const w = Number(c.semana)
    if (!gridSet.has(w)) continue
    mark(c.acao_id)
    const h = Number(c.horas_previstas) || 0
    previsto[String(c.acao_id)] += h
    if (String(c.status || '').toLowerCase() === 'concluido') {
      executado[String(c.acao_id)] += h
    }
  }

  const cronKeys = new Set(
    (cronogramaRows || [])
      .filter(c => gridSet.has(Number(c.semana)))
      .map(c => `${String(c.acao_id)}|${Number(c.semana)}`)
  )

  for (const p of planejamentoRows || []) {
    const aid = p.acao_id
    const acao = acaoPorId[String(aid)]
    if (!acao) continue
    const tempoH = Number(acao.tempo_estimado_minutos) / 60 || 0
    if (tempoH <= 0) continue
    const weeksHit = expandGanttSemanasParaGradeIso(p, listaW)
    if (!weeksHit.length) continue
    mark(aid)
    const per = tempoH / weeksHit.length
    for (const w of weeksHit) {
      if (!gridSet.has(w)) continue
      if (cronKeys.has(`${String(aid)}|${w}`)) continue
      previsto[String(aid)] += per
    }
  }

  const grupos = (tarefas || []).map(t => {
    const metaNome =
      t.objetivo_id && objetivoNomePorId
        ? String(objetivoNomePorId[String(t.objetivo_id)] || '').trim() || '—'
        : '—'
    const linhas = (t.acoes || []).map(a => {
      const id = String(a.id)
      const pv = previsto[id] ?? 0
      const ex = executado[id] ?? 0
      const ocup = WL_H_CAP_SEMANA * listaW.length > 0 ? (pv / (WL_H_CAP_SEMANA * listaW.length)) * 100 : 0
      const tr = Number(a.tempo_estimado_minutos) / 60 || 0
      const fx = fatorExecucoesRecorrenciaSemanal(a.recorrencia)
      return {
        acaoId: id,
        nomeAcao: String(a.nome || 'Atividade').trim() || '—',
        recorrencia: String(a.recorrencia || 'unica'),
        tempoPorExecucaoH: tr,
        fatorTexto:
          fx >= 1 && String(a.recorrencia || '').toLowerCase() === 'diaria'
            ? `${tr.toFixed(1)} h · Diária · ${fx}×/sem`
            : `${tr.toFixed(1)} h · ${String(a.recorrencia || '—')} · ~${fx.toFixed(fx < 1 ? 2 : 0)}×/sem`,
        previsto: pv,
        executado: ex,
        ocupacaoPct: Math.min(100, ocup)
      }
    })
    return { tarefaId: t.id, comportamentoNome: String(t.nome || '—').trim() || '—', metaNome, linhas }
  }).filter(g => g.linhas.length > 0)

  return grupos
}

/** Média de horas por lançamento concluído no cronograma (histórico geral por ação). */
export function mediaHorasCronogramaConcluidoPorAcao(cronogramaAllRows, acaoIdSet) {
  const byAcao = {}
  for (const id of acaoIdSet || []) byAcao[String(id)] = { sum: 0, n: 0 }

  for (const c of cronogramaAllRows || []) {
    const id = String(c.acao_id)
    if (!(id in byAcao)) continue
    if (String(c.status || '').toLowerCase() !== 'concluido') continue
    const h = Number(c.horas_previstas) || 0
    byAcao[id].sum += h
    byAcao[id].n += 1
  }
  const avg = {}
  Object.keys(byAcao).forEach(id => {
    const { sum, n } = byAcao[id]
    avg[id] = n > 0 ? sum / n : null
  })
  return avg
}
