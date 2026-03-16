import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { fetchRedeFranqueados } from '@/lib/rede-franqueados';
import { TabelaRedeFranqueados } from '@/components/TabelaRedeFranqueados';

export default async function RedeFranqueadosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  const role = (profile?.role as string) ?? 'frank';
  if (role !== 'admin') redirect('/comunidade');

  const data = await fetchRedeFranqueados(supabase);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="text-moni-primary hover:underline">
            ← Início
          </Link>
          <span className="text-stone-400">/</span>
          <span className="font-semibold text-moni-dark">Rede de Franqueados</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-moni-dark">Tabela de Franqueados</h1>
            <p className="mt-1 text-sm text-stone-600">
              Tabela de franqueados gerenciada dentro da ferramenta (fonte: banco de dados).
            </p>
          </div>
          {data && (
            <div className="shrink-0 rounded-xl border-2 border-moni-primary bg-moni-primary/5 px-6 py-4 text-right">
              <p className="text-sm font-medium text-stone-600">Franqueados ativos</p>
              <p className="mt-0.5 text-2xl font-bold text-moni-dark">{data.activeCount}</p>
            </div>
          )}
        </div>
        <TabelaRedeFranqueados data={data} />
      </main>
    </div>
  );
}
