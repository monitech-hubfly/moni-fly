/**
 * Carômetro — Scorecard Executivo.
 * Dados: `cronograma` (acao_id → acoes.tarefa_id; semana ISO; periodo_id + status).
 * Comportamento no período: planejamento em `gantt_planejamento` OU dados em `cronograma` nas semanas ISO do período.
 * Engajamento por célula: sem planejamento Gantt na semana → "—"; senão % concluídas no cronograma / planejadas no Gantt.
 * Gantt: `semanas_selecionadas` (ISO) + `semana_inicio`/`semana_fim` (legado) via `ganttRowPlanejadoNaSemanaIso`.
 * Indicadores: `indicador_lancamentos` por `periodo_id` + `semana` (ISO).
 * Filtro de período: além do UUID selecionado, inclui todos os `periodos` que cruzam o mesmo intervalo de datas
 * (ex.: mês no filtro + trimestre onde o Gantt gravou o `periodo_id`).
 */
import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react'
import { supabase } from '../services/supabase'
import { registrarLog } from '../hooks/useAuditLog'
import { listarAreas } from '../utils/areasOrder'
import { useAdmin } from '../context/AdminContext'
import {
  statusSemaforoPorValor,
  normalizarEntradaCategorica,
  normalizarSemaforo
} from '../utils/semaforoFaixas'
import {
  semanasIsoNoIntervalo,
  labelPeriodo,
  parseSemanaIsoTextoArmazenada,
  isoWeek,
  isoWeekYear,
  segundaUtcIsoWeekStart,
  normalizarSemanasSelecionadasGantt,
  anoIsoParaSemanaNoIntervalo,
  expandGanttSemanasParaGradeIso,
  cronogramaColunaIsoNaGrade,
  posicaoRelativaParaSemanaIso
} from '../utils/periodos'
import SemanaComentarioPillHost from '../components/SemanaComentarioPillHost'

/** Semana ISO 8601 (UTC, semana começa na segunda). */
function getSemanaISO(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000 + 1) / 7))
}

function getSemanaISOAtual() {
  return getSemanaISO(new Date())
}

/**
 * Datas curtas segunda–domingo da semana ISO (ano civil aproximado para o período).
 */
function getDatasSemanaCurta(semanaISO, ano = new Date().getFullYear()) {
  const simples = new Date(Date.UTC(ano, 0, 1 + (semanaISO - 1) * 7))
  const diaSemana = simples.getUTCDay() || 7
  const segunda = new Date(simples)
  segunda.setUTCDate(simples.getUTCDate() - diaSemana + 1)
  const domingo = new Date(segunda)
  domingo.setUTCDate(segunda.getUTCDate() + 6)
  const fmt = d => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
  if (segunda.getUTCMonth() !== domingo.getUTCMonth()) {
    return `${fmt(segunda)}–${fmt(domingo)}`
  }
  return `${segunda.getUTCDate()}–${fmt(domingo)}`
}

/**
 * Semanas ISO do intervalo do período selecionado — mesma fonte que o Gantt (`semanasIsoNoIntervalo`).
 * Inteiros ordenados (ex.: [14, 15, 16, 17, 18]).
 */
function calcularSemanasISO(periodoTipo, selecaoId, periodoRow) {
  void periodoTipo
  void selecaoId
  if (!periodoRow?.data_inicio || !periodoRow?.data_fim) return []
  const arr = semanasIsoNoIntervalo(periodoRow.data_inicio, periodoRow.data_fim)
  const nums = arr.map(n => Number(n)).filter(n => Number.isFinite(n))
  return [...new Set(nums)].sort((a, b) => a - b)
}

function semanaEstaNaGrade(w, semanasSet) {
  const n = Number(w)
  if (!Number.isFinite(n)) return false
  if (semanasSet.has(n)) return true
  for (const x of semanasSet) {
    if (Number(x) === n) return true
  }
  return false
}

