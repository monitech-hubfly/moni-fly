/** Nome exato em `kanbans.nome` (migrations 114+) → rota do app e query do card. */
const KANBAN_NOME_DB_PARA_APP: Record<string, { basePath: string; cardQueryParam: string }> = {
  'Funil Step One': { basePath: '/funil-stepone', cardQueryParam: 'card' },
  'Funil Loteadores': { basePath: '/loteadores', cardQueryParam: 'card' },
  'Funil Portfólio': { basePath: '/portfolio', cardQueryParam: 'card' },
  'Funil Operações': { basePath: '/operacoes', cardQueryParam: 'card' },
  'Funil Acoplamento': { basePath: '/funil-acoplamento', cardQueryParam: 'card' },
  'Funil Jurídico': { basePath: '/funil-juridico', cardQueryParam: 'card' },
  'Funil Divify': { basePath: '/funil-moni-capital', cardQueryParam: 'card' },
  /** @deprecated legado */
  'Funil Moní Capital': { basePath: '/funil-moni-capital', cardQueryParam: 'card' },
  'Funding': { basePath: '/funil-funding', cardQueryParam: 'card' },
  'Funil Contratações': { basePath: '/funil-contratacoes', cardQueryParam: 'card' },
  'Funil Produto': { basePath: '/funil-produto', cardQueryParam: 'card' },
  'Funil Modelo Virtual': { basePath: '/funil-modelo-virtual', cardQueryParam: 'card' },
  'Funil Homologações': { basePath: '/funil-homologacoes', cardQueryParam: 'card' },
  'Funil Projeto Legal': { basePath: '/funil-projeto-legal', cardQueryParam: 'card' },
  'Funil Projetos Locais': { basePath: '/projetos-locais', cardQueryParam: 'card' },
  'Funil Projetos Legais': { basePath: '/projetos-legais', cardQueryParam: 'card' },
  'Funil Contabilidade': { basePath: '/painel-contabilidade', cardQueryParam: 'kanbanCard' },
  'Funil Cash Me': { basePath: '/funil-credito-obra', cardQueryParam: 'kanbanCard' },
  /** @deprecated legado */
  'Funil Crédito Obra': { basePath: '/funil-credito-obra', cardQueryParam: 'kanbanCard' },
  /** Nome legado (migration 114) — mesmo funil que Crédito Obra. */
  'Funil Crédito': { basePath: '/funil-credito-obra', cardQueryParam: 'kanbanCard' },
  /** Alias de exibição usado na UI — DB permanece `Funil Operações`. */
  'Funil Pré Obra e Obra': { basePath: '/operacoes', cardQueryParam: 'card' },
  'Funil Motor 01': { basePath: '/funil-motor01', cardQueryParam: 'card' },
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
