import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FORMULARIOS_BUCKET } from '@/lib/constants/formularios-ids';
import { nomeArquivoSeguro } from '@/lib/formularios/apresentacao';

const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = (formData.get('file') ?? formData.get('arquivo')) as File | null;
    const respostaId = String(formData.get('resposta_id') ?? formData.get('respostaId') ?? '').trim();
    const campoId = String(formData.get('campo_id') ?? formData.get('campoId') ?? '').trim();

    if (!file || !respostaId || !campoId) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios: file, resposta_id, campo_id.' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Arquivo acima de 50 MB.' }, { status: 413 });
    }

    const admin = createAdminClient();
    const seguro = nomeArquivoSeguro(file.name);
    const path = `${respostaId}/${campoId}/${Date.now()}_${seguro}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { data: uploadData, error: upErr } = await admin.storage.from(FORMULARIOS_BUCKET).upload(path, buf, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

    if (upErr || !uploadData) {
      console.error('Erro no upload:', upErr);
      return NextResponse.json({ error: 'Erro ao fazer upload.' }, { status: 500 });
    }

    await admin.from('formulario_resposta_arquivos').insert({
      resposta_id: respostaId,
      campo_id: campoId,
      storage_path: uploadData.path,
      nome_arquivo: file.name.slice(0, 180) || seguro,
      mime_type: file.type || null,
      tamanho_bytes: file.size,
    });

    const { data: signed } = await admin.storage.from(FORMULARIOS_BUCKET).createSignedUrl(uploadData.path, 3600);

    return NextResponse.json({
      ok: true,
      url: signed?.signedUrl ?? '',
      nome: file.name,
      tamanho: file.size,
      tipo: file.type,
    });
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
