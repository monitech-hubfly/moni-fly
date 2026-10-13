'use server';

import { revalidatePath } from 'next/cache';
import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';
import {
  avaliarPendenciasAtendimentoJuridico,
  CAMPO_DOCUMENTO_FINAL_ASSINADO,
  documentoFinalAssinadoRegistrado,
  mensagemPendenciasAtendimentoJuridico,
  type PendenciasAtendimentoJuridico,
  type PontoParaPendenciaAtendimento,
} from '@/lib/kanban/juridico-atendimento-pendencias';
import {
  JURIDICO_PONTO_APLICACOES,
  JURIDICO_PONTO_DECISOES,
  JURIDICO_PONTO_FAQ_STATUS,
  erroVariacaoForaDoTipo,
  mensagemGateEnvioParceiro,
  mudancaRepositorioBloqueada,
  podeLerPontosJuridicos,
  pendenciaRepositorioPonto,
  rodadaAtualJuridico,
  type JuridicoPontoAplicacao,
  type JuridicoPontoDecisao,
  type JuridicoPontoFaqStatus,
  type JuridicoPontoTipo,
  type VisaoPontosJuridicos,
} from '@/lib/kanban/juridico-pontos';
import { criarArtigoFaq } from '@/lib/faq/actions';
import { publicarVersaoRepositorio } from '@/lib/repositorio/publicar-versao';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type PontoJuridicoRow = {
  id: string;
  juridico_card_id: string;
  tipo: JuridicoPontoTipo;
  rodada: number;
  ordem: number;
  duvida_recebida: string | null;
  resposta: string | null;
  clausula_trecho: string | null;
  solicitacao_alteracao: string | null;
  decisao: JuridicoPontoDecisao | null;
  texto_final_aprovado: string | null;
  aplicacao_futura: JuridicoPontoAplicacao | null;
  motivo_resposta: string | null;
  faq_status: JuridicoPontoFaqStatus | null;
  faq_article_id: string | null;
  faq_pergunta: string | null;
  faq_slug: string | null;
  faq_artigo_status: 'draft' | 'published' | 'archived' | null;
  repositorio_tipo_id: string | null;
  repositorio_variacao_id: string | null;
  repositorio_nova_variacao_nome: string | null;
  repositorio_nova_variacao_quando_utilizar: string | null;
  repositorio_tipo_nome: string | null;
  repositorio_variacao_nome: string | null;
  tem_versao_repositorio: boolean;
  repositorio_documento_id: string | null;
};

export type CatalogoRepositorioJuridico = {
  id: string;
  nome: string;
  tipos: { id: string; nome: string; variacoes: { id: string; nome: string }[] }[];
}[];

export type SalvarPontoJuridicoInput = {
  cardId: string;
  id?: string | null;
  tipo: JuridicoPontoTipo;
  duvida_recebida?: string | null;
  resposta?: string | null;
  clausula_trecho?: string | null;
  solicitacao_alteracao?: string | null;
  decisao?: string | null;
  texto_final_aprovado?: string | null;
  aplicacao_futura?: string | null;
  motivo_resposta?: string | null;
  faq_status?: string | null;
  faq_article_id?: string | null;
  repositorio_tipo_id?: string | null;
  repositorio_variacao_id?: string | null;
  repositorio_nova_variacao_nome?: string | null;
  repositorio_nova_variacao_quando?: string | null;
};

const SELECT_PONTO =
  'id, juridico_card_id, tipo, rodada, ordem, duvida_recebida, resposta, clausula_trecho, solicitacao_alteracao, decisao, texto_final_aprovado, aplicacao_futura, motivo_resposta, faq_status, faq_article_id, repositorio_tipo_id, repositorio_variacao_id, repositorio_nova_variacao_nome, repositorio_nova_variacao_quando_utilizar, faq_articles(question, slug, status), repositorio_tipos(nome), repositorio_variacoes(nome)';

/** Sem embeds: o service role do DEV não tem GRANT em faq_articles. A regra só precisa dos ids. */
const SELECT_PONTO_GATE =
  'id, juridico_card_id, tipo, rodada, ordem, duvida_recebida, resposta, clausula_trecho, solicitacao_alteracao, decisao, texto_final_aprovado, aplicacao_futura, motivo_resposta, faq_status, faq_article_id, repositorio_tipo_id, repositorio_variacao_id, repositorio_nova_variacao_nome, repositorio_nova_variacao_quando_utilizar';

function texto(valor: string | null | undefined): string | null {
  const t = String(valor ?? '').trim();
  return t || null;
}

function umDe<T extends string>(valor: string | null | undefined, lista: readonly T[]): T | null {
  const t = String(valor ?? '').trim();
  return (lista as readonly string[]).includes(t) ? (t as T) : null;
}

async function exigirStaffJuridico() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, erro: 'Faça login.' as const };
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = String((prof as { role?: string | null } | null)?.role ?? '');
  if (!podeLerPontosJuridicos(role)) {
    return { supabase, erro: 'Sem permissão para os Pontos Jurídicos.' as const };
  }
  return { supabase, userId: user.id, erro: null };
}

async function cardJuridico(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
) {
  const { data, error } = await supabase
    .from('kanban_cards')
    .select('id, kanban_id, juridico_bolinha_count, arquivado')
    .eq('id', cardId)
    .maybeSingle();
  if (error) return { erro: error.message, card: null };
  if (!data?.id || String(data.kanban_id ?? '') !== KANBAN_IDS.JURIDICO) {
    return { erro: 'Este card não é um atendimento do Funil Jurídico.', card: null };
  }
  return { erro: null, card: data as { id: string; juridico_bolinha_count?: number | null; arquivado?: boolean | null } };
}

function nomeRelacao(valor: unknown): string | null {
  const row = Array.isArray(valor) ? valor[0] : valor;
  if (!row || typeof row !== 'object') return null;
  return texto((row as { nome?: string | null }).nome);
}

function mapPonto(row: Record<string, unknown>): PontoJuridicoRow {
  const faq = row.faq_articles as
    | { question?: string | null; slug?: string | null; status?: string | null }
    | { question?: string | null; slug?: string | null; status?: string | null }[]
    | null;
  const faqRow = Array.isArray(faq) ? faq[0] : faq;
  const statusArtigo = String(faqRow?.status ?? '');
  return {
    id: String(row.id),
    juridico_card_id: String(row.juridico_card_id),
    tipo: row.tipo === 'alteracao' ? 'alteracao' : 'duvida',
    rodada: Number(row.rodada),
    ordem: Number(row.ordem),
    duvida_recebida: texto(row.duvida_recebida as string | null),
    resposta: texto(row.resposta as string | null),
    clausula_trecho: texto(row.clausula_trecho as string | null),
    solicitacao_alteracao: texto(row.solicitacao_alteracao as string | null),
    decisao: umDe(row.decisao as string | null, JURIDICO_PONTO_DECISOES),
    texto_final_aprovado: texto(row.texto_final_aprovado as string | null),
    aplicacao_futura: umDe(row.aplicacao_futura as string | null, JURIDICO_PONTO_APLICACOES),
    motivo_resposta: texto(row.motivo_resposta as string | null),
    faq_status: umDe(row.faq_status as string | null, JURIDICO_PONTO_FAQ_STATUS),
    faq_article_id: texto(row.faq_article_id as string | null),
    faq_pergunta: texto(faqRow?.question),
    faq_slug: texto(faqRow?.slug),
    faq_artigo_status:
      statusArtigo === 'draft' || statusArtigo === 'published' || statusArtigo === 'archived' ? statusArtigo : null,
    repositorio_tipo_id: texto(row.repositorio_tipo_id as string | null),
    repositorio_variacao_id: texto(row.repositorio_variacao_id as string | null),
    repositorio_nova_variacao_nome: texto(row.repositorio_nova_variacao_nome as string | null),
    repositorio_nova_variacao_quando_utilizar: texto(row.repositorio_nova_variacao_quando_utilizar as string | null),
    repositorio_tipo_nome: nomeRelacao(row.repositorio_tipos),
    repositorio_variacao_nome: nomeRelacao(row.repositorio_variacoes),
    tem_versao_repositorio: false,
    repositorio_documento_id: null,
  };
}

