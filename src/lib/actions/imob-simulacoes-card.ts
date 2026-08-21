'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRedeStaffRole, normalizeAccessRole } from '@/lib/authz';
import {
  draftToImobModeloPatch,
  draftToImobPatch,
  mapImobCardEmpreendimentoRow,
  mapImobCardModeloRow,
  normalizeImobBlocoTipo,
  rowToImobDraft,
  rowToImobModeloDraft,
  type ImobBlocoTipo,
  type ImobCardEmpreendimentoDraft,
  type ImobCardModeloDraft,
} from '@/lib/kanban/imob-simulacoes-card';

const BUCKET = 'processo-docs';
const MAX_IMAGEM_BYTES = 10 * 1024 * 1024;

function arquivoDoFormData(formData: FormData): { ok: true; blob: Blob; nome: string } | { ok: false; error: string } {
  const file = formData.get('file');
  if (!file || typeof file === 'string') return { ok: false, error: 'Selecione uma imagem.' };
  const blob = file as Blob;
  if (!blob.size) return { ok: false, error: 'Selecione uma imagem.' };
  if (blob.size > MAX_IMAGEM_BYTES) {
    return { ok: false, error: 'Imagem muito grande. Use arquivo de até 10 MB.' };
  }
  const nome =
    typeof File !== 'undefined' && file instanceof File && file.name.trim()
      ? file.name.trim()
      : 'imagem.jpg';
  return { ok: true, blob, nome };
}

function tryAdminClient(): ReturnType<typeof createAdminClient> | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

async function uploadBuffer(
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
  path: string,
  buf: Buffer,
  contentType: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: contentType || 'application/octet-stream',
    upsert: true,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function gravarPathImagemPrincipal(
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>,
  cardId: string,
  path: string,
  nome: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch = {
    imagem_principal_path: path,
    imagem_principal_nome: nome,
    updated_at: new Date().toISOString(),
  };
  const upd = await supabase
    .from('imob_card_modelo')
    .update(patch as never)
    .eq('card_id', cardId)
    .select('card_id');
  if (upd.error) return { ok: false, error: upd.error.message };
  if ((upd.data ?? []).length > 0) return { ok: true };

  const ins = await supabase.from('imob_card_modelo').insert({ card_id: cardId, ...patch } as never);
  if (ins.error) return { ok: false, error: ins.error.message };
  return { ok: true };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  return { ok: true as const, supabase, userId: user.id, isStaff: isRedeStaffRole(normalizeAccessRole(role)) };
}

async function assertCardExiste(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.from('kanban_cards').select('id').eq('id', cardId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Card não encontrado.' };
  return { ok: true };
}

async function produtoModeloLegado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
): Promise<string | null> {
  const { data: card } = await supabase
    .from('kanban_cards')
    .select('processo_step_one_id')
    .eq('id', cardId)
    .maybeSingle();
  const pid = String((card as { processo_step_one_id?: string | null } | null)?.processo_step_one_id ?? '').trim();
  if (!pid) return null;
  const { data: proc } = await supabase
    .from('processo_step_one')
    .select('produto_modelo_casa')
    .eq('id', pid)
    .maybeSingle();
  const v = String((proc as { produto_modelo_casa?: string | null } | null)?.produto_modelo_casa ?? '').trim();
  return v || null;
}

export async function listarImobSimulacoesCard(
  cardId: string,
): Promise<{ ok: true; itens: ImobCardEmpreendimentoDraft[] } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const { data, error } = await auth.supabase
    .from('imob_card_empreendimentos')
    .select('*')
    .eq('card_id', cardId)
    .order('ordem', { ascending: true });
  if (error) {
    if (/imob_card_empreendimentos|schema cache|does not exist/i.test(error.message)) {
      return { ok: true, itens: [] };
    }
    return { ok: false, error: error.message };
  }
  return {
    ok: true,
    itens: (data ?? []).map((r) => rowToImobDraft(mapImobCardEmpreendimentoRow(r as Record<string, unknown>))),
  };
}

