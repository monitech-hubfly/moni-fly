import { KANBAN_IDS } from '@/lib/constants/kanban-ids';

/** Chave especial — Crédito Terreno não possui kanban próprio. */
export const PARALELA_KANBAN_CREDITO_TERRENO = 'credito_terreno' as const;

/** Cor por funil paralelo (tokens Moní — sem hex hardcoded). */
export const PARALELA_CORES: Record<string, string> = {
  [KANBAN_IDS.ACOPLAMENTO]: 'var(--moni-navy-400)',
  [PARALELA_KANBAN_CREDITO_TERRENO]: 'var(--moni-kanban-credito-accent)',
  [KANBAN_IDS.CONTABILIDADE]: 'var(--moni-kanban-contab)',
  [KANBAN_IDS.CREDITO_OBRA]: 'var(--moni-navy-600)',
  [KANBAN_IDS.JURIDICO]: 'var(--moni-gold-600)',
  [KANBAN_IDS.MONI_CAPITAL]: 'var(--moni-green-600)',
  [KANBAN_IDS.PROJETO_LEGAL]: 'var(--moni-gold-800)',
  [KANBAN_IDS.PROJETOS_LOCAIS]: 'var(--moni-earth-600)',
  [KANBAN_IDS.PROJETOS_LEGAIS]: 'var(--moni-earth-400)',
  [KANBAN_IDS.HDM_MODELO_VIRTUAL]: 'var(--moni-green-400)',
  [KANBAN_IDS.HDM_HOMOLOGACOES]: 'var(--moni-green-800)',
  [KANBAN_IDS.HDM_PRODUTO]: 'var(--moni-kanban-t2)',
  [KANBAN_IDS.PORTFOLIO]: 'var(--moni-kanban-portfolio)',
  [KANBAN_IDS.OPERACOES]: 'var(--moni-kanban-stepone)',
};

/** Nome exibido no tooltip (funil completo). */
export const PARALELA_FUNIL_NOMES: Record<string, string> = {
  [KANBAN_IDS.ACOPLAMENTO]: 'Acoplamento',
  [PARALELA_KANBAN_CREDITO_TERRENO]: 'Crédito Terreno',
  [KANBAN_IDS.CONTABILIDADE]: 'Contabilidade',
  [KANBAN_IDS.CREDITO_OBRA]: 'Cash Me',
  [KANBAN_IDS.JURIDICO]: 'Jurídico',
  [KANBAN_IDS.MONI_CAPITAL]: 'Divify',
  [KANBAN_IDS.PROJETO_LEGAL]: 'Projeto Legal',
  [KANBAN_IDS.PROJETOS_LOCAIS]: 'Projetos Locais',
  [KANBAN_IDS.PROJETOS_LEGAIS]: 'Projetos Legais',
  [KANBAN_IDS.HDM_MODELO_VIRTUAL]: 'Modelo Virtual',
  [KANBAN_IDS.HDM_HOMOLOGACOES]: 'Homologações',
  [KANBAN_IDS.HDM_PRODUTO]: 'Produto HDM',
  [KANBAN_IDS.PORTFOLIO]: 'Funil Portfólio',
  [KANBAN_IDS.OPERACOES]: 'Funil Pré Obra e Obra',
};

export function corParalelaKanban(kanbanId: string | null | undefined): string {
  const id = String(kanbanId ?? '').trim();
  return PARALELA_CORES[id] ?? 'var(--moni-kanban-col-accent)';
}

export function nomeFunilParalela(kanbanId: string | null | undefined, fallback?: string): string {
  const id = String(kanbanId ?? '').trim();
  if (id && PARALELA_FUNIL_NOMES[id]) return PARALELA_FUNIL_NOMES[id];
  return String(fallback ?? '').trim() || 'Funil';
}
