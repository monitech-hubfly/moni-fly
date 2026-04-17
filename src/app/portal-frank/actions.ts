'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { RedeFrankCadastroPayload, RedeFrankPrefill } from '@/lib/portal-frank/rede-cadastro-types';
import {
  NOTIFICACAO_VALIDACAO_TIPO,
  REDE_SELECT_FIELDS,
  redeSqlRowParaPrefill,
} from '@/lib/portal-frank/rede-cadastro-types';

export type ConviteFrankValidacao =
  | {
      ok: true;
      emailConvite: string;
      franqueadoId: string | null;
      rede: RedeFrankPrefill | null;
    }
  | { ok: false; error: string };

function trimOrNull(s: string | null | undefined): string | null {
  const t = String(s ?? '').trim();
  return t ? t : null;
}

/** Valida token (página de cadastro, server). */
export async function validarTokenConviteFrank(token: string): Promise<ConviteFrankValidacao> {
  const t = String(token ?? '').trim();
  if (!t) return { ok: false, error: 'Token ausente.' };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('convites_frank')
    .select('id, email, expira_em, usado_em, franqueado_id')
    .eq('token', t)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Convite não encontrado.' };

  const row = data as { usado_em: string | null; expira_em: string; franqueado_id?: string | null; email?: string | null };
  if (row.usado_em) return { ok: false, error: 'Este convite já foi utilizado.' };
  if (new Date(row.expira_em).getTime() <= Date.now()) return { ok: false, error: 'Convite expirado.' };

  const franqueadoId = row.franqueado_id != null && String(row.franqueado_id).trim() !== '' ? String(row.franqueado_id) : null;

  let emailConvite = trimOrNull(row.email);
  let rede: RedeFrankPrefill | null = null;

  if (franqueadoId) {
    const { data: redeRow } = await admin
      .from('rede_franqueados')
      .select(REDE_SELECT_FIELDS)
      .eq('id', franqueadoId)
      .maybeSingle();
    if (redeRow) {
      const pre = redeSqlRowParaPrefill(redeRow as Record<string, unknown>);
      if (pre) {
        rede = pre;
        if (!emailConvite && pre.email_frank) {
          emailConvite = trimOrNull(pre.email_frank);
        }
      }
    }
  }

  if (!emailConvite) {
    return { ok: false, error: 'Convite sem e-mail. Peça ao administrador para informar o e-mail ou associar um franqueado na rede.' };
  }

  return { ok: true, emailConvite, franqueadoId, rede };
}

export type ConfirmarConviteFrankResult = { ok: true } | { ok: false; error: string };