export async function salvarImobCardModelo(
  cardId: string,
  draft: ImobCardModeloDraft,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!auth.isStaff) return { ok: false, error: 'Apenas admin/team podem editar Modelo e Simulações IMOB.' };
  const check = await assertCardExiste(auth.supabase, cardId);
  if (!check.ok) return check;

  const patch = { card_id: cardId, ...draftToImobModeloPatch(draft) };
  let { error } = await auth.supabase.from('imob_card_modelo').upsert(patch as never, { onConflict: 'card_id' });

  // Ambientes sem migration 544: grava o restante sem preco_a_partir_de
  if (error && /preco_a_partir_de/i.test(error.message)) {
    const { preco_a_partir_de: _omit, ...semPreco } = patch as Record<string, unknown> & {
      preco_a_partir_de?: unknown;
    };
    const retry = await auth.supabase
      .from('imob_card_modelo')
      .upsert(semPreco as never, { onConflict: 'card_id' });
    error = retry.error;
  }

  if (error) {
    if (/imob_card_modelo|schema cache|does not exist/i.test(error.message)) {
      return { ok: false, error: 'Tabela de modelo ainda não existe neste ambiente. Aplique a migration 541.' };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath('/');
  return { ok: true };
}

export async function criarImobSimulacaoEmpreendimento(
  cardId: string,
  tipo: ImobBlocoTipo = 'empreendimento',
): Promise<{ ok: true; item: ImobCardEmpreendimentoDraft } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!auth.isStaff) return { ok: false, error: 'Apenas admin/team podem editar Modelo e Simulações IMOB.' };
  const check = await assertCardExiste(auth.supabase, cardId);
  if (!check.ok) return check;

  const tipoNorm = normalizeImobBlocoTipo(tipo);

  const { data: maxRowTyped, error: maxErrTyped } = await auth.supabase
    .from('imob_card_empreendimentos')
    .select('ordem')
    .eq('card_id', cardId)
    .eq('tipo', tipoNorm)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();
  let maxRow = maxRowTyped as { ordem?: number } | null;
  if (maxErrTyped && /tipo|schema cache|does not exist/i.test(maxErrTyped.message)) {
    const retry = await auth.supabase
      .from('imob_card_empreendimentos')
      .select('ordem')
      .eq('card_id', cardId)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle();
    maxRow = retry.data as { ordem?: number } | null;
  }
  const ordem = Number(maxRow?.ordem ?? -1) + 1;

  const { count } = await auth.supabase
    .from('imob_card_empreendimentos')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', cardId);
  const seedProduto = (count ?? 0) === 0 ? await produtoModeloLegado(auth.supabase, cardId) : null;

  const { data, error } = await auth.supabase
    .from('imob_card_empreendimentos')
    .insert({
      card_id: cardId,
      ordem,
      tipo: tipoNorm,
      nome: '',
      produto_modelo: seedProduto,
    })
    .select('*')
    .single();
  if (error || !data) {
    const label = tipoNorm === 'showroom' ? 'showroom' : 'empreendimento';
    return { ok: false, error: error?.message ?? `Não foi possível criar o ${label}.` };
  }
  revalidatePath('/');
  return { ok: true, item: rowToImobDraft(mapImobCardEmpreendimentoRow(data as Record<string, unknown>)) };
}

export async function salvarImobSimulacaoEmpreendimento(
  cardId: string,
  draft: ImobCardEmpreendimentoDraft,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!auth.isStaff) return { ok: false, error: 'Apenas admin/team podem editar Modelo e Simulações IMOB.' };
  const check = await assertCardExiste(auth.supabase, cardId);
  if (!check.ok) return check;

  const { error } = await auth.supabase
    .from('imob_card_empreendimentos')
    .update(draftToImobPatch(draft) as never)
    .eq('id', draft.id)
    .eq('card_id', cardId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function excluirImobSimulacaoEmpreendimento(
  cardId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!auth.isStaff) return { ok: false, error: 'Apenas admin/team podem editar Modelo e Simulações IMOB.' };
  const check = await assertCardExiste(auth.supabase, cardId);
  if (!check.ok) return check;

  const { error } = await auth.supabase
    .from('imob_card_empreendimentos')
    .delete()
    .eq('id', id)
    .eq('card_id', cardId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true };
}

