/**
 * Utilitários para cálculo de progresso acumulado do trimestre.
 * Painel de indicadores semanais.
 *
 * Cada indicador possui:
 * - meta total do trimestre
 * - meta semanal
 * - realizado semanal (por semana)
 *
 * Fórmulas:
 * - realizado_acumulado = soma(realizado_semanal) até semana_atual
 * - percentual_trimestre = (realizado_acumulado / meta_trimestre) * 100
 * - meta_acumulada_ate_semana = meta_semanal * semana_atual
 * - atrasado = meta_acumulada_ate_semana - realizado_acumulado
 */

/**
 * Converte realizadoSemanal para array indexado por semana (1-based).
 * Aceita: array [v1, v2, ...], objeto {1: v1, 2: v2, ...}, ou array de 13 posições.
 */
function normalizarRealizadoSemanal(realizadoSemanal) {
  if (realizadoSemanal == null) return []
  if (Array.isArray(realizadoSemanal)) {
    return realizadoSemanal.map((v, i) => ({ semana: i + 1, valor: Number(v) || 0 }))
  }
  if (typeof realizadoSemanal === 'object') {
    return Object.entries(realizadoSemanal).map(([k, v]) => ({
      semana: parseInt(k, 10),
      valor: Number(v) || 0
    }))
  }
  return []
}

/**
 * Calcula o realizado acumulado até a semana atual.
 * @param {Array<{semana: number, valor: number}>} realizados - Lista de realizados por semana
 * @param {number} semanaAtual - Semana atual do trimestre (1-13)
 */
export function calcularRealizadoAcumulado(realizados, semanaAtual) {
  const ate = Math.min(Math.max(1, semanaAtual), 13)
  return realizados
    .filter(r => r.semana >= 1 && r.semana <= ate)
    .reduce((s, r) => s + r.valor, 0)
}

/**
 * Calcula a meta acumulada até a semana atual.
 * meta_acumulada_ate_semana = meta_semanal * semana_atual
 */
export function calcularMetaAcumuladaAteSemana(metaSemanal, semanaAtual) {
  const ate = Math.min(Math.max(1, semanaAtual), 13)
  return (metaSemanal || 0) * ate
}

/**
 * Calcula a quantidade atrasada.
 * atrasado = meta_acumulada_ate_semana - realizado_acumulado (mínimo 0)
 */
export function calcularAtrasado(metaAcumuladaAteSemana, realizadoAcumulado) {
  return Math.max(0, (metaAcumuladaAteSemana || 0) - (realizadoAcumulado || 0))
}

/**
 * Calcula o percentual entregue do trimestre.
 * percentual_trimestre = (realizado_acumulado / meta_trimestre) * 100
 */
export function calcularPercentualTrimestre(realizadoAcumulado, metaTrimestre) {
  if (metaTrimestre == null || metaTrimestre <= 0) return null
  return Math.round(((realizadoAcumulado || 0) / metaTrimestre) * 100)
}

/**
 * Calcula todos os indicadores de progresso do trimestre.
 *
 * @param {Object} params
 * @param {number} params.metaTrimestre - Meta total do trimestre
 * @param {number} params.metaSemanal - Meta por semana
 * @param {number[]|Object<number,number>} params.realizadoSemanal - Realizado por semana
 *   - Array: [v1, v2, ...] onde índice 0 = S01
 *   - Objeto: { 1: v1, 2: v2, ... }
 * @param {number} params.semanaAtual - Semana atual do trimestre (1-13)
 * @param {number} [params.metaAcumuladaAteSemana] - Override: meta acumulada até semana (ex.: Gantt com semanas irregulares)
 *
 * @returns {Object} { realizadoAcumulado, percentualTrimestre, atrasado, metaAcumuladaAteSemana, planejadoTrimestre }
 */
export function calcularProgressoTrimestre({
  metaTrimestre,
  metaSemanal,
  realizadoSemanal,
  semanaAtual,
  metaAcumuladaAteSemana: metaAcumuladaOverride
}) {
  const realizados = normalizarRealizadoSemanal(realizadoSemanal)
  const semana = Math.min(Math.max(1, semanaAtual || 0), 13)

  const realizadoAcumulado = calcularRealizadoAcumulado(realizados, semana)
  const metaAcumuladaAteSemana =
    metaAcumuladaOverride != null
      ? metaAcumuladaOverride
      : calcularMetaAcumuladaAteSemana(metaSemanal, semana)
  const atrasado = calcularAtrasado(metaAcumuladaAteSemana, realizadoAcumulado)
  const percentualTrimestre = calcularPercentualTrimestre(realizadoAcumulado, metaTrimestre)

  return {
    realizadoAcumulado,
    percentualTrimestre,
    atrasado,
    metaAcumuladaAteSemana,
    planejadoTrimestre: metaTrimestre
  }
}

/**
 * Adaptador para dados no formato do Carômetro (comportamentos/ Gantt).
 * Converte status binário (concluído/não) em realizado semanal.
 *
 * @param {Object} item - Item do Carômetro (comportamento ou ação Gantt)
 * @param {Object} statusSemana - { [itemId_semana]: 'concluido' | ... }
 * @param {Object} cronogramaStatus - { [acaoId_semana]: 'concluido' | ... }
 * @param {number} semanaAtual - Semana atual
 * @returns {{ metaTrimestre: number, metaSemanal: number, realizadoSemanal: Object, semanaAtual: number, metaAcumuladaAteSemana: number }}
 */
export function adaptarDadosCarometro(item, statusSemana, cronogramaStatus, semanaAtual) {
  const isGantt = item.tipo === 'gantt'
  const isComportamento = item.tipo === 'comportamento'
  const semanas = isGantt
    ? (item.semanas_selecionadas || [])
    : isComportamento
      ? (item.semanas_planejadas || [])
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
  const ate = Math.min(semanaAtual || 0, 13)

  const metaTrimestre = semanas.length
  const metaSemanal = 1
  const metaAcumuladaAteSemana = semanas.filter(s => s >= 1 && s <= ate).length

  const realizadoSemanal = {}
  semanas.forEach(s => {
    const concluido = isGantt
      ? (cronogramaStatus[`${item.acao_id}_${s}`] || '') === 'concluido'
      : (statusSemana[`${item.id}_${s}`] || '') === 'concluido'
    realizadoSemanal[s] = concluido ? 1 : 0
  })

  return {
    metaTrimestre,
    metaSemanal,
    realizadoSemanal,
    semanaAtual: ate,
    metaAcumuladaAteSemana
  }
}
