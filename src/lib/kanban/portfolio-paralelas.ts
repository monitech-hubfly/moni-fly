import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';

export const PORTFOLIO_KANBAN_NOME = 'Funil Portfólio' as const;

export type PortfolioParalelaFlag =
  | 'acoplamento_concluido'
  | 'credito_terreno_ok'
  | 'contabilidade_ok';

export const PORTFOLIO_PARALELAS: {
  flag: PortfolioParalelaFlag;
  label: string;
  labelCurto: string;
}[] = [
  { flag: 'acoplamento_concluido', label: 'Acoplamento', labelCurto: 'Acoplamento' },
  { flag: 'credito_terreno_ok', label: 'Crédito', labelCurto: 'Crédito' },
  { flag: 'contabilidade_ok', label: 'Contabilidade', labelCurto: 'Contab.' },
];

export type PortfolioParalelasFlags = Partial<Record<PortfolioParalelaFlag, boolean | null | undefined>>;

export function isPortfolioKanbanRef(kanbanId: string | null | undefined, kanbanNome?: string | null): boolean {
  if (String(kanbanNome ?? '').trim() === PORTFOLIO_KANBAN_NOME) return true;
  return String(kanbanId ?? '').trim() === KANBAN_IDS.PORTFOLIO;
}

export function listarEsteirasParalelasPendentes(flags: PortfolioParalelasFlags): string[] {
  return PORTFOLIO_PARALELAS.filter((p) => !Boolean(flags[p.flag])).map((p) => p.label);
}

export function mensagemGatePortfolioStep5(pendentes: string[]): string {
  if (pendentes.length === 0) {
    return 'Não é possível avançar para o Comitê: esteiras paralelas ainda pendentes.';
  }
  return `Não é possível avançar para o Comitê (Step 5). Esteiras pendentes: ${pendentes.join(', ')}.`;
}

export function gatePortfolioStep5Liberado(flags: PortfolioParalelasFlags): boolean {
  return listarEsteirasParalelasPendentes(flags).length === 0;
}

export function deveValidarGatePortfolioStep5(
  novaFaseSlug: string | null | undefined,
  kanbanId: string | null | undefined,
  kanbanNome?: string | null,
): boolean {
  return (
    String(novaFaseSlug ?? '').trim() === FASE_SLUGS.STEP_5 && isPortfolioKanbanRef(kanbanId, kanbanNome)
  );
}
