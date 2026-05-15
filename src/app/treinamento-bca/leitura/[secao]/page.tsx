import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getBcaTreinamentoSecoesParaHub, isBcaTreinamentoSecaoHubAtiva } from '@/lib/treinamento-bca-secoes';
import { TreinamentoBcaSecaoClient } from '@/components/treinamento-bca/TreinamentoBcaSecaoClient';

export const dynamicParams = false;

export function generateStaticParams() {
  return getBcaTreinamentoSecoesParaHub().map((s) => ({ secao: s.id }));
}

export default function TreinamentoBcaLeituraPublicaPage({ params }: { params: { secao: string } }) {
  if (!isBcaTreinamentoSecaoHubAtiva(params.secao)) notFound();
  return (
    <Suspense fallback={<div className="px-4 py-6 text-sm text-stone-600">Carregando treinamento…</div>}>
      <TreinamentoBcaSecaoClient secao={params.secao} modoPublico />
    </Suspense>
  );
}
