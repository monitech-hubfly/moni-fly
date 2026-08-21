/** Seções do manual BCA sempre visíveis (produção, preview e link público). */
export const BCA_TREINAMENTO_SECOES_PROD = [
  { id: 'introducao', label: 'Introdução' },
  { id: 'ordem', label: 'Ordem de preenchimento' },
  { id: 'validacao', label: 'Validação' },
  { id: 'erros', label: 'Erros comuns' },
  { id: 'comite', label: 'Comitê' },
] as const;

const SECAO_CHECKLIST = { id: 'checklist', label: 'Checklist final' } as const;

/** Inclui checklist — somente em desenvolvimento (`next dev`, `NODE_ENV !== 'production'`). */
export const BCA_TREINAMENTO_SECOES_TODAS = [...BCA_TREINAMENTO_SECOES_PROD, SECAO_CHECKLIST] as const;

export type BcaTreinamentoSecao = (typeof BCA_TREINAMENTO_SECOES_TODAS)[number]['id'];

/** Aba «Checklist final» do treinamento BCA: não entra em `next build` / deploy (NODE_ENV=production). */
export function bcaTreinamentoChecklistSomenteEmDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/** Slugs usados na navegação do Hub e em `generateStaticParams` (sem checklist fora de dev). */
export function getBcaTreinamentoSecoesParaHub(): readonly { readonly id: string; readonly label: string }[] {
  return bcaTreinamentoChecklistSomenteEmDev() ? BCA_TREINAMENTO_SECOES_TODAS : BCA_TREINAMENTO_SECOES_PROD;
}

/** Qualquer slug conhecido do manual (inclui `checklist` para URLs legadas). */
export function isBcaTreinamentoSecao(s: string): s is BcaTreinamentoSecao {
  return (BCA_TREINAMENTO_SECOES_TODAS as readonly { id: string }[]).some((x) => x.id === s);
}

/** Rota `/treinamento-bca/...` ou leitura pública deve servir esta seção neste ambiente. */
export function isBcaTreinamentoSecaoHubAtiva(s: string): s is BcaTreinamentoSecao {
  if (!isBcaTreinamentoSecao(s)) return false;
  if (s === 'checklist') return bcaTreinamentoChecklistSomenteEmDev();
  return true;
}

/** No iframe, o manual só mostra a aba checklist quando `checklistTab=1` na query (só emitido em dev). */
export function bcaTreinamentoEmbedDeveExibirChecklist(): boolean {
  return bcaTreinamentoChecklistSomenteEmDev();
}
