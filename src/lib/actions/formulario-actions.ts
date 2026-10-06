'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { isRedeStaffRole, isFrankOrFranqueadoRole, normalizeAccessRole } from '@/lib/authz';
import { getPublicAppUrl } from '@/lib/app-url';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { FORMULARIOS_BUCKET } from '@/lib/constants/formularios-ids';
import { opcoesDeCampo, tipoCampo } from '@/lib/formularios/apresentacao';
import type {
  FormularioCampo,
  FormularioListaItem,
  FormularioRespostaDetalhe,
  FormularioRespostaListaItem,
  FormularioSecao,
  FormularioStatusResposta,
} from '@/types/formularios';

async function sessao() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, rede_franqueado_id, full_name')
    .eq('id', user.id)
    .maybeSingle();
  const role = normalizeAccessRole((profile as { role?: string } | null)?.role);
  const redeId = (profile as { rede_franqueado_id?: string | null } | null)?.rede_franqueado_id ?? null;
  const nome = String((profile as { full_name?: string | null } | null)?.full_name ?? '').trim() || null;
  return { ok: true as const, user, role, redeId, nome, supabase };
}

function staff(role: string): boolean {
  return isRedeStaffRole(role);
}

function urlPublica(token: string): string {
  return `${getPublicAppUrl()}/f/${token}`;
}

function statusDe(raw: string): FormularioStatusResposta {
  return raw === 'enviado' ? 'enviado' : 'rascunho';
}

type RespostaRow = {
  id: string;
  formulario_id: string;
  status: string;
  created_at: string;
  enviado_em: string | null;
  card_id: string | null;
  rede_franqueado_id: string | null;
  numero_franquia: string | null;
  nome_franqueado: string | null;
  formularios?: { nome?: string } | { nome?: string }[] | null;
};

function nomeFormulario(row: RespostaRow): string {
  const rel = row.formularios;
  if (Array.isArray(rel)) return String(rel[0]?.nome ?? 'Formulário');
  return String(rel?.nome ?? 'Formulário');
}

function mapResposta(row: RespostaRow): FormularioRespostaListaItem {
  return {
    id: row.id,
    formulario_id: row.formulario_id,
    formulario_nome: nomeFormulario(row),
    status: statusDe(row.status),
    created_at: row.created_at,
    enviado_em: row.enviado_em,
    card_id: row.card_id,
    rede_franqueado_id: row.rede_franqueado_id,
    numero_franquia: row.numero_franquia,
    nome_franqueado: row.nome_franqueado,
  };
}

const SELECT_RESPOSTA =
  'id, formulario_id, status, created_at, enviado_em, card_id, rede_franqueado_id, numero_franquia, nome_franqueado, formularios(nome)';

export async function gerarTokenFormulario(
  formularioId: string,
  cardId?: string | null,
  redeFranqueadoId?: string | null,
): Promise<{ ok: true; token: string; url: string } | { ok: false; error: string }> {
  const ctx = await sessao();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!staff(ctx.role)) return { ok: false, error: 'Sem permissão para gerar link.' };
  const formId = formularioId.trim();
  if (!formId) return { ok: false, error: 'Formulário inválido.' };
  const admin = createAdminClient();
  const { data: form, error: formErr } = await admin
    .from('formularios')
    .select('id, ativo')
    .eq('id', formId)
    .maybeSingle();
  if (formErr) return { ok: false, error: formErr.message };
  if (!form?.id || !(form as { ativo?: boolean }).ativo) {
    return { ok: false, error: 'Formulário não encontrado.' };
  }
  const token = randomBytes(24).toString('base64url');
  const card = cardId?.trim() || null;
  const rede = redeFranqueadoId?.trim() || null;
  const { error } = await admin.from('formulario_tokens').insert({
    formulario_id: formId,
    token,
    card_id: card,
    rede_franqueado_id: rede,
    criado_por: ctx.user.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/formularios');
  revalidatePath(`/formularios/${formId}`);
  return { ok: true, token, url: urlPublica(token) };
}

export async function listarFormulariosAtivos(): Promise<
  { ok: true; formularios: FormularioListaItem[] } | { ok: false; error: string }
> {
  const ctx = await sessao();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!staff(ctx.role)) return { ok: false, error: 'Sem permissão.' };
  const { data, error } = await ctx.supabase
    .from('formularios')
    .select('id, nome, descricao')
    .eq('ativo', true)
    .order('nome', { ascending: true });
  if (error) return { ok: false, error: error.message };
  const formularios = ((data ?? []) as Array<{ id: string; nome: string; descricao: string | null }>).map((row) => ({
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
  }));
  return { ok: true, formularios };
}

