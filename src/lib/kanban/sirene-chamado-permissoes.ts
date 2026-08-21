/** Chamado editável na UI da Sirene (sem vínculo com card de funil). */
export function chamadoEditavelNaSirene(row: {
  origem: string;
  card_id: string | null | undefined;
}): boolean {
  return row.origem === 'sirene' && (row.card_id == null || row.card_id === '');
}

/** Chamado originado em card de funil — somente leitura na Sirene. */
export function chamadoSomenteLeituraNaSirene(row: {
  origem: string;
  card_id: string | null | undefined;
}): boolean {
  return !chamadoEditavelNaSirene(row);
}

/**
 * Verifica se o usuário pode adicionar atividades ao chamado.
 * Admin, team, supervisor, bombeiro/caneta_verde, criador do chamado ou
 * participante de atividade existente podem adicionar.
 */
export function usuarioPodeAdicionarAtividadeChamado(params: {
  sessionEhAdmin: boolean;
  sessionRole: string | null;
  currentUserId: string | null;
  chamadoAbertoPor: string | null;
  responsaveisIds: string[];
}): boolean {
  if (!params.currentUserId) return false;
  if (params.sessionEhAdmin) return true;
  const role = String(params.sessionRole ?? '').toLowerCase();
  if (role === 'team' || role === 'supervisor') return true;
  if (role === 'bombeiro' || role === 'caneta_verde') return true;
  if (params.chamadoAbertoPor && params.chamadoAbertoPor === params.currentUserId) return true;
  if (params.responsaveisIds.includes(params.currentUserId)) return true;
  return false;
}
