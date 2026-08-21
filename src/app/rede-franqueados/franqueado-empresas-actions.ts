'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import { isFranquiaCasaMoniFk0000 } from '@/lib/franquia-casa-moni-fk0000';
import {
  isFranqueadoEmpresaExtraAnexoDocTipo,
  slotEmpresaExtraPorTipo,
} from '@/lib/rede-documentos-empresa-extra';
import type {
  FranqueadoEmpresaTipo,
  FranqueadoEmpresaUpsertDados,
  FranqueadoEmpresaStatus,
} from '@/lib/franqueado-empresas';

type Ok = { ok: true; mensagem: string };
type Err = { ok: false; error: string };

async function requireFranqueadoEmpresasStaff(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const access = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (access !== 'admin' && access !== 'team') {
    return { ok: false, error: 'Apenas administradores ou time podem editar cadastros de empresa.' };
  }
  return { ok: true, supabase };
}

const STATUS_VALUES: FranqueadoEmpresaStatus[] = ['ativa', 'inativa', 'em_abertura'];

function cleanDados(dados: FranqueadoEmpresaUpsertDados): Record<string, unknown> {
  const out: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const set = (k: keyof FranqueadoEmpresaUpsertDados, v: string | null | undefined) => {
    if (v === undefined) return;
    out[k] = v === '' ? null : v;
  };
  set('razao_social', dados.razao_social);
  set('cnpj', dados.cnpj);
  set('inscricao_municipal', dados.inscricao_municipal);
  set('inscricao_estadual', dados.inscricao_estadual);
  if (dados.status !== undefined) {
    if (!STATUS_VALUES.includes(dados.status)) throw new Error('Status inválido.');
    out.status = dados.status;
  }
  set('conta_banco', dados.conta_banco);
  set('conta_agencia', dados.conta_agencia);
  set('conta_numero', dados.conta_numero);
  set('conta_tipo', dados.conta_tipo);
  set('conta_pix_tipo', dados.conta_pix_tipo);
  set('conta_pix_chave', dados.conta_pix_chave);
  return out;
}

async function assertFranquiaCasaMoniFk0000(
  supabase: Awaited<ReturnType<typeof createClient>>,
  redeFranqueadoId: string,
): Promise<Ok | Err> {
  const { data, error } = await supabase
    .from('rede_franqueados')
    .select('n_franquia')
    .eq('id', redeFranqueadoId.trim())
    .maybeSingle();
  if (error || !data) return { ok: false, error: 'Franqueado não encontrado.' };
  if (!isFranquiaCasaMoniFk0000((data as { n_franquia?: string | null }).n_franquia)) {
    return { ok: false, error: 'Disponível apenas para a franquia FK0000 (Casa Moní).' };
  }
  return { ok: true, mensagem: '' };
}

async function upsertEmpresaPorRedeETipo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  redeId: string,
  tipo: FranqueadoEmpresaTipo,
  patch: Record<string, unknown>,
): Promise<Err | null> {
  const { data: existing } = await supabase
    .from('franqueado_empresas')
    .select('id')
    .eq('rede_franqueado_id', redeId)
    .eq('tipo', tipo)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('franqueado_empresas')
      .update(patch as never)
      .eq('id', (existing as { id: string }).id);
    return error ? { ok: false, error: error.message } : null;
  }

  const { error } = await supabase.from('franqueado_empresas').insert({
    rede_franqueado_id: redeId,
    tipo,
    ...patch,
  } as never);
  return error ? { ok: false, error: error.message } : null;
}

/** Cria ou atualiza linha em `franqueado_empresas` (incorporadora/gestora — uma de cada por rede). */
export async function upsertFranqueadoEmpresa(
  redeFranqueadoId: string,
  tipo: FranqueadoEmpresaTipo,
  dados: FranqueadoEmpresaUpsertDados,
): Promise<Ok | Err> {
  const gate = await requireFranqueadoEmpresasStaff();
  if (!gate.ok) return gate;

  const redeId = String(redeFranqueadoId ?? '').trim();
  if (!redeId) return { ok: false, error: 'Franqueado inválido.' };
  if (tipo !== 'incorporadora' && tipo !== 'gestora') {
    return { ok: false, error: 'Tipo de empresa inválido.' };
  }

  let row: Record<string, unknown>;
  try {
    row = cleanDados(dados);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Dados inválidos.' };
  }

  const err = await upsertEmpresaPorRedeETipo(gate.supabase, redeId, tipo, row);
  if (err) {
    if (/franqueado_empresas|schema cache|relation/i.test(err.error ?? '')) {
      return {
        ok: false,
        error:
          'Tabela franqueado_empresas ainda não existe no banco. Execute a migration 207 no Supabase.',
      };
    }
    return err;
  }

  revalidatePath('/rede-franqueados');
  revalidatePath(`/rede-franqueados/${redeId}`);
  const label = tipo === 'incorporadora' ? 'Incorporadora' : 'Gestora';
  return { ok: true, mensagem: `Cadastro ${label} salvo.` };
}

