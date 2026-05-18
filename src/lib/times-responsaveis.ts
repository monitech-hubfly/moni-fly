/**
 * Lista centralizada de times Moní e responsáveis por time (Sirene, Kanban, etc.).
 */

import type { HdmTime } from '@/types/sirene';

/** Catálogo completo de times Moní (ordem alfabética pt-BR) para selects e filtros. */
export const TIMES_MONI = [
  'Acoplamento',
  'Administrativo',
  'Bombeiro',
  'Caneta Verde',
  'Controladoria',
  'Crédito',
  'Executivo Local',
  'Homologações',
  'Jurídico',
  'Marketing',
  'Modelo Virtual',
  'Moní Inc',
  'Novos Franqueados',
  'Portfólio',
  'Produto',
  'Waysers',
] as const;

/** Nomes exatos dos times Moní usados em chamados HDM (subset de `TIMES_MONI`). */
export const TIMES_MONI_HDM = ['Homologações', 'Modelo Virtual', 'Produto', 'Executivo Local'] as const;

/**
 * Ordem de prioridade ao inferir `hdm_responsavel` quando vários times HDM estão selecionados.
 * (Deve listar exatamente os mesmos nomes que `TIMES_MONI_HDM`.)
 */
export const ORDEM_INFERENCIA_HDM_RESPONSAVEL: readonly HdmTime[] = [
  'Homologações',
  'Modelo Virtual',
  'Produto',
  'Executivo Local',
];

/**
 * Se qualquer um destes times estiver entre os destinatários do chamado, o chamado é tratado como HDM.
 */
export function inferirHdmResponsavelPorNomesTimes(nomesSelecionados: readonly string[]): HdmTime | null {
  const set = new Set(nomesSelecionados.map((n) => String(n ?? '').trim()).filter(Boolean));
  for (const t of ORDEM_INFERENCIA_HDM_RESPONSAVEL) {
    if (set.has(t)) return t;
  }
  return null;
}

/** @deprecated Mantido só por compatibilidade com comentários legados; a UI não usa mais “modo HDM” separado. */
export const TIMES_MONI_APENAS_MODO_HDM = ['Homologações', 'Modelo Virtual'] as const;

const TIMES_MONI_APENAS_MODO_HDM_SET = new Set<string>(TIMES_MONI_APENAS_MODO_HDM);

/** Catálogo HDM: nome exibido + email em `profiles` (lookup por UUID via email). */
export const HDM_RESPONSAVEIS: Record<HdmTime, { nome: string; email: string }[]> = {
  Homologações: [
    { nome: 'Karoline Galdino', email: 'karoline.galdino@moni.casa' },
    { nome: 'Helena Oliveira', email: 'helena.oliveira@moni.casa' },
    { nome: 'Jéssica Silva', email: 'jessica.silva@moni.casa' },
    { nome: 'Letícia Duarte', email: 'leticia.duarte@moni.casa' },
  ],
  'Modelo Virtual': [
    { nome: 'Bruna Scarpeli', email: 'bruna.scarpeli@moni.casa' },
    { nome: 'Alef Lopes', email: 'alef.lopes@moni.casa' },
  ],
  Produto: [
    { nome: 'Vinícius França de Araújo', email: 'vinicius.fr@moni.casa' },
    { nome: 'Mateus Palma', email: 'mateus.palma@moni.casa' },
    { nome: 'Fabio Siano', email: 'fabio.siano@moni.casa' },
  ],
  'Executivo Local': [{ nome: 'Larissa Lima', email: 'larissa.lima@moni.casa' }],
};

const HDM_RESPONSAVEIS_EMAIL_SET = new Set(
  (Object.values(HDM_RESPONSAVEIS).flat() as { email: string }[]).map((x) =>
    String(x.email ?? '')
      .trim()
      .toLowerCase(),
  ),
);

/** Emails únicos do catálogo HDM (para `profiles.select(...).in('email', …)`). */
export const HDM_RESPONSAVEIS_TODOS_EMAILS: readonly string[] = [...HDM_RESPONSAVEIS_EMAIL_SET];

function normMoniNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

/** Apelidos / nomes parciais legados → email esperado em `profiles`. */
const APELIDO_MONI_PARA_EMAIL: Record<string, string> = {
  karoline: 'karoline.galdino@moni.casa',
  bruna: 'bruna.scarpeli@moni.casa',
  'rafael matta': 'rafael.matta@moni.casa',
  rafael: 'rafael.matta@moni.casa',
  nathalia: 'nathalia.ferezin@moni.casa',
  vini: 'vinicius.fr@moni.casa',
  vinicius: 'vinicius.fr@moni.casa',
  ingrid: 'ingrid.hora@moni.casa',
  danilo: 'danilo.n@moni.casa',
  fernanda: 'fernanda.lobao@moni.casa',
  alef: 'alef.lopes@moni.casa',
  elisabete: 'elisabete.nucci@moni.casa',
};

/** Resolve email em `profiles` a partir do nome completo do catálogo HDM, apelido ou texto legado. */
export function resolverEmailMoniPorNomeOuApelido(texto: string): string | null {
  const raw = (texto ?? '').trim();
  if (!raw) return null;
  const n = normMoniNome(raw);
  if (!n) return null;
  for (const t of TIMES_MONI_HDM) {
    for (const { nome, email } of HDM_RESPONSAVEIS[t]) {
      if (normMoniNome(nome) === n) return email.trim().toLowerCase();
    }
  }
  if (APELIDO_MONI_PARA_EMAIL[n]) return APELIDO_MONI_PARA_EMAIL[n];
  const first = n.split(/\s+/)[0] ?? '';
  if (first && APELIDO_MONI_PARA_EMAIL[first]) return APELIDO_MONI_PARA_EMAIL[first];
  return null;
}

/** Nome canônico do catálogo HDM para um email (ex.: após lookup em `profiles`). */
export function nomeHdmCanonicoPorEmail(email: string): string | null {
  const e = (email ?? '').trim().toLowerCase();
  if (!e) return null;
  for (const t of TIMES_MONI_HDM) {
    for (const row of HDM_RESPONSAVEIS[t]) {
      if (row.email.trim().toLowerCase() === e) return row.nome;
    }
  }
  return null;
}

/** Quando `somenteHdm`, restringe às opções cujo `email` está no catálogo HDM. */
export function filtrarOpcoesResponsaveisPorModoHdm<T extends { email?: string | null }>(
  opcoes: readonly T[],
  somenteCatalogoHdm: boolean,
): T[] {
  if (!somenteCatalogoHdm) return [...opcoes];
  return opcoes.filter((p) => {
    const em = (p.email ?? '').trim().toLowerCase();
    return em.length > 0 && HDM_RESPONSAVEIS_EMAIL_SET.has(em);
  });
}

const TIMES_MONI_HDM_SET = new Set<string>(TIMES_MONI_HDM);

export function isNomeTimeMoniHdm(nome: string): boolean {
  return TIMES_MONI_HDM_SET.has(String(nome ?? '').trim());
}

/** Select "time que receberá o chamado": com HDM só os quatro; sem HDM lista o catálogo completo Moní. */
export function timesMoniReceberChamadoOpcoes(somenteTimesHdm: boolean): readonly string[] {
  if (somenteTimesHdm) return [...TIMES_MONI_HDM];
  return [...TIMES_MONI];
}

/** Ordena linhas de time pela ordem do catálogo Moní; HDM usa `TIMES_MONI_HDM` (não alfabética). */
export function ordenarLinhasTimeKanbanPorCatalogoMoni<T extends { nome: string }>(
  rows: readonly T[],
  somenteTimesHdm: boolean,
): T[] {
  const catalog = (somenteTimesHdm ? TIMES_MONI_HDM : TIMES_MONI) as readonly string[];
  const base = catalog.length;
  return [...rows].sort((a, b) => {
    const na = a.nome.trim();
    const nb = b.nome.trim();
    const ia = catalog.indexOf(na);
    const ib = catalog.indexOf(nb);
    const ra = ia >= 0 ? ia : base;
    const rb = ib >= 0 ? ib : base;
    if (ra !== rb) return ra - rb;
    return na.localeCompare(nb, 'pt-BR');
  });
}

