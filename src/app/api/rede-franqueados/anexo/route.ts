import { NextResponse } from 'next/server';
import { uploadRedeAnexoFromFormData } from '@/lib/rede/rede-anexo-upload-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Upload JSON de anexos da rede (Documentos da Franquia / Empresas / Franqueado). */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const result = await uploadRedeAnexoFromFormData(formData);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api/rede-franqueados/anexo POST]', msg);
    return NextResponse.json({ ok: false, error: msg || 'Erro inesperado ao enviar anexo.' }, { status: 500 });
  }
}
