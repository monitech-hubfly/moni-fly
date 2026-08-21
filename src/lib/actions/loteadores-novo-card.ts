'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isRedeStaffRole } from '@/lib/authz';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { KANBAN_NOME_FUNIL_LOTEADORES } from '@/lib/kanban/funil-loteadores';
import { montarTituloCardLoteadoresSync } from '@/lib/kanban/loteadores-card-titulo';
import { formatLOValue, getNextLOFromRedeLoteadores, parseLOValue } from '@/lib/next-lo-loteador';
import {
  emptyRedeLoteadorFichaDraft,
  redeLoteadorFichaDraftToPatch,
  redeLoteadorRowToFichaDraft,
  type RedeLoteadorFichaDraft,
} from '@/lib/rede-loteador-ficha-draft';
import type { RedeLoteadorRow } from '@/lib/rede-loteadores';
import { normalizarParaBuscaLoteador } from '@/lib/rede-loteadores';

export type CriarCardLoteadoresCadastroModo = 'novo' | 'existente';

/** Dados mínimos do parceiro no form de criação (Prompt 10). */
export type CriarCardLoteadoresParceiroInput = {
  /** Nome da empresa / loteador. */
  nomeLoteador: string;
  /** N do Loteador (LOxxxx). Vazio → gera o próximo. */
  nLoteador?: string;
  /** Spec: nome_responsavel → interlocutor_nome */
  nomeResponsavel: string;
  /** Spec: cargo_funcao → interlocutor_cargo */
  cargoFuncao: string;
  /** Spec: telefone → interlocutor_telefone */
  telefone: string;
  /** Spec: email → interlocutor_email */
  email: string;
  cnpj?: string;
  condominioNome?: string;
};

export type CriarCardLoteadoresComCadastroInput = {
  faseId: string;
  basePath?: string;
  modo: CriarCardLoteadoresCadastroModo;
  redeLoteadorId?: string;
  parceiro: CriarCardLoteadoresParceiroInput;
  quadra?: string;
  lote?: string;
};

export type CriarCardLoteadoresComCadastroResult =
  | { ok: true; cardId: string; redeLoteadorId: string }
  | { ok: false; error: string };

export type BuscarRedeLoteadoresOpcao = {
  id: string;
  nome: string;
  codigo: string | null;
  n_loteador: string | null;
  cnpj: string | null;
  interlocutor_nome: string | null;
  condominio_nome: string | null;
};

async function alocarNLoteador(
  supabase: Parameters<typeof getNextLOFromRedeLoteadores>[0],
  informado?: string | null,
): Promise<{ n_loteador: string; ordem: number }> {
  const raw = String(informado ?? '').trim().toUpperCase();
  const parsedIn = parseLOValue(raw);
  const n_loteador = parsedIn
    ? formatLOValue(parsedIn.num, parsedIn.width)
    : await getNextLOFromRedeLoteadores(supabase);
  const parsed = parseLOValue(n_loteador);
  return { n_loteador, ordem: parsed?.num ?? 0 };
}

/**
 * Endpoint para o frontend pré-preencher o próximo LOxxxx.
 * (Formulário de novo card do Funil Loteadores.)
 */
export async function getProximoNLoteador(): Promise<
  { ok: true; valor: string } | { ok: false; error: string }
> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const valor = await getNextLOFromRedeLoteadores(admin as never);
    return { ok: true, valor };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

async function requireStaffLoteadores() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = (profile as { role?: string } | null)?.role;
  if (!isRedeStaffRole(role)) {
    return {
      ok: false as const,
      error: 'Apenas administradores ou time podem criar cards e gerir cadastros de loteadores.',
    };
  }
  return { ok: true as const, supabase, userId: user.id };
}

