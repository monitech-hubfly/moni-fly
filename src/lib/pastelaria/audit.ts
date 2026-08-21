import type { SupabaseClient, User } from '@supabase/supabase-js';
import { isAdminRole } from '@/lib/authz';

export type PastelariaAuditOperacao = 'INSERT' | 'UPDATE' | 'DELETE';

export type RegistrarLogPastelariaParams = {
  supabase: SupabaseClient;
  user: User;
  area?: string | null;
  entidade: string;
  entidade_id?: string | null;
  operacao: PastelariaAuditOperacao;
  campo?: string | null;
  valor_anterior?: unknown;
  valor_novo?: unknown;
  descricao?: string | null;
};

async function resolveAuditActor(
  supabase: SupabaseClient,
  user: User,
): Promise<{ usuario: string; is_admin: boolean }> {
  let isAdmin = false;
  if (user.id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    isAdmin = isAdminRole((profile as { role?: string } | null)?.role);
  }

  const usuario =
    user.email?.trim() ||
    (typeof user.user_metadata?.name === 'string' ? user.user_metadata.name.trim() : '') ||
    'Desconhecido';

  return { usuario, is_admin: isAdmin };
}

export async function fetchAreaNome(
  supabase: SupabaseClient,
  areaId: string | null | undefined,
): Promise<string | null> {
  if (!areaId) return null;
  const { data } = await supabase.from('areas').select('nome').eq('id', areaId).maybeSingle();
  return (data as { nome?: string } | null)?.nome?.trim() ?? null;
}

/** Grava em audit_log; nunca lança erro para não quebrar a operação principal. */
export async function registrarLogPastelaria(params: RegistrarLogPastelariaParams): Promise<void> {
  try {
    const { usuario, is_admin } = await resolveAuditActor(params.supabase, params.user);

    const { error } = await params.supabase.from('audit_log').insert({
      usuario,
      is_admin,
      modulo: 'Pastelaria',
      area: params.area ?? null,
      entidade: params.entidade,
      entidade_id: params.entidade_id ? String(params.entidade_id) : null,
      operacao: params.operacao,
      campo: params.campo ?? null,
      valor_anterior: params.valor_anterior ?? null,
      valor_novo: params.valor_novo ?? null,
      descricao: params.descricao ?? null,
    });

    if (error) {
      console.error('[Pastelaria audit_log]', error);
    }
  } catch (e) {
    console.error('[Pastelaria audit_log]', e);
  }
}
