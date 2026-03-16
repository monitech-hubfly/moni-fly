"use server";

import { createClient } from "@/lib/supabase/server";
import { createDocument, type AutentiqueSignerInput } from "@/lib/autentique";

const BUCKET = "processo-docs";

export async function approveDocumentInstance(instanceId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "frank";
  if (role !== "consultor" && role !== "admin") return { ok: false, error: "Sem permissão." };

  const { error } = await supabase
    .from("document_instances")
    .update({
      status: "aprovado",
      analisado_por: user.id,
      analisado_em: new Date().toISOString(),
      motivo_reprovacao: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", instanceId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function rejectDocumentInstance(
  instanceId: string,
  motivo: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "frank";
  if (role !== "consultor" && role !== "admin") return { ok: false, error: "Sem permissão." };

  const { error } = await supabase
    .from("document_instances")
    .update({
      status: "reprovado",
      analisado_por: user.id,
      analisado_em: new Date().toISOString(),
      motivo_reprovacao: motivo.trim() || "Reprovado pelo consultor.",
      updated_at: new Date().toISOString(),
    })
    .eq("id", instanceId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function enviarParaAutentique(instanceId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "frank";
  if (role !== "consultor" && role !== "admin") return { ok: false, error: "Sem permissão." };

  const apiKey = process.env.AUTENTIQUE_API_KEY;
  if (!apiKey) return { ok: false, error: "Integração Autentique não configurada (AUTENTIQUE_API_KEY)." };

  const { data: instance, error: instError } = await supabase
    .from("document_instances")
    .select("id, processo_id, step, status, arquivo_preenchido_path, template_id")
    .eq("id", instanceId)
    .single();

  if (instError || !instance) return { ok: false, error: "Instância não encontrada." };
  if (instance.status !== "aprovado") return { ok: false, error: "Só é possível enviar para assinatura documentos aprovados." };
  if (!instance.arquivo_preenchido_path) return { ok: false, error: "Documento sem arquivo anexado." };

  let signers: AutentiqueSignerInput[] = [];
  if (instance.template_id) {
    const { data: tpl } = await supabase
      .from("document_templates")
      .select("metadados")
      .eq("id", instance.template_id)
      .single();
    const meta = (tpl?.metadados as { signers?: Array<{ email?: string; action?: string }> } | null) ?? {};
    if (Array.isArray(meta.signers) && meta.signers.length > 0) {
      signers = meta.signers.map((s) => ({ email: s.email, action: (s.action as "SIGN") || "SIGN" }));
    }
  }
  if (signers.length === 0 && process.env.AUTENTIQUE_SIGNERS_EMAILS) {
    const emails = process.env.AUTENTIQUE_SIGNERS_EMAILS.split(",").map((e) => e.trim()).filter(Boolean);
    signers = emails.map((email) => ({ email, action: "SIGN" as const }));
  }
  if (signers.length === 0) return { ok: false, error: "Configure os signatários no template (metadados.signers) ou em AUTENTIQUE_SIGNERS_EMAILS." };

  const path = instance.arquivo_preenchido_path.replace(/^\//, "");
  const { data: fileData, error: downloadError } = await supabase.storage.from(BUCKET).download(path);
  if (downloadError || !fileData) return { ok: false, error: "Falha ao baixar o arquivo do documento." };

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const fileName = path.split("/").pop() ?? "documento.pdf";
  const docName = `Documento Step ${instance.step} - Processo ${instance.processo_id.slice(0, 8)}`;

  const result = await createDocument(apiKey, buffer, fileName, docName, signers);
  if (!result.ok) return { ok: false, error: result.error };

  const { error: updateError } = await supabase
    .from("document_instances")
    .update({
      autentique_document_id: result.document.id,
      status: "enviado_assinatura",
      assinatura_status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", instanceId);

  if (updateError) return { ok: false, error: updateError.message };
  return { ok: true };
}
