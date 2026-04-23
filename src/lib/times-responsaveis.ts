/**
 * Lista centralizada de times Moní e responsáveis por time (Sirene, Kanban, etc.).
 */

export const TIMES_MONI = [
  'Caneta Verde',
  'Waysers',
  'Modelo Virtual',
  'Executivo Local',
  'Acoplamento',
  'Moní Inc',
  'Homologações',
  'Produto',
  'Marketing',
  'Administrativo',
  'Controladoria',
  'Jurídico',
  'Crédito',
  'Novos Franqueados',
] as const;

export const RESPONSAVEIS_POR_TIME: Record<string, string[]> = {
  'Caneta Verde': ['Neil Hirano', 'Murillo Morale', 'Ingrid Hora', 'Fernanda Lobão', 'Danilo Nyitray'],
  Waysers: ['Nathalia Ferezin', 'Rafael Matta'],
  'Modelo Virtual': ['Bruna Scarpeli', 'Alef Lopes'],
  'Executivo Local': ['Larissa Lima'],
  Acoplamento: ['Elisabete Nucci'],
  'Moní Inc': ['Helenna Luz', 'Daniel Viotto'],
  Homologações: ['Karoline Galdino', 'Helena Oliveira', 'Jéssica Silva', 'Letícia Duarte'],
  Produto: ['Vinícius França', 'Mateus Palma', 'Fábio Siano'],
  Marketing: ['Rafael Abreu'],
  Administrativo: ['Isabella Seabra'],
  Controladoria: ['Felipe Batista'],
  Jurídico: ['Isabela Correa'],
  Crédito: ['Thais Kim'],
  'Novos Franqueados': ['Paula Cruz'],
};

export const TODOS_RESPONSAVEIS = Object.values(RESPONSAVEIS_POR_TIME).flat();

const TIMES_SET = new Set<string>(TIMES_MONI);

export function isTimeMoni(t: string): boolean {
  return TIMES_SET.has(t);
}

export function responsaveisDoTimeMoni(time: string): string[] {
  const list = RESPONSAVEIS_POR_TIME[time];
  return Array.isArray(list) ? [...list] : [];
}

/** Responsável opcional; se informado, exige time válido e nome na lista do time. */
export function validarParTimeResponsavelMoni(
  time: string | null,
  responsavel: string | null,
): { ok: true } | { ok: false; error: string } {
  const r = (responsavel ?? '').trim();
  const t = (time ?? '').trim();
  if (!r) return { ok: true };
  if (!t) return { ok: false, error: 'Selecione o time antes do responsável.' };
  if (!isTimeMoni(t)) return { ok: false, error: 'Time inválido.' };
  const lista = RESPONSAVEIS_POR_TIME[t];
  if (!lista?.includes(r)) return { ok: false, error: 'Responsável inválido para o time selecionado.' };
  return { ok: true };
}

export function validarTimeMoniOpcional(time: string | null): { ok: true } | { ok: false; error: string } {
  const t = (time ?? '').trim();
  if (!t) return { ok: true };
  if (!isTimeMoni(t)) return { ok: false, error: 'Time inválido.' };
  return { ok: true };
}

export type KanbanTimeNomeRow = { id: string; nome: string };
export type PerfilNomeRow = { id: string; nome: string };

/**
 * Converte seleção do catálogo Moní em campos persistidos em `kanban_atividades`.
 * Faz match de time/responsável por nome com `kanban_times` e `profiles` carregados no modal.
 */
export function resolveKanbanInteracaoFromCatalog(
  timeMoni: string,
  responsavelMoni: string,
  kanbanTimes: KanbanTimeNomeRow[],
  profileOpts: PerfilNomeRow[],
): {
  times_ids: string[];
  responsaveis_ids: string[];
  responsavel_nome_texto: string | null;
  time_legado: string | null;
} {
  const tNome = timeMoni.trim();
  const rNome = responsavelMoni.trim();
  const kt = tNome ? kanbanTimes.find((x) => x.nome.trim() === tNome) : undefined;
  const times_ids = kt ? [kt.id] : [];
  const prof = rNome ? profileOpts.find((x) => x.nome.trim() === rNome) : undefined;
  const responsaveis_ids = prof ? [prof.id] : [];
  const responsavel_nome_texto = rNome && !prof ? rNome : null;
  const time_legado = tNome && times_ids.length === 0 ? tNome : null;
  return { times_ids, responsaveis_ids, responsavel_nome_texto, time_legado };
}

/** Preenche o select de time ao editar uma interação já salva. */
export function inferTimeMoniFromInteracao(
  times_resolvidos: { id: string; nome: string }[] | undefined,
  timeLegado: string | null | undefined,
): string {
  const fromResolved = times_resolvidos?.[0]?.nome?.trim();
  if (fromResolved && isTimeMoni(fromResolved)) return fromResolved;
  const leg = (timeLegado ?? '').trim();
  if (leg && isTimeMoni(leg)) return leg;
  return '';
}

/** Preenche o select de responsável ao editar, respeitando o catálogo do time. */
export function inferResponsavelMoniFromInteracao(
  timeMoni: string,
  responsaveis_resolvidos: { id: string; nome: string }[] | undefined,
  responsavel_nome_texto: string | null | undefined,
  responsavel_id: string | null | undefined,
  responsaveis_ids: string[] | null | undefined,
  profileOpts: PerfilNomeRow[],
): string {
  const allowed = timeMoni ? new Set(responsaveisDoTimeMoni(timeMoni)) : null;
  const rids = [...(responsaveis_ids ?? [])];
  if (responsavel_id && !rids.includes(responsavel_id)) rids.unshift(responsavel_id);
  for (const id of rids) {
    const nome = profileOpts.find((p) => p.id === id)?.nome?.trim() ?? '';
    if (nome && (!allowed || allowed.has(nome))) return nome;
  }
  const fromResolved = responsaveis_resolvidos?.[0]?.nome?.trim() ?? '';
  if (fromResolved && (!allowed || allowed.has(fromResolved))) return fromResolved;
  const txt = (responsavel_nome_texto ?? '').trim();
  if (txt && (!allowed || allowed.has(txt))) return txt;
  return '';
}
