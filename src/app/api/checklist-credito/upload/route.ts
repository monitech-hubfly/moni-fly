import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'checklist-credito';
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
  const fieldKey = form.get('fieldKey');
  const files = form.getAll('files');

  if (typeof processoId !== 'string' || typeof fieldKey !== 'string') {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 });
  }

  const valid = files.filter((f): f is File => {
    if (!(f instanceof File)) return false;
    if (f.size <= 0 || f.size > MAX_BYTES) return false;
    return isAllowedFile(f);
  });

  if (valid.length === 0) {
    return NextResponse.json({ ok: false, error: 'Arquivo inválido. Use PDF/JPG/PNG até 10MB.' }, { status: 400 });
  }

  const uploaded: string[] = [];
  for (const file of valid) {
    const safeName = String(file.name ?? 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `checklist-credito/${processoId}/${fieldKey}/${Date.now()}_${safeName}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    uploaded.push(path);
  }

  return NextResponse.json({ ok: true, paths: uploaded });
}