export function filtrarLinhasTimeKanbanPorHdm<T extends { nome: string }>(
  rows: readonly T[],
  somenteTimesHdm: boolean,
): T[] {
  const filtered = rows.filter((row) => {
    const nome = row.nome.trim();
    if (somenteTimesHdm) return TIMES_MONI_HDM_SET.has(nome);
    return true;
  });
  return ordenarLinhasTimeKanbanPorCatalogoMoni(filtered, somenteTimesHdm);
}

export function filtrarOpcoesTimeIdNomePorHdm(
  opcoes: readonly { id: string; nome: string }[],
  somenteTimesHdm: boolean,
): { id: string; nome: string }[] {
  const filtered = opcoes.filter((t) => {
    const nome = t.nome.trim();
    if (somenteTimesHdm) return TIMES_MONI_HDM_SET.has(nome);
    return true;
  });
  return ordenarLinhasTimeKanbanPorCatalogoMoni(filtered, somenteTimesHdm);
}

export const RESPONSAVEIS_POR_TIME: Record<string, string[]> = {
  'Caneta Verde': ['Neil Hirano', 'Murillo Morale', 'Ingrid Hora', 'Fernanda Lobão', 'Danilo Nyitray'],
  Waysers: ['Nathalia Ferezin', 'Rafael Matta'],
  'Modelo Virtual': HDM_RESPONSAVEIS['Modelo Virtual'].map((x) => x.nome),
  'Executivo Local': ['Larissa Lima'],
  Acoplamento: ['Elisabete Nucci'],
  'Moní Inc': ['Helenna Luz', 'Daniel Viotto'],
  Homologações: HDM_RESPONSAVEIS.Homologações.map((x) => x.nome),
  Produto: HDM_RESPONSAVEIS.Produto.map((x) => x.nome),
  Marketing: ['Rafael Abreu'],
  Administrativo: ['Isabella Seabra'],
  Controladoria: ['Felipe Batista'],
  Jurídico: ['Isabela Correa'],
  Crédito: ['Thais Kim'],
  'Novos Franqueados': ['Paula Cruz'],
  Portfólio: ['Helenna Luz'],
  Bombeiro: ['Bombeiro'],
};

export const TODOS_RESPONSAVEIS = Object.values(RESPONSAVEIS_POR_TIME).flat();

/** Valor de `filtros.time` / `timeF` quando o id não existe em `kanban_times` (filtro por nome Moní). */
export const MONI_TIME_FILTRO_PREFIX = '__monitime__:';

/** Valor de `filtros.responsavel` / `respF` quando não há perfil com o mesmo nome (filtro por nome do catálogo). */
export const MONI_RESP_FILTRO_PREFIX = '__moniresp__:';

/**
 * Lista fixa de times Moní para filtros: usa o UUID de `kanban_times` quando o nome coincide;
 * senão um id sintético (`MONI_TIME_FILTRO_PREFIX` + nome) para filtrar por texto na atividade.
 */
export function timesFiltroOpcoesComCatalogoMoni(
  kanbanTimes: readonly { id: string; nome: string }[],
): { id: string; nome: string }[] {
  const byNome = new Map(kanbanTimes.map((t) => [t.nome.trim(), t]));
  return [...TIMES_MONI].map((nome) => {
    const hit = byNome.get(nome);
    return { id: hit?.id ?? `${MONI_TIME_FILTRO_PREFIX}${nome}`, nome };
  });
}

/** Chips «Time que receberá o chamado» / atividades nos funis: catálogo Moní completo, ordenado. */
export function timesOpcoesReceberChamado(
  kanbanTimes: readonly { id: string; nome: string }[],
): { id: string; nome: string }[] {
  return ordenarLinhasTimeKanbanPorCatalogoMoni(timesFiltroOpcoesComCatalogoMoni(kanbanTimes), false);
}

