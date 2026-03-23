'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const USUARIOS_CREDITO = ['neil', 'kim', 'fernanda', 'murillo', 'ingrid', 'danilo'] as const;
// Guardamos o padrão de obrigatoriedades para reativar depois.
const ENFORCE_CHECKLIST_CREDITO_REQUIRED = false;

type CategoriaProfissional =
  | 'Empresário'
  | 'Assalariado'
  | 'Funcionário Público ou Aposentado'
  | 'Profissional Liberal / Autônomo'
  | 'Renda de Aluguel'
  | 'Pessoa Jurídica'
  | '';

type ChecklistCreditoForm = {
  upload_iptu: string | null;
  upload_matricula: string | null;
  upload_orcamento_cronograma: string | null;
  upload_projeto_aprovado: string | null;
  uploads_documentos_pessoais: string[];
  categoria_profissional: CategoriaProfissional;
  upload_contrato_social: string | null;
  uploads_extratos_pf: string[];
  upload_irpf: string | null;
  operacao_acima_3m: boolean | null;
  uploads_extratos_pj: string[];
  upload_faturamento_12m: string | null;
  uploads_ctps: string[];
  uploads_holerite: string[];
  upload_comprovante_salario: string | null;
  descricao_atividade: string | null;
  presta_servico_empresas: boolean | null;
  upload_contrato_prestacao: string | null;
  upload_contrato_aluguel: string | null;
  uploads_extratos_aluguel: string[];
  valor_operacao_pj: 'Até R$ 1.000.000,00' | 'Acima de R$ 1.000.000,00' | '';
  upload_contrato_social_pj: string | null;
  upload_faturamento_pj: string | null;
  uploads_extratos_pj_cc: string[];
  upload_balanco_dre: string | null;
  endividamento_info: string | null;
};

type ChecklistCreditoRecord = ChecklistCreditoForm & {
  id: string;
  processo_id: string;
  franqueado_id: string | null;
  nome_franqueado: string | null;
  preenchido_por: string | null;
  completo: boolean;
  created_at: string;
  updated_at: string;
};

const EMPTY_FORM: ChecklistCreditoForm = {
  upload_iptu: null,
  upload_matricula: null,
  upload_orcamento_cronograma: null,
  upload_projeto_aprovado: null,
  uploads_documentos_pessoais: [],
  categoria_profissional: '',
  upload_contrato_social: null,
  uploads_extratos_pf: [],
  upload_irpf: null,
  operacao_acima_3m: null,
  uploads_extratos_pj: [],
  upload_faturamento_12m: null,
  uploads_ctps: [],
  uploads_holerite: [],
  upload_comprovante_salario: null,
  descricao_atividade: null,
  presta_servico_empresas: null,
  upload_contrato_prestacao: null,
  upload_contrato_aluguel: null,
  uploads_extratos_aluguel: [],
  valor_operacao_pj: '',
  upload_contrato_social_pj: null,
  upload_faturamento_pj: null,
  uploads_extratos_pj_cc: [],
  upload_balanco_dre: null,
  endividamento_info: null,
};

const FILE_FIELDS = new Set([
  'upload_iptu',
  'upload_matricula',
  'upload_orcamento_cronograma',
  'upload_projeto_aprovado',
  'uploads_documentos_pessoais',
  'upload_contrato_social',
  'uploads_extratos_pf',
  'upload_irpf',
  'uploads_extratos_pj',
  'upload_faturamento_12m',
  'uploads_ctps',
  'uploads_holerite',
  'upload_comprovante_salario',
  'upload_contrato_prestacao',
  'upload_contrato_aluguel',
  'uploads_extratos_aluguel',
  'upload_contrato_social_pj',
  'upload_faturamento_pj',
  'uploads_extratos_pj_cc',
  'upload_balanco_dre',
]);

type ProcessoMeta = {
  id: string;
  user_id: string | null;
  franqueado_id: string | null;
  nome_franqueado: string | null;
};

async function getProcessoMeta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  processoId: string,
): Promise<{ ok: true; processo: ProcessoMeta } | { ok: false; error: string }> {
  try {
    const { data: withFrankId, error: err1 } = await supabase
      .from('processo_step_one')
      .select('id, franqueado_id, nome_franqueado, user_id')
      .eq('id', processoId)
      .maybeSingle();
    if (err1) throw err1;
    if (!withFrankId) return { ok: false, error: 'Processo não encontrado.' };
    return {
      ok: true,
      processo: {
        id: String((withFrankId as any).id),
        user_id: ((withFrankId as any).user_id ?? null) as string | null,
        franqueado_id: ((withFrankId as any).franqueado_id ?? null) as string | null,
        nome_franqueado: ((withFrankId as any).nome_franqueado ?? null) as string | null,
      },
    };
  } catch {
    const { data: fallback, error: err2 } = await supabase
      .from('processo_step_one')
      .select('id, nome_franqueado, user_id')
      .eq('id', processoId)
      .maybeSingle();
    if (err2 || !fallback) return { ok: false, error: err2?.message ?? 'Processo não encontrado.' };
    return {
      ok: true,
      processo: {
        id: String((fallback as any).id),
        user_id: ((fallback as any).user_id ?? null) as string | null,
        franqueado_id: null,
        nome_franqueado: ((fallback as any).nome_franqueado ?? null) as string | null,
      },
    };
  }
}

