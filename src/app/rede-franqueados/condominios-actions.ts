'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import type { CondominioPatch } from '@/lib/condominios';
import { condominioNomeJaExiste } from '@/lib/condominios';

type Ok = { ok: true; mensagem: string; id?: string };
type Err = { ok: false; error: string };

async function requireCondominiosStaff(): Promise<
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
    return { ok: false, error: 'Apenas administradores ou time podem gerir condomínios.' };
  }
  return { ok: true, supabase, userId: user.id };
}

function cleanPatch(patch: CondominioPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const setText = (k: keyof CondominioPatch, v: string | null | undefined) => {
    if (v === undefined) return;
    out[k] = v === '' ? null : v;
  };
  const setNum = (k: keyof CondominioPatch, v: number | null | undefined) => {
    if (v === undefined) return;
    out[k] = v;
  };

  setText('nome', patch.nome);
  setText('endereco', patch.endereco);
  setText('numero', patch.numero);
  setText('cep', patch.cep);
  setText('cidade', patch.cidade);
  setText('estado', patch.estado);
  setText('descricao_breve', patch.descricao_breve);
  setText('ticket_medio_lote', patch.ticket_medio_lote);
  setText('ticket_medio_casas', patch.ticket_medio_casas);
  setText('valor_tx_condominio', patch.valor_tx_condominio);
  setNum('estimativa_casas_vendidas_ano', patch.estimativa_casas_vendidas_ano);
  setText('extrato_como_eram_casas', patch.extrato_como_eram_casas);
  setText('extrato_tempo_venda', patch.extrato_tempo_venda);
  setText('data_lancamento_vendas', patch.data_lancamento_vendas);
  setText('data_liberacao_tvo', patch.data_liberacao_tvo);
  setNum('quantidade_lotes', patch.quantidade_lotes);
  setText('metragem_lotes', patch.metragem_lotes);
  setText('metragem_casas', patch.metragem_casas);
  setText('planta_cadastral', patch.planta_cadastral);
  setText('manual_obras', patch.manual_obras);
  setText('casas_concorrentes', patch.casas_concorrentes);
  setNum('prazo_aprovacao_condominio_dias', patch.prazo_aprovacao_condominio_dias);
  setText('prazo_aprovacao_condominio_sla_tipo', patch.prazo_aprovacao_condominio_sla_tipo);
  setNum('prazo_aprovacao_prefeitura_dias', patch.prazo_aprovacao_prefeitura_dias);
  setText('prazo_aprovacao_prefeitura_sla_tipo', patch.prazo_aprovacao_prefeitura_sla_tipo);
  return out;
}

export async function criarCondominio(patch: CondominioPatch): Promise<Ok | Err> {
  const gate = await requireCondominiosStaff();
  if (!gate.ok) return gate;
  const nome = String(patch.nome ?? '').trim();
  if (!nome) return { ok: false, error: 'Informe o nome do condomínio.' };

  if (await condominioNomeJaExiste(gate.supabase, nome)) {
    return { ok: false, error: 'Já existe um condomínio cadastrado com este nome.' };
  }

  const row = cleanPatch({ ...patch, nome });

  const { data, error } = await gate.supabase
    .from('condominios')
    .insert({ ...row, criado_por: gate.userId, updated_at: new Date().toISOString() } as never)
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath('/rede-franqueados');
  return { ok: true, mensagem: 'Condomínio cadastrado.', id: String(data?.id ?? '') };
}

export async function atualizarCondominio(id: string, patch: CondominioPatch): Promise<Ok | Err> {
  const gate = await requireCondominiosStaff();
  if (!gate.ok) return gate;
  if (!id) return { ok: false, error: 'ID inválido.' };

  const row = cleanPatch(patch);
  if (patch.nome !== undefined && !String(patch.nome).trim()) {
    return { ok: false, error: 'Informe o nome do condomínio.' };
  }
  if (Object.keys(row).length === 0) return { ok: false, error: 'Nada para atualizar.' };

  row.updated_at = new Date().toISOString();

  const { error } = await gate.supabase.from('condominios').update(row as never).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/rede-franqueados');
  return { ok: true, mensagem: 'Condomínio atualizado.' };
}

export async function excluirCondominio(id: string): Promise<Ok | Err> {
  const gate = await requireCondominiosStaff();
  if (!gate.ok) return gate;
  if (!id) return { ok: false, error: 'ID inválido.' };

  const { error } = await gate.supabase.from('condominios').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/rede-franqueados');
  return { ok: true, mensagem: 'Condomínio excluído.' };
}
