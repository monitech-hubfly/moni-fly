'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import type { FormularioEniInput } from './formulario-qualificacao';

export type ResolveTokenResult =
  | { ok: true; redeId: string; nFranquia: string; nomeCompleto: string; cidadeInicial: string; estadoInicial: string }
  | { ok: false; error: string };

/** Resolve token publico -> dados da rede (sem auth). */
export async function resolverTokenPublico(token: string): Promise<ResolveTokenResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('rede_franqueados')
    .select('id, n_franquia, nome_completo, cidade_casa_frank, estado_casa_frank')
    .eq('formulario_public_token', token)
    .single();

  if (error || !data) {
    return { ok: false, error: 'Link invalido ou expirado.' };
  }

  return {
    ok: true,
    redeId: data.id,
    nFranquia: String(data.n_franquia ?? ''),
    nomeCompleto: String(data.nome_completo ?? ''),
    cidadeInicial: String(data.cidade_casa_frank ?? ''),
    estadoInicial: String(data.estado_casa_frank ?? ''),
  };
}

/** Salva formulario via token publico (sem auth). */
export async function salvarFormularioPublico(
  token: string,
  input: Omit<FormularioEniInput, 'rede_franqueado_id' | 'n_franquia'>,
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const supabase = createAdminClient();

  // Resolver token -> rede
  const { data: rede, error: redeErr } = await supabase
    .from('rede_franqueados')
    .select('id, n_franquia')
    .eq('formulario_public_token', token)
    .single();

  if (redeErr || !rede) {
    return { ok: false, error: 'Link invalido ou expirado.' };
  }

  // Separate diag fields - they belong in rede_franqueados, not formularios_qualificacao
  const { diag_d, diag_k, diag_c, ...formularioData } = input;

  // Inserir formulario
  const { data: inserted, error: insertErr } = await supabase
    .from('formularios_qualificacao')
    .insert({
      ...formularioData,
      rede_franqueado_id: rede.id,
      n_franquia: String(rede.n_franquia ?? ''),
      preenchido_por_user_id: null,
    })
    .select('id')
    .single();

  if (insertErr) {
    console.error('[formulario-publico] insert error', insertErr);
    return { ok: false, error: 'Erro ao salvar formulario. Tente novamente.' };
  }

  // Atualizar notas na rede
  const { error: updateErr } = await supabase
    .from('rede_franqueados')
    .update({ diag_d: input.diag_d, diag_k: input.diag_k, diag_c: input.diag_c })
    .eq('id', rede.id);

  if (updateErr) {
    console.error('[formulario-publico] update rede_franqueados error', updateErr);
  }

  return { ok: true, id: inserted.id };
}

/** Historico de respostas via token (sem auth, leitura publica). */
export async function buscarHistoricoPublico(
  token: string,
): Promise<{ data: { id: string; criado_em: string; resultado_tipo: string | null }[] | null; error?: string }> {
  const supabase = createAdminClient();

  const { data: rede } = await supabase
    .from('rede_franqueados')
    .select('id')
    .eq('formulario_public_token', token)
    .single();

  if (!rede) return { data: null, error: 'Link invalido.' };

  const { data, error } = await supabase
    .from('formularios_qualificacao')
    .select('id, criado_em, resultado_tipo')
    .eq('rede_franqueado_id', rede.id)
    .order('criado_em', { ascending: false });

  if (error) return { data: null, error: 'Erro ao carregar historico.' };
  return { data: data ?? [] };
}

/** Retorna os campos completos de uma resposta especifica (valida que pertence ao token). */
export async function buscarRespostaPublicaDetalhe(
  token: string,
  formularioId: string,
): Promise<{ data: import('./formulario-qualificacao').FormularioQualificacaoRow | null; error?: string }> {
  const supabase = createAdminClient();

  const { data: rede } = await supabase
    .from('rede_franqueados')
    .select('id')
    .eq('formulario_public_token', token)
    .single();

  if (!rede) return { data: null, error: 'Link invalido.' };

  const { data, error } = await supabase
    .from('formularios_qualificacao')
    .select('*')
    .eq('id', formularioId)
    .eq('rede_franqueado_id', rede.id)
    .single();

  if (error || !data) return { data: null, error: 'Resposta nao encontrada.' };
  return { data: data as import('./formulario-qualificacao').FormularioQualificacaoRow };
}
