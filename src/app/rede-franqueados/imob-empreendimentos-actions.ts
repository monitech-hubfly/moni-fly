'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeAccessRole } from '@/lib/authz';
import {
  CAMPOS_NEGOCIO_EMPREENDIMENTO,
  negocioDbFromPatch,
  textoColunaNegocioEmpreendimento,
  type ImobEmpreendimentoPatch,
  type ImobEmpreendimentoRow,
} from '@/lib/imob-empreendimentos';
import { labelStatusImovel } from '@/lib/kanban/imob-simulacoes-card';

type Ok = { ok: true; mensagem: string; id?: string };
type Err = { ok: false; error: string };

async function requireImobStaff(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
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
    .single();
  const access = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (access !== 'admin' && access !== 'team') {
    return { ok: false, error: 'Apenas administradores ou time podem gerir empreendimentos.' };
  }
  return { ok: true, supabase, userId: user.id };
}

function slugify(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function criarImobEmpreendimento(patch: ImobEmpreendimentoPatch): Promise<Ok | Err> {
  const gate = await requireImobStaff();
  if (!gate.ok) return gate;

  const nome = String(patch.nome ?? '').trim();
  if (!nome) return { ok: false, error: 'Informe o nome do empreendimento.' };

  const slug = patch.slug ?? slugify(nome);

  const row = {
    nome,
    slug,
    specs: patch.specs ?? null,
    ativo: patch.ativo ?? true,
    imagem_url: patch.imagem_url ?? null,
    card_id: patch.card_id ?? null,
    condominio_id: patch.condominio_id ?? null,
    ...negocioDbFromPatch(patch),
  };

  const { data, error } = await gate.supabase
    .from('imob_empreendimentos')
    .insert(row)
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath('/rede-franqueados');
  return { ok: true, mensagem: `Empreendimento "${nome}" cadastrado.`, id: (data as { id: string }).id };
}

export async function atualizarImobEmpreendimento(
  id: string,
  patch: ImobEmpreendimentoPatch,
): Promise<Ok | Err> {
  const gate = await requireImobStaff();
  if (!gate.ok) return gate;
  if (!id) return { ok: false, error: 'ID inválido.' };

  const row: Record<string, unknown> = {};
  if (patch.nome !== undefined) {
    const nome = String(patch.nome ?? '').trim();
    if (!nome) return { ok: false, error: 'Informe o nome do empreendimento.' };
    row.nome = nome;
    if (!patch.slug) row.slug = slugify(nome);
  }
  if (patch.slug !== undefined) row.slug = patch.slug;
  if (patch.specs !== undefined) row.specs = patch.specs;
  if (patch.ativo !== undefined) row.ativo = patch.ativo;
  if (patch.imagem_url !== undefined) row.imagem_url = patch.imagem_url;
  if (patch.card_id !== undefined) row.card_id = patch.card_id;
  if (patch.condominio_id !== undefined) row.condominio_id = patch.condominio_id;
  Object.assign(row, negocioDbFromPatch(patch));

  if (Object.keys(row).length === 0) return { ok: false, error: 'Nada para atualizar.' };

  const { error } = await gate.supabase
    .from('imob_empreendimentos')
    .update(row)
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/rede-franqueados');
  return { ok: true, mensagem: 'Empreendimento atualizado.' };
}

export async function arquivarImobEmpreendimento(id: string): Promise<Ok | Err> {
  return atualizarImobEmpreendimento(id, { ativo: false });
}

export async function reativarImobEmpreendimento(id: string): Promise<Ok | Err> {
  return atualizarImobEmpreendimento(id, { ativo: true });
}

/** Vincula um corretor a um empreendimento. */
export async function vincularCorretorEmpreendimento(
  corretorId: string,
  empreendimentoId: string,
): Promise<Ok | Err> {
  const gate = await requireImobStaff();
  if (!gate.ok) return gate;

  const { error } = await gate.supabase
    .from('imob_corretor_empreendimentos')
    .upsert({ corretor_id: corretorId, empreendimento_id: empreendimentoId });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/rede-franqueados');
  return { ok: true, mensagem: 'Corretor vinculado.' };
}

/** Remove vínculo corretor ↔ empreendimento. */
export async function desvincularCorretorEmpreendimento(
  corretorId: string,
  empreendimentoId: string,
): Promise<Ok | Err> {
  const gate = await requireImobStaff();
  if (!gate.ok) return gate;

  const { error } = await gate.supabase
    .from('imob_corretor_empreendimentos')
    .delete()
    .eq('corretor_id', corretorId)
    .eq('empreendimento_id', empreendimentoId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/rede-franqueados');
  return { ok: true, mensagem: 'Vínculo removido.' };
}

export type CorretorVinculoOpcao = {
  id: string;
  nome: string;
  n_corretor: string | null;
};

export type EmpreendimentoCorretoresResumo = {
  empreendimentoId: string;
  nome: string;
  vinculados: number;
  corretorDesteClienteId: string | null;
  corretorDesteClienteNome: string | null;
};

export type CampoCadastroPreenchido = {
  label: string;
  valor: string;
};

async function vinculoDiretoDoCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
): Promise<{ empId: string; corretorId: string; colunaAusente: boolean; error: string | null }> {
  const { data, error } = await supabase
    .from('kanban_cards')
    .select('imob_empreendimento_id, rede_corretor_id')
    .eq('id', cardId)
    .maybeSingle();
  if (error) {
    const msg = error.message ?? '';
    if (/imob_empreendimento_id|rede_corretor_id/.test(msg)) {
      return { empId: '', corretorId: '', colunaAusente: true, error: null };
    }
    return { empId: '', corretorId: '', colunaAusente: false, error: msg };
  }
  const row = data as { imob_empreendimento_id?: string | null; rede_corretor_id?: string | null } | null;
  return {
    empId: String(row?.imob_empreendimento_id ?? '').trim(),
    corretorId: String(row?.rede_corretor_id ?? '').trim(),
    colunaAusente: false,
    error: null,
  };
}

async function cardIdsDoMesmoEmpreendimento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string,
): Promise<{ ids: string[]; origemId: string }> {
  const ids = new Set<string>([cardId]);
  const { data: card } = await supabase
    .from('kanban_cards')
    .select('projeto_id, processo_step_one_id, origem_card_id')
    .eq('id', cardId)
    .maybeSingle();
  const row = card as {
    projeto_id?: string | null;
    processo_step_one_id?: string | null;
    origem_card_id?: string | null;
  } | null;
  const projetoId = String(row?.projeto_id ?? '').trim();
  const processoId = String(row?.processo_step_one_id ?? '').trim();
  const origemId = String(row?.origem_card_id ?? '').trim();
  if (origemId) ids.add(origemId);

  const consultas = [];
  if (projetoId) {
    consultas.push(supabase.from('kanban_cards').select('id').eq('projeto_id', projetoId).limit(40));
  }
  if (processoId) {
    consultas.push(
      supabase.from('kanban_cards').select('id').eq('processo_step_one_id', processoId).limit(40),
    );
  }
  consultas.push(supabase.from('kanban_cards').select('id').eq('origem_card_id', cardId).limit(20));

  const resultados = await Promise.all(consultas);
  for (const res of resultados) {
    for (const item of res.data ?? []) {
      const id = String((item as { id?: string }).id ?? '').trim();
      if (id) ids.add(id);
    }
  }
  return { ids: [...ids], origemId };
}

