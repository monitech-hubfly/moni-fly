'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import type { ImobEmpreendimentoPatch } from '@/lib/imob-empreendimentos';
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

/** URL base do Supabase Storage público */
const SUPABASE_STORAGE = 'https://aydryzoxqnwnbybvgiug.supabase.co/storage/v1/object/public';

/**
 * Bucket onde ficam as imagens IMOB (imagem_principal_path / imagem_oferta_path).
 * Atualize aqui quando o bucket for criado/renomeado.
 */
const IMOB_BUCKET = 'processo-docs';

function storageUrl(path: string | null | undefined): string | null {
  const p = path?.trim();
  if (!p) return null;
  return `${SUPABASE_STORAGE}/${IMOB_BUCKET}/${p}`;
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
  imagem_url: string | null;
  valor_avista: string | null;
  entrada: string | null;
  parcelas: string | null;
};

export type FlyerData = {
  emp: { id: string; nome: string; specs: string | null; imagem_url: string | null };
  cond: { nome: string; cidade: string | null; estado: string | null } | null;
  pipeline: string | null;
  showroom: { produto_modelo: string | null; imagem_url: string | null } | null;
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
    .select('id, nome, specs, card_id, condominio_id, imagem_url')
    .eq('id', empreendimentoId)
    .single();

  if (empErr || !emp) return { error: 'Empreendimento não encontrado.' };

  const e = emp as {
    id: string;
    nome: string;
    specs: string | null;
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
    let modelo: {
      imagem_principal_path?: string | null;
      preco_a_partir_de?: number | null;
      status_imovel?: string | null;
    } | null = null;
    const full = await supabase
      .from('imob_card_modelo')
      .select('imagem_principal_path, preco_a_partir_de, status_imovel')
      .eq('card_id', e.card_id)
      .maybeSingle();
    if (!full.error) {
      modelo = full.data as typeof modelo;
    } else {
      const fallback = await supabase
        .from('imob_card_modelo')
        .select('imagem_principal_path')
        .eq('card_id', e.card_id)
        .maybeSingle();
      modelo = fallback.data as typeof modelo;
    }
    modeloImgUrl = storageUrl(modelo?.imagem_principal_path);
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
        'tipo, produto_modelo, nome, area_vendas_m2, ano_lancamento, imagem_oferta_path, valor_avista, entrada, parcelas_mensais',
      )
      .eq('card_id', e.card_id)
      .order('ordem', { ascending: true });

    for (const item of (cardEmps ?? []) as Array<{
      tipo: string | null;
      produto_modelo: string | null;
      nome: string | null;
      area_vendas_m2: number | null;
      ano_lancamento: number | null;
      imagem_oferta_path: string | null;
      valor_avista: number | null;
      entrada: number | null;
      parcelas_mensais: number | null;
    }>) {
      const imgUrl = storageUrl(item.imagem_oferta_path);
      const ano =
        item.ano_lancamento != null && Number.isFinite(Number(item.ano_lancamento))
          ? Number(item.ano_lancamento)
          : null;

      if (item.tipo === 'showroom') {
        showroom = {
          produto_modelo: item.produto_modelo ?? null,
          // Prioridade: imagem do showroom → imagem_principal do modelo → imagem_url do empreendimento
          imagem_url: imgUrl ?? modeloImgUrl ?? e.imagem_url ?? null,
        };
        if (ano != null && anoShowroom == null) anoShowroom = ano;
      } else if (units.length < 4) {
        units.push({
          nome: item.produto_modelo ?? item.nome ?? null,
          area: item.area_vendas_m2 != null ? String(item.area_vendas_m2) : null,
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

  // Casa (Produto / Modelo): Showroom primeiro; senão 1ª tipologia
  const casaProdutoModelo =
    String(showroom?.produto_modelo ?? '').trim() ||
    String(units[0]?.nome ?? '').trim() ||
    null;

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
    emp: { id: e.id, nome: e.nome, specs: e.specs, imagem_url: e.imagem_url },
    cond,
    pipeline,
    showroom,
    casa_produto_modelo: casaProdutoModelo,
    status_imovel: statusImovel,
    ano_lancamento: anoLancamento,
    preco_a_partir_de: precoAPartirDe,
    units,
    corretores,
  };
}
