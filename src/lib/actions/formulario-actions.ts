'use server';

import { randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FORMULARIOS_BUCKET } from '@/lib/constants/formularios-ids';
import { categoriaHubOuNull } from '@/lib/constants/categorias-hub';
import { isFrankOrFranqueadoRole } from '@/lib/authz';
import { opcoesParaLista } from '@/lib/formularios/apresentacao';
import type {
  Formulario,
  FormularioCampo,
  FormularioCampoTipo,
  FormularioResposta,
  FormularioRespostaListaItem,
  FormularioRespostaStatus,
  FormularioSecao,
} from '@/types/formularios';

const TIPOS: FormularioCampoTipo[] = [
  'texto',
  'texto_curto',
  'texto_longo',
  'email',
  'telefone',
  'moeda',
  'numero',
  'data',
  'link',
  'select',
  'checkbox',
  'arquivo_multiplo',
  'link_ou_arquivo',
];

function tipoCampo(raw: string): FormularioCampoTipo {
  return TIPOS.includes(raw as FormularioCampoTipo) ? (raw as FormularioCampoTipo) : 'texto';
}

function statusDe(raw: string): FormularioRespostaStatus {
  if (raw === 'enviado' || raw === 'arquivado' || raw === 'em_preenchimento' || raw === 'iniciado' || raw === 'rascunho') {
    return raw;
  }
  return 'iniciado';
}

function nomeEmbed(rel: { nome?: string } | { nome?: string }[] | null | undefined): string {
  if (Array.isArray(rel)) return String(rel[0]?.nome ?? '');
  return String(rel?.nome ?? '');
}

type ListaRow = {
  id: string;
  formulario_id: string;
  status: string;
  enviado_em: string | null;
  created_at: string;
  nome_franqueado: string | null;
  numero_franquia: string | null;
  card_id: string | null;
  rede_franqueado_id: string | null;
  formularios?: { nome?: string } | { nome?: string }[] | null;
};

function mapLista(row: ListaRow): FormularioRespostaListaItem {
  return {
    id: row.id,
    formulario_id: row.formulario_id,
    formulario_nome: nomeEmbed(row.formularios),
    status: statusDe(row.status),
    enviado_em: row.enviado_em,
    criado_em: row.created_at,
    nome_franqueado: row.nome_franqueado,
    numero_franquia: row.numero_franquia,
    card_id: row.card_id,
    rede_franqueado_id: row.rede_franqueado_id,
  };
}

const SELECT_LISTA = `id, formulario_id, status, enviado_em, created_at,
  nome_franqueado, numero_franquia, card_id, rede_franqueado_id,
  formularios(nome)`;

const SELECT_LISTA_FRANK = `id, formulario_id, status, enviado_em, created_at,
  nome_franqueado, numero_franquia, card_id, rede_franqueado_id,
  formularios!inner(nome, visivel_franqueado)`;

export async function buscarFormularioPorToken(token: string): Promise<{
  formulario: Formulario | null;
  tokenData: { card_id: string | null; rede_franqueado_id: string | null } | null;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: tokenData, error: tokenErr } = await supabase
    .from('formulario_tokens')
    .select('id, formulario_id, card_id, rede_franqueado_id, usado, expira_em')
    .eq('token', token)
    .single();

  if (tokenErr || !tokenData) return { formulario: null, tokenData: null, error: 'Token inválido.' };
  if (tokenData.usado) return { formulario: null, tokenData: null, error: 'Este link já foi utilizado.' };
  if (tokenData.expira_em && new Date(tokenData.expira_em) < new Date()) {
    return { formulario: null, tokenData: null, error: 'Este link expirou.' };
  }

  const formulario = await _buscarFormularioComSecoes(String(tokenData.formulario_id));
  return {
    formulario,
    tokenData: {
      card_id: (tokenData.card_id as string | null) ?? null,
      rede_franqueado_id: (tokenData.rede_franqueado_id as string | null) ?? null,
    },
  };
}

export async function listarFormulariosAtivos(): Promise<Formulario[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let frank = false;
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    frank = isFrankOrFranqueadoRole((profile as { role?: string } | null)?.role);
  }
  let query = supabase
    .from('formularios')
    .select('id, nome, descricao, ativo, created_at, categoria, visivel_franqueado')
    .eq('ativo', true)
    .order('nome');
  if (frank) query = query.eq('visivel_franqueado', true);
  const { data, error } = await query;

  if (error || !data) return [];
  return (
    data as Array<{
      id: string;
      nome: string;
      descricao: string | null;
      ativo: boolean;
      created_at: string;
      categoria: string | null;
      visivel_franqueado: boolean | null;
    }>
  ).map((form) => ({
    id: form.id,
    nome: form.nome,
    descricao: form.descricao,
    ativo: form.ativo,
    criado_em: form.created_at,
    categoria: categoriaHubOuNull(form.categoria),
    visivel_franqueado: form.visivel_franqueado !== false,
    secoes: [],
  }));
}

