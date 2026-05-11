/**
 * Semana atual (1–13) dentro do intervalo de datas de um trimestre, ou null se fora do período.
 */
export function semanaAtualNoTrimestre(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return null
  const inicio = new Date(dataInicio)
  const fim = new Date(dataFim)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  inicio.setHours(0, 0, 0, 0)
  fim.setHours(0, 0, 0, 0)
  if (hoje < inicio || hoje > fim) return null
  const diffMs = hoje - inicio
  const diffDias = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  const semana = Math.floor(diffDias / 7) + 1
  return Math.min(Math.max(1, semana), 13)
}