/** Empreendimento deste card, ou de um card do mesmo projeto. */
export async function resumoCorretoresDoCard(
  cardId: string,
): Promise<{ ok: true; resumo: EmpreendimentoCorretoresResumo | null } | Err> {
  const gate = await requireImobStaff();
  if (!gate.ok) return gate;
  const cid = String(cardId ?? '').trim();
  if (!cid) return { ok: true, resumo: null };

  const direto = await vinculoDiretoDoCard(gate.supabase, cid);
  if (direto.error) return { ok: false, error: direto.error };

  let escolhido: { id: string; nome: string } | null = null;
  if (direto.empId) {
    const { data, error } = await gate.supabase
      .from('imob_empreendimentos')
      .select('id, nome')
      .eq('id', direto.empId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (data) escolhido = { id: String(data.id), nome: String(data.nome ?? '') };
  }

  if (!escolhido) {
    const { ids: cardIds, origemId } = await cardIdsDoMesmoEmpreendimento(gate.supabase, cid);
    const { data, error } = await gate.supabase
      .from('imob_empreendimentos')
      .select('id, nome, card_id')
      .in('card_id', cardIds);
    if (error) return { ok: false, error: error.message };

    const linhas = (data ?? []) as { id: string; nome: string; card_id: string | null }[];
    const unicos = new Map<string, (typeof linhas)[number]>();
    for (const linha of linhas) unicos.set(linha.id, linha);
    const lista = [...unicos.values()];
    const porCard =
      lista.find((e) => e.card_id === cid) ??
      lista.find((e) => origemId && e.card_id === origemId) ??
      (lista.length === 1 ? lista[0] : null);
    if (porCard) escolhido = { id: porCard.id, nome: porCard.nome };
  }
  if (!escolhido) return { ok: true, resumo: null };

  const { count, error: countError } = await gate.supabase
    .from('imob_corretor_empreendimentos')
    .select('corretor_id', { count: 'exact', head: true })
    .eq('empreendimento_id', escolhido.id);
  if (countError) return { ok: false, error: countError.message };

  let corretorNome: string | null = null;
  if (direto.corretorId) {
    const { data: corretor } = await gate.supabase
      .from('rede_corretores')
      .select('nome')
      .eq('id', direto.corretorId)
      .maybeSingle();
    corretorNome = String((corretor as { nome?: string | null } | null)?.nome ?? '').trim() || null;
  }

  return {
    ok: true,
    resumo: {
      empreendimentoId: escolhido.id,
      nome: String(escolhido.nome ?? '').trim() || 'Empreendimento',
      vinculados: count ?? 0,
      corretorDesteClienteId: direto.corretorId || null,
      corretorDesteClienteNome: corretorNome,
    },
  };
}

/** Campos do cadastro do empreendimento que já têm valor. */
export async function cadastroPreenchidoDoEmpreendimento(
  empreendimentoId: string,
): Promise<{ ok: true; campos: CampoCadastroPreenchido[] } | Err> {
  const gate = await requireImobStaff();
  if (!gate.ok) return gate;
  const empId = String(empreendimentoId ?? '').trim();
  if (!empId) return { ok: false, error: 'Empreendimento inválido.' };

  const colunas = CAMPOS_NEGOCIO_EMPREENDIMENTO.map((c) => c.key).join(', ');
  const { data, error } = await gate.supabase
    .from('imob_empreendimentos')
    .select(colunas)
    .eq('id', empId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, campos: [] };

  const row = data as unknown as ImobEmpreendimentoRow;
  const campos = CAMPOS_NEGOCIO_EMPREENDIMENTO.map((campo) => ({
    label: campo.label,
    valor: textoColunaNegocioEmpreendimento(row, campo),
  })).filter((campo) => campo.valor && campo.valor !== '—');

  return { ok: true, campos };
}

/** Lista de corretores para marcar vínculo, no mesmo formato do cadastro. */
export async function listarCorretoresVinculoEmpreendimento(
  empreendimentoId: string,
): Promise<{ ok: true; corretores: CorretorVinculoOpcao[]; vinculados: string[] } | Err> {
  const gate = await requireImobStaff();
  if (!gate.ok) return gate;
  const empId = String(empreendimentoId ?? '').trim();
  if (!empId) return { ok: false, error: 'Empreendimento inválido.' };

  const [{ data: corretores, error: corrError }, { data: links, error: linkError }] = await Promise.all([
    gate.supabase.from('rede_corretores').select('id, nome, n_corretor').order('nome', { ascending: true }),
    gate.supabase
      .from('imob_corretor_empreendimentos')
      .select('corretor_id')
      .eq('empreendimento_id', empId),
  ]);
  if (corrError) return { ok: false, error: corrError.message };
  if (linkError) return { ok: false, error: linkError.message };

  return {
    ok: true,
    corretores: ((corretores ?? []) as { id: string; nome: string | null; n_corretor: string | null }[])
      .map((c) => ({
        id: String(c.id),
        nome: String(c.nome ?? '').trim(),
        n_corretor: c.n_corretor ? String(c.n_corretor) : null,
      }))
      .filter((c) => c.id && c.nome),
    vinculados: ((links ?? []) as { corretor_id: string }[]).map((l) => String(l.corretor_id)),
  };
}

/** Retorna os corretores vinculados a um empreendimento. */
export async function fetchCorretoresDoEmpreendimento(
  empreendimentoId: string,
): Promise<Array<{ corretor_id: string; nome: string | null }> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imob_corretor_empreendimentos')
    .select('corretor_id, rede_corretores(id, nome)')
    .eq('empreendimento_id', empreendimentoId);

  if (error) return null;

  return (data ?? []).map((d: unknown) => {
    const item = d as { corretor_id?: string; rede_corretores?: { nome?: string } | null };
    return {
      corretor_id: String(item.corretor_id ?? ''),
      nome: item.rede_corretores?.nome ?? null,
    };
  });
}

