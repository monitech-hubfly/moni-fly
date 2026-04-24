/** Nome exato em `kanbans.nome` (migrations 114+) → rota do app e query do card. */
const KANBAN_NOME_DB_PARA_APP: Record<string, { basePath: string; cardQueryParam: string }> = {
  'Funil Step One': { basePath: '/funil-stepone', cardQueryParam: 'card' },
  'Funil Moní INC': { basePath: '/funil-moni-inc', cardQueryParam: 'card' },
  'Funil Portfólio': { basePath: '/portfolio', cardQueryParam: 'card' },
  'Funil Operações': { basePath: '/operacoes', cardQueryParam: 'card' },
  'Funil Acoplamento': { basePath: '/funil-acoplamento', cardQueryParam: 'card' },
  'Funil Contabilidade': { basePath: '/painel-contabilidade', cardQueryParam: 'kanbanCard' },
  'Funil Crédito': { basePath: '/painel-credito', cardQueryParam: 'kanbanCard' },
};

/** Bases de rota de todos os funis conhecidos (invalidação de cache após mutação). */
export const KANBAN_APP_BASE_PATHS: string[] = [
  ...new Set(
    (Object.values(KANBAN_NOME_DB_PARA_APP) as { basePath: string }[]).map(
      (v) => v.basePath,
    ),
  ),
];

/** URL absoluta de path para abrir o card no funil correspondente. */
export function hrefAbrirCardKanban(kanbanNomeDb: string, cardId: string): string {
  const cfg = KANBAN_NOME_DB_PARA_APP[kanbanNomeDb.trim()];
  const id = String(cardId ?? '').trim();
  if (!cfg) {
    return id ? `/funil-stepone?card=${encodeURIComponent(id)}` : '/funil-stepone';
  }
  const p = new URLSearchParams();
  if (id) p.set(cfg.cardQueryParam, id);
  const qs = p.toString();
  return qs ? `${cfg.basePath}?${qs}` : cfg.basePath;
}
