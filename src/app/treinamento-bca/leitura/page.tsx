import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { TreinamentoBcaSecaoClient } from '@/components/treinamento-bca/TreinamentoBcaSecaoClient';
import { createClient } from '@/lib/supabase/server';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Link público canónico sem query — qualquer `?...` redireciona para a mesma URL. */
export default async function TreinamentoBcaLeituraPublicaPage({ searchParams }: Props) {
  const sp = await searchParams;
  if (Object.keys(sp).length > 0) {
    redirect('/treinamento-bca/leitura');
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
    <Suspense fallback={<div className="px-4 py-6 text-sm text-stone-600">Carregando treinamento…</div>}>
      <TreinamentoBcaSecaoClient secao="introducao" modoPublico usuarioLogado={usuarioLogado} />
    </Suspense>
  );
}
