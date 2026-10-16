'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isAdminRole, normalizeAccessRole } from '@/lib/authz';
import { publicarVersaoRepositorio } from '@/lib/repositorio/publicar-versao';

const REPO_PATH = '/repositorio';

export type VersaoDocumento = {
  id: string;
  vigente: boolean;
  created_at: string;
  descricao: string | null;
};

export type VariacaoRepositorio = {
  id: string;
  nome: string;
  quando_utilizar: string | null;
  ordem: number;
  vigente: VersaoDocumento | null;
  anteriores: VersaoDocumento[];
};

export type TipoRepositorio = {
  id: string;
  nome: string;
  ordem: number;
  checklist: string[];
  padrao: VersaoDocumento | null;
  anterioresPadrao: VersaoDocumento[];
  variacoes: VariacaoRepositorio[];
};

export type SecaoRepositorio = {
  id: string;
  nome: string;
  ordem: number;
  created_at: string;
  tipos: TipoRepositorio[];
};

async function sessionAndRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const raw = String((profile as { role?: string } | null)?.role ?? '');
  const role = normalizeAccessRole(raw);
  return { ok: true as const, user, role, raw: raw.toLowerCase(), supabase };
}

function podeEditar(role: string): boolean {
  return isAdminRole(role) || role === 'team';
}

function separarVersoes(linhas: VersaoDocumento[]): { vigente: VersaoDocumento | null; anteriores: VersaoDocumento[] } {
  const ordenadas = [...linhas].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const vigente = ordenadas.find((v) => v.vigente) ?? null;
  return { vigente, anteriores: ordenadas.filter((v) => v.id !== vigente?.id) };
}

export async function listarRepositorio(): Promise<
  { ok: true; secoes: SecaoRepositorio[] } | { ok: false; error: string }
> {
  const ctx = await sessionAndRole();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { supabase } = ctx;

  const [secoesRes, tiposRes, variacoesRes, versoesRes] = await Promise.all([
    supabase.from('repositorio_secoes').select('id, nome, ordem, created_at').order('ordem', { ascending: true }),
    supabase.from('repositorio_tipos').select('id, secao_id, nome, ordem, checklist').order('ordem', { ascending: true }),
    supabase.from('repositorio_variacoes').select('id, tipo_id, nome, quando_utilizar, ordem').order('ordem', { ascending: true }),
    supabase
      .from('repositorio_documentos')
      .select('id, tipo_id, variacao_id, descricao, vigente, created_at')
      .order('created_at', { ascending: false }),
  ]);
  if (secoesRes.error) return { ok: false, error: secoesRes.error.message };
  if (tiposRes.error) return { ok: false, error: tiposRes.error.message };
  if (variacoesRes.error) return { ok: false, error: variacoesRes.error.message };
  if (versoesRes.error) return { ok: false, error: versoesRes.error.message };

  const versoes = (versoesRes.data ?? []) as Array<{
    id: string;
    tipo_id: string | null;
    variacao_id: string | null;
    descricao: string | null;
    vigente: boolean;
    created_at: string;
  }>;

  const tipos = ((tiposRes.data ?? []) as Array<{
    id: string;
    secao_id: string;
    nome: string;
    ordem: number;
    checklist: string[] | null;
  }>).map((tipo) => {
    const doPadrao = versoes
      .filter((v) => v.tipo_id === tipo.id && !v.variacao_id)
      .map((v) => ({ id: v.id, vigente: v.vigente, created_at: v.created_at, descricao: v.descricao }));
    const partes = separarVersoes(doPadrao);
    const variacoes = ((variacoesRes.data ?? []) as Array<{
      id: string;
      tipo_id: string;
      nome: string;
      quando_utilizar: string | null;
      ordem: number;
    }>)
      .filter((v) => v.tipo_id === tipo.id)
      .map((variacao) => {
        const daVariacao = versoes
          .filter((v) => v.variacao_id === variacao.id)
          .map((v) => ({ id: v.id, vigente: v.vigente, created_at: v.created_at, descricao: v.descricao }));
        const arquivos = separarVersoes(daVariacao);
        return {
          id: variacao.id,
          nome: variacao.nome,
          quando_utilizar: variacao.quando_utilizar,
          ordem: variacao.ordem,
          vigente: arquivos.vigente,
          anteriores: arquivos.anteriores,
        };
      });
    return {
      id: tipo.id,
      secao_id: tipo.secao_id,
      nome: tipo.nome,
      ordem: tipo.ordem,
      checklist: (tipo.checklist ?? []).map((item) => String(item)),
      padrao: partes.vigente,
      anterioresPadrao: partes.anteriores,
      variacoes,
    };
  });

  const secoes = ((secoesRes.data ?? []) as SecaoRepositorio[]).map((secao) => ({
    ...secao,
    tipos: tipos.filter((tipo) => tipo.secao_id === secao.id).map(({ secao_id: _id, ...tipo }) => tipo),
  }));
  return { ok: true, secoes };
}

