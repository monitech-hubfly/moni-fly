import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StepsKanbanColumn, type ProcessoCard } from "./StepsKanbanColumn";

const COLUMNS: { step_atual: number; title: string }[] = [
  { step_atual: 1, title: "Step 1: Região!" },
  { step_atual: 2, title: "Step 2: Novo negócio" },
  { step_atual: 3, title: "Step 3: Opções" },
  { step_atual: 4, title: "Step 4: Check Legal" },
  { step_atual: 5, title: "Step 5: Comitê" },
];

export default async function StepsViabilidadeKanbanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("processo_step_one")
    .select("id, cidade, estado, status, etapa_atual, updated_at, user_id, step_atual, cancelado_em")
    .neq("status", "cancelado");
  const rowsNaoCancelados = (rows ?? []).filter(
    (r) => r.status !== "cancelado" && (r as { cancelado_em?: string | null }).cancelado_em == null
  );

  const processIds = rowsNaoCancelados.map((r) => r.user_id).filter(Boolean) as string[];
  let profiles: { id: string; full_name: string | null }[] = [];
  if (processIds.length > 0) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...new Set(processIds)]);
    profiles = prof ?? [];
  }
  const profileByUserId = Object.fromEntries(profiles.map((p) => [p.id, p.full_name ?? null]));

  const processos: ProcessoCard[] = rowsNaoCancelados.map((r) => ({
    id: r.id,
    cidade: r.cidade ?? "",
    estado: r.estado ?? null,
    status: r.status ?? "rascunho",
    etapa_atual: r.etapa_atual ?? 1,
    updated_at: r.updated_at ?? null,
    franqueado_nome: profileByUserId[r.user_id] ?? null,
    step_atual: (r as { step_atual?: number }).step_atual ?? 1,
  }));

  const byStep = COLUMNS.reduce(
    (acc, col) => {
      acc[col.step_atual] = processos.filter((p) => p.step_atual === col.step_atual);
      return acc;
    },
    {} as Record<number, ProcessoCard[]>
  );

  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="text-moni-primary hover:underline">
            ← Início
          </Link>
          <span className="text-stone-400">/</span>
          <span className="font-medium text-stone-700">Steps Viabilidade — Kanban</span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 overflow-x-auto">
        <h1 className="text-xl font-bold text-moni-dark mb-2">Acompanhamento dos processos</h1>
        <p className="text-sm text-stone-600 mb-4">
          Processos dos franqueados em andamento nas respectivas fases.
        </p>
        <div className="flex gap-4 min-w-max">
          {COLUMNS.map((col) => (
            <StepsKanbanColumn
              key={col.step_atual}
              title={col.title}
              processos={byStep[col.step_atual] ?? []}
              stepNum={col.step_atual}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