/** Texto para comparação de status (remove acentos — ex.: `concluído` vs `concluido`). */
function normalizarTextoStatusCar(s) {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Objetivo visível no Carômetro após filtro de ciclo de vida (inclui variantes acentuadas). */
function statusObjetivoIncluiCarometro(o) {
  const st = normalizarTextoStatusCar(o?.status)
  return st === 'ativo' || st === 'concluido'
}

/** Conclusão no cronograma — valores alternativos ao check constraint legado. */
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

/** Conclusão na coluna ISO da semana — paridade com `semana` ISO ou relativa no `cronograma`. */
function acaoConcluidaNaSemanaCronograma(
  cronogramaList,
  acaoId,
  semanaIsoNum,
  semanasGrid,
  dataInicioPorPeriodoCronoId,
  dataInicioVisualizadoCrono
) {
  for (const c of cronogramaList || []) {
    if (String(c.acao_id ?? '') !== String(acaoId ?? '')) continue
    const w = semanaCronogramaIsoNaGrade(c, semanasGrid, dataInicioPorPeriodoCronoId, dataInicioVisualizadoCrono)
    if (w == null || Number(w) !== Number(semanaIsoNum)) continue
    if (statusCronogramaConcluido(c.status)) return true
  }
  return false
}

/** Há planejamento Gantt (qualquer `periodo_id`) que cruza alguma semana ISO do período exibido. */
function ganttAcaoPlanejadaNoPeriodo(ganttRows, acaoId, semanasGrid, periodoRow) {
  const snArr = (semanasGrid || []).map(Number).filter(Number.isFinite)
  if (snArr.length === 0) return false
  return (ganttRows || []).some(g => {
    if (String(g.acao_id ?? '') !== String(acaoId ?? '')) return false
    return snArr.some(sn => ganttRowPlanejadoNaSemanaIso(g, sn, snArr, null, periodoRow))
  })
}

/** Planejamento Gantt da ação na coluna ISO `semanaIsoNum` (usa a grade completa do período). */
function ganttAcaoPlanejadaNaSemanaIso(ganttRows, acaoId, semanaIsoNum, semanasGrid, periodoRow) {
  const sn = Number(semanaIsoNum)
  if (!Number.isFinite(sn)) return false
  const grid = (semanasGrid || []).map(Number).filter(Number.isFinite)
  if (grid.length === 0) return false
  return (ganttRows || []).some(
    g =>
      String(g.acao_id ?? '') === String(acaoId ?? '') &&
      ganttRowPlanejadoNaSemanaIso(g, sn, grid, null, periodoRow)
  )
}

/** Ação com qualquer lançamento de cronograma já filtrado ao período (lista `cronoRows` do fetch). */
function acaoTemCronogramaNoPeriodoCar(cronoRows, acaoId) {
  return (cronoRows || []).some(c => String(c.acao_id ?? '') === String(acaoId ?? ''))
}

/** Semana ISO numérica gravada no cronograma (`semana` / `semana_ano` — no teu banco `semana` já é ISO). */
function cronogramaColunaSemanaIsoNumericaCar(c) {
  if (c?.semana_ano != null && c.semana_ano !== '') {
    const n = Number(String(c.semana_ano).trim().replace(',', '.'))
    if (Number.isFinite(n)) return n
  }
  const n = Number(c?.semana)
  return Number.isFinite(n) ? n : null
}

/** Linha do cronograma pertence a alguma coluna ISO do período (literal primeiro; fallback Gantt). */
function cronogramaLinhaCaiNaGradePeriodoCar(
  cr,
  semanasCalc,
  periodoDataInicioMap,
  dataInicioVisualizado,
  semanaGridArr
) {
  const grid = new Set((semanaGridArr || []).map(Number).filter(Number.isFinite))
  const lit = cronogramaColunaSemanaIsoNumericaCar(cr)
  if (lit != null && grid.has(lit)) return true
  const w = semanaCronogramaIsoNaGrade(cr, semanasCalc, periodoDataInicioMap, dataInicioVisualizado)
  return w != null && grid.has(Number(w))
}

/** Linhas do cronograma na semana ISO usando só `cronograma.semana` (paridade com negócio / SQL explícito). */
function cronogramaLinhasTarefaSemanaLiteral(cronoRows, acaoIdsSet, semanaIsoNum) {
  const sem = Number(semanaIsoNum)
  if (!Number.isFinite(sem)) return []
  return (cronoRows || []).filter(c => {
    if (!acaoIdsSet.has(String(c.acao_id ?? ''))) return false
    const ns = Number(c?.semana)
    return Number.isFinite(ns) && ns === sem
  })
}

/** Planeamento Gantt na semana: `semanas_selecionadas` explícitas OU lógica completa (início/fim legado). */
function temPlanejamentoNaSemanaEngajamentoCar(
  ganttRows,
  acoesDaTarefa,
  semanaIsoNum,
  semanasCalc,
  periodoRow
) {
  const sn = Number(semanaIsoNum)
  if (!Number.isFinite(sn)) return false
  for (const a of acoesDaTarefa || []) {
    const aid = String(a.id ?? '')
    for (const g of ganttRows || []) {
      if (String(g.acao_id ?? '') !== aid) continue
      const ss = normalizarSemanasSelecionadasGantt(g?.semanas_selecionadas)
      if (ss.some(w => Number(w) === sn)) return true
      if (ganttRowPlanejadoNaSemanaIso(g, sn, semanasCalc, null, periodoRow)) return true
    }
  }
  return false
}

/** Ações do comportamento planejadas na semana ISO via `gantt_planejamento.semanas_selecionadas`. */
function acoesPlanejadasNaSemanaGanttCar(ganttRows, acoesDaTarefa, semanaIsoNum) {
  const sn = Number(semanaIsoNum)
  if (!Number.isFinite(sn)) return []
  return (acoesDaTarefa || []).filter(acao => {
    const aid = String(acao.id ?? '')
    return (ganttRows || []).some(g => {
      if (String(g.acao_id ?? '') !== aid) return false
      const ss = normalizarSemanasSelecionadasGantt(g?.semanas_selecionadas)
      return ss.some(w => Number(w) === sn)
    })
  })
}

/**
 * Planejado na coluna ISO `sn`: modelo atual = `semanas_selecionadas` (semanas ISO do ano);
 * legado = `semana_inicio`/`semana_fim` internas 1–13 + conversão ISO→interna.
 */
/**
 * Paridade com Gantt.jsx `registrosPlanejamentoNaSemanaIso` / `expandGanttSemanasParaGradeIso`:
 * aceita intervalo ISO + seleção parcial ou só `semanas_selecionadas`; depois fallback legado.
 */
function ganttRowPlanejadoNaSemanaIso(g, semanaIsoNum, semanasGrid, _trimestrePorIdIgnorado, periodoRow) {
  const sn = Number(semanaIsoNum)
  if (!Number.isFinite(sn)) return false

  const semanasGridNorm = (semanasGrid || []).map(Number).filter(Number.isFinite)
  const gridSet = new Set(semanasGridNorm)

  const wk = expandGanttSemanasParaGradeIso(g, semanasGridNorm)
  if (wk.some(w => Number(w) === sn)) return true

  const ss = normalizarSemanasSelecionadasGantt(g?.semanas_selecionadas)
  if (ss.some(w => Number(w) === sn && gridSet.has(sn))) return true

  const si = g.semana_inicio != null ? Number(g.semana_inicio) : NaN
  const sf = g.semana_fim != null ? Number(g.semana_fim) : NaN
  if (!Number.isFinite(si) || !Number.isFinite(sf) || si > sf) return false

  let local = sn
  if (periodoRow?.data_inicio) {
    const dataInicio = new Date(`${String(periodoRow.data_inicio).slice(0, 10)}T12:00:00`)
    if (!Number.isNaN(dataInicio.getTime())) {
      const offsetTrimestreIso = isoWeek(dataInicio) - 1
      const interna = sn - offsetTrimestreIso
      if (Number.isFinite(interna) && interna >= 1 && interna <= 53) local = interna
    }
  }
  return si <= local && local <= sf
}

/**
 * Igual ao Gantt.jsx `semanaDbParaIsoNaGrade`: aceita ISO em `semana`/`semana_ano`,
 * ou `semana` como posição 1-based relativa a `periodos.data_inicio` da linha.
 * `dataInicioVisualizado`: fallback quando `periodo_id` é null (usa o período do filtro).
 */
function semanaLancamentoIndicadorParaGrade(row, semanasSet, dataInicioPorPeriodoId, dataInicioVisualizado = null) {
  const arr = Array.from(semanasSet).map(n => Number(n)).filter(n => Number.isFinite(n))
  const gridNums = new Set(arr)

  if (row.semana_ano != null && row.semana_ano !== '') {
    const raw = String(row.semana_ano).trim().replace(',', '.')
    const w = Number(raw)
    if (Number.isFinite(w) && gridNums.has(w)) return w
    const pw = parseSemanaIsoTextoArmazenada(row.semana_ano)
    if (pw != null && semanaEstaNaGrade(pw, semanasSet)) return Number(pw)
  }
  if (row.semana != null && row.semana !== '') {
    const sn = Number(row.semana)
    if (Number.isFinite(sn) && gridNums.has(sn)) return sn
  }

  const pid = row?.periodo_id != null && row?.periodo_id !== '' ? String(row.periodo_id) : ''
  const dataIni =
    pid && dataInicioPorPeriodoId?.[pid] != null ? dataInicioPorPeriodoId[pid] : !pid ? dataInicioVisualizado : null
  if (dataIni != null && row.semana != null && row.semana !== '') {
    const isoReal = posicaoRelativaParaSemanaIso(row.semana, dataIni)
    if (isoReal != null && gridNums.has(Number(isoReal))) return Number(isoReal)
  }

  const parsed = parseSemanaIsoTextoArmazenada(row.semana)
  if (parsed != null && semanaEstaNaGrade(parsed, semanasSet)) return parsed
  return null
}

/** Cronograma: ISO direto ou `semana_ano`; senão semana relativa ao `periodo_id` (paridade Gantt). */
function semanaCronogramaIsoNaGrade(cr, semanasGrid, dataInicioPorPeriodoId, dataInicioVisualizado = null) {
  const direct = cronogramaColunaIsoNaGrade(cr, semanasGrid)
  if (direct != null) return direct
  const gridNums = new Set(semanasGrid.map(n => Number(n)).filter(Number.isFinite))
  const pid = cr?.periodo_id != null && cr?.periodo_id !== '' ? String(cr.periodo_id) : ''
  const ini =
    pid && dataInicioPorPeriodoId?.[pid] != null ? dataInicioPorPeriodoId[pid] : !pid ? dataInicioVisualizado : null
  if (ini != null && cr?.semana != null && cr.semana !== '') {
    const iso = posicaoRelativaParaSemanaIso(cr.semana, ini)
    if (iso != null && gridNums.has(Number(iso))) return Number(iso)
  }
  return null
}

/**
 * A coluna `semanaIso` (1–53) no intervalo do período já é estritamente anterior à semana ISO corrente real
 * (comparação por segunda UTC — evita comparar só o número da semana entre anos diferentes).
 */
function semanaPassadaParaEngajamento(semanaIsoNum, periodoRow, agora = new Date()) {
  if (!periodoRow?.data_inicio || !periodoRow?.data_fim) return false
  const sn = Number(semanaIsoNum)
  if (!Number.isFinite(sn)) return false
  const yn = anoIsoParaSemanaNoIntervalo(sn, periodoRow.data_inicio, periodoRow.data_fim)
  const colMon = segundaUtcIsoWeekStart(yn, sn)
  if (!colMon || Number.isNaN(colMon.getTime())) return false
  const y0 = isoWeekYear(agora)
  const w0 = isoWeek(agora)
  const curMon = segundaUtcIsoWeekStart(y0, w0)
  if (!curMon || Number.isNaN(curMon.getTime())) return false
  return colMon.getTime() < curMon.getTime()
}

/** Linhas do cronograma do comportamento na coluna ISO (converte semana relativa → ISO como no Gantt). */
function cronogramaLinhasComportamentoSemanaIso(
  cronoRows,
  acaoIdsSet,
  semanaIsoNum,
  semanasGrid,
  dataInicioPorPeriodoCronoId,
  dataInicioVisualizadoCrono
) {
  const sn = Number(semanaIsoNum)
  if (!Number.isFinite(sn)) return []
  return (cronoRows || []).filter(c => {
    if (!acaoIdsSet.has(String(c.acao_id ?? ''))) return false
    const w = semanaCronogramaIsoNaGrade(c, semanasGrid, dataInicioPorPeriodoCronoId, dataInicioVisualizadoCrono)
    return w != null && Number(w) === sn
  })
}

/**
 * Engajamento por comportamento/semana: concluídas no cronograma / planejadas no Gantt.
 * Denominador = `gantt_planejamento` do período visualizado; sem planejamento na semana → null.
 */
function calcularEngajamentoSemana(tarefaId, semanaISO, acoes, cronoRows, ganttPlan) {
  const acoesDaTarefa = (acoes || []).filter(a => a.tarefa_id === tarefaId)
  if (acoesDaTarefa.length === 0) return null
  const acaoIds = acoesDaTarefa.map(a => a.id)
  const sn = Number(semanaISO)
  if (!Number.isFinite(sn)) return null

  const planejadosNaSemana = (ganttPlan || []).filter(
    g =>
      acaoIds.includes(g.acao_id) &&
      Array.isArray(g.semanas_selecionadas) &&
      g.semanas_selecionadas.map(Number).includes(sn)
  )

  if (planejadosNaSemana.length === 0) return null

  const semanaAtual = getSemanaISO()
  if (sn > semanaAtual) {
    const temConclusao = (cronoRows || []).some(
      c =>
        acaoIds.includes(c.acao_id) &&
        Number(c.semana) === sn &&
        statusCronogramaConcluido(c.status)
    )
    if (!temConclusao) return null
  }

  const concluidas = (cronoRows || []).filter(
    c =>
      acaoIds.includes(c.acao_id) &&
      Number(c.semana) === sn &&
      statusCronogramaConcluido(c.status)
  ).length

  return Math.round((concluidas / planejadosNaSemana.length) * 100)
}

/** Faixas de cor do engajamento de comportamentos (células e status). */
function corEngajamento(pct) {
  if (pct === null || pct === undefined) return 'sem-dado'
  if (pct < 30) return 'vermelho'
  if (pct < 60) return 'amarelo'
  if (pct < 75) return 'verde-claro'
  return 'verde-escuro'
}

function codEsforcoPorPctEngajamento(pct) {
  const map = {
    'verde-escuro': 'e100',
    'verde-claro': 'e75',
    amarelo: 'e50',
    vermelho: 'elow',
    'sem-dado': 'ena'
  }
  return map[corEngajamento(pct)] ?? 'ena'
}

function estiloBadgeEngajamentoComportamento(pct) {
  switch (corEngajamento(pct)) {
    case 'verde-escuro':
      return { background: '#1A5C38', color: '#fff' }
    case 'verde-claro':
      return { background: '#27AE60', color: '#fff' }
    case 'amarelo':
      return { background: '#F1C40F', color: '#333' }
    case 'vermelho':
      return { background: '#C0392B', color: '#fff' }
    default:
      return null
  }
}

/**
 * Engajamento no período (só semanas passadas): soma concluídas / (total de ações × semanas passadas).
 */
function calcularEngajamentoPeriodo(
  tarefaId,
  semanasNoPeriodo,
  acoesRows,
  cronogramaList,
  ganttPlanejamento,
  semanasGrid,
  periodoRow,
  dataInicioPorPeriodoCronoId,
  dataInicioVisualizadoCrono
) {
  void ganttPlanejamento
  const acoesDaTarefa = acoesRows.filter(a => a.tarefa_id === tarefaId)
  const totalAcoes = acoesDaTarefa.length
  if (totalAcoes === 0) return null
  const semanasPasadas = (semanasNoPeriodo || [])
    .map(Number)
    .filter(w => Number.isFinite(w) && semanaPassadaParaEngajamento(w, periodoRow))
  if (semanasPasadas.length === 0) return null

  const slots = totalAcoes * semanasPasadas.length
  let totalConcluidas = 0
  for (const semana of semanasPasadas) {
    const sn = Number(semana)
    for (const a of acoesDaTarefa) {
      if (
        acaoConcluidaNaSemanaCronograma(
          cronogramaList,
          a.id,
          sn,
          semanasGrid,
          dataInicioPorPeriodoCronoId,
          dataInicioVisualizadoCrono
        )
      ) {
        totalConcluidas++
      }
    }
  }
  if (slots === 0) return null
  return Math.round((totalConcluidas / slots) * 100)
}

function mergeLancRows(base, extra) {
  const key = r => `${r.indicador_id}|${r.semana}|${String(r.periodo_id ?? '')}`
  const byKey = new Map((base || []).filter(Boolean).map(r => [key(r), r]))
  ;(extra || []).forEach(r => {
    if (r && !byKey.has(key(r))) byKey.set(key(r), r)
  })
  return Array.from(byKey.values())
}

/** PostgREST: coluna ausente / schema cache — tentar próximo SELECT reduzido. */
function erroColunaOuSchemaSupabase(err) {
  const m = String(err?.message ?? err ?? '').toLowerCase()
  if (!m) return false
  return (
    m.includes('does not exist') ||
    m.includes('column') ||
    m.includes('schema cache') ||
    m.includes('could not find') ||
    m.includes('pgrst')
  )
}

/**
 * Cadeia do banco: areas → objetivos → tarefas (comportamentos) → acoes → cronograma.
 * `tarefas`: apenas colunas confirmadas. Chave = `acoes.caneta_verde`.
 */
async function selectTarefasCarometro(supabase, objIds, areaIds) {
  let sel = 'id, nome, objetivo_id, area_id'
  const LOTE_TAR = 15
  const buscarEmLotes = async (field, ids, qExtra = q => q) => {
    const acc = []
    for (let i = 0; i < (ids || []).length; i += LOTE_TAR) {
      const lote = ids.slice(i, i + LOTE_TAR)
      let q = supabase.from('tarefas').select(sel).in(field, lote)
      q = qExtra(q)
      const r = await q
      if (r.error) return { data: null, error: r.error }
      if (r.data?.length) acc.push(...r.data)
    }
    return { data: acc, error: null }
  }

  let r1 = await buscarEmLotes('objetivo_id', objIds)
  if (r1.error) return { error: r1.error, sel }

  let tarefasSoArea = []
  if ((areaIds || []).length > 0) {
    let r2 = await buscarEmLotes('area_id', areaIds, q => q.is('objetivo_id', null))
    if (r2.error) return { error: r2.error, sel }
    tarefasSoArea = r2.data || []
  }

  return {
    tCom: r1.data || [],
    tarefasSoArea,
    sel,
    flags: { hasResponsavelCol: false }
  }
}

function comportamentoEhChavePorCaneta(acoesDaTarefa) {
  return (acoesDaTarefa || []).some(a => String(a?.caneta_verde ?? '').toLowerCase() === 'sim')
}

/** statusSemaforoPorValor → ive | ivc | iam | ivm | ina */
function mapSemaforoParaCar(st) {
  if (st == null) return 'ina'
  const m = { ve: 'ive', vc: 'ivc', am: 'iam', vm: 'ivm' }
  return m[st] || 'ina'
}

/**
 * Semáforo por célula no Carômetro: regras cadastradas + qualitativo OK/Andamento/Não OK → cores da legenda.
 * Andamento → ivc (Atingiu), não iam — alinhado à aba Indicadores.
 */
function statusCarometroIndicadorCelula(ind, valor) {
  if (valor == null || String(valor).trim() === '') return 'ina'

  const tipoDb = String(ind?.tipo ?? '').toLowerCase()
  const uni = String(ind?.unidade ?? '')
  const escala = normalizarSemaforo(ind).escala_tipo
  const qualExplicito =
    tipoDb === 'qualitativo' || (uni.includes('OK') && uni.includes('Andamento')) || escala === 'status_3'

  if (qualExplicito) {
    const vNorm = normalizarEntradaCategorica(valor, 'status_3')
    if (vNorm) {
      if (vNorm === 'OK') return 'ive'
      if (vNorm === 'ANDAMENTO') return 'ivc'
      if (vNorm === 'NAO_OK') return 'ivm'
      return 'ivm'
    }
  }

  const st = statusSemaforoPorValor(ind, valor)
  return mapSemaforoParaCar(st)
}

/** Badges de engajamento de comportamentos — faixas <30 / 30–59 / 60–74 / ≥75 */
const BADGE_COMPORT_SOLID = {
  e100: { background: '#1A5C38', color: '#fff' },
  e75: { background: '#27AE60', color: '#fff' },
  e50: { background: '#F1C40F', color: '#333' },
  elow: { background: '#C0392B', color: '#fff' }
}

const BADGE_IND_SOLID = {
  ive: { background: '#2e7d32', color: '#fff' },
  ivc: { background: '#8bc34a', color: '#fff' },
  iam: { background: '#e6a817', color: '#fff' },
  ivm: { background: '#e74c3c', color: '#fff' }
}

/** Cor do badge pela % (coluna Status e células com número) */
function estiloBadgePctSolido(pct) {
  if (pct == null || Number.isNaN(pct)) return null
  if (pct >= 75) return { background: '#2e7d32', color: '#fff' }
  if (pct >= 60) return { background: '#8bc34a', color: '#fff' }
  if (pct >= 30) return { background: '#e6a817', color: '#fff' }
  return { background: '#e74c3c', color: '#fff' }
}

/** Arquivos em public/image/ — respeita `import.meta.env.BASE_URL` (ex.: deploy em subpasta). */
function publicImageUrl(fileName) {
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}image/${fileName}`.replace(/\/{2,}/g, '/')
}

/** Mapeia código de semáforo da grade (ive|ivc|iam|ivm|ina) → PNG em public/image/. */
function getCarinhaPathPorCodigoInd(cod) {
  switch (cod) {
    case 'ive':
      return publicImageUrl('Dark_Green.png')
    case 'ivc':
      return publicImageUrl('Green.png')
    case 'iam':
      return publicImageUrl('Yellow.png')
    case 'ivm':
      return publicImageUrl('Red.png')
    case 'ina':
    default:
      return publicImageUrl('White.png')
  }
}

function getLabelPorCodigoInd(cod) {
  switch (cod) {
    case 'ive':
      return '≥75% · Ótimo'
    case 'ivc':
      return '60–74% · Bom'
    case 'iam':
      return '30–59% · Atenção'
    case 'ivm':
      return '< 30% · Crítico'
    case 'ina':
    default:
      return 'Sem dado'
  }
}

/** Mapeia código de esforço da grade (e100|e75|e50|elow|ena) → PNG em public/image/. */
function getCarinhaPathPorCodigoComp(cod) {
  switch (cod) {
    case 'e100':
      return publicImageUrl('Dark_Green.png')
    case 'e75':
      return publicImageUrl('Green.png')
    case 'e50':
      return publicImageUrl('Yellow.png')
    case 'elow':
      return publicImageUrl('Red.png')
    case 'ena':
    default:
      return publicImageUrl('White.png')
  }
}

function getLabelPorCodigoComp(cod) {
  switch (cod) {
    case 'e100':
      return '≥75% · Ótimo'
    case 'e75':
      return '60–74% · Bom'
    case 'e50':
      return '30–59% · Atenção'
    case 'elow':
      return '< 30% · Crítico'
    case 'ena':
    default:
      return 'Sem dado'
  }
}

function getBackgroundPosition(carinhaPath) {
  const p = String(carinhaPath ?? '')
  if (p.includes('Dark_Green')) return 'center 10%'
  if (p.includes('Green')) return 'center 15%'
  if (p.includes('Yellow')) return 'center 15%'
  if (p.includes('Red')) return 'center 20%'
  if (p.includes('White')) return 'center 15%'
  return 'center 15%'
}

function CarinhaBlocoResumo({ tipo, codigo, labelColor, imgAlt = 'carinha', carinhaVisible }) {
  const carinhaPath =
    tipo === 'ind' ? getCarinhaPathPorCodigoInd(codigo) : getCarinhaPathPorCodigoComp(codigo)
  const label = tipo === 'ind' ? getLabelPorCodigoInd(codigo) : getLabelPorCodigoComp(codigo)
  const estiloCirculoCarinha = carinhaVisible
    ? {
        width: 110,
        height: 110,
        borderRadius: '50%',
        backgroundImage: `url(${carinhaPath})`,
        backgroundSize: '180%',
        backgroundPosition: getBackgroundPosition(carinhaPath),
        backgroundRepeat: 'no-repeat',
        flexShrink: 0,
        overflow: 'hidden'
      }
    : {
        width: 110,
        height: 110,
        borderRadius: '50%',
        flexShrink: 0,
        overflow: 'hidden'
      }
  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: 120
      }}
    >
      {carinhaVisible ? (
        <div style={estiloCirculoCarinha} role="img" aria-label={imgAlt} />
      ) : (
        <div style={estiloCirculoCarinha} aria-hidden />
      )}
      <span style={{ fontSize: 10, fontWeight: 500, textAlign: 'center', color: labelColor }}>
        {label}
      </span>
    </div>
  )
}

function pillClassPorCodComp(cod) {
  const map = {
    e100: 'pill-verde-escuro',
    e75: 'pill-verde-claro',
    e50: 'pill-amarelo',
    elow: 'pill-vermelho',
    ena: 'pill-vazio'
  }
  return map[cod] ?? 'pill-vazio'
}

function pillClassPorCodInd(cod) {
  const map = {
    ive: 'pill-verde-escuro',
    ivc: 'pill-verde-claro',
    iam: 'pill-amarelo',
    ivm: 'pill-vermelho',
    ina: 'pill-vazio'
  }
  return map[cod] ?? 'pill-vazio'
}

function pillClassPorPctEngajamento(pct) {
  const map = {
    'verde-escuro': 'pill-verde-escuro',
    'verde-claro': 'pill-verde-claro',
    amarelo: 'pill-amarelo',
    vermelho: 'pill-vermelho',
    'sem-dado': 'pill-vazio'
  }
  return map[corEngajamento(pct)] ?? 'pill-vazio'
}

function SemBadge({ children, variant, empty, style, className }) {
  const cls = ['sem-badge']
  if (variant === 'cell') cls.push('sem-badge--cell')
  if (variant === 'status') cls.push('sem-badge--status')
  if (variant === 'legend') cls.push('sem-badge--legend')
  if (empty && !className) cls.push('sem-badge--empty')
  if (className) cls.push(className)
  const usePill = className && String(className).startsWith('pill-')
  return (
    <span className={cls.join(' ')} style={usePill ? undefined : empty ? undefined : style}>
      {children}
    </span>
  )
}

/** Cor de texto, barra e faixa descritiva a partir do % (cards resumo). */
function getCorPorcentagem(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) {
    return { cor: '#888780', barCor: '#C0BDB4', label: 'Sem dado' }
  }
  if (pct >= 75) return { cor: '#1b5e20', barCor: '#2e7d32', label: '≥75% · Ótimo' }
  if (pct >= 60) return { cor: '#1b5e20', barCor: '#8bc34a', label: '60–74% · Bom' }
  if (pct >= 30) return { cor: '#e6a817', barCor: '#e6a817', label: '30–59% · Atenção' }
  return { cor: '#b71c1c', barCor: '#e74c3c', label: '<30% · Crítico' }
}

/** Cor do texto do label da carinha (resultado médio do mês) — cards de resumo. */
function corLabelFaixaResultadoMedioMes(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return 'var(--color-text-secondary)'
  if (pct >= 75) return '#1b5e20'
  if (pct >= 60) return '#33691e'
  if (pct >= 30) return '#e6a817'
  return '#b71c1c'
}

/** Valores grandes — card Engajamento (faixas). */
function corValorGrandeEngajamento(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return 'var(--color-text-secondary)'
  if (pct >= 75) return '#1b5e20'
  if (pct >= 60) return '#33691e'
  if (pct >= 30) return '#e6a817'
  return '#b71c1c'
}

function corBarraFaixa(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return 'var(--color-border-tertiary)'
  if (pct >= 75) return '#2e7d32'
  if (pct >= 60) return '#8bc34a'
  if (pct >= 30) return '#e6a817'
  return '#e74c3c'
}

function BarraProgresso({ pct }) {
  const p = pct != null && !Number.isNaN(pct) ? Number(pct) : null
  const tem = p != null
  const fill = corBarraFaixa(pct)
  const w = tem ? Math.min(100, Math.max(0, p)) : 0
  return (
    <div
      style={{
        height: 3,
        borderRadius: 2,
        width: '80%',
        margin: '4px auto 0',
        overflow: 'hidden',
        background: '#e0e0e0'
      }}
    >
      <div
        style={{
          height: '100%',
          borderRadius: 2,
          width: tem ? `${w}%` : '100%',
          background: tem ? fill : 'var(--color-border-tertiary)'
        }}
      />
    </div>
  )
}

function CelulaSemanaComportamento({ cod, pct, comentarioTooltip }) {
  const p = pct != null && !Number.isNaN(pct) ? Math.round(pct) : null
  const wrap = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 2px'
  }
  const tip = comentarioTooltip != null ? String(comentarioTooltip).trim() : ''
  const dotsPlan = cod === 'ena' || p == null
  if (cod === 'ena' || p == null) {
    const badge = (
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <SemBadge variant="cell" className="pill-vazio">
          —
        </SemBadge>
        {tip ? (
          <span className={`gantt-comentario-dots${dotsPlan ? ' gantt-comentario-dots--plan' : ''}`} aria-hidden>
            ···
          </span>
        ) : null}
      </span>
    )
    return (
      <div style={wrap}>
        {tip ? <SemanaComentarioPillHost tooltipText={tip}>{badge}</SemanaComentarioPillHost> : badge}
      </div>
    )
  }
  const badge = (
    <SemBadge
      variant="cell"
      className={pillClassPorCodComp(cod)}
      style={tip ? { position: 'relative', display: 'inline-block' } : undefined}
    >
      {p}%
      {tip ? (
        <span className={`gantt-comentario-dots${dotsPlan ? ' gantt-comentario-dots--plan' : ''}`} aria-hidden>
          ···
        </span>
      ) : null}
    </SemBadge>
  )
  return (
    <div style={wrap}>
      {tip ? <SemanaComentarioPillHost tooltipText={tip}>{badge}</SemanaComentarioPillHost> : badge}
    </div>
  )
}

function PillStatusComportamento({ cod, pctMedia }) {
  void cod
  const pct =
    pctMedia != null && !Number.isNaN(pctMedia) ? Math.round(Number(pctMedia)) : null
  if (pct == null) {
    return (
      <SemBadge variant="status" className="pill-vazio">
        —
      </SemBadge>
    )
  }
  return (
    <SemBadge variant="status" className={pillClassPorPctEngajamento(pct)}>
      {pct}%
    </SemBadge>
  )
}

function PillStatusIndicador({ cod, pctMedia }) {
  void cod
  const pct =
    pctMedia != null && !Number.isNaN(pctMedia) ? Math.round(Number(pctMedia)) : null
  if (pct == null) {
    return (
      <SemBadge variant="status" className="pill-vazio">
        —
      </SemBadge>
    )
  }
  return (
    <SemBadge variant="status" className={pillClassPorPctEngajamento(pct)}>
      {pct}%
    </SemBadge>
  )
}

function CelulaIndicadorSemana({ cod, valor, comentarioTooltip }) {
  const raw = valor != null ? String(valor).trim() : ''
  const n = Number(raw.replace(',', '.'))
  const showNum = raw !== '' && !Number.isNaN(n) && Number.isFinite(n) && cod !== 'ina'
  const indLabels = { ive: 'Superou', ivc: 'Atingiu', iam: 'Abaixo', ivm: 'Crítico', ina: '—' }
  const wrap = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 2px'
  }
  const tip = comentarioTooltip != null ? String(comentarioTooltip).trim() : ''
  const dotsPlan = cod === 'ina'
  if (cod === 'ina') {
    const badge = (
      <span style={{ position: 'relative', display: 'inline-block' }}>
        <SemBadge variant="cell" className="pill-vazio">
          —
        </SemBadge>
        {tip ? (
          <span className={`gantt-comentario-dots${dotsPlan ? ' gantt-comentario-dots--plan' : ''}`} aria-hidden>
            ···
          </span>
        ) : null}
      </span>
    )
    return (
      <div style={wrap}>
        {tip ? <SemanaComentarioPillHost tooltipText={tip}>{badge}</SemanaComentarioPillHost> : badge}
      </div>
    )
  }
  let content = indLabels[cod] ?? '—'
  if (showNum) content = raw
  else if (raw !== '') content = raw
  const badge = (
    <SemBadge
      variant="cell"
      className={pillClassPorCodInd(cod)}
      style={tip ? { position: 'relative', display: 'inline-block' } : undefined}
    >
      {content}
      {tip ? (
        <span className={`gantt-comentario-dots${dotsPlan ? ' gantt-comentario-dots--plan' : ''}`} aria-hidden>
          ···
        </span>
      ) : null}
    </SemBadge>
  )
  return (
    <div style={wrap}>
      {tip ? <SemanaComentarioPillHost tooltipText={tip}>{badge}</SemanaComentarioPillHost> : badge}
    </div>
  )
}

/**
 * Fonte única para filtro de área: `areasMultiplas` (painel) + fallback `areaSelecionada`
 * quando o array ainda não foi preenchido — evita carregar só uma área por estado inconsistente.
 */
function resolverFiltroAreasCarometro(areasMultiplas, areaSelecionada) {
  const raw = (areasMultiplas || []).filter(Boolean)
  const temGeral = raw.includes('geral')
  let filtroGeral = raw.length === 0 || temGeral
  let areaIdsFiltro = filtroGeral ? [] : raw.filter(a => a !== 'geral')
  if (raw.length === 0 && areaSelecionada && areaSelecionada !== 'geral') {
    filtroGeral = false
    areaIdsFiltro = [areaSelecionada]
  }
  return { filtroGeral, areaIdsFiltro }
}

function idObjetivoIgual(a, b) {
  if (a == null || b == null) return false
  return String(a).replace(/-/g, '').toLowerCase() === String(b).replace(/-/g, '').toLowerCase()
}

function metaIdCanonica(metas, oid) {
  if (oid == null) return oid
  const found = (metas || []).find(m => idObjetivoIgual(m.id, oid))
  return found?.id ?? oid
}

function primeiroObjetivoDaArea(objetivos, areaId) {
  if (!areaId) return null
  const list = (objetivos || []).filter(o => o.area_id === areaId)
  list.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0))
  return list[0] || null
}

/**
 * Tarefa só com `area_id` (sem `objetivo_id`): tenta meta cuja descrição cruza com o nome da tarefa;
 * senão mantém a primeira meta da área por `ordem` (paridade Gantt com menos erro de agrupamento).
 */
function metaParaTarefaSemObjetivo(objetivos, areaId, nomeTarefa) {
  const list = (objetivos || []).filter(o => o.area_id === areaId)
  if (!list.length) return null
  const tn = normalizarTextoStatusCar(nomeTarefa).replace(/\s+/g, ' ')
  if (tn.length >= 3) {
    let best = null
    let bestScore = -1
    for (const o of list) {
      const desc = normalizarTextoStatusCar(o.descricao).replace(/\s+/g, ' ')
      let score = 0
      if (desc && (tn.includes(desc) || desc.includes(tn))) score += 200
      for (const tok of desc.split(/\s+/).filter(x => x.length >= 4)) {
        if (tn.includes(tok)) score += 25
      }
      for (const tok of tn.split(/\s+/).filter(x => x.length >= 4)) {
        if (desc.includes(tok)) score += 25
      }
      const tie = (Number(o.ordem) || 0) * 0.0001
      if (score - tie > bestScore) {
        bestScore = score - tie
        best = o
      }
    }
    if (best && bestScore >= 25) return best
  }
  return primeiroObjetivoDaArea(objetivos, areaId)
}

/** Gantt carrega tarefas por área; comportamentos sem `objetivo_id` herdam a primeira meta da mesma área. */
function mesclarComportamentosComMetas(objetivos, tarefasComObjetivo, tarefasSoArea) {
  const byId = new Map()
  for (const t of tarefasComObjetivo || []) byId.set(t.id, { ...t })
  for (const t of tarefasSoArea || []) {
    if (byId.has(t.id)) continue
    const meta = metaParaTarefaSemObjetivo(objetivos, t.area_id, t.nome || t.descricao)
    if (!meta) continue
    byId.set(t.id, { ...t, objetivo_id: meta.id })
  }
  return Array.from(byId.values())
}

/** Gantt carrega indicadores por `area_id` e redistribui às metas; mesma lógica aqui. */
function mesclarIndicadoresNasMetas(objetivos, indicadoresPorArea) {
  const objIdSet = new Set((objetivos || []).map(o => o.id).filter(Boolean))
  const out = []
  for (const ind of indicadoresPorArea || []) {
    const canon = metaIdCanonica(objetivos, ind.objetivo_id)
    if (canon && objIdSet.has(canon)) {
      out.push({ ...ind, objetivo_id: canon })
      continue
    }
    const meta = primeiroObjetivoDaArea(objetivos, ind.area_id)
    if (meta) out.push({ ...ind, objetivo_id: meta.id })
  }
  return out
}

/** Ordenação estável quando não há id/criado_em no select (schema mínimo). */
function ordenarLancamentosIndicadorParaGradeCar(rows) {
  if (!rows?.length) return rows
  return [...rows]
}

/** Prazo na UI: no banco não há coluna `prazo`; o app grava a semana-alvo em `meta_unidade` como "S13". */
function prazoExibicaoObjetivo(meta) {
  const u = String(meta?.meta_unidade ?? '').trim()
  if (/^S\d+$/i.test(u)) return u.replace(/^s/i, 'S')
  return null
}

/**
 * Monta árvore área → metas → comportamentos / indicadores com cores por semana.
 * esforco: tarefaId → { [semanaISO]: código }; esforcoPct: mesmo id → % numérico ou null
 */
function agruparPorAreaEMeta({
  areas,
  objetivos,
  tarefas,
  indicadores,
  esforco,
  esforcoPct,
  pctPeriodoPorComportamento,
  semaf,
  indValorPorSemana,
  semanas,
  visualizacao
}) {
  const objByArea = new Map()
  for (const o of objetivos || []) {
    if (!o?.area_id) continue
    if (!objByArea.has(o.area_id)) objByArea.set(o.area_id, [])
    objByArea.get(o.area_id).push(o)
  }

  const tarefasPorObj = new Map()
  for (const t of tarefas || []) {
    const oid = metaIdCanonica(objetivos, t.objetivo_id)
    if (!oid) continue
    if (!tarefasPorObj.has(oid)) tarefasPorObj.set(oid, [])
    tarefasPorObj.get(oid).push(t)
  }

  const indPorObj = new Map()
  for (const ind of indicadores || []) {
    const oid = metaIdCanonica(objetivos, ind.objetivo_id)
    if (!oid) continue
    if (!indPorObj.has(oid)) indPorObj.set(oid, [])
    indPorObj.get(oid).push(ind)
  }

  const out = []
  for (const area of areas || []) {
    const metasRaw = objByArea.get(area.id) || []
    const metas = []
    for (const meta of metasRaw) {
      let comps = (tarefasPorObj.get(meta.id) || []).map(t => ({
        id: t.id,
        nome: t.nome || t.descricao || '—',
        responsavel: (t.responsavel && String(t.responsavel).trim()) ? String(t.responsavel).trim() : '—',
        isChave: !!t.isChave,
        semanas: {},
        pctSemanas: {},
        pctPeriodo: pctPeriodoPorComportamento?.[t.id] ?? null
      }))
      let inds = (indPorObj.get(meta.id) || []).map(i => ({
        id: i.id,
        nome: i.nome || '—',
        tipo: i.tipo || null,
        indicador_chave: !!i.indicador_chave,
        isChave: !!i.indicador_chave,
        semanas: {},
        valorSemanas: {}
      }))

      for (const c of comps) {
        for (const w of semanas) {
          const wn = Number(w)
          c.semanas[wn] = esforco[c.id]?.[wn] ?? esforco[c.id]?.[w] ?? 'ena'
          c.pctSemanas[wn] = esforcoPct?.[c.id]?.[wn] ?? esforcoPct?.[c.id]?.[w] ?? null
        }
      }
      for (const ind of inds) {
        for (const w of semanas) {
          const wn = Number(w)
          ind.semanas[wn] = semaf[ind.id]?.[wn] ?? semaf[ind.id]?.[w] ?? 'ina'
          ind.valorSemanas[wn] = indValorPorSemana?.[ind.id]?.[wn] ?? indValorPorSemana?.[ind.id]?.[w] ?? null
        }
      }

      if (visualizacao === 'chave') {
        comps = comps.filter(c => c.isChave)
        inds = inds.filter(i => i.isChave)
      }
      if (comps.length === 0 && inds.length === 0) continue

      metas.push({
        id: meta.id,
        descricao: meta.descricao || '—',
        prazo: prazoExibicaoObjetivo(meta),
        comportamentos: comps,
        indicadores: inds
      })
    }
    if (metas.length === 0) continue
    out.push({ area: { id: area.id, nome: area.nome || '—' }, metas })
  }
  return out
}

/** Média dos % nas semanas com dado (comportamento — coluna Status). */
function mediaPctComportamento(pctSemanas, semanasOrder) {
  const vals = semanasOrder.map(wn => pctSemanas[Number(wn)]).filter(v => v != null && !Number.isNaN(v))
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

/** Média dos % convertidos do semáforo nas semanas com dado (indicador). */
function mediaPctIndicador(semanasCod, semanasOrder) {
  const scMap = { ive: 100, ivc: 67, iam: 45, ivm: 15 }
  const vals = semanasOrder
    .map(wn => semanasCod[Number(wn)])
    .filter(c => c && c !== 'ina' && scMap[c] != null)
    .map(c => scMap[c])
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function statusConsolidadoComportamento(pctSemanas, semanasOrder, pctPeriodo) {
  const avg =
    pctPeriodo != null && !Number.isNaN(pctPeriodo)
      ? pctPeriodo
      : mediaPctComportamento(pctSemanas, semanasOrder)
  if (avg == null) return 'ena'
  if (avg >= 75) return 'e100'
  if (avg >= 60) return 'e75'
  if (avg >= 30) return 'e50'
  return 'elow'
}

/** Última semana com lançamento no período (indicador — coluna Status). */
function statusUltimoIndicador(semanasCod, semanasOrder) {
  for (let i = semanasOrder.length - 1; i >= 0; i--) {
    const wn = Number(semanasOrder[i])
    const c = semanasCod[wn]
    if (c && c !== 'ina') return c
  }
  return 'ina'
}

/** Carinha alinhada ao % de "Resultado médio" do card (mesmo número exibido no período). */
function calcularCodigoPorResultadoMedio(valor) {
  const n = parseFloat(valor)
  if (
    valor === null ||
    valor === undefined ||
    valor === '—' ||
    valor === '' ||
    Number.isNaN(n)
  ) {
    return 'ina'
  }
  if (n >= 75) return 'ive'
  if (n >= 60) return 'ivc'
  if (n >= 30) return 'iam'
  return 'ivm'
}

/** Mesmas faixas que calcularCodigoPorResultadoMedio → códigos da grade de comportamento (e100…). */
function bandPctParaCodigoComportamento(codInd) {
  const map = { ive: 'e100', ivc: 'e75', iam: 'e50', ivm: 'elow', ina: 'ena' }
  return map[codInd] ?? 'ena'
}

export default function Carometro() {
  const { isAdmin } = useAdmin()

  const [periodo, setPeriodo] = useState('mes')
  const [selecao, setSelecao] = useState('')
  const [selecaoMultipla, setSelecaoMultipla] = useState([])
  const [opcoesPeriodo, setOpcoesPeriodo] = useState([])
  const [opcoesPeriodoDraft, setOpcoesPeriodoDraft] = useState([])
  /** Linha `periodos` vinda do Supabase por UUID — não derivar só de `opcoesPeriodo` (evita datas ausentes no cálculo de semanas). */
  const [periodoDb, setPeriodoDb] = useState(null)
  const [areaSelecionada, setAreaSelecionada] = useState('geral')
  const [areasMultiplas, setAreasMultiplas] = useState(['geral'])
  const [visualizacao, setVisualizacao] = useState('geral')
  const [areas, setAreas] = useState([])
  const [dados, setDados] = useState([])
  /** Semanas ISO que aparecem no `cronograma` carregado — para semana de referência dos cards. */
  const [, setSemanasIsoComLancamentoCronograma] = useState([])
  const [comentariosAtividadeRows, setComentariosAtividadeRows] = useState([])
  const [comentariosIndicadorRows, setComentariosIndicadorRows] = useState([])
  const [acaoIdsPorTarefaCarometro, setAcaoIdsPorTarefaCarometro] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [salvandoChave, setSalvandoChave] = useState(null)
  /** `responsavel` opcional em `tarefas`. Chave do comportamento: `acoes.caneta_verde` (não coluna em tarefas). */
  const [, setSchemaTarefasCar] = useState({ responsavelCol: false })
  const semanasMemo = useMemo(() => {
    if (!periodoDb?.data_inicio || !periodoDb?.data_fim) {
      return []
    }
    return calcularSemanasISO(periodo, selecao, periodoDb)
  }, [periodoDb, periodo, selecao])

  /** Exibição: ordenação numérica crescente (S14, S15, …). */
  const semanasOrdenadas = useMemo(
    () => [...semanasMemo].sort((a, b) => Number(a) - Number(b)),
    [semanasMemo]
  )

  /** Todas as semanas ISO do período selecionado (igual ao Gantt), ordenadas — não limitar a subconjunto da UI. */
  const semanasVisiveis = useMemo(() => {
    const ord = semanasOrdenadas
    return ord.length ? [...ord] : []
  }, [semanasOrdenadas])

  /** Coluna destacada: semana ISO corrente, se estiver na grade do período exibido. */
  const semanaColunaDestaque = useMemo(() => {
    if (!semanasVisiveis.length) return null
    const wAtual = getSemanaISO(new Date())
    const nums = semanasVisiveis.map(Number).filter(Number.isFinite)
    return nums.includes(wAtual) ? wAtual : null
  }, [semanasVisiveis])

  const anoDatasSemana = periodoDb?.ano != null ? Number(periodoDb.ano) : new Date().getFullYear()

  const textoComentarioComportamentoCar = useMemo(() => {
    const merged = new Map()
    for (const r of comentariosAtividadeRows || []) {
      if (!r?.acao_id) continue
      const k = `${r.acao_id}|${r.semana_iso}|${r.semana_ano}`
      const t = String(r.texto || '').trim()
      if (!t) continue
      merged.set(k, merged.has(k) ? `${merged.get(k)} — ${t}` : t)
    }
    return (tarefaId, w) => {
      const wn = Number(w)
      const ano = anoIsoParaSemanaNoIntervalo(wn, periodoDb?.data_inicio, periodoDb?.data_fim)
      const aids = acaoIdsPorTarefaCarometro[tarefaId] || []
      const parts = []
      for (const aid of aids) {
        const x = merged.get(`${aid}|${wn}|${ano}`)
        if (x) parts.push(x)
      }
      return parts.length ? parts.join(' — ') : null
    }
  }, [comentariosAtividadeRows, acaoIdsPorTarefaCarometro, periodoDb?.data_inicio, periodoDb?.data_fim])

  const textoComentarioIndicadorCar = useMemo(() => {
    const merged = new Map()
    for (const r of comentariosIndicadorRows || []) {
      if (!r?.indicador_id) continue
      const k = `${r.indicador_id}|${r.semana_iso}|${r.semana_ano}`
      const t = String(r.texto || '').trim()
      if (!t) continue
      merged.set(k, merged.has(k) ? `${merged.get(k)} — ${t}` : t)
    }
    return (indicadorId, w) => {
      const wn = Number(w)
      const ano = anoIsoParaSemanaNoIntervalo(wn, periodoDb?.data_inicio, periodoDb?.data_fim)
      return merged.get(`${indicadorId}|${wn}|${ano}`) || null
    }
  }, [comentariosIndicadorRows, periodoDb?.data_inicio, periodoDb?.data_fim])

  const depsFetch = useRef('')

  useEffect(() => {
    let cancel = false
    async function loadOpcoes() {
      const { data, error: e } = await supabase
        .from('periodos')
        .select('*')
        .eq('tipo', periodo)
        .order('ano', { ascending: false })
        .order('numero', { ascending: false })
      if (cancel) return
      if (e) {
        setOpcoesPeriodo([])
        return
      }
      setOpcoesPeriodo(data || [])
      setOpcoesPeriodoDraft(data || [])
      if (data?.length) {
        const now = new Date()
        const prefer =
          periodo === 'mes'
            ? data.find(
                p => Number(p.ano) === now.getFullYear() && Number(p.numero) === now.getMonth() + 1
              )
            : null
        const fallback = prefer?.id || data[0].id
        setSelecao(prev => {
          if (prev && data.some(p => p.id === prev)) return prev
          return fallback
        })
        setSelecaoMultipla(prev => {
          const validPrev = (prev || []).filter(x => data.some(p => p.id === x))
          if (validPrev.length) return validPrev
          return fallback ? [fallback] : []
        })
      }
    }
    loadOpcoes()
    return () => {
      cancel = true
    }
  }, [periodo])

  useEffect(() => {
    if (!selecao && opcoesPeriodo.length > 0) {
      setSelecao(opcoesPeriodo[0].id)
    }
  }, [opcoesPeriodo, selecao])

  useEffect(() => {
    if (selecaoMultipla?.length > 0) {
      const first = selecaoMultipla[0]
      if (first && first !== selecao) setSelecao(first)
    }
  }, [selecaoMultipla, selecao])

  useEffect(() => {
    let cancel = false
    async function loadPeriodoDbRow() {
      const selecaoParaPeriodo = selecao || (selecaoMultipla?.length ? selecaoMultipla[0] : '')
      if (!selecaoParaPeriodo) {
        setPeriodoDb(null)
        return
      }
      const { data: periodoData, error: periodoErr } = await supabase
        .from('periodos')
        .select('id, data_inicio, data_fim, tipo, ano, numero')
        .eq('id', selecaoParaPeriodo)
        .single()
      if (cancel) return
      if (periodoErr || !periodoData) {
        setPeriodoDb(null)
        return
      }
      setPeriodoDb(periodoData)
    }
    loadPeriodoDbRow()
    return () => {
      cancel = true
    }
  }, [selecao, selecaoMultipla])

  const carregarDados = useCallback(async () => {
    const selecaoEfetiva = selecao || (selecaoMultipla?.length > 0 ? selecaoMultipla[0] : null)

    const key = JSON.stringify({
      selecao: selecaoEfetiva,
      selecaoMultipla,
      areasMultiplas,
      semLen: semanasMemo.length,
      v: visualizacao
    })

    if (!selecaoEfetiva) {
      setDados([])
      setSemanasIsoComLancamentoCronograma([])
      setComentariosAtividadeRows([])
      setComentariosIndicadorRows([])
      setAcaoIdsPorTarefaCarometro({})
      setLoading(false)
      return
    }

    if (!periodoDb?.data_inicio || !periodoDb?.data_fim || semanasMemo.length === 0) {
      return
    }

    depsFetch.current = key
    setLoading(true)
    setError(null)

    const { filtroGeral, areaIdsFiltro } = resolverFiltroAreasCarometro(areasMultiplas, areaSelecionada)

    function aplicarFiltroAreaObjetivos(q) {
      if (filtroGeral || areaIdsFiltro.length === 0) return q
      if (areaIdsFiltro.length === 1) return q.eq('area_id', areaIdsFiltro[0])
      return q.in('area_id', areaIdsFiltro)
    }

    try {
      const { data: areasData } = await listarAreas(supabase, 'id, nome')
      setAreas(areasData || [])
      void (
        areaSelecionada !== 'geral'
          ? (areasData || []).find(a => a.id === areaSelecionada)
          : null
      )

      let qObj = supabase
        .from('objetivos')
        .select('id, descricao, area_id, ordem, meta_unidade, periodo_id, status, concluido_em')
        .in('status', ['ativo', 'concluido', 'concluído'])
      qObj = aplicarFiltroAreaObjetivos(qObj)
      let { data: objetivos, error: errObj } = await qObj
      if (errObj && (String(errObj.message || '').toLowerCase().includes('status') || erroColunaOuSchemaSupabase(errObj))) {
        let q2 = supabase
          .from('objetivos')
          .select('id, descricao, area_id, ordem, meta_unidade, periodo_id, status, concluido_em')
        q2 = aplicarFiltroAreaObjetivos(q2)
        const r2 = await q2
        objetivos = r2.data
        errObj = r2.error
      }
      // Metas ativas e concluídas (acentos / variantes); nunca filtrar por periodo_id na query (trimestre vs mês).
      objetivos = (objetivos || []).filter(o => statusObjetivoIncluiCarometro(o))
      if (errObj) {
        setError(errObj.message)
        setDados([])
        setSemanasIsoComLancamentoCronograma([])
        setComentariosAtividadeRows([])
        setComentariosIndicadorRows([])
        setAcaoIdsPorTarefaCarometro({})
        setLoading(false)
        return
      }
      const objIds = (objetivos || []).map(o => o.id).filter(Boolean)
      if (objIds.length === 0) {
        setDados([])
        setSemanasIsoComLancamentoCronograma([])
        setComentariosAtividadeRows([])
        setComentariosIndicadorRows([])
        setAcaoIdsPorTarefaCarometro({})
        setLoading(false)
        return
      }

      const areaIdsDasMetas = [...new Set((objetivos || []).map(o => o.area_id).filter(Boolean))]

      const semanasArr = [...semanasMemo]
      const p = periodoDb ?? opcoesPeriodo.find(pr => pr.id === selecaoEfetiva) ?? null
      const semanasCalc = semanasArr

      /** UUIDs de `periodos` que intersectam o intervalo do filtro (ex.: mês vs trimestre onde o Gantt gravou). */
      let idsParaFiltro = [selecaoEfetiva].filter(Boolean)
      if (p?.data_inicio && p?.data_fim) {
        const { data: periodosCruzam, error: errCruz } = await supabase
          .from('periodos')
          .select('id')
          .lte('data_inicio', p.data_fim)
          .gte('data_fim', p.data_inicio)
        if (!errCruz && Array.isArray(periodosCruzam) && periodosCruzam.length > 0) {
          const set = new Set(idsParaFiltro)
          periodosCruzam.forEach(row => {
            if (row?.id) set.add(row.id)
          })
          idsParaFiltro = [...set]
        }
      }

      const periodoDataInicioMap = {}
      if (idsParaFiltro.length > 0) {
        const { data: pinis } = await supabase.from('periodos').select('id, data_inicio').in('id', idsParaFiltro)
        ;(pinis || []).forEach(ro => {
          if (ro?.id) periodoDataInicioMap[String(ro.id)] = ro.data_inicio
        })
      }

      const semanaGridArr = semanasCalc.map(s => Number(s)).filter(n => Number.isFinite(n))
      const semanasSetL = new Set(semanasCalc.map(s => Number(s)).filter(n => Number.isFinite(n)))

      /** Indicadores + lançamentos: dependem só de `objIds` e período — antes de tarefas/ações/cronograma. */
      const IND_SEL_SPECS = [
        'id, nome, objetivo_id, area_id, unidade, tipo, regra_verde_escuro, regra_verde_claro, regra_amarelo, regra_verde_escuro_op, regra_verde_claro_op, regra_amarelo_op, indicador_chave, semaforo_faixas',
        'id, nome, objetivo_id, unidade, tipo, regra_verde_escuro, regra_verde_claro, regra_amarelo, regra_verde_escuro_op, regra_verde_claro_op, regra_amarelo_op, indicador_chave, semaforo_faixas',
        'id, nome, objetivo_id, unidade, tipo, regra_verde_escuro, regra_verde_claro, regra_amarelo, regra_verde_escuro_op, regra_verde_claro_op, regra_amarelo_op, indicador_chave',
        'id, nome, objetivo_id'
      ]
      let indicadoresRaw = []
      let errInd = null
      for (const sel of IND_SEL_SPECS) {
        let r = await supabase.from('indicadores').select(sel).in('objetivo_id', objIds).eq('status', 'ativo')
        if (r.error && String(r.error.message || '').toLowerCase().includes('status')) {
          r = await supabase.from('indicadores').select(sel).in('objetivo_id', objIds)
        }
        if (r.error && erroColunaOuSchemaSupabase(r.error)) {
          errInd = r.error
          continue
        }
        if (r.error) {
          errInd = r.error
          break
        }
        indicadoresRaw = r.data || []
        errInd = null
        break
      }
      if (errInd) {
        setError(errInd.message)
      }

      const indList = mesclarIndicadoresNasMetas(objetivos || [], indicadoresRaw || [])
      const indIds = indList.map(i => i.id).filter(Boolean)

      let lancamentosList = []
      if (indIds.length > 0 && idsParaFiltro.length > 0) {
        const LANCAMENTO_SEL = 'indicador_id, semana, semana_ano, valor, periodo_id'
        const LANCAMENTO_SEL_FALLBACK = 'indicador_id, semana, valor, periodo_id'

        if (semanasArr.length > 0) {
          let resTri = await supabase
            .from('indicador_lancamentos')
            .select(LANCAMENTO_SEL)
            .in('indicador_id', indIds)
            .in('semana', semanasArr)
            .in('periodo_id', idsParaFiltro)
          if (resTri.error && erroColunaOuSchemaSupabase(resTri.error)) {
            resTri = await supabase
              .from('indicador_lancamentos')
              .select(LANCAMENTO_SEL_FALLBACK)
              .in('indicador_id', indIds)
              .in('semana', semanasArr)
              .in('periodo_id', idsParaFiltro)
          }
          if (!resTri.error) lancamentosList = mergeLancRows(lancamentosList, resTri.data || [])
        }

        if (!lancamentosList || lancamentosList.length === 0) {
          let resLeg = await supabase
            .from('indicador_lancamentos')
            .select(LANCAMENTO_SEL)
            .in('indicador_id', indIds)
            .in('periodo_id', idsParaFiltro)
          if (resLeg.error && erroColunaOuSchemaSupabase(resLeg.error)) {
            resLeg = await supabase
              .from('indicador_lancamentos')
              .select(LANCAMENTO_SEL_FALLBACK)
              .in('indicador_id', indIds)
              .in('periodo_id', idsParaFiltro)
          }
          if (!resLeg.error) {
            const semSetF = new Set(semanasArr.map(s => Number(s)).filter(n => Number.isFinite(n)))
            const rawLeg = resLeg.data || []
            const filtradoLeg =
              semSetF.size > 0
                ? rawLeg.filter(row => {
                    const iso = semanaLancamentoIndicadorParaGrade(row, semSetF, periodoDataInicioMap, p?.data_inicio)
                    return iso != null && semSetF.has(Number(iso))
                  })
                : rawLeg
            lancamentosList = mergeLancRows(lancamentosList, filtradoLeg.length ? filtradoLeg : rawLeg)
          }
        }

        if (indIds.length > 0 && p?.data_inicio) {
          let rNull = await supabase
            .from('indicador_lancamentos')
            .select(LANCAMENTO_SEL)
            .in('indicador_id', indIds)
            .is('periodo_id', null)
          if (rNull.error && erroColunaOuSchemaSupabase(rNull.error)) {
            rNull = await supabase
              .from('indicador_lancamentos')
              .select(LANCAMENTO_SEL_FALLBACK)
              .in('indicador_id', indIds)
              .is('periodo_id', null)
          }
          if (!rNull.error) {
            const filtNull = (rNull.data || []).filter(row => {
              const iso = semanaLancamentoIndicadorParaGrade(row, semanasSetL, periodoDataInicioMap, p.data_inicio)
              return iso != null && semanasSetL.has(Number(iso))
            })
            if (filtNull.length > 0) lancamentosList = mergeLancRows(lancamentosList, filtNull)
          }
        }

        lancamentosList = ordenarLancamentosIndicadorParaGradeCar(lancamentosList)
      }

      const semaf = {}
      for (const ind of indList) {
        semaf[ind.id] = {}
        for (const s of semanasCalc) {
          const wn = Number(s)
          let match = null
          for (const l of lancamentosList || []) {
            if (l.indicador_id !== ind.id) continue
            const iso = semanaLancamentoIndicadorParaGrade(l, semanasSetL, periodoDataInicioMap, p?.data_inicio)
            if (iso === wn) match = l
          }
          if (!match || match.valor == null || String(match.valor).trim() === '') {
            semaf[ind.id][wn] = 'ina'
          } else {
            semaf[ind.id][wn] = statusCarometroIndicadorCelula(ind, match.valor)
          }
        }
      }

      const indValorPorSemana = {}
      for (const ind of indList) {
        indValorPorSemana[ind.id] = {}
        for (const s of semanasCalc) {
          const wn = Number(s)
          let match = null
          for (const l of lancamentosList || []) {
            if (l.indicador_id !== ind.id) continue
            const iso = semanaLancamentoIndicadorParaGrade(l, semanasSetL, periodoDataInicioMap, p?.data_inicio)
            if (iso === wn) match = l
          }
          indValorPorSemana[ind.id][wn] =
            match?.valor != null && String(match.valor).trim() !== '' ? match.valor : null
        }
      }

      const tf = await selectTarefasCarometro(supabase, objIds, areaIdsDasMetas)
      if (tf.error) {
        setError(tf.error.message)
        setDados([])
        setSemanasIsoComLancamentoCronograma([])
        setComentariosAtividadeRows([])
        setComentariosIndicadorRows([])
        setAcaoIdsPorTarefaCarometro({})
        setLoading(false)
        return
      }
      setSchemaTarefasCar({
        responsavelCol: !!tf.flags?.hasResponsavelCol
      })

      let comps = mesclarComportamentosComMetas(objetivos || [], tf.tCom || [], tf.tarefasSoArea || [])

      const compIds = comps.map(c => c.id)
      const acoesPorTarefa = {}
      /** Cadeia: acoes.tarefa_id → tarefa; caneta_verde = comportamento chave. */
      let acoesRows = []
      if (compIds.length > 0) {
        const selAcoes = 'id, tarefa_id, nome, caneta_verde'
        const LOTE = 20
        const acc = []
        for (let i = 0; i < compIds.length; i += LOTE) {
          const lote = compIds.slice(i, i + LOTE)
          const { data: ar, error: errA } = await supabase.from('acoes').select(selAcoes).in('tarefa_id', lote)
          if (errA) {
            setError(errA.message)
            setDados([])
            setSemanasIsoComLancamentoCronograma([])
            setComentariosAtividadeRows([])
            setComentariosIndicadorRows([])
            setAcaoIdsPorTarefaCarometro({})
            setLoading(false)
            return
          }
          if (ar?.length) acc.push(...ar)
        }
        acoesRows = acc
        for (const a of acoesRows) {
          if (!acoesPorTarefa[a.tarefa_id]) acoesPorTarefa[a.tarefa_id] = []
          acoesPorTarefa[a.tarefa_id].push(a.id)
        }
      }
      comps = comps.map(c => ({
        ...c,
        isChave: comportamentoEhChavePorCaneta(acoesRows.filter(a => a.tarefa_id === c.id))
      }))
      const allAcaoIdsDasMetas = [...new Set(acoesRows.map(a => a.id).filter(Boolean))]

      const acaoIdsParaCrono = allAcaoIdsDasMetas
      /** Como no Gantt: cronograma é por acao_id + semana ISO; periodo_id no banco pode ser outro período ou null. */
      const CRONO_SEL = 'acao_id, semana, semana_ano, status, periodo_id'
      const CRONO_SEL_FALLBACK = 'acao_id, semana, status, periodo_id'
      /**
       * Sempre buscar cronograma amplo por `acao_id` (em lotes) e filtrar pela semana ISO na grade.
       * Não confiar só em `.in('semana', semanas do mês)`: no banco `semana` pode ser relativa ao trimestre,
       * e um subconjunto “parcial” na primeira query impedia o fallback amplo — engajamento e indicadores sumiam.
       */
      /** Mês visualizado + períodos que cruzam o intervalo (ex.: trimestre onde o Gantt gravou). */
      const periodosValidosEngajamento = idsParaFiltro.filter(Boolean)
      const periodosValidosEngajamentoSet = new Set(periodosValidosEngajamento.map(id => String(id)))

      let cronoList = []
      let accWideCronoDiag = []
      if (acaoIdsParaCrono.length > 0 && semanaGridArr.length > 0) {
        const LOTE_CR = 40
        const accWide = []
        for (let i = 0; i < acaoIdsParaCrono.length; i += LOTE_CR) {
          const lote = acaoIdsParaCrono.slice(i, i + LOTE_CR)
          let respW = await supabase.from('cronograma').select(CRONO_SEL).in('acao_id', lote)
          if (respW.error && erroColunaOuSchemaSupabase(respW.error)) {
            respW = await supabase.from('cronograma').select(CRONO_SEL_FALLBACK).in('acao_id', lote)
          }
          if (respW.error) {
            setError(respW.error.message)
            setDados([])
            setSemanasIsoComLancamentoCronograma([])
            setComentariosAtividadeRows([])
            setComentariosIndicadorRows([])
            setAcaoIdsPorTarefaCarometro({})
            setLoading(false)
            return
          }
          if (respW.data?.length) accWide.push(...respW.data)
        }
        accWideCronoDiag = accWide
        cronoList = (accWide || []).filter(
          cr =>
            cronogramaLinhaCaiNaGradePeriodoCar(
              cr,
              semanasCalc,
              periodoDataInicioMap,
              p?.data_inicio,
              semanaGridArr
            ) &&
            periodosValidosEngajamentoSet.size > 0 &&
            periodosValidosEngajamentoSet.has(String(cr?.periodo_id ?? ''))
        )
      }

      const semSetIsoCrono = new Set()
      for (const cr of cronoList || []) {
        const wIso = semanaCronogramaIsoNaGrade(cr, semanasCalc, periodoDataInicioMap, p?.data_inicio)
        if (wIso != null && Number.isFinite(Number(wIso))) semSetIsoCrono.add(Number(wIso))
      }
      let semanasIsoLancamentoCronoArr = Array.from(semSetIsoCrono)

      // Engajamento: linhas concluídas / linhas do cronograma do comportamento na semana ISO
      const LOTE = 20
      const semanaGridFull = semanasCalc.map(Number).filter(Number.isFinite)
      const semanasGridNums = [...semanaGridFull].sort((a, b) => a - b)

      // gantt_planejamento: mês + trimestre (e demais períodos que cruzam o intervalo)
      const GANTT_PLAN_SEL = 'id, acao_id, semanas_selecionadas, periodo_id'
      let ganttPlan = []
      if (allAcaoIdsDasMetas.length > 0 && periodosValidosEngajamento.length > 0) {
        for (let i = 0; i < allAcaoIdsDasMetas.length; i += LOTE) {
          const lote = allAcaoIdsDasMetas.slice(i, i + LOTE)
          const respG = await supabase
            .from('gantt_planejamento')
            .select(GANTT_PLAN_SEL)
            .in('periodo_id', periodosValidosEngajamento)
            .in('acao_id', lote)
          if (respG.error) {
            setError(respG.error.message)
            ganttPlan = []
            break
          }
          if (respG.data?.length) ganttPlan = [...ganttPlan, ...respG.data]
        }
      }

      // Mesmo conjunto já carregado acima (CRONO_SEL inclui periodo_id — semana relativa vs ISO)
      const cronoRows = cronoList || []

      // [DIAG] engajamento — remover após auditoria
      if (typeof window !== 'undefined') {
        const hoje = new Date()
        console.log('[DIAG semana atual] hoje:', hoje.toISOString())
        console.log('[DIAG semana atual] semanaAtualCalculada:', getSemanaISOAtual())
        console.log('[DIAG semana atual] semanasGrid:', semanaGridArr)
        const diagComp = nome =>
          (comps || []).find(t =>
            String(t.nome ?? t.descricao ?? '')
              .toUpperCase()
              .includes(nome)
          )
        const compAcoplamento = diagComp('ACOPLAMENTO')
        const compChecklist = diagComp('RECEBIMENTO CHECKLIST')
        const logCronogramaComp = (label, tarefaId, lista) => {
          if (!tarefaId) return
          const acoesDa = (acoesRows || []).filter(a => a.tarefa_id === tarefaId)
          const linhas = (lista || []).filter(c => acoesDa.map(a => a.id).includes(c.acao_id))
          console.log(`[DIAG ${label}] tarefa_id:`, tarefaId)
          console.log(`[DIAG ${label}] acoes:`, JSON.stringify(acoesDa, null, 2))
          console.log(`[DIAG ${label}] linhas cronograma (periodo filtrado):`, JSON.stringify(linhas, null, 2))
          console.log(
            `[DIAG ${label}] linhas cronograma (fetch amplo):`,
            JSON.stringify(
              (accWideCronoDiag || []).filter(c => acoesDa.map(a => a.id).includes(c.acao_id)),
              null,
              2
            )
          )
          console.log(`[DIAG ${label}] semanas raw:`, [...new Set(linhas.map(c => c.semana))])
          console.log(
            `[DIAG ${label}] status por semana:`,
            linhas.map(c => ({ semana: c.semana, status: c.status, acao_id: c.acao_id, periodo_id: c.periodo_id }))
          )
        }
        logCronogramaComp('acoplamento', compAcoplamento?.id, cronoRows)
        logCronogramaComp('checklist', compChecklist?.id, cronoRows)
      }

      // Atualiza semanas com lançamento do cronograma (ISO na grade do período)
      const semSetIsoCrono2 = new Set()
      ;(cronoRows || []).forEach(c => {
        const iso = semanaCronogramaIsoNaGrade(c, semanasCalc, periodoDataInicioMap, p?.data_inicio)
        if (iso != null && Number.isFinite(Number(iso))) semSetIsoCrono2.add(Number(iso))
      })
      const semanasIsoLancamentoCronoArr2 = Array.from(semSetIsoCrono2)

      // PASSO D — calcular % por semana e por período
      const esforco = {}
      const esforcoPct = {}
      const pctPeriodoPorComportamento = {}

      const visivelNoPeriodoPorTarefa = {}
      for (const t of comps || []) {
        const tid = t?.id
        if (!tid) continue
        const acoesDaTarefa = (acoesRows || []).filter(a => a.tarefa_id === tid)
        const tem =
          acoesDaTarefa.some(a => ganttAcaoPlanejadaNoPeriodo(ganttPlan, a.id, semanasCalc, p)) ||
          acoesDaTarefa.some(a => acaoTemCronogramaNoPeriodoCar(cronoRows, a.id))
        visivelNoPeriodoPorTarefa[tid] = tem
      }

      // Gantt OU cronograma no período (ações sem gantt_planejamento ainda aparecem se houver cronograma)
      comps = (comps || []).filter(t => visivelNoPeriodoPorTarefa?.[t.id])

      for (const tarefa of comps || []) {
        const tid = tarefa.id

        esforco[tid] = {}
        esforcoPct[tid] = {}

        const pctSemanas = {}
        semanasGridNums.forEach(semISO => {
          const semNum = Number(semISO)
          if (!Number.isFinite(semNum)) return

          const pct = calcularEngajamentoSemana(tid, semNum, acoesRows, cronoRows, ganttPlan)
          if (pct == null) {
            pctSemanas[semNum] = null
            esforco[tid][semNum] = 'ena'
            esforcoPct[tid][semNum] = null
            return
          }

          pctSemanas[semNum] = pct
          esforcoPct[tid][semNum] = pct
          esforco[tid][semNum] = codEsforcoPorPctEngajamento(pct)
        })

        const vals = Object.values(pctSemanas).filter(v => v != null && !Number.isNaN(v))
        pctPeriodoPorComportamento[tid] = vals.length
          ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
          : null
      }

      // Substitui o array usado adiante, mantendo a variável existente
      semanasIsoLancamentoCronoArr = semanasIsoLancamentoCronoArr2

      const anosComent =
        p?.data_inicio && p?.data_fim && semanaGridArr.length > 0
          ? [
              ...new Set(
                semanaGridArr
                  .map(sn => anoIsoParaSemanaNoIntervalo(Number(sn), p.data_inicio, p.data_fim))
                  .filter(y => Number.isFinite(Number(y)))
              )
            ]
          : []
      const [rComA, rComI] = await Promise.all([
        allAcaoIdsDasMetas.length > 0 && semanaGridArr.length > 0 && anosComent.length > 0
          ? supabase
              .from('comentarios_atividade')
              .select('id, acao_id, semana_iso, semana_ano, texto, created_at')
              .in('acao_id', allAcaoIdsDasMetas)
              .in('semana_iso', semanaGridArr)
              .in('semana_ano', anosComent)
              .order('semana_iso', { ascending: true })
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        indIds.length > 0 && semanaGridArr.length > 0 && anosComent.length > 0
          ? supabase
              .from('comentarios_indicador')
              .select('id, indicador_id, semana_iso, semana_ano, texto, created_at')
              .in('indicador_id', indIds)
              .in('semana_iso', semanaGridArr)
              .in('semana_ano', anosComent)
              .order('semana_iso', { ascending: true })
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [], error: null })
      ])
      const comRowsA = !rComA.error ? rComA.data || [] : []
      const comRowsI = !rComI.error ? rComI.data || [] : []

      const areasFilt = filtroGeral
        ? areasData || []
        : (areasData || []).filter(a => areaIdsFiltro.includes(a.id))

      const estrutura = agruparPorAreaEMeta({
        areas: areasFilt,
        objetivos: objetivos || [],
        tarefas: comps,
        indicadores: indList,
        esforco,
        esforcoPct,
        pctPeriodoPorComportamento,
        semaf,
        indValorPorSemana,
        semanas: semanasArr,
        visualizacao
      })
      if (depsFetch.current === key) {
        setDados(estrutura)
        setSemanasIsoComLancamentoCronograma(semanasIsoLancamentoCronoArr)
        setComentariosAtividadeRows(comRowsA)
        setComentariosIndicadorRows(comRowsI)
        setAcaoIdsPorTarefaCarometro(acoesPorTarefa)
        setLoading(false)
      }
    } catch (err) {
      setError(String(err?.message || err))
      setSemanasIsoComLancamentoCronograma([])
      setComentariosAtividadeRows([])
      setComentariosIndicadorRows([])
      setAcaoIdsPorTarefaCarometro({})
      setLoading(false)
    }
  }, [
    selecao,
    selecaoMultipla,
    areasMultiplas,
    areaSelecionada,
    periodoDb,
    semanasMemo,
    opcoesPeriodo,
    visualizacao
  ])

  useEffect(() => {
    if (
      selecao &&
      periodoDb?.data_inicio &&
      periodoDb?.data_fim &&
      semanasMemo.length > 0
    ) {
      carregarDados()
    }
  }, [carregarDados, selecao, periodoDb, semanasMemo])

  async function toggleChaveTarefa(t) {
    if (!isAdmin) return
    const atual = !!t.is_chave
    const novo = !atual
    setSalvandoChave(`t-${t.id}`)
    setDados(prev =>
      prev.map(block => ({
        ...block,
        metas: block.metas.map(m => ({
          ...m,
          comportamentos: m.comportamentos.map(c => (c.id === t.id ? { ...c, isChave: novo } : c))
        }))
      }))
    )
    let res = await supabase
      .from('acoes')
      .update({ caneta_verde: novo ? 'sim' : 'nao' })
      .eq('tarefa_id', t.id)
    if (res.error && erroColunaOuSchemaSupabase(res.error)) {
      res = await supabase.from('tarefas').update({ is_chave: novo }).eq('id', t.id)
    }
    if (res.error) {
      console.error('[Carometro] erro ao salvar chave tarefa:', res.error.message)
      setError('Não foi possível salvar. Verifique a configuração do banco.')
      return
    }
    if (res.error) {
      setDados(prev =>
        prev.map(block => ({
          ...block,
          metas: block.metas.map(m => ({
            ...m,
            comportamentos: m.comportamentos.map(c => (c.id === t.id ? { ...c, isChave: atual } : c))
          }))
        }))
      )
      setError(res.error.message)
    } else {
      void registrarLog({
        modulo: 'Carômetro',
        area: areaSelecionada?.nome,
        entidade: 'tarefa',
        entidade_id: t.id,
        operacao: 'UPDATE',
        valor_anterior: { is_chave: atual },
        valor_novo: { is_chave: novo },
        descricao: `Alterou chave da tarefa "${t.nome || t.id}"`
      })
    }
    setSalvandoChave(null)
  }

  async function toggleChaveIndicador(ind) {
    if (!isAdmin) return
    const atual = !!ind.isChave
    const novo = !atual
    setSalvandoChave(`i-${ind.id}`)
    setDados(prev =>
      prev.map(block => ({
        ...block,
        metas: block.metas.map(m => ({
          ...m,
          indicadores: m.indicadores.map(i =>
            i.id === ind.id ? { ...i, isChave: novo, indicador_chave: novo } : i
          )
        }))
      }))
    )
    let res = await supabase.from('indicadores').update({ indicador_chave: novo }).eq('id', ind.id)
    if (res.error && erroColunaOuSchemaSupabase(res.error)) {
      res = await supabase.from('indicadores').update({ is_chave: novo }).eq('id', ind.id)
    }
    if (res.error && erroColunaOuSchemaSupabase(res.error)) {
      res = await supabase.from('indicadores').update({ chave: novo }).eq('id', ind.id)
    }
    if (res.error) {
      console.error('[Carometro] erro ao salvar chave indicador:', res.error.message)
      setError('Não foi possível salvar. Verifique a configuração do banco.')
      return
    }
    if (res.error) {
      setDados(prev =>
        prev.map(block => ({
          ...block,
          metas: block.metas.map(m => ({
            ...m,
            indicadores: m.indicadores.map(i =>
              i.id === ind.id ? { ...i, isChave: atual, indicador_chave: atual } : i
            )
          }))
        }))
      )
      setError(res.error.message)
    } else {
      void registrarLog({
        modulo: 'Carômetro',
        area: areaSelecionada?.nome,
        entidade: 'indicadores',
        entidade_id: ind.id,
        operacao: 'UPDATE',
        valor_anterior: { indicador_chave: atual, is_chave: atual },
        valor_novo: { indicador_chave: novo, is_chave: novo },
        descricao: `Alterou indicador chave "${ind.nome || ind.id}"`
      })
    }
    setSalvandoChave(null)
  }

  const dadosProcessados = useMemo(() => {
    const { filtroGeral, areaIdsFiltro } = resolverFiltroAreasCarometro(areasMultiplas, areaSelecionada)
    if (filtroGeral || areaIdsFiltro.length === 0) return dados
    const set = new Set(areaIdsFiltro.map(String))
    return (dados || []).filter(b => {
      const id = b?.area?.id
      return id != null && id !== '' && set.has(String(id))
    })
  }, [dados, areasMultiplas, areaSelecionada])

  const resumoExecutivo = useMemo(() => {
    const empty = {
      compAtivos: 0,
      engMedio: null,
      compOk: [0, 0],
      pctCompOk: 0,
      indAtivos: 0,
      indAtingidos: [0, 0],
      pctIndAting: 0,
      indRisco: 0,
      indResMedio: null,
      pctIndSaude: 0
    }
    if (!dadosProcessados?.length || !semanasVisiveis.length) return empty
    const semanasDoPeriodo = (semanasMemo && semanasMemo.length ? semanasMemo : semanasVisiveis) || []
    let compAtivos = 0
    const medias = []
    let ok = 0
    let indAtivos = 0
    let ating = 0
    let risco = 0
    let indResSoma = 0
    let indResN = 0
    const scMap = { ive: 100, ivc: 67, iam: 45, ivm: 15 }
    for (const block of dadosProcessados) {
      for (const meta of block.metas) {
        for (const c of meta.comportamentos) {
          compAtivos++
          const semanasComDado = semanasDoPeriodo.filter(wn => {
            const val = c.pctSemanas?.[Number(wn)]
            return (
              val != null &&
              !Number.isNaN(val) &&
              periodoDb &&
              semanaPassadaParaEngajamento(Number(wn), periodoDb)
            )
          })
          const avg =
            semanasComDado.length > 0
              ? semanasComDado.reduce((s, wn) => s + c.pctSemanas[Number(wn)], 0) / semanasComDado.length
              : c.pctPeriodo != null && !Number.isNaN(c.pctPeriodo)
                ? c.pctPeriodo
                : null
          if (avg != null) {
            medias.push(avg)
            if (avg >= 60) ok++
          }
        }
        for (const ind of meta.indicadores) {
          indAtivos++
          const st = statusUltimoIndicador(ind.semanas || {}, semanasVisiveis)
          const mediaInd = mediaPctIndicador(ind.semanas || {}, semanasVisiveis)
          if (mediaInd != null && mediaInd >= 60) ating++
          if (st === 'iam' || st === 'ivm') risco++
          const semanasIndComDado = semanasDoPeriodo.filter(wn => {
            const cod = ind.semanas?.[Number(wn)]
            return (
              cod &&
              cod !== 'ina' &&
              scMap[cod] != null &&
              periodoDb &&
              semanaPassadaParaEngajamento(Number(wn), periodoDb)
            )
          })
          if (semanasIndComDado.length > 0) {
            const somaInd = semanasIndComDado.reduce((s, wn) => s + scMap[ind.semanas[Number(wn)]], 0)
            indResSoma += somaInd / semanasIndComDado.length
            indResN++
          }
        }
      }
    }
    const engMedio = medias.length ? medias.reduce((a, b) => a + b, 0) / medias.length : null
    const pctCompOk = compAtivos ? Math.round((100 * ok) / compAtivos) : 0
    const pctIndAting = indAtivos ? Math.round((100 * ating) / indAtivos) : 0
    const indResMedio = indResN ? indResSoma / indResN : null
    const pctIndSaude = indAtivos ? Math.round((100 * (indAtivos - risco)) / indAtivos) : 0
    return {
      compAtivos,
      engMedio,
      compOk: [ok, compAtivos],
      pctCompOk,
      indAtivos,
      indAtingidos: [ating, indAtivos],
      pctIndAting,
      indRisco: risco,
      indResMedio,
      pctIndSaude
    }
  }, [dadosProcessados, semanasVisiveis, semanasMemo, periodoDb])

  const resumoCardsVisual = useMemo(() => {
    const engajamentoMedioPct =
      resumoExecutivo.engMedio != null ? Math.round(resumoExecutivo.engMedio) : null
    const indicadorMedioPct =
      resumoExecutivo.indResMedio != null ? Math.round(resumoExecutivo.indResMedio) : null
    const [compAtingidos, totalComp] = resumoExecutivo.compOk
    const pctAtingidosComp =
      totalComp > 0 ? Math.round((compAtingidos / totalComp) * 100) : null
    const [atingInd, totalInd] = resumoExecutivo.indAtingidos
    const pctAtingidosInd =
      totalInd > 0 ? Math.round((atingInd / totalInd) * 100) : null
    return {
      engajamentoMedioPct,
      indicadorMedioPct,
      rmComp: getCorPorcentagem(engajamentoMedioPct),
      rmInd: getCorPorcentagem(indicadorMedioPct),
      pctAtingidosComp,
      atgComp: getCorPorcentagem(pctAtingidosComp),
      pctAtingidosInd,
      atgInd: getCorPorcentagem(pctAtingidosInd)
    }
  }, [resumoExecutivo])

  const resultadoMedioMesComp = resumoCardsVisual.engajamentoMedioPct
  const resultadoMedioMesInd = resumoCardsVisual.indicadorMedioPct

  const carinhaVisible = dadosProcessados?.length > 0 && semanasVisiveis?.length > 0

  const codigoCarinhaComportamentos = useMemo(
    () => bandPctParaCodigoComportamento(calcularCodigoPorResultadoMedio(resultadoMedioMesComp)),
    [resultadoMedioMesComp]
  )

  const codigoCarinhaIndicadores = useMemo(
    () => calcularCodigoPorResultadoMedio(resultadoMedioMesInd),
    [resultadoMedioMesInd]
  )

  /**
   * Cards de resumo: semana de referência = última semana da grade do período já encerrada antes da semana corrente real
   * (evita usar só o número ISO da semana “de hoje”, que quebrava períodos de outros anos).
   */
  const metricasSemanaAtual = useMemo(() => {
    const ord = [...(semanasMemo || [])].map(Number).filter(Number.isFinite).sort((a, b) => a - b)
    let wRef = null
    if (periodoDb?.data_inicio && periodoDb?.data_fim && ord.length > 0) {
      for (let i = ord.length - 1; i >= 0; i--) {
        const wn = ord[i]
        if (semanaPassadaParaEngajamento(wn, periodoDb)) {
          wRef = wn
          break
        }
      }
    }
    const wA = getSemanaISOAtual()
    if (wRef == null) {
      wRef = Math.max(1, wA - 1)
    }
    const labelTagSemana = `S${wRef} ★ semana anterior`
    const scMap = { ive: 100, ivc: 67, iam: 45, ivm: 15 }
    const pctsComp = []
    let atingComp = 0
    let nComp = 0
    const valsInd = []
    let atingInd = 0
    let nInd = 0
    if (dadosProcessados?.length) {
      for (const block of dadosProcessados) {
        for (const meta of block.metas) {
          for (const c of meta.comportamentos) {
            nComp++
            const p = c.pctSemanas?.[Number(wRef)]
            if (p != null && !Number.isNaN(p)) {
              pctsComp.push(p)
              if (p >= 60) atingComp++
            }
          }
          for (const ind of meta.indicadores) {
            nInd++
            const cod = ind.semanas?.[Number(wRef)]
            const v = cod && cod !== 'ina' ? scMap[cod] : null
            if (v != null) {
              valsInd.push(v)
              if (v >= 60) atingInd++
            }
          }
        }
      }
    }
    const mediaComp =
      pctsComp.length > 0 ? pctsComp.reduce((a, b) => a + b, 0) / pctsComp.length : null
    const mediaInd =
      valsInd.length > 0 ? valsInd.reduce((a, b) => a + b, 0) / valsInd.length : null
    const pctAtingComp = nComp > 0 ? Math.round((atingComp / nComp) * 100) : null
    const pctAtingInd = nInd > 0 ? Math.round((atingInd / nInd) * 100) : null
    return {
      semanaISO: wRef,
      semanaAtualISO: wA,
      labelTagSemana,
      comp: {
        mediaPct: mediaComp != null ? Math.round(mediaComp) : null,
        atingidos: atingComp,
        total: nComp,
        pctAting: pctAtingComp,
        atg: getCorPorcentagem(pctAtingComp),
        rm: getCorPorcentagem(mediaComp != null ? Math.round(mediaComp) : null)
      },
      ind: {
        mediaPct: mediaInd != null ? Math.round(mediaInd) : null,
        atingidos: atingInd,
        total: nInd,
        pctAting: pctAtingInd,
        atg: getCorPorcentagem(pctAtingInd),
        rm: getCorPorcentagem(mediaInd != null ? Math.round(mediaInd) : null)
      }
    }
  }, [dadosProcessados, semanasMemo, periodoDb])

  const labelTagPeriodoFiltro = periodoDb ? labelPeriodo(periodoDb) : '—'

  function corValorGrandeIndicador(pct) {
    if (pct === null || pct === undefined || Number.isNaN(pct)) return 'var(--color-text-secondary)'
    if (pct >= 60) return '#0c447c'
    if (pct >= 30) return '#e6a817'
    return '#b71c1c'
  }

  const filtrosRef = useRef(null)
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [secOpen, setSecOpen] = useState({
    periodo: false,
    selecao: false,
    area: false,
    visualizacao: false
  })
  const [areaBusca, setAreaBusca] = useState('')

  const [draftPeriodo, setDraftPeriodo] = useState(periodo)
  const [draftSelecoes, setDraftSelecoes] = useState([])
  const [draftAreas, setDraftAreas] = useState(['geral'])
  const [draftVisualizacao, setDraftVisualizacao] = useState(visualizacao)

  useEffect(() => {
    if (!filtrosOpen) return
    setDraftPeriodo(periodo)
    setDraftSelecoes((selecaoMultipla && selecaoMultipla.length ? selecaoMultipla : (selecao ? [selecao] : [])).filter(Boolean))
    setDraftAreas((areasMultiplas && areasMultiplas.length ? areasMultiplas : (areaSelecionada ? [areaSelecionada] : ['geral'])).filter(Boolean))
    setDraftVisualizacao(visualizacao)
    setAreaBusca('')
  }, [filtrosOpen, periodo, selecao, selecaoMultipla, areaSelecionada, areasMultiplas, visualizacao])

  useEffect(() => {
    function onDown(e) {
      if (!filtrosOpen) return
      const el = filtrosRef.current
      if (el && e.target && el.contains(e.target)) return
      setFiltrosOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [filtrosOpen])

  useEffect(() => {
    let cancel = false
    async function loadOpcoesDraft() {
      if (!filtrosOpen) return
      const { data, error: e } = await supabase
        .from('periodos')
        .select('*')
        .eq('tipo', draftPeriodo)
        .order('ano', { ascending: false })
        .order('numero', { ascending: false })
      if (cancel) return
      if (e) {
        setOpcoesPeriodoDraft([])
        return
      }
      setOpcoesPeriodoDraft(data || [])
      const validIds = new Set((data || []).map(p => p.id).filter(Boolean))
      setDraftSelecoes(prev => {
        const cur = (prev || []).filter(x => validIds.has(x))
        if (cur.length) return cur
        const first = data?.[0]?.id
        return first ? [first] : []
      })
    }
    loadOpcoesDraft()
    return () => {
      cancel = true
    }
  }, [draftPeriodo, filtrosOpen])

  const periodoLabelAtual =
    periodo === 'mes'
      ? 'Mês'
      : periodo === 'bimestre'
        ? 'Bimestre'
        : periodo === 'trimestre'
          ? 'Trimestre'
          : periodo === 'semestre'
            ? 'Semestre'
            : 'Ano'

  const selecaoLabelAtual = useMemo(() => {
    const ids = (selecaoMultipla || []).filter(Boolean)
    if (!ids.length) return '—'
    if (ids.length > 1) return `${ids.length} selecionados`
    const row = (opcoesPeriodo || []).find(p => p.id === ids[0]) || periodoDb
    return row ? labelPeriodo(row) : '—'
  }, [selecaoMultipla, opcoesPeriodo, periodoDb])

  const areaLabelAtual = useMemo(() => {
    const { filtroGeral, areaIdsFiltro } = resolverFiltroAreasCarometro(areasMultiplas, areaSelecionada)
    if (filtroGeral || areaIdsFiltro.length === 0) return 'Geral (todas)'
    if (areaIdsFiltro.length > 1) return `${areaIdsFiltro.length} áreas`
    const ar = (areas || []).find(a => a.id === areaIdsFiltro[0])
    return ar?.nome || '—'
  }, [areasMultiplas, areaSelecionada, areas])

  const visLabelAtual = visualizacao === 'chave' ? 'Só chave' : 'Todos'

  const filtrosAtivos = useMemo(() => {
    const out = []
    if (periodo !== 'mes') out.push({ key: 'periodo', label: `Período: ${periodoLabelAtual}` })
    if (selecaoMultipla?.length && opcoesPeriodo?.[0]?.id) {
      const first = opcoesPeriodo[0].id
      const ids = (selecaoMultipla || []).filter(Boolean)
      if (ids.length !== 1 || ids[0] !== first) out.push({ key: 'selecao', label: `Seleção: ${selecaoLabelAtual}` })
    }
    if (areasMultiplas?.length) {
      const sel = (areasMultiplas || []).filter(Boolean)
      if (!(sel.length === 1 && sel[0] === 'geral')) out.push({ key: 'area', label: `Área: ${areaLabelAtual}` })
    }
    if (visualizacao !== 'geral') out.push({ key: 'visualizacao', label: `Visualização: ${visLabelAtual}` })
    return out
  }, [periodo, selecaoMultipla, opcoesPeriodo, selecaoLabelAtual, areasMultiplas, areaLabelAtual, visualizacao, periodoLabelAtual, visLabelAtual])

  const totalFiltrosAtivos = filtrosAtivos.length

  function limparTudoAplicado() {
    setPeriodo('mes')
    setSelecao(opcoesPeriodo?.[0]?.id || '')
    setSelecaoMultipla(opcoesPeriodo?.[0]?.id ? [opcoesPeriodo[0].id] : [])
    setAreaSelecionada('geral')
    setAreasMultiplas(['geral'])
    setVisualizacao('geral')
  }

  function removerFiltro(key) {
    if (key === 'periodo') setPeriodo('mes')
    if (key === 'selecao') {
      const first = opcoesPeriodo?.[0]?.id || ''
      setSelecao(first)
      setSelecaoMultipla(first ? [first] : [])
    }
    if (key === 'area') {
      setAreaSelecionada('geral')
      setAreasMultiplas(['geral'])
    }
    if (key === 'visualizacao') setVisualizacao('geral')
  }

  return (
    <div
      className="carometro-page-v2 carometro-scorecard"
      style={{ padding: '0 0 2rem', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: 6 }}>
            Carômetro — Scorecard Executivo
          </h1>
          <p style={{ marginBottom: 12, color: 'var(--color-text-secondary, #4a5568)', fontSize: 14 }}>
            Acompanhamento semanal de metas, comportamentos e indicadores por área.
          </p>
        </div>
        <div ref={filtrosRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setFiltrosOpen(v => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--comp-mid)',
              color: 'var(--hdr-text)',
              border: 'none',
              borderRadius: 8,
              padding: '9px 16px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 6h16M7 12h10M10 18h4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Filtros
            <span
              style={{
                background: 'var(--surf0)',
                color: 'var(--comp-mid)',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 500,
                padding: '1px 7px'
              }}
            >
              {totalFiltrosAtivos}
            </span>
          </button>

          {filtrosOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 280,
                background: 'var(--color-background-primary)',
                border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                zIndex: 200,
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  padding: '11px 14px',
                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500 }}>Filtros</div>
                <button
                  type="button"
                  onClick={() => {
                    setDraftPeriodo('mes')
                    setDraftSelecoes(opcoesPeriodoDraft?.[0]?.id ? [opcoesPeriodoDraft[0].id] : [])
                    setDraftAreas(['geral'])
                    setDraftVisualizacao('geral')
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    fontSize: 11,
                    color: 'var(--ind-light)',
                    cursor: 'pointer'
                  }}
                >
                  Limpar tudo
                </button>
              </div>

              {[
                {
                  key: 'periodo',
                  label: 'Período',
                  value:
                    draftPeriodo === 'mes'
                      ? 'Mês'
                      : draftPeriodo === 'bimestre'
                        ? 'Bimestre'
                        : draftPeriodo === 'trimestre'
                          ? 'Trimestre'
                          : draftPeriodo === 'semestre'
                            ? 'Semestre'
                            : 'Ano',
                  open: secOpen.periodo,
                  onToggle: () => setSecOpen(s => ({ ...s, periodo: !s.periodo })),
                  body: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        { id: 'mes', label: 'Mês' },
                        { id: 'bimestre', label: 'Bimestre' },
                        { id: 'trimestre', label: 'Trimestre' },
                        { id: 'semestre', label: 'Semestre' },
                        { id: 'ano', label: 'Ano' }
                      ].map(opt => (
                        <label
                          key={opt.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 6px',
                            borderRadius: 5,
                            cursor: 'pointer'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <input
                            type="radio"
                            name="car-filtro-periodo"
                            checked={draftPeriodo === opt.id}
                            onChange={() => {
                              setDraftPeriodo(opt.id)
                              setDraftSelecoes([])
                            }}
                            style={{ accentColor: 'var(--comp-light)', width: 14, height: 14 }}
                          />
                          <span style={{ fontSize: 13, fontWeight: draftPeriodo === opt.id ? 500 : 400 }}>
                            {opt.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  )
                },
                {
                  key: 'selecao',
                  label: 'Seleção',
                  value: (() => {
                    const ids = (draftSelecoes || []).filter(Boolean)
                    if (!ids.length) return '—'
                    if (ids.length > 1) return `${ids.length} selecionados`
                    const row = (opcoesPeriodoDraft || []).find(p => p.id === ids[0])
                    return row ? labelPeriodo(row) : '—'
                  })(),
                  open: secOpen.selecao,
                  onToggle: () => setSecOpen(s => ({ ...s, selecao: !s.selecao })),
                  body: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflow: 'auto' }}>
                      {(opcoesPeriodoDraft || []).map(p => (
                        (() => {
                          const checked = (draftSelecoes || []).includes(p.id)
                          return (
                        <label
                          key={p.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 6px',
                            borderRadius: 5,
                            cursor: 'pointer'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setDraftSelecoes(prev => {
                                const cur = prev || []
                                if (cur.includes(p.id) && cur.length === 1) return cur
                                return cur.includes(p.id) ? cur.filter(x => x !== p.id) : [...cur, p.id]
                              })
                            }}
                            style={{ accentColor: 'var(--comp-light)', width: 14, height: 14 }}
                          />
                          <span style={{ fontSize: 13, fontWeight: checked ? 500 : 400 }}>
                            {labelPeriodo(p)}
                          </span>
                        </label>
                          )
                        })()
                      ))}
                    </div>
                  )
                },
                {
                  key: 'area',
                  label: 'Área',
                  value:
                    (draftAreas || []).includes('geral')
                      ? 'Geral (todas)'
                      : (draftAreas || []).length === 1
                        ? (areas || []).find(a => a.id === (draftAreas || [])[0])?.nome || '—'
                        : `${(draftAreas || []).length} áreas`,
                  open: secOpen.area,
                  onToggle: () => setSecOpen(s => ({ ...s, area: !s.area })),
                  body: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        type="text"
                        value={areaBusca}
                        onChange={e => setAreaBusca(e.target.value)}
                        placeholder="Buscar área..."
                        style={{
                          height: 32,
                          padding: '0 10px',
                          borderRadius: 8,
                          border: '0.5px solid var(--color-border-secondary)',
                          background: 'var(--color-background-primary)',
                          fontSize: 13
                        }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflow: 'auto' }}>
                        {(() => {
                          const term = String(areaBusca || '').trim().toLowerCase()
                          const areasFiltradas = term
                            ? (areas || []).filter(a => String(a.nome || '').toLowerCase().includes(term))
                            : (areas || [])
                          const rows = [{ id: 'geral', nome: 'Geral (todas)' }, ...areasFiltradas]
                          return rows.map(a => (
                            (() => {
                              const checked = (draftAreas || []).includes(a.id)
                              return (
                            <label
                              key={a.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '4px 6px',
                                borderRadius: 5,
                                cursor: 'pointer'
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  if (a.id === 'geral') {
                                    setDraftAreas(['geral'])
                                    return
                                  }
                                  setDraftAreas(prev => {
                                    const cur = prev || []
                                    const semGeral = cur.filter(x => x !== 'geral')
                                    if (semGeral.includes(a.id)) {
                                      const novo = semGeral.filter(x => x !== a.id)
                                      return novo.length === 0 ? ['geral'] : novo
                                    }
                                    return [...semGeral, a.id]
                                  })
                                }}
                                style={{ accentColor: 'var(--comp-light)', width: 14, height: 14 }}
                              />
                              <span style={{ fontSize: 13, fontWeight: checked ? 500 : 400 }}>
                                {a.nome}
                              </span>
                            </label>
                              )
                            })()
                          ))
                        })()}
                      </div>
                    </div>
                  )
                },
                {
                  key: 'visualizacao',
                  label: 'Visualização',
                  value: draftVisualizacao === 'chave' ? 'Só chave' : 'Todos',
                  open: secOpen.visualizacao,
                  onToggle: () => setSecOpen(s => ({ ...s, visualizacao: !s.visualizacao })),
                  body: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        { id: 'geral', label: 'Todos os comportamentos' },
                        { id: 'chave', label: 'Só chave' }
                      ].map(opt => (
                        <label
                          key={opt.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '4px 6px',
                            borderRadius: 5,
                            cursor: 'pointer'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-background-secondary)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <input
                            type="radio"
                            name="car-filtro-vis"
                            checked={draftVisualizacao === opt.id}
                            onChange={() => setDraftVisualizacao(opt.id)}
                            style={{ accentColor: 'var(--comp-light)', width: 14, height: 14 }}
                          />
                          <span style={{ fontSize: 13, fontWeight: draftVisualizacao === opt.id ? 500 : 400 }}>
                            {opt.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  )
                }
              ].map((sec, idx, arr) => (
                <div
                  key={sec.key}
                  style={{
                    padding: '10px 14px',
                    borderBottom: idx === arr.length - 1 ? 'none' : '0.5px solid var(--color-border-tertiary)'
                  }}
                >
                  <button
                    type="button"
                    onClick={sec.onToggle}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ textAlign: 'left' }}>
                      <div
                        style={{
                          fontSize: 11,
                          textTransform: 'uppercase',
                          color: 'var(--color-text-secondary)',
                          opacity: 0.9
                        }}
                      >
                        {sec.label}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2, color: 'var(--color-text-primary)' }}>
                        {sec.value}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{sec.open ? '▴' : '▾'}</div>
                  </button>
                  {sec.open && <div style={{ marginTop: 10 }}>{sec.body}</div>}
                </div>
              ))}

              <div
                style={{
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  borderTop: '0.5px solid var(--color-border-tertiary)'
                }}
              >
                <button
                  type="button"
                  onClick={() => setFiltrosOpen(false)}
                  style={{
                    border: '0.5px solid var(--color-border-secondary)',
                    background: 'transparent',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPeriodo(draftPeriodo)
                    setSelecao((draftSelecoes || [])[0] || '')
                    setSelecaoMultipla((draftSelecoes || []).filter(Boolean))
                    const nextAreas = (draftAreas || []).filter(Boolean)
                    const areasFinal = nextAreas.length ? (nextAreas.includes('geral') ? ['geral'] : nextAreas) : ['geral']
                    setAreasMultiplas(areasFinal)
                    setAreaSelecionada(areasFinal.includes('geral') ? 'geral' : (areasFinal[0] || 'geral'))
                    setVisualizacao(draftVisualizacao === 'chave' ? 'chave' : 'geral')
                    setFiltrosOpen(false)
                  }}
                  style={{
                    border: 'none',
                    background: 'var(--comp-mid)',
                    color: 'var(--hdr-text)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {filtrosAtivos.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: 14
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Ativos:</span>
          {filtrosAtivos.map(f => (
            <span
              key={f.key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'var(--color-background-secondary)',
                border: '0.5px solid var(--color-border-secondary)',
                borderRadius: 12,
                padding: '3px 10px',
                fontSize: 11
              }}
            >
              {f.label}
              <span
                onClick={() => removerFiltro(f.key)}
                style={{ cursor: 'pointer', fontSize: 12, color: 'var(--color-text-secondary)' }}
              >
                ×
              </span>
            </span>
          ))}
          <button
            type="button"
            onClick={limparTudoAplicado}
            style={{
              border: 'none',
              background: 'transparent',
              padding: '3px 6px',
              fontSize: 11,
              color: 'var(--ind-light)',
              cursor: 'pointer'
            }}
          >
            Limpar tudo
          </button>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          alignItems: 'stretch',
          marginBottom: 14
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            borderRadius: 8,
            overflow: 'hidden',
            border: '0.5px solid var(--comp-bdr)'
          }}
        >
          <div
            style={{
              background: 'var(--comp-mid)',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--hdr-text)', textAlign: 'center' }}>
              Meta / Comportamento — Engajamento
            </div>
            <div style={{ fontSize: 11, color: 'var(--hdr-sub)', textAlign: 'center' }}>
              {resumoExecutivo.compAtivos} comportamentos ativos no período
            </div>
          </div>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              background: 'var(--comp-bg)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flex: 1,
                minHeight: 0
              }}
            >
              <CarinhaBlocoResumo
                tipo="comp"
                codigo={codigoCarinhaComportamentos}
                labelColor={corLabelFaixaResultadoMedioMes(resultadoMedioMesComp)}
                imgAlt="carinha engajamento"
                carinhaVisible={carinhaVisible}
              />
              <div
                style={{
                  width: '0.5px',
                  minWidth: '0.5px',
                  alignSelf: 'stretch',
                  background: 'rgba(0, 0, 0, 0.12)',
                  margin: '0 4px',
                  flexShrink: 0
                }}
              />
              <div
                style={{
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 0,
                  minWidth: 0
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    padding: '0 6px'
                  }}
                >
                  <div style={{ fontSize: 11, color: '#555', fontWeight: 500, marginBottom: 8 }}>
                    Atingidos (≥60%)
                  </div>

                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 10,
                        fontWeight: 500,
                        borderRadius: 10,
                        padding: '2px 9px',
                        marginBottom: 4,
                        whiteSpace: 'nowrap',
                        background: '#c0dd97',
                        color: '#27500a'
                      }}
                    >
                      {metricasSemanaAtual.labelTagSemana}
                    </span>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 500,
                        lineHeight: 1.2,
                        color: corValorGrandeEngajamento(metricasSemanaAtual.comp.pctAting)
                      }}
                    >
                      {metricasSemanaAtual.comp.atingidos} de {metricasSemanaAtual.comp.total}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 2,
                        marginBottom: 3,
                        color: corValorGrandeEngajamento(metricasSemanaAtual.comp.pctAting)
                      }}
                    >
                      {metricasSemanaAtual.comp.atg?.label ?? '—'}
                    </div>
                    <BarraProgresso pct={metricasSemanaAtual.comp.pctAting} />
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '0.5px dashed rgba(0,0,0,0.12)',
                      width: '100%'
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 10,
                        fontWeight: 500,
                        borderRadius: 10,
                        padding: '2px 9px',
                        marginBottom: 4,
                        whiteSpace: 'nowrap',
                        background: '#c0dd97',
                        color: '#27500a'
                      }}
                    >
                      {labelTagPeriodoFiltro}
                    </span>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 500,
                        lineHeight: 1.2,
                        color: corValorGrandeEngajamento(resumoCardsVisual.pctAtingidosComp)
                      }}
                    >
                      {resumoExecutivo.compOk[0]} de {resumoExecutivo.compOk[1]}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 2,
                        marginBottom: 3,
                        color: corValorGrandeEngajamento(resumoCardsVisual.pctAtingidosComp)
                      }}
                    >
                      {resumoCardsVisual.atgComp?.label ?? '—'}
                    </div>
                    <BarraProgresso pct={resumoCardsVisual.pctAtingidosComp} />
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    padding: '0 6px',
                    borderLeft: '0.5px solid rgba(0,0,0,0.08)'
                  }}
                >
                  <div style={{ fontSize: 11, color: '#555', fontWeight: 500, marginBottom: 8 }}>
                    Resultado médio
                  </div>

                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 10,
                        fontWeight: 500,
                        borderRadius: 10,
                        padding: '2px 9px',
                        marginBottom: 4,
                        whiteSpace: 'nowrap',
                        background: '#c0dd97',
                        color: '#27500a'
                      }}
                    >
                      {metricasSemanaAtual.labelTagSemana}
                    </span>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 500,
                        lineHeight: 1.2,
                        color: corValorGrandeEngajamento(metricasSemanaAtual.comp.mediaPct)
                      }}
                    >
                      {metricasSemanaAtual.comp.mediaPct != null ? `${metricasSemanaAtual.comp.mediaPct}%` : '—'}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 2,
                        marginBottom: 3,
                        color: corValorGrandeEngajamento(metricasSemanaAtual.comp.mediaPct)
                      }}
                    >
                      {metricasSemanaAtual.comp.rm?.label ?? '—'}
                    </div>
                    <BarraProgresso pct={metricasSemanaAtual.comp.mediaPct} />
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '0.5px dashed rgba(0,0,0,0.12)',
                      width: '100%'
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 10,
                        fontWeight: 500,
                        borderRadius: 10,
                        padding: '2px 9px',
                        marginBottom: 4,
                        whiteSpace: 'nowrap',
                        background: '#c0dd97',
                        color: '#27500a'
                      }}
                    >
                      {labelTagPeriodoFiltro}
                    </span>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 500,
                        lineHeight: 1.2,
                        color: corValorGrandeEngajamento(resumoCardsVisual.engajamentoMedioPct)
                      }}
                    >
                      {resumoCardsVisual.engajamentoMedioPct != null ? `${resumoCardsVisual.engajamentoMedioPct}%` : '—'}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 2,
                        marginBottom: 3,
                        color: corValorGrandeEngajamento(resumoCardsVisual.engajamentoMedioPct)
                      }}
                    >
                      {resumoCardsVisual.rmComp?.label ?? '—'}
                    </div>
                    <BarraProgresso pct={resumoCardsVisual.engajamentoMedioPct} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            borderRadius: 8,
            overflow: 'hidden',
            border: '0.5px solid var(--ind-bdr)'
          }}
        >
          <div
            style={{
              background: 'var(--ind-dark)',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--hdr-text)', textAlign: 'center' }}>
              Indicadores — Resultado
            </div>
            <div style={{ fontSize: 11, color: 'var(--hdr-sub)', textAlign: 'center' }}>
              {resumoExecutivo.indAtivos} indicadores ativos no período
            </div>
          </div>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              background: 'var(--ind-bg)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flex: 1,
                minHeight: 0
              }}
            >
              <CarinhaBlocoResumo
                tipo="ind"
                codigo={codigoCarinhaIndicadores}
                labelColor={corLabelFaixaResultadoMedioMes(resultadoMedioMesInd)}
                imgAlt="carinha indicadores"
                carinhaVisible={carinhaVisible}
              />
              <div
                style={{
                  width: '0.5px',
                  minWidth: '0.5px',
                  alignSelf: 'stretch',
                  background: 'rgba(0, 0, 0, 0.12)',
                  margin: '0 4px',
                  flexShrink: 0
                }}
              />
              <div
                style={{
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 0,
                  minWidth: 0
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    padding: '0 6px'
                  }}
                >
                  <div style={{ fontSize: 11, color: '#555', fontWeight: 500, marginBottom: 8 }}>
                    Atingidos (≥60%)
                  </div>

                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 10,
                        fontWeight: 500,
                        borderRadius: 10,
                        padding: '2px 9px',
                        marginBottom: 4,
                        whiteSpace: 'nowrap',
                        background: '#b5d4f4',
                        color: '#0c447c'
                      }}
                    >
                      {metricasSemanaAtual.labelTagSemana}
                    </span>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 500,
                        lineHeight: 1.2,
                        color: corValorGrandeIndicador(metricasSemanaAtual.ind.pctAting)
                      }}
                    >
                      {metricasSemanaAtual.ind.atingidos} de {metricasSemanaAtual.ind.total}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 2,
                        marginBottom: 3,
                        color: corValorGrandeIndicador(metricasSemanaAtual.ind.pctAting)
                      }}
                    >
                      {metricasSemanaAtual.ind.atg?.label ?? '—'}
                    </div>
                    <BarraProgresso pct={metricasSemanaAtual.ind.pctAting} />
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '0.5px dashed rgba(0,0,0,0.12)',
                      width: '100%'
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 10,
                        fontWeight: 500,
                        borderRadius: 10,
                        padding: '2px 9px',
                        marginBottom: 4,
                        whiteSpace: 'nowrap',
                        background: 'var(--surf2)',
                        color: 'var(--moni-texto-suave)'
                      }}
                    >
                      {labelTagPeriodoFiltro}
                    </span>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 500,
                        lineHeight: 1.2,
                        color: corValorGrandeIndicador(resumoCardsVisual.pctAtingidosInd)
                      }}
                    >
                      {resumoExecutivo.indAtingidos[0]} de {resumoExecutivo.indAtingidos[1]}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 2,
                        marginBottom: 3,
                        color: corValorGrandeIndicador(resumoCardsVisual.pctAtingidosInd)
                      }}
                    >
                      {resumoCardsVisual.atgInd?.label ?? '—'}
                    </div>
                    <BarraProgresso pct={resumoCardsVisual.pctAtingidosInd} />
                  </div>
              </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    padding: '0 6px',
                    borderLeft: '0.5px solid rgba(0,0,0,0.08)'
                  }}
                >
                  <div style={{ fontSize: 11, color: '#555', fontWeight: 500, marginBottom: 8 }}>
                    Resultado médio
                  </div>

                  <div>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 10,
                        fontWeight: 500,
                        borderRadius: 10,
                        padding: '2px 9px',
                        marginBottom: 4,
                        whiteSpace: 'nowrap',
                        background: '#b5d4f4',
                        color: '#0c447c'
                      }}
                    >
                      {metricasSemanaAtual.labelTagSemana}
                    </span>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 500,
                        lineHeight: 1.2,
                        color: corValorGrandeIndicador(metricasSemanaAtual.ind.mediaPct)
                      }}
                    >
                      {metricasSemanaAtual.ind.mediaPct != null ? `${metricasSemanaAtual.ind.mediaPct}%` : '—'}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 2,
                        marginBottom: 3,
                        color: corValorGrandeIndicador(metricasSemanaAtual.ind.mediaPct)
                      }}
                    >
                      {metricasSemanaAtual.ind.rm?.label ?? '—'}
                    </div>
                    <BarraProgresso pct={metricasSemanaAtual.ind.mediaPct} />
                  </div>

                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: '0.5px dashed rgba(0,0,0,0.12)',
                      width: '100%'
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: 10,
                        fontWeight: 500,
                        borderRadius: 10,
                        padding: '2px 9px',
                        marginBottom: 4,
                        whiteSpace: 'nowrap',
                        background: '#b5d4f4',
                        color: '#0c447c'
                      }}
                    >
                      {labelTagPeriodoFiltro}
                    </span>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 500,
                        lineHeight: 1.2,
                        color: corValorGrandeIndicador(resumoCardsVisual.indicadorMedioPct)
                      }}
                    >
                      {resumoCardsVisual.indicadorMedioPct != null ? `${resumoCardsVisual.indicadorMedioPct}%` : '—'}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 2,
                        marginBottom: 3,
                        color: corValorGrandeIndicador(resumoCardsVisual.indicadorMedioPct)
                      }}
                    >
                      {resumoCardsVisual.rmInd?.label ?? '—'}
                    </div>
                    <BarraProgresso pct={resumoCardsVisual.indicadorMedioPct} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 10,
          fontSize: 12,
          color: 'var(--moni-texto-suave)'
        }}
      >
        <span style={{ fontWeight: 500, color: 'var(--moni-texto)' }}>Comportamento e Indicador:</span>
        {[
          { bg: '#2e7d32', fg: '#fff', label: '≥75%' },
          { bg: '#8bc34a', fg: '#fff', label: '60–74%' },
          { bg: '#e6a817', fg: '#fff', label: '30–59%' },
          { bg: '#e74c3c', fg: '#fff', label: '<30%' },
          { empty: true, label: 'Sem dado' }
        ].map(item =>
          item.empty ? (
            <SemBadge key={item.label} variant="legend" empty>
              {item.label}
            </SemBadge>
          ) : (
            <SemBadge key={item.label} variant="legend" style={{ background: item.bg, color: item.fg }}>
              {item.label}
            </SemBadge>
          )
        )}
        <span
          style={{
            marginLeft: 8,
            background: 'var(--comp-bg)',
            padding: '2px 8px',
            borderRadius: 4,
            border: '0.5px solid var(--comp-bdr)',
            color: 'var(--comp-text)',
            fontSize: 11
          }}
        >
          ★ Semana atual
        </span>
      </div>

      {loading ? (
        <p>Carregando…</p>
      ) : !(selecao || (selecaoMultipla?.length > 0)) || semanasOrdenadas.length === 0 ? (
        <p className="empty-state">Selecione um período com datas válidas.</p>
      ) : semanasVisiveis.length === 0 ? (
        <p className="empty-state">Não há semanas ISO neste período para exibir.</p>
      ) : dadosProcessados.length === 0 ? (
        <p className="empty-state">Nenhum dado para os filtros atuais.</p>
      ) : (
        <div style={{ width: '100%', overflowX: 'auto', borderRadius: 12 }}>
          <table
            className="carometro-scorecard-table"
            style={{
              tableLayout: 'fixed',
              width: '100%',
              minWidth: 200 + 38 + 70 + 52 * semanasVisiveis.length + 96,
              borderCollapse: 'separate',
              borderSpacing: 0,
              border: '0.5px solid rgba(0,0,0,0.12)',
              borderRadius: 12,
              overflow: 'hidden',
              background: 'var(--surf0)',
              fontSize: 12
            }}
          >
            <colgroup>
              <col style={{ width: 200 }} />
              <col style={{ width: 38 }} />
              <col style={{ width: 70 }} />
              {semanasVisiveis.map(s => (
                <col key={s} style={{ width: 52 }} />
              ))}
              <col style={{ width: 96 }} />
            </colgroup>
            <thead>
              <tr className="carometro-thead-row">
                <th className="carometro-th carometro-th--label">Comportamento / Indicador</th>
                <th className="carometro-th carometro-th--chave">Chave</th>
                <th className="carometro-th carometro-th--resp">Responsável</th>
                {semanasVisiveis.map(w => {
                  const dest = w === semanaColunaDestaque
                  return (
                    <th
                      key={w}
                      className={`carometro-th carometro-th--week${dest ? ' carometro-th--week-atual' : ''}`}
                    >
                      S{w}
                      {dest ? ' ★' : ''}
                      <span className="carometro-th-week-dates">
                        {getDatasSemanaCurta(w, anoDatasSemana)}
                      </span>
                    </th>
                  )
                })}
                <th className="carometro-th carometro-th--status">Status</th>
              </tr>
            </thead>
            <tbody>
              {dadosProcessados.map(block => (
                <Fragment key={block.area.id}>
                  <tr className="carometro-row--area">
                    <td colSpan={4 + semanasVisiveis.length} className="carometro-td-area">
                      {block.area.nome}
                    </td>
                  </tr>
                  {block.metas.map(meta => (
                    <Fragment key={meta.id}>
                      <tr className="carometro-row--meta">
                        <td className="carometro-td-meta">
                          <div className="carometro-meta-title">
                            {meta.descricao}
                            {meta.prazo && (
                              <span className="carometro-meta-prazo">Prazo {meta.prazo}</span>
                            )}
                          </div>
                        </td>
                        <td className="carometro-td-meta-fill" />
                        <td className="carometro-td-meta-fill" />
                        {semanasVisiveis.map(w => (
                          <td key={w} className="carometro-td-meta-fill" />
                        ))}
                        <td className="carometro-td-meta-fill" />
                      </tr>
                      {meta.comportamentos.map(c => (
                        <tr key={c.id} className="carometro-row--comp">
                          <td className="carometro-td-comp-label">
                            <div className="carometro-comp-label-inner">
                              <span className="chip-comp">Comp.</span>
                              <span className="carometro-comp-nome">{c.nome}</span>
                            </div>
                          </td>
                          <td className="carometro-td-comp-chave">
                            <input
                              type="checkbox"
                              checked={!!c.isChave}
                              disabled={!isAdmin || salvandoChave === `t-${c.id}`}
                              onChange={() =>
                                toggleChaveTarefa({ id: c.id, is_chave: c.isChave })
                              }
                              title={
                                isAdmin
                                  ? 'Comportamento chave (caneta verde nas ações)'
                                  : 'Somente administradores podem alterar'
                              }
                              style={{
                                width: 12,
                                height: 12,
                                cursor: isAdmin ? 'pointer' : 'not-allowed',
                                accentColor: 'var(--comp-light)'
                              }}
                            />
                          </td>
                          <td className="carometro-td-comp-resp">{c.responsavel}</td>
                          {semanasVisiveis.map(w => (
                            <td
                              key={w}
                              className={`carometro-td-week carometro-td-week--comp${
                                w === semanaColunaDestaque ? ' carometro-td-week--atual' : ''
                              }`}
                            >
                              <CelulaSemanaComportamento
                                cod={c.semanas[Number(w)] ?? 'ena'}
                                pct={c.pctSemanas?.[Number(w)]}
                                comentarioTooltip={textoComentarioComportamentoCar(c.id, w)}
                              />
                            </td>
                          ))}
                          <td className="carometro-td-comp-status">
                            <PillStatusComportamento
                              cod={statusConsolidadoComportamento(
                                c.pctSemanas || {},
                                semanasVisiveis,
                                c.pctPeriodo
                              )}
                              pctMedia={
                                c.pctPeriodo != null && !Number.isNaN(c.pctPeriodo)
                                  ? c.pctPeriodo
                                  : mediaPctComportamento(c.pctSemanas || {}, semanasVisiveis)
                              }
                            />
                          </td>
                        </tr>
                      ))}
                      {meta.indicadores.map(ind => (
                        <tr key={ind.id} className="carometro-row--ind">
                          <td className="carometro-td-ind-label">
                            <div className="carometro-ind-label-inner">
                              <span className="chip-ind">Ind.</span>
                              <span className="carometro-ind-nome">{ind.nome}</span>
                            </div>
                          </td>
                          <td className="carometro-td-ind-chave">
                            <input
                              type="checkbox"
                              checked={!!ind.isChave}
                              disabled={!isAdmin || salvandoChave === `i-${ind.id}`}
                              onChange={() => toggleChaveIndicador(ind)}
                              title={isAdmin ? 'Indicador chave' : 'Somente administradores'}
                              style={{
                                width: 12,
                                height: 12,
                                cursor: isAdmin ? 'pointer' : 'not-allowed',
                                accentColor: 'var(--ind-light)'
                              }}
                            />
                          </td>
                          <td className="carometro-td-ind-resp">—</td>
                          {semanasVisiveis.map(w => (
                            <td
                              key={w}
                              className={`carometro-td-week carometro-td-week--ind${
                                w === semanaColunaDestaque ? ' carometro-td-week--atual' : ''
                              }`}
                            >
                              <CelulaIndicadorSemana
                                cod={ind.semanas[Number(w)] ?? 'ina'}
                                valor={ind.valorSemanas?.[Number(w)]}
                                comentarioTooltip={textoComentarioIndicadorCar(ind.id, w)}
                              />
                            </td>
                          ))}
                          <td className="carometro-td-ind-status">
                            <PillStatusIndicador
                              cod={statusUltimoIndicador(ind.semanas || {}, semanasVisiveis)}
                              pctMedia={mediaPctIndicador(ind.semanas || {}, semanasVisiveis)}
                            />
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
