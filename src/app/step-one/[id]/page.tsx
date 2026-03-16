import Link from "next/link";
import { ETAPAS } from "@/types/domain";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProcessoStepOnePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: processo, error } = await supabase
    .from("processo_step_one")
    .select("id, cidade, estado, status, etapa_atual, user_id")
    .eq("id", id)
    .single();

  if (error || !processo) {
    notFound();
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "frank";
  const isMoni = role === "consultor" || role === "admin";
  const isOwner = processo.user_id === user.id;

  const cidade = processo.cidade ?? "";
  const estado = processo.estado ?? "";

  const step3Href = `/step-3?processoId=${id}`;
  const step7Href = `/step-7?processoId=${id}`;
  const step5Href = `/step-5?processoId=${id}`;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/step-one" className="text-moni-primary hover:underline">
            ← Step 1
          </Link>
          <span className="font-medium text-stone-700">
            Processo — {cidade || "Nova análise"}
            {estado ? `, ${estado}` : ""}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-bold text-moni-dark">
          Etapas do processo
        </h1>
        <p className="mt-1 text-stone-600">
          Siga a ordem das etapas. O progresso é salvo automaticamente.
        </p>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-stone-800 mb-3">Step 1</h2>
          <p className="text-sm text-stone-500 mb-3">Banco de informações: etapas 1 a 5</p>
          <ul className="space-y-3">
            {ETAPAS.filter((e) => e.id >= 1 && e.id <= 5).map((etapa) => (
              <li key={etapa.id}>
                <Link
                  href={`/step-one/${id}/etapa/${etapa.id}`}
                  className="step-card flex items-start gap-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-moni-primary/10 text-sm font-semibold text-moni-primary">
                    {etapa.id}
                  </span>
                  <div>
                    <h3 className="font-semibold text-stone-900">{etapa.nome}</h3>
                    <p className="mt-0.5 text-sm text-stone-500">{etapa.descricao}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-stone-800 mb-3">Documentos</h2>
          <p className="text-sm text-stone-500 mb-3">
            {isMoni && !isOwner
              ? "Revisar documentos enviados pelo franqueado (divergências, aprovar, reprovar e parecer)."
              : "Enviar e acompanhar documentos de opções e contrato do terreno."}
          </p>
          <ul className="space-y-3">
            <li>
              <Link
                href={step3Href}
                className="step-card flex items-start gap-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-moni-primary/10 text-sm font-semibold text-moni-primary">
                  3
                </span>
                <div>
                  <h3 className="font-semibold text-stone-900">Step 3: Opções</h3>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {isMoni && !isOwner ? "Revisar documento de opções" : "Template de opções: baixar, preencher e anexar."}
                  </p>
                </div>
              </Link>
            </li>
            <li>
              <Link
                href={step7Href}
                className="step-card flex items-start gap-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-moni-primary/10 text-sm font-semibold text-moni-primary">
                  7
                </span>
                <div>
                  <h3 className="font-semibold text-stone-900">Step 7: Contrato do Terreno</h3>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {isMoni && !isOwner ? "Revisar contrato do terreno" : "Template de contrato: baixar, preencher e anexar."}
                  </p>
                </div>
              </Link>
            </li>
            <li>
              <Link
                href={step5Href}
                className="step-card flex items-start gap-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-moni-primary/10 text-sm font-semibold text-moni-primary">
                  5
                </span>
                <div>
                  <h3 className="font-semibold text-stone-900">Step 5: Comitê</h3>
                  <p className="mt-0.5 text-sm text-stone-500">
                    Apresentação única com todos os PDFs na ordem: Prospecção → Score Batalha → Resumo. Visualizar e baixar.
                  </p>
                </div>
              </Link>
            </li>
          </ul>
        </section>

        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Rede:</strong> A ferramenta gera uma lista de contatos de
          condomínios, corretores e imobiliárias. Os dados são atualizados
          quinzenalmente.
        </div>
      </main>
    </div>
  );
}