export async function listarFormulariosVisivelFranqueado(): Promise<Formulario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('formularios')
    .select('id, nome, descricao, ativo, created_at, categoria, visivel_franqueado')
    .eq('ativo', true)
    .eq('visivel_franqueado', true)
    .order('nome');
  if (error || !data) return [];
  return (
    data as Array<{
      id: string;
      nome: string;
      descricao: string | null;
      ativo: boolean;
      created_at: string;
      categoria: string | null;
      visivel_franqueado: boolean | null;
    }>
  ).map((form) => ({
    id: form.id,
    nome: form.nome,
    descricao: form.descricao,
    ativo: form.ativo,
    criado_em: form.created_at,
    categoria: categoriaHubOuNull(form.categoria),
    visivel_franqueado: true,
    secoes: [],
  }));
}

export async function atualizarClassificacaoFormulario(
  formularioId: string,
  categoria: string,
  visivelFranqueado: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = String((profile as { role?: string } | null)?.role ?? '');
  if (isFrankOrFranqueadoRole(role)) return { ok: false, error: 'Sem permissão.' };
  const { error } = await supabase
    .from('formularios')
    .update({
      categoria: categoriaHubOuNull(categoria),
      visivel_franqueado: visivelFranqueado,
    })
    .eq('id', formularioId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listarRespostasDoFormulario(formularioId: string): Promise<FormularioRespostaListaItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('formulario_respostas')
    .select(SELECT_LISTA)
    .eq('formulario_id', formularioId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as unknown as ListaRow[]).map(mapLista);
}

export async function listarRespostasDoCard(cardId: string): Promise<FormularioRespostaListaItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('formulario_respostas')
    .select(SELECT_LISTA)
    .eq('card_id', cardId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as unknown as ListaRow[]).map(mapLista);
}

export async function listarRespostasDoFranqueado(redeFranqueadoId: string): Promise<FormularioRespostaListaItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase.from('profiles').select('role, rede_franqueado_id').eq('id', user.id).maybeSingle();
  const role = String((profile as { role?: string } | null)?.role ?? '');
  const frank = role === 'frank' || role === 'franqueado';
  if (frank && (profile as { rede_franqueado_id?: string | null } | null)?.rede_franqueado_id !== redeFranqueadoId) {
    return [];
  }
  const db = frank ? createAdminClient() : supabase;
  let query = db
    .from('formulario_respostas')
    .select(frank ? SELECT_LISTA_FRANK : SELECT_LISTA)
    .eq('rede_franqueado_id', redeFranqueadoId)
    .order('created_at', { ascending: false });
  if (frank) query = query.eq('formularios.visivel_franqueado', true);
  const { data, error } = await query;

  if (error || !data) return [];
  return (data as unknown as ListaRow[]).map(mapLista);
}

export async function buscarRespostaDetalhada(respostaId: string): Promise<FormularioResposta | null> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: resposta, error } = await supabase.from('formulario_respostas').select('*').eq('id', respostaId).single();
  if (error || !resposta) return null;

  const { data: valores } = await supabase
    .from('formulario_resposta_valores')
    .select('campo_id, valor_texto, valor_numero, valor_data, valor_json')
    .eq('resposta_id', respostaId);

  const { data: arquivos } = await admin
    .from('formulario_resposta_arquivos')
    .select('campo_id, nome_arquivo, storage_path, mime_type, tamanho_bytes')
    .eq('resposta_id', respostaId);

  const dados: FormularioResposta['dados'] = {};
  for (const valor of valores ?? []) {
    const row = valor as {
      campo_id: string;
      valor_texto: string | null;
      valor_numero: number | null;
      valor_data: string | null;
      valor_json: unknown;
    };
    let valorExibido: string | string[] | null = row.valor_texto;
    if (Array.isArray(row.valor_json)) valorExibido = row.valor_json.map((item) => String(item));
    else if (row.valor_data) valorExibido = row.valor_data;
    else if (row.valor_numero != null && !valorExibido) valorExibido = String(row.valor_numero);
    dados[row.campo_id] = { campo_id: row.campo_id, valor: valorExibido };
  }

  for (const arquivo of arquivos ?? []) {
    const row = arquivo as {
      campo_id: string;
      nome_arquivo: string;
      storage_path: string;
      mime_type: string | null;
      tamanho_bytes: number | null;
    };
    const { data: signed } = await admin.storage.from(FORMULARIOS_BUCKET).createSignedUrl(row.storage_path, 3600);
    const atual = dados[row.campo_id] ?? { campo_id: row.campo_id, valor: null };
    atual.arquivos = [
      ...(atual.arquivos ?? []),
      {
        nome: row.nome_arquivo,
        url: signed?.signedUrl ?? '',
        tamanho: Number(row.tamanho_bytes ?? 0),
        tipo: row.mime_type ?? '',
      },
    ];
    dados[row.campo_id] = atual;
  }

  const row = resposta as Record<string, unknown>;
  return {
    id: String(row.id),
    formulario_id: String(row.formulario_id),
    token_id: (row.token_id as string | null) ?? null,
    card_id: (row.card_id as string | null) ?? null,
    kanban_id: (row.kanban_id as string | null) ?? null,
    rede_franqueado_id: (row.rede_franqueado_id as string | null) ?? null,
    nome_franqueado: (row.nome_franqueado as string | null) ?? null,
    numero_franquia: (row.numero_franquia as string | null) ?? null,
    status: statusDe(String(row.status ?? '')),
    enviado_em: (row.enviado_em as string | null) ?? null,
    criado_em: String(row.created_at ?? ''),
    dados,
  };
}