type OkComId = { ok: true; mensagem: string; empresaId?: string };

/** Cria empresa adicional (tipo `empresa`) — somente FK0000. */
export async function criarFranqueadoEmpresaExtra(
  redeFranqueadoId: string,
  nome?: string | null,
): Promise<OkComId | Err> {
  const gate = await requireFranqueadoEmpresasStaff();
  if (!gate.ok) return gate;

  const redeId = redeFranqueadoId.trim();
  if (!redeId) return { ok: false, error: 'Franqueado inválido.' };

  const fk = await assertFranquiaCasaMoniFk0000(gate.supabase, redeId);
  if (!fk.ok) return fk;

  const { data, error } = await gate.supabase
    .from('franqueado_empresas')
    .insert({
      rede_franqueado_id: redeId,
      tipo: 'empresa',
      nome: nome?.trim() || null,
      status: 'em_abertura',
    } as never)
    .select('id')
    .single();

  if (error) {
    return {
      ok: false,
      error: /franqueado_empresas|schema cache|relation|tipo_check/i.test(error.message ?? '')
        ? 'Migration 333 pendente: tipo empresa em franqueado_empresas.'
        : error.message,
    };
  }

  revalidatePath('/rede-franqueados');
  revalidatePath(`/rede-franqueados/${redeId}`);
  return { ok: true, mensagem: 'Empresa criada.', empresaId: String((data as { id: string }).id) };
}

export type FranqueadoEmpresaExtraUpsertDados = FranqueadoEmpresaUpsertDados & {
  nome?: string | null;
};