export async function uploadImobImagemPrincipal(
  formData: FormData,
): Promise<{ ok: true; path: string; nome: string } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!auth.isStaff) return { ok: false, error: 'Apenas admin/team podem editar Modelo e Simulações IMOB.' };

  const cardId = String(formData.get('cardId') ?? '').trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };
  const check = await assertCardExiste(auth.supabase, cardId);
  if (!check.ok) return check;

  const arquivo = arquivoDoFormData(formData);
  if (!arquivo.ok) return arquivo;

  const safeName = arquivo.nome.replace(/[^\w.\-()+ ]/g, '_').slice(0, 180);
  const path = `${cardId}/imob/principal/${Date.now()}_${safeName}`;
  const buf = Buffer.from(await arquivo.blob.arrayBuffer());
  const contentType = arquivo.blob.type || 'application/octet-stream';

  const admin = tryAdminClient();
  const uploader = admin ?? auth.supabase;
  const up = await uploadBuffer(uploader, path, buf, contentType);
  if (!up.ok) {
    if (admin) {
      const fallback = await uploadBuffer(auth.supabase, path, buf, contentType);
      if (!fallback.ok) return fallback;
    } else {
      return up;
    }
  }

  const nome = arquivo.nome.slice(0, 180);
  const writer = admin ?? auth.supabase;
  const saved = await gravarPathImagemPrincipal(writer, cardId, path, nome);
  if (!saved.ok && admin) {
    const retry = await gravarPathImagemPrincipal(auth.supabase, cardId, path, nome);
    if (!retry.ok) return retry;
  } else if (!saved.ok) {
    return saved;
  }

  revalidatePath('/');
  return { ok: true, path, nome };
}

export async function uploadImobImagemOferta(
  formData: FormData,
): Promise<{ ok: true; path: string; nome: string } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!auth.isStaff) return { ok: false, error: 'Apenas admin/team podem editar Modelo e Simulações IMOB.' };

  const cardId = String(formData.get('cardId') ?? '').trim();
  const empreendimentoId = String(formData.get('empreendimentoId') ?? '').trim();
  if (!cardId || !empreendimentoId) return { ok: false, error: 'Card ou empreendimento inválido.' };
  const check = await assertCardExiste(auth.supabase, cardId);
  if (!check.ok) return check;

  const arquivo = arquivoDoFormData(formData);
  if (!arquivo.ok) return arquivo;

  const safeName = arquivo.nome.replace(/[^\w.\-()+ ]/g, '_').slice(0, 180);
  const path = `${cardId}/imob/oferta/${empreendimentoId}/${Date.now()}_${safeName}`;
  const buf = Buffer.from(await arquivo.blob.arrayBuffer());
  const contentType = arquivo.blob.type || 'application/octet-stream';

  const admin = tryAdminClient();
  const uploader = admin ?? auth.supabase;
  const up = await uploadBuffer(uploader, path, buf, contentType);
  if (!up.ok) {
    if (admin) {
      const fallback = await uploadBuffer(auth.supabase, path, buf, contentType);
      if (!fallback.ok) return fallback;
    } else {
      return up;
    }
  }

  const nome = arquivo.nome.slice(0, 180);
  const patch = {
    imagem_oferta_path: path,
    imagem_oferta_nome: nome,
    updated_at: new Date().toISOString(),
  };
  const writer = admin ?? auth.supabase;
  let { error } = await writer
    .from('imob_card_empreendimentos')
    .update(patch as never)
    .eq('id', empreendimentoId)
    .eq('card_id', cardId);
  if (error && admin) {
    const retry = await auth.supabase
      .from('imob_card_empreendimentos')
      .update(patch as never)
      .eq('id', empreendimentoId)
      .eq('card_id', cardId);
    error = retry.error;
  }
  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true, path, nome };
}

export async function urlAssinadaImobAnexo(
  storagePath: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const p = String(storagePath ?? '').trim();
  if (!p) return { ok: false, error: 'Caminho inválido.' };

  const viaUser = await auth.supabase.storage.from(BUCKET).createSignedUrl(p, 3600);
  if (!viaUser.error && viaUser.data?.signedUrl) {
    return { ok: true, url: viaUser.data.signedUrl };
  }

  try {
    const admin = createAdminClient();
    const viaAdmin = await admin.storage.from(BUCKET).createSignedUrl(p, 3600);
    if (viaAdmin.error || !viaAdmin.data?.signedUrl) {
      return { ok: false, error: viaAdmin.error?.message ?? viaUser.error?.message ?? 'Erro ao gerar URL.' };
    }
    return { ok: true, url: viaAdmin.data.signedUrl };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : viaUser.error?.message ?? 'Erro ao gerar URL.',
    };
  }
}
