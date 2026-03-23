'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

type Entidade = 'incorporadora' | 'spe' | 'gestora';

type ChecklistPayload = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  data_abertura: string;
  situacao: 'Ativa' | 'Inativa' | '';
  cnaes: string[];
  endereco: string;
  inscricao_municipal_1: string;
  inscricao_municipal_2: string;
  upload_contrato_social: string;
  upload_cartao_cnpj: string;
  upload_comprovante_endereco: string;
};

function tableFor(entidade: Entidade): string {
  if (entidade === 'incorporadora') return 'checklist_incorporadora';
  if (entidade === 'spe') return 'checklist_spe';
  return 'checklist_gestora';
}

function clean(v: string | null | undefined): string | null {
  const s = String(v ?? '').trim();
  return s ? s : null;
}

function normalize(payload: ChecklistPayload) {
  return {
    cnpj: clean(payload.cnpj),
    razao_social: clean(payload.razao_social),
    nome_fantasia: clean(payload.nome_fantasia),
    data_abertura: clean(payload.data_abertura),
    situacao: clean(payload.situacao) as 'Ativa' | 'Inativa' | null,
    cnaes: (payload.cnaes ?? []).map((x) => String(x).trim()).filter(Boolean),
    endereco: clean(payload.endereco),
    inscricao_municipal_1: clean(payload.inscricao_municipal_1),
    inscricao_municipal_2: clean(payload.inscricao_municipal_2),
    upload_contrato_social: clean(payload.upload_contrato_social),
    upload_cartao_cnpj: clean(payload.upload_cartao_cnpj),
    upload_comprovante_endereco: clean(payload.upload_comprovante_endereco),
  };
}

function isComplete(payload: ChecklistPayload): boolean {
  const p = normalize(payload);
  return Boolean(
    p.cnpj &&
      p.razao_social &&
      p.nome_fantasia &&
      p.data_abertura &&
      p.situacao &&
      p.cnaes.length > 0 &&
      p.endereco &&
      p.upload_contrato_social &&
      p.upload_cartao_cnpj &&
      p.upload_comprovante_endereco,
  );
}

export async function getChecklistContabilidadeForCard(processoId: string, entidade: Entidade) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };

  const table = tableFor(entidade);
  const { data: own, error } = await supabase.from(table).select('*').eq('processo_id', processoId).maybeSingle();
  if (error) return { ok: false as const, error: error.message };

  let candidate: any = null;
  if (own?.cnpj) {
    const { data: cand } = await supabase
      .from(table)
      .select('*')
      .eq('cnpj', own.cnpj)
      .neq('processo_id', processoId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    candidate = cand ?? null;
  }

  return {
    ok: true as const,
    record: own ?? null,
    hasOwnRecord: Boolean(own),
    candidate,
  };
}

export async function findChecklistContabilidadeByCnpj(entidade: Entidade, cnpj: string, processoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };

  const cnpjClean = clean(cnpj);
  if (!cnpjClean) return { ok: true as const, candidate: null };

  const table = tableFor(entidade);
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('cnpj', cnpjClean)
    .neq('processo_id', processoId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, candidate: data ?? null };
}

export async function saveChecklistContabilidadeDraft(
  processoId: string,
  entidade: Entidade,
  payload: ChecklistPayload,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Faça login.' };

  const table = tableFor(entidade);
  const p = normalize(payload);
  const { error } = await supabase.from(table).upsert(
    {
      processo_id: processoId,
      ...p,
      preenchido_por: user.id,
      completo: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'processo_id' },
  );
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/painel-contabilidade');
  revalidatePath('/painel-novos-negocios');
  return { ok: true as const };
}

export async function concluirChecklistContabilidade(
  processoId: string,
  entidade: Entidade,
  payload: ChecklistPayload,
) {
  if (!isComplete(payload)) return { ok: false as const, error: 'Checklist incompleto.' };
  const draft = await saveChecklistContabilidadeDraft(processoId, entidade, payload);
  if (!draft.ok) return draft;

  const supabase = await createClient();
  const table = tableFor(entidade);
  const { error } = await supabase
    .from(table)
    .update({ completo: true, updated_at: new Date().toISOString() })
    .eq('processo_id', processoId);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath('/painel-contabilidade');
  revalidatePath('/painel-novos-negocios');
  return { ok: true as const };
}