/** Atualiza cadastro de empresa adicional (tipo `empresa`) — somente FK0000. */
export async function upsertFranqueadoEmpresaExtra(
  empresaId: string,
  dados: FranqueadoEmpresaExtraUpsertDados,
): Promise<Ok | Err> {
  const gate = await requireFranqueadoEmpresasStaff();
  if (!gate.ok) return gate;

  const id = empresaId.trim();
  if (!id) return { ok: false, error: 'Empresa inválida.' };

  const { data: atual, error: leErr } = await gate.supabase
    .from('franqueado_empresas')
    .select('rede_franqueado_id, tipo')
    .eq('id', id)
    .maybeSingle();
  if (leErr || !atual) return { ok: false, error: 'Empresa não encontrada.' };
  if ((atual as { tipo: string }).tipo !== 'empresa') {
    return { ok: false, error: 'Somente empresas adicionais podem ser editadas aqui.' };
  }

  const redeId = String((atual as { rede_franqueado_id: string }).rede_franqueado_id);
  const fk = await assertFranquiaCasaMoniFk0000(gate.supabase, redeId);
  if (!fk.ok) return fk;

  let patch: Record<string, unknown>;
  try {
    patch = cleanDados(dados);
    if (dados.nome !== undefined) {
      patch.nome = dados.nome === '' ? null : dados.nome;
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Dados inválidos.' };
  }

  const { error } = await gate.supabase.from('franqueado_empresas').update(patch as never).eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/rede-franqueados');
  revalidatePath(`/rede-franqueados/${redeId}`);
  return { ok: true, mensagem: 'Empresa salva.' };
}

const MAX_DOC_BYTES = 10 * 1024 * 1024;

function sanitizeNomeArquivo(nome: string): string {
  return nome.replace(/[^\w.\-() ]+/g, '_').slice(0, 120);
}

function revalidateEmpresaExtraPaths(redeId: string) {
  revalidatePath('/rede-franqueados');
  revalidatePath(`/rede-franqueados/${redeId}`);
}

/** Upload de documento de empresa adicional (tipo `empresa`). */
export async function uploadFranqueadoEmpresaExtraDoc(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const empresaId = String(formData.get('empresaId') ?? '').trim();
  const tipoRaw = String(formData.get('tipo') ?? '').trim();
  const file = formData.get('file');
  if (!empresaId) return { ok: false, error: 'Empresa inválida.' };
  if (!isFranqueadoEmpresaExtraAnexoDocTipo(tipoRaw)) return { ok: false, error: 'Tipo inválido.' };
  if (!(file instanceof File)) return { ok: false, error: 'Arquivo inválido.' };
  if (file.size > MAX_DOC_BYTES) return { ok: false, error: 'Arquivo acima de 10 MB.' };

  const gate = await requireFranqueadoEmpresasStaff();
  if (!gate.ok) return gate;

  const slot = slotEmpresaExtraPorTipo(tipoRaw);
  if (!slot) return { ok: false, error: 'Tipo inválido.' };

  const { data: atual, error: leErr } = await gate.supabase
    .from('franqueado_empresas')
    .select('*')
    .eq('id', empresaId)
    .maybeSingle();
  if (leErr || !atual) return { ok: false, error: 'Empresa não encontrada.' };
  if ((atual as { tipo: string }).tipo !== 'empresa') {
    return { ok: false, error: 'Somente empresas adicionais aceitam estes anexos.' };
  }

  const redeId = String((atual as { rede_franqueado_id: string }).rede_franqueado_id);
  const fk = await assertFranquiaCasaMoniFk0000(gate.supabase, redeId);
  if (!fk.ok) return fk;

  const orig = sanitizeNomeArquivo(file.name || 'arquivo');
  const storagePath = `rede/${redeId}/empresa-extra/${empresaId}/${tipoRaw}-${randomUUID()}-${orig}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await gate.supabase.storage.from('rede-attachments').upload(storagePath, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const oldPath = String((atual as Record<string, unknown>)[slot.pathKey] ?? '').trim() || null;
  const patch: Record<string, unknown> = {
    [slot.pathKey]: storagePath,
    updated_at: new Date().toISOString(),
  };
  if (slot.justificativaKey) patch[slot.justificativaKey] = null;

  const { error } = await gate.supabase.from('franqueado_empresas').update(patch as never).eq('id', empresaId);
  if (error) {
    await gate.supabase.storage.from('rede-attachments').remove([storagePath]);
    return { ok: false, error: error.message };
  }
  if (oldPath) await gate.supabase.storage.from('rede-attachments').remove([oldPath]);

  revalidateEmpresaExtraPaths(redeId);
  return { ok: true };
}

/** Justificativa de ausência de documento de empresa adicional. */
export async function salvarJustificativaEmpresaExtraDoc(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const empresaId = String(formData.get('empresaId') ?? '').trim();
  const tipoRaw = String(formData.get('tipo') ?? '').trim();
  const justificativa = String(formData.get('justificativa') ?? '').trim();
  if (!empresaId) return { ok: false, error: 'Empresa inválida.' };
  if (!isFranqueadoEmpresaExtraAnexoDocTipo(tipoRaw)) return { ok: false, error: 'Tipo inválido.' };
  const slot = slotEmpresaExtraPorTipo(tipoRaw);
  if (!slot?.justificativaKey) {
    return { ok: false, error: 'Este documento não aceita justificativa.' };
  }
  if (!justificativa) return { ok: false, error: 'Informe a justificativa.' };

  const gate = await requireFranqueadoEmpresasStaff();
  if (!gate.ok) return gate;

  const { data: atual } = await gate.supabase
    .from('franqueado_empresas')
    .select('*')
    .eq('id', empresaId)
    .maybeSingle();
  if (!atual) return { ok: false, error: 'Empresa não encontrada.' };
  if ((atual as { tipo: string }).tipo !== 'empresa') {
    return { ok: false, error: 'Somente empresas adicionais aceitam estes anexos.' };
  }

  const redeId = String((atual as { rede_franqueado_id: string }).rede_franqueado_id);
  const pathAtual = String((atual as Record<string, unknown>)[slot.pathKey] ?? '').trim();
  if (pathAtual) {
    return { ok: false, error: 'Já existe arquivo anexado; remova ou substitua o anexo antes de usar justificativa.' };
  }

  const { error } = await gate.supabase
    .from('franqueado_empresas')
    .update({
      [slot.justificativaKey]: justificativa,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', empresaId);
  if (error) return { ok: false, error: error.message };

  revalidateEmpresaExtraPaths(redeId);
  return { ok: true };
}