function hasOne(v: string | null | undefined): boolean {
  return Boolean(v && String(v).trim());
}

function hasList(v: unknown): boolean {
  return Array.isArray(v) && v.length > 0;
}

function computeCompleto(form: ChecklistCreditoForm): boolean {
  const baseOk =
    hasOne(form.upload_iptu) &&
    hasOne(form.upload_matricula) &&
    hasOne(form.upload_orcamento_cronograma) &&
    hasOne(form.upload_projeto_aprovado) &&
    hasList(form.uploads_documentos_pessoais) &&
    hasOne(form.categoria_profissional);

  if (!baseOk) return false;

  switch (form.categoria_profissional) {
    case 'Empresário':
      if (!hasOne(form.upload_contrato_social) || !hasList(form.uploads_extratos_pf) || !hasOne(form.upload_irpf)) return false;
      if (form.operacao_acima_3m === true) {
        return hasList(form.uploads_extratos_pj) && hasOne(form.upload_faturamento_12m);
      }
      return form.operacao_acima_3m === false;
    case 'Assalariado':
      return hasList(form.uploads_ctps) && hasList(form.uploads_holerite) && hasOne(form.upload_irpf);
    case 'Funcionário Público ou Aposentado':
      return hasOne(form.upload_comprovante_salario) && hasOne(form.upload_irpf);
    case 'Profissional Liberal / Autônomo':
      if (!hasOne(form.descricao_atividade) || !hasList(form.uploads_extratos_pf) || !hasOne(form.upload_irpf)) return false;
      if (form.presta_servico_empresas === true) return hasOne(form.upload_contrato_prestacao);
      return form.presta_servico_empresas === false;
    case 'Renda de Aluguel':
      return hasOne(form.upload_contrato_aluguel) && hasList(form.uploads_extratos_aluguel) && hasOne(form.upload_irpf);
    case 'Pessoa Jurídica':
      if (!hasOne(form.valor_operacao_pj)) return false;
      if (form.valor_operacao_pj === 'Até R$ 1.000.000,00') {
        return hasOne(form.upload_contrato_social_pj) && hasOne(form.upload_faturamento_pj) && hasList(form.uploads_extratos_pj_cc);
      }
      return (
        hasOne(form.upload_balanco_dre) &&
        hasOne(form.upload_contrato_social_pj) &&
        hasOne(form.upload_faturamento_pj) &&
        hasList(form.uploads_extratos_pj_cc) &&
        hasOne(form.endividamento_info)
      );
    default:
      return false;
  }
}

function normalizeRow(row: any): ChecklistCreditoRecord {
  return {
    id: String(row.id),
    processo_id: String(row.processo_id),
    franqueado_id: row.franqueado_id ? String(row.franqueado_id) : null,
    nome_franqueado: row.nome_franqueado ?? null,
    preenchido_por: row.preenchido_por ? String(row.preenchido_por) : null,
    completo: Boolean(row.completo),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
    upload_iptu: row.upload_iptu ?? null,
    upload_matricula: row.upload_matricula ?? null,
    upload_orcamento_cronograma: row.upload_orcamento_cronograma ?? null,
    upload_projeto_aprovado: row.upload_projeto_aprovado ?? null,
    uploads_documentos_pessoais: row.uploads_documentos_pessoais ?? [],
    categoria_profissional: row.categoria_profissional ?? '',
    upload_contrato_social: row.upload_contrato_social ?? null,
    uploads_extratos_pf: row.uploads_extratos_pf ?? [],
    upload_irpf: row.upload_irpf ?? null,
    operacao_acima_3m: row.operacao_acima_3m ?? null,
    uploads_extratos_pj: row.uploads_extratos_pj ?? [],
    upload_faturamento_12m: row.upload_faturamento_12m ?? null,
    uploads_ctps: row.uploads_ctps ?? [],
    uploads_holerite: row.uploads_holerite ?? [],
    upload_comprovante_salario: row.upload_comprovante_salario ?? null,
    descricao_atividade: row.descricao_atividade ?? null,
    presta_servico_empresas: row.presta_servico_empresas ?? null,
    upload_contrato_prestacao: row.upload_contrato_prestacao ?? null,
    upload_contrato_aluguel: row.upload_contrato_aluguel ?? null,
    uploads_extratos_aluguel: row.uploads_extratos_aluguel ?? [],
    valor_operacao_pj: row.valor_operacao_pj ?? '',
    upload_contrato_social_pj: row.upload_contrato_social_pj ?? null,
    upload_faturamento_pj: row.upload_faturamento_pj ?? null,
    uploads_extratos_pj_cc: row.uploads_extratos_pj_cc ?? [],
    upload_balanco_dre: row.upload_balanco_dre ?? null,
    endividamento_info: row.endividamento_info ?? null,
  };
}

