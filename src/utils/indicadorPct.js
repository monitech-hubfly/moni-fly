/**
 * Converte valor de lançamento + meta no percentual (0-100) por tipo de indicador.
 * Usado no Carômetro para exibir farol por indicador e média entre indicadores.
 */
/**
 * @param {string} tipo - Tipo do indicador (quantidade, binario, percentual, etc.)
 * @param {string|number|null} valor - Valor lançado (texto da célula)
 * @param {number|null} metaValor - Meta do indicador
 * @returns {number|null} Percentual 0-100 ou null se sem valor
 */
export function pctFromIndicador(tipo, valor, metaValor) {
  const v = valor != null && valor !== '' ? String(valor).trim() : null
  if (v == null || v === '') return null

  const num = (n) => (n === '' || n === null || n === undefined ? NaN : Number(n))
  const nVal = num(v)
  const nMeta = metaValor != null ? Number(metaValor) : null

  switch (tipo) {
    case 'binario':
      if (v.toLowerCase() === 'sim' || v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 's' || nVal > 0) return 100
      return 0
    case 'percentual':
      return Math.min(100, Math.max(0, isNaN(nVal) ? 0 : nVal))
    case 'quantidade':
    case 'valor_financeiro':
    case 'nota':
    case 'outro':
    default:
      if (nMeta != null && nMeta > 0) {
        const pct = (nVal / nMeta) * 100
        return Math.min(100, Math.max(0, isNaN(pct) ? 0 : pct))
      }
      return isNaN(nVal) ? null : 100
  }
}

/**
 * Calcula média dos percentuais por (tarefa_id, semana) a partir de indicadores e lançamentos.
 * @param {Array<{id: string, tarefa_id: string, tipo: string, meta_valor: number|null}>} indicadores
 * @param {Array<{indicador_id: string, semana: number, valor: string|null}>} lancamentos
 * @returns {{ pctPorTarefaSemana: Object.<string, Object.<number, number>>, pctGeralPorTarefa: Object.<string, number|null> }}
 */
export function mediaPctPorTarefaSemana(indicadores, lancamentos) {
  const lancPorIndSemana = new Map()
  ;(lancamentos || []).forEach(l => {
    const key = `${l.indicador_id}_${l.semana}`
    lancPorIndSemana.set(key, l.valor)
  })

  const indPorTarefa = new Map()
  ;(indicadores || []).forEach(ind => {
    if (!indPorTarefa.has(ind.tarefa_id)) indPorTarefa.set(ind.tarefa_id, [])
    indPorTarefa.get(ind.tarefa_id).push(ind)
  })

  const pctPorTarefaSemana = {}
  const pctGeralPorTarefa = {}

  indPorTarefa.forEach((inds, tarefaId) => {
    pctPorTarefaSemana[tarefaId] = {}
    const weeklyPcts = []
    for (let s = 1; s <= 13; s++) {
      const pcts = []
      inds.forEach(ind => {
        const val = lancPorIndSemana.get(`${ind.id}_${s}`)
        const pct = pctFromIndicador(ind.tipo, val, ind.meta_valor)
        if (pct != null) pcts.push(pct)
      })
      const avg = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null
      pctPorTarefaSemana[tarefaId][s] = avg
      if (avg != null) weeklyPcts.push(avg)
    }
    pctGeralPorTarefa[tarefaId] = weeklyPcts.length > 0
      ? Math.round(weeklyPcts.reduce((a, b) => a + b, 0) / weeklyPcts.length)
      : null
  })

  return { pctPorTarefaSemana, pctGeralPorTarefa }
}
