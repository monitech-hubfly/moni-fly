"use server";

import { createClient } from "@/lib/supabase/server";

const BUCKET = "processo-docs";
const AREA_STEP3 = "step3_opcoes";

export type StepDocInstance = {
  id: string;
  status: string;
  versao: number;
  arquivo_preenchido_path: string | null;
  arquivo_assinado_path: string | null;
  diff_json: Record<string, unknown> | null;
  motivo_reprovacao: string | null;
  created_at: string;
};

export async function getStep3TemplateUrl(): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };

  const { data, error } = await supabase
    .from("document_templates")
    .select("arquivo_path")
    .eq("area", AREA_STEP3)
    .eq("step", 3)
    .eq("ativo", true)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data?.arquivo_path) return { ok: true, url: null };

  // Path no bucket: se for só o nome do arquivo (sem /), usa pasta step3/
  const path = data.arquivo_path.includes("/") ? data.arquivo_path : `step3/${data.arquivo_path}`;

  const { data: signed, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path.replace(/^\//, ""), 60 * 10);

  if (signedError) return { ok: false, error: signedError.message };
  return { ok: true, url: signed?.signedUrl ?? null };
}

export async function listStep3Instances(processoId: string): Promise<StepDocInstance[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("document_instances")
    .select("id, status, versao, arquivo_preenchido_path, arquivo_assinado_path, diff_json, motivo_reprovacao, created_at")
    .eq("processo_id", processoId)
    .eq("step", 3)
    .order("created_at", { ascending: false });

  return (data ?? []) as StepDocInstance[];
}

export async function registerStep3Upload(
  processoId: string,
  filePath: string,
  diffJson?: Record<string, unknown> | null
): Promise<{ ok: boolean; error?: string; instanceId?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };

  const { data: tpl } = await supabase
    .from("document_templates")
    .select("id, versao")
    .eq("area", AREA_STEP3)
    .eq("step", 3)
    .eq("ativo", true)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();

  const templateId = tpl?.id ?? null;

  const { data: last } = await supabase
    .from("document_instances")
    .select("versao")
    .eq("processo_id", processoId)
    .eq("step", 3)
    .order("versao", { ascending: false })
    .limit(1);

  const nextVersion = (last && last.length > 0 ? (last[0].versao ?? 0) : 0) + 1;

  const { data: inserted, error } = await supabase
    .from("document_instances")
    .insert({
      processo_id: processoId,
      step: 3,
      template_id: templateId,
      versao: nextVersion,
      status: "aguardando_revisao",
      arquivo_preenchido_path: filePath,
      diff_json: diffJson ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, instanceId: inserted?.id };
}

