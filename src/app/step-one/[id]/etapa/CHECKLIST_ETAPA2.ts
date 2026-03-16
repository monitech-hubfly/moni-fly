/**
 * Labels das 16 perguntas do checklist da Etapa 2 (Condomínios).
 * Chaves: q1 a q16 (checklist_json no banco).
 */
export const CHECKLIST_ETAPA2_LABELS: Record<string, string> = {
  q1: "Quantos lotes o condomínio tem?",
  q2: "Quantos estão disponíveis para venda?",
  q3: "Tamanho médio dos lotes?",
  q4: "Preço médio do m² de venda dos lotes?",
  q5: "Área onde os lotes são mais valorizados e têm maior demanda?",
  q6: "Quantas casas estão prontas?",
  q7: "Quantas estão em construção? Dessas, quantas para venda e quantas para cliente final?",
  q8: "Quantas casas estão para venda?",
  q9: "Preço do m² de venda das casas?",
  q10: "Tempo médio para venda após pronta?",
  q11: "Quantas casas vendidas nos últimos 12 meses?",
  q12: "O que fez as casas remanescentes demorarem? Características que impactaram negativamente na liquidez? Erros de projeto?",
  q13: "Das casas vendidas, características mais elogiadas e que levaram à decisão de compra?",
  q14: "Características que os clientes buscam e não encontraram (ex.: depósito na garagem, despensa, suíte térrea, automação)?",
  q15: "Valor das casas para locação (exemplos).",
  q16: "Quantas casas vendem em 6 meses e em 1 ano?",
};

export const CHECKLIST_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11", "q12", "q13", "q14", "q15", "q16"] as const;
