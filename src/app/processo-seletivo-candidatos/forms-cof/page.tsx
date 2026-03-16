import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function FormsCofPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (profile?.role as string) ?? "frank";
  if (role !== "admin" && role !== "supervisor") redirect("/");

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
          <Link href="/" className="text-moni-primary hover:underline">← Início</Link>
          <span className="text-stone-400 mx-2">/</span>
          <Link href="/processo-seletivo-candidatos" className="text-moni-primary hover:underline">Processo seletivo candidatos</Link>
          <span className="text-stone-400 mx-2">/</span>
          <span className="font-semibold text-moni-dark">Forms + COF</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="card">
          <h1 className="text-xl font-bold text-moni-dark">Forms + COF</h1>
          <p className="mt-2 text-stone-600">
            Formulários e COF do processo seletivo de candidatos.
          </p>
          <div className="mt-6 rounded-xl border border-dashed border-stone-200 bg-stone-50 p-8 text-center text-stone-500 text-sm">
            Conteúdo em construção.
          </div>
        </div>
      </main>
    </div>
  );
}