export async function gerarTokenFormulario(params: {
  formularioId: string;
  cardId?: string | null;
  redeFranqueadoId?: string | null;
  expirarEm?: Date | null;
}): Promise<{ token: string | null; error?: string }> {
  const supabase = await createClient();
  const token = randomBytes(18).toString('hex').slice(0, 24);
  const { error } = await supabase.from('formulario_tokens').insert({
    formulario_id: params.formularioId,
    token,
    card_id: params.cardId ?? null,
    rede_franqueado_id: params.redeFranqueadoId ?? null,
    expira_em: params.expirarEm ? params.expirarEm.toISOString() : null,
  });
  if (error) return { token: null, error: 'Erro ao gerar link.' };
  return { token };
}

async function _buscarFormularioComSecoes(formularioId: string): Promise<Formulario | null> {
  const supabase = await createClient();
  const { data: form, error: formErr } = await supabase
    .from('formularios')
    .select('id, nome, descricao, ativo, created_at, categoria, visivel_franqueado')
    .eq('id', formularioId)
    .single();
  if (formErr || !form) return null;

  const { data: secoes } = await supabase
    .from('formulario_secoes')
    .select('id, formulario_id, nome, ordem, condicional_campo_id, condicional_valor')
    .eq('formulario_id', formularioId)
    .order('ordem');

  const secoesComCampos: FormularioSecao[] = await Promise.all(
    (secoes ?? []).map(async (secao) => {
      const secaoRow = secao as {
        id: string;
        formulario_id: string;
        nome: string;
        ordem: number;
        condicional_campo_id: string | null;
        condicional_valor: string | null;
      };
      const { data: campos } = await supabase
        .from('formulario_campos')
        .select('id, secao_id, nome, tipo, obrigatorio, ordem, opcoes, condicional_campo_id, condicional_valor')
        .eq('secao_id', secaoRow.id)
        .order('ordem');

      const camposMapeados: FormularioCampo[] = (campos ?? []).map((campo) => {
        const row = campo as {
          id: string;
          secao_id: string;
          nome: string;
          tipo: string;
          obrigatorio: boolean;
          ordem: number;
          opcoes: unknown;
          condicional_campo_id: string | null;
          condicional_valor: string | null;
        };
        return {
          id: row.id,
          secao_id: row.secao_id,
          label: row.nome,
          tipo: tipoCampo(row.tipo),
          obrigatorio: row.obrigatorio,
          ordem: row.ordem,
          placeholder: null,
          descricao: null,
          opcoes: opcoesParaLista(row.opcoes),
          condicional_campo_id: row.condicional_campo_id,
          condicional_valor: row.condicional_valor,
          ativo: true,
        };
      });

      return {
        id: secaoRow.id,
        formulario_id: secaoRow.formulario_id,
        titulo: secaoRow.nome,
        descricao: null,
        ordem: secaoRow.ordem,
        condicional_campo_id: secaoRow.condicional_campo_id,
        condicional_valor: secaoRow.condicional_valor,
        campos: camposMapeados,
      };
    }),
  );

  const formRow = form as {
    id: string;
    nome: string;
    descricao: string | null;
    ativo: boolean;
    created_at: string;
    categoria: string | null;
    visivel_franqueado: boolean | null;
  };
  return {
    id: formRow.id,
    nome: formRow.nome,
    descricao: formRow.descricao,
    ativo: formRow.ativo,
    criado_em: formRow.created_at,
    categoria: categoriaHubOuNull(formRow.categoria),
    visivel_franqueado: formRow.visivel_franqueado !== false,
    secoes: secoesComCampos,
  };
}

export async function listarFranqueadosParaSelect(): Promise<
  { id: string; numero_franquia: string | null; nome: string | null }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('rede_franqueados')
    .select('id, n_franquia, nome_completo')
    .order('n_franquia', { ascending: true });
  if (error || !data) return [];
  return (data as { id: string; n_franquia: string | null; nome_completo: string | null }[]).map((row) => ({
    id: row.id,
    numero_franquia: row.n_franquia != null ? String(row.n_franquia) : null,
    nome: row.nome_completo != null ? String(row.nome_completo) : null,
  }));
}
