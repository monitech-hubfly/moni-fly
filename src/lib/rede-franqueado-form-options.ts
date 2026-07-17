/** Opções de formulário da Rede de Franqueados (alinhadas à planilha e ao Novo Step 1). */

export const REDE_OPCOES_STATUS_FRANQUIA = [
  { value: 'Em Operação', label: 'Em Operação' },
  { value: 'Em Transferência', label: 'Em Transferência' },
  { value: 'Operação Encerrada', label: 'Operação Encerrada' },
] as const;

/** Status legado removido do formulário — usado na migração automática. */
export function isRedeStatusEmProcesso(status: string | null | undefined): boolean {
  if (!status?.trim()) return false;
  const n = status.trim().toLowerCase().replace(/\s+/g, ' ');
  return n === 'em processo' || n === 'em processo.';
}

export const REDE_OPCOES_CLASSIFICACAO_FRANQUEADO = [
  { value: 'Beta', label: 'Beta' },
  { value: 'Pagante', label: 'Pagante' },
] as const;

export const REDE_OPCOES_MODALIDADE = [
  { value: 'Franquia', label: 'Franquia' },
  { value: 'Corporação', label: 'Corporação' },
] as const;

export const REDE_OPCOES_REGIONAL = [
  { value: 'C-oeste', label: 'C-oeste' },
  { value: 'Nordeste', label: 'Nordeste' },
  { value: 'Norte', label: 'Norte' },
  { value: 'Sudeste', label: 'Sudeste' },
  { value: 'Sul', label: 'Sul' },
] as const;
