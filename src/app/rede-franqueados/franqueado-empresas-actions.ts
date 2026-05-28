'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
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

/** Cria ou atualiza linha em `franqueado_empresas` (unique por rede + tipo). */
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
    row = {
      rede_franqueado_id: redeId,
      tipo,
      ...cleanDados(dados),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Dados inválidos.' };
  }

  const { error } = await gate.supabase
    .from('franqueado_empresas')
    .upsert(row as never, { onConflict: 'rede_franqueado_id,tipo' });

  if (error) {
    if (/franqueado_empresas|schema cache|relation/i.test(error.message ?? '')) {
      return {
        ok: false,
        error:
          'Tabela franqueado_empresas ainda não existe no banco. Execute a migration 207 no Supabase.',
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/rede-franqueados');
  revalidatePath(`/rede-franqueados/${redeId}`);
  const label = tipo === 'incorporadora' ? 'Incorporadora' : 'Gestora';
  return { ok: true, mensagem: `Cadastro ${label} salvo.` };
}
