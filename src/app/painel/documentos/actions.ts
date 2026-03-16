'use server';

import { createClient } from '@/lib/supabase/server';

export type DocInstanceRevisao = {
  id: string;
  processo_id: string;
  step: number;
  versao: number;
  status: string;
  diff_json: {
    changes?: Array<{
      type: string;
      templateSlice?: string;
      documentSlice?: string;
      context?: string;
    }>;
    summary?: { total: number };
  } | null;
  motivo_reprovacao: string | null;
  created_at: string;
  processo_cidade: string | null;
  processo_estado: string | null;
};

export async function listInstancesAguardandoRevisao(): Promise<DocInstanceRevisao[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = profile?.role ?? 'frank';
  if (role !== 'consultor' && role !== 'admin') return [];

  let processoIds: string[] = [];
  if (role === 'admin') {
    const { data } = await supabase.from('processo_step_one').select('id').limit(500);
    processoIds = (data ?? []).map((p) => p.id);
  } else {
    const { data: franks } = await supabase
      .from('profiles')
      .select('id')
      .eq('consultor_id', user.id);
    const frankIds = (franks ?? []).map((f) => f.id);
    if (frankIds.length > 0) {
      const { data } = await supabase
        .from('processo_step_one')
        .select('id')
        .in('user_id', frankIds)
        .limit(500);
      processoIds = (data ?? []).map((p) => p.id);
    }
  }

  if (processoIds.length === 0) return [];

  const { data: instances } = await supabase
    .from('document_instances')
    .select('id, processo_id, step, versao, status, diff_json, motivo_reprovacao, created_at')
    .in('processo_id', processoIds)
    .eq('status', 'aguardando_revisao')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!instances?.length) return [];

  const { data: processos } = await supabase
    .from('processo_step_one')
    .select('id, cidade, estado')
    .in('id', [...new Set(instances.map((i) => i.processo_id))]);

  const processoMap = new Map((processos ?? []).map((p) => [p.id, p]));

  return instances.map((inst) => {
    const p = processoMap.get(inst.processo_id);
    return {
      id: inst.id,
      processo_id: inst.processo_id,
      step: inst.step,
      versao: inst.versao,
      status: inst.status,
      diff_json: inst.diff_json as DocInstanceRevisao['diff_json'],
      motivo_reprovacao: inst.motivo_reprovacao,
      created_at: inst.created_at,
      processo_cidade: p?.cidade ?? null,
      processo_estado: p?.estado ?? null,
    };
  });
}
