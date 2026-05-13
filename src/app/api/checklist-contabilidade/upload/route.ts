import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'checklist-contabilidade';
const ALLOWED_EXT = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_BYTES = 10 * 1024 * 1024;

function isAllowedFile(file: File): boolean {
  const name = String(file.name ?? '').toLowerCase();
  const extOk = ALLOWED_EXT.some((ext) => name.endsWith(ext));
  const type = (file.type || '').toLowerCase();
  const mimeOk = type.includes('pdf') || type.includes('jpeg') || type.includes('jpg') || type.includes('png');
  return extOk || mimeOk;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Faça login.' }, { status: 401 });

  const form = await req.formData();
  const processoId = form.get('processoId');
  const entidade = form.get('entidade');
  const fieldKey = form.get('fieldKey');
  const file = form.get('file');

  if (
    typeof processoId !== 'string' ||
    typeof entidade !== 'string' ||
    typeof fieldKey !== 'string' ||
    !(file instanceof File)
  ) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_BYTES || !isAllowedFile(file)) {
    return NextResponse.json({ ok: false, error: 'Arquivo inválido. Use PDF/JPG/PNG até 10MB.' }, { status: 400 });
  }

  const safeName = String(file.name ?? 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${entidade}/${processoId}/${fieldKey}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream',
    cacheControl: '3600',
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ ok: true, url: data.publicUrl, path, nome_original: file.name });
}