function validarParceiro(p: CriarCardLoteadoresParceiroInput): string | null {
  if (!String(p.nomeLoteador ?? '').trim()) return 'Informe o nome do loteador.';
  if (!String(p.nomeResponsavel ?? '').trim()) return 'Informe o nome do responsável.';
  if (!String(p.cargoFuncao ?? '').trim()) return 'Informe o cargo / função.';
  if (!String(p.telefone ?? '').trim()) return 'Informe o telefone.';
  if (!String(p.email ?? '').trim()) return 'Informe o e-mail.';
  return null;
}

function draftFromParceiro(p: CriarCardLoteadoresParceiroInput): RedeLoteadorFichaDraft {
  const base = emptyRedeLoteadorFichaDraft('em_analise');
  return {
    ...base,
    nome: String(p.nomeLoteador ?? '').trim(),
    cnpj: String(p.cnpj ?? '').trim(),
    interlocutor_nome: String(p.nomeResponsavel ?? '').trim(),
    interlocutor_cargo: String(p.cargoFuncao ?? '').trim(),
    interlocutor_telefone: String(p.telefone ?? '').trim(),
    interlocutor_email: String(p.email ?? '').trim(),
    condominio_nome: String(p.condominioNome ?? '').trim(),
    // Espelha no contato legado quando vazio
    contato_nome: String(p.nomeResponsavel ?? '').trim(),
    contato_telefone: String(p.telefone ?? '').trim(),
    contato_email: String(p.email ?? '').trim(),
  };
}

/** Autocomplete staff — busca por nome, CNPJ, código ou condomínio. */
export async function buscarRedeLoteadoresParaNovoCard(
  busca: string,
): Promise<{ ok: true; opcoes: BuscarRedeLoteadoresOpcao[] } | { ok: false; error: string }> {
  const gate = await requireStaffLoteadores();
  if (!gate.ok) return gate;

  const q = String(busca ?? '').trim();
  let query = gate.supabase
    .from('rede_loteadores')
    .select('id, nome, codigo, n_loteador, cnpj, interlocutor_nome, condominio_nome')
    .order('nome', { ascending: true })
    .limit(40);

  if (q) {
    // Filtra no app para evitar problemas de escape no `.or()` do PostgREST
    const { data, error } = await gate.supabase
      .from('rede_loteadores')
      .select('id, nome, codigo, n_loteador, cnpj, interlocutor_nome, condominio_nome')
      .order('nome', { ascending: true })
      .limit(300);
    if (error) return { ok: false, error: error.message };
    const nq = normalizarParaBuscaLoteador(q);
    const opcoes = (data ?? [])
      .map((r) => ({
        id: String((r as { id: string }).id),
        nome: String((r as { nome?: string | null }).nome ?? '').trim() || 'Sem nome',
        codigo: (r as { codigo?: string | null }).codigo ?? null,
        n_loteador: (r as { n_loteador?: string | null }).n_loteador ?? null,
        cnpj: (r as { cnpj?: string | null }).cnpj ?? null,
        interlocutor_nome: (r as { interlocutor_nome?: string | null }).interlocutor_nome ?? null,
        condominio_nome: (r as { condominio_nome?: string | null }).condominio_nome ?? null,
      }))
      .filter((o) =>
        normalizarParaBuscaLoteador(
          [o.n_loteador, o.codigo, o.nome, o.cnpj, o.interlocutor_nome, o.condominio_nome]
            .filter(Boolean)
            .join(' '),
        ).includes(nq),
      )
      .slice(0, 40);
    return { ok: true, opcoes };
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    opcoes: (data ?? []).map((r) => ({
      id: String((r as { id: string }).id),
      nome: String((r as { nome?: string | null }).nome ?? '').trim() || 'Sem nome',
      codigo: (r as { codigo?: string | null }).codigo ?? null,
      n_loteador: (r as { n_loteador?: string | null }).n_loteador ?? null,
      cnpj: (r as { cnpj?: string | null }).cnpj ?? null,
      interlocutor_nome: (r as { interlocutor_nome?: string | null }).interlocutor_nome ?? null,
      condominio_nome: (r as { condominio_nome?: string | null }).condominio_nome ?? null,
    })),
  };
}

