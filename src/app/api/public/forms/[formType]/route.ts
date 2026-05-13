import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type FormType = 'legal' | 'credito';

function getFormType(v: string): FormType | null {
  return v === 'legal' || v === 'credito' ? v : null;
}

async function resolveLink(token: string, formType: FormType) {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data: link, error } = await admin
    .from('processo_public_form_links')
    .select('processo_id, form_type, expires_at, revoked_at')
    .eq('token', token)
    .eq('form_type', formType)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle();
  if (error || !link) return { ok: false as const, error: error?.message ?? 'Link inválido ou expirado.' };
  return { ok: true as const, processoId: String((link as any).processo_id) };
}

export async function GET(req: Request, { params }: { params: { formType: string } }) {
  const formType = getFormType(params.formType);
  if (!formType) return NextResponse.json({ ok: false, error: 'Tipo de formulário inválido.' }, { status: 400 });
  const url = new URL(req.url);
  const token = String(url.searchParams.get('token') ?? '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'Token ausente.' }, { status: 400 });

  const resolved = await resolveLink(token, formType);
  if (!resolved.ok) return NextResponse.json({ ok: false, error: resolved.error }, { status: 401 });

  const admin = createAdminClient();
  if (formType === 'legal') {
    const { data: row } = await admin
      .from('processo_card_checklist_legal')
      .select('respostas_json, arquivos_json, completo, updated_at')
      .eq('processo_id', resolved.processoId)
      .maybeSingle();
    return NextResponse.json({
      ok: true,
      formType,
      processoId: resolved.processoId,
      payload: row
        ? {
            respostas_json: (row as any).respostas_json ?? {},
            arquivos_json: (row as any).arquivos_json ?? {},
            completo: Boolean((row as any).completo),
            updated_at: (row as any).updated_at ?? null,
          }
        : null,
    });
  }

  const { data: row } = await admin
    .from('checklist_credito')
    .select('*')
    .eq('processo_id', resolved.processoId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({ ok: true, formType, processoId: resolved.processoId, payload: row ?? null });
}

export async function POST(req: Request, { params }: { params: { formType: string } }) {
  const formType = getFormType(params.formType);
  if (!formType) return NextResponse.json({ ok: false, error: 'Tipo de formulário inválido.' }, { status: 400 });
  const body = (await req.json().catch(() => null)) as any;
  const token = String(body?.token ?? '').trim();
  if (!token) return NextResponse.json({ ok: false, error: 'Token ausente.' }, { status: 400 });

  const resolved = await resolveLink(token, formType);
  if (!resolved.ok) return NextResponse.json({ ok: false, error: resolved.error }, { status: 401 });

  const admin = createAdminClient();
  if (formType === 'legal') {
    const respostas = (body?.respostas_json ?? {}) as Record<string, unknown>;
    const arquivos = (body?.arquivos_json ?? {}) as Record<string, unknown>;
    const { data: proc } = await admin
      .from('processo_step_one')
      .select('nome_condominio')
      .eq('id', resolved.processoId)
      .maybeSingle();
    const nomeCondominio = String((proc as any)?.nome_condominio ?? '').trim();
    const { error } = await admin.from('processo_card_checklist_legal').upsert(
      {
        processo_id: resolved.processoId,
        nome_condominio: nomeCondominio || 'Sem condomínio',
        respostas_json: respostas,
        arquivos_json: arquivos,
        completo: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'processo_id' },
    );
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const form = (body?.form ?? {}) as Record<string, unknown>;
  const { data: proc } = await admin
    .from('processo_step_one')
    .select('franqueado_id, nome_franqueado')
    .eq('id', resolved.processoId)
    .maybeSingle();
  const payload = {
    processo_id: resolved.processoId,
    franqueado_id: (proc as any)?.franqueado_id ?? null,
    nome_franqueado: (proc as any)?.nome_franqueado ?? null,
    preenchido_por: null,
    categoria_profissional: (form.categoria_profissional as string | undefined) ?? '',
    descricao_atividade: (form.descricao_atividade as string | null | undefined) ?? null,
    endividamento_info: (form.endividamento_info as string | null | undefined) ?? null,
    completo: false,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from('checklist_credito').upsert(payload, { onConflict: 'processo_id' });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

