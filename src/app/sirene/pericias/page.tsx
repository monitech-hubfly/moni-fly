import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SirenePericiasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white">Perícias (Caneta Verde)</h1>
      <p className="mt-1 text-stone-400">
        Lista de perícias, vinculação com chamados concluídos e planejamento. Em breve.
      </p>
      <div className="mt-6 rounded-xl border border-stone-700 bg-stone-800/60 p-6">
        <p className="text-sm text-stone-500">
          Aqui ficarão: perícias em andamento, histórico de chamados por perícia, select com busca no Planejamento de Perícias.
        </p>
      </div>
    </main>
  );
}
