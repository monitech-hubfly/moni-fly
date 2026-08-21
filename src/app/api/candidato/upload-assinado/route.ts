import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * POST multipart: token, item_id, file
 * Valida token, confere item à fase, envia para documentos-templates e grava arquivo_path na resposta.
 */
export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false, error: 'Serviço indisponível.' }, { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Corpo inválido.' }, { status: 400 });
  }

  const token = String(form.get('token') ?? '').trim();
  const item_id = String(form.get('item_id') ?? '').trim();
  const file = form.get('file');
  if (!token || !item_id || !(file instanceof Blob)) {
    return NextResponse.json({ ok: false, error: 'token, item_id e file são obrigatórios.' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'Arquivo muito grande (máx. 25 MB).' }, { status: 400 });
  }

  const { data: tok, error: tokErr } = await admin
    .from('kanban_card_form_tokens')
    .select('card_id, fase_id, expires_at')
    .eq('token', token)
    .maybeSingle();
  if (tokErr) return NextResponse.json({ ok: false, error: tokErr.message }, { status: 500 });
  if (!tok) return NextResponse.json({ ok: false, error: 'Token inválido.' }, { status: 404 });

  const tokRow = tok as { card_id: string; fase_id: string; expires_at: string };
  if (new Date(tokRow.expires_at) < new Date()) {
    return NextResponse.json({ ok: false, error: 'Link expirado.' }, { status: 410 });
  }

  const { data: item, error: itemErr } = await admin
    .from('kanban_fase_checklist_itens')
    .select('id, fase_id, tipo')
    .eq('id', item_id)
    .maybeSingle();
  if (itemErr) return NextResponse.json({ ok: false, error: itemErr.message }, { status: 500 });
  if (!item) return NextResponse.json({ ok: false, error: 'Item não encontrado.' }, { status: 404 });

  const it = item as { id: string; fase_id: string; tipo: string };
  if (it.fase_id !== tokRow.fase_id) {
    return NextResponse.json({ ok: false, error: 'Item não pertence a este formulário.' }, { status: 403 });
  }
  if (it.tipo !== 'anexo_template' && it.tipo !== 'anexo') {
    return NextResponse.json({ ok: false, error: 'Este item não aceita anexo aqui.' }, { status: 400 });
  }

  const fileName = file instanceof File && file.name?.trim() ? file.name.trim() : 'documento';
  const ext = fileName.includes('.') ? fileName.split('.').pop() ?? 'bin' : 'bin';
  const safeExt = /^[a-z0-9]+$/i.test(ext) ? ext.toLowerCase() : 'bin';
  const storagePath = `candidato/${tokRow.card_id}/${item_id}/${Date.now()}.${safeExt}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const contentType = file instanceof File && file.type ? file.type : 'application/octet-stream';

  const { error: upErr } = await admin.storage.from('documentos-templates').upload(storagePath, buf, {
    contentType,
    upsert: true,
  });
  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  const { data: existente } = await admin
    .from('kanban_fase_checklist_respostas')
    .select('valor')
    .eq('card_id', tokRow.card_id)
    .eq('item_id', item_id)
    .maybeSingle();
  const valorExistente = (existente as { valor?: string | null } | null)?.valor ?? '';

  const { error: upRespErr } = await admin.from('kanban_fase_checklist_respostas').upsert(
    {
      item_id,
      card_id: tokRow.card_id,
      valor: valorExistente,
      arquivo_path: storagePath,
      preenchido_por: null,
      preenchido_em: new Date().toISOString(),
    },
    { onConflict: 'item_id,card_id' },
  );
  if (upRespErr) {
    return NextResponse.json({ ok: false, error: upRespErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path: storagePath });
}
