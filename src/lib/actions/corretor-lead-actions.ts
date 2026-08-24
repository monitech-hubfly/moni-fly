'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FASE_SLUGS, KANBAN_IDS } from '@/lib/constants/kanban-ids';

export type CorretorLeadActionResult =
  | { ok: true; token?: string; url?: string; cardId?: string }
  | { ok: false; error: string };

function appBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    '';
  if (!raw) return 'http://localhost:3000';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/\/$/, '')}`;
}

export async function gerarLinkCorretorLead(input: {
  nome_corretor: string;
  imobiliaria_corretor: string;
  email_corretor?: string | null;
}): Promise<CorretorLeadActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login para gerar o link.' };

  const nome = String(input.nome_corretor ?? '').trim();
  const imobiliaria = String(input.imobiliaria_corretor ?? '').trim();
  const email = String(input.email_corretor ?? '').trim() || null;
  if (!nome) return { ok: false, error: 'Informe o nome do corretor.' };
  if (!imobiliaria) return { ok: false, error: 'Informe a imobiliária.' };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Serviço indisponível.' };
  }

  const { data, error } = await admin
    .from('kanban_corretor_lead_tokens')
    .insert({
      nome_corretor: nome,
      imobiliaria_corretor: imobiliaria,
      email_corretor: email,
      created_by: user.id,
      ativo: true,
    } as never)
    .select('token')
    .single();

  if (error) return { ok: false, error: error.message };
  const token = String((data as { token?: string } | null)?.token ?? '').trim();
  if (!token) return { ok: false, error: 'Não foi possível gerar o token.' };

  const url = `${appBaseUrl()}/formulario-corretor/${token}`;
  revalidatePath('/corretores');
  return { ok: true, token, url };
}

export async function buscarTokenCorretorLead(token: string): Promise<
  | {
      ok: true;
      nome_corretor: string;
      imobiliaria_corretor: string;
      email_corretor: string | null;
    }
  | { ok: false; error: string }
> {
  const t = String(token ?? '').trim();
  if (!t) return { ok: false, error: 'Link inválido.' };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Serviço indisponível.' };
  }

  const { data, error } = await admin
    .from('kanban_corretor_lead_tokens')
    .select('nome_corretor, imobiliaria_corretor, email_corretor, ativo, expires_at')
    .eq('token', t)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Link inválido ou inexistente.' };

  const row = data as {
    nome_corretor: string;
    imobiliaria_corretor: string;
    email_corretor: string | null;
    ativo: boolean;
    expires_at: string;
  };
  if (!row.ativo) return { ok: false, error: 'Este link foi desativado.' };
  if (new Date(row.expires_at) < new Date()) return { ok: false, error: 'Este link expirou.' };

  return {
    ok: true,
    nome_corretor: row.nome_corretor,
    imobiliaria_corretor: row.imobiliaria_corretor,
    email_corretor: row.email_corretor,
  };
}

export async function submeterFormularioCorretorLead(input: {
  token: string;
  nome_cliente: string;
  telefone: string;
  email?: string | null;
  empreendimento_interesse?: string | null;
  tipologia_interesse?: string | null;
  orcamento_estimado?: string | null;
  cidade_interesse?: string | null;
  mensagem_livre?: string | null;
}): Promise<CorretorLeadActionResult> {
  const token = String(input.token ?? '').trim();
  const nomeCliente = String(input.nome_cliente ?? '').trim();
  const telefone = String(input.telefone ?? '').trim();
  if (!token) return { ok: false, error: 'Link inválido.' };
  if (!nomeCliente) return { ok: false, error: 'Informe o nome do cliente.' };
  if (!telefone) return { ok: false, error: 'Informe o telefone.' };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Serviço indisponível.' };
  }

  const { data: tok, error: tokErr } = await admin
    .from('kanban_corretor_lead_tokens')
    .select('id, nome_corretor, imobiliaria_corretor, ativo, expires_at, created_by')
    .eq('token', token)
    .maybeSingle();
  if (tokErr) return { ok: false, error: tokErr.message };
  if (!tok) return { ok: false, error: 'Link inválido.' };

  const tokRow = tok as {
    id: string;
    nome_corretor: string;
    imobiliaria_corretor: string;
    ativo: boolean;
    expires_at: string;
    created_by: string | null;
  };
  if (!tokRow.ativo) return { ok: false, error: 'Este link foi desativado.' };
  if (new Date(tokRow.expires_at) < new Date()) return { ok: false, error: 'Este link expirou.' };

  const { data: fase, error: faseErr } = await admin
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', KANBAN_IDS.CORRETORES)
    .eq('slug', FASE_SLUGS.COR_OPORTUNIDADE)
    .maybeSingle();
  if (faseErr) return { ok: false, error: faseErr.message };
  const faseId = String((fase as { id?: string } | null)?.id ?? '').trim();
  if (!faseId) return { ok: false, error: 'Fase Oportunidade não encontrada. Rode a migration do Funil Corretores.' };

  const orcRaw = String(input.orcamento_estimado ?? '').trim().replace(/\./g, '').replace(',', '.');
  const orcamento = orcRaw ? Number(orcRaw) : null;

  const { data: card, error: cardErr } = await admin
    .from('kanban_cards')
    .insert({
      kanban_id: KANBAN_IDS.CORRETORES,
      fase_id: faseId,
      titulo: nomeCliente,
      status: 'ativo',
      franqueado_id: tokRow.created_by,
      nome_corretor: tokRow.nome_corretor,
      imobiliaria_corretor: tokRow.imobiliaria_corretor,
      empreendimento_interesse: String(input.empreendimento_interesse ?? '').trim() || null,
      tipologia_interesse: String(input.tipologia_interesse ?? '').trim() || null,
      cidade_interesse: String(input.cidade_interesse ?? '').trim() || null,
      telefone_lead: telefone,
      email_lead: String(input.email ?? '').trim() || null,
      mensagem_lead: String(input.mensagem_livre ?? '').trim() || null,
      orcamento_lead: Number.isFinite(orcamento) ? orcamento : null,
      entered_fase_at: new Date().toISOString(),
    } as never)
    .select('id')
    .single();

  if (cardErr) return { ok: false, error: cardErr.message };
  const cardId = String((card as { id?: string } | null)?.id ?? '').trim();

  await admin
    .from('kanban_corretor_lead_tokens')
    .update({ ultimo_uso_em: new Date().toISOString() } as never)
    .eq('id', tokRow.id);

  revalidatePath('/corretores');
  return { ok: true, cardId };
}