function intencaoRepositorio(input: SalvarPontoJuridicoInput, variacaoPreservada: string | null) {
  const decisao = umDe(input.decisao, JURIDICO_PONTO_DECISOES);
  const aceita = decisao === 'aceita' || decisao === 'aceita_parcialmente';
  const aplicacao = aceita ? umDe(input.aplicacao_futura, JURIDICO_PONTO_APLICACOES) : null;
  const vazio = {
    repositorio_tipo_id: null as string | null,
    repositorio_variacao_id: null as string | null,
    repositorio_nova_variacao_nome: null as string | null,
    repositorio_nova_variacao_quando_utilizar: null as string | null,
  };
  if (!aceita || !aplicacao || aplicacao === 'somente_este_documento') return vazio;
  const tipoId = texto(input.repositorio_tipo_id);
  if (aplicacao === 'alterar_documento_padrao') return { ...vazio, repositorio_tipo_id: tipoId };
  if (aplicacao === 'criar_nova_variacao') {
    return {
      ...vazio,
      repositorio_tipo_id: tipoId,
      repositorio_variacao_id: variacaoPreservada,
      repositorio_nova_variacao_nome: texto(input.repositorio_nova_variacao_nome),
      repositorio_nova_variacao_quando_utilizar: texto(input.repositorio_nova_variacao_quando),
    };
  }
  return {
    ...vazio,
    repositorio_tipo_id: tipoId,
    repositorio_variacao_id: texto(input.repositorio_variacao_id),
  };
}

function exigirIntencaoRepositorio(campos: {
  aplicacao_futura: string | null;
  repositorio_tipo_id: string | null;
  repositorio_variacao_id: string | null;
  repositorio_nova_variacao_nome: string | null;
  repositorio_nova_variacao_quando_utilizar: string | null;
}): string | null {
  if (campos.aplicacao_futura === 'alterar_documento_padrao' && !campos.repositorio_tipo_id) {
    return 'Selecione o tipo de documento.';
  }
  if (campos.aplicacao_futura === 'criar_nova_variacao') {
    if (!campos.repositorio_tipo_id) return 'Selecione o tipo de documento.';
    if (!campos.repositorio_nova_variacao_nome) return 'Informe o nome da variação.';
    if (!campos.repositorio_nova_variacao_quando_utilizar) return 'Informe quando utilizar.';
  }
  if (campos.aplicacao_futura === 'alterar_variacao_existente') {
    if (!campos.repositorio_tipo_id) return 'Selecione o tipo de documento.';
    if (!campos.repositorio_variacao_id) return 'Selecione a variação.';
  }
  return null;
}

async function validarAlvoRepositorio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campos: { repositorio_tipo_id: string | null; repositorio_variacao_id: string | null },
): Promise<string | null> {
  if (!campos.repositorio_tipo_id) return null;
  const { data: tipo, error } = await supabase
    .from('repositorio_tipos')
    .select('id')
    .eq('id', campos.repositorio_tipo_id)
    .maybeSingle();
  if (error) return error.message;
  if (!tipo?.id) return 'Tipo de documento não encontrado.';
  if (!campos.repositorio_variacao_id) return null;
  const { data: variacao, error: errVariacao } = await supabase
    .from('repositorio_variacoes')
    .select('id, tipo_id')
    .eq('id', campos.repositorio_variacao_id)
    .maybeSingle();
  if (errVariacao) return errVariacao.message;
  const fora = erroVariacaoForaDoTipo(campos.repositorio_tipo_id, variacao?.id ? String(variacao.tipo_id) : null);
  if (!variacao?.id || fora) return fora ?? 'A variação não pertence ao tipo selecionado.';
  return null;
}

/**
 * Trocar Retroalimentar não apaga o rascunho da Central de Ajuda.
 * O vínculo fica no ponto para o próximo envio reutilizar o mesmo draft.
 */
async function preservarRascunhoFaq(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pontoId: string,
): Promise<string | null> {
  const { data: atual, error } = await supabase
    .from('juridico_pontos')
    .select('faq_article_id')
    .eq('id', pontoId)
    .maybeSingle();
  if (error) return null;
  const articleId = texto((atual as { faq_article_id?: string | null } | null)?.faq_article_id);
  if (!articleId) return null;
  const { data: artigo, error: errArtigo } = await supabase
    .from('faq_articles')
    .select('id, status')
    .eq('id', articleId)
    .maybeSingle();
  if (errArtigo || !artigo?.id) return null;
  if (String(artigo.status ?? '') !== 'draft') return null;
  return articleId;
}

function payloadCampos(input: SalvarPontoJuridicoInput, variacaoPreservada: string | null) {
  const faqStatus = umDe(input.faq_status, JURIDICO_PONTO_FAQ_STATUS);
  const decisao = umDe(input.decisao, JURIDICO_PONTO_DECISOES);
  const artigo =
    faqStatus === 'ja_existe' || faqStatus === 'retroalimentar' ? texto(input.faq_article_id) : null;
  const repo = intencaoRepositorio(input, variacaoPreservada);
  if (input.tipo === 'duvida') {
    return {
      tipo: 'duvida' as const,
      duvida_recebida: texto(input.duvida_recebida),
      resposta: texto(input.resposta),
      faq_status: faqStatus,
      faq_article_id: artigo,
      clausula_trecho: null,
      solicitacao_alteracao: null,
      decisao: null,
      texto_final_aprovado: null,
      aplicacao_futura: null,
      motivo_resposta: null,
      repositorio_tipo_id: null,
      repositorio_variacao_id: null,
      repositorio_nova_variacao_nome: null,
      repositorio_nova_variacao_quando_utilizar: null,
    };
  }
  const aceita = decisao === 'aceita' || decisao === 'aceita_parcialmente';
  const recusada = decisao === 'nao_aceita';
  return {
    tipo: 'alteracao' as const,
    duvida_recebida: null,
    resposta: null,
    clausula_trecho: texto(input.clausula_trecho),
    solicitacao_alteracao: texto(input.solicitacao_alteracao),
    decisao,
    texto_final_aprovado: aceita || !decisao ? texto(input.texto_final_aprovado) : null,
    aplicacao_futura: aceita || !decisao ? umDe(input.aplicacao_futura, JURIDICO_PONTO_APLICACOES) : null,
    motivo_resposta: recusada || !decisao ? texto(input.motivo_resposta) : null,
    faq_status: recusada || !decisao ? faqStatus : null,
    faq_article_id: recusada || !decisao ? artigo : null,
    ...repo,
  };
}

