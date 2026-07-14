'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import { getNextCodigoLoteador } from '@/lib/next-codigo-loteador';
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
  const setInt = (k: keyof RedeLoteadorPatch, v: number | null | undefined) => {
    if (v === undefined) return;
    out[k] = v;
  };

  set('nome', patch.nome);
  set('cnpj', patch.cnpj);
  set('cidade', patch.cidade);
  set('estado', patch.estado);
  set('condominio_estado', patch.condominio_estado);
  set('contato_nome', patch.contato_nome);
  set('contato_telefone', patch.contato_telefone);
  set('contato_email', patch.contato_email);
  set('portfolio_descricao', patch.portfolio_descricao);
  if (patch.status !== undefined) out.status = patch.status;
  set('observacoes', patch.observacoes);

  set('interlocutor_nome', patch.interlocutor_nome);
  set('interlocutor_cargo', patch.interlocutor_cargo);
  set('interlocutor_telefone', patch.interlocutor_telefone);
  set('interlocutor_email', patch.interlocutor_email);

  set('condominio_nome', patch.condominio_nome);
  set('condominio_data_lancamento', patch.condominio_data_lancamento);
  set('condominio_cidade', patch.condominio_cidade);
  setInt('condominio_qtd_lotes', patch.condominio_qtd_lotes);
  set('condominio_preco_lotes', patch.condominio_preco_lotes);
  set('condominio_metragem_lotes', patch.condominio_metragem_lotes);
  set('condominio_preco_casas', patch.condominio_preco_casas);
  set('condominio_metragem_casas', patch.condominio_metragem_casas);
  set('anexo_planta_cadastral', patch.anexo_planta_cadastral);
  set('anexo_manual_obras', patch.anexo_manual_obras);
  set('anexo_casas_concorrentes', patch.anexo_casas_concorrentes);

  setInt('carteira_lotes_disponiveis', patch.carteira_lotes_disponiveis);
  setInt('carteira_lotes_vendidos_quitados', patch.carteira_lotes_vendidos_quitados);
  setInt('carteira_carteira_curta_qtd', patch.carteira_carteira_curta_qtd);
  set('carteira_curta_financiamento', patch.carteira_curta_financiamento);
  setInt('carteira_longa_qtd', patch.carteira_longa_qtd);
  set('carteira_longa_financiamento', patch.carteira_longa_financiamento);
  set('anexo_tabela_precos', patch.anexo_tabela_precos);

  set('campo_livre', patch.campo_livre);
  set('anexo_material_extra', patch.anexo_material_extra);

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

  const codigo = await getNextCodigoLoteador(gate.supabase);

  const { data, error } = await gate.supabase
    .from('rede_loteadores')
    .insert({ ...row, codigo, criado_por: gate.userId, updated_at: new Date().toISOString() } as never)
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
  row.ultima_atualizacao_por = gate.userId;

  const { error } = await gate.supabase.from('rede_loteadores').update(row as never).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/rede-franqueados');
  return { ok: true, mensagem: 'Loteador atualizado.' };
}

export async function arquivarRedeLoteador(id: string): Promise<Ok | Err> {
  return atualizarRedeLoteador(id, { status: 'inativo' });
}