// ─── Flyer ────────────────────────────────────────────────────────────────────

/** IDs dos kanbans de pipeline */
const KANBAN_LOTEADORES = '3e7b6ec7-2e15-4a66-8fdf-9dc942b5019c';
const KANBAN_PORTFOLIO  = 'c57120a0-991c-422b-8def-4d16a9411d45';

/** Bucket das imagens IMOB (imagem_principal_path / imagem_oferta_path). */
const IMOB_BUCKET = 'processo-docs';
/** URLs assinadas válidas por 7 dias (flyer impresso / aba aberta). */
const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7;

type StorageClient =
  | Awaited<ReturnType<typeof createClient>>
  | ReturnType<typeof createAdminClient>;

function tryAdminClient(): ReturnType<typeof createAdminClient> | null {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

function publicStorageUrl(path: string): string | null {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  if (!base) return null;
  return `${base}/storage/v1/object/public/${IMOB_BUCKET}/${path}`;
}

/**
 * Resolve path do storage para URL usável no flyer.
 * Preferência: signed URL (bucket privado) → URL pública do projeto ativo.
 */
async function storageUrl(
  supabase: StorageClient,
  path: string | null | undefined,
): Promise<string | null> {
  const p = path?.trim();
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;

  const admin = tryAdminClient();
  const clients: StorageClient[] = admin ? [admin, supabase] : [supabase];
  for (const client of clients) {
    const { data, error } = await client.storage.from(IMOB_BUCKET).createSignedUrl(p, SIGNED_URL_TTL_SEC);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  return publicStorageUrl(p);
}

function brl(v: number | null | undefined): string | null {
  if (v == null) return null;
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export type FlyerCorretorData = {
  id: string;
  nome: string | null;
  creci: string | null;
  telefone: string | null;
};

export type FlyerUnitData = {
  nome: string | null;
  area: string | null;
  quartos: string | null;
  banheiros: string | null;
  imagem_url: string | null;
  valor_avista: string | null;
  entrada: string | null;
  parcelas: string | null;
};

export type FlyerData = {
  emp: { id: string; nome: string; specs: string | null; imagem_url: string | null; slug: string | null };
  cond: { nome: string; cidade: string | null; estado: string | null } | null;
  pipeline: string | null;
  showroom: { produto_modelo: string | null; imagem_url: string | null } | null;
  /** Render / foto principal = imob_card_modelo.imagem_principal_path */
  hero_imagem_url: string | null;
  /** Produto / Modelo para o quadro Casa (Showroom → 1ª tipologia). */
  casa_produto_modelo: string | null;
  status_imovel: string | null;
  ano_lancamento: number | null;
  preco_a_partir_de: string | null;
  units: FlyerUnitData[];
  corretores: FlyerCorretorData[];
};

/**
 * Busca todos os dados necessários para montar a URL do flyer de um empreendimento.
 * Chamado a partir do FlyerModal no client component.
 */
export async function fetchFlyerData(
  empreendimentoId: string,
): Promise<FlyerData | { error: string }> {
  const supabase = await createClient();

  // 1. Empreendimento
  const { data: emp, error: empErr } = await supabase
    .from('imob_empreendimentos')
    .select('id, nome, specs, slug, card_id, condominio_id, imagem_url')
    .eq('id', empreendimentoId)
    .single();

  if (empErr || !emp) return { error: 'Empreendimento não encontrado.' };

  const e = emp as {
    id: string;
    nome: string;
    specs: string | null;
    slug: string | null;
    card_id: string | null;
    condominio_id: string | null;
    imagem_url: string | null;
  };

  // 2. Condomínio
  let cond: FlyerData['cond'] = null;
  if (e.condominio_id) {
    const { data: condData } = await supabase
      .from('condominios')
      .select('nome, cidade, estado')
      .eq('id', e.condominio_id)
      .single();
    if (condData) {
      const c = condData as { nome: string; cidade: string | null; estado: string | null };
      cond = { nome: c.nome, cidade: c.cidade, estado: c.estado };
    }
  }

  // 3. Pipeline via kanban_cards
  let pipeline: string | null = null;
  if (e.card_id) {
    const { data: card } = await supabase
      .from('kanban_cards')
      .select('kanban_id')
      .eq('id', e.card_id)
      .single();
    const kid = (card as { kanban_id?: string } | null)?.kanban_id;
    if (kid === KANBAN_LOTEADORES) pipeline = 'Loteadores';
    else if (kid === KANBAN_PORTFOLIO) pipeline = 'Portfólio';
  }

  // 4. Imagem principal + "A partir de" + status do Showroom (imob_card_modelo)
  let modeloImgUrl: string | null = null;
  let precoAPartirDe: string | null = null;
  let statusImovel: string | null = null;
  if (e.card_id) {
    type ModeloFlyerRow = {
      imagem_principal_path?: string | null;
      preco_a_partir_de?: number | null;
      status_imovel?: string | null;
    };
    let modelo: ModeloFlyerRow | null = null;
    const full = await supabase
      .from('imob_card_modelo')
      .select('imagem_principal_path, preco_a_partir_de, status_imovel')
      .eq('card_id', e.card_id)
      .maybeSingle();
    if (!full.error) {
      modelo = (full.data as ModeloFlyerRow | null) ?? null;
    } else {
      const fallback = await supabase
        .from('imob_card_modelo')
        .select('imagem_principal_path')
        .eq('card_id', e.card_id)
        .maybeSingle();
      modelo = (fallback.data as ModeloFlyerRow | null) ?? null;
    }
    modeloImgUrl = await storageUrl(supabase, modelo?.imagem_principal_path);
    precoAPartirDe = brl(modelo?.preco_a_partir_de);
    const statusRaw = String(modelo?.status_imovel ?? '').trim();
    if (statusRaw) {
      const label = labelStatusImovel(statusRaw);
      statusImovel = label && label !== '—' ? label : statusRaw;
    }
  }

  // 5. Unidades IMOB (showroom + empreendimentos ordenados)
  let showroom: FlyerData['showroom'] = null;
  const units: FlyerUnitData[] = [];
  let anoShowroom: number | null = null;
  let anoPrimeiraUnidade: number | null = null;

  if (e.card_id) {
    const { data: cardEmps } = await supabase
      .from('imob_card_empreendimentos')
      .select(
        'tipo, produto_modelo, nome, area_vendas_m2, ano_lancamento, quartos, banheiros, imagem_oferta_path, valor_avista, entrada, parcelas_mensais',
      )
      .eq('card_id', e.card_id)
      .order('ordem', { ascending: true });

    for (const item of (cardEmps ?? []) as Array<{
      tipo: string | null;
      produto_modelo: string | null;
      nome: string | null;
      area_vendas_m2: number | null;
      ano_lancamento: number | null;
      quartos: number | null;
      banheiros: number | null;
      imagem_oferta_path: string | null;
      valor_avista: number | null;
      entrada: number | null;
      parcelas_mensais: number | null;
    }>) {
      const imgUrl = await storageUrl(supabase, item.imagem_oferta_path);
      const ano =
        item.ano_lancamento != null && Number.isFinite(Number(item.ano_lancamento))
          ? Number(item.ano_lancamento)
          : null;

      if (item.tipo === 'showroom') {
        showroom = {
          produto_modelo: item.produto_modelo ?? null,
          imagem_url: imgUrl,
        };
        if (ano != null && anoShowroom == null) anoShowroom = ano;
      } else if (units.length < 4) {
        units.push({
          nome: item.produto_modelo ?? item.nome ?? null,
          area: item.area_vendas_m2 != null ? String(item.area_vendas_m2) : null,
          quartos: item.quartos != null ? String(item.quartos) : null,
          banheiros: item.banheiros != null ? String(item.banheiros) : null,
          imagem_url: imgUrl,
          valor_avista: brl(item.valor_avista),
          entrada: brl(item.entrada),
          parcelas: brl(item.parcelas_mensais),
        });
        if (ano != null && anoPrimeiraUnidade == null) anoPrimeiraUnidade = ano;
      }
    }
  }

  const anoLancamento = anoShowroom ?? anoPrimeiraUnidade;

  // Render / foto principal = Imagem Principal do card (sempre prioridade)
  const heroImagemUrl = modeloImgUrl ?? showroom?.imagem_url ?? e.imagem_url ?? null;

  // Casa (Produto / Modelo): Showroom primeiro; senão 1ª tipologia
  const casaProdutoModelo =
    String(showroom?.produto_modelo ?? '').trim() ||
    String(units[0]?.nome ?? '').trim() ||
    null;

  let slugPublico = String(e.slug ?? '').trim() || null;
  if (e.card_id) {
    const { data: modelo } = await supabase
      .from('imob_card_modelo')
      .select('page_slug')
      .eq('card_id', e.card_id)
      .maybeSingle();
    const pageSlug = String((modelo as { page_slug?: string | null } | null)?.page_slug ?? '').trim();
    if (pageSlug) slugPublico = pageSlug;
  }

  // 6. Corretores vinculados
  const { data: corrLinks } = await supabase
    .from('imob_corretor_empreendimentos')
    .select('corretor_id, rede_corretores(id, nome, creci_numero, creci_uf, telefone)')
    .eq('empreendimento_id', empreendimentoId);

  const corretores: FlyerCorretorData[] = (corrLinks ?? []).map((row: unknown) => {
    const r = row as {
      corretor_id: string;
      rede_corretores?: {
        nome?: string;
        creci_numero?: string;
        creci_uf?: string;
        telefone?: string;
      } | null;
    };
    const c = r.rede_corretores;
    const creci = c?.creci_numero
      ? `${c.creci_numero}-${c.creci_uf ?? 'F'}`
      : null;
    return {
      id: r.corretor_id,
      nome: c?.nome ?? null,
      creci,
      telefone: c?.telefone ?? null,
    };
  });

  return {
    emp: {
      id: e.id,
      nome: e.nome,
      specs: e.specs,
      imagem_url: e.imagem_url,
      slug: slugPublico,
    },
    cond,
    pipeline,
    showroom,
    hero_imagem_url: heroImagemUrl,
    casa_produto_modelo: casaProdutoModelo,
    status_imovel: statusImovel,
    ano_lancamento: anoLancamento,
    preco_a_partir_de: precoAPartirDe,
    units,
    corretores,
  };
}