export async function listarPontosJuridicos(cardId: string): Promise<
  | { ok: true; rodadaAtual: number; pontos: PontoJuridicoRow[] }
  | { ok: false; error: string }
> {
  const acesso = await exigirStaffJuridico();
  if (acesso.erro) return { ok: false, error: acesso.erro };
  const card = await cardJuridico(acesso.supabase, cardId);
  if (card.erro || !card.card) return { ok: false, error: card.erro ?? 'Card inválido.' };
  const gravada = Number(card.card.juridico_bolinha_count ?? 0);
  const rodadaAtual = gravada >= 1 ? gravada : 1;
  const { data, error } = await acesso.supabase
    .from('juridico_pontos')
    .select(SELECT_PONTO)
    .eq('juridico_card_id', cardId)
    .order('rodada', { ascending: false })
    .order('ordem', { ascending: true });
  if (error) return { ok: false, error: error.message };
  const pontos = ((data ?? []) as Record<string, unknown>[]).map(mapPonto);
  const ids = pontos.map((ponto) => ponto.id);
  if (ids.length > 0) {
    const { data: versoes, error: errVersoes } = await acesso.supabase
      .from('repositorio_documentos')
      .select('id, juridico_ponto_id')
      .in('juridico_ponto_id', ids);
    if (errVersoes) return { ok: false, error: errVersoes.message };
    const porPonto = new Map<string, string>();
    for (const versao of versoes ?? []) {
      const pontoId = texto((versao as { juridico_ponto_id?: string | null }).juridico_ponto_id);
      const docId = texto((versao as { id?: string | null }).id);
      if (pontoId && docId) porPonto.set(pontoId, docId);
    }
    for (const ponto of pontos) {
      const docId = porPonto.get(ponto.id) ?? null;
      ponto.tem_versao_repositorio = Boolean(docId);
      ponto.repositorio_documento_id = docId;
    }
  }
  return { ok: true, rodadaAtual, pontos };
}

export async function salvarPontoJuridico(
  input: SalvarPontoJuridicoInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const acesso = await exigirStaffJuridico();
  if (acesso.erro || !acesso.userId) return { ok: false, error: acesso.erro ?? 'Sem permissão.' };
  if (input.tipo !== 'duvida' && input.tipo !== 'alteracao') {
    return { ok: false, error: 'Escolha Dúvida ou Alteração.' };
  }
  const card = await cardJuridico(acesso.supabase, input.cardId);
  if (card.erro || !card.card) return { ok: false, error: card.erro ?? 'Card inválido.' };
  if (card.card.arquivado) return { ok: false, error: 'Atendimento arquivado não recebe alteração de pontos.' };

  const id = texto(input.id);
  let variacaoPreservada: string | null = null;
  let atualRepo: {
    tipo: string;
    decisao: string | null;
    aplicacao_futura: string | null;
    repositorio_tipo_id: string | null;
    repositorio_variacao_id: string | null;
    repositorio_nova_variacao_nome: string | null;
    repositorio_nova_variacao_quando_utilizar: string | null;
  } | null = null;

  if (id) {
    const { data: atual, error: errAtual } = await acesso.supabase
      .from('juridico_pontos')
      .select(
        'id, juridico_card_id, tipo, decisao, aplicacao_futura, repositorio_tipo_id, repositorio_variacao_id, repositorio_nova_variacao_nome, repositorio_nova_variacao_quando_utilizar',
      )
      .eq('id', id)
      .maybeSingle();
    if (errAtual) return { ok: false, error: errAtual.message };
    if (!atual?.id || String(atual.juridico_card_id) !== input.cardId) {
      return { ok: false, error: 'Ponto não encontrado neste atendimento.' };
    }
    atualRepo = {
      tipo: String(atual.tipo),
      decisao: texto(atual.decisao as string | null),
      aplicacao_futura: texto(atual.aplicacao_futura as string | null),
      repositorio_tipo_id: texto(atual.repositorio_tipo_id as string | null),
      repositorio_variacao_id: texto(atual.repositorio_variacao_id as string | null),
      repositorio_nova_variacao_nome: texto(atual.repositorio_nova_variacao_nome as string | null),
      repositorio_nova_variacao_quando_utilizar: texto(atual.repositorio_nova_variacao_quando_utilizar as string | null),
    };
    const { data: versao, error: errVersao } = await acesso.supabase
      .from('repositorio_documentos')
      .select('id')
      .eq('juridico_ponto_id', id)
      .maybeSingle();
    if (errVersao) return { ok: false, error: errVersao.message };
    if (versao?.id && atualRepo.aplicacao_futura === 'criar_nova_variacao') {
      variacaoPreservada = atualRepo.repositorio_variacao_id;
    }
  }

  const campos = payloadCampos(input, variacaoPreservada);
  if (id && !campos.faq_article_id && campos.faq_status !== 'ja_existe') {
    const preservado = await preservarRascunhoFaq(acesso.supabase, id);
    if (preservado) campos.faq_article_id = preservado;
  }

  if (id && atualRepo) {
    const { data: versao, error: errVersao } = await acesso.supabase
      .from('repositorio_documentos')
      .select('id')
      .eq('juridico_ponto_id', id)
      .maybeSingle();
    if (errVersao) return { ok: false, error: errVersao.message };
    if (
      mudancaRepositorioBloqueada(Boolean(versao?.id), {
        aplicacaoFutura: atualRepo.aplicacao_futura,
        repositorioTipoId: atualRepo.repositorio_tipo_id,
        repositorioVariacaoId: atualRepo.repositorio_variacao_id,
        novaVariacaoNome: atualRepo.repositorio_nova_variacao_nome,
        novaVariacaoQuando: atualRepo.repositorio_nova_variacao_quando_utilizar,
      }, {
        aplicacaoFutura: campos.aplicacao_futura,
        repositorioTipoId: campos.repositorio_tipo_id,
        repositorioVariacaoId: campos.repositorio_variacao_id,
        novaVariacaoNome: campos.repositorio_nova_variacao_nome,
        novaVariacaoQuando: campos.repositorio_nova_variacao_quando_utilizar,
      })
    ) {
      return {
        ok: false,
        error: 'Já existe versão no Repositório ligada a este ponto. O histórico não será apagado.',
      };
    }
  }

  const exigencia = exigirIntencaoRepositorio(campos);
  if (exigencia) return { ok: false, error: exigencia };
  const alvo = await validarAlvoRepositorio(acesso.supabase, campos);
  if (alvo) return { ok: false, error: alvo };

  if (id && atualRepo) {
    const { error } = await acesso.supabase.from('juridico_pontos').update(campos).eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id };
  }

  const gravada = Number(card.card.juridico_bolinha_count ?? 0);
  const rodada = gravada >= 1 ? gravada : 1;
  const { data: ultimo } = await acesso.supabase
    .from('juridico_pontos')
    .select('ordem')
    .eq('juridico_card_id', input.cardId)
    .eq('rodada', rodada)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordem = Number((ultimo as { ordem?: number } | null)?.ordem ?? 0) + 1;
  const { data, error } = await acesso.supabase
    .from('juridico_pontos')
    .insert({
      juridico_card_id: input.cardId,
      rodada,
      ordem,
      criado_por: acesso.userId,
      ...campos,
    })
    .select('id')
    .single();
  if (error || !data?.id) return { ok: false, error: error?.message ?? 'Não foi possível criar o ponto.' };
  return { ok: true, id: String(data.id) };
}

