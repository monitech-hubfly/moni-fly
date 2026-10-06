import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { FORMULARIOS_ARQUIVO_MAX_BYTES, FORMULARIOS_BUCKET } from '@/lib/constants/formularios-ids';
import { nomeArquivoSeguro } from '@/lib/formularios/apresentacao';
import { lerTokenPublico } from '@/lib/formularios/token-publico';

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
  const respostaId = String(form.get('respostaId') ?? '').trim();
  const campoId = String(form.get('campoId') ?? '').trim();
  const arquivo = form.get('arquivo');
  if (!token || !respostaId || !campoId || !(arquivo instanceof File) || arquivo.size === 0) {
    return NextResponse.json({ ok: false, error: 'Token, resposta, campo e arquivo são obrigatórios.' }, { status: 400 });
  }
  if (arquivo.size > FORMULARIOS_ARQUIVO_MAX_BYTES) {
    return NextResponse.json({ ok: false, error: 'Arquivo acima de 50 MB.' }, { status: 413 });
  }

  const lido = await lerTokenPublico(token);
  if (!lido.ok) return NextResponse.json({ ok: false, error: lido.error }, { status: lido.status });

  const { data: resposta, error: respErr } = await admin
    .from('formulario_respostas')
    .select('id, token_id, formulario_id, status')
    .eq('id', respostaId)
    .maybeSingle();
  if (respErr) return NextResponse.json({ ok: false, error: respErr.message }, { status: 500 });
  if (!resposta || String((resposta as { token_id?: string }).token_id) !== lido.token.id) {
    return NextResponse.json({ ok: false, error: 'Resposta não encontrada.' }, { status: 404 });
  }
  if ((resposta as { status?: string }).status === 'enviado') {
    return NextResponse.json({ ok: false, error: 'Esta resposta já foi enviada.' }, { status: 409 });
  }

  const { data: campo, error: campoErr } = await admin
    .from('formulario_campos')
    .select('id, tipo, secao_id, formulario_secoes(formulario_id)')
    .eq('id', campoId)
    .maybeSingle();
  if (campoErr) return NextResponse.json({ ok: false, error: campoErr.message }, { status: 500 });
  const tipo = String((campo as { tipo?: string } | null)?.tipo ?? '');
  if (tipo !== 'arquivo_multiplo' && tipo !== 'link_ou_arquivo') {
    return NextResponse.json({ ok: false, error: 'Este campo não aceita arquivo.' }, { status: 400 });
  }
  const secao = (campo as { formulario_secoes?: { formulario_id?: string } | { formulario_id?: string }[] } | null)
    ?.formulario_secoes;
  const formId = Array.isArray(secao) ? secao[0]?.formulario_id : secao?.formulario_id;
  if (formId !== lido.token.formulario_id) {
    return NextResponse.json({ ok: false, error: 'Campo não pertence a este formulário.' }, { status: 403 });
  }

  const seguro = nomeArquivoSeguro(arquivo.name);
  const storagePath = `${respostaId}/${campoId}/${Date.now()}_${seguro}`;
  const buf = Buffer.from(await arquivo.arrayBuffer());
  const { error: upErr } = await admin.storage.from(FORMULARIOS_BUCKET).upload(storagePath, buf, {
    contentType: arquivo.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  const { data: gravado, error: insErr } = await admin
    .from('formulario_resposta_arquivos')
    .insert({
      resposta_id: respostaId,
      campo_id: campoId,
      storage_path: storagePath,
      nome_arquivo: arquivo.name.slice(0, 180) || seguro,
      mime_type: arquivo.type || null,
      tamanho_bytes: arquivo.size,
    })
    .select('id')
    .single();
  if (insErr || !gravado?.id) {
    await admin.storage.from(FORMULARIOS_BUCKET).remove([storagePath]);
    return NextResponse.json({ ok: false, error: insErr?.message ?? 'Não foi possível registrar o arquivo.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, arquivoId: String(gravado.id) });
}
