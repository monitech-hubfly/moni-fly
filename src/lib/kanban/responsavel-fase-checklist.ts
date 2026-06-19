import type { SupabaseClient } from '@supabase/supabase-js';
import type { KanbanCardBrief } from '@/components/kanban-shared/types';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';

/** Slug estável do campo «Responsável da fase» em todo kanban. */
export const CAMPO_SLUG_RESPONSAVEL_FASE = 'responsavel_fase';

export const RESPONSAVEL_FASE_CHECKLIST_LABEL = 'Responsável da fase';

/** Slugs legados de responsável (Loteadores) — lidos ao propagar da fase anterior. */
export const CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO = [
  CAMPO_SLUG_RESPONSAVEL_FASE,
  'responsavel_contato',
  'responsavel_revisao',
] as const;

export function isKanbanFunilStepOneId(kanbanId: string | null | undefined): boolean {
  return String(kanbanId ?? '').trim() === KANBAN_IDS.STEP_ONE;
}

/** E-mail do responsável padrão por funil (exceto Step One — usa franqueado da rede). */
export const EMAIL_RESPONSAVEL_PADRAO_POR_KANBAN: Partial<Record<string, string>> = {
  [KANBAN_IDS.PORTFOLIO]: 'renata.silva@moni.casa',
  [KANBAN_IDS.OPERACOES]: 'larissa.lima@moni.casa',
  [KANBAN_IDS.ACOPLAMENTO]: 'elisabete.nucci@moni.casa',
  [KANBAN_IDS.PROJETO_LEGAL]: 'elisabete.nucci@moni.casa',
  [KANBAN_IDS.PROJETOS_LOCAIS]: 'larissa.lima@moni.casa',
  [KANBAN_IDS.MONI_CAPITAL]: 'kim@moni.casa',
  [KANBAN_IDS.CREDITO_OBRA]: 'kim@moni.casa',
  [KANBAN_IDS.CONTABILIDADE]: 'kim@moni.casa',
  [KANBAN_IDS.JURIDICO]: 'elisabete.nucci@moni.casa',
};

const profileIdPorEmailCache = new Map<string, string | null>();

async function buscarProfileIdPorEmail(
  supabase: SupabaseClient,
  email: string,
  opts?: { excluirStaff?: boolean },
): Promise<string | null> {
  const key = email.trim().toLowerCase();
  if (!key) return null;
  const cacheKey = opts?.excluirStaff ? `${key}:no-staff` : key;
  if (profileIdPorEmailCache.has(cacheKey)) {
    return profileIdPorEmailCache.get(cacheKey) ?? null;
  }

  const { data: rows } = await supabase
    .from('profiles')
    .select('id, role, email')
    .ilike('email', email.trim())
    .limit(10);

  const lista = (rows ?? []) as { id: string; role?: string | null }[];
  let escolhido: string | null = null;
  if (opts?.excluirStaff) {
    const franq = lista.find((p) => isFranqueadoProfileRole(p.role));
    const naoStaff = lista.find((p) => !isStaffProfileRole(p.role));
    escolhido = valorResponsavelValido(franq?.id ?? naoStaff?.id);
  } else {
    escolhido = valorResponsavelValido(lista[0]?.id);
  }

  profileIdPorEmailCache.set(cacheKey, escolhido);
  return escolhido;
}

async function isProfileIdStaff(
  supabase: SupabaseClient,
  profileId: string | null | undefined,
): Promise<boolean> {
  const uid = valorResponsavelValido(profileId);
  if (!uid || !isValorUsuarioUuid(uid)) return false;
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
  return isStaffProfileRole((prof as { role?: string | null } | null)?.role);
}

/** Nome do franqueado em `rede_franqueados` vinculado ao card Step One. */
export async function buscarNomeFranqueadoRedeStepOne(
  supabase: SupabaseClient,
  cardId: string,
): Promise<string | null> {
  const cid = cardId.trim();
  if (!cid) return null;

  const { data: card } = await supabase
    .from('kanban_cards')
    .select('rede_franqueado_id, processo_step_one_id')
    .eq('id', cid)
    .maybeSingle();

  let redeId = String((card as { rede_franqueado_id?: string | null } | null)?.rede_franqueado_id ?? '').trim();
  if (!redeId) {
    const procId = String(
      (card as { processo_step_one_id?: string | null } | null)?.processo_step_one_id ?? cid,
    ).trim();
    const { data: proc } = await supabase
      .from('processo_step_one')
      .select('origem_rede_franqueados_id')
      .eq('id', procId)
      .maybeSingle();
    redeId = String(
      (proc as { origem_rede_franqueados_id?: string | null } | null)?.origem_rede_franqueados_id ?? '',
    ).trim();
  }
  if (!redeId) return null;

  const { data: rede } = await supabase
    .from('rede_franqueados')
    .select('nome_completo')
    .eq('id', redeId)
    .maybeSingle();
  return valorResponsavelValido((rede as { nome_completo?: string | null } | null)?.nome_completo);
}

/** Responsável padrão do time para funis com owner fixo (Portfólio, Acoplamento, etc.). */
export async function resolverResponsavelPadraoPorKanban(
  supabase: SupabaseClient,
  kanbanId: string,
): Promise<string | null> {
  const kid = String(kanbanId ?? '').trim();
  if (!kid || isKanbanFunilStepOneId(kid)) return null;
  const email = EMAIL_RESPONSAVEL_PADRAO_POR_KANBAN[kid];
  if (!email) return null;
  return buscarProfileIdPorEmail(supabase, email);
}

