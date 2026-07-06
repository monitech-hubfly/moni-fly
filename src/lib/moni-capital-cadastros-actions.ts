'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { getNextMCFromCadastros } from '@/lib/next-mc-cadastro';
import {
  normalizarEmailMoniCapital,
  normalizarTelefoneMoniCapital,
  type MoniCapitalCadastroUpsertDados,
} from '@/lib/moni-capital-cadastros';
type Ok<T = void> = { ok: true; mensagem?: string } & (T extends void ? object : T);
type Err = { ok: false; error: string };

async function requireStaff(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | Err
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const access = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (access !== 'admin' && access !== 'team') {
    return { ok: false, error: 'Apenas administradores ou time podem gerir cadastros Moní Capital.' };
  }
  return { ok: true, supabase, userId: user.id };
}

function cleanDados(dados: MoniCapitalCadastroUpsertDados): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const set = (k: keyof MoniCapitalCadastroUpsertDados, v: string | null | undefined) => {
    if (v === undefined) return;
    out[k] = !v || v.trim() === '' ? null : v.trim();
  };
  set('broker_nome', dados.broker_nome);
  set('broker_email', dados.broker_email);
  set('broker_telefone', dados.broker_telefone);
  set('investidor_nome', dados.investidor_nome);
  set('investidor_email', dados.investidor_email);
  set('investidor_telefone', dados.investidor_telefone);
  return out;
}

export async function verificarDuplicataMoniCapital(
  dados: MoniCapitalCadastroUpsertDados,
  excluirId?: string,
): Promise<Err | { ok: true }> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const emails = [
    normalizarEmailMoniCapital(dados.broker_email),
    normalizarEmailMoniCapital(dados.investidor_email),
  ].filter(Boolean);

  const telefones = [
    normalizarTelefoneMoniCapital(dados.broker_telefone),
    normalizarTelefoneMoniCapital(dados.investidor_telefone),
  ].filter((t) => t.length >= 8);

  if (emails.length === 0 && telefones.length === 0) {
    return { ok: true };
  }

  const { data: existentes, error } = await gate.supabase.from('moni_capital_cadastros').select('*');
  if (error) return { ok: false, error: error.message };

  for (const row of existentes ?? []) {
    const r = row as Record<string, unknown>;
    if (excluirId && String(r.id) === excluirId) continue;

    const rowEmails = [
      normalizarEmailMoniCapital(r.broker_email as string),
      normalizarEmailMoniCapital(r.investidor_email as string),
    ].filter(Boolean);

    const rowTels = [
      normalizarTelefoneMoniCapital(r.broker_telefone as string),
      normalizarTelefoneMoniCapital(r.investidor_telefone as string),
    ].filter((t) => t.length >= 8);

    for (const e of emails) {
      if (rowEmails.includes(e)) {
        return {
          ok: false,
          error: `E-mail já cadastrado (${e}) em ${String(r.n_cadastro ?? 'outro cadastro')}.`,
        };
      }
    }
    for (const t of telefones) {
      if (rowTels.includes(t)) {
        return {
          ok: false,
          error: `Telefone já cadastrado em ${String(r.n_cadastro ?? 'outro cadastro')}.`,
        };
      }
    }
  }

  return { ok: true };
}

async function obterFaseLeadsFunding(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ ok: true; faseId: string } | Err> {
  const { data, error } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.FUNDING)
    .eq('slug', 'funding_leads')
    .eq('ativo', true)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const faseId = String((data as { id?: string } | null)?.id ?? '').trim();
  if (!faseId) return { ok: false, error: 'Fase Leads do Funil Funding não encontrada.' };
  return { ok: true, faseId };
}