export async function listarRespostasFormulario(
  formularioId: string,
): Promise<{ ok: true; respostas: FormularioRespostaListaItem[] } | { ok: false; error: string }> {
  const ctx = await sessao();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!staff(ctx.role)) return { ok: false, error: 'Sem permissão.' };
  const { data, error } = await ctx.supabase
    .from('formulario_respostas')
    .select(SELECT_RESPOSTA)
    .eq('formulario_id', formularioId)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, respostas: ((data ?? []) as unknown as RespostaRow[]).map(mapResposta) };
}

async function frankPodeVerRede(redeId: string | null, ctxRede: string | null, role: string): Promise<boolean> {
  if (staff(role)) return true;
  if (!isFrankOrFranqueadoRole(role)) return false;
  return Boolean(redeId && ctxRede && redeId === ctxRede);
}

export async function listarRespostasDoCard(
  cardId: string,
): Promise<{ ok: true; respostas: FormularioRespostaListaItem[] } | { ok: false; error: string }> {
  const ctx = await sessao();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const id = cardId.trim();
  if (!id) return { ok: false, error: 'Card inválido.' };
  if (!staff(ctx.role)) {
    const { data: card } = await ctx.supabase
      .from('kanban_cards')
      .select('rede_franqueado_id')
      .eq('id', id)
      .maybeSingle();
    const redeCard = (card as { rede_franqueado_id?: string | null } | null)?.rede_franqueado_id ?? null;
    if (!(await frankPodeVerRede(redeCard, ctx.redeId, ctx.role))) {
      return { ok: false, error: 'Sem permissão.' };
    }
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('formulario_respostas')
    .select(SELECT_RESPOSTA)
    .eq('card_id', id)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, respostas: ((data ?? []) as unknown as RespostaRow[]).map(mapResposta) };
}

export async function listarRespostasDoFranqueado(
  redeFranqueadoId: string,
): Promise<{ ok: true; respostas: FormularioRespostaListaItem[] } | { ok: false; error: string }> {
  const ctx = await sessao();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const id = redeFranqueadoId.trim();
  if (!id) return { ok: false, error: 'Franqueado inválido.' };
  if (!(await frankPodeVerRede(id, ctx.redeId, ctx.role))) return { ok: false, error: 'Sem permissão.' };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('formulario_respostas')
    .select(SELECT_RESPOSTA)
    .eq('rede_franqueado_id', id)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, respostas: ((data ?? []) as unknown as RespostaRow[]).map(mapResposta) };
}

export async function buscarRespostaDetalhe(
  respostaId: string,
): Promise<{ ok: true; resposta: FormularioRespostaDetalhe } | { ok: false; error: string }> {
  const ctx = await sessao();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!staff(ctx.role)) return { ok: false, error: 'Sem permissão.' };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('formulario_respostas')
    .select(SELECT_RESPOSTA)
    .eq('id', respostaId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Resposta não encontrada.' };
  const base = mapResposta(data as unknown as RespostaRow);

  const { data: valores, error: valErr } = await admin
    .from('formulario_resposta_valores')
    .select('campo_id, valor_texto, valor_numero, valor_data, valor_json, formulario_campos(nome, tipo)')
    .eq('resposta_id', respostaId);
  if (valErr) return { ok: false, error: valErr.message };

  const { data: arquivos, error: arqErr } = await admin
    .from('formulario_resposta_arquivos')
    .select('id, campo_id, nome_arquivo, storage_path')
    .eq('resposta_id', respostaId);
  if (arqErr) return { ok: false, error: arqErr.message };

  const arquivosComUrl = await Promise.all(
    ((arquivos ?? []) as Array<{ id: string; campo_id: string; nome_arquivo: string; storage_path: string }>).map(
      async (arquivo) => {
        const { data: signed } = await admin.storage
          .from(FORMULARIOS_BUCKET)
          .createSignedUrl(arquivo.storage_path, 3600);
        return {
          id: arquivo.id,
          campo_id: arquivo.campo_id,
          nome_arquivo: arquivo.nome_arquivo,
          url: signed?.signedUrl ?? null,
        };
      },
    ),
  );

  return {
    ok: true,
    resposta: {
      ...base,
      valores: ((valores ?? []) as Array<Record<string, unknown>>).map((row) => {
        const campo = row.formulario_campos as { nome?: string; tipo?: string } | { nome?: string; tipo?: string }[] | null;
        const rel = Array.isArray(campo) ? campo[0] : campo;
        return {
          campo_id: String(row.campo_id),
          campo_nome: String(rel?.nome ?? 'Campo'),
          tipo: tipoCampo(String(rel?.tipo ?? 'texto_curto')),
          valor_texto: (row.valor_texto as string | null) ?? null,
          valor_numero: row.valor_numero == null ? null : Number(row.valor_numero),
          valor_data: (row.valor_data as string | null) ?? null,
          valor_json: row.valor_json ?? null,
        };
      }),
      arquivos: arquivosComUrl,
    },
  };
}

