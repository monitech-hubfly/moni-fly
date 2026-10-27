'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRedeStaffRole, normalizeAccessRole } from '@/lib/authz';
import {
  draftToImobModeloPatch,
  draftToImobPatch,
  mapImobCardEmpreendimentoRow,
  normalizeImobBlocoTipo,
  rowToImobDraft,
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

export async function salvarValorBaseCasa(
  ofertaId: string,
  cardId: string,
  valor: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!auth.isStaff) return { ok: false, error: 'Apenas admin/team podem editar Modelo e Simulações IMOB.' };
  const id = String(ofertaId ?? '').trim();
  const cid = String(cardId ?? '').trim();
  const n = Math.round(Number(valor) * 100) / 100;
  if (!id || !cid) return { ok: false, error: 'Oferta inválida.' };
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: 'Informe o valor base da casa.' };
  }
  const check = await assertCardExiste(auth.supabase, cid);
  if (!check.ok) return check;

  const { data, error } = await auth.supabase
    .from('imob_card_empreendimentos')
    .update({ valor_base_casa: n } as never)
    .eq('id', id)
    .eq('card_id', cid)
    .select('id, valor_base_casa');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) {
    return { ok: false, error: 'Não foi possível salvar o valor da casa.' };
  }
  return { ok: true };
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

  const patch = draftToImobPatch(draft);
  if (normalizeImobBlocoTipo(draft.tipo) !== 'showroom') {
    const base = Number(patch.valor_base_casa);
    if (!Number.isFinite(base) || base <= 0) {
      return {
        ok: false,
        error: 'Informe o valor base da casa (custo de construção, antes do markup).',
      };
    }
  }

  let supabase: ReturnType<typeof createAdminClient>;
  try {
    supabase = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Admin client indisponível para salvar a oferta.',
    };
  }

  console.error('[DEBUG-SAVE] patch completo:', JSON.stringify(patch, null, 2));
  const { data, error, count } = await supabase
    .from('imob_card_empreendimentos')
    .update(patch as never, { count: 'exact' })
    .eq('id', draft.id)
    .eq('card_id', cardId)
    .select('valor_base_casa');
  console.error('[UPDATE-RESULT]', { data, error, count });
  if (error) {
    const errText = [error.code, error.message, error.details, error.hint].filter(Boolean).join(' ');
    // PGRST204 / 42703 / schema cache desta coluna: não omitir o campo nem fingir sucesso.
    if (/valor_base_casa/i.test(errText)) {
      return { ok: false, error: 'Erro ao salvar valor da casa. Tente novamente.' };
    }
    if (/valor_acoplamento/i.test(error.message)) {
      const { valor_acoplamento, ...sem571 } = patch;
      void valor_acoplamento;
      const retry = await supabase
        .from('imob_card_empreendimentos')
        .update(sem571 as never)
        .eq('id', draft.id)
        .eq('card_id', cardId);
      if (retry.error) return { ok: false, error: retry.error.message };
      revalidatePath('/');
      return { ok: true };
    }
    if (/parcela_unica|simulacao_pagamento_id|schema cache|does not exist/i.test(error.message)) {
      const { parcela_unica, simulacao_pagamento_id, ...sem550 } = patch;
      void parcela_unica;
      void simulacao_pagamento_id;
      if (normalizeImobBlocoTipo(draft.tipo) !== 'showroom') {
        sem550.valor_base_casa = patch.valor_base_casa;
      }
      const retry = await supabase
        .from('imob_card_empreendimentos')
        .update(sem550 as never)
        .eq('id', draft.id)
        .eq('card_id', cardId);
      if (retry.error) {
        const retryText = [retry.error.code, retry.error.message, retry.error.details, retry.error.hint]
          .filter(Boolean)
          .join(' ');
        if (/valor_base_casa/i.test(retryText)) {
          return { ok: false, error: 'Erro ao salvar valor da casa. Tente novamente.' };
        }
        return { ok: false, error: retry.error.message };
      }
      revalidatePath('/');
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath('/');
  return { ok: true };
}

export async function vincularOfertaAoEmpreendimentoImob(
  cardId: string,
  empreendimentoId: string,
  valores: {
    simulacao_pagamento_id: string;
    valor_avista: number | null;
    entrada: number | null;
    parcelas_mensais: number | null;
    parcela_unica: number | null;
    prazo_total_meses: number | null;
    valor_acoplamento?: number | null;
    valor_base_casa?: number | null;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!auth.isStaff) return { ok: false, error: 'Apenas admin/team podem editar Modelo e Simulações IMOB.' };
  const check = await assertCardExiste(auth.supabase, cardId);
  if (!check.ok) return check;

  const payload = {
    simulacao_pagamento_id: valores.simulacao_pagamento_id,
    valor_avista: valores.valor_avista,
    entrada: valores.entrada,
    parcelas_mensais: valores.parcelas_mensais,
    prazo_total_meses: valores.prazo_total_meses,
    parcela_unica: valores.parcela_unica,
    valor_acoplamento: valores.valor_acoplamento ?? null,
    valor_base_casa: valores.valor_base_casa ?? 0,
    updated_at: new Date().toISOString(),
  };
  let { error } = await auth.supabase
    .from('imob_card_empreendimentos')
    .update(payload as never)
    .eq('id', empreendimentoId)
    .eq('card_id', cardId)
    .eq('tipo', 'empreendimento');
  if (error && /valor_base_casa/i.test(error.message)) {
    const { valor_base_casa: _omit, ...sem573 } = payload;
    void _omit;
    const retry573 = await auth.supabase
      .from('imob_card_empreendimentos')
      .update(sem573 as never)
      .eq('id', empreendimentoId)
      .eq('card_id', cardId)
      .eq('tipo', 'empreendimento');
    if (!retry573.error) {
      revalidatePath('/');
      revalidatePath('/hub-funis');
      revalidatePath('/loteadores');
      revalidatePath(`/loteadores/${cardId}/simulador-template/ofertas`);
      return { ok: true };
    }
    error = retry573.error;
  }
  if (error) {
    if (/valor_acoplamento/i.test(error.message)) {
      const { error: retryAcopl } = await auth.supabase
        .from('imob_card_empreendimentos')
        .update({
          simulacao_pagamento_id: valores.simulacao_pagamento_id,
          valor_avista: valores.valor_avista,
          entrada: valores.entrada,
          parcelas_mensais: valores.parcelas_mensais,
          prazo_total_meses: valores.prazo_total_meses,
          parcela_unica: valores.parcela_unica,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', empreendimentoId)
        .eq('card_id', cardId)
        .eq('tipo', 'empreendimento');
      if (retryAcopl) {
        if (/prazo_total_meses/i.test(retryAcopl.message)) {
          // cai no retry abaixo sem acoplamento
        } else if (/parcela_unica|simulacao_pagamento_id|schema cache|does not exist/i.test(retryAcopl.message)) {
          return {
            ok: false,
            error: 'Falta a migration 550 (parcela_unica / vínculo da oferta) neste banco.',
          };
        } else {
          return { ok: false, error: retryAcopl.message };
        }
      } else {
        revalidatePath('/');
        revalidatePath('/hub-funis');
        revalidatePath('/loteadores');
        revalidatePath(`/loteadores/${cardId}/simulador-template/ofertas`);
        return { ok: true };
      }
    }
    if (/prazo_total_meses/i.test(error.message)) {
      const { error: retryErr } = await auth.supabase
        .from('imob_card_empreendimentos')
        .update({
          simulacao_pagamento_id: valores.simulacao_pagamento_id,
          valor_avista: valores.valor_avista,
          entrada: valores.entrada,
          parcelas_mensais: valores.parcelas_mensais,
          parcela_unica: valores.parcela_unica,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', empreendimentoId)
        .eq('card_id', cardId)
        .eq('tipo', 'empreendimento');
      if (retryErr) {
        if (/parcela_unica|simulacao_pagamento_id|schema cache|does not exist/i.test(retryErr.message)) {
          return {
            ok: false,
            error: 'Falta a migration 550 (parcela_unica / vínculo da oferta) neste banco.',
          };
        }
        return { ok: false, error: retryErr.message };
      }
      revalidatePath('/');
      revalidatePath('/hub-funis');
      revalidatePath('/loteadores');
      revalidatePath(`/loteadores/${cardId}/simulador-template/ofertas`);
      return { ok: true };
    }
    if (/parcela_unica|simulacao_pagamento_id|schema cache|does not exist/i.test(error.message)) {
      return {
        ok: false,
        error: 'Falta a migration 550 (parcela_unica / vínculo da oferta) neste banco.',
      };
    }
    return { ok: false, error: error.message };
  }
  revalidatePath('/');
  revalidatePath('/hub-funis');
  revalidatePath('/loteadores');
  revalidatePath(`/loteadores/${cardId}/simulador-template/ofertas`);
  return { ok: true };
}

async function revalidateJornadaDoCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
) {
  revalidatePath('/');
  revalidatePath('/hub-funis');
  revalidatePath('/loteadores');
  revalidatePath(`/loteadores/${cardId}/simulador-template/ofertas`);
  const { data } = await supabase
    .from('imob_card_modelo')
    .select('page_slug')
    .eq('card_id', cardId)
    .maybeSingle();
  const slug = String((data as { page_slug?: string | null } | null)?.page_slug ?? '').trim();
  if (slug) revalidatePath(`/empreendimento/${slug}`);
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

  const { data: alvo, error: errAlvo } = await auth.supabase
    .from('imob_card_empreendimentos')
    .select('id, simulacao_pagamento_id')
    .eq('id', id)
    .eq('card_id', cardId)
    .maybeSingle();
  if (errAlvo) return { ok: false, error: errAlvo.message };

  const simVinculada = String(
    (alvo as { simulacao_pagamento_id?: string | null } | null)?.simulacao_pagamento_id ?? '',
  ).trim();

  const { data: sims, error: errSims } = await auth.supabase
    .from('simulacoes_pagamento')
    .select('id, inputs')
    .eq('kanban_card_id', cardId)
    .not('nome', 'is', null);
  if (errSims) return { ok: false, error: errSims.message };

  const ids = new Set<string>();
  if (simVinculada) ids.add(simVinculada);
  for (const row of (sims ?? []) as Array<{ id?: string; inputs?: unknown }>) {
    const sid = String(row.id ?? '').trim();
    if (!sid) continue;
    const inputs =
      row.inputs && typeof row.inputs === 'object' && !Array.isArray(row.inputs)
        ? (row.inputs as Record<string, unknown>)
        : {};
    if (String(inputs.empreendimento_id ?? '').trim() === id) ids.add(sid);
  }

  if (ids.size > 0) {
    const { error: errDelSims } = await auth.supabase
      .from('simulacoes_pagamento')
      .delete()
      .in('id', [...ids])
      .eq('kanban_card_id', cardId);
    if (errDelSims) return { ok: false, error: errDelSims.message };
  }

  const { error } = await auth.supabase
    .from('imob_card_empreendimentos')
    .delete()
    .eq('id', id)
    .eq('card_id', cardId);
  if (error) return { ok: false, error: error.message };
  await revalidateJornadaDoCard(auth.supabase, cardId);
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
