'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { formatIsoDateOnlyPtBr } from '@/lib/dias-uteis';
import { KANBAN_IDS } from '@/lib/constants/kanban-ids';
import { isKanbanFunilLoteadoresRef } from '@/lib/kanban/loteadores-card-titulo';

const BUCKET = 'processo-docs';
const MAX_BYTES = 10 * 1024 * 1024;
const PLANILHA_SELECT = 'planilha_lotes_path, planilha_lotes_nome, planilha_lotes_enviado_em';

export type PlanilhaLotesAnexo = {
  path: string;
  nome: string;
  enviadoEm: string;
  enviadoEmLabel: string;
};

type Err = { ok: false; error: string };
type AuthOk = {
  ok: true;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

function colunaPlanilhaAusente(message: string): boolean {
  return /planilha_lotes_|schema cache|does not exist|could not find the/i.test(message);
}

function formatEnviadoEm(iso: string | null | undefined): string {
  const raw = String(iso ?? '').trim();
  if (!raw) return '';
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
  return formatIsoDateOnlyPtBr(raw.slice(0, 10)) ?? raw;
}

function mapAnexo(raw: Record<string, unknown> | null): PlanilhaLotesAnexo | null {
  if (!raw) return null;
  const path = String(raw.planilha_lotes_path ?? '').trim();
  const nome = String(raw.planilha_lotes_nome ?? '').trim();
  if (!path || !nome) return null;
  const enviadoEm = String(raw.planilha_lotes_enviado_em ?? '').trim();
  return {
    path,
    nome,
    enviadoEm,
    enviadoEmLabel: formatEnviadoEm(enviadoEm),
  };
}

async function requireUser(): Promise<AuthOk | Err> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  return { ok: true, supabase };
}

async function assertCardLoteadores(
  supabase: AuthOk['supabase'],
  cardId: string,
): Promise<{ ok: true; cardId: string } | Err> {
  const cid = String(cardId ?? '').trim();
  if (!cid) return { ok: false, error: 'Card inválido.' };
  const { data, error } = await supabase
    .from('kanban_cards')
    .select('id, kanban_id')
    .eq('id', cid)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'Card não encontrado.' };
  const kanbanId = (data as { kanban_id?: string | null }).kanban_id;
  if (!isKanbanFunilLoteadoresRef(kanbanId) && kanbanId !== KANBAN_IDS.LOTEADORES) {
    return { ok: false, error: 'Este card não pertence ao Funil Loteadores.' };
  }
  return { ok: true, cardId: cid };
}

function extensaoPlanilhaOk(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.endsWith('.csv') || lower.endsWith('.xlsx');
}

function contentTypePlanilha(filename: string, fallback: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  return fallback || 'application/octet-stream';
}

export async function listarPlanilhaLotesDoCard(
  cardId: string,
): Promise<{ ok: true; anexo: PlanilhaLotesAnexo | null } | Err> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const card = await assertCardLoteadores(auth.supabase, cardId);
  if (!card.ok) return card;

  const { data, error } = await auth.supabase
    .from('imob_card_modelo')
    .select(PLANILHA_SELECT)
    .eq('card_id', card.cardId)
    .maybeSingle();
  if (error) {
    if (colunaPlanilhaAusente(error.message) || error.code === 'PGRST116') {
      return { ok: true, anexo: null };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, anexo: mapAnexo((data as Record<string, unknown> | null) ?? null) };
}

export async function uploadPlanilhaLotesDoCard(
  formData: FormData,
): Promise<{ ok: true; anexo: PlanilhaLotesAnexo } | Err> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  const card = await assertCardLoteadores(auth.supabase, String(formData.get('cardId') ?? ''));
  if (!card.ok) return card;

  const file = formData.get('file');
  if (!file || !(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Selecione um arquivo .csv ou .xlsx.' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'Arquivo maior que 10 MB.' };
  }
  if (!extensaoPlanilhaOk(file.name)) {
    return { ok: false, error: 'Envie um arquivo .csv ou .xlsx.' };
  }

  const { data: atual } = await auth.supabase
    .from('imob_card_modelo')
    .select(PLANILHA_SELECT)
    .eq('card_id', card.cardId)
    .maybeSingle();
  const pathAnterior = String((atual as { planilha_lotes_path?: string } | null)?.planilha_lotes_path ?? '').trim();

  const originalName = file.name.slice(0, 180);
  const safeName = originalName.replace(/[^\w.\-()+ ]/g, '_');
  const path = `${card.cardId}/imob/planilha-lotes/${Date.now()}_${safeName}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await auth.supabase.storage.from(BUCKET).upload(path, buf, {
    contentType: contentTypePlanilha(file.name, file.type),
    upsert: true,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const enviadoEm = new Date().toISOString();
  const patch = {
    card_id: card.cardId,
    planilha_lotes_path: path,
    planilha_lotes_nome: originalName,
    planilha_lotes_enviado_em: enviadoEm,
    updated_at: enviadoEm,
  };
  const { error: upDb } = await auth.supabase
    .from('imob_card_modelo')
    .upsert(patch as never, { onConflict: 'card_id' });
  if (upDb) {
    await auth.supabase.storage.from(BUCKET).remove([path]);
    if (colunaPlanilhaAusente(upDb.message)) {
      return {
        ok: false,
        error: 'Colunas da planilha de lotes ainda não existem neste banco. Aplique a migration 552 no DEV.',
      };
    }
    return { ok: false, error: upDb.message };
  }

  if (pathAnterior && pathAnterior !== path) {
    await auth.supabase.storage.from(BUCKET).remove([pathAnterior]);
  }

  const { data: tpl } = await auth.supabase
    .from('loteamento_simulador_templates')
    .select('link_token')
    .eq('kanban_card_id', card.cardId)
    .maybeSingle();
  const token = String((tpl as { link_token?: string } | null)?.link_token ?? '').trim();

  revalidatePath('/loteadores');
  revalidatePath('/simulador', 'layout');
  if (token) revalidatePath(`/simulador/${token}`);
  return {
    ok: true,
    anexo: {
      path,
      nome: originalName,
      enviadoEm,
      enviadoEmLabel: formatEnviadoEm(enviadoEm),
    },
  };
}

export async function urlDownloadPlanilhaLotesDoCard(
  cardId: string,
): Promise<{ ok: true; url: string; nome: string } | Err> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  const listed = await listarPlanilhaLotesDoCard(cardId);
  if (!listed.ok) return listed;
  if (!listed.anexo) return { ok: false, error: 'Nenhuma planilha anexada.' };

  const { data, error } = await auth.supabase.storage
    .from(BUCKET)
    .createSignedUrl(listed.anexo.path, 3600, { download: listed.anexo.nome });
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? 'Erro ao gerar o download.' };
  }
  return { ok: true, url: data.signedUrl, nome: listed.anexo.nome };
}