const STAFF_PROFILE_ROLES = new Set(['admin', 'team', 'consultor', 'supervisor']);
const FRANQUEADO_PROFILE_ROLES = new Set(['frank', 'franqueado']);

function isStaffProfileRole(role: string | null | undefined): boolean {
  return STAFF_PROFILE_ROLES.has(String(role ?? '').trim());
}

function isFranqueadoProfileRole(role: string | null | undefined): boolean {
  return FRANQUEADO_PROFILE_ROLES.has(String(role ?? '').trim());
}

async function buscarProfileIdSeFranqueado(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<string | null> {
  const uid = valorResponsavelValido(userId);
  if (!uid) return null;
  const { data: prof } = await supabase.from('profiles').select('id, role').eq('id', uid).maybeSingle();
  if (!prof?.id) return null;
  const role = String((prof as { role?: string | null }).role ?? '').trim();
  if (isStaffProfileRole(role)) return null;
  if (isFranqueadoProfileRole(role)) return String(prof.id);
  return null;
}

type RedeFranqueadoProfileRow = {
  id: string;
  nome_completo?: string | null;
  email_frank?: string | null;
  processo_id?: string | null;
};

function escolherProfileIdPorNomeCandidatos(
  candidatos: { id: string; role?: string | null }[],
): string | null {
  const preferido = candidatos.find((p) => isFranqueadoProfileRole(p.role));
  const escolhido = preferido ?? candidatos.find((p) => !isStaffProfileRole(p.role));
  return valorResponsavelValido(escolhido?.id);
}

/** Resolve profiles de franqueado por `rede_franqueado_id` em lote (evita N+1 no pipeline). */
export async function buscarProfilesFranqueadoPorRedeIdsBatch(
  supabase: SupabaseClient,
  redeIds: string[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const uniq = [...new Set(redeIds.map((r) => r.trim()).filter(Boolean))];
  for (const rid of uniq) out.set(rid, null);
  if (uniq.length === 0) return out;

  const { data: profRows } = await supabase
    .from('profiles')
    .select('id, role, rede_franqueado_id')
    .in('rede_franqueado_id', uniq)
    .in('role', [...FRANQUEADO_PROFILE_ROLES]);

  const unresolved = new Set(uniq);
  for (const p of profRows ?? []) {
    const rid = String((p as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? '').trim();
    const uid = valorResponsavelValido((p as { id?: string }).id);
    if (rid && uid && unresolved.has(rid)) {
      out.set(rid, uid);
      unresolved.delete(rid);
    }
  }
  if (unresolved.size === 0) return out;

  const { data: redeRows } = await supabase
    .from('rede_franqueados')
    .select('id, nome_completo, email_frank, processo_id')
    .in('id', [...unresolved]);

  const redeById = new Map<string, RedeFranqueadoProfileRow>();
  for (const r of redeRows ?? []) {
    const rid = String((r as RedeFranqueadoProfileRow).id ?? '').trim();
    if (rid) redeById.set(rid, r as RedeFranqueadoProfileRow);
  }

  const emailsUnicos = new Map<string, string[]>();
  for (const rid of unresolved) {
    const emailFrank = String(redeById.get(rid)?.email_frank ?? '').trim();
    if (!emailFrank) continue;
    const key = emailFrank.toLowerCase();
    const list = emailsUnicos.get(key) ?? [];
    list.push(rid);
    emailsUnicos.set(key, list);
  }
  if (emailsUnicos.size > 0) {
    const orEmail = [...emailsUnicos.keys()]
      .map((e) => `email.ilike.${e.replace(/,/g, '')}`)
      .join(',');
    const { data: profsEmail } = await supabase
      .from('profiles')
      .select('id, role, email')
      .or(orEmail)
      .limit(emailsUnicos.size * 10);
    for (const p of profsEmail ?? []) {
      const emailKey = String((p as { email?: string | null }).email ?? '')
        .trim()
        .toLowerCase();
      const rids = emailsUnicos.get(emailKey);
      if (!rids?.length) continue;
      const lista = [p as { id: string; role?: string | null }];
      const franq = lista.find((row) => isFranqueadoProfileRole(row.role));
      const naoStaff = lista.find((row) => !isStaffProfileRole(row.role));
      const uid = valorResponsavelValido(franq?.id ?? naoStaff?.id ?? lista[0]?.id);
      if (!uid) continue;
      for (const rid of rids) {
        if (!unresolved.has(rid)) continue;
        out.set(rid, uid);
        unresolved.delete(rid);
      }
    }
  }
  if (unresolved.size === 0) return out;

  const nomesPorRid = new Map<string, string>();
  for (const rid of unresolved) {
    const nome = String(redeById.get(rid)?.nome_completo ?? '').trim();
    if (nome) nomesPorRid.set(rid, nome);
  }
  const nomesUnicos = [...new Set(nomesPorRid.values())];
  if (nomesUnicos.length > 0) {
    const orNomes = nomesUnicos.map((n) => `full_name.ilike.${n.replace(/,/g, '')}`).join(',');
    const { data: profsNome } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .or(orNomes)
      .limit(nomesUnicos.length * 5);
    const candidatosPorNome = new Map<string, { id: string; role?: string | null }[]>();
    for (const p of profsNome ?? []) {
      const nome = String((p as { full_name?: string | null }).full_name ?? '')
        .trim()
        .toLowerCase();
      if (!nome) continue;
      const list = candidatosPorNome.get(nome) ?? [];
      list.push(p as { id: string; role?: string | null });
      candidatosPorNome.set(nome, list);
    }
    for (const [rid, nomeCompleto] of nomesPorRid) {
      if (!unresolved.has(rid)) continue;
      let candidatos = candidatosPorNome.get(nomeCompleto.toLowerCase()) ?? [];
      if (candidatos.length === 0) {
        const primeiroNome = nomeCompleto.split(/\s+/)[0] ?? '';
        if (primeiroNome.length >= 3) {
          candidatos = (profsNome ?? []).filter((p) =>
            String((p as { full_name?: string | null }).full_name ?? '')
              .toLowerCase()
              .includes(primeiroNome.toLowerCase()),
          ) as { id: string; role?: string | null }[];
        }
      }
      const uidNome = escolherProfileIdPorNomeCandidatos(candidatos);
      if (uidNome) {
        out.set(rid, uidNome);
        unresolved.delete(rid);
      }
    }
  }
  if (unresolved.size === 0) return out;

  const procIds = [
    ...new Set(
      [...unresolved]
        .map((rid) => String(redeById.get(rid)?.processo_id ?? '').trim())
        .filter(Boolean),
    ),
  ];
  if (procIds.length > 0) {
    const { data: procs } = await supabase
      .from('processo_step_one')
      .select('id, user_id')
      .in('id', procIds);
    const procUserById = new Map<string, string>();
    const userIds = new Set<string>();
    for (const proc of procs ?? []) {
      const pid = String((proc as { id?: string }).id ?? '').trim();
      const uid = valorResponsavelValido((proc as { user_id?: string | null }).user_id);
      if (pid && uid) {
        procUserById.set(pid, uid);
        userIds.add(uid);
      }
    }
    const profileSeFranqueado = new Map<string, string | null>();
    if (userIds.size > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, role')
        .in('id', [...userIds]);
      for (const p of profs ?? []) {
        const id = String((p as { id?: string }).id ?? '').trim();
        if (!id) continue;
        const role = String((p as { role?: string | null }).role ?? '').trim();
        if (isStaffProfileRole(role)) profileSeFranqueado.set(id, null);
        else if (isFranqueadoProfileRole(role)) profileSeFranqueado.set(id, id);
        else profileSeFranqueado.set(id, id);
      }
    }
    for (const rid of [...unresolved]) {
      const procId = String(redeById.get(rid)?.processo_id ?? '').trim();
      if (!procId) continue;
      const userId = procUserById.get(procId);
      const uidProc = userId ? (profileSeFranqueado.get(userId) ?? null) : null;
      if (uidProc) {
        out.set(rid, uidProc);
        unresolved.delete(rid);
      }
    }
  }

  return out;
}

export async function buscarProfileFranqueadoPorRedeId(
  supabase: SupabaseClient,
  redeId: string,
): Promise<string | null> {
  const rid = redeId.trim();
  if (!rid) return null;
  const batch = await buscarProfilesFranqueadoPorRedeIdsBatch(supabase, [rid]);
  return batch.get(rid) ?? null;
}

/**
 * Funil Step One: responsável = usuário do franqueado (rede / processo).
 * Não usa `kanban_cards.franqueado_id` — esse campo guarda quem criou o card.
 */
export async function buscarFranqueadoIdResponsavelStepOne(
  supabase: SupabaseClient,
  cardId: string,
): Promise<string | null> {
  const cid = cardId.trim();
  if (!cid) return null;

  const { data: card } = await supabase
    .from('kanban_cards')
    .select('kanban_id, rede_franqueado_id, processo_step_one_id, franqueado_id')
    .eq('id', cid)
    .maybeSingle();
  if (!card) return null;

  const kanbanId = String((card as { kanban_id?: string | null }).kanban_id ?? '').trim();
  if (!isKanbanFunilStepOneId(kanbanId)) return null;

  const cardCreatorId = String((card as { franqueado_id?: string | null }).franqueado_id ?? '').trim();

  const redeId = String((card as { rede_franqueado_id?: string | null }).rede_franqueado_id ?? '').trim();
  if (redeId) {
    const uidRede = await buscarProfileFranqueadoPorRedeId(supabase, redeId);
    if (uidRede && uidRede !== cardCreatorId) return uidRede;
  }

  const procId = String(
    (card as { processo_step_one_id?: string | null }).processo_step_one_id ?? cid,
  ).trim();
  const { data: proc } = await supabase
    .from('processo_step_one')
    .select('user_id, origem_rede_franqueados_id')
    .eq('id', procId)
    .maybeSingle();

  const origemRedeId = String(
    (proc as { origem_rede_franqueados_id?: string | null } | null)?.origem_rede_franqueados_id ?? '',
  ).trim();
  if (origemRedeId && origemRedeId !== redeId) {
    const uidOrigem = await buscarProfileFranqueadoPorRedeId(supabase, origemRedeId);
    if (uidOrigem) return uidOrigem;
  }

  const userFromProc = await buscarProfileIdSeFranqueado(
    supabase,
    (proc as { user_id?: string | null } | null)?.user_id,
  );
  if (userFromProc) return userFromProc;

  return null;
}

/** Step One: grava responsável da fase = franqueado da rede (sobrescreve valor incorreto). */
export async function sincronizarResponsavelFaseStepOne(
  supabase: SupabaseClient,
  cardId: string,
  faseId: string,
  preenchidoPor?: string | null,
): Promise<string | null> {
  const cid = cardId.trim();
  const fid = faseId.trim();
  if (!cid || !fid) return null;

  const { data: cardRow } = await supabase
    .from('kanban_cards')
    .select('franqueado_id')
    .eq('id', cid)
    .maybeSingle();
  const cardCreatorId = String((cardRow as { franqueado_id?: string | null } | null)?.franqueado_id ?? '').trim();

  const franqueadoId = await buscarFranqueadoIdResponsavelStepOne(supabase, cid);
  const itemId = await buscarItemIdResponsavelFaseEdicao(supabase, fid);
  if (!itemId) return franqueadoId;

  const { data: respAtual } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('valor')
    .eq('card_id', cid)
    .eq('item_id', itemId)
    .maybeSingle();

  const valorRaw = valorResponsavelValido((respAtual as { valor?: string | null } | null)?.valor);
  const valorAtual = valorRaw && isValorUsuarioUuid(valorRaw) ? valorRaw : null;
  const valorIncorreto =
    Boolean(valorRaw) &&
    (!isValorUsuarioUuid(valorRaw) ||
      valorRaw === cardCreatorId ||
      (await isProfileIdStaff(supabase, valorRaw)));

  if (franqueadoId) {
    if (valorAtual === franqueadoId) return franqueadoId;
    if (valorAtual && !valorIncorreto) return valorAtual;
    await supabase.from('kanban_fase_checklist_respostas').upsert(
      {
        item_id: itemId,
        card_id: cid,
        valor: franqueadoId,
        preenchido_por: preenchidoPor ?? null,
        preenchido_em: new Date().toISOString(),
      },
      { onConflict: 'item_id,card_id' },
    );
    return franqueadoId;
  }

  if (valorIncorreto) {
    await supabase
      .from('kanban_fase_checklist_respostas')
      .delete()
      .eq('card_id', cid)
      .eq('item_id', itemId);
  }

  return null;
}

type FaseOrdemRow = { id: string; ordem: number; slug?: string | null };

type ChecklistItemResponsavelRow = {
  id: string;
  campo_slug?: string | null;
  label?: string | null;
  tipo?: string | null;
};

function normalizarLabelResponsavelFase(label: string | null | undefined): boolean {
  const t = String(label ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return t === 'responsavel da fase';
}

/** Item de checklist que representa o responsável da fase (slug, label ou legado). */
export function isChecklistItemResponsavelFase(item: ChecklistItemResponsavelRow): boolean {
  const slug = String(item.campo_slug ?? '').trim();
  if ((CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO as readonly string[]).includes(slug as (typeof CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO)[number])) {
    return true;
  }
  if (normalizarLabelResponsavelFase(item.label)) return true;
  const label = String(item.label ?? '').trim().toLowerCase();
  return item.tipo === 'usuario' && label.includes('respons') && label.includes('fase');
}

export function escolherItemResponsavelFaseCanonico(rows: ChecklistItemResponsavelRow[]): string | null {
  if (rows.length === 0) return null;
  const bySlug = rows.find((r) => String(r.campo_slug ?? '').trim() === CAMPO_SLUG_RESPONSAVEL_FASE);
  if (bySlug?.id) return String(bySlug.id);
  const byLabel = rows.find((r) => normalizarLabelResponsavelFase(r.label));
  if (byLabel?.id) return String(byLabel.id);
  return String(rows[0]?.id ?? '').trim() || null;
}

/** Resolve o item editável de responsável da fase (sidebar / upsert). */
export async function buscarItemIdResponsavelFaseEdicao(
  supabase: SupabaseClient,
  faseId: string,
): Promise<string | null> {
  const fid = faseId.trim();
  if (!fid) return null;

  const { data: rowsSlug } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id, campo_slug, label, tipo')
    .eq('fase_id', fid)
    .in('campo_slug', [...CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO]);

  let rows = (rowsSlug ?? []) as ChecklistItemResponsavelRow[];
  if (rows.length === 0) {
    const { data: rowsLabel } = await supabase
      .from('kanban_fase_checklist_itens')
      .select('id, campo_slug, label, tipo')
      .eq('fase_id', fid)
      .eq('label', RESPONSAVEL_FASE_CHECKLIST_LABEL);
    rows = (rowsLabel ?? []) as ChecklistItemResponsavelRow[];
  }
  if (rows.length === 0) {
    const { data: rowsUsuario } = await supabase
      .from('kanban_fase_checklist_itens')
      .select('id, campo_slug, label, tipo')
      .eq('fase_id', fid)
      .eq('tipo', 'usuario');
    rows = ((rowsUsuario ?? []) as ChecklistItemResponsavelRow[]).filter(isChecklistItemResponsavelFase);
  }

  return escolherItemResponsavelFaseCanonico(rows);
}

function valorResponsavelValido(valor: string | null | undefined): string | null {
  const v = String(valor ?? '').trim();
  return v || null;
}

const VALOR_USUARIO_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValorUsuarioUuid(valor: string | null | undefined): boolean {
  return VALOR_USUARIO_UUID_RE.test(String(valor ?? '').trim());
}

async function buscarRespostaValor(
  supabase: SupabaseClient,
  cardId: string,
  itemIds: string[],
): Promise<string | null> {
  if (itemIds.length === 0) return null;
  const { data } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('item_id, valor')
    .eq('card_id', cardId)
    .in('item_id', itemIds);
  for (const row of data ?? []) {
    const v = valorResponsavelValido((row as { valor?: string | null }).valor);
    if (v) return v;
  }
  return null;
}

async function itemIdsResponsavelPorFase(
  supabase: SupabaseClient,
  faseId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id, campo_slug')
    .eq('fase_id', faseId)
    .in('campo_slug', [...CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO]);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

/**
 * Valor de responsável da fase imediatamente anterior (por ordem do kanban).
 * Na 1ª fase, usa o owner padrão do funil (ou franqueado da rede no Step One).
 */
export async function buscarValorResponsavelFaseAnterior(
  supabase: SupabaseClient,
  cardId: string,
  faseIdAtual: string,
): Promise<string | null> {
  const cid = cardId.trim();
  const fid = faseIdAtual.trim();
  if (!cid || !fid) return null;

  const { data: faseAtual } = await supabase
    .from('kanban_fases')
    .select('id, kanban_id, ordem')
    .eq('id', fid)
    .maybeSingle();
  if (!faseAtual?.id) return null;

  const kanbanId = String((faseAtual as { kanban_id?: string }).kanban_id ?? '').trim();
  const ordemAtual = Number((faseAtual as { ordem?: number }).ordem ?? 0);
  if (!kanbanId) return null;

  if (isKanbanFunilStepOneId(kanbanId)) {
    return buscarFranqueadoIdResponsavelStepOne(supabase, cid);
  }

  const { data: fases } = await supabase
    .from('kanban_fases')
    .select('id, ordem, slug')
    .eq('kanban_id', kanbanId)
    .eq('ativo', true)
    .order('ordem', { ascending: true });

  const lista = (fases ?? []) as FaseOrdemRow[];
  const anteriores = lista.filter((f) => f.ordem < ordemAtual).sort((a, b) => b.ordem - a.ordem);

  for (const fase of anteriores) {
    const itemIds = await itemIdsResponsavelPorFase(supabase, fase.id);
    const valor = await buscarRespostaValor(supabase, cid, itemIds);
    if (valor) return valor;
  }

  return resolverResponsavelPadraoPorKanban(supabase, kanbanId);
}

/** Grava o responsável padrão do funil na fase atual (somente se ainda vazio). */
export async function aplicarResponsavelFasePadraoAoCard(
  supabase: SupabaseClient,
  cardId: string,
  faseId: string,
  kanbanId: string,
  preenchidoPor?: string | null,
): Promise<void> {
  const cid = cardId.trim();
  const fid = faseId.trim();
  const kid = String(kanbanId ?? '').trim();
  if (!cid || !fid || !kid) return;

  const itemId = await buscarItemIdResponsavelFaseEdicao(supabase, fid);
  if (!itemId) return;

  if (isKanbanFunilStepOneId(kid)) {
    await sincronizarResponsavelFaseStepOne(supabase, cid, fid, preenchidoPor);
    return;
  }

  const { data: respAtual } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('valor')
    .eq('card_id', cid)
    .eq('item_id', itemId)
    .maybeSingle();
  if (valorResponsavelValido((respAtual as { valor?: string | null } | null)?.valor)) return;

  const userId = await resolverResponsavelPadraoPorKanban(supabase, kid);
  if (!userId) return;

  await supabase.from('kanban_fase_checklist_respostas').upsert(
    {
      item_id: itemId,
      card_id: cid,
      valor: userId,
      preenchido_por: preenchidoPor ?? null,
      preenchido_em: new Date().toISOString(),
    },
    { onConflict: 'item_id,card_id' },
  );
}

/** Preenche o campo responsavel_fase da nova fase a partir da fase anterior (se ainda vazio). */
export async function propagarResponsavelFaseAoEntrarFase(
  supabase: SupabaseClient,
  cardId: string,
  novaFaseId: string,
  preenchidoPor?: string | null,
): Promise<void> {
  const cid = cardId.trim();
  const fid = novaFaseId.trim();
  if (!cid || !fid) return;

  const { data: itemDestino } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id')
    .eq('fase_id', fid)
    .eq('campo_slug', CAMPO_SLUG_RESPONSAVEL_FASE)
    .maybeSingle();

  let itemId = String((itemDestino as { id?: string } | null)?.id ?? '').trim();
  if (!itemId) {
    itemId = (await buscarItemIdResponsavelFaseEdicao(supabase, fid)) ?? '';
  }
  if (!itemId) return;

  const { data: faseRow } = await supabase
    .from('kanban_fases')
    .select('kanban_id')
    .eq('id', fid)
    .maybeSingle();
  const kanbanId = String((faseRow as { kanban_id?: string | null } | null)?.kanban_id ?? '').trim();
  const stepOne = isKanbanFunilStepOneId(kanbanId);

  const { data: respAtual } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('valor')
    .eq('card_id', cid)
    .eq('item_id', itemId)
    .maybeSingle();

  let valorDestino: string | null = null;
  if (stepOne) {
    valorDestino = await sincronizarResponsavelFaseStepOne(supabase, cid, fid, preenchidoPor);
    return;
  } else {
    if (valorResponsavelValido((respAtual as { valor?: string | null } | null)?.valor)) return;
    valorDestino = await buscarValorResponsavelFaseAnterior(supabase, cid, fid);
  }

  if (!valorDestino) return;

  const valorAtual = valorResponsavelValido((respAtual as { valor?: string | null } | null)?.valor);
  if (valorAtual === valorDestino) return;

  await supabase.from('kanban_fase_checklist_respostas').upsert(
    {
      item_id: itemId,
      card_id: cid,
      valor: valorDestino,
      preenchido_por: preenchidoPor ?? null,
      preenchido_em: new Date().toISOString(),
    },
    { onConflict: 'item_id,card_id' },
  );
}

function resolverItemResponsavelPorFase(
  rows: { id: string; fase_id: string; campo_slug: string }[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const faseId = String(row.fase_id ?? '').trim();
    const itemId = String(row.id ?? '').trim();
    if (!faseId || !itemId) continue;
    if (row.campo_slug === CAMPO_SLUG_RESPONSAVEL_FASE) {
      map.set(faseId, itemId);
    } else if (!map.has(faseId)) {
      map.set(faseId, itemId);
    }
  }
  return map;
}

type StepOneCardDbRow = {
  id: string;
  rede_franqueado_id?: string | null;
  processo_step_one_id?: string | null;
  franqueado_id?: string | null;
};

type StepOneProcessoRow = {
  user_id?: string | null;
  origem_rede_franqueados_id?: string | null;
};

export type EnrichResponsavelFaseOpts = {
  stepOneNomeRedePorCardId?: Map<string, string>;
  stepOneProfilePorRedeId?: Map<string, string | null>;
};

function resolveStepOneFranqueadoIdBatch(
  cardId: string,
  stepOneRowsById: Map<string, StepOneCardDbRow>,
  procById: Map<string, StepOneProcessoRow>,
  profilePorRede: Map<string, string | null>,
  profileSeFranqueado: Map<string, string | null>,
): string | null {
  const row = stepOneRowsById.get(cardId);
  if (!row) return null;

  const creatorId = String(row.franqueado_id ?? '').trim();
  let redeId = String(row.rede_franqueado_id ?? '').trim();
  if (!redeId) {
    const procId = String(row.processo_step_one_id ?? cardId).trim();
    redeId = String(procById.get(procId)?.origem_rede_franqueados_id ?? '').trim();
  }

  if (redeId) {
    const uidRede = profilePorRede.get(redeId) ?? null;
    if (uidRede && uidRede !== creatorId) return uidRede;
  }

  const procId = String(row.processo_step_one_id ?? cardId).trim();
  const proc = procById.get(procId);
  const origemRedeId = String(proc?.origem_rede_franqueados_id ?? '').trim();
  if (origemRedeId && origemRedeId !== redeId) {
    const uidOrigem = profilePorRede.get(origemRedeId) ?? null;
    if (uidOrigem) return uidOrigem;
  }

  const userFromProc = valorResponsavelValido(proc?.user_id);
  if (userFromProc) return profileSeFranqueado.get(userFromProc) ?? null;

  return null;
}

async function enriquecerStepOneCardsBatch(
  supabase: SupabaseClient,
  cards: KanbanCardBrief[],
  stepOneCardIds: string[],
  itemPorFase: Map<string, string>,
  respPorCardItem: Map<string, string>,
  userIdPorCard: Map<string, string>,
  nomeRedePorCard: Map<string, string>,
  opts?: EnrichResponsavelFaseOpts,
): Promise<void> {
  if (stepOneCardIds.length === 0) return;

  const cardById = new Map(cards.map((c) => [c.id, c]));
  const stepOneRowsById = new Map<string, StepOneCardDbRow>();

  const { data: stepOneRows } = await supabase
    .from('kanban_cards')
    .select('id, kanban_id, rede_franqueado_id, processo_step_one_id, franqueado_id')
    .in('id', stepOneCardIds);

  for (const row of stepOneRows ?? []) {
    const id = String((row as StepOneCardDbRow).id ?? '').trim();
    if (id) stepOneRowsById.set(id, row as StepOneCardDbRow);
  }

  const procIds = new Set<string>();
  for (const sid of stepOneCardIds) {
    const row = stepOneRowsById.get(sid);
    if (!row) continue;
    const procId = String(row.processo_step_one_id ?? sid).trim();
    if (procId) procIds.add(procId);
  }

  const procById = new Map<string, StepOneProcessoRow>();
  if (procIds.size > 0) {
    const { data: procs } = await supabase
      .from('processo_step_one')
      .select('id, user_id, origem_rede_franqueados_id')
      .in('id', [...procIds]);
    for (const p of procs ?? []) {
      const pid = String((p as { id?: string }).id ?? '').trim();
      if (pid) procById.set(pid, p as StepOneProcessoRow);
    }
  }

  const redeIdsNeeded = new Set<string>();
  for (const sid of stepOneCardIds) {
    const row = stepOneRowsById.get(sid);
    if (!row) continue;
    let redeId = String(row.rede_franqueado_id ?? '').trim();
    if (!redeId) {
      const procId = String(row.processo_step_one_id ?? sid).trim();
      redeId = String(procById.get(procId)?.origem_rede_franqueados_id ?? '').trim();
    }
    if (redeId) redeIdsNeeded.add(redeId);
    const procId = String(row.processo_step_one_id ?? sid).trim();
    const origem = String(procById.get(procId)?.origem_rede_franqueados_id ?? '').trim();
    if (origem) redeIdsNeeded.add(origem);
  }

  const profilePorRede = opts?.stepOneProfilePorRedeId ?? new Map<string, string | null>();
  const redeIdsMissingProfile = [...redeIdsNeeded].filter((rid) => !profilePorRede.has(rid));
  if (redeIdsMissingProfile.length > 0) {
    const batchProfiles = await buscarProfilesFranqueadoPorRedeIdsBatch(supabase, redeIdsMissingProfile);
    for (const [rid, uid] of batchProfiles) profilePorRede.set(rid, uid);
  }

  const nomeRedePorRedeId = new Map<string, string>();
  if (redeIdsNeeded.size > 0) {
    const { data: redes } = await supabase
      .from('rede_franqueados')
      .select('id, nome_completo')
      .in('id', [...redeIdsNeeded]);
    for (const r of redes ?? []) {
      const rid = String((r as { id?: string }).id ?? '').trim();
      const nome = valorResponsavelValido((r as { nome_completo?: string | null }).nome_completo);
      if (rid && nome) nomeRedePorRedeId.set(rid, nome);
    }
  }

  const procUserIds = new Set<string>();
  for (const proc of procById.values()) {
    const uid = valorResponsavelValido(proc.user_id);
    if (uid) procUserIds.add(uid);
  }
  const profileSeFranqueado = new Map<string, string | null>();
  if (procUserIds.size > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, role')
      .in('id', [...procUserIds]);
    for (const p of profs ?? []) {
      const id = String((p as { id?: string }).id ?? '').trim();
      if (!id) continue;
      const role = String((p as { role?: string | null }).role ?? '').trim();
      if (isStaffProfileRole(role)) profileSeFranqueado.set(id, null);
      else profileSeFranqueado.set(id, id);
    }
  }

  const checklistUidsToCheck = new Set<string>();
  for (const sid of stepOneCardIds) {
    const card = cardById.get(sid);
    if (!card) continue;
    const itemId = itemPorFase.get(String(card.fase_id ?? '').trim());
    const uidChecklist = itemId ? respPorCardItem.get(`${sid}:${itemId}`) : null;
    const uidChecklistValido =
      uidChecklist && isValorUsuarioUuid(uidChecklist) ? uidChecklist : null;
    const row = stepOneRowsById.get(sid);
    const creatorId = String(row?.franqueado_id ?? card.franqueado_id ?? '').trim();
    const canonical = resolveStepOneFranqueadoIdBatch(
      sid,
      stepOneRowsById,
      procById,
      profilePorRede,
      profileSeFranqueado,
    );
    if (!canonical && uidChecklistValido && uidChecklistValido !== creatorId) {
      checklistUidsToCheck.add(uidChecklistValido);
    }
  }

  const staffPorProfileId = new Map<string, boolean>();
  if (checklistUidsToCheck.size > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, role')
      .in('id', [...checklistUidsToCheck]);
    for (const p of profs ?? []) {
      const id = String((p as { id?: string }).id ?? '').trim();
      if (id) staffPorProfileId.set(id, isStaffProfileRole((p as { role?: string | null }).role));
    }
  }

  for (const sid of stepOneCardIds) {
    const card = cardById.get(sid);
    if (!card) continue;
    const itemId = itemPorFase.get(String(card.fase_id ?? '').trim());
    const uidChecklist = itemId ? respPorCardItem.get(`${sid}:${itemId}`) : null;
    const uidChecklistValido =
      uidChecklist && isValorUsuarioUuid(uidChecklist) ? uidChecklist : null;
    const row = stepOneRowsById.get(sid);
    const creatorId = String(row?.franqueado_id ?? card.franqueado_id ?? '').trim();

    let uidFinal = resolveStepOneFranqueadoIdBatch(
      sid,
      stepOneRowsById,
      procById,
      profilePorRede,
      profileSeFranqueado,
    );
    if (!uidFinal && uidChecklistValido && uidChecklistValido !== creatorId) {
      if (!staffPorProfileId.get(uidChecklistValido)) uidFinal = uidChecklistValido;
    }
    if (uidFinal) userIdPorCard.set(sid, uidFinal);

    const nomeFromOpts = opts?.stepOneNomeRedePorCardId?.get(sid);
    if (nomeFromOpts) {
      nomeRedePorCard.set(sid, nomeFromOpts);
      continue;
    }
    let redeId = String(row?.rede_franqueado_id ?? '').trim();
    if (!redeId && row) {
      const procId = String(row.processo_step_one_id ?? sid).trim();
      redeId = String(procById.get(procId)?.origem_rede_franqueados_id ?? '').trim();
    }
    const nomeRede = redeId ? nomeRedePorRedeId.get(redeId) : null;
    if (nomeRede) nomeRedePorCard.set(sid, nomeRede);
  }
}

function resolverValorResponsavelCardComHistorico(
  cardId: string,
  faseIdAtual: string,
  faseOrdemPorId: Map<string, number>,
  itemPorFase: Map<string, string>,
  respPorCardItem: Map<string, string>,
): string | null {
  const ordemAtual = faseOrdemPorId.get(faseIdAtual);
  if (ordemAtual == null) {
    const itemId = itemPorFase.get(faseIdAtual);
    return itemId ? respPorCardItem.get(`${cardId}:${itemId}`) ?? null : null;
  }

  const fasesDesc = [...faseOrdemPorId.entries()]
    .filter(([, ordem]) => ordem <= ordemAtual)
    .sort((a, b) => b[1] - a[1]);

  for (const [fid] of fasesDesc) {
    const itemId = itemPorFase.get(fid);
    if (!itemId) continue;
    const v = respPorCardItem.get(`${cardId}:${itemId}`);
    if (v) return v;
  }
  return null;
}

function aplicarResponsavelEnriquecidoNoCard(
  card: KanbanCardBrief,
  valor: string | null | undefined,
  nomeRede: string | null | undefined,
  nomePorUserId: Map<string, string>,
): KanbanCardBrief {
  const raw = valorResponsavelValido(valor);
  const rede = valorResponsavelValido(nomeRede);
  if (!raw && !rede) return card;

  if (raw && isValorUsuarioUuid(raw)) {
    return {
      ...card,
      responsavel_fase_id: raw,
      responsavel_fase_nome: nomePorUserId.get(raw) ?? rede ?? null,
    };
  }

  return {
    ...card,
    responsavel_fase_id: null,
    responsavel_fase_nome: raw ?? rede ?? null,
  };
}

/** Enriquece cards do board com responsável da fase atual (para avatar no card fechado). */
export async function enrichCardsComResponsavelFase(
  supabase: SupabaseClient,
  cards: KanbanCardBrief[],
  opts?: EnrichResponsavelFaseOpts,
): Promise<KanbanCardBrief[]> {
  if (cards.length === 0) return cards;

  const kanbanIds = [...new Set(cards.map((c) => String(c.kanban_id ?? '').trim()).filter(Boolean))];
  if (kanbanIds.length === 0) return cards;

  const { data: fasesRows } = await supabase
    .from('kanban_fases')
    .select('id, kanban_id, ordem')
    .in('kanban_id', kanbanIds)
    .eq('ativo', true);

  const faseOrdemPorId = new Map<string, number>();
  const allFaseIds: string[] = [];
  for (const row of fasesRows ?? []) {
    const fid = String((row as { id?: string }).id ?? '').trim();
    if (!fid) continue;
    allFaseIds.push(fid);
    faseOrdemPorId.set(fid, Number((row as { ordem?: number }).ordem ?? 0));
  }
  if (allFaseIds.length === 0) return cards;

  const { data: itens } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id, fase_id, campo_slug')
    .in('fase_id', allFaseIds)
    .in('campo_slug', [...CAMPOS_SLUG_RESPONSAVEL_FASE_LEGADO]);

  const itemPorFase = resolverItemResponsavelPorFase(
    (itens ?? []) as { id: string; fase_id: string; campo_slug: string }[],
  );
  const itemIds = [...new Set([...itemPorFase.values()])];
  if (itemIds.length === 0) return cards;

  const cardIds = cards.map((c) => c.id);
  const { data: respostas } = await supabase
    .from('kanban_fase_checklist_respostas')
    .select('card_id, item_id, valor')
    .in('card_id', cardIds)
    .in('item_id', itemIds);

  const respPorCardItem = new Map<string, string>();
  for (const row of respostas ?? []) {
    const cid = String((row as { card_id?: string }).card_id ?? '').trim();
    const iid = String((row as { item_id?: string }).item_id ?? '').trim();
    const v = valorResponsavelValido((row as { valor?: string | null }).valor);
    if (cid && iid && v) respPorCardItem.set(`${cid}:${iid}`, v);
  }

  const valorPorCard = new Map<string, string>();
  const nomeRedePorCard = new Map<string, string>();
  const stepOneCardIds: string[] = [];
  const outrosSemResposta: { cardId: string; kanbanId: string }[] = [];

  for (const card of cards) {
    if (isKanbanFunilStepOneId(card.kanban_id)) {
      stepOneCardIds.push(card.id);
      continue;
    }
    const faseId = String(card.fase_id ?? '').trim();
    const valor = resolverValorResponsavelCardComHistorico(
      card.id,
      faseId,
      faseOrdemPorId,
      itemPorFase,
      respPorCardItem,
    );
    if (valor) {
      valorPorCard.set(card.id, valor);
      continue;
    }
    const kid = String(card.kanban_id ?? '').trim();
    if (kid) outrosSemResposta.push({ cardId: card.id, kanbanId: kid });
  }

  const kanbansUnicos = [...new Set(outrosSemResposta.map((o) => o.kanbanId))];
  const padraoPorKanban = new Map<string, string>();
  for (const kid of kanbansUnicos) {
    const uid = await resolverResponsavelPadraoPorKanban(supabase, kid);
    if (uid) padraoPorKanban.set(kid, uid);
  }
  for (const { cardId, kanbanId } of outrosSemResposta) {
    const uid = padraoPorKanban.get(kanbanId);
    if (uid) valorPorCard.set(cardId, uid);
  }

  await enriquecerStepOneCardsBatch(
    supabase,
    cards,
    stepOneCardIds,
    itemPorFase,
    respPorCardItem,
    valorPorCard,
    nomeRedePorCard,
    opts,
  );

  if (valorPorCard.size === 0 && nomeRedePorCard.size === 0) return cards;

  const userIds = [...new Set([...valorPorCard.values()].filter(isValorUsuarioUuid))];
  const nomePorUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
    for (const p of profiles ?? []) {
      const id = String((p as { id?: string }).id ?? '').trim();
      const nome = String((p as { full_name?: string | null }).full_name ?? '').trim();
      if (id) nomePorUserId.set(id, nome || id.slice(0, 8));
    }
  }

  return cards.map((c) =>
    aplicarResponsavelEnriquecidoNoCard(c, valorPorCard.get(c.id), nomeRedePorCard.get(c.id), nomePorUserId),
  );
}
