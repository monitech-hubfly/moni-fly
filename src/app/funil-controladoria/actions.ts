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

/** Cria cards em lote para o mês informado. Idempotente: ignora duplicatas por título. */
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

  // Filtra entidades ativas pelo tipo correto
  const tiposContabil = ['Gestora', 'Empresa adicional', 'SPE'];
  const tiposFiscal   = ['Funcionário', 'Obra'];
  const tipos = aba === 'contabil' ? tiposContabil : tiposFiscal;

  const { data: entidades, error: entErr } = await supabase
    .from('controladoria_entidades_cfg')
    .select('id, nome, tipo')
    .in('tipo', tipos)
    .eq('ativo', true);

  if (entErr) return { ok: false, error: entErr.message };
  if (!entidades?.length) return { ok: true, criados: 0, ignorados: 0 };

  // Busca titles já existentes no mês para idempotência
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

function buildTitulo(nome: string, tipo: string, mes: string): string {
  const prefix = tipo === 'Funcionário' ? 'Func: ' : tipo === 'Obra' ? 'Obra: ' : '';
  return `${prefix}${nome} — ${mes}`;
}
