import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PerfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
  const fullName = profile?.full_name ?? user.email ?? "";

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4">
          <Link href="/" className="text-moni-primary hover:underline">
            ← Início
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="card">
          <h1 className="text-xl font-bold text-moni-dark">Cadastro do Franqueado</h1>
          <p className="mt-2 text-stone-600">
            Dados pessoais e de cadastro do franqueado na franquia.
          </p>
          <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-500">Nome</p>
            <p className="mt-0.5 text-stone-900">{fullName || "—"}</p>
            <p className="mt-3 text-sm font-medium text-stone-500">E-mail</p>
            <p className="mt-0.5 text-stone-900">{user.email ?? "—"}</p>
          </div>
          <p className="mt-4 text-sm text-stone-500">
            Formulário completo de cadastro do franqueado será implementado em breve.
          </p>
        </div>
      </main>
    </div>
  );
}
