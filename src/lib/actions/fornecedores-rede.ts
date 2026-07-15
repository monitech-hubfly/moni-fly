'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { KANBAN_IDS, FASE_SLUGS } from '@/lib/constants/kanban-ids';
import { MONI_EMAIL_POR_NOME, RESPONSAVEIS_POR_TIME } from '@/lib/times-responsaveis';
import { hrefAbrirCardKanban } from '@/lib/kanban/kanban-card-href';

const TIMES_AVISO_HOMOLOG = ['Waysers', 'Produto', 'Modelo Virtual', 'Acoplamento'] as const;
const TIPO_NOTIF = 'homologacao_produto_homologado';
const BASE_PATH = '/funil-homologacoes';

type ActionOk = { ok: true } | { ok: false; error: string };

async function assertStaff(): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  const role = String((profile as { role?: string } | null)?.role ?? '');
  if (!['admin', 'team', 'consultor', 'supervisor'].includes(role)) {
    return { ok: false, error: 'Sem permissão (staff).' };
  }
  return { ok: true, userId: user.id };
}

export type FornecedorRede = {
  id: string;
  nome: string | null;
  categoria: string | null;
  produtos: string | null;
  regiao_atuacao: string | null;
  prazo_entrega: string | null;
  frete_proprio: boolean | null;
  frete_tipo: string | null;
  fatura_para_spe: boolean | null;
  contato_responsavel: string | null;
  dados_empresa_anexo_url: string | null;
  volume_suportado: string | null;
  margem_loja_moni: number | null;
  forma_pagamento: string | null;
  prazo_garantia: string | null;
  politica_troca: string | null;
  ncm: string | null;
  anexo_proposta_url: string | null;
  nps: number | null;
  status: string | null;
  motivo_perda: string | null;
};

export type FornecedorCardVinculo = {
  id: string;
  fornecedor_id: string;
  card_id: string;
  nps_cotacao: number | null;
  status_cotacao: string | null;
  motivo_perda_cotacao: string | null;
  created_at: string;
  fornecedor?: FornecedorRede | null;
};

export type FornecedorRedeInput = {
  nome: string;
  categoria?: string | null;
  produtos?: string | null;
  regiao_atuacao?: string | null;
  prazo_entrega?: string | null;
  frete_proprio?: boolean | null;
  frete_tipo?: 'fixo' | 'variavel' | null;
  fatura_para_spe?: boolean | null;
  contato_responsavel?: string | null;
  dados_empresa_anexo_url?: string | null;
  volume_suportado?: string | null;
  margem_loja_moni?: number | null;
  forma_pagamento?: string | null;
  prazo_garantia?: string | null;
  politica_troca?: string | null;
  ncm?: string | null;
  anexo_proposta_url?: string | null;
  status?: string | null;
};

export async function listarFornecedoresRede(filtros?: {
  q?: string;
}): Promise<{ ok: true; data: FornecedorRede[] } | { ok: false; error: string }> {
  const auth = await assertStaff();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('fornecedores_rede')
    .select('*')
    .order('nome', { ascending: true })
    .limit(200);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as FornecedorRede[] };
}

