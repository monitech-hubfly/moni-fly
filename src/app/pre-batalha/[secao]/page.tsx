import { notFound, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PreBatalhaSecaoClient } from '@/components/pre-batalha/PreBatalhaSecaoClient';
import { createClient } from '@/lib/supabase/server';
import { getPreBatalhaSecoesParaHub, isPreBatalhaSecaoHubAtiva } from '@/lib/pre-batalha-secoes';

export const dynamicParams = false;

export function generateStaticParams() {
  return getPreBatalhaSecoesParaHub().map((s) => ({ secao: s.id }));
}

export default async function PreBatalhaSecaoPage({ params }: { params: { secao: string } }) {
  if (!isPreBatalhaSecaoHubAtiva(params.secao)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/pre-batalha/leitura');

  return (
    <Suspense fallback={<div className="px-4 py-6 text-sm text-stone-600">Carregando guia…</div>}>
      <PreBatalhaSecaoClient secao={params.secao} />
    </Suspense>
  );
}