/**
 * Todos os responsáveis do catálogo + perfis extra (ex.: nomes fora da lista), sem duplicar por nome.
 */
export function responsaveisFiltroOpcoesComCatalogoMoni(
  profiles: readonly { id: string; nome: string; email?: string | null }[],
): { id: string; nome: string }[] {
  const seen = new Set<string>();
  const out: { id: string; nome: string }[] = [];
  for (const nome of TODOS_RESPONSAVEIS) {
    const n = nome.trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const em = resolverEmailMoniPorNomeOuApelido(n);
    const hit =
      profiles.find((p) => p.nome.trim() === n) ??
      (em ? profiles.find((p) => (p.email ?? '').trim().toLowerCase() === em) : undefined);
    out.push(hit ?? { id: `${MONI_RESP_FILTRO_PREFIX}${encodeURIComponent(n)}`, nome: n });
  }
  for (const p of profiles) {
    const n = p.nome.trim();
    if (!n) continue;
    const key = n.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: p.id, nome: p.nome });
  }
  return out.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

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
export type PerfilNomeRow = { id: string; nome: string; email?: string | null };

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
  let prof = rNome ? profileOpts.find((x) => x.nome.trim() === rNome) : undefined;
  if (!prof && rNome) {
    const em = resolverEmailMoniPorNomeOuApelido(rNome);
    if (em) prof = profileOpts.find((x) => (x.email ?? '').trim().toLowerCase() === em);
  }
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
    const row = profileOpts.find((p) => p.id === id);
    const nome = row?.nome?.trim() ?? '';
    if (nome && (!allowed || allowed.has(nome))) return nome;
    const emRow = (row?.email ?? '').trim().toLowerCase();
    if (emRow) {
      const canon = nomeHdmCanonicoPorEmail(emRow);
      if (canon && (!allowed || allowed.has(canon))) return canon;
    }
  }
  const fromResolved = responsaveis_resolvidos?.[0]?.nome?.trim() ?? '';
  if (fromResolved && (!allowed || allowed.has(fromResolved))) return fromResolved;
  const txt = (responsavel_nome_texto ?? '').trim();
  if (txt && (!allowed || allowed.has(txt))) return txt;

  const tryEmail = (label: string) => {
    const em = resolverEmailMoniPorNomeOuApelido(label);
    if (!em) return '';
    const pu = profileOpts.find((p) => (p.email ?? '').trim().toLowerCase() === em);
    const nomeProf = pu?.nome.trim() ?? '';
    if (nomeProf && (!allowed || allowed.has(nomeProf))) return nomeProf;
    const canon = nomeHdmCanonicoPorEmail(em);
    if (canon && (!allowed || allowed.has(canon))) return canon;
    return '';
  };
  if (fromResolved) {
    const v = tryEmail(fromResolved);
    if (v) return v;
  }
  if (txt) {
    const v = tryEmail(txt);
    if (v) return v;
  }
  return '';
}

/** Se não há UUID em `responsaveis_ids`, tenta resolver apelido/nome legado → email → id em `profiles`. */
export function enrichResponsaveisIdsComLegadoMoni(
  rids: string[],
  opts: {
    responsavel_id: string | null;
    responsaveis_resolvidos?: readonly { id: string; nome: string }[];
    responsavel_nome_texto?: string | null;
    profilesLegacyNome?: string | null;
  },
  profileOpts: readonly PerfilNomeRow[],
): string[] {
  let out = [...rids];
  if (opts.responsavel_id && !out.includes(opts.responsavel_id)) out.unshift(opts.responsavel_id);
  if (out.length > 0) return out;
  const texto =
    opts.responsaveis_resolvidos?.[0]?.nome?.trim() ||
    (opts.responsavel_nome_texto ?? '').trim() ||
    (opts.profilesLegacyNome ?? '').trim();
  if (!texto) return out;
  const em = resolverEmailMoniPorNomeOuApelido(texto);
  if (!em) return out;
  const hit = profileOpts.find((p) => (p.email ?? '').trim().toLowerCase() === em);
  return hit ? [hit.id] : out;
}