async function buildSignedUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: ChecklistCreditoRecord,
): Promise<Record<string, string>> {
  const paths: string[] = [];
  Object.entries(row).forEach(([k, v]) => {
    if (!FILE_FIELDS.has(k)) return;
    if (Array.isArray(v)) paths.push(...v.filter(Boolean).map(String));
    else if (typeof v === 'string' && v) paths.push(v);
  });
  const uniq = [...new Set(paths)];
  const map: Record<string, string> = {};
  for (const p of uniq) {
    const { data } = await supabase.storage.from('checklist-credito').createSignedUrl(p, 3600);
    if (data?.signedUrl) map[p] = data.signedUrl;
  }
  return map;
}

export async function getChecklistCreditoForCard(processoId: string): Promise<
  | {
      ok: true;
      record: ChecklistCreditoRecord | null;
      hasOwnRecord: boolean;
      canView: boolean;
      signedUrls: Record<string, string>;
      candidate: ChecklistCreditoRecord | null;
      myUserId: string;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const processoRes = await getProcessoMeta(supabase, processoId);
  if (!processoRes.ok) return processoRes;
  const processo = processoRes.processo;

  const { data: byTable } = await supabase
    .from('credito_acesso_permitido')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  const rawName = String((user.user_metadata as any)?.name ?? (user.user_metadata as any)?.full_name ?? '').toLowerCase();
  const rawMail = String(user.email ?? '').toLowerCase();
  const byKeyword = USUARIOS_CREDITO.some((n) => rawName.includes(n) || rawMail.includes(n));

  const { data: own } = await supabase.from('checklist_credito').select('*').eq('processo_id', processoId).maybeSingle();
  const ownRecord = own ? normalizeRow(own) : null;

  let cand: any = null;
  if (processo.franqueado_id) {
    const { data } = await supabase
      .from('checklist_credito')
      .select('*')
      .eq('franqueado_id', processo.franqueado_id)
      .neq('processo_id', processoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    cand = data ?? null;
  } else if (processo.nome_franqueado) {
    const { data } = await supabase
      .from('checklist_credito')
      .select('*')
      .eq('nome_franqueado', processo.nome_franqueado)
      .neq('processo_id', processoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    cand = data ?? null;
  }

  const candidate = cand ? normalizeRow(cand) : null;
  const canView =
    Boolean(byTable) || byKeyword || (ownRecord ? ownRecord.preenchido_por === user.id : String(processo.user_id ?? '') === user.id);

  const signedUrls = canView && ownRecord ? await buildSignedUrls(supabase, ownRecord) : {};
  return {
    ok: true,
    record: ownRecord,
    hasOwnRecord: Boolean(ownRecord),
    canView,
    signedUrls,
    candidate,
    myUserId: user.id,
  };
}

export async function saveChecklistCreditoDraft(
  processoId: string,
  payload: ChecklistCreditoForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };

  const processoRes = await getProcessoMeta(supabase, processoId);
  if (!processoRes.ok) return processoRes;
  const processo = processoRes.processo;

  const completo = ENFORCE_CHECKLIST_CREDITO_REQUIRED ? computeCompleto(payload) : false;
  const data = {
    processo_id: processoId,
    franqueado_id: processo.franqueado_id ?? null,
    nome_franqueado: processo.nome_franqueado ?? null,
    ...EMPTY_FORM,
    ...payload,
    preenchido_por: user.id,
    completo,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('checklist_credito').upsert(data, { onConflict: 'processo_id' });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/painel-novos-negocios');
  return { ok: true };
}

export async function concluirChecklistCredito(
  processoId: string,
  payload: ChecklistCreditoForm,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (ENFORCE_CHECKLIST_CREDITO_REQUIRED && !computeCompleto(payload)) {
    return { ok: false, error: 'Checklist Crédito incompleto.' };
  }
  const r = await saveChecklistCreditoDraft(processoId, payload);
  if (!r.ok) return r;

  const supabase = await createClient();
  await supabase
    .from('checklist_credito')
    .update({ completo: true, updated_at: new Date().toISOString() })
    .eq('processo_id', processoId);

  revalidatePath('/painel-novos-negocios');
  return { ok: true };
}

export async function removeChecklistCreditoFile(
  processoId: string,
  field: keyof ChecklistCreditoForm,
  pathToRemove: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: row, error } = await supabase.from('checklist_credito').select('*').eq('processo_id', processoId).maybeSingle();
  if (error || !row) return { ok: false, error: error?.message ?? 'Checklist não encontrado.' };
  const cur = normalizeRow(row);
  const next: ChecklistCreditoForm = { ...cur };
  const val = (next as any)[field];
  if (Array.isArray(val)) (next as any)[field] = val.filter((x: string) => x !== pathToRemove);
  else if (typeof val === 'string' && val === pathToRemove) (next as any)[field] = null;
  return saveChecklistCreditoDraft(processoId, next);
}

