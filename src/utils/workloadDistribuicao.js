import {
  HOURS_PER_DAY,
  calcularFatorRecorrencia,
  mondayDaSemanaContendo,
  toYMDDate
} from './workloadCapacidade'

function toYMD(d) {
  return toYMDDate(d)
}

function diasUteisNaSemanaNoIntervalo(mondayStr, inicioStr, fimStr) {
  const mon = new Date(`${mondayStr}T12:00:00`)
  let n = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    const dow = d.getDay()
    if (dow === 0 || dow === 6) continue
    const ymd = toYMD(d)
    if (ymd >= inicioStr && ymd <= fimStr) n++
  }
  return n
}

/** Capacidade (horas equipe) por semana calendário no intervalo. */
export function capacidadePorSemanaLista(semanasLista, inicioStr, fimStr, recursos) {
  const r = Math.max(1, recursos)
  return semanasLista.map(w => diasUteisNaSemanaNoIntervalo(w.mondayStr, inicioStr, fimStr) * HOURS_PER_DAY * r)
}

/**
 * Distribui horas planejadas por semana para o gráfico e calcula pico.
 */
export function calcularCargaSemanal({
  tarefas,
  metricas,
  dataInicio,
  dataFim,
  recursos,
  incluidoAcao
}) {
  const weeks = metricas.semanasLista || []
  const n = weeks.length
  const horas = Array.from({ length: n }, () => 0)
  if (!n || !dataInicio || !dataFim) {
    return {
      semanas: [],
      horasPorSemana: [],
      capacidadePorSemana: [],
      pico: { semana: '—', horas: 0, pct: 0 }
    }
  }

  const caps = capacidadePorSemanaLista(weeks, dataInicio, dataFim, recursos)

  tarefas.forEach(t => {
    ;(t.acoes || []).forEach(acao => {
      if (!acao.tempo_estimado_minutos) return
      const conta = incluidoAcao[acao.id] !== false
      const tempo = acao.tempo_estimado_minutos / 60
      const mult =
        acao.multiplicador_valor != null && !Number.isNaN(Number(acao.multiplicador_valor))
          ? Number(acao.multiplicador_valor)
          : 1
      const rec = acao.recorrencia || 'unica'
      const fator = calcularFatorRecorrencia(rec, metricas)
      const th = tempo * mult * fator

      if (!conta) return

      if (rec === 'unica') {
        horas[0] += th
        return
      }
      if (rec === 'diaria') {
        const ini = new Date(`${dataInicio}T12:00:00`)
        const fim = new Date(`${dataFim}T12:00:00`)
        const cur = new Date(ini)
        while (cur <= fim) {
          const dow = cur.getDay()
          if (dow !== 0 && dow !== 6) {
            const mon = mondayDaSemanaContendo(cur)
            const key = toYMD(mon)
            const wi = weeks.findIndex(w => w.mondayStr === key)
            if (wi >= 0) horas[wi] += tempo * mult
          }
          cur.setDate(cur.getDate() + 1)
        }
        return
      }
      if (rec === 'semanal') {
        for (let i = 0; i < n; i++) horas[i] += tempo * mult
        return
      }
      if (rec === 'quinzenal') {
        let occ = 0
        const maxOcc = fator
        for (let i = 0; i < n && occ < maxOcc; i += 2) {
          horas[i] += tempo * mult
          occ++
        }
        return
      }
      if (rec === 'mensal') {
        const ini = new Date(`${dataInicio}T12:00:00`)
        const fim = new Date(`${dataFim}T12:00:00`)
        let curMonth = new Date(ini.getFullYear(), ini.getMonth(), 1)
        const endM = new Date(fim.getFullYear(), fim.getMonth(), 1)
        while (curMonth <= endM) {
          const monthStart = new Date(curMonth.getFullYear(), curMonth.getMonth(), 1)
          const monthEnd = new Date(curMonth.getFullYear(), curMonth.getMonth() + 1, 0, 12, 0, 0)
          const overlapStart = monthStart > ini ? monthStart : ini
          const overlapEnd = monthEnd < fim ? monthEnd : fim
          if (overlapStart <= overlapEnd) {
            const horasMes = tempo * mult
            const idxs = []
            for (let i = 0; i < weeks.length; i++) {
              const wStart = new Date(`${weeks[i].mondayStr}T12:00:00`)
              const wEnd = new Date(wStart)
              wEnd.setDate(wStart.getDate() + 6)
              if (!(wEnd < overlapStart || wStart > overlapEnd)) idxs.push(i)
            }
            const part = idxs.length ? horasMes / idxs.length : 0
            idxs.forEach(i => {
              horas[i] += part
            })
          }
          curMonth.setMonth(curMonth.getMonth() + 1)
        }
        return
      }
      const per = th / n
      for (let i = 0; i < n; i++) horas[i] += per
    })
  })

  let maxPct = 0
  let maxIdx = 0
  let maxHoras = 0
  horas.forEach((h, i) => {
    const cap = caps[i] || 1
    const pct = (h / cap) * 100
    if (pct > maxPct || (pct === maxPct && h > maxHoras)) {
      maxPct = pct
      maxIdx = i
      maxHoras = h
    }
  })

  const semanasOut = weeks.map((w, i) => ({
    semana: w.label,
    horas: Math.round(horas[i] * 100) / 100
  }))

  return {
    semanas: semanasOut,
    horasPorSemana: horas,
    capacidadePorSemana: caps,
    pico: {
      semana: weeks[maxIdx]?.label || '—',
      horas: Math.round(maxHoras * 100) / 100,
      pct: Math.round(maxPct)
    }
  }
}

export { diasUteisNaSemanaNoIntervalo }
