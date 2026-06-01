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