export async function adicionarSecao(nome: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await sessionAndRole();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!podeEditar(ctx.role)) return { ok: false, error: 'Sem permissão para alterar o Repositório.' };
  const label = nome.trim();
  if (!label) return { ok: false, error: 'Informe o nome da seção.' };
  const admin = createAdminClient();
  const { data: maxRow } = await admin.from('repositorio_secoes').select('ordem').order('ordem', { ascending: false }).limit(1).maybeSingle();
  const nextOrdem = Number((maxRow as { ordem?: number } | null)?.ordem ?? 0) + 1;
  const { error } = await admin.from('repositorio_secoes').insert({ nome: label, ordem: nextOrdem });
  if (error) return { ok: false, error: error.message };
  revalidatePath(REPO_PATH);
  return { ok: true };
}

export async function criarTipo(secaoId: string, nome: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await sessionAndRole();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!podeEditar(ctx.role)) return { ok: false, error: 'Sem permissão para alterar o Repositório.' };
  const secao = secaoId.trim();
  const label = nome.trim();
  if (!secao) return { ok: false, error: 'Seção inválida.' };
  if (!label) return { ok: false, error: 'Informe o nome do tipo de documento.' };
  const admin = createAdminClient();
  const { data: maxRow } = await admin
    .from('repositorio_tipos')
    .select('ordem')
    .eq('secao_id', secao)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrdem = Number((maxRow as { ordem?: number } | null)?.ordem ?? 0) + 1;
  const { error } = await admin.from('repositorio_tipos').insert({ secao_id: secao, nome: label, ordem: nextOrdem });
  if (error) return { ok: false, error: error.message };
  revalidatePath(REPO_PATH);
  return { ok: true };
}

export async function salvarChecklistTipo(
  tipoId: string,
  itens: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await sessionAndRole();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!podeEditar(ctx.role)) return { ok: false, error: 'Sem permissão para alterar o Repositório.' };
  const lista = itens.map((item) => item.trim()).filter(Boolean).slice(0, 40);
  const admin = createAdminClient();
  const { error } = await admin.from('repositorio_tipos').update({ checklist: lista }).eq('id', tipoId.trim());
  if (error) return { ok: false, error: error.message };
  revalidatePath(REPO_PATH);
  return { ok: true };
}

async function gravarArquivo(params: {
  secaoId: string;
  tipoId: string;
  arquivo: File;
  userId: string;
  tipoAlvo: { tipo_id: string } | { variacao_id: string };
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const publicado = await publicarVersaoRepositorio(params);
  if (!publicado.ok) return publicado;
  return { ok: true };
}

async function secaoDoTipo(tipoId: string): Promise<{ secaoId: string } | { error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.from('repositorio_tipos').select('id, secao_id').eq('id', tipoId).maybeSingle();
  if (error) return { error: error.message };
  if (!data?.id) return { error: 'Tipo de documento não encontrado.' };
  return { secaoId: String((data as { secao_id: string }).secao_id) };
}

export async function subirVersaoPadrao(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await sessionAndRole();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!podeEditar(ctx.role)) return { ok: false, error: 'Sem permissão para alterar o Repositório.' };
  const tipoId = String(formData.get('tipo_id') ?? '').trim();
  const arquivo = formData.get('arquivo');
  if (!tipoId) return { ok: false, error: 'Tipo inválido.' };
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, error: 'Selecione um arquivo.' };
  const secao = await secaoDoTipo(tipoId);
  if ('error' in secao) return { ok: false, error: secao.error };
  const gravado = await gravarArquivo({
    secaoId: secao.secaoId,
    tipoId,
    arquivo,
    userId: ctx.user.id,
    tipoAlvo: { tipo_id: tipoId },
  });
  if (!gravado.ok) return gravado;
  revalidatePath(REPO_PATH);
  return { ok: true };
}

