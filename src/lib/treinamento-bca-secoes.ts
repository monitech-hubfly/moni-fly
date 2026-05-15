export const BCA_TREINAMENTO_SECOES = [
  { id: 'introducao', label: 'Introdução' },
  { id: 'ordem', label: 'Ordem de preenchimento' },
  { id: 'aba-resumo', label: 'Aba Resumo' },
  { id: 'cenarios', label: 'Cenários de venda' },
  { id: 'abas-fluxo', label: 'Abas de fluxo' },
  { id: 'validacao', label: 'Validação' },
  { id: 'erros', label: 'Erros comuns' },
  { id: 'checklist', label: 'Checklist final' },
  { id: 'comite', label: 'Comitê' },
] as const;

export type BcaTreinamentoSecao = (typeof BCA_TREINAMENTO_SECOES)[number]['id'];

export function isBcaTreinamentoSecao(s: string): s is BcaTreinamentoSecao {
  return (BCA_TREINAMENTO_SECOES as readonly { id: string }[]).some((x) => x.id === s);
}
