import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { registerStep7Upload } from '@/app/step-7/actions';
import { extractText, computeDiff } from '@/lib/document-diff';

const BUCKET = 'processo-docs';
const AREA_STEP7 = 'step7_contrato_terreno';

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Faça login.' }, { status: 401 });
  }

  const formData = await req.formData();
  const processoId = formData.get('processoId');
  const file = formData.get('file');

  if (typeof processoId !== 'string' || !file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 });
  }

  const path = `processos/${processoId}/step7/${Date.now()}_${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let diffJson: Record<string, unknown> | null = null;
  try {
    const { data: tpl } = await supabase
      .from('document_templates')
      .select('arquivo_path')
      .eq('area', AREA_STEP7)
      .eq('step', 7)
      .eq('ativo', true)
      .order('versao', { ascending: false })
      .limit(1)
      .maybeSingle();

    const templatePath = tpl?.arquivo_path
      ? tpl.arquivo_path.includes('/') ? tpl.arquivo_path : `step7/${tpl.arquivo_path}`
      : null;

    if (templatePath) {
      const { data: templateFile } = await supabase.storage.from(BUCKET).download(templatePath);
      if (templateFile) {
        const templateBuffer = Buffer.from(await templateFile.arrayBuffer());
        const templateText = await extractText(
          templateBuffer,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'template.docx',
        );
        const documentText = await extractText(buffer, file.type || '', file.name);
        const diffResult = computeDiff(templateText, documentText);
        diffJson = diffResult as unknown as Record<string, unknown>;
      }
    }
  } catch {
    // Continua sem diff em caso de falha na extração/cálculo.
  }

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
  }

  const result = await registerStep7Upload(processoId, path, diffJson);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? 'Erro ao registrar upload.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

