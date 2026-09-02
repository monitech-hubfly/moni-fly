'use server';

import { revalidatePath } from 'next/cache';
import { computeChecklistLegalCompleto } from '@/lib/checklist-legal/compute-completo';
import { CHECKLIST_LEGAL_FORM_VERSION } from '@/lib/checklist-legal/types';
import type {
  ChecklistLegalArquivos,
  ChecklistLegalCondominioRecord,
  ChecklistLegalRespostas,
} from '@/lib/checklist-legal/types';
import { resolverCondominioIdDoCard } from '@/lib/kanban/checklist-legal-gate';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type ChecklistLegalActionResult = { ok: true } | { ok: false; error: string };

async function resolveAutorNome(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
  return String((data as { full_name?: string | null } | null)?.full_name ?? '').trim() || 'Usuário';
}

async function appendLog(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    checklistId: string;
    condominioId: string;
    cardId?: string | null;
    acao: string;
    actorId?: string | null;
    actorLabel?: string | null;
    detalhes?: Record<string, unknown>;
  },
) {
  await admin.from('checklist_legal_log').insert({
    checklist_id: input.checklistId,
    condominio_id: input.condominioId,
    card_id: input.cardId ?? null,
    acao: input.acao,
    actor_id: input.actorId ?? null,
    actor_label: input.actorLabel ?? null,
    detalhes: input.detalhes ?? {},
  });
}

function mapRecord(row: Record<string, unknown>): ChecklistLegalCondominioRecord {
  return {
    id: String(row.id),
    condominio_id: String(row.condominio_id),
    versao: Number(row.versao ?? 1),
    status: row.status === 'concluido' ? 'concluido' : 'rascunho',
    respostas_json: (row.respostas_json as ChecklistLegalRespostas) ?? {},
    arquivos_json: (row.arquivos_json as ChecklistLegalArquivos) ?? {},
    form_version: Number(row.form_version ?? CHECKLIST_LEGAL_FORM_VERSION),
    card_origem_id: row.card_origem_id ? String(row.card_origem_id) : null,
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

async function resolverPrefillCadastroDoCard(
  db: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
): Promise<Partial<ChecklistLegalRespostas>> {
  const { data: cardMeta } = await db
    .from('kanban_cards')
    .select('quadra, lote, franqueado_id, nome_condominio, condominio_id')
    .eq('id', cardId)
    .maybeSingle();

  const row = cardMeta as {
    quadra?: string | null;
    lote?: string | null;
    franqueado_id?: string | null;
    nome_condominio?: string | null;
    condominio_id?: string | null;
  } | null;

  let franqueadoNome = '';
  const franqId = String(row?.franqueado_id ?? '').trim();
  if (franqId) {
    const { data: franq } = await db.from('profiles').select('full_name').eq('id', franqId).maybeSingle();
    franqueadoNome = String((franq as { full_name?: string | null } | null)?.full_name ?? '').trim();
  }

  let condominioNome = String(row?.nome_condominio ?? '').trim();
  const condominioId = String(row?.condominio_id ?? '').trim();
  if (!condominioNome && condominioId) {
    const { data: cond } = await db.from('condominios').select('nome').eq('id', condominioId).maybeSingle();
    condominioNome = String((cond as { nome?: string | null } | null)?.nome ?? '').trim();
  }

  return {
    cadastro_franqueado: franqueadoNome,
    cadastro_condominio: condominioNome,
    cadastro_quadra: String(row?.quadra ?? '').trim(),
    cadastro_lote: String(row?.lote ?? '').trim(),
  };
}

export async function getChecklistLegalForKanbanCard(cardId: string): Promise<
  | {
      ok: true;
      record: ChecklistLegalCondominioRecord | null;
      canonical: ChecklistLegalCondominioRecord | null;
      hasOwnDraft: boolean;
      condominioId: string | null;
      prefillCadastro: Partial<ChecklistLegalRespostas>;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cid = String(cardId ?? '').trim();
  const prefillCadastro = await resolverPrefillCadastroDoCard(supabase, cid);
  const condominioId = await resolverCondominioIdDoCard(supabase, cid);
  if (!condominioId) {
    return {
      ok: true,
      record: null,
      canonical: null,
      hasOwnDraft: false,
      condominioId: null,
      prefillCadastro,
    };
  }

  const { data: canonicalRow } = await supabase
    .from('checklist_legal_condominio')
    .select('*')
    .eq('condominio_id', condominioId)
    .eq('status', 'concluido')
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: draftRow } = await supabase
    .from('checklist_legal_condominio')
    .select('*')
    .eq('condominio_id', condominioId)
    .eq('status', 'rascunho')
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle();

  const draftForCard =
    draftRow && String((draftRow as { card_origem_id?: string | null }).card_origem_id ?? '') === cardId
      ? mapRecord(draftRow as Record<string, unknown>)
      : null;

  const record = draftForCard ?? (canonicalRow ? mapRecord(canonicalRow as Record<string, unknown>) : null);

  return {
    ok: true,
    record,
    canonical: canonicalRow ? mapRecord(canonicalRow as Record<string, unknown>) : null,
    hasOwnDraft: Boolean(draftForCard),
    condominioId,
    prefillCadastro,
  };
}

export async function saveChecklistLegalCondominioDraft(input: {
  cardId: string;
  respostas_json: ChecklistLegalRespostas;
  arquivos_json: ChecklistLegalArquivos;
  basePath?: string;
}): Promise<ChecklistLegalActionResult & { checklistId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cardId = String(input.cardId ?? '').trim();
  const condominioId = await resolverCondominioIdDoCard(supabase, cardId);
  if (!condominioId) return { ok: false, error: 'Vincule um condomínio ao card antes de salvar o Checklist Legal.' };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Serviço indisponível.' };
  }

  const { data: existingDraft } = await admin
    .from('checklist_legal_condominio')
    .select('id, versao')
    .eq('condominio_id', condominioId)
    .eq('status', 'rascunho')
    .eq('card_origem_id', cardId)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date().toISOString();
  let checklistId: string;

  if (existingDraft?.id) {
    checklistId = String(existingDraft.id);
    const { error } = await admin
      .from('checklist_legal_condominio')
      .update({
        respostas_json: input.respostas_json,
        arquivos_json: input.arquivos_json,
        updated_at: now,
      })
      .eq('id', checklistId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data: maxRow } = await admin
      .from('checklist_legal_condominio')
      .select('versao')
      .eq('condominio_id', condominioId)
      .order('versao', { ascending: false })
      .limit(1)
      .maybeSingle();

    const versao = Number((maxRow as { versao?: number } | null)?.versao ?? 0) + 1;
    const { data: inserted, error } = await admin
      .from('checklist_legal_condominio')
      .insert({
        condominio_id: condominioId,
        versao,
        status: 'rascunho',
        respostas_json: input.respostas_json,
        arquivos_json: input.arquivos_json,
        form_version: CHECKLIST_LEGAL_FORM_VERSION,
        card_origem_id: cardId,
        created_by: user.id,
        updated_at: now,
      })
      .select('id')
      .single();

    if (error || !inserted?.id) return { ok: false, error: error?.message ?? 'Erro ao criar rascunho.' };
    checklistId = String(inserted.id);
  }

  const autorNome = await resolveAutorNome(supabase, user.id);
  await appendLog(admin, {
    checklistId,
    condominioId,
    cardId,
    acao: 'rascunho_salvo',
    actorId: user.id,
    actorLabel: autorNome,
    detalhes: {
      completo: computeChecklistLegalCompleto(input.respostas_json, input.arquivos_json),
    },
  });

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true, checklistId };
}

