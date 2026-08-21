import fs from 'fs/promises';
import path from 'path';
import type { createAdminClient } from '@/lib/supabase/admin';

export const CHECKLIST_TEMPLATE_STATIC_PREFIX = 'static:';
const BUCKET = 'documentos-templates';

export function isStaticChecklistTemplatePath(storagePath: string | null | undefined): boolean {
  const p = String(storagePath ?? '').trim();
  return p.startsWith(CHECKLIST_TEMPLATE_STATIC_PREFIX) || p.startsWith('/templates/');
}

export function resolveStaticChecklistTemplatePublicPath(storagePath: string): string {
  const p = storagePath.trim();
  if (p.startsWith(CHECKLIST_TEMPLATE_STATIC_PREFIX)) {
    return p.slice(CHECKLIST_TEMPLATE_STATIC_PREFIX.length);
  }
  return p;
}

export function resolveStaticChecklistTemplateAbsolutePath(storagePath: string): string {
  const publicPath = resolveStaticChecklistTemplatePublicPath(storagePath).replace(/^\//, '');
  return path.join(process.cwd(), 'public', publicPath);
}

export function resolveChecklistTemplateDownloadUrl(storagePath: string, origin: string): string | null {
  if (!isStaticChecklistTemplatePath(storagePath)) return null;
  const publicPath = resolveStaticChecklistTemplatePublicPath(storagePath);
  return `${origin.replace(/\/$/, '')}${publicPath.startsWith('/') ? publicPath : `/${publicPath}`}`;
}

export async function readChecklistTemplateBuffer(
  admin: ReturnType<typeof createAdminClient>,
  storagePath: string,
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: string }> {
  const p = String(storagePath ?? '').trim();
  if (!p) return { ok: false, error: 'Caminho do modelo vazio.' };

  if (isStaticChecklistTemplatePath(p)) {
    try {
      const abs = resolveStaticChecklistTemplateAbsolutePath(p);
      const buf = await fs.readFile(abs);
      return { ok: true, buf };
    } catch {
      return { ok: false, error: 'Modelo não encontrado no servidor.' };
    }
  }

  const { data, error } = await admin.storage.from(BUCKET).download(p);
  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Falha ao ler ficheiro no armazenamento.' };
  }
  const buf = Buffer.from(await data.arrayBuffer());
  return { ok: true, buf };
}

export async function createChecklistTemplateSignedUrl(
  admin: ReturnType<typeof createAdminClient>,
  storagePath: string,
  origin: string,
  expiresSeconds = 3600,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const p = String(storagePath ?? '').trim();
  if (!p) return { ok: false, error: 'Modelo não configurado para este item.' };

  const staticUrl = resolveChecklistTemplateDownloadUrl(p, origin);
  if (staticUrl) return { ok: true, url: staticUrl };

  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(p, expiresSeconds);
  if (signErr || !signed?.signedUrl) {
    return { ok: false, error: signErr?.message ?? 'Não foi possível gerar o link do arquivo.' };
  }
  return { ok: true, url: signed.signedUrl };
}

/** Caminhos estáticos dos termos — Dados do Candidato (Funil Step One). */
export const TEMPLATE_STEPONE_TERMO_CONFIDENCIALIDADE =
  'static:/templates/stepone-candidato/termo-confidencialidade.docx';
export const TEMPLATE_STEPONE_TERMO_AUTORIZACAO =
  'static:/templates/stepone-candidato/termo-autorizacao-consulta.docx';
