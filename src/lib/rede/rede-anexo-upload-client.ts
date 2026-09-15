export type UploadRedeAnexoClientResult = { ok: true; path?: string } | { ok: false; error: string };

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function asUploadResult(data: unknown): UploadRedeAnexoClientResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Resposta inválida ao enviar anexo.' };
  }
  const obj = data as Record<string, unknown>;
  if (obj.ok === true) {
    return {
      ok: true,
      path: typeof obj.path === 'string' && obj.path.trim() ? obj.path.trim() : undefined,
    };
  }
  return {
    ok: false,
    error: typeof obj.error === 'string' && obj.error.trim() ? obj.error : 'Não foi possível enviar o anexo.',
  };
}

/** Upload de anexo da rede via API JSON (evita digest de server action com FormData). */
export async function uploadRedeAnexoClient(formData: FormData): Promise<UploadRedeAnexoClientResult> {
  const res = await fetch('/api/rede-franqueados/anexo', {
    method: 'POST',
    body: formData,
    credentials: 'same-origin',
  });
  const data = await parseJsonSafe(res);
  return asUploadResult(data);
}