/** PATCH permitido para o Frank (nunca inclui campos bloqueados da franquia). */
function montarPatchRedeFrank(d: RedeFrankCadastroPayload): Record<string, unknown> {
  return {
    email_frank: trimOrNull(d.email_frank),
    telefone_frank: trimOrNull(d.telefone_frank),
    data_nasc_frank: trimOrNull(d.data_nasc_frank) ?? null,
    cpf_frank: trimOrNull(d.cpf_frank),
    endereco_casa_frank: trimOrNull(d.endereco_casa_frank),
    endereco_casa_frank_numero: trimOrNull(d.endereco_casa_frank_numero),
    endereco_casa_frank_complemento: trimOrNull(d.endereco_casa_frank_complemento),
    cep_casa_frank: trimOrNull(d.cep_casa_frank),
    tamanho_camisa_frank: trimOrNull(d.tamanho_camisa_frank),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Após signUp/signIn: marca convite, define role/cargo/rede no perfil e atualiza `rede_franqueados`.
 */
export async function confirmarCadastroPortalFrank(
  token: string,
  nomeCompleto: string,
  dadosRede: RedeFrankCadastroPayload,
): Promise<ConfirmarConviteFrankResult> {
  const t = String(token ?? '').trim();
  if (!t) return { ok: false, error: 'Token inválido.' };
  const nome = String(nomeCompleto ?? '').trim();
  if (!nome) return { ok: false, error: 'Nome obrigatório.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: 'Faça login ou conclua o cadastro antes de confirmar o convite.' };

  const admin = createAdminClient();
  const { data: inv, error: invErr } = await admin
    .from('convites_frank')
    .select('id, email, expira_em, usado_em, franqueado_id')
    .eq('token', t)
    .maybeSingle();

  if (invErr) return { ok: false, error: invErr.message };
  if (!inv) return { ok: false, error: 'Convite não encontrado.' };

  const row = inv as {
    id: string;
    email: string | null;
    expira_em: string;
    usado_em: string | null;
    franqueado_id: string | null;
  };
  if (row.usado_em) return { ok: false, error: 'Convite já utilizado.' };
  if (new Date(row.expira_em).getTime() <= Date.now()) return { ok: false, error: 'Convite expirado.' };

  const emailConvite = trimOrNull(row.email);
  const emUser = user.email.trim().toLowerCase();
  const franqueadoId = row.franqueado_id != null && String(row.franqueado_id).trim() !== '' ? String(row.franqueado_id) : null;

  let emailRede: string | null = null;
  if (franqueadoId) {
    const { data: rrede } = await admin.from('rede_franqueados').select('email_frank').eq('id', franqueadoId).maybeSingle();
    emailRede = trimOrNull((rrede as { email_frank?: string | null } | null)?.email_frank ?? null);
  }

  const emConvite = (emailConvite ?? emailRede ?? '').toLowerCase();
  if (!emConvite) return { ok: false, error: 'Convite sem e-mail configurado.' };
  if (emUser !== emConvite) {
    return { ok: false, error: 'Use o mesmo e-mail indicado no convite.' };
  }

  const now = new Date().toISOString();
  const { error: upInv } = await admin.from('convites_frank').update({ usado_em: now }).eq('id', row.id);
  if (upInv) return { ok: false, error: upInv.message };

  const patchProf: Record<string, unknown> = {
    role: 'frank',
    cargo: 'adm',
    rede_franqueado_id: franqueadoId,
    full_name: nome,
    nome_completo: nome,
    updated_at: now,
  };

  const { error: upProf } = await admin.from('profiles').update(patchProf).eq('id', user.id);
  if (upProf) return { ok: false, error: upProf.message };

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { full_name: nome, nome_completo: nome },
  });

  if (franqueadoId) {
    const patchRede = montarPatchRedeFrank(dadosRede);
    const { error: upRede } = await admin.from('rede_franqueados').update(patchRede).eq('id', franqueadoId);
    if (upRede) return { ok: false, error: upRede.message };
  }

  return { ok: true };
}

export type SubmeterValidacaoResult = { ok: true } | { ok: false; error: string };

export async function submeterValidacaoTrimestralFrank(
  periodo: string,
  dadosRede: RedeFrankCadastroPayload,
): Promise<SubmeterValidacaoResult> {
  const per = String(periodo ?? '').trim();
  if (!per) return { ok: false, error: 'Período inválido.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sessão expirada.' };

  const { data: prof, error: pErr } = await supabase
    .from('profiles')
    .select('rede_franqueado_id, role')
    .eq('id', user.id)
    .maybeSingle();
  if (pErr || !prof) return { ok: false, error: 'Perfil não encontrado.' };
  const redeId = (prof as { rede_franqueado_id?: string | null }).rede_franqueado_id;
  if (!redeId) return { ok: false, error: 'Sem franquia vinculada ao perfil.' };

  const role = String((prof as { role?: string | null }).role ?? '').toLowerCase();
  if (role !== 'frank' && role !== 'franqueado') {
    return { ok: false, error: 'Apenas franqueados podem validar.' };
  }

  const now = new Date().toISOString();
  const patchRede = montarPatchRedeFrank(dadosRede);
  const { error: rErr } = await supabase.from('rede_franqueados').update(patchRede).eq('id', redeId);
  if (rErr) return { ok: false, error: rErr.message };

  const { data: exist } = await supabase
    .from('frank_validacoes_dados')
    .select('id')
    .eq('frank_id', user.id)
    .eq('periodo', per)
    .maybeSingle();

  const existId = exist && typeof exist === 'object' && 'id' in exist ? String((exist as { id: string }).id) : null;
  if (existId) {
    const { error: uErr } = await supabase.from('frank_validacoes_dados').update({ validado_em: now }).eq('id', existId);
    if (uErr) return { ok: false, error: uErr.message };
  } else {
    const { error: iErr } = await supabase.from('frank_validacoes_dados').insert({
      frank_id: user.id,
      periodo: per,
      validado_em: now,
    });
    if (iErr) return { ok: false, error: iErr.message };
  }

  return { ok: true };
}

/**
 * Enfileira notificação diária na Sirene enquanto houver período em atraso sem validação.
 */
export async function ensureNotificacaoValidacaoFrank(periodo: string | null): Promise<void> {
  if (!periodo) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const { data: ja } = await supabase
    .from('sirene_notificacoes')
    .select('id')
    .eq('user_id', user.id)
    .eq('tipo', NOTIFICACAO_VALIDACAO_TIPO)
    .gte('created_at', inicio.toISOString())
    .limit(1);

  if (ja && ja.length > 0) return;

  await supabase.from('sirene_notificacoes').insert({
    user_id: user.id,
    chamado_id: null,
    tipo: NOTIFICACAO_VALIDACAO_TIPO,
    texto: `Atualize e confirme os seus dados na rede (validação trimestral — período ${periodo}).`,
    lida: false,
  });
}
