/** Constantes e helpers do módulo jurídico (sem "use server"). */

const STATUS_LABELS: Record<string, string> = {
  nova_duvida: "Nova Dúvida",
  em_analise: "Em análise com Jurídico",
  paralisado: "Paralisado",
  finalizado: "Finalizado",
};

export const JURIDICO_STATUS_LIST = [
  { value: "nova_duvida", label: STATUS_LABELS.nova_duvida },
  { value: "em_analise", label: STATUS_LABELS.em_analise },
  { value: "paralisado", label: STATUS_LABELS.paralisado },
  { value: "finalizado", label: STATUS_LABELS.finalizado },
];

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
