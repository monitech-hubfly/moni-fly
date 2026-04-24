import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { extractText, filterRelevantChecklistDiff } from '@/lib/document-diff';

const BUCKET = 'documentos-templates';

type Body = { token?: string; item_id?: string; card_id?: string };

async function downloadBuffer(
  admin: ReturnType<typeof createAdminClient>,
  path: string,
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Falha ao ler ficheiro no armazenamento.' };
  }
  const buf = Buffer.from(await data.arrayBuffer());
  return { ok: true, buf };
}

function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'doc') return 'application/msword';
  return 'application/octet-stream';
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'JSON inválido.', diferencas: [], temDiferencasRelevantes: false },
      { status: 400 },
    );
  }

  const item_id = String(body.item_id ?? '').trim();
  const card_id = String(body.card_id ?? '').trim();
  const token = String(body.token ?? '').trim();

  if (!item_id || !card_id) {
    return NextResponse.json(
      { ok: false, error: 'item_id e card_id são obrigatórios.', diferencas: [], temDiferencasRelevantes: false },
      { status: 400 },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Serviço indisponível.', diferencas: [], temDiferencasRelevantes: false },
      { status: 503 },
    );
  }

  if (!token) {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json(
        { ok: false, error: 'Não autenticado.', diferencas: [], temDiferencasRelevantes: false },
        { status: 401 },
      );
    }
    const { data: cardRow, error: cardErr } = await supabase.from('kanban_cards').select('id').eq('id', card_id).maybeSingle();
    if (cardErr || !cardRow) {
      return NextResponse.json(
        { ok: false, error: 'Card não encontrado ou sem permissão.', diferencas: [], temDiferencasRelevantes: false },
        { status: 403 },
      );
    }
  } else {
    const { data: tok, error: tokErr } = await admin
      .from('kanban_card_form_tokens')
      .select('card_id, fase_id, expires_at')
      .eq('token', token)
      .maybeSingle();
    if (tokErr) {
      return NextResponse.json(
        { ok: false, error: tokErr.message, diferencas: [], temDiferencasRelevantes: false },
        { status: 500 },
      );
    }
    if (!tok) {
      return NextResponse.json(
        { ok: false, error: 'Token inválido.', diferencas: [], temDiferencasRelevantes: false },
        { status: 404 },
      );
    }
    const tokRow = tok as { card_id: string; fase_id: string; expires_at: string };
    if (tokRow.card_id !== card_id) {
      return NextResponse.json(
        { ok: false, error: 'card_id não corresponde ao token.', diferencas: [], temDiferencasRelevantes: false },
        { status: 403 },
      );
    }
    if (new Date(tokRow.expires_at) < new Date()) {
      return NextResponse.json(
        { ok: false, error: 'Link expirado.', diferencas: [], temDiferencasRelevantes: false },
        { status: 410 },
      );
    }

    const { data: itemTok, error: itemTokErr } = await admin
      .from('kanban_fase_checklist_itens')
      .select('fase_id')
      .eq('id', item_id)
      .maybeSingle();
    if (itemTokErr || !itemTok) {
      return NextResponse.json(
        { ok: false, error: 'Item não encontrado.', diferencas: [], temDiferencasRelevantes: false },
        { status: 404 },
      );
    }
    if ((itemTok as { fase_id: string }).fase_id !== tokRow.fase_id) {
      return NextResponse.json(
        { ok: false, error: 'Item não pertence a este formulário.', diferencas: [], temDiferencasRelevantes: false },
        { status: 403 },
      );
    }
  }

  const { data: item, error: itemErr } = await admin
    .from('kanban_fase_checklist_itens')
    .select('id, tipo, template_storage_path')
    .eq('id', item_id)
    .maybeSingle();
  if (itemErr) {
    return NextResponse.json(
      { ok: false, error: itemErr.message, diferencas: [], temDiferencasRelevantes: false },
      { status: 500 },
    );
  }
  if (!item) {
    return NextResponse.json(
      { ok: false, error: 'Item não encontrado.', diferencas: [], temDiferencasRelevantes: false },
      { status: 404 },
    );
  }
  const it = item as { id: string; tipo: string; template_storage_path: string | null };
  if (it.tipo !== 'anexo_template') {
    return NextResponse.json(
      { ok: false, error: 'Este item não é anexo com modelo.', diferencas: [], temDiferencasRelevantes: false },
      { status: 400 },
    );
  }
  const templatePath = String(it.template_storage_path ?? '').trim();
  if (!templatePath) {
    return NextResponse.json(
      { ok: false, error: 'Modelo não configurado para este item.', diferencas: [], temDiferencasRelevantes: false },
      { status: 404 },
    );
  }

  const { data: resp, error: respErr } = await admin
    .from('kanban_fase_checklist_respostas')
    .select('arquivo_path')
    .eq('card_id', card_id)
    .eq('item_id', item_id)
    .maybeSingle();
  if (respErr) {
    return NextResponse.json(
      { ok: false, error: respErr.message, diferencas: [], temDiferencasRelevantes: false },
      { status: 500 },
    );
  }
  const assinadoPath = String((resp as { arquivo_path?: string | null } | null)?.arquivo_path ?? '').trim();
  if (!assinadoPath) {
    return NextResponse.json(
      { ok: false, error: 'Ainda não há documento assinado gravado para este item.', diferencas: [], temDiferencasRelevantes: false },
      { status: 400 },
    );
  }

  const tplDl = await downloadBuffer(admin, templatePath);
  if (!tplDl.ok) {
    return NextResponse.json(
      { ok: false, error: tplDl.error, diferencas: [], temDiferencasRelevantes: false },
      { status: 500 },
    );
  }
  const assDl = await downloadBuffer(admin, assinadoPath);
  if (!assDl.ok) {
    return NextResponse.json(
      { ok: false, error: assDl.error, diferencas: [], temDiferencasRelevantes: false },
      { status: 500 },
    );
  }

  const mimeTpl = mimeFromPath(templatePath);
  const mimeAss = mimeFromPath(assinadoPath);
  const nomeTpl = templatePath.split('/').pop() ?? 'modelo';
  const nomeAss = assinadoPath.split('/').pop() ?? 'assinado';

  const textTpl = await extractText(tplDl.buf, mimeTpl, nomeTpl);
  const textAss = await extractText(assDl.buf, mimeAss, nomeAss);

  if (!textTpl.trim() && !textAss.trim()) {
    return NextResponse.json({
      ok: true,
      diferencas: [],
      temDiferencasRelevantes: false,
      aviso: 'Não foi possível extrair texto comparável dos ficheiros (tente DOCX ou PDF com texto selecionável).',
    });
  }

  const { diferencas, temDiferencasRelevantes } = filterRelevantChecklistDiff(textTpl, textAss);
  return NextResponse.json({ ok: true, diferencas, temDiferencasRelevantes });
}
