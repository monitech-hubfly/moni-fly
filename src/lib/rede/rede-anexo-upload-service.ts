import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { normalizeAccessRole } from '@/lib/authz';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureRedeAnexoNumeroFranquiaColumn, isRedeAnexoColumnSchemaError } from '@/lib/rede-ensure-anexo-column';
import {
  ensureRedeEmpresaDocsColumns,
  isRedeEmpresaDocColumnSchemaError,
} from '@/lib/rede-ensure-empresa-docs-columns';
import {
  isRedeEmpresaDocColumn,
  MAX_REDE_DOC_BYTES,
  normalizeRedeAnexoStoragePath,
  parseRedeAnexoTipo,
  REDE_ANEXO_COLUNA,
  REDE_ANEXO_JUSTIFICATIVA_COLUNA,
  sanitizeRedeNomeArquivo,
  type RedeAnexoTipo,
} from '@/lib/rede/rede-anexo-config';

export type UploadRedeAnexoResult = { ok: true; path: string } | { ok: false; error: string };

async function perfilPodeGerirDocsRede(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
  const access = normalizeAccessRole((profile as { role?: string } | null)?.role);
  return access === 'admin' || access === 'team';
}

async function ensureColumnForAnexo(column: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (column === 'anexo_numero_franquia_path') return ensureRedeAnexoNumeroFranquiaColumn();
  if (isRedeEmpresaDocColumn(column)) return ensureRedeEmpresaDocsColumns();
  return { ok: true };
}

function isAnexoColumnSchemaError(message: string, column: string): boolean {
  if (column === 'anexo_numero_franquia_path') return isRedeAnexoColumnSchemaError(message, column);
  return isRedeEmpresaDocColumnSchemaError(message, column) || isRedeAnexoColumnSchemaError(message, column);
}

async function updateRedeAnexoPathAdmin(
  admin: ReturnType<typeof createAdminClient>,
  redeId: string,
  column: string,
  storagePath: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const patch = { [column]: storagePath, updated_at: new Date().toISOString() };

  const attempt = async () => {
    const { data, error } = await admin
      .from('rede_franqueados')
      .update(patch as never)
      .eq('id', redeId)
      .select('id')
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    if (!data?.id) {
      return { ok: false as const, error: 'Franqueado não encontrado para gravar o anexo.' };
    }
    return { ok: true as const };
  };

  let result = await attempt();
  if (result.ok) return result;

  if (!isAnexoColumnSchemaError(result.error, column)) return result;

  const ensured = await ensureColumnForAnexo(column);
  if (!ensured.ok) return ensured;

  return attempt();
}

function revalidateRedePaths(redeId: string) {
  revalidatePath('/rede-franqueados');
  revalidatePath(`/rede-franqueados/${redeId}`);
}

/** Upload de anexo da rede (franquia, franqueado ou empresas) com persistência via service role. */
export async function uploadRedeAnexoFromFormData(formData: FormData): Promise<UploadRedeAnexoResult> {
  const tipoRaw = String(formData.get('tipo') ?? '').trim();
  const redeId = String(formData.get('redeId') ?? '').trim();
  const file = formData.get('file');
  if (!redeId) return { ok: false, error: 'Registro inválido.' };
  const tipo: RedeAnexoTipo | null = parseRedeAnexoTipo(tipoRaw);
  if (!tipo) return { ok: false, error: 'Tipo inválido.' };
  if (!(file instanceof File)) return { ok: false, error: 'Arquivo inválido.' };
  if (file.size > MAX_REDE_DOC_BYTES) return { ok: false, error: 'Arquivo acima de 10 MB.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Faça login.' };
  if (!(await perfilPodeGerirDocsRede(supabase, user.id))) {
    return { ok: false, error: 'Apenas administradores ou time podem enviar estes documentos.' };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: 'Serviço de arquivos indisponível no servidor.' };
  }

  const col = REDE_ANEXO_COLUNA[tipo];
  const { data: atual, error: leErr } = await admin
    .from('rede_franqueados')
    .select('*')
    .eq('id', redeId)
    .maybeSingle();
  if (leErr || !atual) return { ok: false, error: 'Linha da rede não encontrada.' };

  const orig = sanitizeRedeNomeArquivo(file.name || 'arquivo');
  const storagePath = `rede/${redeId}/${tipo}-${randomUUID()}-${orig}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from('rede-attachments').upload(storagePath, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const oldPathRaw = String((atual as Record<string, unknown>)[col] ?? '').trim() || null;
  const oldPath = oldPathRaw ? normalizeRedeAnexoStoragePath(oldPathRaw) : null;

  const upRow = await updateRedeAnexoPathAdmin(admin, redeId, col, storagePath);
  if (!upRow.ok) {
    await admin.storage.from('rede-attachments').remove([storagePath]);
    return upRow;
  }

  const justCol = REDE_ANEXO_JUSTIFICATIVA_COLUNA[tipo as keyof typeof REDE_ANEXO_JUSTIFICATIVA_COLUNA];
  if (justCol) {
    await admin.from('rede_franqueados').update({ [justCol]: null } as never).eq('id', redeId);
  }

  if (oldPath && oldPath !== storagePath) {
    await admin.storage.from('rede-attachments').remove([oldPath]);
  }

  revalidateRedePaths(redeId);
  return { ok: true, path: storagePath };
}
