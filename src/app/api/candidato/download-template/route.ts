import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/candidato/download-template?token=...&item_id=...  (candidato)
 * GET /api/candidato/download-template?item_id=...          (sessão autenticada, sem token)
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim() ?? '';
  const item_id = req.nextUrl.searchParams.get('item_id')?.trim();
  if (!item_id) {
    return NextResponse.json({ error: 'Parâmetro item_id é obrigatório.' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  if (token) {
    const { data: tok, error: tokErr } = await admin
      .from('kanban_card_form_tokens')
      .select('fase_id, expires_at')
      .eq('token', token)
      .maybeSingle();
    if (tokErr) return NextResponse.json({ error: tokErr.message }, { status: 500 });
    if (!tok) return NextResponse.json({ error: 'Token inválido.' }, { status: 404 });

    const tokRow = tok as { fase_id: string; expires_at: string };
    if (new Date(tokRow.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Link expirado.' }, { status: 410 });
    }

    const { data: item, error: itemErr } = await admin
      .from('kanban_fase_checklist_itens')
      .select('id, fase_id, tipo, template_storage_path')
      .eq('id', item_id)
      .maybeSingle();
    if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });
    if (!item) return NextResponse.json({ error: 'Item não encontrado.' }, { status: 404 });

    const row = item as { id: string; fase_id: string; tipo: string; template_storage_path: string | null };
    if (row.fase_id !== tokRow.fase_id) {
      return NextResponse.json({ error: 'Item não pertence a este formulário.' }, { status: 403 });
    }
    if (row.tipo !== 'anexo_template') {
      return NextResponse.json({ error: 'Este item não possui modelo para download.' }, { status: 400 });
    }
    const path = String(row.template_storage_path ?? '').trim();
    if (!path) {
      return NextResponse.json({ error: 'Modelo não configurado para este item.' }, { status: 404 });
    }

    const { data: signed, error: signErr } = await admin.storage
      .from('documentos-templates')
      .createSignedUrl(path, 3600);
    if (signErr || !signed?.signedUrl) {
      return NextResponse.json(
        { error: signErr?.message ?? 'Não foi possível gerar o link do arquivo.' },
        { status: 500 },
      );
    }
    return NextResponse.json({ url: signed.signedUrl });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Não autenticado. Use o link do formulário ou faça login.' }, { status: 401 });
  }

  const { data: item, error: itemErr } = await supabase
    .from('kanban_fase_checklist_itens')
    .select('id, tipo, template_storage_path')
    .eq('id', item_id)
    .maybeSingle();
  if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 500 });
  if (!item) {
    return NextResponse.json({ error: 'Item não encontrado ou sem permissão.' }, { status: 404 });
  }

  const row = item as { id: string; tipo: string; template_storage_path: string | null };
  if (row.tipo !== 'anexo_template') {
    return NextResponse.json({ error: 'Este item não possui modelo para download.' }, { status: 400 });
  }
  const path = String(row.template_storage_path ?? '').trim();
  if (!path) {
    return NextResponse.json({ error: 'Modelo não configurado para este item.' }, { status: 404 });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from('documentos-templates')
    .createSignedUrl(path, 3600);
  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signErr?.message ?? 'Não foi possível gerar o link do arquivo.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: signed.signedUrl });
}