export async function carregarRedeLoteadorParaNovoCard(
  id: string,
): Promise<
  | { ok: true; draft: RedeLoteadorFichaDraft; row: RedeLoteadorRow }
  | { ok: false; error: string }
> {
  const gate = await requireStaffLoteadores();
  if (!gate.ok) return gate;
  const rid = String(id ?? '').trim();
  if (!rid) return { ok: false, error: 'Cadastro inválido.' };

  const { data, error } = await gate.supabase.from('rede_loteadores').select('*').eq('id', rid).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Cadastro não encontrado.' };

  const row = data as RedeLoteadorRow;
  return { ok: true, draft: redeLoteadorRowToFichaDraft(row), row };
}

export async function criarCardLoteadoresComCadastro(
  input: CriarCardLoteadoresComCadastroInput,
): Promise<CriarCardLoteadoresComCadastroResult> {
  const gate = await requireStaffLoteadores();
  if (!gate.ok) return gate;

  const faseId = String(input.faseId ?? '').trim();
  if (!faseId) return { ok: false, error: 'Fase inválida.' };

  const errParceiro = validarParceiro(input.parceiro);
  if (errParceiro) return { ok: false, error: errParceiro };

  const draft = draftFromParceiro(input.parceiro);
  const patch = redeLoteadorFichaDraftToPatch(draft);
  const now = new Date().toISOString();
  let redeLoteadorId = String(input.redeLoteadorId ?? '').trim();
  let nLoteadorFinal = String(input.parceiro.nLoteador ?? '').trim();

  if (input.modo === 'existente') {
    if (!redeLoteadorId) return { ok: false, error: 'Selecione um cadastro existente.' };
    const { data: existente, error: errExist } = await gate.supabase
      .from('rede_loteadores')
      .select('n_loteador, codigo')
      .eq('id', redeLoteadorId)
      .maybeSingle();
    if (errExist) return { ok: false, error: errExist.message };
    nLoteadorFinal =
      String((existente as { n_loteador?: string | null } | null)?.n_loteador ?? '').trim() ||
      String((existente as { codigo?: string | null } | null)?.codigo ?? '').trim() ||
      nLoteadorFinal;
    if (!parseLOValue(nLoteadorFinal)) {
      const alocado = await alocarNLoteador(gate.supabase as never, nLoteadorFinal);
      nLoteadorFinal = alocado.n_loteador;
      const { error: updLo } = await gate.supabase
        .from('rede_loteadores')
        .update({
          n_loteador: alocado.n_loteador,
          ordem: alocado.ordem,
          ultima_atualizacao_por: gate.userId,
          updated_at: now,
        } as never)
        .eq('id', redeLoteadorId);
      if (updLo) return { ok: false, error: updLo.message };
    }
    const { error: updErr } = await gate.supabase
      .from('rede_loteadores')
      .update({
        ...patch,
        condominio_estado: patch.estado ?? null,
        ultima_atualizacao_por: gate.userId,
        updated_at: now,
      } as never)
      .eq('id', redeLoteadorId);
    if (updErr) return { ok: false, error: updErr.message };
  } else {
    const alocado = await alocarNLoteador(gate.supabase as never, nLoteadorFinal);
    nLoteadorFinal = alocado.n_loteador;
    const { data: inserted, error: insErr } = await gate.supabase
      .from('rede_loteadores')
      .insert({
        ...patch,
        n_loteador: alocado.n_loteador,
        ordem: alocado.ordem,
        codigo: alocado.n_loteador,
        status: 'em_analise',
        condominio_estado: patch.estado ?? null,
        criado_por: gate.userId,
        ultima_atualizacao_por: gate.userId,
        updated_at: now,
      } as never)
      .select('id')
      .single();
    if (insErr) return { ok: false, error: insErr.message };
    redeLoteadorId = String((inserted as { id: string }).id);
  }

  const { data: kb, error: kbErr } = await gate.supabase
    .from('kanbans')
    .select('id')
    .eq('id', KANBAN_IDS.LOTEADORES)
    .maybeSingle();
  if (kbErr) return { ok: false, error: kbErr.message };
  const kanbanId = String((kb as { id?: string } | null)?.id ?? KANBAN_IDS.LOTEADORES).trim();

  const { data: faseRow, error: faseErr } = await gate.supabase
    .from('kanban_fases')
    .select('id')
    .eq('id', faseId)
    .eq('kanban_id', kanbanId)
    .eq('ativo', true)
    .maybeSingle();
  if (faseErr) return { ok: false, error: faseErr.message };
  if (!faseRow) return { ok: false, error: 'Fase não pertence ao Funil Loteadores.' };

  const nomeCondominio = String(input.parceiro.condominioNome ?? '').trim() || null;
  const quadra = String(input.quadra ?? '').trim() || null;
  const lote = String(input.lote ?? '').trim() || null;
  const titulo =
    montarTituloCardLoteadoresSync({
      nLoteador: nLoteadorFinal,
      nomeCondominio,
      tituloFallback: draft.nome,
    }) ?? draft.nome;

  const { data: cardRow, error: cardErr } = await gate.supabase
    .from('kanban_cards')
    .insert({
      kanban_id: kanbanId,
      fase_id: faseId,
      franqueado_id: gate.userId,
      titulo,
      status: 'ativo',
      nome_condominio: nomeCondominio,
      quadra,
      lote,
      rede_loteador_id: redeLoteadorId,
    } as never)
    .select('id')
    .single();
  if (cardErr) return { ok: false, error: cardErr.message };

  const cardId = String((cardRow as { id: string }).id);
  const { aplicarResponsavelFasePadraoAoCard, aplicarResponsavelDaFasePadraoSeVazio } =
    await import('@/lib/kanban/responsavel-fase-checklist');
  await aplicarResponsavelFasePadraoAoCard(gate.supabase, cardId, faseId, kanbanId, gate.userId);
  await aplicarResponsavelDaFasePadraoSeVazio(gate.supabase, cardId, faseId, gate.userId);

  let writeDb = gate.supabase;
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    writeDb = createAdminClient();
  } catch {
    writeDb = gate.supabase;
  }
  const { criarEVincularProcessoStepOneAoCard } = await import('@/lib/kanban/processo-step-one-card');
  const processoRes = await criarEVincularProcessoStepOneAoCard(writeDb, {
    cardId,
    userId: gate.userId,
    titulo,
    nomeCondominio,
    quadra,
    lote,
  });
  if (!processoRes.ok) {
    console.warn('[loteadores-novo-card] Falha ao vincular processo (dados do negócio):', processoRes.error);
  }

  const bp = String(input.basePath ?? '/loteadores').trim() || '/loteadores';
  revalidatePath(bp);
  revalidatePath('/');
  revalidatePath('/funil-moni-inc');
  void KANBAN_NOME_FUNIL_LOTEADORES;

  return { ok: true, cardId, redeLoteadorId };
}

