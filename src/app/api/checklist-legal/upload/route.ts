import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BUCKET = 'processo-docs';

// Somente chaves que representam upload de arquivos.
// (Texto/checkboxes serão salvos em JSON no DB.)
const ALLOWED_FIELDS = new Set([
  'manual_condominio_pdf',
  'codigo_obras_pdf',
  'outros_documentos_pdf',
  'aprovacao_matricula_pdf',
  'aprovacao_planialtimetrico_pdf',
  'aprovacao_spt_pdf',
  'terreno_abrigos_medidores_pdf',
]);

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: 'Faça login.' }, { status: 401 });

  const formData = await req.formData();
  const processoId = formData.get('processoId');
  const fieldKey = formData.get('fieldKey');
  const files = formData.getAll('files');

  if (typeof processoId !== 'string' || typeof fieldKey !== 'string') {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 });
  }

  if (!ALLOWED_FIELDS.has(fieldKey)) {
    return NextResponse.json({ ok: false, error: 'Campo não permitido.' }, { status: 400 });
  }

  const MAX_BYTES = 10 * 1024 * 1024;
  const validFiles = files.filter((f): f is File => {
    if (!(f instanceof File)) return false;
    if (f.size <= 0) return false;
    if (f.size > MAX_BYTES) return false;
    const name = String(f.name ?? '').toLowerCase();
    const isPdf = f.type.includes('pdf') || name.endsWith('.pdf');
    return isPdf;
  });
  if (validFiles.length === 0) {
    return NextResponse.json({ ok: false, error: 'Envie pelo menos 1 arquivo.' }, { status: 400 });
  }

  const uploaded = [];
  for (const f of validFiles) {
    const safeName = String(f.name ?? 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `processos/${processoId}/checklist-legal/${fieldKey}/${Date.now()}_${safeName}`;
    const res = await supabase.storage.from(BUCKET).upload(path, f, {
      contentType: f.type || 'application/octet-stream',
      upsert: false,
    });
    if (res.error) {
      return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
    }
    uploaded.push({ storage_path: path, nome_original: f.name });
  }

  return NextResponse.json({ ok: true, files: uploaded });
}