export async function excluirPontoJuridico(
  cardId: string,
  pontoId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const acesso = await exigirStaffJuridico();
  if (acesso.erro) return { ok: false, error: acesso.erro };
  const card = await cardJuridico(acesso.supabase, cardId);
  if (card.erro || !card.card) return { ok: false, error: card.erro ?? 'Card inválido.' };
  if (card.card.arquivado) return { ok: false, error: 'Atendimento arquivado não recebe alteração de pontos.' };
  const { error } = await acesso.supabase
    .from('juridico_pontos')
    .delete()
    .eq('id', pontoId)
    .eq('juridico_card_id', cardId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function moverPontoJuridico(
  cardId: string,
  pontoId: string,
  direcao: 'subir' | 'descer',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const acesso = await exigirStaffJuridico();
  if (acesso.erro) return { ok: false, error: acesso.erro };
  const card = await cardJuridico(acesso.supabase, cardId);
  if (card.erro || !card.card) return { ok: false, error: card.erro ?? 'Card inválido.' };
  if (card.card.arquivado) return { ok: false, error: 'Atendimento arquivado não recebe alteração de pontos.' };

  const { data, error } = await acesso.supabase
    .from('juridico_pontos')
    .select('id, rodada, ordem')
    .eq('juridico_card_id', cardId);
  if (error) return { ok: false, error: error.message };
  const todos = (data ?? []) as Array<{ id: string; rodada: number; ordem: number }>;
  const atual = todos.find((p) => p.id === pontoId);
  if (!atual) return { ok: false, error: 'Ponto não encontrado neste atendimento.' };
  const faixa = todos
    .filter((p) => p.rodada === atual.rodada)
    .sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
  const indice = faixa.findIndex((p) => p.id === pontoId);
  const destino = direcao === 'subir' ? indice - 1 : indice + 1;
  if (indice < 0 || destino < 0 || destino >= faixa.length) return { ok: true };
  const reordenado = [...faixa];
  const [item] = reordenado.splice(indice, 1);
  reordenado.splice(destino, 0, item);
  for (let i = 0; i < reordenado.length; i += 1) {
    const { error: errOrd } = await acesso.supabase
      .from('juridico_pontos')
      .update({ ordem: i + 1 })
      .eq('id', reordenado[i].id)
      .eq('juridico_card_id', cardId);
    if (errOrd) return { ok: false, error: errOrd.message };
  }
  return { ok: true };
}

export async function reordenarPontosJuridicos(
  cardId: string,
  idsOrdenados: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const acesso = await exigirStaffJuridico();
  if (acesso.erro) return { ok: false, error: acesso.erro };
  const card = await cardJuridico(acesso.supabase, cardId);
  if (card.erro || !card.card) return { ok: false, error: card.erro ?? 'Card inválido.' };
  if (card.card.arquivado) return { ok: false, error: 'Atendimento arquivado não recebe alteração de pontos.' };

  const ids = idsOrdenados.map((id) => String(id).trim()).filter(Boolean);
  if (ids.length === 0) return { ok: true };
  if (new Set(ids).size !== ids.length) return { ok: false, error: 'Ordem inválida.' };

  const { data, error } = await acesso.supabase
    .from('juridico_pontos')
    .select('id, rodada')
    .eq('juridico_card_id', cardId);
  if (error) return { ok: false, error: error.message };
  const todos = (data ?? []) as Array<{ id: string; rodada: number }>;
  const porId = new Map(todos.map((ponto) => [ponto.id, ponto]));
  const selecionados = ids.map((id) => porId.get(id));
  if (selecionados.some((ponto) => !ponto)) {
    return { ok: false, error: 'Ponto não encontrado neste atendimento.' };
  }
  const rodada = selecionados[0]?.rodada;
  if (selecionados.some((ponto) => ponto?.rodada !== rodada)) {
    return { ok: false, error: 'A ordem vale só dentro da mesma rodada.' };
  }
  const daRodada = todos.filter((ponto) => ponto.rodada === rodada);
  if (daRodada.length !== ids.length) {
    return { ok: false, error: 'A ordem precisa incluir todos os pontos da rodada.' };
  }

  for (let i = 0; i < ids.length; i += 1) {
    const { error: errOrd } = await acesso.supabase
      .from('juridico_pontos')
      .update({ ordem: i + 1 })
      .eq('id', ids[i])
      .eq('juridico_card_id', cardId);
    if (errOrd) return { ok: false, error: errOrd.message };
  }
  return { ok: true };
}

export async function listarCatalogoFaqJuridico(): Promise<
  | { ok: true; categorias: { id: string; name: string }[]; areas: string[]; areaSugerida: string | null }
  | { ok: false; error: string }
> {
  const acesso = await exigirStaffJuridico();
  if (acesso.erro) return { ok: false, error: acesso.erro };
  const { data: cats, error: errCat } = await acesso.supabase
    .from('faq_categories')
    .select('id, name')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  if (errCat) return { ok: false, error: errCat.message };
  const { data: areasRows, error: errArea } = await acesso.supabase
    .from('faq_articles')
    .select('responsible_area')
    .not('responsible_area', 'is', null);
  if (errArea) return { ok: false, error: errArea.message };
  const areas = [
    ...new Set(
      ((areasRows ?? []) as Array<{ responsible_area?: string | null }>)
        .map((row) => String(row.responsible_area ?? '').trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const areaSugerida = areas.find((area) => area.toLowerCase() === 'jurídico' || area.toLowerCase() === 'juridico') ?? null;
  return {
    ok: true,
    categorias: ((cats ?? []) as Array<{ id: string; name: string }>).map((c) => ({
      id: String(c.id),
      name: String(c.name ?? ''),
    })),
    areas,
    areaSugerida,
  };
}

export async function enviarPontoParaCentralAjuda(input: {
  cardId: string;
  pontoId: string;
  pergunta: string;
  resposta: string;
  categoryId: string;
  responsibleArea: string;
}): Promise<
  | { ok: true; articleId: string; slug: string; status: string; question: string; jaVinculado: boolean }
  | { ok: false; error: string }
> {
  const acesso = await exigirStaffJuridico();
  if (acesso.erro) return { ok: false, error: acesso.erro };
  const card = await cardJuridico(acesso.supabase, input.cardId);
  if (card.erro || !card.card) return { ok: false, error: card.erro ?? 'Card inválido.' };
  if (card.card.arquivado) return { ok: false, error: 'Atendimento arquivado não recebe alteração de pontos.' };

  const pontoId = texto(input.pontoId);
  if (!pontoId) return { ok: false, error: 'Salve o ponto antes de enviar para a Central de Ajuda.' };
  const { data: ponto, error: errPonto } = await acesso.supabase
    .from('juridico_pontos')
    .select('id, tipo, decisao, faq_status, faq_article_id')
    .eq('id', pontoId)
    .eq('juridico_card_id', input.cardId)
    .maybeSingle();
  if (errPonto) return { ok: false, error: errPonto.message };
  if (!ponto?.id) return { ok: false, error: 'Ponto não encontrado neste atendimento.' };
  const tipo = String(ponto.tipo ?? '');
  const decisao = String(ponto.decisao ?? '');
  if (tipo !== 'duvida' && !(tipo === 'alteracao' && decisao === 'nao_aceita')) {
    return { ok: false, error: 'A sugestão de FAQ vale para dúvida ou alteração não aceita.' };
  }

  const jaVinculado = texto(ponto.faq_article_id as string | null);
  if (jaVinculado && String(ponto.faq_status ?? '') === 'retroalimentar') {
    const { data: existente, error: errExistente } = await acesso.supabase
      .from('faq_articles')
      .select('id, question, slug, status')
      .eq('id', jaVinculado)
      .maybeSingle();
    if (errExistente) return { ok: false, error: errExistente.message };
    if (existente?.id) {
      return {
        ok: true,
        jaVinculado: true,
        articleId: String(existente.id),
        slug: String(existente.slug ?? ''),
        status: String(existente.status ?? ''),
        question: String(existente.question ?? ''),
      };
    }
  }

  const pergunta = texto(input.pergunta);
  const resposta = texto(input.resposta);
  const categoryId = texto(input.categoryId);
  const area = texto(input.responsibleArea);
  if (!pergunta) return { ok: false, error: 'Informe a pergunta.' };
  if (!resposta) return { ok: false, error: 'Informe a resposta.' };
  if (!categoryId) return { ok: false, error: 'Escolha a categoria.' };
  if (!area) return { ok: false, error: 'Escolha a área responsável.' };

  const { data: categoria, error: errCat } = await acesso.supabase
    .from('faq_categories')
    .select('id, is_active')
    .eq('id', categoryId)
    .maybeSingle();
  if (errCat) return { ok: false, error: errCat.message };
  if (!categoria?.id || categoria.is_active === false) {
    return { ok: false, error: 'Escolha uma categoria ativa da Central de Ajuda.' };
  }

  const { data: areaRow, error: errArea } = await acesso.supabase
    .from('faq_articles')
    .select('id')
    .eq('responsible_area', area)
    .limit(1)
    .maybeSingle();
  if (errArea) return { ok: false, error: errArea.message };
  if (!areaRow?.id) return { ok: false, error: 'Escolha uma área responsável já usada na Central de Ajuda.' };

  const criado = await criarArtigoFaq({
    question: pergunta,
    answer: resposta,
    category_id: categoryId,
    responsible_area: area,
    status: 'draft',
    keywords: [],
    synonyms: [],
    visibility: ['frank', 'team', 'admin'],
    is_featured: false,
    display_order: 0,
  });
  if (!criado.ok || !criado.id) return { ok: false, error: criado.error ?? 'Não foi possível criar o rascunho.' };

  let vinculo = acesso.supabase
    .from('juridico_pontos')
    .update({ faq_status: 'retroalimentar', faq_article_id: criado.id })
    .eq('id', pontoId)
    .eq('juridico_card_id', input.cardId);
  vinculo = jaVinculado ? vinculo.eq('faq_article_id', jaVinculado) : vinculo.is('faq_article_id', null);
  const { data: gravado, error: errVinculo } = await vinculo.select('id').maybeSingle();
  if (errVinculo || !gravado?.id) {
    await acesso.supabase.from('faq_articles').delete().eq('id', criado.id);
    if (errVinculo) return { ok: false, error: errVinculo.message };
    const { data: vigente } = await acesso.supabase
      .from('juridico_pontos')
      .select('faq_article_id, faq_articles(question, slug, status)')
      .eq('id', pontoId)
      .maybeSingle();
    const artigoVigente = vigente?.faq_articles as
      | { question?: string | null; slug?: string | null; status?: string | null }
      | { question?: string | null; slug?: string | null; status?: string | null }[]
      | null;
    const vigenteRow = Array.isArray(artigoVigente) ? artigoVigente[0] : artigoVigente;
    const vigenteId = texto(vigente?.faq_article_id as string | null);
    if (!vigenteId) return { ok: false, error: 'Não foi possível vincular o rascunho.' };
    return {
      ok: true,
      jaVinculado: true,
      articleId: vigenteId,
      slug: String(vigenteRow?.slug ?? ''),
      status: String(vigenteRow?.status ?? ''),
      question: String(vigenteRow?.question ?? ''),
    };
  }

  const { data: artigo } = await acesso.supabase
    .from('faq_articles')
    .select('id, question, slug, status')
    .eq('id', criado.id)
    .maybeSingle();
  return {
    ok: true,
    jaVinculado: false,
    articleId: criado.id,
    slug: String(artigo?.slug ?? ''),
    status: String(artigo?.status ?? 'draft'),
    question: String(artigo?.question ?? pergunta),
  };
}

export async function listarCatalogoRepositorioJuridico(): Promise<
  { ok: true; secoes: CatalogoRepositorioJuridico } | { ok: false; error: string }
> {
  const acesso = await exigirStaffJuridico();
  if (acesso.erro) return { ok: false, error: acesso.erro };
  const { data, error } = await acesso.supabase
    .from('repositorio_secoes')
    .select('id, nome, ordem, repositorio_tipos(id, nome, ordem, repositorio_variacoes(id, nome, ordem))')
    .order('ordem', { ascending: true });
  if (error) return { ok: false, error: error.message };
  const secoes = ((data ?? []) as Record<string, unknown>[]).map((secao) => {
    const tiposRaw = Array.isArray(secao.repositorio_tipos) ? secao.repositorio_tipos : [];
    const tipos = tiposRaw
      .map((tipo) => {
        const row = tipo as { id?: string; nome?: string; ordem?: number; repositorio_variacoes?: unknown };
        const variacoesRaw = Array.isArray(row.repositorio_variacoes) ? row.repositorio_variacoes : [];
        const variacoes = variacoesRaw
          .map((variacao) => {
            const item = variacao as { id?: string; nome?: string; ordem?: number };
            return { id: String(item.id ?? ''), nome: String(item.nome ?? ''), ordem: Number(item.ordem ?? 0) };
          })
          .filter((item) => item.id)
          .sort((a, b) => a.ordem - b.ordem)
          .map(({ id: variacaoId, nome }) => ({ id: variacaoId, nome }));
        return { id: String(row.id ?? ''), nome: String(row.nome ?? ''), ordem: Number(row.ordem ?? 0), variacoes };
      })
      .filter((tipo) => tipo.id)
      .sort((a, b) => a.ordem - b.ordem)
      .map(({ id: tipoId, nome, variacoes }) => ({ id: tipoId, nome, variacoes }));
    return { id: String(secao.id), nome: String(secao.nome ?? ''), tipos };
  });
  return { ok: true, secoes };
}

export async function resolverPendenciaRepositorioPonto(
  formData: FormData,
): Promise<{ ok: true; documentoId: string } | { ok: false; error: string }> {
  const acesso = await exigirStaffJuridico();
  if (acesso.erro || !acesso.userId) return { ok: false, error: acesso.erro ?? 'Sem permissão.' };
  const pontoId = String(formData.get('ponto_id') ?? '').trim();
  const arquivo = formData.get('arquivo');
  if (!pontoId) return { ok: false, error: 'Ponto inválido.' };
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, error: 'Selecione um arquivo.' };

  const { data: ponto, error: errPonto } = await acesso.supabase
    .from('juridico_pontos')
    .select(
      'id, juridico_card_id, tipo, decisao, aplicacao_futura, repositorio_tipo_id, repositorio_variacao_id, repositorio_nova_variacao_nome, repositorio_nova_variacao_quando_utilizar',
    )
    .eq('id', pontoId)
    .maybeSingle();
  if (errPonto) return { ok: false, error: errPonto.message };
  if (!ponto?.id) return { ok: false, error: 'Ponto não encontrado.' };

  const card = await cardJuridico(acesso.supabase, String(ponto.juridico_card_id));
  if (card.erro || !card.card) return { ok: false, error: card.erro ?? 'Card inválido.' };
  if (card.card.arquivado) return { ok: false, error: 'Atendimento arquivado não recebe alteração de pontos.' };

  const { data: existente, error: errExistente } = await acesso.supabase
    .from('repositorio_documentos')
    .select('id')
    .eq('juridico_ponto_id', pontoId)
    .maybeSingle();
  if (errExistente) return { ok: false, error: errExistente.message };
  if (existente?.id) return { ok: true, documentoId: String(existente.id) };

  const aplicacao = String(ponto.aplicacao_futura ?? '');
  const estado = pendenciaRepositorioPonto({
    tipo: String(ponto.tipo),
    decisao: String(ponto.decisao ?? ''),
    aplicacaoFutura: aplicacao,
    temVersaoRepositorio: false,
  });
  if (estado !== 'pendente') return { ok: false, error: 'Este ponto não tem pendência no Repositório.' };

  const tipoId = texto(ponto.repositorio_tipo_id as string | null);
  if (!tipoId) return { ok: false, error: 'Selecione o tipo de documento.' };
  const { data: tipo, error: errTipo } = await acesso.supabase
    .from('repositorio_tipos')
    .select('id, secao_id')
    .eq('id', tipoId)
    .maybeSingle();
  if (errTipo) return { ok: false, error: errTipo.message };
  if (!tipo?.id) return { ok: false, error: 'Tipo de documento não encontrado.' };
  const secaoId = String(tipo.secao_id);

  if (aplicacao === 'alterar_documento_padrao') {
    const publicado = await publicarVersaoRepositorio({
      secaoId,
      tipoId,
      arquivo,
      userId: acesso.userId,
      tipoAlvo: { tipo_id: tipoId },
      juridicoPontoId: pontoId,
    });
    if (!publicado.ok) return publicado;
    revalidatePath('/repositorio');
    return { ok: true, documentoId: publicado.id };
  }

  if (aplicacao === 'alterar_variacao_existente') {
    const variacaoId = texto(ponto.repositorio_variacao_id as string | null);
    if (!variacaoId) return { ok: false, error: 'Selecione a variação.' };
    const { data: variacao, error: errVariacao } = await acesso.supabase
      .from('repositorio_variacoes')
      .select('id, tipo_id')
      .eq('id', variacaoId)
      .maybeSingle();
    if (errVariacao) return { ok: false, error: errVariacao.message };
    const foraDoTipo = erroVariacaoForaDoTipo(tipoId, variacao?.id ? String(variacao.tipo_id) : null);
    if (!variacao?.id || foraDoTipo) {
      return { ok: false, error: foraDoTipo ?? 'A variação não pertence ao tipo selecionado.' };
    }
    const publicado = await publicarVersaoRepositorio({
      secaoId,
      tipoId,
      arquivo,
      userId: acesso.userId,
      tipoAlvo: { variacao_id: variacaoId },
      juridicoPontoId: pontoId,
    });
    if (!publicado.ok) return publicado;
    revalidatePath('/repositorio');
    return { ok: true, documentoId: publicado.id };
  }

  if (aplicacao !== 'criar_nova_variacao') {
    return { ok: false, error: 'A aplicação futura não pede arquivo no Repositório.' };
  }

  const nome = texto(String(formData.get('nome') ?? '')) || texto(ponto.repositorio_nova_variacao_nome as string | null);
  const quando =
    texto(String(formData.get('quando_utilizar') ?? '')) ||
    texto(ponto.repositorio_nova_variacao_quando_utilizar as string | null);
  if (!nome) return { ok: false, error: 'Informe o nome da variação.' };
  if (!quando) return { ok: false, error: 'Informe quando utilizar.' };

  const { error: errNome } = await acesso.supabase
    .from('juridico_pontos')
    .update({
      repositorio_nova_variacao_nome: nome,
      repositorio_nova_variacao_quando_utilizar: quando,
    })
    .eq('id', pontoId);
  if (errNome) return { ok: false, error: errNome.message };

  const admin = createAdminClient();
  const { data: maxRow } = await admin
    .from('repositorio_variacoes')
    .select('ordem')
    .eq('tipo_id', tipoId)
    .order('ordem', { ascending: false })
    .limit(1)
    .maybeSingle();
  const ordem = Number((maxRow as { ordem?: number } | null)?.ordem ?? 0) + 1;
  const { data: criada, error: errCriada } = await admin
    .from('repositorio_variacoes')
    .insert({ tipo_id: tipoId, nome, quando_utilizar: quando, ordem })
    .select('id')
    .single();
  if (errCriada || !criada?.id) return { ok: false, error: errCriada?.message ?? 'Não foi possível criar a variação.' };

  const publicado = await publicarVersaoRepositorio({
    secaoId,
    tipoId,
    arquivo,
    userId: acesso.userId,
    tipoAlvo: { variacao_id: String(criada.id) },
    juridicoPontoId: pontoId,
  });
  if (!publicado.ok || publicado.jaExistia) {
    await admin.from('repositorio_variacoes').delete().eq('id', criada.id);
    if (!publicado.ok) return publicado;
    revalidatePath('/repositorio');
    return { ok: true, documentoId: publicado.id };
  }

  await acesso.supabase.from('juridico_pontos').update({ repositorio_variacao_id: criada.id }).eq('id', pontoId);
  revalidatePath('/repositorio');
  return { ok: true, documentoId: publicado.id };
}

export type PontoVisaoRow = {
  id: string;
  tipo: JuridicoPontoTipo;
  rodada: number;
  ordem: number;
  duvida_recebida: string | null;
  resposta: string | null;
  clausula_trecho: string | null;
  solicitacao_alteracao: string | null;
  decisao: JuridicoPontoDecisao | null;
  texto_final_aprovado: string | null;
  aplicacao_futura: JuridicoPontoAplicacao | null;
  motivo_resposta: string | null;
  faq_status: JuridicoPontoFaqStatus | null;
  faq_article_id: string | null;
  faq_pergunta: string | null;
  faq_slug: string | null;
  faq_artigo_status: 'draft' | 'published' | 'archived' | null;
  repositorio_tipo_id: string | null;
  repositorio_variacao_id: string | null;
  repositorio_nova_variacao_nome: string | null;
  repositorio_nova_variacao_quando_utilizar: string | null;
  tem_versao_repositorio: boolean;
  card_id: string;
  card_titulo: string;
  tipo_documento: string | null;
};

const SELECT_VISAO =
  'id, juridico_card_id, tipo, rodada, ordem, duvida_recebida, resposta, clausula_trecho, solicitacao_alteracao, decisao, texto_final_aprovado, aplicacao_futura, motivo_resposta, faq_status, faq_article_id, repositorio_tipo_id, repositorio_variacao_id, repositorio_nova_variacao_nome, repositorio_nova_variacao_quando_utilizar, faq_articles(question, slug, status), kanban_cards!juridico_pontos_juridico_card_id_fkey(id, titulo, juridico_tipo_contrato)';

function mapVisao(row: Record<string, unknown>): PontoVisaoRow {
  const faq = row.faq_articles as
    | { question?: string | null; slug?: string | null; status?: string | null }
    | { question?: string | null; slug?: string | null; status?: string | null }[]
    | null;
  const faqRow = Array.isArray(faq) ? faq[0] : faq;
  const statusArtigo = String(faqRow?.status ?? '');
  const card = row.kanban_cards as
    | { id?: string; titulo?: string | null; juridico_tipo_contrato?: string | null }
    | { id?: string; titulo?: string | null; juridico_tipo_contrato?: string | null }[]
    | null;
  const cardRow = Array.isArray(card) ? card[0] : card;
  return {
    id: String(row.id),
    tipo: row.tipo === 'alteracao' ? 'alteracao' : 'duvida',
    rodada: Number(row.rodada),
    ordem: Number(row.ordem),
    duvida_recebida: texto(row.duvida_recebida as string | null),
    resposta: texto(row.resposta as string | null),
    clausula_trecho: texto(row.clausula_trecho as string | null),
    solicitacao_alteracao: texto(row.solicitacao_alteracao as string | null),
    decisao: umDe(row.decisao as string | null, JURIDICO_PONTO_DECISOES),
    texto_final_aprovado: texto(row.texto_final_aprovado as string | null),
    aplicacao_futura: umDe(row.aplicacao_futura as string | null, JURIDICO_PONTO_APLICACOES),
    motivo_resposta: texto(row.motivo_resposta as string | null),
    faq_status: umDe(row.faq_status as string | null, JURIDICO_PONTO_FAQ_STATUS),
    faq_article_id: texto(row.faq_article_id as string | null),
    faq_pergunta: texto(faqRow?.question),
    faq_slug: texto(faqRow?.slug),
    faq_artigo_status:
      statusArtigo === 'draft' || statusArtigo === 'published' || statusArtigo === 'archived' ? statusArtigo : null,
    repositorio_tipo_id: texto(row.repositorio_tipo_id as string | null),
    repositorio_variacao_id: texto(row.repositorio_variacao_id as string | null),
    repositorio_nova_variacao_nome: texto(row.repositorio_nova_variacao_nome as string | null),
    repositorio_nova_variacao_quando_utilizar: texto(row.repositorio_nova_variacao_quando_utilizar as string | null),
    tem_versao_repositorio: false,
    card_id: String(cardRow?.id ?? row.juridico_card_id ?? ''),
    card_titulo: texto(cardRow?.titulo) || 'Atendimento jurídico',
    tipo_documento: texto(cardRow?.juridico_tipo_contrato),
  };
}

export async function listarVisaoPontosJuridicos(
  visao: VisaoPontosJuridicos,
): Promise<{ ok: true; pontos: PontoVisaoRow[] } | { ok: false; error: string }> {
  const acesso = await exigirStaffJuridico();
  if (acesso.erro) return { ok: false, error: acesso.erro };
  if (visao !== 'duvidas' && visao !== 'aceitas' && visao !== 'nao_aceitas') {
    return { ok: false, error: 'Visão inválida.' };
  }

  let consulta = acesso.supabase.from('juridico_pontos').select(SELECT_VISAO);
  if (visao === 'duvidas') consulta = consulta.eq('tipo', 'duvida');
  else if (visao === 'aceitas') consulta = consulta.eq('tipo', 'alteracao').in('decisao', ['aceita', 'aceita_parcialmente']);
  else consulta = consulta.eq('tipo', 'alteracao').eq('decisao', 'nao_aceita');

  const { data, error } = await consulta.order('rodada', { ascending: false }).order('ordem', { ascending: true });
  if (error) return { ok: false, error: error.message };
  const pontos = ((data ?? []) as Record<string, unknown>[]).map(mapVisao);
  const ids = pontos.map((ponto) => ponto.id);
  if (ids.length > 0) {
    const { data: versoes, error: errVersoes } = await acesso.supabase
      .from('repositorio_documentos')
      .select('juridico_ponto_id')
      .in('juridico_ponto_id', ids);
    if (errVersoes) return { ok: false, error: errVersoes.message };
    const comVersao = new Set(
      (versoes ?? [])
        .map((versao) => texto((versao as { juridico_ponto_id?: string | null }).juridico_ponto_id))
        .filter((id): id is string => Boolean(id)),
    );
    for (const ponto of pontos) ponto.tem_versao_repositorio = comVersao.has(ponto.id);
  }
  return { ok: true, pontos };
}

function pontoParaPendencia(ponto: PontoJuridicoRow): PontoParaPendenciaAtendimento {
  return {
    id: ponto.id,
    tipo: ponto.tipo,
    duvidaRecebida: ponto.duvida_recebida,
    resposta: ponto.resposta,
    faqStatus: ponto.faq_status,
    faqArticleId: ponto.faq_article_id,
    clausulaTrecho: ponto.clausula_trecho,
    solicitacaoAlteracao: ponto.solicitacao_alteracao,
    decisao: ponto.decisao,
    textoFinalAprovado: ponto.texto_final_aprovado,
    aplicacaoFutura: ponto.aplicacao_futura,
    motivoResposta: ponto.motivo_resposta,
    repositorioTipoId: ponto.repositorio_tipo_id,
    repositorioVariacaoId: ponto.repositorio_variacao_id,
    novaVariacaoNome: ponto.repositorio_nova_variacao_nome,
    novaVariacaoQuando: ponto.repositorio_nova_variacao_quando_utilizar,
    temVersaoRepositorio: ponto.tem_versao_repositorio,
  };
}

async function preencherVersoesRepositorio(
  db: ReturnType<typeof createAdminClient>,
  pontos: PontoJuridicoRow[],
): Promise<string | null> {
  const ids = pontos.map((ponto) => ponto.id);
  if (ids.length === 0) return null;
  const { data: versoes, error } = await db
    .from('repositorio_documentos')
    .select('id, juridico_ponto_id')
    .in('juridico_ponto_id', ids);
  if (error) return error.message;
  const porPonto = new Map<string, string>();
  for (const versao of versoes ?? []) {
    const pontoId = texto((versao as { juridico_ponto_id?: string | null }).juridico_ponto_id);
    const docId = texto((versao as { id?: string | null }).id);
    if (pontoId && docId) porPonto.set(pontoId, docId);
  }
  for (const ponto of pontos) {
    const docId = porPonto.get(ponto.id) ?? null;
    ponto.tem_versao_repositorio = Boolean(docId);
    ponto.repositorio_documento_id = docId;
  }
  return null;
}

async function lerDocumentoFinalAssinado(
  db: ReturnType<typeof createAdminClient>,
  cardId: string,
): Promise<{ itemId: string | null; registrado: boolean; erro: string | null }> {
  const { data: fase, error: errFase } = await db
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.JURIDICO)
    .eq('slug', FASE_SLUGS.JURIDICO_POS_ASSINATURA)
    .maybeSingle();
  if (errFase) return { itemId: null, registrado: false, erro: errFase.message };
  const faseId = texto((fase as { id?: string } | null)?.id);
  if (!faseId) return { itemId: null, registrado: false, erro: null };

  const { data: item, error: errItem } = await db
    .from('kanban_fase_checklist_itens')
    .select('id')
    .eq('fase_id', faseId)
    .eq('campo_slug', CAMPO_DOCUMENTO_FINAL_ASSINADO)
    .maybeSingle();
  if (errItem) return { itemId: null, registrado: false, erro: errItem.message };
  const itemId = texto((item as { id?: string } | null)?.id);
  if (!itemId) return { itemId: null, registrado: false, erro: null };

  const { data: resposta, error: errResp } = await db
    .from('kanban_fase_checklist_respostas')
    .select('valor, arquivo_path')
    .eq('card_id', cardId)
    .eq('item_id', itemId)
    .maybeSingle();
  if (errResp) return { itemId, registrado: false, erro: errResp.message };
  const row = resposta as { valor?: string | null; arquivo_path?: string | null } | null;
  return {
    itemId,
    registrado: documentoFinalAssinadoRegistrado({ valor: row?.valor, arquivoPath: row?.arquivo_path }),
    erro: null,
  };
}

async function lerPontosComVersao(
  db: ReturnType<typeof createAdminClient>,
  cardId: string,
  select: string,
): Promise<{ pontos: PontoJuridicoRow[]; erro: string | null }> {
  const { data, error } = await db
    .from('juridico_pontos')
    .select(select)
    .eq('juridico_card_id', cardId)
    .order('rodada', { ascending: false })
    .order('ordem', { ascending: true });
  if (error) return { pontos: [], erro: error.message };
  const pontos = ((data ?? []) as unknown as Record<string, unknown>[]).map(mapPonto);
  const erroVersao = await preencherVersoesRepositorio(db, pontos);
  if (erroVersao) return { pontos: [], erro: erroVersao };
  return { pontos, erro: null };
}

function pendenciasDosPontos(documento: boolean, pontos: PontoJuridicoRow[]): PendenciasAtendimentoJuridico {
  return avaliarPendenciasAtendimentoJuridico(documento, pontos.map(pontoParaPendencia));
}

export async function carregarRetroalimentacaoAtendimento(cardId: string): Promise<
  | {
      ok: true;
      pendencias: PendenciasAtendimentoJuridico;
      mensagem: string | null;
      pontos: PontoJuridicoRow[];
    }
  | { ok: false; error: string }
> {
  const acesso = await exigirStaffJuridico();
  if (acesso.erro) return { ok: false, error: acesso.erro };
  const card = await cardJuridico(acesso.supabase, cardId);
  if (card.erro || !card.card) return { ok: false, error: card.erro ?? 'Card inválido.' };
  const lidos = await lerPontosComVersao(acesso.supabase as ReturnType<typeof createAdminClient>, cardId, SELECT_PONTO);
  if (lidos.erro) return { ok: false, error: lidos.erro };
  const doc = await lerDocumentoFinalAssinado(acesso.supabase as ReturnType<typeof createAdminClient>, cardId);
  if (doc.erro) return { ok: false, error: doc.erro };
  const pendencias = pendenciasDosPontos(doc.registrado, lidos.pontos);
  return {
    ok: true,
    pendencias,
    mensagem: mensagemPendenciasAtendimentoJuridico(pendencias),
    pontos: lidos.pontos,
  };
}

export async function confirmarDocumentoFinalAssinado(
  cardId: string,
  confirmado: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const acesso = await exigirStaffJuridico();
  if (acesso.erro || !acesso.userId) return { ok: false, error: acesso.erro ?? 'Sem permissão.' };
  const card = await cardJuridico(acesso.supabase, cardId);
  if (card.erro || !card.card) return { ok: false, error: card.erro ?? 'Card inválido.' };
  if (card.card.arquivado) return { ok: false, error: 'Atendimento arquivado.' };
  const doc = await lerDocumentoFinalAssinado(acesso.supabase as ReturnType<typeof createAdminClient>, cardId);
  if (doc.erro) return { ok: false, error: doc.erro };
  if (!doc.itemId) return { ok: false, error: 'O checklist do documento final assinado não está nesta fase.' };
  const { error } = await acesso.supabase.from('kanban_fase_checklist_respostas').upsert(
    {
      item_id: doc.itemId,
      card_id: cardId,
      valor: confirmado ? 'true' : 'false',
      preenchido_por: acesso.userId,
      preenchido_em: new Date().toISOString(),
    },
    { onConflict: 'item_id,card_id' },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Bloqueia só Pós-Assinatura → Atendimentos Concluídos. Não altera o card. */
export async function verificarGateConclusaoAtendimentoJuridico(
  cardId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = String(cardId ?? '').trim();
  if (!id) return { ok: false, error: 'Card inválido.' };
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Não foi possível verificar as pendências do atendimento.' };
  }

  const { data: card, error } = await admin
    .from('kanban_cards')
    .select('id, kanban_id, kanban_fases!kanban_cards_fase_id_fkey(slug)')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!card || String((card as { kanban_id?: string }).kanban_id ?? '') !== KANBAN_IDS.JURIDICO) {
    return { ok: true };
  }
  const faseJoin = (card as { kanban_fases?: { slug?: string | null } | { slug?: string | null }[] | null }).kanban_fases;
  const fase = Array.isArray(faseJoin) ? faseJoin[0] : faseJoin;
  if (String(fase?.slug ?? '').trim() !== FASE_SLUGS.JURIDICO_POS_ASSINATURA) return { ok: true };

  const lidos = await lerPontosComVersao(admin, id, SELECT_PONTO_GATE);
  if (lidos.erro) return { ok: false, error: lidos.erro };
  const doc = await lerDocumentoFinalAssinado(admin, id);
  if (doc.erro) return { ok: false, error: doc.erro };
  const mensagem = mensagemPendenciasAtendimentoJuridico(pendenciasDosPontos(doc.registrado, lidos.pontos));
  if (mensagem) return { ok: false, error: mensagem };
  return { ok: true };
}

/** Bloqueia só Em alterações e respostas → Enviado ao Parceiro. Não altera o card. */
export async function verificarGatePontosRodadaEnvioParceiro(
  cardId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = String(cardId ?? '').trim();
  if (!id) return { ok: false, error: 'Card inválido.' };
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Não foi possível verificar os Pontos Jurídicos da rodada.' };
  }

  const { data: card, error } = await admin
    .from('kanban_cards')
    .select('id, kanban_id, juridico_bolinha_count, kanban_fases!kanban_cards_fase_id_fkey(slug)')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!card || String((card as { kanban_id?: string }).kanban_id ?? '') !== KANBAN_IDS.JURIDICO) {
    return { ok: true };
  }
  const faseJoin = (card as { kanban_fases?: { slug?: string | null } | { slug?: string | null }[] | null }).kanban_fases;
  const fase = Array.isArray(faseJoin) ? faseJoin[0] : faseJoin;
  if (String(fase?.slug ?? '').trim() !== FASE_SLUGS.JURIDICO_ALTERACOES_RESPOSTAS) return { ok: true };

  const { data, error: errPontos } = await admin
    .from('juridico_pontos')
    .select(SELECT_PONTO_GATE)
    .eq('juridico_card_id', id);
  if (errPontos) return { ok: false, error: errPontos.message };
  const pontos = ((data ?? []) as Record<string, unknown>[]).map(mapPonto);
  const rodada = rodadaAtualJuridico(
    Number((card as { juridico_bolinha_count?: number | null }).juridico_bolinha_count),
  );
  const mensagem = mensagemGateEnvioParceiro(
    pontos.map((ponto) => ({ ...pontoParaPendencia(ponto), rodada: ponto.rodada })),
    rodada,
  );
  if (mensagem) return { ok: false, error: mensagem };
  return { ok: true };
}
