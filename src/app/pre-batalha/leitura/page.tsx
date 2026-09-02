import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { PreBatalhaSecaoClient } from '@/components/pre-batalha/PreBatalhaSecaoClient';
import { createClient } from '@/lib/supabase/server';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Link público canónico sem query — qualquer `?...` redireciona para a mesma URL. */
export default async function PreBatalhaLeituraPublicaPage({ searchParams }: Props) {
  const sp = await searchParams;
  if (Object.keys(sp).length > 0) {
    redirect('/pre-batalha/leitura');
  }

  let usuarioLogado = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    usuarioLogado = Boolean(user);
  } catch {
    usuarioLogado = false;
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <Suspense
        fallback={
          <div className="flex flex-1 items-center px-4 py-6 text-sm text-stone-600">
            Carregando guia…
          </div>
        }
      >
        <PreBatalhaSecaoClient secao="visao-geral" modoPublico usuarioLogado={usuarioLogado} />
      </Suspense>
    </div>
  );
}
