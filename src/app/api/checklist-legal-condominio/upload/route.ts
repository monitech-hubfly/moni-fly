import { NextResponse } from 'next/server';
import { CHECKLIST_LEGAL_ARQUIVO_KEYS } from '@/lib/checklist-legal/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'processo-docs';
const ALLOWED = new Set<string>(CHECKLIST_LEGAL_ARQUIVO_KEYS);

async function resolvePublicToken(token: string) {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { data: link } = await admin
    .from('checklist_legal_public_tokens')
    .select('card_id, condominio_id')
    .eq('token', token)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .maybeSingle();
  if (!link) return null;
  return {
    admin,
    cardId: String((link as { card_id: string }).card_id),
    condominioId: String((link as { condominio_id?: string | null }).condominio_id ?? '').trim() || null,
  };
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const fieldKey = String(formData.get('fieldKey') ?? '').trim();
  const token = String(formData.get('token') ?? '').trim();
  const cardId = String(formData.get('cardId') ?? '').trim();
  const files = formData.getAll('files');

  if (!ALLOWED.has(fieldKey)) {
    return NextResponse.json({ ok: false, error: 'Campo não permitido.' }, { status: 400 });
  }

  let ownerCardId = cardId;
  let storagePrefix = cardId;

  if (token) {
    const resolved = await resolvePublicToken(token);
    if (!resolved) return NextResponse.json({ ok: false, error: 'Link inválido ou expirado.' }, { status: 401 });
    ownerCardId = resolved.cardId;
    storagePrefix = resolved.condominioId ?? resolved.cardId;
  } else {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: 'Faça login.' }, { status: 401 });
    if (!ownerCardId) return NextResponse.json({ ok: false, error: 'cardId ausente.' }, { status: 400 });
  }

  const MAX_BYTES = 10 * 1024 * 1024;
  const validFiles = files.filter((f): f is File => {
    if (!(f instanceof File)) return false;
    if (f.size <= 0 || f.size > MAX_BYTES) return false;
    const name = String(f.name ?? '').toLowerCase();
    return f.type.includes('pdf') || name.endsWith('.pdf');
  });
  if (validFiles.length === 0) {
    return NextResponse.json({ ok: false, error: 'Envie pelo menos 1 PDF (máx. 10 MB).' }, { status: 400 });
  }

  const supabaseUpload = token ? createAdminClient() : await createClient();
  const uploaded = [];
  for (const f of validFiles) {
    const safeName = String(f.name ?? 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `checklist-legal/${storagePrefix}/${ownerCardId}/${fieldKey}/${Date.now()}_${safeName}`;
    const res = await supabaseUpload.storage.from(BUCKET).upload(path, f, {
      contentType: f.type || 'application/pdf',
      upsert: false,
    });
    if (res.error) return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
    uploaded.push({ storage_path: path, nome_original: f.name });
  }

  return NextResponse.json({ ok: true, files: uploaded });
}
