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
    case 'Funil Loteadores':
      return `/loteadores?card=${q}`;
    case 'Funil Portfólio':
      return `/portfolio?card=${q}&origem=legado`;
    case 'Funil Acoplamento':
      return `/funil-acoplamento?card=${q}`;
    case 'Funil Jurídico':
      return `/funil-juridico?card=${q}`;
    case 'Funil Moní Capital':
      return `/funil-moni-capital?card=${q}`;
    case 'Funding':
      return `/funil-funding?card=${q}`;
    case 'Funil Contratações':
      return `/funil-contratacoes?card=${q}`;
    case 'Funil Produto':
      return `/funil-produto?card=${q}`;
    case 'Funil Modelo Virtual':
      return `/funil-modelo-virtual?card=${q}`;
    case 'Funil Homologações':
      return `/funil-homologacoes?card=${q}`;
    case 'Funil Projeto Legal':
      return `/funil-projeto-legal?card=${q}`;
    case 'Funil Projetos Locais':
      return `/projetos-locais?card=${q}`;
    case 'Funil Projetos Legais':
      return `/projetos-legais?card=${q}`;
    case 'Funil Operações':
      return `/operacoes?card=${q}&origem=legado`;
    case 'Funil Contabilidade':
      return `/painel-contabilidade?card=${q}&origem=legado`;
    case 'Funil Crédito Obra':
      return `/funil-credito-obra?card=${q}&origem=legado`;
    case 'Sirene':
      return '/sirene/chamados';
    case 'Externo':
      return '/sirene/chamados';
    default:
      return `/funil-stepone?card=${q}`;
  }
}
