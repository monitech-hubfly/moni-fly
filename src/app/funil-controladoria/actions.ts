'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { guardLoginRequired } from '@/lib/auth-guard';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';

/** Alterna o estado ativo/inativo de uma entidade na Configuração. */
export async function toggleEntidade(id: string, ativo: boolean): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { error } = await supabase
    .from('controladoria_entidades_cfg')
    .update({ ativo })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/funil-controladoria');
  return { ok: true };
}

type DisparadorResult = {
  ok: boolean;
  criados?: number;
  ignorados?: number;
  error?: string;
};

/** Cria cards em lote para o mês informado. Idempotente: ignora duplicatas por título.
 *  - Contábil: entidades da tabela controladoria_entidades_cfg (tipos Gestora/Empresa adicional/SPE)
 *  - Fiscal Funcionários: profiles com email @moni.casa (deduplicado por email)
 *  - Fiscal Obras: entidades da tabela controladoria_entidades_cfg (tipo Obra)
 */
export async function dispararMes(
  mes: string,
  aba: 'contabil' | 'fiscal',
): Promise<DisparadorResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const kanbanId =
    aba === 'contabil'
      ? KANBAN_IDS.CONTROLADORIA_CONTABIL
      : KANBAN_IDS.CONTROLADORIA_FISCAL;

  const faseSlugInicial = aba === 'contabil' ? 'ctrl_c_enviar_docs' : 'ctrl_f_cobranca';

  // Busca fase inicial
  const { data: faseRow, error: faseErr } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', kanbanId)
    .eq('slug', faseSlugInicial)
    .maybeSingle();

  if (faseErr || !faseRow) {
    return { ok: false, error: `Fase inicial não encontrada (${faseSlugInicial}). Verifique se a migration 567 foi aplicada.` };
  }

  // Monta lista de entidades por aba
  type EntidadeItem = { nome: string; tipo: string };
  let entidades: EntidadeItem[] = [];

  if (aba === 'contabil') {
    const { data, error } = await supabase
      .from('controladoria_entidades_cfg')
      .select('nome, tipo')
      .in('tipo', ['Gestora', 'Empresa adicional', 'SPE'])
      .eq('ativo', true);
    if (error) return { ok: false, error: error.message };
    entidades = data ?? [];
  } else {
    // Funcionários: todos os profiles @moni.casa, deduplicados por email
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('full_name, email')
      .ilike('email', '%@moni.casa')
      .order('full_name');
    if (profErr) return { ok: false, error: profErr.message };

    const emailsVistos = new Set<string>();
    for (const p of profiles ?? []) {
      const email = (p.email ?? '').toLowerCase().trim();
      if (!email || emailsVistos.has(email)) continue;
      emailsVistos.add(email);
      entidades.push({ nome: p.full_name ?? email, tipo: 'Funcionário' });
    }

    // Obras: da tabela de configuração
    const { data: obras, error: obraErr } = await supabase
      .from('controladoria_entidades_cfg')
      .select('nome, tipo')
      .eq('tipo', 'Obra')
      .eq('ativo', true);
    if (obraErr) return { ok: false, error: obraErr.message };
    entidades.push(...(obras ?? []));
  }

  if (!entidades.length) return { ok: true, criados: 0, ignorados: 0 };

  // Idempotência: busca títulos já existentes no mês
  const prefixoMes = ` — ${mes}`;
  const { data: existentes } = await supabase
    .from('kanban_cards')
    .select('titulo')
    .eq('kanban_id', kanbanId)
    .ilike('titulo', `%${prefixoMes}`);

  const titlesExistentes = new Set((existentes ?? []).map((c) => c.titulo ?? ''));

  const novos = entidades.filter((e) => {
    const titulo = buildTitulo(e.nome, e.tipo, mes);
    return !titlesExistentes.has(titulo);
  });

  if (!novos.length) return { ok: true, criados: 0, ignorados: entidades.length };

  const inserts = novos.map((e) => ({
    kanban_id: kanbanId,
    fase_id:   faseRow.id,
    titulo:    buildTitulo(e.nome, e.tipo, mes),
    status:    'ativo' as const,
    concluido: false,
  }));

  const { error: insErr } = await supabase.from('kanban_cards').insert(inserts as never[]);
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath('/funil-controladoria');
  return { ok: true, criados: novos.length, ignorados: entidades.length - novos.length };
}

/** Cria um card avulso no kanban Controladoria (Contábil ou Fiscal). */
export async function criarCardControladoria(params: {
  kanbanId: string;
  titulo: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const isContabil = params.kanbanId === KANBAN_IDS.CONTROLADORIA_CONTABIL;
  const faseSlug   = isContabil ? 'ctrl_c_enviar_docs' : 'ctrl_f_cobranca';

  const { data: faseRow, error: faseErr } = await supabase
    .from('kanban_fases')
    .select('id')
    .eq('kanban_id', params.kanbanId)
    .eq('slug', faseSlug)
    .maybeSingle();

  if (faseErr || !faseRow) {
    return { ok: false, error: 'Fase inicial não encontrada. Verifique se a migration 567 foi aplicada.' };
  }

  // Idempotência: verifica se já existe card com mesmo título
  const { data: existente } = await supabase
    .from('kanban_cards')
    .select('id')
    .eq('kanban_id', params.kanbanId)
    .eq('titulo', params.titulo)
    .maybeSingle();

  if (existente) {
    return { ok: false, error: `Já existe um card com o título "${params.titulo}" neste kanban.` };
  }

  const { error: insErr } = await supabase.from('kanban_cards').insert({
    kanban_id: params.kanbanId,
    fase_id:   faseRow.id,
    titulo:    params.titulo,
    status:    'ativo',
    concluido: false,
  } as never);

  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath('/funil-controladoria');
  return { ok: true };
}

/** Lista profiles @moni.casa (deduplicados por email) para o modal Fiscal. */
export async function listarProfilesMoniCasa(): Promise<{
  ok: boolean;
  profiles?: { id: string; nome: string; email: string }[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .ilike('email', '%@moni.casa')
    .order('full_name');

  if (error) return { ok: false, error: error.message };

  // Deduplica por email
  const emailsVistos = new Set<string>();
  const profiles: { id: string; nome: string; email: string }[] = [];
  for (const p of data ?? []) {
    const email = (p.email ?? '').toLowerCase().trim();
    if (!email || emailsVistos.has(email)) continue;
    emailsVistos.add(email);
    profiles.push({ id: p.id, nome: p.full_name ?? email, email });
  }

  return { ok: true, profiles };
}

/** Lista entidades contábeis ativas (para vinculação no card de Obra). */
export async function listarEntidadesContabeis(): Promise<{
  ok: boolean;
  entidades?: { id: string; nome: string; tipo: string }[];
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  guardLoginRequired(user);

  const { data, error } = await supabase
    .from('controladoria_entidades_cfg')
    .select('id, nome, tipo')
    .in('tipo', ['Gestora', 'Empresa adicional', 'SPE'])
    .eq('ativo', true)
    .order('tipo')
    .order('nome');

  if (error) return { ok: false, error: error.message };
  return { ok: true, entidades: data ?? [] };
}

function buildTitulo(nome: string, tipo: string, mes: string): string {
  const prefix = tipo === 'Funcionário' ? 'Func: ' : tipo === 'Obra' ? 'Obra: ' : '';
  return `${prefix}${nome} — ${mes}`;
}
