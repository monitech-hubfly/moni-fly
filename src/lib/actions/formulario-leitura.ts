'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { FORMULARIOS_BUCKET } from '@/lib/constants/formularios-ids';
import { opcoesParaLista } from '@/lib/formularios/apresentacao';
import type {
  FormularioCampo,
  FormularioCampoConfig,
  FormularioCampoTipo,
  FormularioResposta,
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
  'select_estado',
  'select_cidade',
  'checkbox',
  'arquivo_multiplo',
  'link_ou_arquivo',
  'grupo_repetivel',
  'card_portfolio',
];

export type LeituraFormularioResposta = {
  formularioNome: string;
  categoria: string | null;
  resposta: FormularioResposta;
  secoes: FormularioSecao[];
};

function configCampo(raw: unknown): FormularioCampoConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as FormularioCampoConfig;
}

function tipoCampo(raw: string, config: FormularioCampoConfig | null): FormularioCampoTipo {
  if (config?.widget === 'card_portfolio') return 'card_portfolio';
  return TIPOS.includes(raw as FormularioCampoTipo) ? (raw as FormularioCampoTipo) : 'texto';
}

function statusDe(raw: string): FormularioRespostaStatus {
  if (raw === 'enviado' || raw === 'arquivado' || raw === 'em_preenchimento' || raw === 'iniciado' || raw === 'rascunho') {
    return raw;
  }
  return 'iniciado';
}

type ValorRow = {
  campo_id: string;
  valor_texto: string | null;
  valor_numero: number | null;
  valor_data: string | null;
  valor_json: unknown;
};

type ArquivoRow = {
  campo_id: string;
  nome_arquivo: string;
  storage_path: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
};

type CampoRow = {
  id: string;
  secao_id: string;
  nome: string | null;
  tipo: string | null;
  ordem: number | null;
  opcoes: unknown;
  config: unknown;
  condicional_campo_id: string | null;
  condicional_valor: string | null;
};

function um<T>(valor: T | T[] | null | undefined): T | null {
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

function lista<T>(valor: T | T[] | null | undefined): T[] {
  if (!valor) return [];
  return Array.isArray(valor) ? valor : [valor];
}

export async function carregarLeituraResposta(respostaId: string): Promise<LeituraFormularioResposta | null> {
  const id = respostaId.trim();
  if (!id) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: bruto, error } = await supabase
    .from('formulario_respostas')
    .select(
      `id, formulario_id, token_id, card_id, kanban_id, rede_franqueado_id, nome_franqueado, numero_franquia, status, enviado_em, created_at,
       formularios(nome, categoria),
       formulario_resposta_valores(campo_id, valor_texto, valor_numero, valor_data, valor_json),
       formulario_resposta_arquivos(campo_id, nome_arquivo, storage_path, mime_type, tamanho_bytes)`,
    )
    .eq('id', id)
    .maybeSingle();
  if (error || !bruto) return null;

  const row = bruto as Record<string, unknown>;
  const formularioId = String(row.formulario_id ?? '');
  const form = um(row.formularios as { nome?: string | null; categoria?: string | null } | null);
  const valores = lista(row.formulario_resposta_valores as ValorRow[] | null);
  const arquivos = lista(row.formulario_resposta_arquivos as ArquivoRow[] | null);

  const dados: FormularioResposta['dados'] = {};
  for (const valor of valores) {
    let valorExibido: string | string[] | null = valor.valor_texto;
    if (Array.isArray(valor.valor_json)) valorExibido = valor.valor_json.map((item) => String(item));
    else if (valor.valor_data) valorExibido = valor.valor_data;
    else if (valor.valor_numero != null && !valorExibido) valorExibido = String(valor.valor_numero);
    dados[valor.campo_id] = { campo_id: valor.campo_id, valor: valorExibido };
  }

  if (arquivos.length > 0) {
    const paths = arquivos.map((arquivo) => arquivo.storage_path).filter(Boolean);
    const assinados = new Map<string, string>();
    if (paths.length > 0) {
      const { data: urls } = await createAdminClient().storage.from(FORMULARIOS_BUCKET).createSignedUrls(paths, 3600);
      for (const item of urls ?? []) {
        if (item.path && item.signedUrl) assinados.set(item.path, item.signedUrl);
      }
    }
    for (const arquivo of arquivos) {
      const atual = dados[arquivo.campo_id] ?? { campo_id: arquivo.campo_id, valor: null };
      atual.arquivos = [
        ...(atual.arquivos ?? []),
        {
          nome: arquivo.nome_arquivo,
          url: assinados.get(arquivo.storage_path) ?? '',
          tamanho: Number(arquivo.tamanho_bytes ?? 0),
          tipo: arquivo.mime_type ?? '',
        },
      ];
      dados[arquivo.campo_id] = atual;
    }
  }

  const { data: secoes, error: secErr } = await supabase
    .from('formulario_secoes')
    .select(
      `id, nome, ordem, condicional_campo_id, condicional_valor,
       formulario_campos!formulario_campos_secao_id_fkey(id, secao_id, nome, tipo, ordem, opcoes, config, condicional_campo_id, condicional_valor)`,
    )
    .eq('formulario_id', formularioId)
    .order('ordem');
  if (secErr || !secoes) return null;

  const secoesMontadas: FormularioSecao[] = (secoes as Array<Record<string, unknown>>).map((secao) => {
    const campos = lista(secao.formulario_campos as CampoRow[] | null)
      .map((campo) => {
        const config = configCampo(campo.config);
        const item: FormularioCampo = {
          id: String(campo.id),
          secao_id: String(campo.secao_id ?? secao.id),
          label: String(campo.nome ?? ''),
          tipo: tipoCampo(String(campo.tipo ?? 'texto'), config),
          obrigatorio: false,
          ordem: Number(campo.ordem ?? 0),
          placeholder: null,
          descricao: null,
          opcoes: opcoesParaLista(campo.opcoes),
          config,
          condicional_campo_id: campo.condicional_campo_id,
          condicional_valor: campo.condicional_valor,
          ativo: true,
        };
        return item;
      })
      .sort((a, b) => a.ordem - b.ordem);
    return {
      id: String(secao.id),
      formulario_id: formularioId,
      titulo: String(secao.nome ?? ''),
      descricao: null,
      ordem: Number(secao.ordem ?? 0),
      condicional_campo_id: (secao.condicional_campo_id as string | null) ?? null,
      condicional_valor: (secao.condicional_valor as string | null) ?? null,
      campos,
    };
  });

  const resposta: FormularioResposta = {
    id: String(row.id),
    formulario_id: formularioId,
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

  return {
    formularioNome: String(form?.nome ?? ''),
    categoria: String(form?.categoria ?? '').trim() || null,
    resposta,
    secoes: secoesMontadas,
  };
}