async function vincularCadastroECard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cadastroId: string,
  cardId: string,
): Promise<Err | { ok: true }> {
  const now = new Date().toISOString();

  const { error: cadErr } = await supabase
    .from('moni_capital_cadastros')
    .update({ kanban_card_id: cardId, updated_at: now } as never)
    .eq('id', cadastroId);
  if (cadErr) return { ok: false, error: cadErr.message };

  const { error: cardErr } = await supabase
    .from('kanban_cards')
    .update({ moni_capital_cadastro_id: cadastroId, updated_at: now } as never)
    .eq('id', cardId);
  if (cardErr) return { ok: false, error: cardErr.message };

  return { ok: true };
}

function tituloFundingFromCadastro(dados: MoniCapitalCadastroUpsertDados): string {
  const broker = dados.broker_nome?.trim();
  const investidor = dados.investidor_nome?.trim();
  return broker || investidor || 'Cadastro Moní Capital';
}

export type CriarCadastroMoniCapitalInput = MoniCapitalCadastroUpsertDados & {
  criarCardFunding?: boolean;
  basePath?: string;
};

export async function criarCadastroMoniCapital(
  input: CriarCadastroMoniCapitalInput,
): Promise<Ok<{ cadastroId: string; n_cadastro: string; cardId?: string }> | Err> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const dados = cleanDados(input);
  const temAlgumCampo = Object.values(dados).some((v) => v != null && String(v).trim() !== '');
  if (!temAlgumCampo) {
    return { ok: false, error: 'Preencha ao menos um campo.' };
  }

  const dup = await verificarDuplicataMoniCapital(dados);
  if (!dup.ok) return dup;

  const { n_cadastro, ordem } = await getNextMCFromCadastros(gate.supabase);
  const now = new Date().toISOString();

  const { data: inserted, error } = await gate.supabase
    .from('moni_capital_cadastros')
    .insert({
      n_cadastro,
      ordem,
      ...dados,
      criado_por: gate.userId,
      created_at: now,
      updated_at: now,
    } as never)
    .select('id, n_cadastro')
    .single();
  if (error) return { ok: false, error: error.message };

  const cadastroId = String((inserted as { id: string }).id);
  let cardId: string | undefined;

  if (input.criarCardFunding !== false) {
    const fase = await obterFaseLeadsFunding(gate.supabase);
    if (!fase.ok) return fase;

    const titulo = tituloFundingFromCadastro(dados);
    const tipo =
      dados.investidor_nome && !dados.broker_nome
        ? 'Investidor'
        : dados.broker_nome && !dados.investidor_nome
          ? 'Broker'
          : 'Investidor';

    const { data: cardRow, error: cardErr } = await gate.supabase
      .from('kanban_cards')
      .insert({
        kanban_id: KANBAN_IDS.FUNDING,
        fase_id: fase.faseId,
        franqueado_id: gate.userId,
        titulo,
        status: 'ativo',
        funding_tipo: tipo,
        funding_localizacao: null,
        funding_descritivo: null,
        moni_capital_cadastro_id: cadastroId,
      } as never)
      .select('id')
      .single();
    if (cardErr) return { ok: false, error: cardErr.message };

    cardId = String((cardRow as { id: string }).id);
    const link = await vincularCadastroECard(gate.supabase, cadastroId, cardId);
    if (!link.ok) return link;

    const { aplicarResponsavelFasePadraoAoCard, aplicarResponsavelDaFasePadraoSeVazio } =
      await import('@/lib/kanban/responsavel-fase-checklist');
    await aplicarResponsavelFasePadraoAoCard(
      gate.supabase,
      cardId,
      fase.faseId,
      KANBAN_IDS.FUNDING,
      gate.userId,
    );
    await aplicarResponsavelDaFasePadraoSeVazio(gate.supabase, cardId, fase.faseId, gate.userId);
  }

  revalidatePath('/rede-franqueados');
  revalidatePath('/funil-funding');
  const bp = String(input.basePath ?? '/funil-funding').trim() || '/funil-funding';
  revalidatePath(bp);

  return {
    ok: true,
    cadastroId,
    n_cadastro,
    cardId,
    mensagem: cardId
      ? `Cadastro ${n_cadastro} criado com card no Funil Funding.`
      : `Cadastro ${n_cadastro} criado.`,
  };
}

