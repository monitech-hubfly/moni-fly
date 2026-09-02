const AVATAR_COLORS = [
  { bg: '#E1F5EE', color: '#0F6E56' },
  { bg: '#E6F1FB', color: '#185FA5' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#EEEDFE', color: '#534AB7' },
] as const;

export const SEM_RESPONSAVEL_LABEL = 'Sem responsável';

export function responsavelDisplayNome(card: {
  responsavel_pessoa_nome?: string | null;
  responsavel_nome?: string | null;
}): string | null {
  const fromId = card.responsavel_pessoa_nome?.trim();
  if (fromId) return fromId;
  const fallback = card.responsavel_nome?.trim();
  return fallback || null;
}

export function responsavelIniciais(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function responsavelAvatarStyle(nome: string): { background: string; color: string } {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = (hash + nome.charCodeAt(i) * (i + 1)) % 9973;
  }
  const palette = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return { background: palette.bg, color: palette.color };
}

export function responsavelAvatarStyleGantt(nome: string): { background: string; color: string } {
  return { background: '#3d1a1a', color: '#ffb3b3' };
}

export function responsavelEhDoUsuario(
  card: { responsavel_pessoa_nome?: string | null; responsavel_nome?: string | null },
  loggedUserName: string | null | undefined,
): boolean {
  const nome = responsavelDisplayNome(card);
  const me = loggedUserName?.trim();
  if (!nome || !me) return false;
  return nome.localeCompare(me, 'pt-BR', { sensitivity: 'accent' }) === 0;
}

export function responsavelNomeEhDoUsuario(
  nome: string | null | undefined,
  loggedUserName: string | null | undefined,
): boolean {
  const n = nome?.trim();
  const me = loggedUserName?.trim();
  if (!n || !me || n === SEM_RESPONSAVEL_LABEL) return false;
  return n.localeCompare(me, 'pt-BR', { sensitivity: 'accent' }) === 0;
}

export function sortResponsavelLabels(labels: string[], loggedUserName: string): string[] {
  const me = loggedUserName.trim().toLocaleLowerCase('pt-BR');
  return [...labels].sort((a, b) => {
    const aSem = a === SEM_RESPONSAVEL_LABEL;
    const bSem = b === SEM_RESPONSAVEL_LABEL;
    const aMe = !aSem && a.toLocaleLowerCase('pt-BR') === me;
    const bMe = !bSem && b.toLocaleLowerCase('pt-BR') === me;
    if (aMe && !bMe) return -1;
    if (!aMe && bMe) return 1;
    if (aSem && !bSem) return 1;
    if (!aSem && bSem) return -1;
    return a.localeCompare(b, 'pt-BR');
  });
}

export function parseSemanaNumero(semanaLabel: string): number {
  const m = String(semanaLabel).match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}