/**
 * Cria cadastro + card sem sessão de staff (form público de captação).
 * Owner do card = responsável padrão do funil (Helenna).
 */
export async function criarCardLoteadoresNovoCadastroAdmin(
  parceiro: CriarCardLoteadoresParceiroInput,
): Promise<CriarCardLoteadoresComCadastroResult> {
  const errParceiro = validarParceiro(parceiro);
  if (errParceiro) return { ok: false, error: errParceiro };

  let admin;
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Serviço indisponível.' };
  }

  const {
    resolverResponsavelPadraoPorKanban,
    aplicarResponsavelFasePadraoAoCard,
    aplicarResponsavelDaFasePadraoSeVazio,
  } = await import('@/lib/kanban/responsavel-fase-checklist');
  const { resolverPrimeiraFaseContatoLoteadores } = await import('@/lib/kanban/funil-loteadores');

  const ownerUserId = await resolverResponsavelPadraoPorKanban(admin, KANBAN_IDS.LOTEADORES);
  if (!ownerUserId) {
    return { ok: false, error: 'Responsável padrão do Funil Loteadores não encontrado.' };
  }

  const { data: fases, error: fasesErr } = await admin
    .from('kanban_fases')
    .select('id, nome, ordem, slug, ativo')
    .eq('kanban_id', KANBAN_IDS.LOTEADORES)
    .eq('ativo', true)
    .order('ordem', { ascending: true });
  if (fasesErr) return { ok: false, error: fasesErr.message };

  const faseId = resolverPrimeiraFaseContatoLoteadores(
    ((fases ?? []) as { id: string; nome: string; ordem: number; slug?: string | null; ativo?: boolean }[]).map(
      (f) => ({
        id: f.id,
        nome: f.nome,
        ordem: f.ordem,
        sla_dias: null,
        slug: f.slug,
        ativo: f.ativo,
      }),
    ),
  );
  if (!faseId) return { ok: false, error: 'Fase inicial do Funil Loteadores não configurada.' };

  const draft = draftFromParceiro(parceiro);
  const patch = redeLoteadorFichaDraftToPatch(draft);
  const now = new Date().toISOString();
  const alocado = await alocarNLoteador(admin as never, parceiro.nLoteador);
  const nLoteadorFinal = alocado.n_loteador;

  const { data: inserted, error: insErr } = await admin
    .from('rede_loteadores')
    .insert({
      ...patch,
      n_loteador: alocado.n_loteador,
      ordem: alocado.ordem,
      codigo: alocado.n_loteador,
      status: 'em_analise',
      condominio_estado: patch.estado ?? null,
      criado_por: ownerUserId,
      ultima_atualizacao_por: ownerUserId,
      updated_at: now,
    } as never)
    .select('id')
    .single();
  if (insErr) return { ok: false, error: insErr.message };
  const redeLoteadorId = String((inserted as { id: string }).id);

  const nomeCondominio = String(parceiro.condominioNome ?? '').trim() || null;
  const titulo =
    montarTituloCardLoteadoresSync({
      nLoteador: nLoteadorFinal,
      nomeCondominio,
      tituloFallback: draft.nome,
    }) ?? draft.nome;

  const { data: cardRow, error: cardErr } = await admin
    .from('kanban_cards')
    .insert({
      kanban_id: KANBAN_IDS.LOTEADORES,
      fase_id: faseId,
      franqueado_id: ownerUserId,
      titulo,
      status: 'ativo',
      nome_condominio: nomeCondominio,
      rede_loteador_id: redeLoteadorId,
    } as never)
    .select('id')
    .single();
  if (cardErr) return { ok: false, error: cardErr.message };

  const cardId = String((cardRow as { id: string }).id);
  await aplicarResponsavelFasePadraoAoCard(admin, cardId, faseId, KANBAN_IDS.LOTEADORES, ownerUserId);
  await aplicarResponsavelDaFasePadraoSeVazio(admin, cardId, faseId, ownerUserId);

  const { criarEVincularProcessoStepOneAoCard } = await import('@/lib/kanban/processo-step-one-card');
  const processoRes = await criarEVincularProcessoStepOneAoCard(admin, {
    cardId,
    userId: ownerUserId,
    titulo,
    nomeCondominio,
  });
  if (!processoRes.ok) {
    console.warn('[loteadores-intake] Falha ao vincular processo:', processoRes.error);
  }

  revalidatePath('/loteadores');
  revalidatePath('/funil-moni-inc');
  revalidatePath('/rede-franqueados');

  return { ok: true, cardId, redeLoteadorId };
}
