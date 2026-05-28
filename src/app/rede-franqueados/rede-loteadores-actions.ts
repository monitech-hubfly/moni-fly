'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import type { RedeLoteadorPatch, RedeLoteadorStatus } from '@/lib/rede-loteadores';

type Ok = { ok: true; mensagem: string; id?: string };
type Err = { ok: false; error: string };

async function requireRedeLoteadoresStaff(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
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
    return { ok: false, error: 'Apenas administradores ou time podem gerir loteadores.' };
  }
  return { ok: true, supabase, userId: user.id };
}

function cleanPatch(patch: RedeLoteadorPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const set = (k: keyof RedeLoteadorPatch, v: string | null | undefined) => {
    if (v === undefined) return;
    out[k] = v === '' ? null : v;
  };
  set('nome', patch.nome);
  set('cnpj', patch.cnpj);
  set('cidade', patch.cidade);
  set('estado', patch.estado);
  set('contato_nome', patch.contato_nome);
  set('contato_telefone', patch.contato_telefone);
  set('contato_email', patch.contato_email);
  set('portfolio_descricao', patch.portfolio_descricao);
  if (patch.status !== undefined) out.status = patch.status;
  set('observacoes', patch.observacoes);
  return out;
}

const STATUS_VALUES: RedeLoteadorStatus[] = ['ativo', 'inativo', 'em_analise'];

export async function criarRedeLoteador(patch: RedeLoteadorPatch): Promise<Ok | Err> {
  const gate = await requireRedeLoteadoresStaff();
  if (!gate.ok) return gate;
  const nome = String(patch.nome ?? '').trim();
  if (!nome) return { ok: false, error: 'Informe o nome do loteador.' };

  const row = cleanPatch({ ...patch, nome });
  if (patch.status && !STATUS_VALUES.includes(patch.status)) {
    return { ok: false, error: 'Status inválido.' };
  }

  const { data, error } = await gate.supabase
    .from('rede_loteadores')
    .insert({ ...row, criado_por: gate.userId, updated_at: new Date().toISOString() } as never)
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/rede-franqueados');
  return { ok: true, mensagem: 'Loteador cadastrado.', id: String(data?.id ?? '') };
}

export async function atualizarRedeLoteador(id: string, patch: RedeLoteadorPatch): Promise<Ok | Err> {
  const gate = await requireRedeLoteadoresStaff();
  if (!gate.ok) return gate;
  if (!id) return { ok: false, error: 'ID inválido.' };

  const row = cleanPatch(patch);
  if (patch.nome !== undefined && !String(patch.nome).trim()) {
    return { ok: false, error: 'Informe o nome do loteador.' };
  }
  if (patch.status && !STATUS_VALUES.includes(patch.status)) {
    return { ok: false, error: 'Status inválido.' };
  }
  if (Object.keys(row).length === 0) return { ok: false, error: 'Nada para atualizar.' };

  row.updated_at = new Date().toISOString();

  const { error } = await gate.supabase.from('rede_loteadores').update(row as never).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/rede-franqueados');
  return { ok: true, mensagem: 'Loteador atualizado.' };
}

export async function arquivarRedeLoteador(id: string): Promise<Ok | Err> {
  return atualizarRedeLoteador(id, { status: 'inativo' });
}
