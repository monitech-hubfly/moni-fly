import type { RedeFranqueadoModalRow } from '@/lib/kanban/kanban-card-modal-detalhes';

/** Itens do checklist Dados do Candidato preenchidos a partir da Rede de Franqueados. */
export const CHECKLIST_LABELS_DADOS_CANDIDATO_REDE = [
  'Nome',
  'E-mail',
  'Telefone',
  'Idade',
] as const;

/** Ordens dos itens opcionais em Dados do Candidato (Profissão + textos longos). */
export const DADOS_CANDIDATO_ORDENS_OPCIONAIS = [5, 6, 7, 8] as const;

function normalizarLabelChecklist(label: string): string {
  return String(label ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Profissão e textos longos do candidato não bloqueiam avanço de fase. */
export function isDadosCandidatoItemOpcional(item: { label?: string | null; ordem?: number | null }): boolean {
  const ordem = Number(item.ordem ?? 0);
  if ((DADOS_CANDIDATO_ORDENS_OPCIONAIS as readonly number[]).includes(ordem)) return true;

  const l = normalizarLabelChecklist(String(item.label ?? ''));
  if (l === 'profissao') return true;
  if (l.includes('experiencias profissionais')) return true;
  if (l.includes('trajetoria e aprendizados')) return true;
  if (l.includes('bom franqueado mon')) return true;
  return false;
}

export function obrigatorioEfetivoDadosCandidato(item: {
  label?: string | null;
  ordem?: number | null;
  obrigatorio?: boolean | null;
}): boolean {
  if (isDadosCandidatoItemOpcional(item)) return false;
  return Boolean(item.obrigatorio);
}

export type RedeDadosCandidatoSource = Pick<
  RedeFranqueadoModalRow,
  'nome_completo' | 'email_frank' | 'telefone_frank' | 'data_nasc_frank'
>;

export function idadeFromDataNascimento(dataNasc: string | null | undefined): string {
  const raw = String(dataNasc ?? '').trim();
  if (!raw) return '';
  const iso = raw.length === 10 ? `${raw}T12:00:00` : raw;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hoje = new Date();
  let idade = hoje.getFullYear() - d.getFullYear();
  const mes = hoje.getMonth() - d.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < d.getDate())) idade -= 1;
  return idade >= 0 && idade <= 120 ? String(idade) : '';
}

export function valorDadosCandidatoFromRede(
  label: string,
  rede: RedeDadosCandidatoSource | null | undefined,
): string {
  if (!rede) return '';
  const l = label.trim();
  if (l === 'Nome') return String(rede.nome_completo ?? '').trim();
  if (l === 'E-mail') return String(rede.email_frank ?? '').trim();
  if (l === 'Telefone') return String(rede.telefone_frank ?? '').trim();
  if (l === 'Idade') return idadeFromDataNascimento(rede.data_nasc_frank);
  return '';
}

export function isLabelDadosCandidatoRede(label: string): boolean {
  return (CHECKLIST_LABELS_DADOS_CANDIDATO_REDE as readonly string[]).includes(label.trim());
}
