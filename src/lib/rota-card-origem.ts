/**
 * Abre o card no funil correto (legados com `origem=legado` na URL).
 * Chamados Sirene / externos sem `card_id` usam rotas de fallback.
 */
export function rotaCardOrigem(kanbanNome: string, cardId: string | null | undefined): string {
  const nome = (kanbanNome ?? '').trim();
  const c = cardId != null && String(cardId).trim() !== '' ? String(cardId).trim() : '';
  if (!c) {
    if (nome === 'Sirene') return '/sirene/chamados';
    if (nome === 'Externo') return '/sirene/chamados';
    return '/funil-stepone';
  }
  const q = encodeURIComponent(c);
  switch (nome) {
    case 'Funil Step One':
      return `/funil-stepone?card=${q}`;
    case 'Funil Moní INC':
      return `/funil-moni-inc?card=${q}`;
    case 'Funil Portfólio':
      return `/portfolio?card=${q}&origem=legado`;
    case 'Funil Acoplamento':
      return `/funil-acoplamento?card=${q}`;
    case 'Funil Operações':
      return `/operacoes?card=${q}&origem=legado`;
    case 'Funil Contabilidade':
      return `/painel-contabilidade?card=${q}&origem=legado`;
    case 'Funil Crédito':
      return `/painel-credito?card=${q}&origem=legado`;
    case 'Sirene':
      return '/sirene/chamados';
    case 'Externo':
      return '/sirene/chamados';
    default:
      return `/funil-stepone?card=${q}`;
  }
}
