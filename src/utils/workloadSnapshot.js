import { HOURS_PER_DAY, WORK_DAYS_PER_WEEK } from './workloadCapacidade'

/**
 * Monta o payload no formato GET /workload (uso no front; futura API pode reutilizar).
 */
export function buildWorkloadSnapshot({
  nomeArea,
  dataInicio,
  dataFim,
  diasUteis,
  horasPorRecurso,
  capacidadeTotal,
  horasPlanejadas,
  utilizacaoPct,
  pico,
  semanas,
  comportamentos
}) {
  return {
    area: nomeArea,
    intervalo: {
      start: dataInicio,
      end: dataFim,
      dias_uteis: diasUteis,
      horas_por_recurso: horasPorRecurso,
      capacidade_total: capacidadeTotal
    },
    horas_planejadas: Math.round(horasPlanejadas * 10) / 10,
    utilizacao_pct: Math.round(utilizacaoPct),
    pico,
    semanas,
    comportamentos
  }
}

/** Capacidade semanal de referência (h/recurso): 5 dias × 8 h. */
export function capSemanalPorRecurso() {
  return WORK_DAYS_PER_WEEK * HOURS_PER_DAY
}

/**
 * Utilização simulada (especificação): horas_totais / (cap_semanal × recursos_sim × semanas_sim / 4) × 100
 * com cap_semanal = 40 h/semana/recurso.
 */
export function utilizacaoSimuladaPct(horasTotais, recursosSim, semanasSim) {
  const capSemanal = capSemanalPorRecurso()
  const denom = (capSemanal * recursosSim * semanasSim) / 4
  if (denom <= 0) return 0
  return (horasTotais / denom) * 100
}

/** Pico simulado: carga média semanal por recurso vs 40 h. */
export function picoSimuladoPct(horasTotais, recursosSim, semanasSim) {
  if (recursosSim <= 0 || semanasSim <= 0) return 0
  const hPorSemanaEquipe = horasTotais / semanasSim
  const hPorRecurso = hPorSemanaEquipe / recursosSim
  return (hPorRecurso / capSemanalPorRecurso()) * 100
}