export async function listarVinculosFornecedorCard(
  cardId: string,
): Promise<{ ok: true; data: FornecedorCardVinculo[] } | { ok: false; error: string }> {
  const auth = await assertStaff();
  if (!auth.ok) return auth;
  const cid = String(cardId ?? '').trim();
  if (!cid) return { ok: false, error: 'card_id inválido.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('fornecedor_card_vinculos')
    .select('*, fornecedor:fornecedores_rede(*)')
    .eq('card_id', cid)
    .order('created_at', { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as FornecedorCardVinculo[] };
}

export async function criarFornecedorRedeEVincular(input: {
  cardId: string;
  fornecedor: FornecedorRedeInput;
}): Promise<{ ok: true; fornecedorId: string; vinculoId: string } | { ok: false; error: string }> {
  const auth = await assertStaff();
  if (!auth.ok) return auth;
  const cid = String(input.cardId ?? '').trim();
  const nome = String(input.fornecedor.nome ?? '').trim();
  if (!cid || !nome) return { ok: false, error: 'Nome e card são obrigatórios.' };

  const supabase = await createClient();
  const payload = {
    ...input.fornecedor,
    nome,
    status: input.fornecedor.status ?? 'em_avaliacao',
    updated_at: new Date().toISOString(),
  };

  const { data: criado, error } = await supabase
    .from('fornecedores_rede')
    .insert(payload as never)
    .select('id')
    .single();

  if (error || !criado?.id) return { ok: false, error: error?.message ?? 'Falha ao criar fornecedor.' };

  const { data: vinculo, error: vErr } = await supabase
    .from('fornecedor_card_vinculos')
    .upsert(
      {
        fornecedor_id: criado.id,
        card_id: cid,
        status_cotacao: 'em_avaliacao',
      } as never,
      { onConflict: 'fornecedor_id,card_id' },
    )
    .select('id')
    .single();

  if (vErr || !vinculo?.id) {
    return { ok: false, error: vErr?.message ?? 'Fornecedor criado, mas falha ao vincular.' };
  }

  revalidatePath(BASE_PATH);
  return { ok: true, fornecedorId: criado.id, vinculoId: vinculo.id };
}

export async function vincularFornecedorExistenteAoCard(input: {
  cardId: string;
  fornecedorId: string;
}): Promise<{ ok: true; vinculoId: string } | { ok: false; error: string }> {
  const auth = await assertStaff();
  if (!auth.ok) return auth;
  const cid = String(input.cardId ?? '').trim();
  const fid = String(input.fornecedorId ?? '').trim();
  if (!cid || !fid) return { ok: false, error: 'Dados inválidos.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('fornecedor_card_vinculos')
    .upsert(
      {
        fornecedor_id: fid,
        card_id: cid,
        status_cotacao: 'em_avaliacao',
      } as never,
      { onConflict: 'fornecedor_id,card_id' },
    )
    .select('id')
    .single();

  if (error || !data?.id) return { ok: false, error: error?.message ?? 'Falha ao vincular.' };
  revalidatePath(BASE_PATH);
  return { ok: true, vinculoId: data.id };
}

export async function atualizarVinculoCotacao(input: {
  vinculoId: string;
  nps_cotacao?: number | null;
  status_cotacao?: string | null;
  motivo_perda_cotacao?: string | null;
}): Promise<ActionOk> {
  const auth = await assertStaff();
  if (!auth.ok) return auth;
  const vid = String(input.vinculoId ?? '').trim();
  if (!vid) return { ok: false, error: 'vinculo inválido.' };

  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.nps_cotacao !== undefined) patch.nps_cotacao = input.nps_cotacao;
  if (input.status_cotacao !== undefined) patch.status_cotacao = input.status_cotacao;
  if (input.motivo_perda_cotacao !== undefined) {
    patch.motivo_perda_cotacao = input.motivo_perda_cotacao;
  }

  const { error } = await supabase
    .from('fornecedor_card_vinculos')
    .update(patch as never)
    .eq('id', vid);

  if (error) return { ok: false, error: error.message };
  revalidatePath(BASE_PATH);
  return { ok: true };
}

/** Alias canônico do aviso de saída Homologações (sem spawn de card filho). */
export async function registrarAvisoHomologacaoConcluida(input: {
  cardId: string;
  excluirUserId?: string | null;
}): Promise<void> {
  return notificarHomologacaoProdutoHomologado(input);
}

/** Aviso de saída: produto/fornecedor homologado → times Waysers, Produto, MV, Acoplamento. */
export async function notificarHomologacaoProdutoHomologado(input: {
  cardId: string;
  excluirUserId?: string | null;
}): Promise<void> {
  const cardId = String(input.cardId ?? '').trim();
  if (!cardId) return;

  let db: ReturnType<typeof createAdminClient>;
  try {
    db = createAdminClient();
  } catch (e) {
    console.error('[registrarAvisoHomologacaoConcluida] admin:', e);
    return;
  }

  const { data: card } = await db
    .from('kanban_cards')
    .select('id, titulo, kanban_id, fase_id, concluido')
    .eq('id', cardId)
    .maybeSingle();

  if (!card || String((card as { kanban_id?: string }).kanban_id) !== KANBAN_IDS.HDM_HOMOLOGACOES) {
    return;
  }

  const faseId = String((card as { fase_id?: string }).fase_id ?? '');
  const { data: fase } = await db.from('kanban_fases').select('slug').eq('id', faseId).maybeSingle();
  const slug = String((fase as { slug?: string } | null)?.slug ?? '');
  if (slug !== FASE_SLUGS.HOMOLOG_CRIAR_PRODUTO_DATABASE) return;

  // Dedupe: atividade de auditoria já registrada?
  const { data: ja } = await db
    .from('kanban_atividades')
    .select('id')
    .eq('card_id', cardId)
    .in('tema', ['aviso', 'bastao'])
    .ilike('titulo', '%produto homologado%')
    .limit(1)
    .maybeSingle();
  if (ja?.id) return;

  const { data: respostas } = await db
    .from('kanban_fase_checklist_respostas')
    .select('valor, item:kanban_fase_checklist_itens!inner(campo_slug, label)')
    .eq('card_id', cardId);

  let nomeProduto = String((card as { titulo?: string }).titulo ?? '').trim() || 'Produto';
  let categoria = '';
  for (const r of respostas ?? []) {
    const item = (r as { item?: { campo_slug?: string; label?: string } | { campo_slug?: string; label?: string }[] })
      .item;
    const meta = Array.isArray(item) ? item[0] : item;
    const campo = String(meta?.campo_slug ?? '');
    const valor = String((r as { valor?: string }).valor ?? '').trim();
    if (campo === 'homolog_nome_produto' || campo === 'homolog_nome_produto_composto') {
      if (valor) nomeProduto = valor;
    }
    if (campo === 'homolog_grupo_fornecimento' || campo === 'homolog_categoria_database') {
      if (valor) categoria = valor;
    }
  }

  const { data: vinculos } = await db
    .from('fornecedor_card_vinculos')
    .select('fornecedor:fornecedores_rede(nome)')
    .eq('card_id', cardId);

  const fornecedores = (vinculos ?? [])
    .map((v) => {
      const f = (v as { fornecedor?: { nome?: string } | { nome?: string }[] }).fornecedor;
      const row = Array.isArray(f) ? f[0] : f;
      return String(row?.nome ?? '').trim();
    })
    .filter(Boolean);

  const link = hrefAbrirCardKanban('Funil Homologações', cardId);

  const timesDestino = [...TIMES_AVISO_HOMOLOG];
  const { data: timesRows } = await db
    .from('kanban_times')
    .select('id, nome')
    .in('nome', timesDestino);
  const timesIds = (timesRows ?? [])
    .map((t) => String((t as { id?: string }).id ?? '').trim())
    .filter(Boolean);

  const mensagem =
    `Produto homologado: ${nomeProduto}` +
    (categoria ? ` | Categoria: ${categoria}` : '') +
    (fornecedores.length ? ` | Fornecedor(es): ${fornecedores.join(', ')}` : '') +
    ` | Times: ${timesDestino.join(', ')}` +
    (link ? ` | ${link}` : '');

  await db.from('kanban_atividades').insert({
    card_id: cardId,
    titulo: 'Aviso: produto homologado (saída Homologações)',
    descricao: mensagem,
    tema: 'aviso',
    origem: 'sistema',
    status: 'concluida',
    concluido: true,
    times_ids: timesIds,
    time: timesDestino.join(', '),
  } as never);

  const userIds = new Set<string>();
  for (const time of TIMES_AVISO_HOMOLOG) {
    const { data: porTime } = await db.from('profiles').select('id').eq('time', time);
    for (const row of porTime ?? []) {
      const id = String((row as { id?: string }).id ?? '').trim();
      if (id) userIds.add(id);
    }
    const emails = new Set<string>();
    for (const nome of RESPONSAVEIS_POR_TIME[time] ?? []) {
      const em = MONI_EMAIL_POR_NOME[nome];
      if (em) emails.add(em.trim().toLowerCase());
    }
    if (emails.size > 0) {
      const { data: porEmail } = await db.from('profiles').select('id').in('email', [...emails]);
      for (const row of porEmail ?? []) {
        const id = String((row as { id?: string }).id ?? '').trim();
        if (id) userIds.add(id);
      }
    }
  }

  const excluir = String(input.excluirUserId ?? '').trim();
  const dest = [...userIds].filter((id) => id && id !== excluir);
  if (dest.length === 0) return;

  const rows = dest.map((user_id) => ({
    user_id,
    tipo: TIPO_NOTIF,
    mensagem: `Novo produto/fornecedor homologado: ${nomeProduto}`,
    referencia_card_id: cardId,
    referencia_path: `${BASE_PATH}?card=${encodeURIComponent(cardId)}`,
    lido: false,
  }));

  const { error: alertErr } = await db.from('alertas').insert(rows as never);
  if (alertErr) console.error('[notificarHomologacaoProdutoHomologado] alertas:', alertErr.message);

  const notifRows = dest.map((user_id) => ({
    user_id,
    chamado_id: null,
    tipo: TIPO_NOTIF,
    titulo: 'Produto homologado',
    mensagem,
    texto: mensagem,
    referencia_card_id: cardId,
  }));
  const { error: nErr } = await db.from('sirene_notificacoes').insert(notifRows as never);
  if (nErr) console.error('[notificarHomologacaoProdutoHomologado] sirene_notificacoes:', nErr.message);

  revalidatePath('/alertas');
  revalidatePath(BASE_PATH);
}
