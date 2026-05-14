'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeAccessRole } from '@/lib/authz';
import { appPath } from '@/lib/universidade/paths';
import { verificarDesbloqueioDb } from '@/lib/universidade/queries';
import type { UniEntregaTipo, UniProgressoStatus } from '@/lib/universidade/types';

function revalidateUniversidade() {
  revalidatePath(appPath('/universidade'));
  revalidatePath(appPath('/universidade/biblioteca'));
  revalidatePath(appPath('/universidade/certificados'));
  revalidatePath(appPath('/universidade/jornada'));
  revalidatePath(appPath('/admin/universidade'));
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null as null };
  return { supabase, user };
}

async function requireStaff() {
  const { supabase, user } = await requireUser();
  if (!user) return { supabase, user: null, ok: false as const, error: 'Faça login.' };
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  const role = normalizeAccessRole((prof as { role?: string } | null)?.role);
  if (role !== 'admin' && role !== 'team') {
    return { supabase, user, ok: false as const, error: 'Sem permissão.' };
  }
  return { supabase, user, ok: true as const, role };
}

export async function verificarDesbloqueio(userId: string, casaNumero: number): Promise<boolean> {
  const supabase = await createClient();
  return verificarDesbloqueioDb(supabase, userId, casaNumero);
}

export async function verificarEmissaoCertificado(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc('uni_sync_certificados', { p_user_id: userId });
    if (error) return { ok: false, error: error.message };
    revalidateUniversidade();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Primeira linha de progresso da casa (pendente no 1.º módulo) — libera gravação nos demais módulos. */
export async function registrarInicioFaseCasa(casaId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const cid = casaId.trim();
  if (!cid) return { ok: false, error: 'Casa inválida.' };

  const { data: modsCasa, error: em } = await supabase.from('uni_modulos').select('id').eq('casa_id', cid);
  if (em) return { ok: false, error: em.message };
  const modIds = (modsCasa ?? []).map((m) => String((m as { id: string }).id));
  if (modIds.length === 0) return { ok: false, error: 'Não há módulos nesta fase.' };

  const { count, error: ec } = await supabase
    .from('uni_progresso')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('modulo_id', modIds);
  if (ec) return { ok: false, error: ec.message };
  if ((count ?? 0) > 0) {
    revalidateUniversidade();
    return { ok: true };
  }

  const { data: first, error: e1 } = await supabase
    .from('uni_modulos')
    .select('id')
    .eq('casa_id', cid)
    .order('ordem', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (e1) return { ok: false, error: e1.message };
  if (!first?.id) return { ok: false, error: 'Não há módulos nesta fase.' };

  const mid = String((first as { id: string }).id);
  if (!modIds.includes(mid)) return { ok: false, error: 'Módulo inválido para esta casa.' };
  const { error: e2 } = await supabase.from('uni_progresso').upsert(
    {
      user_id: user.id,
      modulo_id: mid,
      casa_id: cid,
      status: 'pendente',
      dados: null,
    },
    { onConflict: 'user_id,modulo_id' },
  );
  if (e2) return { ok: false, error: e2.message };

  revalidateUniversidade();
  return { ok: true };
}

export async function atualizarProgresso(
  moduloId: string,
  status: UniProgressoStatus,
  dados?: Record<string, unknown> | null,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const mid = moduloId.trim();
  if (!mid) return { ok: false, error: 'Módulo inválido.' };

  const { data: mod, error: e1 } = await supabase.from('uni_modulos').select('id, casa_id').eq('id', mid).maybeSingle();
  if (e1) return { ok: false, error: e1.message };
  if (!mod) return { ok: false, error: 'Módulo não encontrado.' };

  const casaId = mod.casa_id != null ? String(mod.casa_id) : null;
  if (casaId) {
    const { data: rowThis } = await supabase
      .from('uni_progresso')
      .select('id')
      .eq('user_id', user.id)
      .eq('modulo_id', mid)
      .maybeSingle();
    if (!rowThis) {
      const { data: modsCasa, error: em } = await supabase.from('uni_modulos').select('id').eq('casa_id', casaId);
      if (em) return { ok: false, error: em.message };
      const modIds = (modsCasa ?? []).map((m) => String((m as { id: string }).id));
      if (modIds.length === 0) {
        return {
          ok: false,
          error: 'Inicie a fase no topo da página para registrar progresso nesta casa.',
        };
      }
      const { count, error: ec } = await supabase
        .from('uni_progresso')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('modulo_id', modIds);
      if (ec) return { ok: false, error: ec.message };
      if ((count ?? 0) === 0) {
        return {
          ok: false,
          error: 'Inicie a fase no topo da página para registrar progresso nesta casa.',
        };
      }
    }
  }

  const patch: Record<string, unknown> = {
    user_id: user.id,
    modulo_id: mid,
    casa_id: mod.casa_id,
    status,
    dados: dados ?? null,
  };
  if (status === 'concluido') {
    patch.concluido_em = new Date().toISOString();
  }

  const { error: e2 } = await supabase.from('uni_progresso').upsert(patch, { onConflict: 'user_id,modulo_id' });
  if (e2) return { ok: false, error: e2.message };

  revalidateUniversidade();
  return { ok: true };
}

export async function marcarModuloConcluido(
  moduloId: string,
  dados?: Record<string, unknown> | null,
): Promise<{ ok: boolean; error?: string }> {
  const r = await atualizarProgresso(moduloId, 'concluido', dados);
  if (!r.ok) return r;

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const { data: mod } = await supabase.from('uni_modulos').select('casa_id').eq('id', moduloId.trim()).maybeSingle();
  if (!mod?.casa_id) {
    await verificarEmissaoCertificado(user.id);
    return { ok: true };
  }

  const casaId = String(mod.casa_id);
  const { data: obr } = await supabase.from('uni_modulos').select('id').eq('casa_id', casaId).eq('obrigatorio', true);
  const ids = (obr ?? []).map((x) => String((x as { id: string }).id));
  if (ids.length === 0) {
    await verificarEmissaoCertificado(user.id);
    return { ok: true };
  }

  const { data: done } = await supabase
    .from('uni_progresso')
    .select('modulo_id')
    .eq('user_id', user.id)
    .in('modulo_id', ids)
    .eq('status', 'concluido');
  const setDone = new Set((done ?? []).map((d) => String((d as { modulo_id: string }).modulo_id)));
  const allDone = ids.every((id) => setDone.has(id));
  if (allDone) {
    await verificarEmissaoCertificado(user.id);
  }

  return { ok: true };
}

export async function enviarEntrega(
  casaId: string,
  moduloId: string,
  tipo: UniEntregaTipo,
  valor: string,
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  const { error } = await supabase.from('uni_entregas').insert({
    user_id: user.id,
    casa_id: casaId.trim() || null,
    modulo_id: moduloId.trim() || null,
    tipo,
    valor: valor.trim(),
    aprovado: null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateUniversidade();
  return { ok: true };
}

export async function aprovarEntrega(
  entregaId: string,
  aprovado: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  const { supabase, user } = staff;
  const id = entregaId.trim();
  if (!id) return { ok: false, error: 'Entrega inválida.' };

  const { error } = await supabase
    .from('uni_entregas')
    .update({
      aprovado,
      aprovado_por: user.id,
    })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidateUniversidade();
  return { ok: true };
}

export type AdminFrankProgressoRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  nivel: number;
  casas_concluidas: number;
  modulos_feitos: number;
  ultima_atividade: string | null;
};

/** Lista franqueados com agregados (RLS: só admin/team enxergam todos os progressos). */
export async function listarProgressoFranqueadosAdmin(): Promise<
  { ok: true; rows: AdminFrankProgressoRow[] } | { ok: false; error: string }
> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  const { supabase } = staff;

  const { data: franks, error: e1 } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'frank');
  if (e1) return { ok: false, error: e1.message };

  const { data: certRows } = await supabase.from('uni_certificados').select('user_id, nivel');
  const nivelPorUser = new Map<string, number>();
  for (const c of certRows ?? []) {
    const uid = String((c as { user_id: string }).user_id);
    const n = Number((c as { nivel: number }).nivel);
    nivelPorUser.set(uid, Math.max(nivelPorUser.get(uid) ?? 0, n));
  }

  const { data: progRows } = await supabase
    .from('uni_progresso')
    .select('user_id, modulo_id, status, concluido_em, criado_em');

  const modulosPorUser = new Map<string, Set<string>>();
  const ultimaPorUser = new Map<string, string>();
  for (const p of progRows ?? []) {
    const uid = String((p as { user_id: string }).user_id);
    const st = String((p as { status?: string }).status ?? '');
    const ts =
      (p as { concluido_em?: string | null; criado_em?: string | null }).concluido_em ??
      (p as { criado_em?: string | null }).criado_em ??
      null;
    if (st === 'concluido') {
      if (!modulosPorUser.has(uid)) modulosPorUser.set(uid, new Set());
      modulosPorUser.get(uid)!.add(String((p as { modulo_id: string }).modulo_id));
    }
    if (ts) {
      const cur = ultimaPorUser.get(uid);
      if (!cur || ts > cur) ultimaPorUser.set(uid, ts);
    }
  }

  const { data: casas } = await supabase.from('uni_casas').select('id, numero').eq('ativa', true);

  const { data: mods } = await supabase.from('uni_modulos').select('id, casa_id, obrigatorio');

  const rows: AdminFrankProgressoRow[] = (franks ?? []).map((f) => {
    const uid = String((f as { id: string }).id);
    const doneMods = modulosPorUser.get(uid) ?? new Set<string>();
    let modulosFeitos = 0;
    const casasCompletas = new Set<number>();
    for (const mid of doneMods) {
      const obr = (mods ?? []).find((m) => String((m as { id: string }).id) === mid) as
        | { obrigatorio?: boolean }
        | undefined;
      if (obr && obr.obrigatorio !== false) modulosFeitos++;
    }
    for (const c of casas ?? []) {
      const cid = String((c as { id: string }).id);
      const num = Number((c as { numero: number }).numero);
      const obrModIds = (mods ?? [])
        .filter((m) => String((m as { casa_id: string }).casa_id) === cid && (m as { obrigatorio?: boolean }).obrigatorio !== false)
        .map((m) => String((m as { id: string }).id));
      if (obrModIds.length === 0) continue;
      if (obrModIds.every((id) => doneMods.has(id))) casasCompletas.add(num);
    }

    return {
      user_id: uid,
      full_name: (f as { full_name?: string | null }).full_name ?? null,
      email: (f as { email?: string | null }).email ?? null,
      nivel: nivelPorUser.get(uid) ?? 0,
      casas_concluidas: casasCompletas.size,
      modulos_feitos: modulosFeitos,
      ultima_atividade: ultimaPorUser.get(uid) ?? null,
    };
  });

  rows.sort((a, b) => (a.full_name ?? a.email ?? '').localeCompare(b.full_name ?? b.email ?? ''));
  return { ok: true, rows };
}

export type EntregaPendenteAdminRow = {
  id: string;
  user_id: string;
  franqueado_nome: string | null;
  valor: string | null;
  tipo: string | null;
  criado_em: string | null;
};

export async function listarEntregasPendentesAdmin(): Promise<
  { ok: true; rows: EntregaPendenteAdminRow[] } | { ok: false; error: string }
> {
  const staff = await requireStaff();
  if (!staff.ok) return { ok: false, error: staff.error };
  const { supabase } = staff;
  const { data, error } = await supabase
    .from('uni_entregas')
    .select('id, user_id, valor, tipo, criado_em')
    .is('aprovado', null)
    .order('criado_em', { ascending: true });
  if (error) return { ok: false, error: error.message };

  const rowsRaw = (data ?? []) as {
    id: string;
    user_id: string;
    valor?: string | null;
    tipo?: string | null;
    criado_em?: string | null;
  }[];
  const uids = [...new Set(rowsRaw.map((r) => String(r.user_id)).filter(Boolean))];
  const nomePorId = new Map<string, string>();
  if (uids.length > 0) {
    const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', uids);
    for (const p of profs ?? []) {
      const id = String((p as { id: string }).id);
      const nm = String((p as { full_name?: string | null }).full_name ?? '').trim();
      const em = String((p as { email?: string | null }).email ?? '').trim();
      nomePorId.set(id, nm || em || id);
    }
  }

  return {
    ok: true,
    rows: rowsRaw.map((r) => ({
      id: String(r.id),
      user_id: String(r.user_id),
      franqueado_nome: nomePorId.get(String(r.user_id)) ?? null,
      valor: r.valor ?? null,
      tipo: r.tipo ?? null,
      criado_em: r.criado_em ?? null,
    })),
  };
}
