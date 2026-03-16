import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registerStep3Upload } from "@/app/step-3/actions";
import { extractText, computeDiff } from "@/lib/document-diff";

const BUCKET = "processo-docs";
const AREA_STEP3 = "step3_opcoes";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const formData = await req.formData();
  const processoId = formData.get("processoId");
  const file = formData.get("file");

  if (typeof processoId !== "string" || !file || !(file instanceof File)) {
    return NextResponse.redirect(new URL("/step-3", req.url));
  }

  const path = `processos/${processoId}/step3/${Date.now()}_${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let diffJson: Record<string, unknown> | null = null;
  try {
    const { data: tpl } = await supabase
      .from("document_templates")
      .select("arquivo_path")
      .eq("area", AREA_STEP3)
      .eq("step", 3)
      .eq("ativo", true)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();

    const templatePath = tpl?.arquivo_path
      ? (tpl.arquivo_path.includes("/") ? tpl.arquivo_path : `step3/${tpl.arquivo_path}`)
      : null;

    if (templatePath) {
      const { data: templateFile } = await supabase.storage.from(BUCKET).download(templatePath);
      if (templateFile) {
        const templateBuffer = Buffer.from(await templateFile.arrayBuffer());
        const templateText = await extractText(
          templateBuffer,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "template.docx"
        );
        const documentText = await extractText(buffer, file.type || "", file.name);
        const diffResult = computeDiff(templateText, documentText);
        diffJson = diffResult as unknown as Record<string, unknown>;
      }
    }
  } catch {
    // Continua sem diff em caso de erro na extração
  }

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.redirect(new URL("/step-3?erroUpload=1", req.url));
  }

  const result = await registerStep3Upload(processoId, path, diffJson);
  if (!result.ok) {
    return NextResponse.redirect(new URL("/step-3?erroUpload=1", req.url));
  }

  return NextResponse.redirect(new URL("/step-3", req.url));
}

