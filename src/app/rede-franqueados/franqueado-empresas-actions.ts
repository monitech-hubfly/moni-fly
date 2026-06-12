'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import { isFranquiaCasaMoniFk0000 } from '@/lib/franquia-casa-moni-fk0000';
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
