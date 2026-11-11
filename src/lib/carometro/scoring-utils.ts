/**
 * Funções de scoring compartilhadas entre useMeuCarometro (browser)
 * e carometro-status-snapshot (cron/API).
 * Mantê-las aqui garante paridade permanente entre as duas engines.
 */

/**
 * Retorna a última sexta-feira do mês (ciclo Boné Day).
 * @param ano  — 4 dígitos
 * @param mes  — 1-indexed (1=Jan … 12=Dez)
 */
export function ultimaSextaUtilDoMes(ano: number, mes: number): Date {
  const ultimo = new Date(ano, mes, 0); // day-0 trick: último dia do mês
  const dow = ultimo.getDay();           // 0=Dom … 5=Sex … 6=Sáb
  ultimo.setDate(ultimo.getDate() - (dow + 2) % 7); // recua até a sexta
  return ultimo;
}

/**
 * Pontuação tier por dias de atraso em relação ao deadline.
 * - Concluído no prazo (dias ≤ 0): 100
 * - 1–6 dias de atraso: 75
 * - 7–14 dias de atraso: 50
 * - 15+ dias de atraso: 20
 *
 * @param concluidoEm  — string ISO "YYYY-MM-DD" ou "YYYY-MM-DDTHH:…"
 * @param deadline     — Date de referência (último momento válido)
 */
export function tierPorAtraso(concluidoEm: string, deadline: Date): number {
  const conc = new Date(concluidoEm.slice(0, 10) + 'T00:00:00');
  const dias = Math.floor((conc.getTime() - deadline.getTime()) / 86_400_000);
  if (dias <= 0)  return 100;
  if (dias <= 6)  return 75;
  if (dias <= 14) return 50;
  return 20;
}

/**
 * Pontuação tier para Engajamento (Metas Filhas).
 * Recebe data_fim da filha e concluidoEmData (coluna concluido_em_data).
 * Sem datas → considera no prazo (100).
 */
export function tierFilha(dataFim: string | null, concluidoEmData: string | null): number {
  if (!dataFim || !concluidoEmData) return 100;
  const prazo = new Date(dataFim + 'T00:00:00');
  const conc  = new Date(concluidoEmData.slice(0, 10) + 'T00:00:00');
  const dias  = Math.floor((conc.getTime() - prazo.getTime()) / 86_400_000);
  if (dias <= 0)  return 100;
  if (dias <= 6)  return 75;
  if (dias <= 14) return 50;
  return 20;
}
