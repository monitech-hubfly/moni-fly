export const OPCOES_QUEM_SOU = [
  'Candidato',
  'Terrenista',
  'Franqueado',
  'Fornecedor',
  'Investidor',
  'Outro',
] as const;

export type QuemSou = (typeof OPCOES_QUEM_SOU)[number];

export function quemSouValido(valor: string): valor is QuemSou {
  return (OPCOES_QUEM_SOU as readonly string[]).includes(valor);
}

export function textoQuemSou(perfil: string | null | undefined, outro: string | null | undefined): string {
  const papel = String(perfil ?? '').trim();
  if (!papel) return '';
  const detalhe = String(outro ?? '').trim();
  if (papel === 'Outro' && detalhe) return `Outro: ${detalhe}`;
  return papel;
}