export async function carregarFormularioPublico(token: string): Promise<
  | {
      ok: true;
      tokenId: string;
      avulso: boolean;
      formulario: FormularioListaItem;
      secoes: FormularioSecao[];
    }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const { data: tok, error } = await admin
    .from('formulario_tokens')
    .select('id, formulario_id, card_id, rede_franqueado_id, expira_em, formularios(id, nome, descricao, ativo)')
    .eq('token', token)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!tok) return { ok: false, error: 'Link inválido.' };
  const row = tok as {
    id: string;
    formulario_id: string;
    card_id: string | null;
    rede_franqueado_id: string | null;
    expira_em: string | null;
    formularios: { id: string; nome: string; descricao: string | null; ativo: boolean } | { id: string; nome: string; descricao: string | null; ativo: boolean }[] | null;
  };
  if (row.expira_em && new Date(row.expira_em).getTime() < Date.now()) {
    return { ok: false, error: 'Este link expirou.' };
  }
  const formRel = Array.isArray(row.formularios) ? row.formularios[0] : row.formularios;
  if (!formRel?.ativo) return { ok: false, error: 'Este formulário não está disponível.' };

  const { data: secoesRaw, error: secErr } = await admin
    .from('formulario_secoes')
    .select('id, formulario_id, nome, ordem, condicional_campo_id, condicional_valor')
    .eq('formulario_id', row.formulario_id)
    .order('ordem', { ascending: true });
  if (secErr) return { ok: false, error: secErr.message };

  const secaoIds = ((secoesRaw ?? []) as Array<{ id: string }>).map((secao) => secao.id);
  const { data: camposRaw, error: campErr } = secaoIds.length
    ? await admin
        .from('formulario_campos')
        .select('id, secao_id, nome, tipo, ordem, obrigatorio, opcoes, condicional_campo_id, condicional_valor')
        .in('secao_id', secaoIds)
        .order('ordem', { ascending: true })
    : { data: [], error: null };
  if (campErr) return { ok: false, error: campErr.message };

  const campos = ((camposRaw ?? []) as Array<Record<string, unknown>>).map((campo) => {
    const item: FormularioCampo = {
      id: String(campo.id),
      secao_id: String(campo.secao_id),
      nome: String(campo.nome ?? ''),
      tipo: tipoCampo(String(campo.tipo ?? '')),
      ordem: Number(campo.ordem ?? 0),
      obrigatorio: Boolean(campo.obrigatorio),
      opcoes: opcoesDeCampo(campo.opcoes),
      condicional_campo_id: (campo.condicional_campo_id as string | null) ?? null,
      condicional_valor: (campo.condicional_valor as string | null) ?? null,
    };
    return item;
  });

  const secoes: FormularioSecao[] = ((secoesRaw ?? []) as Array<Record<string, unknown>>).map((secao) => ({
    id: String(secao.id),
    formulario_id: String(secao.formulario_id),
    nome: String(secao.nome ?? ''),
    ordem: Number(secao.ordem ?? 0),
    condicional_campo_id: (secao.condicional_campo_id as string | null) ?? null,
    condicional_valor: (secao.condicional_valor as string | null) ?? null,
    campos: campos.filter((campo) => campo.secao_id === String(secao.id)),
  }));

  return {
    ok: true,
    tokenId: row.id,
    avulso: !row.card_id && !row.rede_franqueado_id,
    formulario: { id: formRel.id, nome: formRel.nome, descricao: formRel.descricao },
    secoes,
  };
}
