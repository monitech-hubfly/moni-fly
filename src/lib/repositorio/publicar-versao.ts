import { randomUUID } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'documentos-templates';

function nomeSeguro(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
  return base.length > 0 ? base : 'arquivo';
}

export async function publicarVersaoRepositorio(params: {
  secaoId: string;
  tipoId: string;
  arquivo: File;
  userId: string;
  tipoAlvo: { tipo_id: string } | { variacao_id: string };
  juridicoPontoId?: string | null;
}): Promise<{ ok: true; id: string; jaExistia?: boolean } | { ok: false; error: string }> {
  const alvoTipo = 'tipo_id' in params.tipoAlvo ? params.tipoAlvo.tipo_id : null;
  const alvoVariacao = 'variacao_id' in params.tipoAlvo ? params.tipoAlvo.variacao_id : null;
  const pontoId = params.juridicoPontoId?.trim() || null;
  const safe = nomeSeguro(params.arquivo.name);
  const storagePath = `repositorio/${params.secaoId}/${params.tipoId}/${randomUUID()}_${safe}`;
  const admin = createAdminClient();
  const buf = Buffer.from(await params.arquivo.arrayBuffer());
  const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, buf, {
    contentType: params.arquivo.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { data, error } = await admin.rpc('repositorio_registrar_versao_vigente', {
    p_secao_id: params.secaoId,
    p_nome: safe,
    p_storage_path: storagePath,
    p_bucket: BUCKET,
    p_criado_por: params.userId,
    p_tipo_id: alvoTipo,
    p_variacao_id: alvoVariacao,
    p_juridico_ponto_id: pontoId,
  });

  if (error || !data) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    const duplicado = Boolean(pontoId) && /ponto_unico|duplicate key/i.test(error?.message ?? '');
    if (duplicado) {
      const { data: existente } = await admin
        .from('repositorio_documentos')
        .select('id')
        .eq('juridico_ponto_id', pontoId)
        .maybeSingle();
      if (existente?.id) return { ok: true, id: String(existente.id), jaExistia: true };
    }
    return { ok: false, error: error?.message ?? 'Não foi possível publicar a versão.' };
  }

  return { ok: true, id: String(data) };
}
