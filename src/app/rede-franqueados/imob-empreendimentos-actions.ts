'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import type { ImobEmpreendimentoPatch } from '@/lib/imob-empreendimentos';

type Ok = { ok: true; mensagem: string; id?: string };
type Err = { ok: false; error: string };

async function requireImobStaff(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const access = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (access !== 'admin' && access !== 'team') {
    return { ok: false, error: 'Apenas administradores ou time podem gerir empreendimentos.' };
  }
  return { ok: true, supabase, userId: user.id };
}

function slugify(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function criarImobEmpreendimento(patch: ImobEmpreendimentoPatch): Promise<Ok | Err> {
  const gate = await requireImobStaff();
  if (!gate.ok) return gate;

  const nome = String(patch.nome ?? '').trim();
  if (!nome) return { ok: false, error: 'Informe o nome do empreendimento.' };

  const slug = patch.slug ?? slugify(nome);

  const row = {
    nome,
    slug,
    specs: patch.specs ?? null,
    ativo: patch.ativo ?? true,
    imagem_url: patch.imagem_url ?? null,
    card_id: patch.card_id ?? null,
    condominio_id: patch.condominio_id ?? null,
  };

  const { data, error } = await gate.supabase
    .from('imob_empreendimentos')
    .insert(row)
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath('/rede-franqueados');
  return { ok: true, mensagem: `Empreendimento "${nome}" cadastrado.`, id: (data as { id: string }).id };
}

export async function atualizarImobEmpreendimento(
  id: string,
  patch: ImobEmpreendimentoPatch,
): Promise<Ok | Err> {
  const gate = await requireImobStaff();
  if (!gate.ok) return gate;
  if (!id) return { ok: false, error: 'ID inválido.' };

  const row: Record<string, unknown> = {};
  if (patch.nome !== undefined) {
    const nome = String(patch.nome ?? '').trim();
    if (!nome) return { ok: false, error: 'Informe o nome do empreendimento.' };
    row.nome = nome;
    if (!patch.slug) row.slug = slugify(nome);
  }
  if (patch.slug !== undefined) row.slug = patch.slug;
  if (patch.specs !== undefined) row.specs = patch.specs;
  if (patch.ativo !== undefined) row.ativo = patch.ativo;
  if (patch.imagem_url !== undefined) row.imagem_url = patch.imagem_url;
  if (patch.card_id !== undefined) row.card_id = patch.card_id;
  if (patch.condominio_id !== undefined) row.condominio_id = patch.condominio_id;

  if (Object.keys(row).length === 0) return { ok: false, error: 'Nada para atualizar.' };

  const { error } = await gate.supabase
    .from('imob_empreendimentos')
    .update(row)
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/rede-franqueados');
  return { ok: true, mensagem: 'Empreendimento atualizado.' };
}

export async function arquivarImobEmpreendimento(id: string): Promise<Ok | Err> {
  return atualizarImobEmpreendimento(id, { ativo: false });
}

export async function reativarImobEmpreendimento(id: string): Promise<Ok | Err> {
  return atualizarImobEmpreendimento(id, { ativo: true });
}

/** Vincula um corretor a um empreendimento. */
export async function vincularCorretorEmpreendimento(
  corretorId: string,
  empreendimentoId: string,
): Promise<Ok | Err> {
  const gate = await requireImobStaff();
  if (!gate.ok) return gate;

  const { error } = await gate.supabase
    .from('imob_corretor_empreendimentos')
    .upsert({ corretor_id: corretorId, empreendimento_id: empreendimentoId });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/rede-franqueados');
  return { ok: true, mensagem: 'Corretor vinculado.' };
}

/** Remove vínculo corretor ↔ empreendimento. */
export async function desvincularCorretorEmpreendimento(
  corretorId: string,
  empreendimentoId: string,
): Promise<Ok | Err> {
  const gate = await requireImobStaff();
  if (!gate.ok) return gate;

  const { error } = await gate.supabase
    .from('imob_corretor_empreendimentos')
    .delete()
    .eq('corretor_id', corretorId)
    .eq('empreendimento_id', empreendimentoId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/rede-franqueados');
  return { ok: true, mensagem: 'Vínculo removido.' };
}

/** Retorna os corretores vinculados a um empreendimento. */
export async function fetchCorretoresDoEmpreendimento(
  empreendimentoId: string,
): Promise<Array<{ corretor_id: string; nome: string | null }> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imob_corretor_empreendimentos')
    .select('corretor_id, rede_corretores(id, nome)')
    .eq('empreendimento_id', empreendimentoId);

  if (error) return null;

  return (data ?? []).map((d: unknown) => {
    const item = d as { corretor_id?: string; rede_corretores?: { nome?: string } | null };
    return {
      corretor_id: String(item.corretor_id ?? ''),
      nome: item.rede_corretores?.nome ?? null,
    };
  });
}