export async function concluirChecklistLegalCondominio(input: {
  cardId: string;
  respostas_json: ChecklistLegalRespostas;
  arquivos_json: ChecklistLegalArquivos;
  basePath?: string;
}): Promise<ChecklistLegalActionResult> {
  const completo = computeChecklistLegalCompleto(input.respostas_json, input.arquivos_json);
  if (!completo) {
    return { ok: false, error: 'Checklist Legal incompleto. Preencha todos os campos obrigatórios.' };
  }

  const draftRes = await saveChecklistLegalCondominioDraft(input);
  if (!draftRes.ok || !draftRes.checklistId) return draftRes;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Serviço indisponível.' };
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from('checklist_legal_condominio')
    .update({ status: 'concluido', updated_at: now })
    .eq('id', draftRes.checklistId);

  if (error) return { ok: false, error: error.message };

  const condominioId = await resolverCondominioIdDoCard(admin, input.cardId);
  const autorNome = await resolveAutorNome(supabase, user.id);
  if (condominioId) {
    await appendLog(admin, {
      checklistId: draftRes.checklistId,
      condominioId,
      cardId: input.cardId,
      acao: 'concluido',
      actorId: user.id,
      actorLabel: autorNome,
    });
  }

  revalidatePath(input.basePath?.trim() || '/');
  return { ok: true };
}

export async function getOrCreateChecklistLegalPublicLink(
  cardId: string,
): Promise<{ ok: true; token: string; url: string; expires_at: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const cid = String(cardId ?? '').trim();
  const condominioId = await resolverCondominioIdDoCard(supabase, cid);
  if (!condominioId) {
    return { ok: false, error: 'Vincule um condomínio ao card para gerar o link público do Checklist Legal.' };
  }

  const nowIso = new Date().toISOString();
  const { data: existing } = await supabase
    .from('checklist_legal_public_tokens')
    .select('token, expires_at')
    .eq('card_id', cid)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.token) {
    const token = String(existing.token);
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      'http://localhost:3000';
    return {
      ok: true,
      token,
      expires_at: String(existing.expires_at),
      url: `${baseUrl}/public/checklist-legal/${token}`,
    };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Serviço indisponível.' };
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from('checklist_legal_public_tokens')
    .insert({
      card_id: cid,
      condominio_id: condominioId,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select('token')
    .single();

  if (error || !data?.token) return { ok: false, error: error?.message ?? 'Erro ao gerar link.' };

  const token = String((data as { token: string }).token);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    'http://localhost:3000';

  return {
    ok: true,
    token,
    expires_at: expiresAt,
    url: `${baseUrl}/public/checklist-legal/${token}`,
  };
}

export async function listarChecklistLegalLog(condominioId: string, limit = 20) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };

  const { data, error } = await supabase
    .from('checklist_legal_log')
    .select('id, acao, actor_label, detalhes, created_at')
    .eq('condominio_id', condominioId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: data ?? [] };
}