export async function atualizarCadastroMoniCapital(
  cadastroId: string,
  dados: MoniCapitalCadastroUpsertDados,
): Promise<Ok | Err> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const id = cadastroId.trim();
  if (!id) return { ok: false, error: 'Cadastro inválido.' };

  const patch = cleanDados(dados);
  const dup = await verificarDuplicataMoniCapital(patch, id);
  if (!dup.ok) return dup;

  patch.updated_at = new Date().toISOString();

  const { error } = await gate.supabase
    .from('moni_capital_cadastros')
    .update(patch as never)
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/rede-franqueados');
  revalidatePath('/funil-funding');
  return { ok: true, mensagem: 'Cadastro atualizado.' };
}

export async function vincularCadastroMoniCapitalAoCard(
  cardId: string,
  cadastroId: string,
): Promise<Ok | Err> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const cid = cardId.trim();
  const cadId = cadastroId.trim();
  if (!cid || !cadId) return { ok: false, error: 'Card ou cadastro inválido.' };

  const { data: cardRow, error: cardErr } = await gate.supabase
    .from('kanban_cards')
    .select('kanban_id, moni_capital_cadastro_id')
    .eq('id', cid)
    .maybeSingle();
  if (cardErr) return { ok: false, error: cardErr.message };
  if (!cardRow) return { ok: false, error: 'Card não encontrado.' };
  if (String((cardRow as { kanban_id?: string }).kanban_id) !== KANBAN_IDS.FUNDING) {
    return { ok: false, error: 'Vínculo permitido apenas em cards do Funil Funding.' };
  }

  const { data: cadRow, error: cadErr } = await gate.supabase
    .from('moni_capital_cadastros')
    .select('id, kanban_card_id')
    .eq('id', cadId)
    .maybeSingle();
  if (cadErr) return { ok: false, error: cadErr.message };
  if (!cadRow) return { ok: false, error: 'Cadastro não encontrado.' };

  const outroCard = (cadRow as { kanban_card_id?: string | null }).kanban_card_id;
  if (outroCard && outroCard !== cid) {
    return { ok: false, error: 'Este cadastro já está vinculado a outro card.' };
  }

  const atualCadastro = (cardRow as { moni_capital_cadastro_id?: string | null }).moni_capital_cadastro_id;
  if (atualCadastro && atualCadastro !== cadId) {
    await gate.supabase
      .from('moni_capital_cadastros')
      .update({ kanban_card_id: null, updated_at: new Date().toISOString() } as never)
      .eq('id', atualCadastro);
  }

  const link = await vincularCadastroECard(gate.supabase, cadId, cid);
  if (!link.ok) return link;

  revalidatePath('/rede-franqueados');
  revalidatePath('/funil-funding');
  return { ok: true, mensagem: 'Cadastro vinculado ao card.' };
}

export async function criarEVincularCadastroMoniCapitalNoCard(
  cardId: string,
  dados: MoniCapitalCadastroUpsertDados,
): Promise<Ok<{ cadastroId: string; n_cadastro: string }> | Err> {
  const criar = await criarCadastroMoniCapital({ ...dados, criarCardFunding: false });
  if (!criar.ok) return criar;

  const link = await vincularCadastroMoniCapitalAoCard(cardId, criar.cadastroId);
  if (!link.ok) return link;

  return {
    ok: true,
    cadastroId: criar.cadastroId,
    n_cadastro: criar.n_cadastro,
    mensagem: `Cadastro ${criar.n_cadastro} criado e vinculado.`,
  };
}

export async function obterProximoNCadastroMoniCapital(): Promise<
  Ok<{ n_cadastro: string }> | Err
> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;
  const { n_cadastro } = await getNextMCFromCadastros(gate.supabase);
  return { ok: true, n_cadastro };
}
