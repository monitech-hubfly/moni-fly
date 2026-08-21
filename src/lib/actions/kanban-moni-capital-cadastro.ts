'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import {
  fetchMoniCapitalCadastrosRows,
  labelCadastroMoniCapital,
  type MoniCapitalCadastroRow,
  type MoniCapitalCadastroUpsertDados,
} from '@/lib/moni-capital-cadastros';
import {
  criarEVincularCadastroMoniCapitalNoCard,
  vincularCadastroMoniCapitalAoCard,
} from '@/lib/moni-capital-cadastros-actions';

export type MoniCapitalCadastroModo = 'novo' | 'existente';

export type MoniCapitalCadastroOpcao = {
  id: string;
  label: string;
  n_cadastro: string;
};

export type MoniCapitalCadastroCardData =
  | {
      ok: true;
      cardCadastroId: string | null;
      cadastro: MoniCapitalCadastroRow | null;
      opcoes: MoniCapitalCadastroOpcao[];
      modoInicial: MoniCapitalCadastroModo;
      draftInicial: MoniCapitalCadastroUpsertDados;
    }
  | { ok: false; error: string };

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const access = normalizeAccessRole((profile as { role?: string } | null)?.role);
  if (access !== 'admin' && access !== 'team') {
    return { ok: false as const, error: 'Apenas administradores ou time podem gerir cadastros.' };
  }
  return { ok: true as const, supabase, userId: user.id };
}

function rowToDraft(row: MoniCapitalCadastroRow | null): MoniCapitalCadastroUpsertDados {
  if (!row) {
    return {
      broker_nome: '',
      broker_email: '',
      broker_telefone: '',
      investidor_nome: '',
      investidor_email: '',
      investidor_telefone: '',
    };
  }
  return {
    broker_nome: row.broker_nome ?? '',
    broker_email: row.broker_email ?? '',
    broker_telefone: row.broker_telefone ?? '',
    investidor_nome: row.investidor_nome ?? '',
    investidor_email: row.investidor_email ?? '',
    investidor_telefone: row.investidor_telefone ?? '',
  };
}

export async function carregarMoniCapitalCadastroCardData(
  cardId: string,
): Promise<MoniCapitalCadastroCardData> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const cid = cardId.trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };

  const [{ data: cardRow }, rows] = await Promise.all([
    gate.supabase.from('kanban_cards').select('moni_capital_cadastro_id').eq('id', cid).maybeSingle(),
    fetchMoniCapitalCadastrosRows(gate.supabase),
  ]);

  if (!rows) return { ok: false, error: 'Erro ao carregar cadastros Moní Capital.' };

  const cardCadastroId =
    String((cardRow as { moni_capital_cadastro_id?: string | null } | null)?.moni_capital_cadastro_id ?? '').trim() ||
    null;

  const cadastro = cardCadastroId ? rows.find((r) => r.id === cardCadastroId) ?? null : null;

  const opcoes: MoniCapitalCadastroOpcao[] = rows
    .filter((r) => !r.kanban_card_id || r.kanban_card_id === cid)
    .map((r) => ({
      id: r.id,
      n_cadastro: r.n_cadastro,
      label: labelCadastroMoniCapital(r),
    }));

  return {
    ok: true,
    cardCadastroId,
    cadastro,
    opcoes,
    modoInicial: cardCadastroId ? 'existente' : 'novo',
    draftInicial: rowToDraft(cadastro),
  };
}

export async function salvarMoniCapitalCadastroNoCard(input: {
  cardId: string;
  modo: MoniCapitalCadastroModo;
  cadastroId?: string;
  dados: MoniCapitalCadastroUpsertDados;
}): Promise<{ ok: true; mensagem: string } | { ok: false; error: string }> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const cardId = input.cardId.trim();
  if (!cardId) return { ok: false, error: 'Card inválido.' };

  if (input.modo === 'existente') {
    const cadastroId = String(input.cadastroId ?? '').trim();
    if (!cadastroId) return { ok: false, error: 'Selecione um cadastro existente.' };
    const res = await vincularCadastroMoniCapitalAoCard(cardId, cadastroId);
    if (!res.ok) return res;
    revalidatePath('/funil-funding');
    return { ok: true, mensagem: res.mensagem ?? 'Cadastro vinculado.' };
  }

  const res = await criarEVincularCadastroMoniCapitalNoCard(cardId, input.dados);
  if (!res.ok) return res;
  revalidatePath('/funil-funding');
  return { ok: true, mensagem: res.mensagem ?? 'Cadastro criado e vinculado.' };
}

export async function carregarMoniCapitalCadastroPorId(
  cadastroId: string,
): Promise<{ ok: true; cadastro: MoniCapitalCadastroRow } | { ok: false; error: string }> {
  const gate = await requireStaff();
  if (!gate.ok) return gate;

  const id = cadastroId.trim();
  if (!id) return { ok: false, error: 'Cadastro inválido.' };

  const { data, error } = await gate.supabase
    .from('moni_capital_cadastros')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Cadastro não encontrado.' };

  const row = data as Record<string, unknown>;
  const cadastro: MoniCapitalCadastroRow = {
    id: String(row.id),
    n_cadastro: String(row.n_cadastro ?? ''),
    ordem: Number(row.ordem ?? 0),
    broker_nome: (row.broker_nome as string | null) ?? null,
    broker_email: (row.broker_email as string | null) ?? null,
    broker_telefone: (row.broker_telefone as string | null) ?? null,
    investidor_nome: (row.investidor_nome as string | null) ?? null,
    investidor_email: (row.investidor_email as string | null) ?? null,
    investidor_telefone: (row.investidor_telefone as string | null) ?? null,
    kanban_card_id: (row.kanban_card_id as string | null) ?? null,
    criado_por: (row.criado_por as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  };

  return { ok: true, cadastro };
}