export async function criarVariacao(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await sessionAndRole();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!podeEditar(ctx.role)) return { ok: false, error: 'Sem permissão para alterar o Repositório.' };
  const tipoId = String(formData.get('tipo_id') ?? '').trim();
  const nome = String(formData.get('nome') ?? '').trim();
  const quando = String(formData.get('quando_utilizar') ?? '').trim();
  const arquivo = formData.get('arquivo');
  if (!tipoId) return { ok: false, error: 'Tipo inválido.' };
  if (!nome) return { ok: false, error: 'Informe o nome da variação.' };
  if (!quando) return { ok: false, error: 'Informe quando utilizar.' };
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, error: 'Selecione o arquivo vigente.' };
  const secao = await secaoDoTipo(tipoId);
  if ('error' in secao) return { ok: false, error: secao.error };
  const admin = createAdminClient();
  const { data: maxRow } = await admin
    .from('repositorio_variacoes')
    .select('ordem')
    .eq('tipo_id', tipoId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrdem = Number((maxRow as { ordem?: number } | null)?.ordem ?? 0) + 1;
  const { data: criada, error } = await admin
    .from('repositorio_variacoes')
    .insert({ tipo_id: tipoId, nome, quando_utilizar: quando, ordem: nextOrdem })
    .select('id')
    .single();
  if (error || !criada?.id) return { ok: false, error: error?.message ?? 'Não foi possível criar a variação.' };
  const gravado = await gravarArquivo({
    secaoId: secao.secaoId,
    tipoId,
    arquivo,
    userId: ctx.user.id,
    tipoAlvo: { variacao_id: String(criada.id) },
  });
  if (!gravado.ok) {
    await admin.from('repositorio_variacoes').delete().eq('id', criada.id);
    return gravado;
  }
  revalidatePath(REPO_PATH);
  return { ok: true };
}

export async function atualizarQuandoUtilizar(
  variacaoId: string,
  texto: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await sessionAndRole();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!podeEditar(ctx.role)) return { ok: false, error: 'Sem permissão para alterar o Repositório.' };
  const quando = texto.trim();
  if (!quando) return { ok: false, error: 'Informe quando utilizar.' };
  const admin = createAdminClient();
  const { error } = await admin
    .from('repositorio_variacoes')
    .update({ quando_utilizar: quando })
    .eq('id', variacaoId.trim());
  if (error) return { ok: false, error: error.message };
  revalidatePath(REPO_PATH);
  return { ok: true };
}

export async function subirVersaoVariacao(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await sessionAndRole();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!podeEditar(ctx.role)) return { ok: false, error: 'Sem permissão para alterar o Repositório.' };
  const variacaoId = String(formData.get('variacao_id') ?? '').trim();
  const arquivo = formData.get('arquivo');
  if (!variacaoId) return { ok: false, error: 'Variação inválida.' };
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, error: 'Selecione um arquivo.' };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('repositorio_variacoes')
    .select('id, tipo_id')
    .eq('id', variacaoId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data?.id) return { ok: false, error: 'Variação não encontrada.' };
  const tipoId = String((data as { tipo_id: string }).tipo_id);
  const secao = await secaoDoTipo(tipoId);
  if ('error' in secao) return { ok: false, error: secao.error };
  const gravado = await gravarArquivo({
    secaoId: secao.secaoId,
    tipoId,
    arquivo,
    userId: ctx.user.id,
    tipoAlvo: { variacao_id: variacaoId },
  });
  if (!gravado.ok) return gravado;
  revalidatePath(REPO_PATH);
  return { ok: true };
}

export async function baixarDocumento(
  id: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await sessionAndRole();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { data: row, error } = await ctx.supabase
    .from('repositorio_documentos')
    .select('id, storage_path, bucket')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: 'Documento não encontrado.' };
  const doc = row as { storage_path: string; bucket: string };
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Serviço indisponível.' };
  }
  const { data: signed, error: signErr } = await admin.storage.from(doc.bucket).createSignedUrl(doc.storage_path, 3600);
  if (signErr || !signed?.signedUrl) return { ok: false, error: signErr?.message ?? 'Não foi possível gerar o link.' };
  return { ok: true, url: signed.signedUrl };
}
